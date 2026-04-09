/**
 * PPO策略优化服务集成
 * 
 * 作为独立的策略优化服务，与反馈闭环智能体协同工作：
 * 1. 从反馈闭环智能体获取用户反馈数据
 * 2. 将反馈转换为训练样本
 * 3. 定期训练PPO模型
 * 4. 输出优化后的策略权重给推荐引擎
 * 
 * 架构：
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    推荐流程                                 │
 * │  用户请求 → 意图分析 → 推荐生成 → 结果展示                   │
 * └─────────────────────────────────────────────────────────────┘
 *       ↓                                    ↓
 * ┌──────────────────┐              ┌────────────────────┐
 * │ 自适应优化智能体  │ ←──反馈───→ │ 反馈收集器          │
 * │ - 规则精细化      │              │ - 用户行为记录      │
 * │ - 置信度校准      │              │ - 奖励信号计算      │
 * │ - 多级兜底        │              └────────────────────┘
 * └──────────────────┘                      ↓
 *       ↓                           ┌────────────────────┐
 * └───────────────→ PPO策略优化服务 ←│ 训练样本生成        │
 *                   - 后台训练       └────────────────────┘
 *                   - 策略权重优化
 *                   - 定期更新配置
 */

import { PPOOptimizer, createPPOOptimizer } from './ppo';
import { AdaptiveOptimizerAgent, type IntentFeedback } from './adaptive-optimizer';
import type {
  RecommendationState,
  PPOAction,
  UserFeedbackSignal,
  TrainingSample,
  StrategyWeights,
} from './ppo/types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 推荐会话记录
 */
export interface RecommendationSession {
  sessionId: string;
  userId: string;
  timestamp: number;
  
  // 状态信息
  state: RecommendationState;
  
  // 执行的动作
  action: PPOAction;
  
  // 用户反馈
  feedbacks: UserFeedbackSignal[];
  
  // 会话奖励
  reward?: number;
  
  // 是否完成
  done: boolean;
}

/**
 * 策略优化配置
 */
export interface PolicyOptimizationConfig {
  // 训练触发条件
  minSamplesForTraining: number;      // 最小样本数
  trainingIntervalMs: number;         // 训练间隔（毫秒）
  
  // 奖励计算
  rewardWeights: {
    click: number;
    like: number;
    purchase: number;
    dislike: number;
    skip: number;
    dwell: number;
  };
  
  // 学习率
  learningRate: number;
  
  // 是否自动训练
  autoTrain: boolean;
}

/**
 * 默认策略优化配置
 */
export const DEFAULT_POLICY_OPTIMIZATION_CONFIG: PolicyOptimizationConfig = {
  minSamplesForTraining: 256,
  trainingIntervalMs: 3600000, // 1小时
  rewardWeights: {
    click: 1.0,
    like: 2.0,
    purchase: 5.0,
    dislike: -2.0,
    skip: -0.5,
    dwell: 0.1,
  },
  learningRate: 3e-4,
  autoTrain: true,
};

/**
 * 策略优化状态
 */
export interface PolicyOptimizationState {
  // 统计信息
  totalSessions: number;
  totalFeedbacks: number;
  lastTrainingTime: number;
  trainingCount: number;
  
  // 当前最优策略
  bestPolicy: StrategyWeights | null;
  bestReward: number;
  
  // 训练历史
  trainingHistory: Array<{
    timestamp: number;
    policyLoss: number;
    valueLoss: number;
    avgReward: number;
    improvement: number;
  }>;
}

// ============================================================================
// PPO策略优化服务
// ============================================================================

/**
 * PPO策略优化服务
 * 
 * 作为独立服务运行，与反馈闭环智能体协同工作
 */
export class PPOPolicyOptimizationService {
  private ppoOptimizer: PPOOptimizer;
  private adaptiveOptimizer: AdaptiveOptimizerAgent;
  private config: PolicyOptimizationConfig;
  private state: PolicyOptimizationState;
  
  // 会话存储
  private sessions: Map<string, RecommendationSession> = new Map();
  private sessionBuffer: RecommendationSession[] = [];
  
  // 训练定时器
  private trainingTimer: NodeJS.Timeout | null = null;

