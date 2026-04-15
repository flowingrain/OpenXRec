import { NextRequest } from 'next/server';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { createSufficiencyEvaluator } from '@/lib/recommendation/recommendation-types';
import { getRecommendDisplayMax } from '@/lib/recommendation/batch-llm-explanations';
import {
  getAgentRecommendationService,
  type AgentProgressEvent,
} from '@/lib/recommendation/agent-recommendation-service';
import type { UserProfile } from '@/lib/recommendation/types';
import { advancedWebSearch, getWebSearchProvider } from '@/lib/search/advanced-web-search';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import type { LLMClient } from 'coze-coding-dev-sdk';
import { embeddingService } from '@/lib/embedding/service';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  getRecommendationContextManager,
  ensureRecommendationChatSession,
} from '@/lib/recommendation/recommendation-context-bridge';
import {
  RECOMMENDATION_TTL_MS,
  extractQueryFromBody,
  buildCacheKey,
  getCachedRecommendation,
  setCachedRecommendation,
  persistRecommendationCase,
  recordRecommendationAssistantTurn,
  mapAgentResultToResponseData,
} from '@/lib/recommendation/recommendation-route-utils';

let llmClientInstance: LLMClient | null = null;
function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    llmClientInstance = createLLMClient({});
  }
  return llmClientInstance;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const query = extractQueryFromBody(body);

  if (!query) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: '缺少查询内容' })}\n\n`,
      {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      const requestStart = Date.now();
      const stepTimings: Record<string, number> = {};
      const markStep = (name: string, start: number) => {
        stepTimings[name] = Date.now() - start;
      };
      const sendStep = (phase: string, status: 'start' | 'complete', extra?: Record<string, unknown>) => {
        send('progress', {
          phase,
          status,
          timestamp: Date.now(),
          phaseTimings: { ...stepTimings },
          ...(extra || {}),
        });
      };

      const run = async () => {
        try {
          send('start', { query, timestamp: Date.now(), mode: 'sse' });
          const profileMergeStart = Date.now();
          const {
            userProfile: bodyUserProfile,
            context,
            sessionContext: bodySessionContext,
            skipSufficiencyCheck,
            userId,
            sessionId: bodySessionId,
            forceRefresh,
            taskScheduleId: bodyTaskScheduleId,
          } = body as Record<string, unknown>;

          const sessionContext = {
            ...(typeof bodySessionContext === 'object' && bodySessionContext ? bodySessionContext : {}),
            ...(typeof context === 'object' && context ? context : {}),
            ...(typeof userId === 'string' ? { userId } : {}),
          } as Record<string, unknown>;
          const scenario =
            typeof sessionContext === 'object' && sessionContext && 'scenario' in sessionContext
              ? String(sessionContext.scenario)
              : undefined;
          const taskScheduleId =
            (typeof bodyTaskScheduleId === 'string' ? bodyTaskScheduleId.trim() : undefined) ||
            (typeof sessionContext.taskScheduleId === 'string' ? sessionContext.taskScheduleId.trim() : undefined);
          const cacheKey = buildCacheKey(query, scenario, typeof userId === 'string' ? userId : undefined);
          const sessionKey =
            typeof bodySessionId === 'string' && bodySessionId.trim()
              ? bodySessionId.trim()
              : typeof userId === 'string'
                ? userId.trim()
                : '';
          let recCm = null;
          let skipTtlForChatSession = false;
          if (sessionKey) {
            recCm = getRecommendationContextManager();
            await ensureRecommendationChatSession(recCm, {
              userId: sessionKey,
              sessionId: sessionKey,
              scenario,
            });
            const stats = recCm.getSessionStats(sessionKey);
            skipTtlForChatSession = (stats?.messageCount ?? 0) > 0;
          }

          sendStep('ttl_cache_lookup', 'start');
          const ttlCacheStart = Date.now();
          if (!forceRefresh && !skipTtlForChatSession) {
            const cached = getCachedRecommendation(cacheKey);
            markStep('ttl_cache_lookup', ttlCacheStart);
            if (cached) {
              stepTimings.total = Date.now() - requestStart;
              const cachedResponseData = {
                ...cached,
                metadata: {
                  ...(cached.metadata || {}),
                  cacheHit: true,
                  cacheType: 'ttl',
                  cacheTtlMs: RECOMMENDATION_TTL_MS,
                  routeTimings: stepTimings,
                  routeTotalMs: stepTimings.total,
                },
              };
              try {
                await persistRecommendationCase({
                  query,
                  scenario,
                  explanation: cachedResponseData.explanation,
                  confidence: Number(cachedResponseData?.metadata?.confidence ?? 0.7),
                  responseData: cachedResponseData,
                  source: 'ttl_cache',
                });
              } catch (e) {
                console.warn('[Recommendation SSE] ttl cache case persistence skipped:', e);
              }
              if (recCm && sessionKey) {
                try {
                  await recCm.addUserMessage(sessionKey, query);
                  await recordRecommendationAssistantTurn(recCm, sessionKey, {
                    explanation:
                      typeof cachedResponseData.explanation === 'string' ? cachedResponseData.explanation : '',
                    itemCount: Array.isArray(cachedResponseData.items) ? cachedResponseData.items.length : 0,
                  });
                } catch (e) {
                  console.warn('[Recommendation SSE] ttl cache chat turn skipped:', e);
                }
              }
              sendStep('ttl_cache_lookup', 'complete', { cacheHit: true });
              send('final', { success: true, data: cachedResponseData });
              controller.close();
              return;
            }
          } else {
            markStep('ttl_cache_lookup', ttlCacheStart);
          }
          sendStep('ttl_cache_lookup', 'complete', { cacheHit: false });

          const memoryManager = getSupabaseRecommendationMemoryManager();
          let mergedUserProfile: UserProfile | undefined;
          if (typeof userId === 'string' && userId.trim()) {
            try {
              mergedUserProfile = await memoryManager.getUserProfile(userId.trim());
            } catch (e) {
              console.warn('[Recommendation SSE] getUserProfile:', e);
            }
          }
          if (bodyUserProfile && typeof bodyUserProfile === 'object') {
            const b = bodyUserProfile as Record<string, unknown>;
            const uid =
              (typeof b.userId === 'string' && b.userId) ||
              mergedUserProfile?.userId ||
              (typeof userId === 'string' ? userId : '');
            mergedUserProfile = {
              userId: uid,
              interests: [
                ...new Set([
                  ...(mergedUserProfile?.interests || []),
                  ...((b.interests as string[] | undefined) || []),
                ]),
              ],
              preferences: {
                ...(mergedUserProfile?.preferences || {}),
                ...((b.preferences as Record<string, unknown>) || {}),
              },
              behaviorHistory: mergedUserProfile?.behaviorHistory || [],
              demographics: (b.demographics as UserProfile['demographics']) ?? mergedUserProfile?.demographics,
            };
          } else if (!mergedUserProfile && typeof userId === 'string' && userId) {
            mergedUserProfile = { userId, interests: [], preferences: {}, behaviorHistory: [] };
          }
          markStep('prepare_profile_context', profileMergeStart);

          const baseCtx =
            typeof sessionContext === 'object' && sessionContext
              ? { ...(sessionContext as Record<string, unknown>) }
              : {};
          let effectiveSessionContext: Record<string, unknown> = baseCtx;
          if (sessionKey && recCm) {
            try {
              await recCm.addUserMessage(sessionKey, query);
              const historyText = await recCm.getContextForLLM(sessionKey);
              if (historyText.trim()) {
                effectiveSessionContext.recommendationChatHistory = historyText;
              }
            } catch (e) {
              console.warn('[Recommendation SSE] recommendation chat context merge skipped:', e);
            }
          }

          if (!skipSufficiencyCheck) {
            const suffStart = Date.now();
            sendStep('sufficiency_evaluation', 'start');
            try {
              const evaluator = createSufficiencyEvaluator(getLLMClient());
              const sufficiency = await evaluator.evaluate(query, effectiveSessionContext);
              markStep('sufficiency_evaluation', suffStart);
              sendStep('sufficiency_evaluation', 'complete');
              if (!sufficiency.isSufficient && sufficiency.suggestedQuestions?.length) {
                const followUpQuestions =
                  sufficiency.clarificationQuestions ||
                  sufficiency.suggestedQuestions.map((q: string, i: number) => ({
                    id: `q_${i}`,
                    question: q,
                    type: 'text',
                  }));
                await recordRecommendationAssistantTurn(recCm, sessionKey, {
                  needsClarification: true,
                  explanation: '为了给您提供更精准的推荐，我需要了解一些额外信息。',
                });
                send('final', {
                  success: true,
                  data: {
                    items: [],
                    needsClarification: true,
                    sufficiency: {
                      score: sufficiency.score,
                      isSufficient: sufficiency.isSufficient,
                      missingFields: sufficiency.missingFields,
                    },
                    followUpQuestions,
                    explanation: '为了给您提供更精准的推荐，我需要了解一些额外信息。',
                    metadata: {
                      clarification: {
                        needsClarification: true,
                        sufficiency,
                        followUpQuestions,
                      },
                    },
                  },
                });
                controller.close();
                return;
              }
            } catch (error: unknown) {
              markStep('sufficiency_evaluation', suffStart);
              sendStep('sufficiency_evaluation', 'complete', { failed: true });
              console.error('[Recommendation SSE] Sufficiency evaluation failed:', error);
            }
          }

          const displayMax = getRecommendDisplayMax();
          const agentService = getAgentRecommendationService(getLLMClient(), {
            maxReturnItems: displayMax,
          });
          let webContext = '';
          const webSearchStart = Date.now();
          sendStep('web_search', 'start');
          try {
            const wr = await advancedWebSearch(query, {
              searchType: 'web',
              count: Math.min(15, displayMax + 5),
              needSummary: true,
            });
            const raw = (wr.web_items ?? wr.results ?? []) as Array<{
              title?: string;
              snippet?: string;
              content?: string;
            }>;
            webContext = raw
              .slice(0, 15)
              .map(
                (item) =>
                  `${item.title || ''}\n${
                    item.snippet || (typeof item.content === 'string' ? item.content.slice(0, 220) : '')
                  }`
              )
              .join('\n\n')
              .slice(0, 8000);
            console.log('[Recommendation SSE] 联网检索摘要:', {
              provider: getWebSearchProvider(),
              webItemCount: raw.length,
              contextCharLength: webContext.length,
            });
          } catch (e) {
            console.warn('[Recommendation SSE] Web context fetch skipped:', e);
          } finally {
            markStep('web_search', webSearchStart);
            sendStep('web_search', 'complete');
          }

          const vectorReuseStart = Date.now();
          sendStep('vector_reuse_lookup', 'start');
          if (!forceRefresh && !skipTtlForChatSession) {
            try {
              const similar = await embeddingService.searchSimilarCases(query, { limit: 1, threshold: 0.92 });
              const best = similar[0];
              if (best?.id) {
                const supabase = getSupabaseClient();
                const { data: row } = await supabase
                  .from('analysis_cases')
                  .select('id, analyzed_at, agent_outputs')
                  .eq('id', best.id)
                  .maybeSingle();
                const ageMs = row?.analyzed_at ? Date.now() - new Date(row.analyzed_at).getTime() : Number.MAX_SAFE_INTEGER;
                const cachedPayload = (row?.agent_outputs as Record<string, any> | undefined)?.recommendationResponse;
                if (cachedPayload && ageMs <= 30 * 60 * 1000) {
                  setCachedRecommendation(cacheKey, cachedPayload);
                  const reusedResponseData = {
                    ...cachedPayload,
                    metadata: {
                      ...(cachedPayload.metadata || {}),
                      cacheHit: true,
                      cacheType: 'vector_reuse',
                      reusedCaseId: best.id,
                      similarity: best.similarity,
                    },
                  };
                  try {
                    await persistRecommendationCase({
                      query,
                      scenario,
                      explanation: reusedResponseData.explanation,
                      confidence: Number(reusedResponseData?.metadata?.confidence ?? 0.7),
                      responseData: reusedResponseData,
                      source: 'vector_reuse',
                      reusedCaseId: best.id,
                    });
                  } catch (e) {
                    console.warn('[Recommendation SSE] vector reuse case persistence skipped:', e);
                  }
                  await recordRecommendationAssistantTurn(recCm, sessionKey, {
                    explanation:
                      typeof reusedResponseData.explanation === 'string' ? reusedResponseData.explanation : '',
                    itemCount: Array.isArray(reusedResponseData.items) ? reusedResponseData.items.length : 0,
                  });
                  markStep('vector_reuse_lookup', vectorReuseStart);
                  sendStep('vector_reuse_lookup', 'complete', { cacheHit: true });
                  send('final', { success: true, data: reusedResponseData });
                  controller.close();
                  return;
                }
              }
            } catch (e) {
              console.warn('[Recommendation SSE] vector reuse skipped:', e);
            } finally {
              markStep('vector_reuse_lookup', vectorReuseStart);
            }
          } else {
            markStep('vector_reuse_lookup', vectorReuseStart);
          }
          sendStep('vector_reuse_lookup', 'complete', { cacheHit: false });

          const agentStart = Date.now();
          sendStep('agent_generate_recommendations', 'start');
          const agentResult = await agentService.generateRecommendations(
            query,
            {
              scenario,
              webContext: webContext || undefined,
              userProfile: mergedUserProfile,
              sessionHints:
                effectiveSessionContext && Object.keys(effectiveSessionContext).length > 0
                  ? JSON.stringify(effectiveSessionContext).slice(0, 2400)
                  : undefined,
              ...(taskScheduleId ? { taskScheduleId } : {}),
            },
            {
              onProgress: (progress: AgentProgressEvent) => {
                send('progress', progress);
              },
            }
          );
          markStep('agent_generate_recommendations', agentStart);
          sendStep('agent_generate_recommendations', 'complete');

          if (!agentResult.items?.length) {
            const emptyExplanation =
              agentResult.explanation || '未生成推荐项。请检查联网检索与 LLM 配置，或稍后重试。';
            await recordRecommendationAssistantTurn(recCm, sessionKey, {
              itemCount: 0,
              explanation: emptyExplanation,
            });
            send('final', {
              success: true,
              data: {
                items: [],
                recommendations: {
                  items: [],
                  strategy: agentResult.strategy || '无匹配结果',
                  metadata: {
                    totalCandidates: 0,
                    selectedCount: 0,
                    diversityScore: 0,
                    noveltyScore: 0,
                    confidence: 0,
                    ...agentResult.metadata,
                  },
                },
                explanation: emptyExplanation,
                metadata: {
                  ...agentResult.metadata,
                },
              },
            });
            controller.close();
            return;
          }

          const responseData = mapAgentResultToResponseData(agentResult, {
            requestStart,
            stepTimings,
            cacheHit: false,
          });
          if (mergedUserProfile?.userId) {
            try {
              await memoryManager.recordRecommendationImpression({
                userId: mergedUserProfile.userId,
                returnedItemCount: responseData.items.length,
              });
            } catch (error) {
              console.error('[Recommendation SSE] 推荐展示统计写入失败（不影响推荐结果）:', error);
            }
          }
          await recordRecommendationAssistantTurn(recCm, sessionKey, {
            itemCount: responseData.items.length,
            explanation: agentResult.explanation || '',
          });
          setCachedRecommendation(cacheKey, responseData);
          const persistStart = Date.now();
          try {
            await persistRecommendationCase({
              query,
              scenario,
              explanation: agentResult.explanation,
              confidence: agentResult.metadata?.confidence ?? 0.7,
              responseData,
              source: 'fresh',
            });
          } catch (e) {
            console.warn('[Recommendation SSE] analysis case persistence skipped:', e);
          } finally {
            markStep('persist_recommendation_case', persistStart);
          }
          stepTimings.total = Date.now() - requestStart;
          responseData.metadata.routeTimings = stepTimings;
          responseData.metadata.routeTotalMs = stepTimings.total;

          send('final', { success: true, data: responseData });
          controller.close();
        } catch (error) {
          send('error', {
            message: error instanceof Error ? error.message : 'stream_failed',
          });
          controller.close();
        }
      };

      run();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
