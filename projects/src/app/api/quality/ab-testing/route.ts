/**
 * A/B 测试 API - 闭环反馈系统组件
 * 
 * 功能：
 * - 创建和管理A/B测试实验
 * - 记录实验事件
 * - 分析实验结果
 * 
 * 集成到闭环反馈流程：
 * 用户行为 → 反馈收集 → A/B测试 → 策略优化 → 推荐调整
 */

import { NextRequest, NextResponse } from 'next/server';
import { getABTestingManager } from '@/lib/recommendation/persistence/ab-testing';

/**
 * GET /api/quality/ab-testing
 * 获取活跃实验列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get('experimentId');

    const abTesting = getABTestingManager();

    if (experimentId) {
      const results = await abTesting.getResults(experimentId);
      return NextResponse.json({
        success: true,
        data: results,
      });
    }

    const experiments = abTesting.getActiveExperiments();
    const experimentsWithResults = await Promise.all(
      experiments.map(async (exp) => {
        const results = await abTesting.getResults(exp.id);
        return { ...exp, results };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        experiments: experimentsWithResults,
        total: experiments.length,
      },
    });
  } catch (error) {
    console.error('[API quality/ab-testing] GET Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取A/B测试数据失败' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quality/ab-testing
 * 创建/管理实验
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    const abTesting = getABTestingManager();

    switch (action) {
      case 'create': {
        const experiment = await abTesting.createExperiment({
          name: data.name,
          description: data.description,
          variantA: data.variantA,
          variantB: data.variantB,
          trafficSplit: data.trafficSplit || 0.5,
        });
        return NextResponse.json({ success: true, data: experiment });
      }

      case 'record': {
        await abTesting.recordEvent({
          experimentId: data.experimentId,
          userId: data.userId,
          eventType: data.eventType,
          eventData: data.eventData,
        });
        return NextResponse.json({ success: true, message: '事件已记录' });
      }

      case 'results': {
        const results = await abTesting.getResults(data.experimentId);
        return NextResponse.json({ success: true, data: results });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: `不支持的操作: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API quality/ab-testing] POST Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'A/B测试操作失败' } },
      { status: 500 }
    );
  }
}
