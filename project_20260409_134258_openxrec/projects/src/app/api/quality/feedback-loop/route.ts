/**
 * 反馈闭环 API - 整合所有闭环反馈组件
 * 
 * 完整的反馈闭环流程：
 * 
 * 用户行为 → 反馈收集 → A/B测试 → 校准分析 → 反思机制 → PPO训练 → 自适应优化 → 推荐调整
 *     ↓           ↓           ↓           ↓           ↓           ↓           ↓           ↓
 *   点击/评分   记录反馈    分流实验    置信度校准   自我评估   策略优化   规则调整   实时生效
 * 
 * API端点：
 * - POST /api/quality/feedback-loop - 提交反馈并触发闭环
 * - GET /api/quality/feedback-loop - 获取闭环状态
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCalibrationService,
  createFeedbackEvent,
} from '@/lib/recommendation/calibration';
import { getABTestingManager } from '@/lib/recommendation/persistence/ab-testing';

/**
 * 反馈闭环状态
 */
interface FeedbackLoopStatus {
  calibration: {
    status: string;
    ece: number | null;
    threshold: { high: number; low: number };
  };
  abTesting: {
    activeExperiments: number;
    runningTests: string[];
  };
  ppo: {
    trainingReady: boolean;
    lastTraining: string | null;
  };
  adaptiveOptimizer: {
    optimizationAvailable: boolean;
    lastOptimization: string | null;
  };
}

/**
 * GET /api/quality/feedback-loop
 * 获取反馈闭环整体状态
 */
export async function GET(request: NextRequest) {
  try {
    const abTesting = getABTestingManager();
    const calibration = getCalibrationService();

    const status: FeedbackLoopStatus = {
      calibration: {
        status: calibration.getStatus().isInitialized ? 'active' : 'inactive',
        ece: calibration.getCalibrationCurve()?.expectedCalibrationError || null,
        threshold: calibration.getThresholds(),
      },
      abTesting: {
        activeExperiments: abTesting.getActiveExperiments().length,
        runningTests: abTesting.getActiveExperiments().map(e => e.experiment_name),
      },
      ppo: {
        trainingReady: false,
        lastTraining: null,
      },
      adaptiveOptimizer: {
        optimizationAvailable: false,
        lastOptimization: null,
      },
    };

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[API quality/feedback-loop] GET Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取闭环状态失败' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quality/feedback-loop
 * 提交反馈并触发闭环流程
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'submit_feedback': {
        // 1. 记录反馈到校准系统
        const calibration = getCalibrationService();
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
          scenario: data.scenario || 'general',
          query: data.query || '',
        });
        calibration.recordFeedback(event);

        // 2. 记录到A/B测试（如果适用）
        if (data.experimentId) {
          const abTesting = getABTestingManager();
          await abTesting.recordEvent({
            experimentId: data.experimentId,
            userId: data.userId,
            eventType: data.feedbackType || 'outcome',
            eventData: { 
              isCorrect: data.isCorrect, 
              predictedNeedsSearch: data.searchExecuted,
              actualNeedsSearch: data.satisfied,
            },
          });
        }

        return NextResponse.json({
          success: true,
          message: '反馈已记录',
          data: {
            calibrationRecorded: true,
            abTestingRecorded: !!data.experimentId,
          },
        });
      }

      case 'get_calibration': {
        const calibration = getCalibrationService();
        return NextResponse.json({
          success: true,
          data: {
            status: calibration.getStatus(),
            curve: calibration.getCalibrationCurve(),
            thresholds: calibration.getThresholds(),
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: `不支持的操作: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API quality/feedback-loop] POST Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '反馈闭环处理失败' } },
      { status: 500 }
    );
  }
}
