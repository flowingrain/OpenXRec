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
  /** 自上次训练以来至少积累多少条用户反馈事件后才允许再次训练（避免每条反馈都触发） */
  minFeedbackEventsBeforeTrain: number;
  /**
   * 两次训练之间的最短间隔（毫秒）。
   * 兼容旧字段名 `trainingIntervalMs`（若传入 Partial 配置且未设 cooldown，会回退到 trainingIntervalMs）。
   */
  trainingCooldownMs: number;
  /** @deprecated 请使用 trainingCooldownMs；仍会在合并配置时作为 cooldown 的兜底 */
  trainingIntervalMs?: number;

  /** 完整训练：会话对样本数下限（与 generateTrainingSamples 长度一致，约为 sessionBuffer.length - 1） */
  minSamplesForTraining: number;
  /** 轻量（部分）训练：样本数下限，低于完整训练门槛，用于先小幅更新策略 */
  minSessionPairsForPartial: number;
  partialTrainEpochs: number;
  partialTrainBatchSize: number;

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
  minFeedbackEventsBeforeTrain: 32,
  trainingCooldownMs: 3600000, // 1 小时：控制训练频率上限
  minSamplesForTraining: 256,
  minSessionPairsForPartial: 64,
  partialTrainEpochs: 2,
  partialTrainBatchSize: 32,
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

function mergePolicyOptimizationConfig(
  partial: Partial<PolicyOptimizationConfig> = {}
): PolicyOptimizationConfig {
  const base = DEFAULT_POLICY_OPTIMIZATION_CONFIG;
  const cooldown =
    partial.trainingCooldownMs ??
    partial.trainingIntervalMs ??
    base.trainingCooldownMs;
  return {
    ...base,
    ...partial,
    trainingCooldownMs: cooldown,
    rewardWeights: { ...base.rewardWeights, ...partial.rewardWeights },
  };
}

/**
 * 从环境变量读取 PPO 策略服务配置（可选覆盖默认值）。
 * 用于「积累反馈后再训练」「轻量更新 vs 完整训练」等行为调参。
 */
export function policyOptimizationConfigFromEnv(): Partial<PolicyOptimizationConfig> {
  const num = (key: string): number | undefined => {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const bool = (key: string): boolean | undefined => {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return undefined;
    const v = raw.toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'no') return false;
    return undefined;
  };

  const out: Partial<PolicyOptimizationConfig> = {};
  const minFb = num('OPENXREC_PPO_MIN_FEEDBACKS_BEFORE_TRAIN');
  if (minFb !== undefined) out.minFeedbackEventsBeforeTrain = minFb;

  const cooldown = num('OPENXREC_PPO_TRAINING_COOLDOWN_MS');
  if (cooldown !== undefined) out.trainingCooldownMs = cooldown;

  const minPartial = num('OPENXREC_PPO_MIN_SESSION_PAIRS_PARTIAL');
  if (minPartial !== undefined) out.minSessionPairsForPartial = minPartial;

  const minFull = num('OPENXREC_PPO_MIN_SESSION_PAIRS_FULL');
  if (minFull !== undefined) out.minSamplesForTraining = minFull;

  const pe = num('OPENXREC_PPO_PARTIAL_EPOCHS');
  if (pe !== undefined) out.partialTrainEpochs = pe;

  const pb = num('OPENXREC_PPO_PARTIAL_BATCH_SIZE');
  if (pb !== undefined) out.partialTrainBatchSize = pb;

  const auto = bool('OPENXREC_PPO_AUTO_TRAIN');
  if (auto !== undefined) out.autoTrain = auto;

  return out;
}

/**
 * 策略优化状态
 */
export interface PolicyOptimizationState {
  // 统计信息
  totalSessions: number;
  totalFeedbacks: number;
  /** 自上次训练起累计的反馈条数（训练成功后清零） */
  feedbackEventsSinceLastTrain: number;
  lastTrainingTime: number;
  trainingCount: number;
  lastTrainMode: 'full' | 'partial' | null;
  
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
  private isTraining = false;

