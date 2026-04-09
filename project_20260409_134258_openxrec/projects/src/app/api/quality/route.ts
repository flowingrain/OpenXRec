/**
 * 质量检测 API
 * 
 * POST /api/quality/check - 执行质量检测
 * GET /api/quality/report/:id - 获取质量报告
 * POST /api/feedback - 提交用户反馈
 * GET /api/feedback/stats - 获取反馈统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { qualityChecker, type QualityCheckConfig } from '@/lib/quality/quality-checker';
import { feedbackOptimizer, type UserFeedback } from '@/lib/quality/feedback-optimizer';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== POST 处理器 ====================

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, payload } = body;

  try {
    switch (action) {
      case 'check':
        return await handleQualityCheck(payload);
      case 'feedback':
        return await handleFeedback(payload);
      case 'update-preferences':
        return await handleUpdatePreferences(payload);
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Quality API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ==================== GET 处理器 ====================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'report':
        return await handleGetReport(searchParams);
      case 'stats':
        return await handleGetStats(searchParams);
      case 'strategy':
        return await handleGetStrategy();
      case 'preferences':
        return await handleGetPreferences(searchParams);
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Quality API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ==================== 处理函数 ====================

/**
 * 处理质量检测请求
 */
async function handleQualityCheck(payload: {
  analysisState: any;
  config?: Partial<QualityCheckConfig>;
}) {
  if (!payload?.analysisState) {
    return NextResponse.json(
      { error: 'analysisState is required' },
      { status: 400 }
    );
  }

  // 创建检测器实例
  const checker = payload.config 
    ? new (await import('@/lib/quality/quality-checker')).QualityChecker(payload.config)
    : qualityChecker;

  const report = await checker.check(payload.analysisState);

  // 存储报告到数据库
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase
      .from('quality_reports')
      .insert({
        id: report.id,
        case_id: report.caseId,
        query: report.query,
        overall_score: report.overallScore,
        grade: report.grade,
        dimension_scores: report.dimensionScores,
        issues: report.issues,
        critical_issues: report.criticalIssues,
        improvement_priority: report.improvementPriority,
        analysis_metadata: report.analysisMetadata,
        detected_at: report.detectedAt,
      });

    if (error) {
      console.error('[Quality API] 存储报告失败:', error);
    }
  }

  return NextResponse.json({
    success: true,
    report,
  });
}

/**
 * 处理获取质量报告
 */
async function handleGetReport(searchParams: URLSearchParams) {
  const reportId = searchParams.get('id');
  const caseId = searchParams.get('caseId');

  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  if (reportId) {
    const { data, error } = await supabase
      .from('quality_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report: data });
  }

  if (caseId) {
    const { data, error } = await supabase
      .from('quality_reports')
      .select('*')
      .eq('case_id', caseId)
      .order('detected_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report: data });
  }

  // 返回最近的报告列表
  const limit = parseInt(searchParams.get('limit') || '10');
  const { data, error } = await supabase
    .from('quality_reports')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }

  return NextResponse.json({ reports: data });
}

/**
 * 处理提交反馈
 */
async function handleFeedback(payload: Omit<UserFeedback, 'id' | 'createdAt'>) {
  if (!payload?.caseId) {
    return NextResponse.json(
      { error: 'caseId is required' },
      { status: 400 }
    );
  }

  const feedback = await feedbackOptimizer.submitFeedback(payload);

  return NextResponse.json({
    success: true,
    feedback,
  });
}

/**
 * 处理获取反馈统计
 */
async function handleGetStats(searchParams: URLSearchParams) {
  const caseId = searchParams.get('caseId') || undefined;
  const userId = searchParams.get('userId') || undefined;

  const stats = await feedbackOptimizer.getFeedbackStats(caseId, userId);

  return NextResponse.json({
    success: true,
    stats,
  });
}

/**
 * 处理获取当前策略
 */
async function handleGetStrategy() {
  const strategy = feedbackOptimizer.getCurrentStrategy();

  return NextResponse.json({
    success: true,
    strategy,
  });
}

/**
 * 处理获取用户偏好
 */
async function handleGetPreferences(searchParams: URLSearchParams) {
  const userId = searchParams.get('userId') || undefined;

  const preferences = await feedbackOptimizer.getUserPreferences(userId);

  return NextResponse.json({
    success: true,
    preferences,
  });
}

/**
 * 处理更新用户偏好
 */
async function handleUpdatePreferences(payload: {
  userId: string;
  preferences: any;
}) {
  if (!payload?.userId) {
    return NextResponse.json(
      { error: 'userId is required' },
      { status: 400 }
    );
  }

  await feedbackOptimizer.updateUserPreferences(payload.userId, payload.preferences);

  return NextResponse.json({
    success: true,
    message: 'Preferences updated',
  });
}
