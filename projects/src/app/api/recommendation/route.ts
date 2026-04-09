import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { createSufficiencyEvaluator } from '@/lib/recommendation/recommendation-types';
import { getRecommendDisplayMax } from '@/lib/recommendation/batch-llm-explanations';
import {
  getAgentRecommendationService,
  type AgentRecommendationResult,
} from '@/lib/recommendation/agent-recommendation-service';
import { advancedWebSearch, getWebSearchProvider } from '@/lib/search/advanced-web-search';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import type { LLMClient } from 'coze-coding-dev-sdk';

/**
 * 推荐 API：信息充足度评估 + AgentRecommendationService 多智能体推荐
 * LLM 与主链路一致：配置了 DEEPSEEK_API_KEY 时走 DeepSeek，否则走 Coze SDK。
 */

let llmClientInstance: LLMClient | null = null;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userProfile: bodyUserProfile,
      context,
      sessionContext: bodySessionContext,
      skipSufficiencyCheck,
      userId,
    } = body;

    const query = extractQueryFromBody(body);

    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少查询内容（需要 query、context.query、message 等任一字段）' },
        { status: 400 }
      );
    }

    const userProfile =
      bodyUserProfile ?? (typeof userId === 'string' && userId ? { userId } : undefined);
    const sessionContext = {
      ...(typeof bodySessionContext === 'object' && bodySessionContext ? bodySessionContext : {}),
      ...(typeof context === 'object' && context ? context : {}),
      ...(typeof userId === 'string' ? { userId } : {}),
    };

    console.log('[Recommendation API] Processing query:', query);

    const memoryManager = getSupabaseRecommendationMemoryManager();

    if (!skipSufficiencyCheck) {
      console.log('[Recommendation API] Starting sufficiency evaluation...');
      try {
        const llmClient = getLLMClient();
        const evaluator = createSufficiencyEvaluator(llmClient);
        const sufficiency = await evaluator.evaluate(query, sessionContext);

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
        console.error('[Recommendation API] Sufficiency evaluation failed:', error);
      }
    }

    const displayMax = getRecommendDisplayMax();
    const agentService = getAgentRecommendationService(getLLMClient(), {
      maxReturnItems: displayMax,
    });

    let webContext = '';
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
    }

    const scenario =
      typeof sessionContext === 'object' && sessionContext && 'scenario' in sessionContext
        ? String((sessionContext as Record<string, unknown>).scenario)
        : undefined;

    let agentResult: AgentRecommendationResult;
    try {
      agentResult = await agentService.generateRecommendations(query, {
        scenario,
        webContext: webContext || undefined,
      });
    } catch (recErr: unknown) {
      console.error('[Recommendation API] Agent recommendation failed:', recErr);
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
          explanation:
            agentResult.explanation ||
            '未生成推荐项。请检查联网检索与 LLM 配置，或稍后重试。',
          metadata: agentResult.metadata,
        },
      });
    }

    const items = agentResult.items.map((it) => ({
      id: it.id,
      title: it.title,
      type: (it.metadata as { type?: string } | undefined)?.type || 'general',
      description: it.description,
      score: it.score,
      confidence: it.confidence,
      explanation: it.explanations?.[0]?.reason || '',
      explanations: it.explanations,
      source: it.source,
      sourceUrl: it.sourceUrl,
      metadata: it.metadata,
    }));

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

    if (userProfile?.userId) {
      try {
        await memoryManager.recordRecommendationImpression({
          userId: userProfile.userId,
          returnedItemCount: items.length,
        });
      } catch (error) {
        console.error('[Recommendation API] 推荐展示统计写入失败（不影响推荐结果）:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        recommendations,
        explanation: agentResult.explanation,
        overallExplanation: agentResult.explanation,
        metadata: {
          ...agentResult.metadata,
          queryType: agentResult.metadata.queryType,
        },
      },
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
