/**
 * 推荐状态编码器
 * 
 * 将推荐状态转换为固定维度的向量，供神经网络使用
 */

import {
  RecommendationState,
  StrategyWeights,
  PPOConfig,
  DEFAULT_PPO_CONFIG
} from './types';

// ============================================================================
// 状态编码器
// ============================================================================

/**
 * 状态编码器
 * 
 * 将复杂的推荐状态编码为固定维度的向量
 */
export class StateEncoder {
  private config: PPOConfig;
  private scenarioEncoder: Map<string, number>;
  
  constructor(config: PPOConfig = DEFAULT_PPO_CONFIG) {
    this.config = config;
    
    // 场景编码映射
    this.scenarioEncoder = new Map([
      ['product_recommendation', 0],
      ['content_recommendation', 0.125],
      ['service_recommendation', 0.25],
      ['risk_recommendation', 0.375],
      ['investment_recommendation', 0.5],
      ['travel_recommendation', 0.625],
      ['career_recommendation', 0.75],
      ['general_recommendation', 0.875]
    ]);
  }
  
  /**
   * 编码状态为向量
   */
  encode(state: RecommendationState): number[] {
    const features: number[] = [];
    
    // 1. 用户特征 (5维)
    features.push(
      this.normalize(state.userFeatures.activeLevel, 0, 1),
      this.normalize(state.userFeatures.diversityPreference, 0, 1),
      this.normalize(state.userFeatures.avgSessionLength, 0, 3600), // 假设最大1小时
      this.normalize(state.userFeatures.clickThroughRate, 0, 1),
      this.normalize(state.userFeatures.conversionRate, 0, 1)
    );
    
    // 2. 场景特征 (4维)
    features.push(
      this.encodeScenario(state.scenarioFeatures.scenarioType),
      this.normalize(state.scenarioFeatures.itemPoolSize, 0, 10000),
      this.normalize(state.scenarioFeatures.timeOfDay, 0, 24),
      this.normalize(state.scenarioFeatures.dayOfWeek, 0, 7)
    );
    
    // 3. 历史统计 (5维 + 策略表现)
    features.push(
      this.normalize(state.historyStats.recentCtr, 0, 1),
      this.normalize(state.historyStats.recentSatisfaction, 0, 5), // 1-5评分
      this.getStrategyPerformance(state.historyStats.strategyPerformance, 'content_based'),
      this.getStrategyPerformance(state.historyStats.strategyPerformance, 'collaborative'),
      this.getStrategyPerformance(state.historyStats.strategyPerformance, 'knowledge_based')
    );
    
    // 4. 当前配置 (9维)
    features.push(
      state.currentConfig.strategyWeights.content_based,
      state.currentConfig.strategyWeights.collaborative,
      state.currentConfig.strategyWeights.knowledge_based,
      state.currentConfig.strategyWeights.agent_based,
      state.currentConfig.strategyWeights.causal_based,
      state.currentConfig.diversityWeight,
      state.currentConfig.noveltyWeight,
      state.currentConfig.serendipityWeight,
      state.currentConfig.minScoreThreshold
    );
    
    // 5. 补充特征（填充到stateDim）
    const additionalStrategyPerf = [
      this.getStrategyPerformance(state.historyStats.strategyPerformance, 'agent_based'),
      this.getStrategyPerformance(state.historyStats.strategyPerformance, 'causal_based')
    ];
    features.push(...additionalStrategyPerf);
    
    // 6. 填充到指定维度
    while (features.length < this.config.stateDim) {
      features.push(0);
    }
    
    // 截断到指定维度
    return features.slice(0, this.config.stateDim);
  }
  
  /**
   * 批量编码
   */
  encodeBatch(states: RecommendationState[]): number[][] {
    return states.map(s => this.encode(s));
  }
  
  /**
   * 归一化
   */
  private normalize(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
  
  /**
   * 编码场景类型
   */
  private encodeScenario(scenario: string): number {
    return this.scenarioEncoder.get(scenario) ?? 0.5;
  }
  
  /**
   * 获取策略表现（归一化）
   */
  private getStrategyPerformance(
    performance: Record<string, number>,
    strategy: string
  ): number {
    const value = performance[strategy];
    if (value === undefined) return 0.5;
    return this.normalize(value, 0, 1);
  }
}

// ============================================================================
// 奖励计算器
// ============================================================================

/**
 * 奖励计算器
 */
export class RewardCalculator {
  private config: {
    clickWeight: number;
    likeWeight: number;
    purchaseWeight: number;
    dislikeWeight: number;
    skipWeight: number;
    dwellWeight: number;
    positionDecay: number;
    diversityBonus: number;
    noveltyBonus: number;
    timeDecay: number;
  };
  
  constructor(config?: Partial<typeof RewardCalculator.prototype.config>) {
    this.config = {
      clickWeight: 1.0,
      likeWeight: 2.0,
      purchaseWeight: 5.0,
      dislikeWeight: -2.0,
      skipWeight: -0.5,
      dwellWeight: 0.1,
      positionDecay: 0.8,
      diversityBonus: 0.5,
      noveltyBonus: 0.3,
      timeDecay: 0.95,
      ...config
    };
  }
  