  constructor(
    adaptiveOptimizer: AdaptiveOptimizerAgent,
    config: Partial<PolicyOptimizationConfig> = {}
  ) {
    this.adaptiveOptimizer = adaptiveOptimizer;
    this.config = { ...DEFAULT_POLICY_OPTIMIZATION_CONFIG, ...config };
    
    // 创建PPO优化器
    this.ppoOptimizer = createPPOOptimizer({
      stateDim: 32,
      hiddenDims: [128, 64, 32],
      learningRate: this.config.learningRate,
      bufferSize: 10000,
      minSamples: this.config.minSamplesForTraining,
    });
    
    // 初始化状态
    this.state = {
      totalSessions: 0,
      totalFeedbacks: 0,
      lastTrainingTime: 0,
      trainingCount: 0,
      bestPolicy: null,
      bestReward: 0,
      trainingHistory: [],
    };
    
    // 启动自动训练
    if (this.config.autoTrain) {
      this.startAutoTraining();
    }
  }

  // ===========================================================================
  // 核心接口
  // ===========================================================================

  /**
   * 记录推荐会话
   */
  recordSession(session: RecommendationSession): void {
    this.sessions.set(session.sessionId, session);
    this.sessionBuffer.push(session);
    this.state.totalSessions++;
    
    // 限制缓冲区大小
    if (this.sessionBuffer.length > 1000) {
      this.sessionBuffer = this.sessionBuffer.slice(-1000);
    }
    
    console.log(`[PPOService] Recorded session ${session.sessionId}, total: ${this.state.totalSessions}`);
  }

