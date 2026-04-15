/**
 * 可解释推荐对话：将会话与 ContextManager（摘要压缩）接到推荐 API。
 * 与通用 ContextManager 单例分离，避免推荐链路意外带上会话级 PPO 扩展。
 */

import type { LLMClient } from 'coze-coding-dev-sdk';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import { getRecommendationChatMemoryTokenBudgetSync } from '@/lib/llm/recommendation-chat-budget';
import { ContextManager } from './context-manager';

let recommendationContextManager: ContextManager | null = null;

export function getRecommendationContextManager(): ContextManager {
  if (!recommendationContextManager) {
    const llm: LLMClient = createLLMClient({}) as unknown as LLMClient;
    const tokenBudget = getRecommendationChatMemoryTokenBudgetSync();
    recommendationContextManager = new ContextManager(
      {
        enablePPOMemory: false,
        enableLongTermMemory: true,
        enablePersistence: true,
        persistenceType: 'supabase',
        maxRecentMessages: 10,
        maxContextTokens: tokenBudget,
        /** 估算 token ≥ tokenBudget×0.88 时才触发摘要压缩 */
        compressAtTokenRatio: 0.88,
      },
      llm
    );
  }
  return recommendationContextManager;
}

/**
 * 加载或创建与前端 sessionId 对齐的会话（userId 与 sessionId 在 OpenXRec 中常相同）。
 */
export async function ensureRecommendationChatSession(
  cm: ContextManager,
  params: { userId: string; sessionId: string; scenario?: string }
): Promise<void> {
  const existing = await cm.loadSession(params.sessionId);
  if (!existing) {
    await cm.createSession(params.userId, params.scenario, params.sessionId);
  }
}

/** 写入助手侧内容，供下一轮压缩摘要使用 */
export function buildAssistantTurnDigest(payload: {
  explanation?: string;
  itemCount?: number;
  needsClarification?: boolean;
}): string {
  const n = payload.itemCount ?? 0;
  const head = payload.needsClarification
    ? '【系统】需要用户补充信息后才能继续推荐。'
    : n > 0
      ? `【推荐结果】共 ${n} 条。`
      : '【推荐结果】未返回条目。';
  const ex = (payload.explanation || '').trim().slice(0, 3500);
  return ex ? `${head}\n${ex}` : head;
}
