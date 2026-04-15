import { createHash } from 'crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { ContextManager } from '@/lib/recommendation/context-manager';
import { buildAssistantTurnDigest } from '@/lib/recommendation/recommendation-context-bridge';
import type { AgentRecommendationResult } from '@/lib/recommendation/agent-recommendation-service';

const recommendationCache = new Map<string, { expiresAt: number; data: any }>();
export const RECOMMENDATION_TTL_MS = 5 * 60 * 1000;

export function extractQueryFromBody(body: Record<string, unknown>): string {
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

export function buildCacheKey(query: string, scenario?: string, userId?: string): string {
  const normalized = `${query.trim().toLowerCase()}|${(scenario || '').trim().toLowerCase()}|${(userId || '').trim().toLowerCase()}`;
  return createHash('sha256').update(normalized).digest('hex');
}

export function getCachedRecommendation(key: string): any | null {
  const hit = recommendationCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    recommendationCache.delete(key);
    return null;
  }
  return hit.data;
}

export function setCachedRecommendation(key: string, data: any): void {
  recommendationCache.set(key, {
    expiresAt: Date.now() + RECOMMENDATION_TTL_MS,
    data,
  });
}

export async function persistRecommendationCase(params: {
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

export async function recordRecommendationAssistantTurn(
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

function calculateDiversityScore(recommendations: { type?: string }[]): number {
  const types = new Set(recommendations.map((r) => r.type));
  return Math.min(types.size / 3, 1.0);
}

function calculateNoveltyScore(recommendations: { score: number }[]): number {
  if (recommendations.length === 0) return 0;
  const avgScore = recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length;
  return 1 - avgScore;
}

export function mapAgentResultToResponseData(
  agentResult: AgentRecommendationResult,
  routeMeta: {
    requestStart: number;
    stepTimings: Record<string, number>;
    cacheHit?: boolean;
  }
) {
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

  return {
    items,
    recommendations: {
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
    },
    explanation: agentResult.explanation,
    overallExplanation: agentResult.explanation,
    metadata: {
      ...agentResult.metadata,
      queryType: agentResult.metadata.queryType,
      cacheHit: Boolean(routeMeta.cacheHit),
      routeTimings: routeMeta.stepTimings,
      routeTotalMs: Date.now() - routeMeta.requestStart,
    },
  };
}