  /**
   * 记录用户反馈
   */
  recordFeedback(
    sessionId: string,
    feedback: UserFeedbackSignal
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[PPOService] Session ${sessionId} not found`);
      return;
    }
    
    session.feedbacks.push(feedback);
    this.state.totalFeedbacks++;
    
    // 同步到自适应优化智能体
    this.syncToAdaptiveOptimizer(feedback);
    
    // 检查是否需要触发训练
    if (this.shouldTrain()) {
      this.train().catch(err => {
        console.error('[PPOService] Training failed:', err);
      });
    }
  }

  /**
   * 获取当前最优策略
   */
  getOptimalPolicy(state: RecommendationState): PPOAction {
    return this.ppoOptimizer.getAction(state, true).action;
  }

  /**
   * 手动触发训练
   */
  async train(): Promise<{
    success: boolean;
    metrics?: {
      policyLoss: number;
      valueLoss: number;
      avgReward: number;
      improvement: number;
    };
    error?: string;
  }> {
    const samples = this.generateTrainingSamples();
    
    if (samples.length < this.config.minSamplesForTraining) {
      return {
        success: false,
        error: `Insufficient samples: ${samples.length} < ${this.config.minSamplesForTraining}`,
      };
    }
    
    try {
      console.log(`[PPOService] Starting training with ${samples.length} samples...`);
      
      // 存储经验
      this.ppoOptimizer.storeExperiencesBatch(samples);
      
      // 训练
      const result = await this.ppoOptimizer.trainWithConfig();
      
      // 更新状态
      this.state.lastTrainingTime = Date.now();
      this.state.trainingCount++;
      
      // 更新最优策略
      if (result.avgReward > this.state.bestReward) {
        this.state.bestReward = result.avgReward;
        this.state.bestPolicy = this.ppoOptimizer.getAction(
          this.getAverageState(),
          true
        ).action.strategyWeights;
      }
      
      // 记录历史
      this.state.trainingHistory.push({
        timestamp: Date.now(),
        policyLoss: result.policyLoss,
        valueLoss: result.valueLoss,
        avgReward: result.avgReward,
        improvement: result.improvement,
      });
      
      // 保持历史记录在合理范围
      if (this.state.trainingHistory.length > 100) {
        this.state.trainingHistory = this.state.trainingHistory.slice(-100);
      }
      
      console.log(`[PPOService] Training complete: policyLoss=${result.policyLoss.toFixed(4)}, improvement=${result.improvement.toFixed(4)}`);
      
      return {
        success: true,
        metrics: {
          policyLoss: result.policyLoss,
          valueLoss: result.valueLoss,
          avgReward: result.avgReward,
          improvement: result.improvement,
        },
      };
    } catch (error) {
      console.error('[PPOService] Training error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取服务状态
   */
  getState(): PolicyOptimizationState & { bufferSize: number } {
    return {
      ...this.state,
      bufferSize: this.ppoOptimizer.getBufferSize(),
    };
  }

  /**
   * 关闭服务
   */
  shutdown(): void {
    if (this.trainingTimer) {
      clearInterval(this.trainingTimer);
      this.trainingTimer = null;
    }
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 生成训练样本
   */
  private generateTrainingSamples(): TrainingSample[] {
    const samples: TrainingSample[] = [];
    
    for (let i = 0; i < this.sessionBuffer.length - 1; i++) {
      const session = this.sessionBuffer[i];
      const nextSession = this.sessionBuffer[i + 1];
      
      // 计算会话奖励
      const reward = this.calculateSessionReward(session);
      
      samples.push({
        state: session.state,
        action: session.action,
        reward,
        nextState: nextSession.state,
        done: i === this.sessionBuffer.length - 2,
        logProb: 0, // 将在存储时计算
        value: 0,   // 将在存储时计算
      });
    }
    
    return samples;
  }

  /**
   * 计算会话奖励
   */
  private calculateSessionReward(session: RecommendationSession): number {
    let reward = 0;
    
    for (const feedback of session.feedbacks) {
      const weight = this.config.rewardWeights[feedback.type] || 0;
      reward += weight * Math.abs(feedback.value);
    }
    
    // 归一化到 [-1, 1]
    return Math.tanh(reward / 10);
  }

  /**
   * 获取平均状态（用于获取最优策略）
   */
  private getAverageState(): RecommendationState {
    // 返回一个合理的默认状态
    return {
      userId: 'average',
      userFeatures: {
        activeLevel: 0.5,
        diversityPreference: 0.5,
        avgSessionLength: 0.5,
        clickThroughRate: 0.1,
        conversionRate: 0.05,
      },
      scenarioFeatures: {
        scenarioType: 'general',
        itemPoolSize: 0.5,
        timeOfDay: 0.5,
        dayOfWeek: 0.5,
      },
      historyStats: {
        recentCtr: 0.1,
        recentSatisfaction: 0.5,
        strategyPerformance: {},
      },
      currentConfig: {
        strategyWeights: {
          content_based: 0.3,
          collaborative: 0.3,
          knowledge_based: 0.2,
          agent_based: 0.1,
          causal_based: 0.1,
        },
        diversityWeight: 0.3,
        noveltyWeight: 0.2,
        serendipityWeight: 0.1,
        minScoreThreshold: 0.5,
      },
    };
  }

  /**
   * 同步反馈到自适应优化智能体
   */
  private syncToAdaptiveOptimizer(feedback: UserFeedbackSignal): void {
    // 将用户反馈转换为意图反馈格式
    const intentFeedback: IntentFeedback = {
      query: feedback.itemId, // 使用 itemId 作为 query 标识
      predictedNeedsSearch: true, // 默认值
      predictedConfidence: 0.5,
      actualNeedsSearch: feedback.type !== 'skip',
      matchedKeywords: [],
      source: 'llm',
      timestamp: feedback.timestamp,
    };
    
    // 异步记录，不阻塞主流程
    this.adaptiveOptimizer.recordFeedbackAndLearn(intentFeedback).catch(err => {
      console.warn('[PPOService] Failed to sync to adaptive optimizer:', err);
    });
  }

  /**
   * 检查是否应该训练
   */
  private shouldTrain(): boolean {
    const now = Date.now();
    const timeSinceLastTraining = now - this.state.lastTrainingTime;
    const hasEnoughSamples = this.sessionBuffer.length >= this.config.minSamplesForTraining;
    
    return hasEnoughSamples && timeSinceLastTraining >= this.config.trainingIntervalMs;
  }

  /**
   * 启动自动训练
   */
  private startAutoTraining(): void {
    this.trainingTimer = setInterval(() => {
      if (this.shouldTrain()) {
        this.train().catch(err => {
          console.error('[PPOService] Auto training failed:', err);
        });
      }
    }, this.config.trainingIntervalMs);
    
    console.log(`[PPOService] Auto training started, interval: ${this.config.trainingIntervalMs}ms`);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let ppoServiceInstance: PPOPolicyOptimizationService | null = null;

/**
 * 获取PPO策略优化服务单例
 */
export function getPPOPolicyService(
  adaptiveOptimizer?: AdaptiveOptimizerAgent
): PPOPolicyOptimizationService {
  if (!ppoServiceInstance) {
    const optimizer = adaptiveOptimizer || new AdaptiveOptimizerAgent({} as any);
    ppoServiceInstance = new PPOPolicyOptimizationService(optimizer);
  }
  return ppoServiceInstance;
}

/**
 * 创建新的PPO策略优化服务实例
 */
export function createPPOPolicyService(
  adaptiveOptimizer: AdaptiveOptimizerAgent,
  config?: Partial<PolicyOptimizationConfig>
): PPOPolicyOptimizationService {
  return new PPOPolicyOptimizationService(adaptiveOptimizer, config);
}
