/**
 * 置信度校准 API - 闭环反馈系统组件
 * 
 * 功能：
 * - 获取校准状态和曲线
 * - 提交反馈事件
 * - 动态调整阈值
 * 
 * 集成到闭环反馈流程：
 * 用户行为 → 反馈收集 → 校准分析 → 阈值调整 → 推荐准确性提升
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCalibrationService,
  createFeedbackEvent,
} from '@/lib/recommendation/calibration';

/**
 * GET /api/quality/calibration
 * 获取校准状态和曲线
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const service = getCalibrationService();

    switch (action) {
      case 'status':
        return NextResponse.json({ success: true, data: service.getStatus() });

      case 'curve':
        const curve = service.getCalibrationCurve();
        return NextResponse.json({
          success: true,
          data: { curve, available: curve !== null },
        });

      case 'thresholds':
        return NextResponse.json({ success: true, data: service.getThresholds() });

      case 'history':
        const history = service.getThresholdAdjustmentHistory(10);
        return NextResponse.json({ success: true, data: history });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: `不支持的操作: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API quality/calibration] GET Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取校准状态失败' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quality/calibration
 * 提交反馈或调整配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    const service = getCalibrationService();

    switch (action) {
      case 'feedback': {
        // 提交预测反馈
        const event = createFeedbackEvent({
          intentConfidence: data.intentConfidence ?? 0.5,
          decision: data.decision || 'medium_confidence_verify',
          predictionSource: data.predictionSource || 'llm',
          searchExecuted: data.searchExecuted ?? false,
          satisfied: data.satisfied ?? null,
          rating: data.rating ?? null,
          clickedItems: data.clickedItems || [],
          converted: data.converted ?? false,
          relevanceScore: data.relevanceScore ?? null,
          searchUseful: data.searchUseful ?? null,
          scenario: data.scenario || 'general',
          query: data.query || '',
        });
        service.recordFeedback(event);
        return NextResponse.json({ success: true, message: '反馈已记录' });
      }

      case 'adjust-thresholds': {
        // 手动调整阈值
        service.setThresholds({
          high: data.highThreshold || 0.8,
          low: data.lowThreshold || 0.5,
        });
        return NextResponse.json({ success: true, data: service.getThresholds() });
      }

      case 'calibrate': {
        // 获取校准曲线
        const curve = service.getCalibrationCurve();
        return NextResponse.json({ success: true, data: { curve } });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: `不支持的操作: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API quality/calibration] POST Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '校准操作失败' } },
      { status: 500 }
    );
  }
}
