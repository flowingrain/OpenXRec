/**
 * 智能体驱动的动态配置系统
 *
 * 核心理念：
 * - 智能体自动分析用户行为，动态调整配置
 * - 反馈循环机制持续学习最优配置
 * - 三阶段演进：保留架构 → 场景差异化 → 动态学习
 *
 * 阶段说明：
 * - 阶段1：保留现有领域适配架构（基础层）
 * - 阶段2：优化配置方式（场景级差异化）
 * - 阶段3：支持动态配置和自动学习（智能体驱动）
 */

import { LLMClient } from 'coze-coding-dev-sdk';

// ============================================================================
// 阶段定义
// ============================================================================

/**
 * 配置阶段
 */
export enum ConfigurationStage {
  /**
   * 阶段1：保留现有领域适配架构
   * - 使用预定义的静态配置
   * - 支持场景级基础配置
   */
  STATIC = 'static',

  /**
   * 阶段2：优化配置方式（场景级差异化）
   * - 每个场景有独立配置
   * - 支持配置继承和覆盖
   * - 基于规则自动调整
   */
  SCENARIO_DIFFERENTIATED = 'scenario_differentiated',

  /**
   * 阶段3：支持动态配置和自动学习
   * - 智能体自动分析行为
   - 动态调整策略权重
   - 反馈循环持续学习
   */
  DYNAMIC_LEARNING = 'dynamic_learning'
}

// ============================================================================
// 配置类型
// ============================================================================

/**
 * 策略权重配置
 */
export interface StrategyWeights {
  content_based: number;
  collaborative: number;
  knowledge_based: number;
  agent_based: number;
  causal_based: number;
  sequential: number;       // 序列推荐权重
  multi_behavior: number;   // 多行为推荐权重
}

/**
 * 质量控制配置
 */
export interface QualityControlConfig {
  minScoreThreshold: number;
  maxRecommendations: number;
  diversityWeight: number;
  noveltyWeight: number;
  serendipityWeight: number;
}

/**
 * 动态配置
 */
export interface DynamicConfiguration {
  stage: ConfigurationStage;
  strategyWeights: StrategyWeights;
  qualityControl: QualityControlConfig;
  behaviorWeights: {
    view: number;
    click: number;
    like: number;
    dislike: number;
    purchase: number;
    share: number;
    comment: number;
    rating: number;
  };
  sequenceConfig: {
    windowSize: number;
    timeWindow: number;
    decay: number;
  };
  // 元数据
  version: number;
  updatedAt: number;
  updatedBy: 'system' | 'agent' | 'manual';
  confidence: number;  // 配置置信度
}

// ============================================================================
// 用户反馈数据
// ============================================================================

/**
 * 用户反馈
 */
export interface UserFeedback {
  userId: string;
  itemId: string;
  sessionId: string;
  timestamp: number;
  action: 'click' | 'view' | 'like' | 'dislike' | 'purchase' | 'share' | 'comment';
  recommendationId?: string;  // 对应的推荐ID
  duration?: number;          // 停留时长（毫秒）
  rating?: number;            // 评分 1-5
  context?: {
    scenario: string;
    position: number;         // 推荐列表中的位置
    strategy: string;         // 使用的策略
  };
}

/**
 * 反馈统计
 */
export interface FeedbackStats {
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  ctr: number;                    // 点击率
  conversionRate: number;         // 转化率
  avgDuration: number;            // 平均停留时长
  avgRating: number;              // 平均评分
  strategyPerformance: Map<string, {
    impressions: number;
    clicks: number;
    purchases: number;
    ctr: number;
    conversionRate: number;
  }>;
}

// ============================================================================
// 配置智能体
// ============================================================================

/**
 * 配置智能体
 *
 * 职责：
 * 1. 分析用户行为和反馈
 * 2. 识别场景特征
 * 3. 动态调整配置参数
 * 4. 优化推荐策略权重
 */
class ConfigurationAgent {
  private llmClient: LLMClient;
  private currentConfig: DynamicConfiguration;
  private feedbackHistory: Map<string, UserFeedback[]> = new Map();
  private performanceHistory: Array<{
    timestamp: number;
    config: DynamicConfiguration;
    stats: FeedbackStats;
  }> = [];

