/**
 * PPO 策略优化 API
 *
 * 与 `PPOPolicyOptimizationService`（反馈闭环）共用同一 `PPOOptimizer` 实例，
 * 见 `getSharedPPOOptimizer` / `getPPOPolicyService`。
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PPOOptimizer } from '@/lib/recommendation/ppo';
import {
  getPPOPolicyService,
  getSharedPPOOptimizer,
} from '@/lib/recommendation/ppo-integration';
import {
  RecommendationState,
  PPOAction,
  TrainingSample,
  UserFeedbackSignal
} from '@/lib/recommendation/ppo/types';

/**
 * GET /api/recommendation/ppo
 * 
 * 获取 PPO 模型状态
 */
export async function GET(request: NextRequest) {
  try {
    const service = getPPOPolicyService();
    const optimizer = getSharedPPOOptimizer();
    const state = optimizer.getState();
    const bufferSize = optimizer.getBufferSize();
    const minSamples = service.getPpoReplayMinSamples();
    const policyState = service.getState();

    return NextResponse.json({
      success: true,
      data: {
        modelState: state,
        bufferSize,
        minSamplesForReplayTrain: minSamples,
        isReady: bufferSize >= minSamples,
        policyOptimization: {
          totalSessions: policyState.totalSessions,
          totalFeedbacks: policyState.totalFeedbacks,
          feedbackEventsSinceLastTrain: policyState.feedbackEventsSinceLastTrain,
          lastTrainingTime: policyState.lastTrainingTime,
          trainingCount: policyState.trainingCount,
          lastTrainMode: policyState.lastTrainMode,
        },
      },
    });
  } catch (error) {
    console.error('[PPO API] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取PPO状态失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recommendation/ppo
 * 
 * 支持多种操作：
 * - action: 获取推荐动作
 * - train: 触发训练
 * - store: 存储经验
 * - save: 保存模型
 * - load: 加载模型
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, data } = body;

    const optimizer = getSharedPPOOptimizer();
    
    switch (operation) {
      case 'action':
        return handleGetAction(optimizer, data);
      
      case 'train':
        return handleTrain(optimizer, data);
      
      case 'store':
        return handleStoreExperience(optimizer, data);
      
      case 'offline-train':
        return handleOfflineTrain(optimizer, data);
      
      case 'save':
        return handleSaveModel(optimizer);
      
      case 'load':
        return handleLoadModel(optimizer, data);
      
      default:
        return NextResponse.json(
          { success: false, error: '未知操作类型' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[PPO API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'PPO操作失败' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 操作处理函数
// ============================================================================

/**
 * 获取推荐动作
 */
async function handleGetAction(
  optimizer: PPOOptimizer,
  data: { state: RecommendationState; deterministic?: boolean }
) {
  if (!data.state) {
    return NextResponse.json(
      { success: false, error: '缺少状态参数' },
      { status: 400 }
    );
  }
  
  const deterministic = data.deterministic ?? false;
  const action = optimizer.selectAction(data.state, deterministic);
  
  return NextResponse.json({
    success: true,
    data: {
      action,
      deterministic
    }
  });
}

/**
 * 触发训练
 */
async function handleTrain(
  optimizer: PPOOptimizer,
  data?: { samples?: TrainingSample[] }
) {
  const stats = await optimizer.train(data?.samples);
  
  return NextResponse.json({
    success: true,
    data: {
      stats,
      bufferSize: optimizer.getBufferSize()
    }
  });
}

/**
 * 存储经验
 */
async function handleStoreExperience(
  optimizer: PPOOptimizer,
  data: { samples: TrainingSample[] | TrainingSample }
) {
  if (!data.samples) {
    return NextResponse.json(
      { success: false, error: '缺少样本参数' },
      { status: 400 }
    );
  }
  
  const samples = Array.isArray(data.samples) ? data.samples : [data.samples];
  optimizer.storeExperiences(samples);
  
  return NextResponse.json({
    success: true,
    data: {
      stored: samples.length,
      bufferSize: optimizer.getBufferSize()
    }
  });
}

/**
 * 离线训练
 */
async function handleOfflineTrain(
  optimizer: PPOOptimizer,
  data: {
    historicalData: Array<{
      state: RecommendationState;
      action: PPOAction;
      feedback: UserFeedbackSignal[];
    }>;
  }
) {
  if (!data.historicalData || data.historicalData.length === 0) {
    return NextResponse.json(
      { success: false, error: '缺少历史数据' },
      { status: 400 }
    );
  }
  
  const stats = await optimizer.trainOffline(data.historicalData);
  
  return NextResponse.json({
    success: true,
    data: {
      stats,
      samplesProcessed: data.historicalData.length
    }
  });
}

/**
 * 保存模型
 */
async function handleSaveModel(optimizer: PPOOptimizer) {
  const modelData = optimizer.save();
  
  // 这里可以保存到数据库或文件系统
  // 目前返回模型数据，由前端处理存储
  
  return NextResponse.json({
    success: true,
    data: {
      model: modelData,
      message: '模型数据已生成，请妥善保存'
    }
  });
}

/**
 * 加载模型
 */
async function handleLoadModel(
  optimizer: PPOOptimizer,
  data: {
    policyNetwork: any;
    valueNetwork: any;
    state: any;
    config: any;
  }
) {
  if (!data.policyNetwork || !data.valueNetwork) {
    return NextResponse.json(
      { success: false, error: '缺少模型参数' },
      { status: 400 }
    );
  }
  
  optimizer.load({
    policyNetwork: data.policyNetwork,
    valueNetwork: data.valueNetwork,
    state: data.state,
    config: data.config
  });
  
  return NextResponse.json({
    success: true,
    data: {
      message: '模型加载成功',
      state: optimizer.getState()
    }
  });
}
