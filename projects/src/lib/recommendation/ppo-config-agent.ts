/**
 * PPO 增强的配置智能体
 * 
 * 将 PPO 强化学习集成到配置优化流程中
 * 实现"快速策略响应 + LLM安全验证"的双系统架构
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import {
  PPOOptimizer,
  createPPOOptimizer,
  RecommendationState,
  PPOAction,
  TrainingSample,
  UserFeedbackSignal,
  TrainingStats
} from './ppo';
import {
  DynamicConfiguration,
  ConfigurationStage,
  FeedbackStats,
  UserFeedback,
  StrategyWeights
} from './dynamic-config';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * PPO 配置智能体选项
 */
export interface PPOConfigAgentOptions {
  // 是否启用 PPO
  enablePPO: boolean;
  
  // PPO 响应优先级
  ppoPriority: 'fast' | 'balanced' | 'verified';
  
  // LLM 验证阈值
  llmVerifyThreshold: number;
  
  // 离线训练配置
  offlineTraining: {
    enabled: boolean;
    minSamples: number;
    schedule: 'continuous' | 'scheduled';
  };
}

/**
 * 默认选项
 */
const DEFAULT_OPTIONS: PPOConfigAgentOptions = {
  enablePPO: true,
  ppoPriority: 'balanced',
  llmVerifyThreshold: 0.7,
  offlineTraining: {
    enabled: true,
    minSamples: 100,
    schedule: 'continuous'
  }
};

/**
 * 优化结果
 */
export interface OptimizationResult {
  updated: boolean;
  source: 'ppo' | 'llm' | 'hybrid';
  config: DynamicConfiguration | null;
  reasoning: string;
  confidence: number;
  ppoStats?: {
    entropy: number;
    klDivergence: number;
  };
}

// ============================================================================
// PPO 配置智能体
// ============================================================================

/**
 * PPO 增强的配置智能体
 * 
 * 核心流程：
 * 1. PPO 快速生成策略建议
 * 2. LLM 验证建议的合理性
 * 3. 融合决策输出最终配置
 */
export class PPOEnhancedConfigAgent {
  private llmClient: LLMClient;
  private ppoOptimizer: PPOOptimizer;
  private currentConfig: DynamicConfiguration;
  private options: PPOConfigAgentOptions;
  
  // 反馈历史
  private feedbackHistory: Map<string, UserFeedback[]> = new Map();
  
  // 训练样本缓冲
  private trainingBuffer: TrainingSample[] = [];
  
  // 性能历史
  private performanceHistory: Array<{
    timestamp: number;
    config: DynamicConfiguration;
    stats: FeedbackStats;
    reward: number;
  }> = [];
  
  constructor(
    llmClient: LLMClient,
    initialConfig: DynamicConfiguration,
    options: Partial<PPOConfigAgentOptions> = {}
  ) {
    this.llmClient = llmClient;
    this.currentConfig = initialConfig;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // 初始化 PPO 优化器
    this.ppoOptimizer = createPPOOptimizer({
      stateDim: 32,
      hiddenDims: [128, 64, 32],
      learningRate: 3e-4,
      batchSize: 64,
      epochs: 10
    });
  }
  
  // ===========================================================================
  // 主接口
  // ===========================================================================
  
  /**
   * 获取优化配置
   * 
   * 核心方法：PPO + LLM 双系统决策
   */
  async getOptimizedConfiguration(
    userId: string,
    scenario: string,
    recentFeedbacks: UserFeedback[]
  ): Promise<OptimizationResult> {
    console.log(`[PPOConfigAgent] 开始优化配置，用户: ${userId}, 场景: ${scenario}`);
    
    // 1. 收集反馈
    this.collectFeedback(userId, recentFeedbacks);
    
    // 2. 构建状态
    const state = this.buildRecommendationState(userId, scenario);
    
    // 3. 计算统计指标
    const stats = this.calculateStats(userId);
    
    // 4. 根据模式选择优化路径
    if (this.options.enablePPO && this.options.ppoPriority === 'fast') {
      // 快速模式：PPO 直接响应
      return this.fastOptimization(state);
    } else if (this.options.enablePPO && this.options.ppoPriority === 'verified') {
      // 验证模式：PPO + LLM 双重验证
      return this.verifiedOptimization(state, stats);
    } else {
      // 平衡模式：PPO 建议 + LLM 审核
      return this.balancedOptimization(state, stats);
    }
  }
  