  constructor(llmClient: LLMClient, initialConfig: DynamicConfiguration) {
    this.llmClient = llmClient;
    this.currentConfig = initialConfig;
  }

  /**
   * 主方法：分析并更新配置
   */
  async analyzeAndUpdateConfiguration(
    userId: string,
    scenario: string,
    recentFeedbacks: UserFeedback[]
  ): Promise<{
    updated: boolean;
    newConfig: DynamicConfiguration | null;
    reasoning: string;
    confidence: number;
  }> {
    console.log(`[ConfigAgent] 开始分析用户 ${userId} 的配置需求...`);

    // 1. 收集反馈数据
    this.collectFeedback(userId, recentFeedbacks);

    // 2. 计算反馈统计
    const stats = this.calculateStats(userId);

    // 3. 分析当前配置效果
    const analysis = await this.analyzeConfigurationEffectiveness(
      userId,
      scenario,
      stats,
      this.currentConfig
    );

    // 4. 如果需要优化，生成新配置
    if (analysis.needsOptimization) {
      const newConfig = await this.generateOptimizedConfiguration(
        userId,
        scenario,
        stats,
        analysis.insights
      );

      if (newConfig) {
        // 5. 应用新配置
        await this.applyConfiguration(newConfig, analysis.reasoning);
        this.recordPerformance(newConfig, stats);

        return {
          updated: true,
          newConfig,
          reasoning: analysis.reasoning,
          confidence: newConfig.confidence
        };
      }
    }

    return {
      updated: false,
      newConfig: null,
      reasoning: analysis.reasoning,
      confidence: this.currentConfig.confidence
    };
  }

  /**
   * 收集反馈数据
   */
  private collectFeedback(userId: string, feedbacks: UserFeedback[]): void {
    if (!this.feedbackHistory.has(userId)) {
      this.feedbackHistory.set(userId, []);
    }
    this.feedbackHistory.get(userId)!.push(...feedbacks);

    // 保留最近1000条反馈
    const history = this.feedbackHistory.get(userId)!;
    if (history.length > 1000) {
      this.feedbackHistory.set(userId, history.slice(-1000));
    }
  }

  /**
   * 计算反馈统计
   */
  private calculateStats(userId: string): FeedbackStats {
    const feedbacks = this.feedbackHistory.get(userId) || [];
    const recent = feedbacks.slice(-100); // 最近100条

    const stats: FeedbackStats = {
      totalImpressions: recent.filter(f => f.action === 'view').length,
      totalClicks: recent.filter(f => f.action === 'click').length,
      totalPurchases: recent.filter(f => f.action === 'purchase').length,
      ctr: 0,
      conversionRate: 0,
      avgDuration: 0,
      avgRating: 0,
      strategyPerformance: new Map()
    };

    // 计算基础指标
    if (stats.totalImpressions > 0) {
      stats.ctr = stats.totalClicks / stats.totalImpressions;
      stats.conversionRate = stats.totalPurchases / stats.totalImpressions;
    }

    // 计算平均时长和评分
    const durations = recent
      .filter(f => f.duration !== undefined)
      .map(f => f.duration!);
    const ratings = recent
      .filter(f => f.rating !== undefined)
      .map(f => f.rating!);

    if (durations.length > 0) {
      stats.avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    }
    if (ratings.length > 0) {
      stats.avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    }

    // 按策略统计性能
    for (const feedback of recent) {
      if (feedback.context?.strategy) {
        const strategy = feedback.context.strategy;
        if (!stats.strategyPerformance.has(strategy)) {
          stats.strategyPerformance.set(strategy, {
            impressions: 0,
            clicks: 0,
            purchases: 0,
            ctr: 0,
            conversionRate: 0
          });
        }

        const perf = stats.strategyPerformance.get(strategy)!;
        perf.impressions++;

        if (feedback.action === 'click') perf.clicks++;
        if (feedback.action === 'purchase') perf.purchases++;

        if (perf.impressions > 0) {
          perf.ctr = perf.clicks / perf.impressions;
          perf.conversionRate = perf.purchases / perf.impressions;
        }
      }
    }

    return stats;
  }

