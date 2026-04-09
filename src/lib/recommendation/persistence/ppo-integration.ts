/**
 * PPO 持久化与反馈循环集成模块
 * 
 * 功能：
 * 1. 将 PPO 超参数优化与 AdaptiveOptimizerAgent 集成
 * 2. 实现定期评估超参数效果
 * 3. 自动触发优化建议
 * 4. 与 FeedbackLoopManager 协同工作
 */

import type { AdaptiveOptimizerAgent } from '../adaptive-optimizer';
import type {
  PPOHyperparamVersionRecord,
  PPOTrainingHistoryRecord,
  PPOHyperparamKnowledgeRecord,
} from './types';

// 训练历史项类型（从 adaptive-hyperparams 返回的类型）
interface TrainingHistoryItem {
  epoch: number;
  hyperparams: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
    timestamp: number;
  };
  metrics: {
    avgReward: number;
    klDivergence: number;
    policyLoss: number;
  };
  createdAt: string;
}

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 超参数评估结果
 */
export interface HyperparamEvaluationResult {
  // 当前配置评估
  currentConfig: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
  };
  
  // 性能指标
  performance: {
    avgReward: number;
    avgLoss: number;
    avgKl: number;
    trend: 'improving' | 'stable' | 'degrading';
    stability: number;
  };
  
  // 评估结论
  assessment: {
    score: number;           // 综合得分 0-100
    issues: string[];        // 发现的问题
    recommendations: string[];
  };
  
  // 是否建议更新
  shouldUpdate: boolean;
  
  // 建议的新配置
  suggestedConfig?: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
    reason: string;
  };
  
  // 时间戳
  timestamp: string;
}

/**
 * 超参数效果追踪记录
 */
export interface HyperparamEffectRecord {
  versionId: string;
  configId: string;
  
  // 使用时长
  usageDuration: number;     // 毫秒
  
  // 效果指标
  metrics: {
    totalSamples: number;
    avgReward: number;
    avgLoss: number;
    convergenceRate: number;
    stability: number;
  };
  
  // 用户反馈
  feedback: {
    positive: number;
    negative: number;
    neutral: number;
  };
  
  // 时间戳
  startTime: string;
  endTime: string;
}

/**
 * 反馈循环集成配置
 */
export interface FeedbackLoopIntegrationConfig {
  // 评估触发条件
  minSamplesForEvaluation: number;     // 最小样本数
  evaluationIntervalMs: number;        // 评估间隔
  
  // 自动优化
  autoOptimize: boolean;               // 是否自动应用优化
  autoSaveVersion: boolean;            // 是否自动保存版本
  
  // 阈值
  rewardThreshold: number;             // 奖励阈值
  klThreshold: number;                 // KL散度阈值
  stabilityThreshold: number;          // 稳定性阈值
  
  // A/B 测试
  enableABTesting: boolean;            // 是否启用 A/B 测试
  abTestMinSamples: number;            // A/B 测试最小样本数
}

/**
 * 默认配置
 */
export const DEFAULT_FEEDBACK_LOOP_CONFIG: FeedbackLoopIntegrationConfig = {
  minSamplesForEvaluation: 100,
  evaluationIntervalMs: 3600000,  // 1小时
  autoOptimize: false,
  autoSaveVersion: true,
  rewardThreshold: 0.5,
  klThreshold: 0.1,
  stabilityThreshold: 0.7,
  enableABTesting: true,
  abTestMinSamples: 256,
};

// ============================================================================
// PPO 反馈循环集成服务
// ============================================================================

/**
 * PPO 反馈循环集成服务
 */
export class PPOFeedbackLoopIntegration {
  private config: FeedbackLoopIntegrationConfig;
  private lastEvaluationTime: number = 0;
  private effectRecords: HyperparamEffectRecord[] = [];
  private currentEffectStart: number = Date.now();
  