  /**
   * 记录用户反馈（用于训练）
   */
  recordFeedbackForTraining(
    userId: string,
    state: RecommendationState,
    action: PPOAction,
    feedback: UserFeedbackSignal,
    nextState: RecommendationState
  ): void {
    // 计算奖励
    const reward = this.calculateReward(feedback);
    
    // 编码状态
    const stateVector = this.encodeState(state);
    const actionArray = this.actionToArray(action);
    
    // 计算 logProb 和 value
    const { logProb } = this.ppoOptimizer['policyNetwork'].evaluateActions(stateVector, actionArray);
    const value = this.ppoOptimizer['valueNetwork'].forward(stateVector);
    
    // 创建训练样本
    const sample: TrainingSample = {
      state,
      action,
      reward,
      nextState,
      done: false,
      logProb,
      value,
      advantage: 0
    };
    
    this.trainingBuffer.push(sample);
    
    // 触发训练
    if (this.trainingBuffer.length >= this.options.offlineTraining.minSamples) {
      this.triggerTraining();
    }
  }
  
  /**
   * 触发离线训练
   */
  async triggerTraining(): Promise<TrainingStats | null> {
    if (this.trainingBuffer.length < this.options.offlineTraining.minSamples) {
      return null;
    }
    
    console.log(`[PPOConfigAgent] 触发离线训练，样本数: ${this.trainingBuffer.length}`);
    
    const samples = [...this.trainingBuffer];
    this.trainingBuffer = [];
    
    return this.ppoOptimizer.train(samples);
  }
  
  /**
   * 获取 PPO 训练状态
   */
  getPPOState() {
    return this.ppoOptimizer.getState();
  }
  
  /**
   * 获取缓冲区大小
   */
  getBufferSize(): number {
    return this.trainingBuffer.length;
  }
  
  // ===========================================================================
  // 内部方法 - 优化路径
  // ===========================================================================
  
  /**
   * 快速优化（PPO 直接响应）
   */
  private async fastOptimization(state: RecommendationState): Promise<OptimizationResult> {
    const action = this.ppoOptimizer.selectAction(state, false);
    
    const newConfig = this.actionToConfig(action);
    
    return {
      updated: true,
      source: 'ppo',
      config: newConfig,
      reasoning: 'PPO 快速策略调整',
      confidence: 0.85
    };
  }
  
  /**
   * 验证优化（PPO + LLM 双重验证）
   */
  private async verifiedOptimization(
    state: RecommendationState,
    stats: FeedbackStats
  ): Promise<OptimizationResult> {
    // 1. PPO 生成建议
    const ppoAction = this.ppoOptimizer.selectAction(state, false);
    const ppoConfig = this.actionToConfig(ppoAction);
    
    // 2. LLM 验证
    const verification = await this.llmVerify(ppoConfig, stats);
    
    if (verification.approved) {
      return {
        updated: true,
        source: 'hybrid',
        config: ppoConfig,
        reasoning: `PPO建议经LLM验证通过: ${verification.reasoning}`,
        confidence: verification.confidence
      };
    } else {
      // LLM 拒绝，使用 LLM 自己的配置
      return {
        updated: true,
        source: 'llm',
        config: verification.alternativeConfig || null,
        reasoning: `PPO建议被拒绝，使用LLM配置: ${verification.reasoning}`,
        confidence: verification.confidence
      };
    }
  }
  
  /**
   * 平衡优化（PPO 建议 + LLM 审核）
   */
  private async balancedOptimization(
    state: RecommendationState,
    stats: FeedbackStats
  ): Promise<OptimizationResult> {
    // 1. PPO 生成建议
    const ppoAction = this.ppoOptimizer.selectAction(state, true); // 确定性动作
    const ppoConfig = this.actionToConfig(ppoAction);
    
    // 2. 判断是否需要 LLM 介入
    const needsLLM = this.needsLLMIntervention(stats, ppoConfig);
    
    if (!needsLLM) {
      // PPO 置信度足够，直接应用
      return {
        updated: true,
        source: 'ppo',
        config: ppoConfig,
        reasoning: 'PPO 策略调整（高置信度）',
        confidence: 0.9
      };
    }
    
    // 3. 需要 LLM 审核
    const llmConfig = await this.llmOptimize(stats, ppoConfig);
    
    // 4. 融合决策
    const finalConfig = this.mergeConfigs(ppoConfig, llmConfig, 0.6);
    
    return {
      updated: true,
      source: 'hybrid',
      config: finalConfig,
      reasoning: 'PPO 建议 + LLM 审核融合',
      confidence: 0.85
    };
  }
  
