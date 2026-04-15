import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { createSufficiencyEvaluator } from '@/lib/recommendation/recommendation-types';
import { getRecommendDisplayMax } from '@/lib/recommendation/batch-llm-explanations';
import {
  getAgentRecommendationService,
  type AgentRecommendationResult,
} from '@/lib/recommendation/agent-recommendation-service';
import type { UserProfile } from '@/lib/recommendation/types';
import { advancedWebSearch, getWebSearchProvider } from '@/lib/search/advanced-web-search';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import type { LLMClient } from 'coze-coding-dev-sdk';
import { embeddingService } from '@/lib/embedding/service';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createHash } from 'crypto';
import type { ContextManager } from '@/lib/recommendation/context-manager';
import {
  getRecommendationContextManager,
  ensureRecommendationChatSession,
  buildAssistantTurnDigest,
} from '@/lib/recommendation/recommendation-context-bridge';

/**
 * 推荐 API：信息充足度评估 + AgentRecommendationService 多智能体推荐
 * LLM 与主链路一致：配置了 DEEPSEEK_API_KEY 时走 DeepSeek，否则走 Coze SDK。
 */

let llmClientInstance: LLMClient | null = null;
const recommendationCache = new Map<string, { expiresAt: number; data: any }>();
const RECOMMENDATION_TTL_MS = 5 * 60 * 1000;
function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    llmClientInstance = createLLMClient({});
  }
  return llmClientInstance;
}

