/**
 * 统一反馈桥接
 *
 * 产品语义：聊天中的反馈与推荐场景的反馈不是两条割裂的「业务线」，而是同一用户行为在
 * 「对话理解 / 案例沉淀」与「排序·策略·规则·校准（经 PPO/自适应等）」上的不同落点。
 * 本模块提供意图路由 + 推荐侧闭环的可复用实现，供 /api/recommendation/feedback 与
 * /api/chat-feedback 共用。
 */

import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getPPOPolicyService, type RecommendationSession } from '@/lib/recommendation/ppo-integration';
import type { RecommendationState, PPOAction, UserFeedbackSignal } from '@/lib/recommendation/ppo/types';

/** 与 recommendation/feedback 路由一致 */
export type OpinionFeedbackIntent =
  | 'correction'
  | 'approve'
  | 'reject'
  | 'request_explanation'
  | 'other';

export type UnifiedFeedbackChannels = {
  /** 应写入案例/分析类反馈（user_feedbacks 等） */
  caseAnalysis: boolean;
  /** 应驱动推荐记忆 + PPO/自适应链路 */
  recommendation: boolean;
};

export type UnifiedFeedbackRouting = {
  intent: OpinionFeedbackIntent;
  channels: UnifiedFeedbackChannels;
  /** 若可映射为显式点赞踩，供推荐闭环使用 */
  recommendationPolarity: 'like' | 'dislike' | null;
};

export function classifyOpinionIntent(text: string): OpinionFeedbackIntent {
  const t = text.trim().toLowerCase();
  if (!t) return 'other';
  if (/(不对|有误|错误|修正|改成|应为|应该是|纠正|不准确|有偏差)/.test(t)) return 'correction';
  if (/(为什么|请解释|解释一下|说明一下|依据|证据|怎么得出)/.test(t)) return 'request_explanation';
  if (/(同意|认可|没问题|正确|有帮助|赞同|靠谱|满意)/.test(t)) return 'approve';
  if (/(不同意|反对|不认可|不相关|没帮助|离题|不满意|差评)/.test(t)) return 'reject';
  return 'other';
}

/**
 * 从自然语言推断：本次反馈主要应作用于案例沉淀还是推荐系统（可同时为 true）。
 */
export function routeUnifiedFeedbackIntent(
  message: string,
  opts?: {
    /** 是否处于「推荐会话」场景（前端可显式传入） */
    hasRecommendationContext?: boolean;
  }
): UnifiedFeedbackRouting {
  const intent = classifyOpinionIntent(message);
  const t = message.trim();

  const mentionsRecommendation =
    /(推荐|排序|结果|这几条|这条|第一名|备选|不太准|很准)/.test(t) || opts?.hasRecommendationContext;

  const channels: UnifiedFeedbackChannels = {
    caseAnalysis:
      intent === 'correction' ||
      intent === 'request_explanation' ||
      /(分析|报告|结论|案例|研判)/.test(t),
    recommendation:
      !!mentionsRecommendation ||
      intent === 'approve' ||
      intent === 'reject' ||
      intent === 'correction',
  };

  let recommendationPolarity: 'like' | 'dislike' | null = null;
  if (intent === 'approve') recommendationPolarity = 'like';
  else if (intent === 'reject') recommendationPolarity = 'dislike';

  return { intent, channels, recommendationPolarity };
}

function buildDefaultPPOState(userId: string): RecommendationState {
  return {
    userId,
    userFeatures: {
      activeLevel: 0.5,
      diversityPreference: 0.5,
      avgSessionLength: 0.5,
      clickThroughRate: 0.2,
      conversionRate: 0.1,
    },
    scenarioFeatures: {
      scenarioType: 'general',
      itemPoolSize: 0.5,
      timeOfDay: 0.5,
      dayOfWeek: 0.5,
    },
    historyStats: {
      recentCtr: 0.2,
      recentSatisfaction: 0.5,
      strategyPerformance: {
        content_based: 0.5,
        collaborative: 0.5,
        knowledge_based: 0.5,
        agent_based: 0.5,
        causal_based: 0.5,
      },
    },
    currentConfig: {
      strategyWeights: {
        content_based: 0.25,
        collaborative: 0.2,
        knowledge_based: 0.2,
        agent_based: 0.2,
        causal_based: 0.15,
      },
      diversityWeight: 0.5,
      noveltyWeight: 0.5,
      serendipityWeight: 0.5,
      minScoreThreshold: 0.3,
    },
  };
}