  // ===========================================================================
  // 内部方法 - LLM 相关
  // ===========================================================================
  
  /**
   * LLM 验证配置
   */
  private async llmVerify(
    config: DynamicConfiguration,
    stats: FeedbackStats
  ): Promise<{
    approved: boolean;
    reasoning: string;
    confidence: number;
    alternativeConfig?: DynamicConfiguration;
  }> {
    const prompt = `作为推荐系统专家，请验证以下配置变更是否合理。

当前统计指标：
- 平均评分: ${stats.avgRating?.toFixed(2) || 'N/A'}
- 点击率: ${(stats.ctr * 100).toFixed(2)}%
- 转化率: ${(stats.conversionRate * 100).toFixed(2)}%

建议配置：
${JSON.stringify(config.strategyWeights, null, 2)}

请判断：
1. 权重分配是否合理？
2. 是否存在明显问题？
3. 是否批准此配置？

以JSON格式回复：
{
  "approved": true/false,
  "reasoning": "判断理由",
  "confidence": 0.85,
  "alternativeConfig": { ... } // 如果不批准，提供替代配置
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是推荐系统配置验证专家。' },
        { role: 'user', content: prompt }
      ], { temperature: 0.3 });

      const result = this.parseLLMResponse(response.content || '');
      return result;
    } catch (error) {
      console.error('[PPOConfigAgent] LLM验证失败:', error);
      return {
        approved: false,
        reasoning: 'LLM验证失败',
        confidence: 0.5
      };
    }
  }
  
  /**
   * LLM 优化配置
   */
  private async llmOptimize(
    stats: FeedbackStats,
    ppoSuggestion: DynamicConfiguration
  ): Promise<DynamicConfiguration> {
    const prompt = `基于以下统计数据优化推荐配置。

统计指标：
- 平均评分: ${stats.avgRating?.toFixed(2) || 'N/A'}
- 点击率: ${(stats.ctr * 100).toFixed(2)}%
- 转化率: ${(stats.conversionRate * 100).toFixed(2)}%

PPO建议配置：
${JSON.stringify(ppoSuggestion.strategyWeights, null, 2)}

请生成优化后的配置（JSON格式）。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是推荐系统配置优化专家。' },
        { role: 'user', content: prompt }
      ], { temperature: 0.3 });

      const config = this.parseConfigFromLLM(response.content || '');
      return config || ppoSuggestion;
    } catch (error) {
      console.error('[PPOConfigAgent] LLM优化失败:', error);
      return ppoSuggestion;
    }
  }
  
  /**
   * 判断是否需要 LLM 介入
   */
  private needsLLMIntervention(stats: FeedbackStats, ppoConfig: DynamicConfiguration): boolean {
    // 低满意度需要 LLM 介入
    if ((stats.avgRating || 3) < 3.5) return true;
    
    // 低转化率需要 LLM 介入
    if (stats.conversionRate < 0.05) return true;
    
    // 配置变化过大需要 LLM 介入
    const weightChange = this.calculateWeightChange(ppoConfig);
    if (weightChange > 0.3) return true;
    
    return false;
  }
  
  // ===========================================================================
  // 内部方法 - 工具函数
  // ===========================================================================
  
  /**
   * 收集反馈
   */
  private collectFeedback(userId: string, feedbacks: UserFeedback[]): void {
    if (!this.feedbackHistory.has(userId)) {
      this.feedbackHistory.set(userId, []);
    }
    this.feedbackHistory.get(userId)!.push(...feedbacks);
    
    // 限制历史长度
    const history = this.feedbackHistory.get(userId)!;
    if (history.length > 1000) {
      this.feedbackHistory.set(userId, history.slice(-1000));
    }
  }
  
  /**
   * 构建推荐状态
   */
  private buildRecommendationState(userId: string, scenario: string): RecommendationState {
    const feedbacks = this.feedbackHistory.get(userId) || [];
    const recent = feedbacks.slice(-100);
    
    // 计算用户特征
    const userFeatures = {
      activeLevel: Math.min(1, recent.length / 50),
      diversityPreference: this.calculateDiversityPreference(recent),
      avgSessionLength: 0.5, // 默认值
      clickThroughRate: this.calculateCTR(recent),
      conversionRate: this.calculateConversionRate(recent)
    };
    
    // 构建状态
    const state: RecommendationState = {
      userId,
      userFeatures,
      scenarioFeatures: {
        scenarioType: scenario,
        itemPoolSize: 0.5,
        timeOfDay: new Date().getHours() / 24,
        dayOfWeek: new Date().getDay() / 7
      },
      historyStats: {
        recentCtr: userFeatures.clickThroughRate,
        recentSatisfaction: (feedbacks[feedbacks.length - 1]?.rating || 3) / 5,
        strategyPerformance: this.getStrategyPerformance(userId)
      },
      currentConfig: {
        strategyWeights: this.currentConfig.strategyWeights,
        diversityWeight: this.currentConfig.qualityControl.diversityWeight,
        noveltyWeight: this.currentConfig.qualityControl.noveltyWeight,
        serendipityWeight: this.currentConfig.qualityControl.serendipityWeight,
        minScoreThreshold: this.currentConfig.qualityControl.minScoreThreshold
      }
    };
    
    return state;
  }
  
  /**
   * 计算统计指标
   */
  private calculateStats(userId: string): FeedbackStats {
    const feedbacks = this.feedbackHistory.get(userId) || [];
    const recent = feedbacks.slice(-100);
    
    const ratings = recent.filter(f => f.rating).map(f => f.rating!);
    const avgRating = ratings.length > 0 
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
      : 3;
    
    const clicks = recent.filter(f => f.action === 'click').length;
    const purchases = recent.filter(f => f.action === 'purchase').length;
    const total = recent.length || 1;
    
    return {
      totalImpressions: recent.length,
      totalClicks: clicks,
      totalPurchases: purchases,
      ctr: clicks / total,
      conversionRate: purchases / total,
      avgDuration: 0,
      avgRating,
      strategyPerformance: new Map()
    };
  }
  
  /**
   * 计算奖励
   */
  private calculateReward(feedback: UserFeedbackSignal): number {
    const weights: Record<string, number> = {
      click: 1,
      like: 2,
      purchase: 5,
      dislike: -2,
      skip: -0.5
    };
    
    return weights[feedback.type] || 0;
  }
  
  /**
   * 动作转配置
   */
  private actionToConfig(action: PPOAction): DynamicConfiguration {
    return {
      stage: ConfigurationStage.DYNAMIC_LEARNING,
      strategyWeights: {
        content_based: action.strategyWeights.content_based,
        collaborative: action.strategyWeights.collaborative,
        knowledge_based: action.strategyWeights.knowledge_based,
        agent_based: action.strategyWeights.agent_based,
        causal_based: action.strategyWeights.causal_based,
        sequential: 0,
        multi_behavior: 0
      },
      qualityControl: {
        minScoreThreshold: action.minScoreThreshold,
        maxRecommendations: 10,
        diversityWeight: action.diversityWeight,
        noveltyWeight: action.noveltyWeight,
        serendipityWeight: action.serendipityWeight
      },
      behaviorWeights: this.currentConfig.behaviorWeights,
      sequenceConfig: this.currentConfig.sequenceConfig,
      version: this.currentConfig.version + 1,
      updatedAt: Date.now(),
      updatedBy: 'agent',
      confidence: 0.85
    };
  }
  
  /**
   * 融合配置
   */
  private mergeConfigs(
    ppoConfig: DynamicConfiguration,
    llmConfig: DynamicConfiguration,
    ppoWeight: number
  ): DynamicConfiguration {
    const llmWeight = 1 - ppoWeight;
    
    return {
      stage: ConfigurationStage.DYNAMIC_LEARNING,
      strategyWeights: {
        content_based: ppoConfig.strategyWeights.content_based * ppoWeight + 
                       llmConfig.strategyWeights.content_based * llmWeight,
        collaborative: ppoConfig.strategyWeights.collaborative * ppoWeight + 
                       llmConfig.strategyWeights.collaborative * llmWeight,
        knowledge_based: ppoConfig.strategyWeights.knowledge_based * ppoWeight + 
                        llmConfig.strategyWeights.knowledge_based * llmWeight,
        agent_based: ppoConfig.strategyWeights.agent_based * ppoWeight + 
                     llmConfig.strategyWeights.agent_based * llmWeight,
        causal_based: ppoConfig.strategyWeights.causal_based * ppoWeight + 
                      llmConfig.strategyWeights.causal_based * llmWeight,
        sequential: ppoConfig.strategyWeights.sequential * ppoWeight + 
                    llmConfig.strategyWeights.sequential * llmWeight,
        multi_behavior: ppoConfig.strategyWeights.multi_behavior * ppoWeight + 
                        llmConfig.strategyWeights.multi_behavior * llmWeight
      },
      qualityControl: {
        minScoreThreshold: ppoConfig.qualityControl.minScoreThreshold * ppoWeight + 
                          llmConfig.qualityControl.minScoreThreshold * llmWeight,
        maxRecommendations: Math.round(ppoConfig.qualityControl.maxRecommendations * ppoWeight + 
                            llmConfig.qualityControl.maxRecommendations * llmWeight),
        diversityWeight: ppoConfig.qualityControl.diversityWeight * ppoWeight + 
                        llmConfig.qualityControl.diversityWeight * llmWeight,
        noveltyWeight: ppoConfig.qualityControl.noveltyWeight * ppoWeight + 
                      llmConfig.qualityControl.noveltyWeight * llmWeight,
        serendipityWeight: ppoConfig.qualityControl.serendipityWeight * ppoWeight + 
                          llmConfig.qualityControl.serendipityWeight * llmWeight
      },
      behaviorWeights: this.currentConfig.behaviorWeights,
      sequenceConfig: this.currentConfig.sequenceConfig,
      version: this.currentConfig.version + 1,
      updatedAt: Date.now(),
      updatedBy: 'agent',
      confidence: 0.85
    };
  }
  
  // 其他辅助方法
  private encodeState(state: RecommendationState): number[] {
    // 简化编码
    return [
      state.userFeatures.activeLevel,
      state.userFeatures.diversityPreference,
      state.userFeatures.clickThroughRate,
      state.userFeatures.conversionRate,
      state.currentConfig.strategyWeights.content_based,
      state.currentConfig.strategyWeights.collaborative,
      state.currentConfig.strategyWeights.knowledge_based,
      state.currentConfig.strategyWeights.agent_based,
      state.currentConfig.strategyWeights.causal_based,
      state.currentConfig.diversityWeight,
      state.currentConfig.noveltyWeight,
      state.currentConfig.serendipityWeight
    ];
  }
  
  private actionToArray(action: PPOAction): number[] {
    return [
      action.strategyWeights.content_based,
      action.strategyWeights.collaborative,
      action.strategyWeights.knowledge_based,
      action.strategyWeights.agent_based,
      action.strategyWeights.causal_based,
      action.diversityWeight,
      action.noveltyWeight,
      action.serendipityWeight,
      action.minScoreThreshold
    ];
  }
  
  private calculateDiversityPreference(feedbacks: UserFeedback[]): number {
    return 0.5; // 简化实现
  }
  
  private calculateCTR(feedbacks: UserFeedback[]): number {
    const clicks = feedbacks.filter(f => f.action === 'click').length;
    return feedbacks.length > 0 ? clicks / feedbacks.length : 0.1;
  }
  
  private calculateConversionRate(feedbacks: UserFeedback[]): number {
    const purchases = feedbacks.filter(f => f.action === 'purchase').length;
    return feedbacks.length > 0 ? purchases / feedbacks.length : 0.01;
  }
  
  private getStrategyPerformance(userId: string): Record<string, number> {
    return {
      content_based: 0.5,
      collaborative: 0.5,
      knowledge_based: 0.5,
      agent_based: 0.5,
      causal_based: 0.5
    };
  }
  
  private calculateWeightChange(config: DynamicConfiguration): number {
    const current = this.currentConfig.strategyWeights;
    const new_ = config.strategyWeights;
    
    let change = 0;
    for (const key of Object.keys(current)) {
      change += Math.abs((current as any)[key] - (new_ as any)[key]);
    }
    
    return change / Object.keys(current).length;
  }
  
  private parseLLMResponse(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[PPOConfigAgent] 解析LLM响应失败:', e);
    }
    return { approved: false, reasoning: '解析失败', confidence: 0.5 };
  }
  
  private parseConfigFromLLM(content: string): DynamicConfiguration | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...this.currentConfig,
          strategyWeights: parsed.strategyWeights || this.currentConfig.strategyWeights,
          qualityControl: parsed.qualityControl || this.currentConfig.qualityControl
        };
      }
    } catch (e) {
      console.error('[PPOConfigAgent] 解析配置失败:', e);
    }
    return null;
  }
}

// PPOEnhancedConfigAgent 已在类声明处导出
