/**
 * PPO 自适应超参数调整器
 * 
 * 功能：
 * 1. 根据训练性能指标动态调整学习率
 * 2. 自适应调整裁剪参数、熵系数等
 * 3. 支持多种调整策略（线性衰减、余弦退火、性能驱动）
 * 4. 监控KL散度和策略更新幅度，防止策略崩溃
 * 5. 持久化超参数版本，支持跨会话学习和回滚
 */

import { TrainingStats } from './types';
import { 
  getPPOPersistence, 
  PPOPersistenceService 
} from '../persistence/ppo-storage';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 超参数调整策略
 */
export enum AdaptationStrategy {
  LINEAR_DECAY = 'linear_decay',           // 线性衰减
  COSINE_ANNEALING = 'cosine_annealing',   // 余弦退火
  PERFORMANCE_BASED = 'performance_based', // 性能驱动
  KL_ADAPTIVE = 'kl_adaptive',             // KL散度自适应
  HYBRID = 'hybrid'                        // 混合策略
}

/**
 * 自适应超参数配置
 */
export interface AdaptiveHyperparamConfig {
  // 调整策略
  strategy: AdaptationStrategy;
  
  // 学习率调整
  learningRate: {
    initial: number;
    min: number;
    max: number;
    decayRate: number;      // 衰减率
    warmupSteps: number;    // 预热步数
    patience: number;       // 等待改进的epoch数
    factor: number;         // 衰减因子
  };
  
  // 裁剪参数调整
  clipEpsilon: {
    initial: number;
    min: number;
    max: number;
    adaptOnKl: boolean;     // 根据KL散度调整
    targetKl: number;       // 目标KL散度
  };
  
  // 熵系数调整
  entropyCoef: {
    initial: number;
    min: number;
    max: number;
    adaptOnEntropy: boolean; // 根据熵值调整
    targetEntropy: number;   // 目标熵值
  };
  
  // GAE Lambda调整
  gaeLambda: {
    initial: number;
    min: number;
    max: number;
  };
  
  // 其他参数
  earlyStoppingPatience: number;  // 早停耐心值
  performanceWindow: number;       // 性能评估窗口大小
  minImprovement: number;          // 最小改进阈值
}

/**
 * 默认自适应配置
 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveHyperparamConfig = {
  strategy: AdaptationStrategy.HYBRID,
  
  learningRate: {
    initial: 3e-4,
    min: 1e-6,
    max: 1e-3,
    decayRate: 0.95,
    warmupSteps: 10,
    patience: 5,
    factor: 0.5
  },
  
  clipEpsilon: {
    initial: 0.2,
    min: 0.05,
    max: 0.3,
    adaptOnKl: true,
    targetKl: 0.02
  },
  
  entropyCoef: {
    initial: 0.01,
    min: 0.001,
    max: 0.1,
    adaptOnEntropy: true,
    targetEntropy: -1.0  // 目标熵（负值，因为熵通常是负的）
  },
  
  gaeLambda: {
    initial: 0.95,
    min: 0.9,
    max: 0.99
  },
  
  earlyStoppingPatience: 20,
  performanceWindow: 10,
  minImprovement: 0.001
};

/**
 * 当前超参数值
 */
export interface CurrentHyperparams {
  learningRate: number;
  clipEpsilon: number;
  entropyCoef: number;
  gaeLambda: number;
  timestamp: number;
}

/**
 * 性能跟踪数据
 */
export interface PerformanceTracker {
  rewards: number[];
  losses: number[];
  klDivergences: number[];
  entropies: number[];
  bestReward: number;
  bestEpoch: number;
  epochsSinceImprovement: number;
}

/**
 * 调整历史记录
 */
export interface AdaptationHistory {
  epoch: number;
  oldParams: CurrentHyperparams;
  newParams: CurrentHyperparams;
  reason: string;
  performanceImprovement: number;
  timestamp: number;
}

/**
 * 调整结果
 */
export interface AdaptationResult {
  params: CurrentHyperparams;
  adapted: boolean;
  reason: string;
  recommendations: string[];
}

// ============================================================================
// 自适应超参数调整器
// ============================================================================

/**
 * 自适应超参数调整器
 */