  /**
   * 分析当前配置效果（使用LLM）
   */
  private async analyzeConfigurationEffectiveness(
    userId: string,
    scenario: string,
    stats: FeedbackStats,
    config: DynamicConfiguration
  ): Promise<{
    needsOptimization: boolean;
    insights: string[];
    reasoning: string;
  }> {
    // 构建分析提示
    const prompt = `分析以下推荐配置的效果，判断是否需要优化。

场景：${scenario}
当前配置：
- 策略权重：${JSON.stringify(config.strategyWeights)}
- 质量控制：${JSON.stringify(config.qualityControl)}
- 行为权重：${JSON.stringify(config.behaviorWeights)}

用户反馈统计：
- 总展示：${stats.totalImpressions}
- 点击：${stats.totalClicks} (CTR: ${(stats.ctr * 100).toFixed(2)}%)
- 转化：${stats.totalPurchases} (转化率: ${(stats.conversionRate * 100).toFixed(2)}%)
- 平均停留时长：${stats.avgDuration.toFixed(0)}ms
- 平均评分：${stats.avgRating.toFixed(1)}/5

各策略性能：
${Array.from(stats.strategyPerformance.entries())
  .map(([strategy, perf]) =>
    `- ${strategy}: CTR ${(perf.ctr * 100).toFixed(2)}%, 转化率 ${(perf.conversionRate * 100).toFixed(2)}%`
  )
  .join('\n')}

请分析：
1. 当前配置是否需要优化？为什么？
2. 哪些策略表现好？哪些表现差？
3. 应该如何调整策略权重？
4. 阈值参数是否合理？

以JSON格式返回：
{
  "needsOptimization": true/false,
  "insights": [
    "洞察1",
    "洞察2"
  ],
  "reasoning": "详细分析理由",
  "suggestions": {
    "strategyWeights": {
      "content_based": 0.3,
      "collaborative": 0.3,
      ...
    },
    "minScoreThreshold": 0.3
  }
}`;

    try {
      const response = await this.llmClient.invoke([
        {
          role: 'system',
          content: '你是推荐系统优化专家，擅长分析反馈数据并优化配置参数。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });

      const result = JSON.parse(response.content || '{}');

      return {
        needsOptimization: result.needsOptimization || false,
        insights: result.insights || [],
        reasoning: result.reasoning || '暂无优化需求'
      };
    } catch (error) {
      console.error('[ConfigAgent] LLM分析失败:', error);
      return {
        needsOptimization: false,
        insights: [],
        reasoning: 'LLM分析失败，保持当前配置'
      };
    }
  }

  /**
   * 生成优化配置（使用LLM）
   */
  private async generateOptimizedConfiguration(
    userId: string,
    scenario: string,
    stats: FeedbackStats,
    insights: string[]
  ): Promise<DynamicConfiguration | null> {
    const prompt = `基于以下分析结果，生成优化的配置参数。

场景：${scenario}
当前配置：
${JSON.stringify(this.currentConfig, null, 2)}

性能洞察：
${insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}

策略性能：
${Array.from(stats.strategyPerformance.entries())
  .map(([strategy, perf]) =>
    `${strategy}: CTR ${(perf.ctr * 100).toFixed(2)}%, 转化率 ${(perf.conversionRate * 100).toFixed(2)}%`
  )
  .join('\n')}

请生成优化后的配置：
1. 调整策略权重，强化表现好的策略，弱化表现差的策略
2. 优化阈值参数
3. 保持权重总和为1
4. 所有参数在合理范围内（0-1）

以JSON格式返回：
{
  "strategyWeights": {
    "content_based": 0.3,
    "collaborative": 0.3,
    "knowledge_based": 0.2,
    "agent_based": 0.1,
    "causal_based": 0.05,
    "sequential": 0.05,
    "multi_behavior": 0.0
  },
  "qualityControl": {
    "minScoreThreshold": 0.3,
    "maxRecommendations": 10,
    "diversityWeight": 0.2,
    "noveltyWeight": 0.2,
    "serendipityWeight": 0.1
  },
  "behaviorWeights": {
    "view": 0.1,
    "click": 0.3,
    "like": 0.7,
    "dislike": -0.5,
    "purchase": 1.0,
    "share": 0.8,
    "comment": 0.6,
    "rating": 1.0
  },
  "confidence": 0.85,
  "reasoning": "优化理由"
}`;

    try {
      const response = await this.llmClient.invoke([
        {
          role: 'system',
          content: '你是推荐系统优化专家，擅长生成优化的配置参数。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });

      const result = JSON.parse(response.content || '{}');

      // 验证配置
      const validated = this.validateConfiguration(result);
      if (!validated) {
        console.error('[ConfigAgent] 生成的配置无效');
        return null;
      }

      // 构建新配置
      const newConfig: DynamicConfiguration = {
        stage: ConfigurationStage.DYNAMIC_LEARNING,
        strategyWeights: result.strategyWeights,
        qualityControl: result.qualityControl,
        behaviorWeights: result.behaviorWeights,
        sequenceConfig: {
          windowSize: 10,
          timeWindow: 86400000,
          decay: 0.9
        },
        version: this.currentConfig.version + 1,
        updatedAt: Date.now(),
        updatedBy: 'agent',
        confidence: result.confidence || 0.7
      };

      return newConfig;
    } catch (error) {
      console.error('[ConfigAgent] 生成配置失败:', error);
      return null;
    }
  }

  /**
   * 验证配置
   */
  private validateConfiguration(config: any): boolean {
    // 检查必需字段
    if (!config.strategyWeights || !config.qualityControl || !config.behaviorWeights) {
      return false;
    }

    // 检查策略权重总和
    const weights = config.strategyWeights;
    const sum = Object.values(weights as Record<string, number>).reduce((s, v) => s + (v as number), 0);
    if (Math.abs(sum - 1) > 0.1) {
      console.error(`[ConfigAgent] 策略权重总和不为1: ${sum}`);
      return false;
    }

    // 检查参数范围
    for (const [key, value] of Object.entries(weights)) {
      if (typeof value !== 'number' || value < 0 || value > 1) {
        console.error(`[ConfigAgent] 无效的策略权重 ${key}: ${value}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 应用配置
   */
  private async applyConfiguration(
    newConfig: DynamicConfiguration,
    reasoning: string
  ): Promise<void> {
    console.log(`[ConfigAgent] 应用新配置 v${newConfig.version}`);
    console.log(`[ConfigAgent] 理由: ${reasoning}`);
    console.log(`[ConfigAgent] 置信度: ${(newConfig.confidence * 100).toFixed(0)}%`);

    this.currentConfig = newConfig;
  }

  /**
   * 记录性能
   */
  private recordPerformance(
    config: DynamicConfiguration,
    stats: FeedbackStats
  ): void {
    this.performanceHistory.push({
      timestamp: Date.now(),
      config,
      stats
    });

    // 保留最近50次记录
    if (this.performanceHistory.length > 50) {
      this.performanceHistory = this.performanceHistory.slice(-50);
    }
  }

  /**
   * 获取当前配置
   */
  getCurrentConfiguration(): DynamicConfiguration {
    return this.currentConfig;
  }

  /**
   * 获取性能历史
   */
  getPerformanceHistory(): Array<{
    timestamp: number;
    config: DynamicConfiguration;
    stats: FeedbackStats;
  }> {
    return this.performanceHistory;
  }

  /**
   * 回滚到之前的配置
   */
  rollbackConfiguration(version: number): boolean {
    const record = this.performanceHistory.find(r => r.config.version === version);
    if (record) {
      this.currentConfig = record.config;
      console.log(`[ConfigAgent] 回滚到配置 v${version}`);
      return true;
    }
    return false;
  }
}

// ============================================================================
// 反馈循环管理器
// ============================================================================

/**
 * 反馈循环管理器
 *
 * 职责：
 * 1. 收集用户反馈
 * 2. 触发配置分析
 * 3. 管理配置更新周期
 * 4. 监控性能变化
 */
class FeedbackLoopManager {
  private configAgent: ConfigurationAgent;
  private feedbackBuffer: Map<string, UserFeedback[]> = new Map();
  private analysisIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(configAgent: ConfigurationAgent) {
    this.configAgent = configAgent;
  }

  /**
   * 收集用户反馈
   */
  collectFeedback(feedback: UserFeedback): void {
    const userId = feedback.userId;
    if (!this.feedbackBuffer.has(userId)) {
      this.feedbackBuffer.set(userId, []);
    }
    this.feedbackBuffer.get(userId)!.push(feedback);

    // 如果缓冲区达到阈值，触发分析
    if (this.feedbackBuffer.get(userId)!.length >= 10) {
      this.triggerAnalysis(userId);
    }
  }

  /**
   * 批量收集反馈
   */
  collectFeedbackBatch(feedbacks: UserFeedback[]): void {
    for (const feedback of feedbacks) {
      this.collectFeedback(feedback);
    }
  }

  /**
   * 触发配置分析
   */
  private async triggerAnalysis(userId: string): Promise<void> {
    // 如果已经在分析中，跳过
    if (this.analysisIntervals.has(userId)) {
      return;
    }

    // 延迟触发（避免频繁分析）
    const timeout = setTimeout(async () => {
      const feedbacks = this.feedbackBuffer.get(userId) || [];
      if (feedbacks.length === 0) {
        this.analysisIntervals.delete(userId);
        return;
      }

      // 提取场景（使用最近一次反馈的场景）
      const scenario = feedbacks[feedbacks.length - 1].context?.scenario || 'default';

      // 调用配置智能体分析
      await this.configAgent.analyzeAndUpdateConfiguration(
        userId,
        scenario,
        feedbacks
      );

      // 清空缓冲区
      this.feedbackBuffer.set(userId, []);
      this.analysisIntervals.delete(userId);
    }, 5000); // 5秒延迟

    this.analysisIntervals.set(userId, timeout);
  }

  /**
   * 手动触发分析
   */
  async manualTrigger(userId: string, scenario?: string): Promise<{
    updated: boolean;
    reasoning: string;
  }> {
    const feedbacks = this.feedbackBuffer.get(userId) || [];
    if (feedbacks.length === 0) {
      return {
        updated: false,
        reasoning: '没有足够的反馈数据'
      };
    }

    const result = await this.configAgent.analyzeAndUpdateConfiguration(
      userId,
      scenario || 'default',
      feedbacks
    );

    // 清空缓冲区
    this.feedbackBuffer.set(userId, []);

    return {
      updated: result.updated,
      reasoning: result.reasoning
    };
  }

  /**
   * 获取缓冲区状态
   */
  getBufferStatus(userId: string): {
    pendingCount: number;
    isAnalyzing: boolean;
  } {
    return {
      pendingCount: this.feedbackBuffer.get(userId)?.length || 0,
      isAnalyzing: this.analysisIntervals.has(userId)
    };
  }

  /**
   * 清除缓冲区
   */
  clearBuffer(userId: string): void {
    this.feedbackBuffer.delete(userId);
    if (this.analysisIntervals.has(userId)) {
      clearTimeout(this.analysisIntervals.get(userId)!);
      this.analysisIntervals.delete(userId);
    }
  }
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 默认动态配置
 */
export const DEFAULT_DYNAMIC_CONFIGURATION: DynamicConfiguration = {
  stage: ConfigurationStage.STATIC,
  strategyWeights: {
    content_based: 0.3,
    collaborative: 0.3,
    knowledge_based: 0.2,
    agent_based: 0.1,
    causal_based: 0.05,
    sequential: 0.05,
    multi_behavior: 0.0
  },
  qualityControl: {
    minScoreThreshold: 0.3,
    maxRecommendations: 10,
    diversityWeight: 0.2,
    noveltyWeight: 0.2,
    serendipityWeight: 0.1
  },
  behaviorWeights: {
    view: 0.1,
    click: 0.3,
    like: 0.7,
    dislike: -0.5,
    purchase: 1.0,
    share: 0.8,
    comment: 0.6,
    rating: 1.0
  },
  sequenceConfig: {
    windowSize: 10,
    timeWindow: 86400000,
    decay: 0.9
  },
  version: 1,
  updatedAt: Date.now(),
  updatedBy: 'system',
  confidence: 0.7
};

// ============================================================================
// 导出
// ============================================================================

export {
  ConfigurationAgent,
  FeedbackLoopManager
};