  constructor(
    adaptiveOptimizer: AdaptiveOptimizerAgent,
    config: Partial<PolicyOptimizationConfig> = {}
  ) {
    this.adaptiveOptimizer = adaptiveOptimizer;
    this.config = mergePolicyOptimizationConfig(config);
    
    // 创建PPO优化器（minSamples 取轻量/完整门槛中较小者，否则样本不足时无法 trainWithConfig）
    this.ppoOptimizer = createPPOOptimizer({
      stateDim: 32,
      hiddenDims: [128, 64, 32],
      learningRate: this.config.learningRate,
      bufferSize: 10000,
      minSamples: Math.min(
        this.config.minSessionPairsForPartial,
        this.config.minSamplesForTraining
      ),
    });
    
    // 初始化状态
    this.state = {
      totalSessions: 0,
      totalFeedbacks: 0,
      feedbackEventsSinceLastTrain: 0,
      lastTrainingTime: 0,
      trainingCount: 0,
      lastTrainMode: null,
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
    this.state.feedbackEventsSinceLastTrain++;
    
    // 同步到自适应优化智能体
    this.syncToAdaptiveOptimizer(feedback);
    
    // 满足「积累 + 冷却 + 样本档」后再异步训练，避免每条反馈触发完整训练
    this.tryScheduleTraining();
  }

  /**
   * 获取当前最优策略
   */
  getOptimalPolicy(state: RecommendationState): PPOAction {
    return this.ppoOptimizer.getAction(state, true).action;
  }

  /**
   * 触发一次训练（仅校验当前模式下的样本量是否足够）。
   * 反馈积累与冷却由 `evaluateTrainOpportunity` 在自动路径上控制；手动/API 可在此直接调用。
   * - `mode: 'full'`：完整门槛，默认 epoch/batch
   * - `mode: 'partial'`：轻量门槛，较少 epoch
   */
  async train(options?: {
    mode?: 'full' | 'partial';
  }): Promise<{
    success: boolean;
    metrics?: {
      policyLoss: number;
      valueLoss: number;
      avgReward: number;
      improvement: number;
      mode: 'full' | 'partial';
    };
    error?: string;
  }> {
    let mode = options?.mode;

    if (!mode) {
      const pairs = this.getSessionPairCount();
      if (pairs >= this.config.minSamplesForTraining) mode = 'full';
      else if (pairs >= this.config.minSessionPairsForPartial) mode = 'partial';
      else mode = 'full';
    }

    const minPairs =
      mode === 'full'
        ? this.config.minSamplesForTraining
        : this.config.minSessionPairsForPartial;

    const samples = this.generateTrainingSamples();

    if (samples.length < minPairs) {
      return {
        success: false,
        error: `Insufficient samples for ${mode}: ${samples.length} < ${minPairs}`,
      };
    }

    try {
      console.log(
        `[PPOService] Starting ${mode} training with ${samples.length} session-pair samples...`
      );

      this.ppoOptimizer.storeExperiencesBatch(samples);

      const result =
        mode === 'full'
          ? await this.ppoOptimizer.trainWithConfig()
          : await this.ppoOptimizer.trainWithConfig(
              this.config.partialTrainEpochs,
              this.config.partialTrainBatchSize
            );

      this.state.lastTrainingTime = Date.now();
      this.state.trainingCount++;
      this.state.feedbackEventsSinceLastTrain = 0;
      this.state.lastTrainMode = mode;

      if (result.avgReward > this.state.bestReward) {
        this.state.bestReward = result.avgReward;
        this.state.bestPolicy = this.ppoOptimizer.getAction(
          this.getAverageState(),
          true
        ).action.strategyWeights;
      }

      this.state.trainingHistory.push({
        timestamp: Date.now(),
        policyLoss: result.policyLoss,
        valueLoss: result.valueLoss,
        avgReward: result.avgReward,
        improvement: result.improvement,
      });

      if (this.state.trainingHistory.length > 100) {
        this.state.trainingHistory = this.state.trainingHistory.slice(-100);
      }

      console.log(
        `[PPOService] ${mode} training complete: policyLoss=${result.policyLoss.toFixed(4)}, improvement=${result.improvement.toFixed(4)}`
      );

      return {
        success: true,
        metrics: {
          policyLoss: result.policyLoss,
          valueLoss: result.valueLoss,
          avgReward: result.avgReward,
          improvement: result.improvement,
          mode,
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
   * 与 `/api/recommendation/ppo`、反馈闭环共用同一套策略网络与经验回放（单例）。
   */
  getPPOOptimizer(): PPOOptimizer {
    return this.ppoOptimizer;
  }

  /**
   * 当前 PPO 优化器在 train/trainWithConfig 中使用的最小回放样本数（与创建时 minSamples 一致）。
   */
  getPpoReplayMinSamples(): number {
    return Math.min(
      this.config.minSessionPairsForPartial,
      this.config.minSamplesForTraining
    );
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

  private getSessionPairCount(): number {
    return Math.max(0, this.sessionBuffer.length - 1);
  }

  /**
   * 是否满足自动训练条件（积累反馈 + 冷却 + 样本档位）。
   * 样本足够完整训练时优先完整训练，否则在达到轻量门槛时做 partial。
   */
  private evaluateTrainOpportunity(): { mode: 'full' | 'partial' } | null {
    if (!this.config.autoTrain || this.isTraining) return null;

    const now = Date.now();
    if (
      this.state.lastTrainingTime > 0 &&
      now - this.state.lastTrainingTime < this.config.trainingCooldownMs
    ) {
      return null;
    }

    if (this.state.feedbackEventsSinceLastTrain < this.config.minFeedbackEventsBeforeTrain) {
      return null;
    }

    const pairs = this.getSessionPairCount();
    if (pairs >= this.config.minSamplesForTraining) {
      return { mode: 'full' };
    }
    if (pairs >= this.config.minSessionPairsForPartial) {
      return { mode: 'partial' };
    }
    return null;
  }

  private tryScheduleTraining(): void {
    const plan = this.evaluateTrainOpportunity();
    if (!plan || this.isTraining) return;

    this.isTraining = true;
    this.train({ mode: plan.mode })
      .catch(err => {
        console.error('[PPOService] Training failed:', err);
      })
      .finally(() => {
        this.isTraining = false;
      });
  }

  /**
   * 启动自动训练（轮询检查条件，间隔独立于冷却时间）
   */
  private startAutoTraining(): void {
    const pollMs = Math.min(60_000, Math.max(15_000, this.config.trainingCooldownMs / 4));
    this.trainingTimer = setInterval(() => {
      this.tryScheduleTraining();
    }, pollMs);

    console.log(
      `[PPOService] Auto training poll every ${pollMs}ms, cooldown ${this.config.trainingCooldownMs}ms`
    );
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
    ppoServiceInstance = new PPOPolicyOptimizationService(
      optimizer,
      policyOptimizationConfigFromEnv()
    );
  }
  return ppoServiceInstance;
}

/**
 * 全局共享的 `PPOOptimizer`，与 `getPPOPolicyService().getPPOOptimizer()` 为同一实例。
 * 供 HTTP 路由等与反馈闭环对齐，避免两套独立权重。
 */
export function getSharedPPOOptimizer(): PPOOptimizer {
  return getPPOPolicyService().getPPOOptimizer();
}

/**
 * 创建新的PPO策略优化服务实例
 */
export function createPPOPolicyService(
  adaptiveOptimizer: AdaptiveOptimizerAgent,
  config?: Partial<PolicyOptimizationConfig>
): PPOPolicyOptimizationService {
  return new PPOPolicyOptimizationService(adaptiveOptimizer, {
    ...policyOptimizationConfigFromEnv(),
    ...config,
  });
}