export class AdaptiveHyperparamAdjuster {
  private config: AdaptiveHyperparamConfig;
  private currentParams: CurrentHyperparams;
  private performance: PerformanceTracker;
  private history: AdaptationHistory[] = [];
  private step: number = 0;
  
  // 持久化服务
  private persistence: PPOPersistenceService;
  private enablePersistence: boolean = true;
  private sessionId: string = '';
  private lastSavedVersion: number = 0;
  
  constructor(config: Partial<AdaptiveHyperparamConfig> = {}, enablePersistence: boolean = true) {
    this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config };
    this.enablePersistence = enablePersistence;
    
    // 初始化持久化服务
    this.persistence = getPPOPersistence();
    
    // 初始化当前参数
    this.currentParams = {
      learningRate: this.config.learningRate.initial,
      clipEpsilon: this.config.clipEpsilon.initial,
      entropyCoef: this.config.entropyCoef.initial,
      gaeLambda: this.config.gaeLambda.initial,
      timestamp: Date.now()
    };
    
    // 初始化性能跟踪
    this.performance = {
      rewards: [],
      losses: [],
      klDivergences: [],
      entropies: [],
      bestReward: -Infinity,
      bestEpoch: 0,
      epochsSinceImprovement: 0
    };
    
    // 生成会话ID
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // 异步加载激活版本
    this.loadActiveVersion();
  }
  
  /**
   * 从持久化加载激活版本
   */
  private async loadActiveVersion(): Promise<void> {
    if (!this.enablePersistence) return;
    
    try {
      await this.persistence.initialize();
      const activeVersion = await this.persistence.getActiveVersion();
      
      if (activeVersion) {
        this.currentParams = {
          learningRate: activeVersion.config.learningRate,
          clipEpsilon: activeVersion.config.clipEpsilon,
          entropyCoef: activeVersion.config.entropyCoef,
          gaeLambda: activeVersion.config.gaeLambda,
          timestamp: Date.now(),
        };
        this.lastSavedVersion = activeVersion.version;
        console.log(`[AdaptiveAdjuster] Loaded active version ${activeVersion.version}`);
      }
    } catch (e) {
      console.warn('[AdaptiveAdjuster] Failed to load active version:', e);
    }
  }
  
  // ===========================================================================
  // 核心接口
  // ===========================================================================
  
  /**
   * 更新训练统计并调整超参数
   */
  adapt(stats: TrainingStats, avgReward: number): AdaptationResult {
    this.step++;
    
    // 更新性能跟踪
    this.updatePerformance(stats, avgReward);
    
    // 根据策略调整参数
    let result: AdaptationResult;
    
    switch (this.config.strategy) {
      case AdaptationStrategy.LINEAR_DECAY:
        result = this.linearDecayAdapt(stats);
        break;
      case AdaptationStrategy.COSINE_ANNEALING:
        result = this.cosineAnnealingAdapt(stats);
        break;
      case AdaptationStrategy.PERFORMANCE_BASED:
        result = this.performanceBasedAdapt(stats);
        break;
      case AdaptationStrategy.KL_ADAPTIVE:
        result = this.klAdaptiveAdapt(stats);
        break;
      case AdaptationStrategy.HYBRID:
      default:
        result = this.hybridAdapt(stats);
        break;
    }
    
    // 记录调整历史
    if (result.adapted) {
      this.recordAdaptation(result);
      
      // 异步保存版本
      this.saveVersionIfNeeded(result, stats, avgReward);
    }
    
    // 异步保存训练历史
    this.saveTrainingHistory(stats, avgReward);
    
    return result;
  }
  
  /**
   * 按需保存版本（每10次调整或有显著改进时保存）
   */
  private async saveVersionIfNeeded(
    result: AdaptationResult, 
    stats: TrainingStats, 
    avgReward: number
  ): Promise<void> {
    if (!this.enablePersistence) return;
    
    // 判断是否需要保存版本
    const shouldSave = 
      this.history.length % 10 === 0 || // 每10次调整保存一次
      avgReward > this.performance.bestReward * 1.1 || // 有显著改进
      result.reason === '策略崩溃恢复'; // 策略崩溃恢复
    
    if (shouldSave) {
      try {
        const perfStats = this.getPerformanceStats();
        await this.persistence.saveVersion({
          config: this.currentParams,
          performance: {
            avgReward: perfStats.avgReward,
            avgLoss: perfStats.avgLoss,
            avgKl: perfStats.avgKl,
            trend: perfStats.trend,
            sampleCount: this.performance.rewards.length,
          },
          source: 'auto',
          tags: [this.config.strategy, result.reason.replace(/\s/g, '_')],
          notes: result.recommendations.join('; '),
        });
      } catch (e) {
        console.warn('[AdaptiveAdjuster] Failed to save version:', e);
      }
    }
  }
  
  /**
   * 保存训练历史
   */
  private async saveTrainingHistory(stats: TrainingStats, avgReward: number): Promise<void> {
    if (!this.enablePersistence) return;
    
    try {
      await this.persistence.saveTrainingHistory({
        sessionId: this.sessionId,
        epoch: this.step,
        hyperparams: this.currentParams,
        metrics: {
          ...stats,
          avgReward,
        },
      });
    } catch (e) {
      // 静默失败，不影响训练流程
    }
  }
  
  /**
   * 获取当前超参数
   */
  getCurrentParams(): CurrentHyperparams {
    return { ...this.currentParams };
  }
  
  /**
   * 获取调整历史
   */
  getHistory(): AdaptationHistory[] {
    return [...this.history];
  }
  
  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    avgReward: number;
    avgLoss: number;
    avgKl: number;
    avgEntropy: number;
    trend: 'improving' | 'stable' | 'degrading';
    shouldStop: boolean;
  } {
    const window = this.config.performanceWindow;
    const recentRewards = this.performance.rewards.slice(-window);
    const recentLosses = this.performance.losses.slice(-window);
    const recentKls = this.performance.klDivergences.slice(-window);
    const recentEntropies = this.performance.entropies.slice(-window);
    
    const avgReward = this.average(recentRewards);
    const avgLoss = this.average(recentLosses);
    const avgKl = this.average(recentKls);
    const avgEntropy = this.average(recentEntropies);
    
    // 计算趋势
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentRewards.length >= 5) {
      const firstHalf = this.average(recentRewards.slice(0, Math.floor(recentRewards.length / 2)));
      const secondHalf = this.average(recentRewards.slice(Math.floor(recentRewards.length / 2)));
      
      if (secondHalf > firstHalf + this.config.minImprovement) {
        trend = 'improving';
      } else if (secondHalf < firstHalf - this.config.minImprovement) {
        trend = 'degrading';
      }
    }
    
    // 判断是否应该早停
    const shouldStop = this.performance.epochsSinceImprovement >= this.config.earlyStoppingPatience;
    
    return {
      avgReward,
      avgLoss,
      avgKl,
      avgEntropy,
      trend,
      shouldStop
    };
  }
  
  /**
   * 重置调整器
   */
  reset(): void {
    this.currentParams = {
      learningRate: this.config.learningRate.initial,
      clipEpsilon: this.config.clipEpsilon.initial,
      entropyCoef: this.config.entropyCoef.initial,
      gaeLambda: this.config.gaeLambda.initial,
      timestamp: Date.now()
    };
    
    this.performance = {
      rewards: [],
      losses: [],
      klDivergences: [],
      entropies: [],
      bestReward: -Infinity,
      bestEpoch: 0,
      epochsSinceImprovement: 0
    };
    
    this.history = [];
    this.step = 0;
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  // ===========================================================================
  // 持久化相关方法
  // ===========================================================================
  
  /**
   * 获取会话ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
  
  /**
   * 从指定版本加载配置
   */
  async loadVersion(versionId: string): Promise<boolean> {
    if (!this.enablePersistence) return false;
    
    try {
      const versions = await this.persistence.getVersions({ includeInactive: true });
      const version = versions.find(v => v.id === versionId);
      
      if (version) {
        this.currentParams = {
          learningRate: version.config.learningRate,
          clipEpsilon: version.config.clipEpsilon,
          entropyCoef: version.config.entropyCoef,
          gaeLambda: version.config.gaeLambda,
          timestamp: Date.now(),
        };
        this.lastSavedVersion = version.version;
        console.log(`[AdaptiveAdjuster] Loaded version ${version.version}`);
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('[AdaptiveAdjuster] Failed to load version:', e);
      return false;
    }
  }
  
  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(versionId: string): Promise<boolean> {
    if (!this.enablePersistence) return false;
    
    try {
      const newVersion = await this.persistence.rollbackToVersion(versionId);
      
      if (newVersion) {
        this.currentParams = {
          learningRate: newVersion.config.learningRate,
          clipEpsilon: newVersion.config.clipEpsilon,
          entropyCoef: newVersion.config.entropyCoef,
          gaeLambda: newVersion.config.gaeLambda,
          timestamp: Date.now(),
        };
        this.lastSavedVersion = newVersion.version;
        console.log(`[AdaptiveAdjuster] Rolled back to version ${newVersion.version}`);
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('[AdaptiveAdjuster] Failed to rollback:', e);
      return false;
    }
  }
  
  /**
   * 获取所有版本
   */
  async getVersions(options: { limit?: number; tags?: string[] } = {}): Promise<{
    id: string;
    version: number;
    config: CurrentHyperparams;
    performance?: {
      avgReward: number;
      trend: string;
    };
    isActive: boolean;
    isVerified: boolean;
    source: string;
    createdAt: string;
    tags: string[];
  }[]> {
    if (!this.enablePersistence) return [];
    
    try {
      const versions = await this.persistence.getVersions({
        limit: options.limit || 20,
        includeInactive: true,
        tags: options.tags,
      });
      
      return versions.map(v => ({
        id: v.id,
        version: v.version,
        config: {
          learningRate: v.config.learningRate,
          clipEpsilon: v.config.clipEpsilon,
          entropyCoef: v.config.entropyCoef,
          gaeLambda: v.config.gaeLambda,
          timestamp: new Date(v.created_at).getTime(),
        },
        performance: v.performance ? {
          avgReward: v.performance.avgReward,
          trend: v.performance.trend,
        } : undefined,
        isActive: v.is_active,
        isVerified: v.is_verified,
        source: v.source,
        createdAt: v.created_at,
        tags: v.tags,
      }));
    } catch (e) {
      console.error('[AdaptiveAdjuster] Failed to get versions:', e);
      return [];
    }
  }
  
  /**
   * 手动保存当前配置为新版本
   */
  async saveCurrentVersion(options: {
    tags?: string[];
    notes?: string;
    createdBy?: string;
  } = {}): Promise<string | null> {
    if (!this.enablePersistence) return null;
    
    try {
      const perfStats = this.getPerformanceStats();
      const version = await this.persistence.saveVersion({
        config: this.currentParams,
        performance: {
          avgReward: perfStats.avgReward,
          avgLoss: perfStats.avgLoss,
          avgKl: perfStats.avgKl,
          trend: perfStats.trend,
          sampleCount: this.performance.rewards.length,
        },
        source: 'manual',
        tags: options.tags || [],
        notes: options.notes,
        createdBy: options.createdBy || 'user',
      });
      
      if (version) {
        this.lastSavedVersion = version.version;
        console.log(`[AdaptiveAdjuster] Saved version ${version.version}`);
        return version.id;
      }
      
      return null;
    } catch (e) {
      console.error('[AdaptiveAdjuster] Failed to save version:', e);
      return null;
    }
  }
  
  /**
   * 激活指定版本
   */
  async activateVersion(versionId: string): Promise<boolean> {
    if (!this.enablePersistence) return false;
    
    try {
      const success = await this.persistence.activateVersion(versionId);
      
      if (success) {
        // 重新加载激活版本
        await this.loadActiveVersion();
      }
      
      return success;
    } catch (e) {
      console.error('[AdaptiveAdjuster] Failed to activate version:', e);
      return false;
    }
  }
  
  /**
   * 获取训练历史
   */
  async getTrainingHistory(options: { limit?: number } = {}): Promise<{
    epoch: number;
    hyperparams: CurrentHyperparams;
    metrics: {
      avgReward: number;
      klDivergence: number;
      policyLoss: number;
    };
    createdAt: string;
  }[]> {
    if (!this.enablePersistence) return [];
    
    try {
      const history = await this.persistence.getTrainingHistory({
        sessionId: this.sessionId,
        limit: options.limit || 50,
      });
      
      return history.map(h => ({
        epoch: h.epoch,
        hyperparams: {
          learningRate: h.hyperparams.learningRate,
          clipEpsilon: h.hyperparams.clipEpsilon,
          entropyCoef: h.hyperparams.entropyCoef,
          gaeLambda: h.hyperparams.gaeLambda,
          timestamp: new Date(h.created_at).getTime(),
        },
        metrics: {
          avgReward: h.metrics.avgReward,
          klDivergence: h.metrics.klDivergence,
          policyLoss: h.metrics.policyLoss,
        },
        createdAt: h.created_at,
      }));
    } catch (e) {
      console.error('[AdaptiveAdjuster] Failed to get training history:', e);
      return [];
    }
  }
  
  /**
   * 导出状态
   */
  async exportState(): Promise<{
    currentParams: CurrentHyperparams;
    history: AdaptationHistory[];
    performance: PerformanceTracker;
    versions: any[];
    trainingHistory: any[];
  }> {
    const versions = await this.getVersions({ limit: 50 });
    const trainingHistory = await this.getTrainingHistory({ limit: 100 });
    
    return {
      currentParams: this.currentParams,
      history: this.history,
      performance: this.performance,
      versions,
      trainingHistory,
    };
  }
  
  // ===========================================================================
  // 调整策略
  // ===========================================================================
  
  /**
   * 线性衰减策略
   */
  private linearDecayAdapt(stats: TrainingStats): AdaptationResult {
    const recommendations: string[] = [];
    let adapted = false;
    const reason = '线性衰减策略';
    
    // 学习率线性衰减
    const decayFactor = Math.pow(
      this.config.learningRate.decayRate,
      Math.floor(this.step / 100)
    );
    
    const newLr = Math.max(
      this.config.learningRate.min,
      this.currentParams.learningRate * decayFactor
    );
    
    if (newLr !== this.currentParams.learningRate) {
      this.currentParams.learningRate = newLr;
      adapted = true;
      recommendations.push(`学习率衰减至 ${newLr.toExponential(2)}`);
    }
    
    return {
      params: this.getCurrentParams(),
      adapted,
      reason,
      recommendations
    };
  }
  
  /**
   * 余弦退火策略
   */
  private cosineAnnealingAdapt(stats: TrainingStats): AdaptationResult {
    const recommendations: string[] = [];
    let adapted = false;
    const reason = '余弦退火策略';
    
    const totalSteps = 1000;  // 一个周期的总步数
    const progress = (this.step % totalSteps) / totalSteps;
    
    // 余弦退火公式
    const cosineFactor = 0.5 * (1 + Math.cos(Math.PI * progress));
    
    // 调整学习率
    const newLr = this.config.learningRate.min +
      (this.config.learningRate.max - this.config.learningRate.min) * cosineFactor;
    
    if (Math.abs(newLr - this.currentParams.learningRate) > 1e-7) {
      this.currentParams.learningRate = newLr;
      adapted = true;
      recommendations.push(`学习率退火至 ${newLr.toExponential(2)}`);
    }
    
    return {
      params: this.getCurrentParams(),
      adapted,
      reason,
      recommendations
    };
  }
  
  /**
   * 性能驱动策略
   */
  private performanceBasedAdapt(stats: TrainingStats): AdaptationResult {
    const recommendations: string[] = [];
    let adapted = false;
    const reason = '性能驱动策略';
    
    // 如果性能没有改进，降低学习率
    if (this.performance.epochsSinceImprovement >= this.config.learningRate.patience) {
      const newLr = Math.max(
        this.config.learningRate.min,
        this.currentParams.learningRate * this.config.learningRate.factor
      );
      
      if (newLr < this.currentParams.learningRate) {
        this.currentParams.learningRate = newLr;
        adapted = true;
        recommendations.push(`性能未改进，降低学习率至 ${newLr.toExponential(2)}`);
        
        // 重置计数器
        this.performance.epochsSinceImprovement = 0;
      }
    }
    
    // 如果损失增加，降低裁剪参数
    if (stats.policyLoss > this.average(this.performance.losses.slice(-5)) * 1.5) {
      const newClip = Math.max(
        this.config.clipEpsilon.min,
        this.currentParams.clipEpsilon * 0.9
      );
      
      this.currentParams.clipEpsilon = newClip;
      adapted = true;
      recommendations.push(`策略损失增加，降低裁剪参数至 ${newClip.toFixed(3)}`);
    }
    
    return {
      params: this.getCurrentParams(),
      adapted,
      reason,
      recommendations
    };
  }
  
  /**
   * KL散度自适应策略
   */
  private klAdaptiveAdapt(stats: TrainingStats): AdaptationResult {
    const recommendations: string[] = [];
    let adapted = false;
    const reason = 'KL散度自适应策略';
    
    const targetKl = this.config.clipEpsilon.targetKl;
    const currentKl = stats.klDivergence;
    
    // 根据KL散度调整裁剪参数
    if (this.config.clipEpsilon.adaptOnKl) {
      if (currentKl > targetKl * 2) {
        // KL散度过大，策略更新太激进，减小裁剪参数
        const newClip = Math.max(
          this.config.clipEpsilon.min,
          this.currentParams.clipEpsilon * 0.8
        );
        
        this.currentParams.clipEpsilon = newClip;
        adapted = true;
        recommendations.push(`KL散度过大(${currentKl.toFixed(4)})，减小裁剪参数至 ${newClip.toFixed(3)}`);
      } else if (currentKl < targetKl * 0.5) {
        // KL散度过小，可以更激进地更新，增大裁剪参数
        const newClip = Math.min(
          this.config.clipEpsilon.max,
          this.currentParams.clipEpsilon * 1.1
        );
        
        this.currentParams.clipEpsilon = newClip;
        adapted = true;
        recommendations.push(`KL散度过小(${currentKl.toFixed(4)})，增大裁剪参数至 ${newClip.toFixed(3)}`);
      }
    }
    
    // 根据熵值调整熵系数
    if (this.config.entropyCoef.adaptOnEntropy) {
      const targetEntropy = this.config.entropyCoef.targetEntropy;
      const currentEntropy = stats.entropy;
      
      if (currentEntropy < targetEntropy * 0.8) {
        // 熵过低，策略过于确定性，增大熵系数
        const newEntropyCoef = Math.min(
          this.config.entropyCoef.max,
          this.currentParams.entropyCoef * 1.2
        );
        
        this.currentParams.entropyCoef = newEntropyCoef;
        adapted = true;
        recommendations.push(`熵过低(${currentEntropy.toFixed(4)})，增大熵系数至 ${newEntropyCoef.toFixed(4)}`);
      } else if (currentEntropy > targetEntropy * 1.2) {
        // 熵过高，策略过于随机，减小熵系数
        const newEntropyCoef = Math.max(
          this.config.entropyCoef.min,
          this.currentParams.entropyCoef * 0.9
        );
        
        this.currentParams.entropyCoef = newEntropyCoef;
        adapted = true;
        recommendations.push(`熵过高(${currentEntropy.toFixed(4)})，减小熵系数至 ${newEntropyCoef.toFixed(4)}`);
      }
    }
    
    return {
      params: this.getCurrentParams(),
      adapted,
      reason,
      recommendations
    };
  }
  
  /**
   * 混合策略（推荐）
   */
  private hybridAdapt(stats: TrainingStats): AdaptationResult {
    const recommendations: string[] = [];
    let adapted = false;
    let reason = '混合策略';
    
    // 1. 预热阶段：线性增加学习率
    if (this.step <= this.config.learningRate.warmupSteps) {
      const warmupProgress = this.step / this.config.learningRate.warmupSteps;
      const targetLr = this.config.learningRate.initial;
      const newLr = targetLr * warmupProgress;
      
      this.currentParams.learningRate = newLr;
      adapted = true;
      reason = '预热阶段';
      recommendations.push(`预热阶段：学习率增加至 ${newLr.toExponential(2)}`);
    }
    
    // 2. KL散度自适应调整裁剪参数
    const klResult = this.klAdaptiveAdapt(stats);
    if (klResult.adapted) {
      adapted = true;
      recommendations.push(...klResult.recommendations);
    }
    
    // 3. 性能驱动调整学习率
    const perfResult = this.performanceBasedAdapt(stats);
    if (perfResult.adapted) {
      adapted = true;
      recommendations.push(...perfResult.recommendations);
    }
    
    // 4. 动态调整GAE Lambda
    if (this.performance.rewards.length >= 10) {
      const recentVariance = this.variance(this.performance.rewards.slice(-10));
      
      // 如果奖励方差大，降低lambda以减少方差
      if (recentVariance > 1.0) {
        const newLambda = Math.max(
          this.config.gaeLambda.min,
          this.currentParams.gaeLambda - 0.01
        );
        
        if (newLambda !== this.currentParams.gaeLambda) {
          this.currentParams.gaeLambda = newLambda;
          adapted = true;
          recommendations.push(`奖励方差大(${recentVariance.toFixed(2)})，降低GAE Lambda至 ${newLambda.toFixed(2)}`);
        }
      }
    }
    
    // 5. 策略崩溃检测
    if (stats.klDivergence > 0.1 || stats.policyLoss > 10) {
      // 策略可能崩溃，回滚参数
      this.currentParams.learningRate = this.config.learningRate.initial;
      this.currentParams.clipEpsilon = this.config.clipEpsilon.min;
      this.currentParams.entropyCoef = this.config.entropyCoef.initial;
      
      adapted = true;
      reason = '策略崩溃恢复';
      recommendations.push('检测到策略崩溃风险，重置超参数到安全值');
    }
    
    return {
      params: this.getCurrentParams(),
      adapted,
      reason,
      recommendations
    };
  }
  
  // ===========================================================================
  // 辅助方法
  // ===========================================================================
  
  /**
   * 更新性能跟踪数据
   */
  private updatePerformance(stats: TrainingStats, avgReward: number): void {
    this.performance.rewards.push(avgReward);
    this.performance.losses.push(stats.totalLoss);
    this.performance.klDivergences.push(stats.klDivergence);
    this.performance.entropies.push(stats.entropy);
    
    // 保持窗口大小
    const maxSize = this.config.performanceWindow * 3;
    if (this.performance.rewards.length > maxSize) {
      this.performance.rewards = this.performance.rewards.slice(-maxSize);
      this.performance.losses = this.performance.losses.slice(-maxSize);
      this.performance.klDivergences = this.performance.klDivergences.slice(-maxSize);
      this.performance.entropies = this.performance.entropies.slice(-maxSize);
    }
    
    // 更新最佳奖励
    if (avgReward > this.performance.bestReward + this.config.minImprovement) {
      this.performance.bestReward = avgReward;
      this.performance.bestEpoch = this.step;
      this.performance.epochsSinceImprovement = 0;
    } else {
      this.performance.epochsSinceImprovement++;
    }
  }
  
  /**
   * 记录调整历史
   */
  private recordAdaptation(result: AdaptationResult): void {
    this.history.push({
      epoch: this.step,
      oldParams: { ...this.currentParams, timestamp: Date.now() },
      newParams: result.params,
      reason: result.reason,
      performanceImprovement: this.performance.rewards.length >= 2
        ? this.performance.rewards[this.performance.rewards.length - 1] -
          this.performance.rewards[this.performance.rewards.length - 2]
        : 0,
      timestamp: Date.now()
    });
    
    // 保持历史记录在合理范围
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }
  
  /**
   * 计算平均值
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  /**
   * 计算方差
   */
  private variance(arr: number[]): number {
    if (arr.length === 0) return 0;
    const avg = this.average(arr);
    return this.average(arr.map(x => (x - avg) ** 2));
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let adjusterInstance: AdaptiveHyperparamAdjuster | null = null;

/**
 * 获取自适应调整器实例
 */
export function getAdaptiveAdjuster(
  config?: Partial<AdaptiveHyperparamConfig>,
  enablePersistence: boolean = true
): AdaptiveHyperparamAdjuster {
  if (!adjusterInstance) {
    adjusterInstance = new AdaptiveHyperparamAdjuster(config, enablePersistence);
  }
  return adjusterInstance;
}

/**
 * 重置自适应调整器
 */
export function resetAdaptiveAdjuster(): void {
  if (adjusterInstance) {
    adjusterInstance.reset();
  }
  adjusterInstance = null;
}

/**
 * 获取持久化服务实例
 */
export function getPPOPersistenceService(): PPOPersistenceService {
  return getPPOPersistence();
}