  constructor(config: Partial<FeedbackLoopIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_FEEDBACK_LOOP_CONFIG, ...config };
  }

  // ===========================================================================
  // 核心接口
  // ===========================================================================

  /**
   * 评估当前超参数效果
   */
  async evaluateHyperparams(options: {
    ppoOptimizer: any;  // PPOOptimizer
    adaptiveOptimizer?: AdaptiveOptimizerAgent;
    trainingHistory?: TrainingHistoryItem[];
  }): Promise<HyperparamEvaluationResult> {
    const { ppoOptimizer, adaptiveOptimizer, trainingHistory = [] } = options;
    
    // 获取当前配置和性能
    const currentConfig = ppoOptimizer.getCurrentHyperparams();
    const performanceStats = ppoOptimizer.getPerformanceStats();
    
    // 分析性能趋势
    const recentHistory = trainingHistory.slice(-50);
    const trend = this.analyzeTrend(recentHistory);
    const stability = this.calculateStability(recentHistory);
    
    // 识别问题
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 检查 KL 散度
    if (performanceStats.avgKl > this.config.klThreshold) {
      issues.push(`KL散度过高 (${performanceStats.avgKl.toFixed(4)})，策略更新可能过于激进`);
      recommendations.push('考虑降低学习率或减小裁剪参数');
    }
    
    // 检查奖励趋势
    if (trend === 'degrading') {
      issues.push('性能呈下降趋势');
      recommendations.push('检查是否过拟合，考虑回滚到历史版本');
    }
    
    // 检查稳定性
    if (stability < this.config.stabilityThreshold) {
      issues.push(`训练稳定性不足 (${stability.toFixed(2)})`);
      recommendations.push('考虑增加训练批次大小或调整熵系数');
    }
    
    // 计算综合得分
    let score = 100;
    score -= issues.length * 15;
    score -= Math.max(0, (performanceStats.avgKl - 0.05) * 200);
    score = Math.max(0, Math.min(100, score));
    
    // 生成建议配置
    let suggestedConfig: HyperparamEvaluationResult['suggestedConfig'];
    let shouldUpdate = false;
    
    if (issues.length > 0 && score < 70) {
      shouldUpdate = true;
      suggestedConfig = this.generateSuggestedConfig(
        currentConfig,
        performanceStats,
        trend,
        stability
      );
    }
    
    return {
      currentConfig,
      performance: {
        avgReward: performanceStats.avgReward,
        avgLoss: performanceStats.avgLoss,
        avgKl: performanceStats.avgKl,
        trend,
        stability,
      },
      assessment: {
        score,
        issues,
        recommendations,
      },
      shouldUpdate,
      suggestedConfig,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 应用优化建议
   */
  async applyOptimization(options: {
    ppoOptimizer: any;
    suggestedConfig: NonNullable<HyperparamEvaluationResult['suggestedConfig']>;
    saveVersion?: boolean;
  }): Promise<{
    success: boolean;
    versionId?: string;
    message: string;
  }> {
    const { ppoOptimizer, suggestedConfig, saveVersion = true } = options;
    
    try {
      // 应用新配置
      ppoOptimizer.updateHyperparams({
        learningRate: suggestedConfig.learningRate,
        clipEpsilon: suggestedConfig.clipEpsilon,
        entropyCoef: suggestedConfig.entropyCoef,
        gaeLambda: suggestedConfig.gaeLambda,
      });
      
      let versionId: string | undefined;
      
      // 保存版本
      if (saveVersion && this.config.autoSaveVersion) {
        const { getPPOPersistenceService } = await import('../ppo/adaptive-hyperparams');
        const persistence = getPPOPersistenceService();
        
        const version = await persistence.saveVersion({
          config: {
            learningRate: suggestedConfig.learningRate,
            clipEpsilon: suggestedConfig.clipEpsilon,
            entropyCoef: suggestedConfig.entropyCoef,
            gaeLambda: suggestedConfig.gaeLambda,
            timestamp: Date.now(),
          },
          performance: {
            avgReward: 0,
            avgLoss: 0,
            avgKl: 0,
            trend: 'stable',
            sampleCount: 0,
          },
          source: 'auto',
          tags: ['auto-optimized'],
          notes: suggestedConfig.reason,
          createdBy: 'feedback-loop',
        });
        
        if (version) {
          versionId = version.id;
        }
      }
      
      return {
        success: true,
        versionId,
        message: `已应用优化配置：${suggestedConfig.reason}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `应用优化失败：${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 触发定期评估
   */
  async triggerPeriodicEvaluation(options: {
    ppoOptimizer: any;
    adaptiveOptimizer?: AdaptiveOptimizerAgent;
  }): Promise<HyperparamEvaluationResult | null> {
    const now = Date.now();
    
    // 检查是否满足评估条件
    if (now - this.lastEvaluationTime < this.config.evaluationIntervalMs) {
      return null;
    }
    
    // 获取训练历史
    const { getPPOPersistenceService } = await import('../ppo/adaptive-hyperparams');
    const persistence = getPPOPersistenceService();
    const rawHistory = await persistence.getTrainingHistory({ limit: 100 });
    
    if (rawHistory.length < this.config.minSamplesForEvaluation) {
      return null;
    }
    
    // 转换为 TrainingHistoryItem 格式
    const history: TrainingHistoryItem[] = rawHistory.map(h => ({
      epoch: h.epoch,
      hyperparams: {
        learningRate: h.hyperparams.learningRate,
        clipEpsilon: h.hyperparams.clipEpsilon,
        entropyCoef: h.hyperparams.entropyCoef,
        gaeLambda: h.hyperparams.gaeLambda,
        timestamp: Date.now(),
      },
      metrics: {
        avgReward: h.metrics.avgReward,
        klDivergence: h.metrics.klDivergence,
        policyLoss: h.metrics.policyLoss,
      },
      createdAt: h.created_at,
    }));
    
    // 执行评估
    const evaluation = await this.evaluateHyperparams({
      ...options,
      trainingHistory: history,
    });
    
    this.lastEvaluationTime = now;
    
    // 自动应用优化
    if (evaluation.shouldUpdate && this.config.autoOptimize && evaluation.suggestedConfig) {
      await this.applyOptimization({
        ppoOptimizer: options.ppoOptimizer,
        suggestedConfig: evaluation.suggestedConfig,
      });
    }
    
    return evaluation;
  }

  // ===========================================================================
  // A/B 测试集成
  // ===========================================================================

  /**
   * 创建超参数 A/B 测试
   */
  async createABTest(options: {
    name: string;
    variantA: {
      learningRate: number;
      clipEpsilon: number;
      entropyCoef: number;
      gaeLambda: number;
    };
    variantB: {
      learningRate: number;
      clipEpsilon: number;
      entropyCoef: number;
      gaeLambda: number;
    };
    description?: string;
  }): Promise<{ experimentId: string } | null> {
    if (!this.config.enableABTesting) {
      console.warn('[PPOIntegration] A/B testing is disabled');
      return null;
    }
    
    const { getPPOABTestingManager } = await import('./ab-testing');
    const abTesting = getPPOABTestingManager();
    
    const experiment = await abTesting.createHyperparamExperiment({
      name: options.name,
      description: options.description,
      variantA: {
        name: 'Variant A',
        hyperparams: options.variantA,
        source: 'manual',
      },
      variantB: {
        name: 'Variant B',
        hyperparams: options.variantB,
        source: 'manual',
      },
    });
    
    if (!experiment) {
      return null;
    }
    
    return { experimentId: experiment.id };
  }

  /**
   * 分析 A/B 测试并应用优胜配置
   */
  async analyzeABTestAndApply(options: {
    experimentId: string;
    ppoOptimizer: any;
    autoApply?: boolean;
  }): Promise<{
    winner: 'A' | 'B' | 'inconclusive';
    applied: boolean;
    result?: any;
  }> {
    const { experimentId, ppoOptimizer, autoApply = false } = options;
    
    const { getPPOABTestingManager } = await import('./ab-testing');
    const abTesting = getPPOABTestingManager();
    
    const result = await abTesting.analyzeExperiment(experimentId);
    
    if (!result || result.recommendation.winner === 'inconclusive') {
      return {
        winner: 'inconclusive',
        applied: false,
        result,
      };
    }
    
    const winner = result.recommendation.winner;
    const winningConfig = winner === 'A' 
      ? result.variantA.hyperparams 
      : result.variantB.hyperparams;
    
    if (autoApply || this.config.autoOptimize) {
      ppoOptimizer.updateHyperparams(winningConfig);
      
      // 保存优胜配置为新版本
      const { getPPOPersistenceService } = await import('../ppo/adaptive-hyperparams');
      const persistence = getPPOPersistenceService();
      
      await persistence.saveVersion({
        config: {
          ...winningConfig,
          timestamp: Date.now(),
        },
        performance: {
          avgReward: winner === 'A' 
            ? result.variantA.metrics.avgReward 
            : result.variantB.metrics.avgReward,
          avgLoss: 0,
          avgKl: 0,
          trend: 'stable',
          sampleCount: winner === 'A' 
            ? result.variantA.metrics.sampleCount 
            : result.variantB.metrics.sampleCount,
        },
        source: 'auto',
        tags: ['ab-test-winner', `experiment-${experimentId}`],
        notes: `A/B测试 ${experimentId} 优胜配置`,
        createdBy: 'feedback-loop',
      });
      
      return {
        winner,
        applied: true,
        result,
      };
    }
    
    return {
      winner,
      applied: false,
      result,
    };
  }

  // ===========================================================================
  // 知识库集成
  // ===========================================================================

  /**
   * 从训练历史提取知识
   */
  async extractKnowledgeFromHistory(options: {
    minSamples?: number;
  } = {}): Promise<PPOHyperparamKnowledgeRecord[]> {
    const { minSamples = 50 } = options;
    
    const { getPPOPersistenceService } = await import('../ppo/adaptive-hyperparams');
    const persistence = getPPOPersistenceService();
    
    const rawHistory = await persistence.getTrainingHistory({ limit: 1000 });
    
    if (rawHistory.length < minSamples) {
      return [];
    }
    
    const knowledgeRecords: PPOHyperparamKnowledgeRecord[] = [];
    
    // 分析学习率与奖励的关系
    const learningRates = rawHistory.map(h => h.hyperparams.learningRate);
    const avgRewards = rawHistory.map(h => h.metrics.avgReward);
    const lrRewardCorrelation = this.calculateCorrelation(learningRates, avgRewards);
    
    if (Math.abs(lrRewardCorrelation) > 0.3) {
      knowledgeRecords.push({
        id: `knowledge_lr_reward_${Date.now()}`,
        knowledge_type: 'correlation',
        param_name: 'learningRate',
        knowledge: {
          description: `学习率与奖励呈 ${lrRewardCorrelation > 0 ? '正' : '负'}相关`,
          value: lrRewardCorrelation,
          related_params: ['avgReward'],
        },
        confidence: Math.abs(lrRewardCorrelation),
        sample_count: rawHistory.length,
        success_count: Math.floor(rawHistory.length * Math.abs(lrRewardCorrelation)),
        source: 'learned',
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }
    
    // 分析熵系数与稳定性的关系
    const entropyStabilityData = rawHistory.map(h => ({
      entropy: h.hyperparams.entropyCoef,
      stability: Math.abs(h.metrics.klDivergence),
    }));
    
    // 保存知识到数据库
    for (const record of knowledgeRecords) {
      await persistence.saveKnowledge({
        knowledgeType: record.knowledge_type as 'correlation' | 'pattern' | 'constraint' | 'best_practice',
        paramName: record.param_name,
        knowledge: record.knowledge,
        confidence: record.confidence,
        source: record.source as 'learned' | 'expert' | 'literature',
      });
    }
    
    return knowledgeRecords;
  }

  // ===========================================================================
  // 效果追踪
  // ===========================================================================

  /**
   * 开始追踪当前配置效果
   */
  startEffectTracking(): void {
    this.currentEffectStart = Date.now();
  }

  /**
   * 记录效果
   */
  async recordEffect(options: {
    versionId: string;
    metrics: HyperparamEffectRecord['metrics'];
    feedback: HyperparamEffectRecord['feedback'];
  }): Promise<void> {
    const record: HyperparamEffectRecord = {
      versionId: options.versionId,
      configId: `config_${Date.now()}`,
      usageDuration: Date.now() - this.currentEffectStart,
      metrics: options.metrics,
      feedback: options.feedback,
      startTime: new Date(this.currentEffectStart).toISOString(),
      endTime: new Date().toISOString(),
    };
    
    this.effectRecords.push(record);
    
    // 只保留最近 100 条
    if (this.effectRecords.length > 100) {
      this.effectRecords = this.effectRecords.slice(-100);
    }
    
    // 重置计时器
    this.currentEffectStart = Date.now();
  }

  /**
   * 获取效果历史
   */
  getEffectHistory(): HyperparamEffectRecord[] {
    return [...this.effectRecords];
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 分析性能趋势
   */
  private analyzeTrend(history: TrainingHistoryItem[]): 'improving' | 'stable' | 'degrading' {
    if (history.length < 10) return 'stable';
    
    const rewards = history.map((h: TrainingHistoryItem) => h.metrics.avgReward);
    const firstHalf = rewards.slice(0, Math.floor(rewards.length / 2));
    const secondHalf = rewards.slice(Math.floor(rewards.length / 2));
    
    const firstAvg = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
    
    const improvement = (secondAvg - firstAvg) / Math.abs(firstAvg || 1);
    
    if (improvement > 0.05) return 'improving';
    if (improvement < -0.05) return 'degrading';
    return 'stable';
  }

  /**
   * 计算稳定性
   */
  private calculateStability(history: TrainingHistoryItem[]): number {
    if (history.length < 5) return 1;
    
    const rewards = history.map((h: TrainingHistoryItem) => h.metrics.avgReward);
    const mean = rewards.reduce((a: number, b: number) => a + b, 0) / rewards.length;
    const variance = rewards.reduce((sum: number, r: number) => sum + (r - mean) ** 2, 0) / rewards.length;
    const std = Math.sqrt(variance);
    
    // 变异系数的倒数作为稳定性指标
    return mean !== 0 ? 1 / (1 + std / Math.abs(mean)) : 0;
  }

  /**
   * 生成建议配置
   */
  private generateSuggestedConfig(
    currentConfig: { learningRate: number; clipEpsilon: number; entropyCoef: number; gaeLambda: number },
    performance: { avgReward: number; avgLoss: number; avgKl: number },
    trend: 'improving' | 'stable' | 'degrading',
    stability: number
  ): NonNullable<HyperparamEvaluationResult['suggestedConfig']> {
    let suggested = { ...currentConfig };
    const reasons: string[] = [];
    
    // 根据 KL 散度调整
    if (performance.avgKl > 0.1) {
      suggested.learningRate *= 0.7;
      suggested.clipEpsilon *= 0.8;
      reasons.push('降低学习率和裁剪参数以减小KL散度');
    }
    
    // 根据趋势调整
    if (trend === 'degrading') {
      suggested.entropyCoef *= 1.2;
      reasons.push('增加熵系数以鼓励探索');
    }
    
    // 根据稳定性调整
    if (stability < 0.7) {
      suggested.learningRate *= 0.8;
      reasons.push('降低学习率以提高稳定性');
    }
    
    // 确保参数在合理范围内
    suggested.learningRate = Math.max(1e-6, Math.min(1e-3, suggested.learningRate));
    suggested.clipEpsilon = Math.max(0.05, Math.min(0.3, suggested.clipEpsilon));
    suggested.entropyCoef = Math.max(0.001, Math.min(0.1, suggested.entropyCoef));
    suggested.gaeLambda = Math.max(0.9, Math.min(0.99, suggested.gaeLambda));
    
    return {
      ...suggested,
      reason: reasons.join('；') || '综合优化建议',
    };
  }

  /**
   * 计算相关系数
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
    
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }
    
    const denominator = Math.sqrt(sumX2 * sumY2);
    return denominator > 0 ? sumXY / denominator : 0;
  }
}

// ============================================================================
// 单例
// ============================================================================

let integrationInstance: PPOFeedbackLoopIntegration | null = null;

export function getPPOFeedbackLoopIntegration(
  config?: Partial<FeedbackLoopIntegrationConfig>
): PPOFeedbackLoopIntegration {
  if (!integrationInstance) {
    integrationInstance = new PPOFeedbackLoopIntegration(config);
  }
  return integrationInstance;
}

export default PPOFeedbackLoopIntegration;
