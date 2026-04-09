import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getPPOPolicyService, type RecommendationSession } from '@/lib/recommendation/ppo-integration';
import type { RecommendationState, PPOAction, UserFeedbackSignal } from '@/lib/recommendation/ppo/types';

/**
 * 推荐结果显式反馈（点赞 / 点踩），与「分析聊天」用的 /api/chat-feedback 分离。
 */
type FeedbackIntent = 'correction' | 'approve' | 'reject' | 'request_explanation' | 'other';

function classifyOpinionIntent(text: string): FeedbackIntent {
  const t = text.trim().toLowerCase();
  if (!t) return 'other';
  if (/(不对|有误|错误|修正|改成|应为|应该是|纠正|不准确|有偏差)/.test(t)) return 'correction';
  if (/(为什么|请解释|解释一下|说明一下|依据|证据|怎么得出)/.test(t)) return 'request_explanation';
  if (/(同意|认可|没问题|正确|有帮助|赞同|靠谱)/.test(t)) return 'approve';
  if (/(不同意|反对|不认可|不相关|没帮助|离题|不满意)/.test(t)) return 'reject';
  return 'other';
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
    const feedbackTypeRaw = body.feedbackType;
    const opinionText = typeof body.opinionText === 'string' ? body.opinionText.trim() : '';
    const correction = body.correction && typeof body.correction === 'object' ? body.correction : null;

    const inferredIntent = classifyOpinionIntent(
      opinionText || (typeof correction?.content === 'string' ? correction.content : '')
    );
    const explicitIntent =
      typeof body.intent === 'string' &&
      ['correction', 'approve', 'reject', 'request_explanation', 'other'].includes(body.intent)
        ? (body.intent as FeedbackIntent)
        : null;
    const intent: FeedbackIntent = explicitIntent || inferredIntent;

    const mappedFeedbackType =
      feedbackTypeRaw === 'like' || feedbackTypeRaw === 'dislike'
        ? feedbackTypeRaw
        : intent === 'approve'
          ? 'like'
          : intent === 'reject'
            ? 'dislike'
            : 'neutral';

    if (!userId || !itemId) {
      return NextResponse.json(
        { success: false, error: '缺少 userId 或 itemId' },
        { status: 400 }
      );
    }

    const memory = getSupabaseRecommendationMemoryManager();
    await memory.recordUserFeedback({
      userId,
      itemId,
      feedbackType: mappedFeedbackType,
      comment: opinionText || undefined,
      context: {
        source: 'openxrec_recommendation_ui',
        intent,
      },
    });

    // 用户反馈 -> PPO 闭环（失败不影响主流程）
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
            position: Number(body.position ?? 0) || 0,
            strategy: typeof body.strategy === 'string' ? body.strategy : 'feedback_route',
            explanationType: typeof body.explanationType === 'string' ? body.explanationType : 'evidence_chain',
          },
        };
        ppoService.recordFeedback(ppoSessionId, signal);
        ppoAccepted = true;
      } catch (e) {
        console.warn('[recommendation/feedback] PPO feedback hook failed:', e);
      }
    }

    // 修正意见不直接改知识事实：先入审查池，等待管理员审核
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
          source: 'recommendation_feedback',
          userId,
          itemId,
          intent,
          correction: {
            content,
            target,
            reason,
          },
          opinionText,
          createdAt: new Date().toISOString(),
        },
        occurrence_count: 1,
        confidence: 0.75,
        is_verified: false,
      });
      if (!error) correctionCandidateId = candidateId;
    }

    return NextResponse.json({
      success: true,
      data: {
        intent,
        feedbackType: mappedFeedbackType,
        ppoAccepted,
        correctionCandidateId,
        reviewRequired: !!correctionCandidateId,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '反馈失败';
    console.error('[recommendation/feedback]', e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