function extractQueryFromBody(body: Record<string, unknown>): string {
  const candidates = [
    body.query,
    (body.context as Record<string, unknown> | undefined)?.query,
    body.message,
    body.prompt,
    body.text,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function buildCacheKey(query: string, scenario?: string, userId?: string): string {
  const normalized = `${query.trim().toLowerCase()}|${(scenario || '').trim().toLowerCase()}|${(userId || '').trim().toLowerCase()}`;
  return createHash('sha256').update(normalized).digest('hex');
}

function getCachedRecommendation(key: string): any | null {
  const hit = recommendationCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    recommendationCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCachedRecommendation(key: string, data: any): void {
  recommendationCache.set(key, {
    expiresAt: Date.now() + RECOMMENDATION_TTL_MS,
    data,
  });
}

async function persistRecommendationCase(params: {
  query: string;
  scenario?: string;
  explanation?: string;
  confidence?: number;
  responseData: any;
  source: 'fresh' | 'ttl_cache' | 'vector_reuse';
  reusedCaseId?: string;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('analysis_cases').insert({
    query: params.query,
    domain: params.scenario || 'general',
    conclusion: params.explanation || 'recommendation_result',
    confidence: Number((params.confidence ?? 0.7).toFixed(2)),
    agent_outputs: {
      source: 'recommendation_api',
      recommendationResponse: params.responseData,
      generationSource: params.source,
      reusedCaseId: params.reusedCaseId || null,
    },
    status: 'completed',
  });
  if (error) {
    throw new Error(`[analysis_cases insert failed] ${error.message}`);
  }
}

async function recordRecommendationAssistantTurn(
  recCm: ContextManager | null,
  sessionKey: string,
  payload: Parameters<typeof buildAssistantTurnDigest>[0]
): Promise<void> {
  if (!recCm || !sessionKey) return;
  try {
    await recCm.addAssistantMessage(sessionKey, buildAssistantTurnDigest(payload));
  } catch (e) {
    console.warn('[Recommendation API] context assistant message skipped:', e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestStart = Date.now();
    const stepTimings: Record<string, number> = {};
    const markStep = (name: string, start: number) => {
      stepTimings[name] = Date.now() - start;
    };

    const parseStart = Date.now();
    const body = await request.json();
    markStep('parse_request', parseStart);

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

    const query = extractQueryFromBody(body);

    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少查询内容（需要 query、context.query、message 等任一字段）' },
        { status: 400 }
      );
    }

    const sessionContext = {
      ...(typeof bodySessionContext === 'object' && bodySessionContext ? bodySessionContext : {}),
      ...(typeof context === 'object' && context ? context : {}),
      ...(typeof userId === 'string' ? { userId } : {}),
    };
    const scenario =
      typeof sessionContext === 'object' && sessionContext && 'scenario' in sessionContext
        ? String((sessionContext as Record<string, unknown>).scenario)
        : undefined;

    const taskScheduleIdFromContext =
      typeof sessionContext === 'object' &&
      sessionContext &&
      'taskScheduleId' in sessionContext &&
      typeof (sessionContext as Record<string, unknown>).taskScheduleId === 'string'
        ? String((sessionContext as Record<string, unknown>).taskScheduleId).trim()
        : undefined;
    const taskScheduleId =
      (typeof bodyTaskScheduleId === 'string' ? bodyTaskScheduleId.trim() : undefined) ||
      taskScheduleIdFromContext;
    const cacheKey = buildCacheKey(query, scenario, typeof userId === 'string' ? userId : undefined);

    const sessionKey =
      typeof bodySessionId === 'string' && bodySessionId.trim()
        ? bodySessionId.trim()
        : typeof userId === 'string'
          ? userId.trim()
          : '';

    let recCm: ContextManager | null = null;
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

    console.log('[Recommendation API] Processing query:', query);

    // 热路径优化：TTL 命中时直接返回，避免后续 sufficiency / web_search / agent 耗时。
    // 同一会话多轮对话时禁用 TTL，避免忽略已压缩的推荐对话历史。
    const ttlCacheStart = Date.now();
    if (!forceRefresh && !skipTtlForChatSession) {
      markStep('ttl_cache_lookup', ttlCacheStart);
      const cached = getCachedRecommendation(cacheKey);
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
          console.warn('[Recommendation API] ttl cache case persistence skipped:', e);
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
            console.warn('[Recommendation API] ttl cache chat turn skipped:', e);
          }
        }
        console.log('[Recommendation API] Step timings (ms):', stepTimings);
        return NextResponse.json({
          success: true,
          data: cachedResponseData,
        });
      }
    } else {
      markStep('ttl_cache_lookup', ttlCacheStart);
    }

    const memoryManager = getSupabaseRecommendationMemoryManager();

    let mergedUserProfile: UserProfile | undefined;
    if (typeof userId === 'string' && userId.trim()) {
      try {
        mergedUserProfile = await memoryManager.getUserProfile(userId.trim());
      } catch (e) {
        console.warn('[Recommendation API] getUserProfile:', e);
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
        demographics:
          (b.demographics as UserProfile['demographics']) ?? mergedUserProfile?.demographics,
      };
    } else if (!mergedUserProfile && typeof userId === 'string' && userId) {
      mergedUserProfile = {
        userId,
        interests: [],
        preferences: {},
        behaviorHistory: [],
      };
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
        console.warn('[Recommendation API] recommendation chat context merge skipped:', e);
      }
    }

    if (!skipSufficiencyCheck) {
      console.log('[Recommendation API] Starting sufficiency evaluation...');
      const suffStart = Date.now();
      try {
        const llmClient = getLLMClient();
        const evaluator = createSufficiencyEvaluator(llmClient);
        const sufficiency = await evaluator.evaluate(query, effectiveSessionContext);
        markStep('sufficiency_evaluation', suffStart);

        if (
          !sufficiency.isSufficient &&
          sufficiency.suggestedQuestions &&
          sufficiency.suggestedQuestions.length > 0
        ) {
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
          return NextResponse.json({
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
        }
      } catch (error: unknown) {
        markStep('sufficiency_evaluation', suffStart);
        console.error('[Recommendation API] Sufficiency evaluation failed:', error);
      }
    }

    const displayMax = getRecommendDisplayMax();
    const agentService = getAgentRecommendationService(getLLMClient(), {
      maxReturnItems: displayMax,
    });

    let webContext = '';
    const webSearchStart = Date.now();
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
            `${item.title || ''}\n${item.snippet || (typeof item.content === 'string' ? item.content.slice(0, 220) : '')}`
        )
        .join('\n\n')
        .slice(0, 8000);
      console.log('[Recommendation API] 联网检索摘要:', {
        provider: getWebSearchProvider(),
        webItemCount: raw.length,
        contextCharLength: webContext.length,
      });
    } catch (e) {
      console.warn('[Recommendation API] Web context fetch skipped:', e);
    } finally {
      markStep('web_search', webSearchStart);
    }

    const vectorReuseStart = Date.now();
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
              console.warn('[Recommendation API] vector reuse case persistence skipped:', e);
            }
            await recordRecommendationAssistantTurn(recCm, sessionKey, {
              explanation:
                typeof reusedResponseData.explanation === 'string' ? reusedResponseData.explanation : '',
              itemCount: Array.isArray(reusedResponseData.items) ? reusedResponseData.items.length : 0,
            });
            return NextResponse.json({
              success: true,
              data: reusedResponseData,
            });
          }
        }
      } catch (e) {
        console.warn('[Recommendation API] vector reuse skipped:', e);
      } finally {
        markStep('vector_reuse_lookup', vectorReuseStart);
      }
    } else {
      markStep('vector_reuse_lookup', vectorReuseStart);
    }

    let agentResult: AgentRecommendationResult;
    const agentStart = Date.now();
    try {
      const sessionHints =
        effectiveSessionContext && Object.keys(effectiveSessionContext).length > 0
          ? JSON.stringify(effectiveSessionContext).slice(0, 2400)
          : undefined;

      agentResult = await agentService.generateRecommendations(query, {
        scenario,
        webContext: webContext || undefined,
        userProfile: mergedUserProfile,
        sessionHints,
        ...(taskScheduleId ? { taskScheduleId } : {}),
      });
      markStep('agent_generate_recommendations', agentStart);
    } catch (recErr: unknown) {
      markStep('agent_generate_recommendations', agentStart);
      console.error('[Recommendation API] Agent recommendation failed:', recErr);
      await recordRecommendationAssistantTurn(recCm, sessionKey, {
        itemCount: 0,
        explanation:
          '推荐服务暂时不可用。请配置 DEEPSEEK_API_KEY（或可用的 Coze LLM）与联网检索（WEB_SEARCH_PROVIDER / TAVILY_API_KEY 等）后重试。',
      });
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          recommendations: {
            items: [],
            strategy: 'unavailable',
            metadata: {
              totalCandidates: 0,
              selectedCount: 0,
              diversityScore: 0,
              noveltyScore: 0,
              confidence: 0,
            },
          },
          explanation:
            '推荐服务暂时不可用。请配置 DEEPSEEK_API_KEY（或可用的 Coze LLM）与联网检索（WEB_SEARCH_PROVIDER / TAVILY_API_KEY 等）后重试。',
          metadata: {},
        },
      });
    }

    if (!agentResult.items?.length) {
      const emptyExplanation =
        agentResult.explanation || '未生成推荐项。请检查联网检索与 LLM 配置，或稍后重试。';
      await recordRecommendationAssistantTurn(recCm, sessionKey, {
        itemCount: 0,
        explanation: emptyExplanation,
      });
      return NextResponse.json({
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
    }

    const mapResponseStart = Date.now();
    const items = agentResult.items.map((it) => {
      const ex0 = it.explanations?.[0];
      const diff =
        ex0 && 'differentiator' in ex0 && typeof ex0.differentiator === 'string' && ex0.differentiator.trim()
          ? ` ｜对比：${ex0.differentiator.trim()}`
          : '';
      const explanationLine = `${ex0?.reason || ''}${diff}`.trim();
      return {
      id: it.id,
      title: it.title,
      type: (it.metadata as { type?: string } | undefined)?.type || 'general',
      description: it.description,
      score: it.score,
      confidence: it.confidence,
      explanation: explanationLine,
      explanations: it.explanations,
      source: it.source,
      sourceUrl: it.sourceUrl,
      metadata: it.metadata,
    };
    });

    const recommendations = {
      items,
      strategy: agentResult.strategy,
      metadata: {
        totalCandidates: items.length,
        selectedCount: items.length,
        diversityScore: calculateDiversityScore(items),
        noveltyScore: calculateNoveltyScore(items),
        confidence: agentResult.metadata.confidence,
        ...agentResult.metadata,
      },
    };

    if (mergedUserProfile?.userId) {
      try {
        await memoryManager.recordRecommendationImpression({
          userId: mergedUserProfile.userId,
          returnedItemCount: items.length,
        });
      } catch (error) {
        console.error('[Recommendation API] 推荐展示统计写入失败（不影响推荐结果）:', error);
      }
    }

    await recordRecommendationAssistantTurn(recCm, sessionKey, {
      itemCount: items.length,
      explanation: agentResult.explanation || '',
    });

    const responseData = {
      items,
      recommendations,
      explanation: agentResult.explanation,
      overallExplanation: agentResult.explanation,
      metadata: {
        ...agentResult.metadata,
        queryType: agentResult.metadata.queryType,
        cacheHit: false,
        routeTimings: stepTimings,
        routeTotalMs: Date.now() - requestStart,
      },
    };
    markStep('build_response_payload', mapResponseStart);

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
      console.warn('[Recommendation API] analysis case persistence skipped:', e);
    } finally {
      markStep('persist_recommendation_case', persistStart);
    }

    stepTimings.total = Date.now() - requestStart;
    responseData.metadata.routeTimings = stepTimings;
    responseData.metadata.routeTotalMs = stepTimings.total;
    console.log('[Recommendation API] Step timings (ms):', stepTimings);

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: unknown) {
    console.error('[Recommendation API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '推荐失败' },
      { status: 500 }
    );
  }
}

function calculateDiversityScore(recommendations: { type?: string }[]): number {
  const types = new Set(recommendations.map((r) => r.type));
  return Math.min(types.size / 3, 1.0);
}

function calculateNoveltyScore(recommendations: { score: number }[]): number {
  if (recommendations.length === 0) return 0;
  const avgScore = recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length;
  return 1 - avgScore;
}

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Recommendation API is running',
    endpoints: {
      POST: 'Generate recommendations',
      GET: 'API status check',
    },
  });
}