  /**
   * 计算单次反馈的奖励
   */
  calculateSingleReward(
    feedbackType: string,
    position: number,
    dwellTime?: number
  ): number {
    let baseReward = 0;
    
    switch (feedbackType) {
      case 'click':
        baseReward = this.config.clickWeight;
        break;
      case 'like':
        baseReward = this.config.likeWeight;
        break;
      case 'purchase':
        baseReward = this.config.purchaseWeight;
        break;
      case 'dislike':
        baseReward = this.config.dislikeWeight;
        break;
      case 'skip':
        baseReward = this.config.skipWeight;
        break;
      case 'dwell':
        baseReward = this.config.dwellWeight * (dwellTime || 1);
        break;
      default:
        baseReward = 0;
    }
    
    // 位置衰减
    const positionPenalty = Math.pow(this.config.positionDecay, position);
    
    return baseReward * positionPenalty;
  }
  
  /**
   * 计算会话总奖励
   */
  calculateSessionReward(
    feedbacks: Array<{
      type: string;
      position: number;
      dwellTime?: number;
      timestamp: number;
    }>,
    diversityScore?: number,
    noveltyScore?: number
  ): number {
    let totalReward = 0;
    
    // 计算行为奖励
    for (const feedback of feedbacks) {
      const timeDiff = Date.now() - feedback.timestamp;
      const timeDecay = Math.pow(this.config.timeDecay, timeDiff / (1000 * 60 * 60)); // 小时衰减
      
      const reward = this.calculateSingleReward(
        feedback.type,
        feedback.position,
        feedback.dwellTime
      );
      
      totalReward += reward * timeDecay;
    }
    
    // 添加多样性奖励
    if (diversityScore !== undefined) {
      totalReward += this.config.diversityBonus * diversityScore;
    }
    
    // 添加新颖性奖励
    if (noveltyScore !== undefined) {
      totalReward += this.config.noveltyBonus * noveltyScore;
    }
    
    return totalReward;
  }
  
  /**
   * 计算多目标奖励（用于PPO训练）
   */
  calculateMultiObjectiveReward(
    feedbacks: Array<{
      type: string;
      position: number;
      dwellTime?: number;
      timestamp: number;
    }>,
    metrics: {
      ctr: number;
      conversionRate: number;
      avgDwellTime: number;
      diversity: number;
      novelty: number;
      serendipity: number;
    }
  ): number {
    // 加权多目标奖励
    const weights = {
      engagement: 0.3,    // 参与度
      conversion: 0.25,   // 转化
      diversity: 0.15,    // 多样性
      novelty: 0.15,      // 新颖性
      serendipity: 0.15   // 惊喜性
    };
    
    const engagementReward = metrics.ctr * 0.5 + (metrics.avgDwellTime / 60) * 0.5;
    const conversionReward = metrics.conversionRate;
    const diversityReward = metrics.diversity;
    const noveltyReward = metrics.novelty;
    const serendipityReward = metrics.serendipity;
    
    return (
      weights.engagement * engagementReward +
      weights.conversion * conversionReward +
      weights.diversity * diversityReward +
      weights.novelty * noveltyReward +
      weights.serendipity * serendipityReward
    );
  }
}

// ============================================================================
// 动作解码器
// ============================================================================

/**
 * 动作解码器
 * 
 * 将神经网络输出转换为推荐配置
 */
export class ActionDecoder {
  /**
   * 解码动作为推荐配置
   */
  static decode(actionArray: number[]): {
    strategyWeights: StrategyWeights;
    diversityWeight: number;
    noveltyWeight: number;
    serendipityWeight: number;
    minScoreThreshold: number;
  } {
    // 归一化策略权重（确保和为1）
    const rawWeights = actionArray.slice(0, 5);
    const weightSum = rawWeights.reduce((a, b) => a + b, 0) || 1;
    const normalizedWeights = rawWeights.map(w => Math.max(0, w / weightSum));
    
    // 再次归一化确保和为1（处理负值情况）
    const finalSum = normalizedWeights.reduce((a, b) => a + b, 0) || 1;
    const strategyWeights: StrategyWeights = {
      content_based: normalizedWeights[0] / finalSum,
      collaborative: normalizedWeights[1] / finalSum,
      knowledge_based: normalizedWeights[2] / finalSum,
      agent_based: normalizedWeights[3] / finalSum,
      causal_based: normalizedWeights[4] / finalSum
    };
    
    return {
      strategyWeights,
      diversityWeight: Math.max(0, Math.min(1, actionArray[5])),
      noveltyWeight: Math.max(0, Math.min(1, actionArray[6])),
      serendipityWeight: Math.max(0, Math.min(1, actionArray[7])),
      minScoreThreshold: Math.max(0, Math.min(1, actionArray[8]))
    };
  }
  
  /**
   * 编码推荐配置为动作数组
   */
  static encode(config: {
    strategyWeights: StrategyWeights;
    diversityWeight: number;
    noveltyWeight: number;
    serendipityWeight: number;
    minScoreThreshold: number;
  }): number[] {
    return [
      config.strategyWeights.content_based,
      config.strategyWeights.collaborative,
      config.strategyWeights.knowledge_based,
      config.strategyWeights.agent_based,
      config.strategyWeights.causal_based,
      config.diversityWeight,
      config.noveltyWeight,
      config.serendipityWeight,
      config.minScoreThreshold
    ];
  }
}

// 已在类声明处导出