function buildDefaultPPOAction(state: RecommendationState): PPOAction {
  return {
    strategyWeights: state.currentConfig.strategyWeights,
    diversityWeight: state.currentConfig.diversityWeight,
    noveltyWeight: state.currentConfig.noveltyWeight,
    serendipityWeight: state.currentConfig.serendipityWeight,
    minScoreThreshold: state.currentConfig.minScoreThreshold,
  };
}

export type RecommendationFeedbackPipelineInput = {
  userId: string;
  itemId: string;
  /** 最终映射为 like / dislike / neutral */
  mappedFeedbackType: 'like' | 'dislike' | 'neutral';
  intent: OpinionFeedbackIntent;
  opinionText?: string;
  position?: number;
  strategy?: string;
  explanationType?: string;
  correction?: { content?: string; target?: string; reason?: string } | null;
};

export type RecommendationFeedbackPipelineResult = {
  ppoAccepted: boolean;
  correctionCandidateId: string | null;
};

/**
 * 推荐显式反馈的共享实现：会话记忆 + PPO 闭环 + 可选修正候选入库。
 */
export async function runRecommendationFeedbackPipeline(
  input: RecommendationFeedbackPipelineInput
): Promise<RecommendationFeedbackPipelineResult> {
  const {
    userId,
    itemId,
    mappedFeedbackType,
    intent,
    opinionText = '',
    position = 0,
    strategy = 'unified_feedback_bridge',
    explanationType = 'evidence_chain',
    correction = null,
  } = input;

  const memory = getSupabaseRecommendationMemoryManager();
  await memory.recordUserFeedback({
    userId,
    itemId,
    feedbackType: mappedFeedbackType,
    comment: opinionText || undefined,
    context: {
      source: 'unified_feedback_bridge',
      intent,
    },
  });

  let ppoAccepted = false;
  if (mappedFeedbackType === 'like' || mappedFeedbackType === 'dislike') {
    try {
      const ppoService = getPPOPolicyService();
      const ppoSessionId = `rec_fb_${userId}_${itemId}`;
      const now = Date.now();
      const state = buildDefaultPPOState(userId);
      const action = buildDefaultPPOAction(state);
      const session: RecommendationSession = {
        sessionId: ppoSessionId,
        userId,
        timestamp: now,
        state,
        action,
        feedbacks: [],
        done: false,
      };
      ppoService.recordSession(session);

      const signal: UserFeedbackSignal = {
        type: mappedFeedbackType === 'like' ? 'like' : 'dislike',
        value: mappedFeedbackType === 'like' ? 1 : -1,
        itemId,
        timestamp: now,
        context: {
          position,
          strategy,
          explanationType,
        },
      };
      ppoService.recordFeedback(ppoSessionId, signal);
      ppoAccepted = true;
    } catch (e) {
      console.warn('[unified-feedback-bridge] PPO hook failed:', e);
    }
  }

  let correctionCandidateId: string | null = null;
  if (intent === 'correction' || correction) {
    const content =
      (typeof correction?.content === 'string' && correction.content.trim()) ||
      opinionText ||
      '用户提交修正意见';
    const target = typeof correction?.target === 'string' ? correction.target.trim() : '';
    const reason = typeof correction?.reason === 'string' ? correction.reason.trim() : '';
    const supabase = getSupabaseClient();
    const candidateId = `kp_feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await supabase.from('knowledge_patterns').insert({
      id: candidateId,
      pattern_type: 'knowledge_feedback_correction',
      name: `反馈修正候选: ${itemId}`,
      description: `来自用户反馈的知识修正候选，需管理员审核后应用`,
      pattern_data: {
        source: 'unified_feedback_bridge',
        userId,
        itemId,
        intent,
        correction: { content, target, reason },
        opinionText,
        createdAt: new Date().toISOString(),
      },
      occurrence_count: 1,
      confidence: 0.75,
      is_verified: false,
    });
    if (!error) correctionCandidateId = candidateId;
  }

  return { ppoAccepted, correctionCandidateId };
}
