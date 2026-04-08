/**
 * 反思机制 API - 闭环反馈系统核心组件
 * 
 * 功能：
 * - 获取反思历史和报告
 * - 触发反思分析（意图分析后、推荐生成后、规则更新前）
 * - 执行批量反思
 * 
 * 集成到闭环反馈流程：
 * 用户行为 → 反馈收集 → 反思分析 → 自我评估 → 改进建议 → 策略优化
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReflectionService } from '@/lib/recommendation/reflection';

/**
 * GET /api/quality/reflection
 * 获取反思历史和报告
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'history';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const service = getReflectionService();

    switch (action) {
      case 'history': {
        const history = service.getReflectionHistory(limit);
        return NextResponse.json({ success: true, data: { history } });
      }

      case 'report': {
        const report = service.exportReflectionReport();
        return NextResponse.json({ success: true, data: { report: JSON.parse(report) } });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: `不支持的操作: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API quality/reflection] GET Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取反思历史失败' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quality/reflection
 * 触发反思分析
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, input } = body;

    if (!type || !input) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: '缺少必要参数: type, input' } },
        { status: 400 }
      );
    }

    const service = getReflectionService();
    let result;

    switch (type) {
      case 'intent_analysis': {
        // 意图分析后反思
        result = await service.reflectOnIntentAnalysis({
          query: input.query,
          scenario: input.scenario,
          predictedNeedsSearch: input.predictedNeedsSearch,
          predictedConfidence: input.predictedConfidence,
          reasoning: input.reasoning,
          matchedKeywords: input.matchedKeywords,
          source: input.source,
        });
        break;
      }

      case 'recommendation': {
        // 推荐生成后反思
        result = await service.reflectOnRecommendation({
          query: input.query,
          recommendations: input.recommendations,
          overallConfidence: input.overallConfidence || 0.5,
          sources: input.sources || [],
        });
        break;
      }

      case 'rule_update': {
        // 规则更新前反思
        result = await service.reflectOnRuleUpdate({
          updateType: input.updateType,
          beforeState: input.beforeState,
          afterState: input.afterState,
          triggerReason: input.triggerReason,
          sampleEvidence: input.sampleEvidence,
        });
        break;
      }

      case 'batch': {
        // 批量反思
        result = await service.performBatchReflection({
          recentFeedbackCount: input.recentFeedbackCount || 100,
        });
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TYPE', message: `不支持的反思类型: ${type}` } },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[API quality/reflection] POST Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '反思分析失败' } },
      { status: 500 }
    );
  }
}
