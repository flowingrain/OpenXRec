/**
 * 管理员能力积累库 API
 *
 * 仅管理员可访问：
 * - 反馈事件库（user_feedbacks）
 * - 策略学习库（ppo_hyperparam_versions + ppo_training_history）
 * - 知识候选库（knowledge_patterns）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/auth-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

type FeedbackEventItem = {
  id: string;
  feedbackType: string;
  comment: string | null;
  caseId: string | null;
  userId: string | null;
  createdAt: string;
};

type StrategyLearningItem = {
  versionId: string;
  version: number;
  source: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  avgReward: number | null;
};

type KnowledgeCandidateItem = {
  id: string;
  name: string;
  patternType: string;
  confidence: number | null;
  isVerified: boolean;
  createdAt: string;
  source: string | null;
};

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if ('error' in authResult) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error === '未登录' ? 401 : 403 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: '数据库连接失败' },
      { status: 500 }
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 5), 100);
  const windowDaysRaw = (searchParams.get('windowDays') || 'all').trim();
  const windowDays = windowDaysRaw === '7' || windowDaysRaw === '30' ? Number(windowDaysRaw) : null;
  const windowStartIso = windowDays
    ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  try {
    let feedbackQuery = supabase
      .from('user_feedbacks')
      .select('id, feedback_type, comment, case_id, user_context, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    let feedbackCountQuery = supabase
      .from('user_feedbacks')
      .select('id', { count: 'exact', head: true });
    let versionQuery = supabase
      .from('ppo_hyperparam_versions')
      .select('id, version, source, is_active, is_verified, performance, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    let versionCountQuery = supabase
      .from('ppo_hyperparam_versions')
      .select('id', { count: 'exact', head: true });
    let historyCountQuery = supabase
      .from('ppo_training_history')
      .select('id', { count: 'exact', head: true });
    let candidateQuery = supabase
      .from('knowledge_patterns')
      .select('id, name, pattern_type, confidence, is_verified, pattern_data, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    let candidateCountQuery = supabase
      .from('knowledge_patterns')
      .select('id', { count: 'exact', head: true });

    if (windowStartIso) {
      feedbackQuery = feedbackQuery.gte('created_at', windowStartIso);
      feedbackCountQuery = feedbackCountQuery.gte('created_at', windowStartIso);
      versionQuery = versionQuery.gte('created_at', windowStartIso);
      versionCountQuery = versionCountQuery.gte('created_at', windowStartIso);
      historyCountQuery = historyCountQuery.gte('created_at', windowStartIso);
      candidateQuery = candidateQuery.gte('created_at', windowStartIso);
      candidateCountQuery = candidateCountQuery.gte('created_at', windowStartIso);
    }

    const [
      feedbackResult,
      feedbackCountResult,
      versionResult,
      versionCountResult,
      historyResult,
      candidateResult,
      candidateCountResult,
    ] = await Promise.all([
      feedbackQuery,
      feedbackCountQuery,
      versionQuery,
      versionCountQuery,
      historyCountQuery,
      candidateQuery,
      candidateCountQuery,
    ]);

    const feedbackEvents: FeedbackEventItem[] = (feedbackResult.data || []).map((item: any) => ({
      id: String(item.id),
      feedbackType: String(item.feedback_type || 'unknown'),
      comment: item.comment ? String(item.comment) : null,
      caseId: item.case_id ? String(item.case_id) : null,
      userId:
        item.user_context && typeof item.user_context === 'object' && item.user_context.userId
          ? String(item.user_context.userId)
          : null,
      createdAt: String(item.created_at),
    }));

    const strategyLibrary: StrategyLearningItem[] = (versionResult.data || []).map((item: any) => ({
      versionId: String(item.id),
      version: Number(item.version || 0),
      source: item.source ? String(item.source) : null,
      isActive: Boolean(item.is_active),
      isVerified: Boolean(item.is_verified),
      createdAt: String(item.created_at),
      avgReward:
        item.performance && typeof item.performance === 'object' && typeof item.performance.avgReward === 'number'
          ? item.performance.avgReward
          : null,
    }));

    const knowledgeCandidates: KnowledgeCandidateItem[] = (candidateResult.data || []).map((item: any) => ({
      id: String(item.id),
      name: String(item.name || ''),
      patternType: String(item.pattern_type || 'unknown'),
      confidence: item.confidence !== null && item.confidence !== undefined ? Number(item.confidence) : null,
      isVerified: Boolean(item.is_verified),
      createdAt: String(item.created_at),
      source:
        item.pattern_data && typeof item.pattern_data === 'object' && item.pattern_data.source
          ? String(item.pattern_data.source)
          : null,
    }));

    const trainingHistoryCount = historyResult.count || 0;
    const strategyVersionCount = versionCountResult.count || 0;
    const strategyLearningCount = strategyVersionCount + trainingHistoryCount;

    return NextResponse.json({
      success: true,
      data: {
        feedbackEvents,
        strategyLibrary,
        knowledgeCandidates,
        stats: {
          feedbackEvents: feedbackCountResult.count || 0,
          strategyLearning: strategyLearningCount,
          strategyVersions: strategyVersionCount,
          strategyTrainingHistory: trainingHistoryCount,
          knowledgeCandidates: candidateCountResult.count || 0,
        },
        windowDays: windowDaysRaw === '7' || windowDaysRaw === '30' ? windowDaysRaw : 'all',
      },
    });
  } catch (error) {
    console.error('[CapabilityLibraries API] Error:', error);
    return NextResponse.json(
      { success: false, error: '加载能力积累库失败' },
      { status: 500 }
    );
  }
}
