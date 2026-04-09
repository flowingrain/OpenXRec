/**
 * 智能策略生成器
 * 
 * 基于场景自动生成推荐策略配置
 * 支持：
 * 1. 基于场景的策略推荐
 * 2. 多目标优化 (性能/稳定性/多样性)
 * 3. 策略组合建议
 * 4. 策略效果预测
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 推荐场景
 */
export type RecommendationScenarioType =
  | 'product_recommendation'
  | 'content_recommendation'
  | 'service_recommendation'
  | 'risk_recommendation'
  | 'investment_recommendation'
  | 'travel_recommendation'
  | 'career_recommendation'
  | 'general_recommendation';

/**
 * 策略配置
 */
export interface StrategyConfig {
  /** 策略权重 */
  strategyWeights: {
    content_based: number;
    collaborative: number;
    knowledge_based: number;
    agent_based: number;
    causal_based: number;
  };
  /** 多样性权重 */
  diversityWeight: number;
  /** 新颖性权重 */
  noveltyWeight: number;
  /** 惊喜性权重 */
  serendipityWeight: number;
  /** 最小分数阈值 */
  minScoreThreshold: number;
  /** 最大结果数 */
  maxResults: number;
  /** 启用解释 */
  enableExplanation: boolean;
}

/**
 * 场景上下文
 */
export interface ScenarioContext {
  /** 场景类型 */
  scenarioType: RecommendationScenarioType;
  /** 用户活跃度 */
  userActivityLevel: 'low' | 'medium' | 'high';
  /** 物品池大小 */
  itemPoolSize: 'small' | 'medium' | 'large';
  /** 实时性要求 */
  realtimeRequirement: 'low' | 'medium' | 'high';
  /** 可解释性要求 */
  explainabilityRequirement: 'low' | 'medium' | 'high';
  /** 用户偏好数据量 */
  userDataRichness: 'sparse' | 'moderate' | 'rich';
  /** 业务目标 */
  businessGoals: ('engagement' | 'conversion' | 'diversity' | 'discovery')[];
}

/**
 * 推荐策略
 */
export interface RecommendedStrategy {
  id: string;
  name: string;
  description: string;
  config: StrategyConfig;
  expectedPerformance: {
    accuracy: number;
    diversity: number;
    novelty: number;
    serendipity: number;
  };
  rationale: string[];
  applicableScenarios: RecommendationScenarioType[];
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
}

/**
 * 组合策略
 */
export interface CombinedStrategy {
  id: string;
  name: string;
  strategies: {
    strategy: RecommendedStrategy;
    weight: number;
  }[];
  config: StrategyConfig;
  expectedPerformance: RecommendedStrategy['expectedPerformance'];
  rationale: string;
}

/**
 * 性能预测
 */
export interface PerformancePrediction {
  accuracy: number;
  diversity: number;
  novelty: number;
  serendipity: number;
  confidence: number;
  factors: {
    name: string;
    impact: number;
    direction: 'positive' | 'negative' | 'neutral';
  }[];
}

/**
 * 优化目标
 */
export type OptimizationObjective = 'accuracy' | 'stability' | 'diversity' | 'balanced';

/**
 * 策略生成器配置
 */
export interface StrategyGeneratorConfig {
  /** 默认优化目标 */
  defaultObjective: OptimizationObjective;
  /** 是否考虑历史性能 */
  considerHistory: boolean;
  /** 是否启用贝叶斯优化 */
  enableBayesianOptimization: boolean;
}

const DEFAULT_GENERATOR_CONFIG: StrategyGeneratorConfig = {
  defaultObjective: 'balanced',
  considerHistory: true,
  enableBayesianOptimization: true,
};

// ============================================================================
// 场景策略模板
// ============================================================================

/**
 * 场景策略模板库
 */
const SCENARIO_TEMPLATES: Record<RecommendationScenarioType, Partial<StrategyConfig>[]> = {
  product_recommendation: [
    {
      strategyWeights: { content_based: 0.3, collaborative: 0.35, knowledge_based: 0.2, agent_based: 0.1, causal_based: 0.05 },
      diversityWeight: 0.15,
      noveltyWeight: 0.1,
      serendipityWeight: 0.05,
    },
    {
      strategyWeights: { content_based: 0.25, collaborative: 0.4, knowledge_based: 0.15, agent_based: 0.15, causal_based: 0.05 },
      diversityWeight: 0.2,
      noveltyWeight: 0.15,
      serendipityWeight: 0.08,
    },
  ],
  content_recommendation: [
    {
      strategyWeights: { content_based: 0.35, collaborative: 0.25, knowledge_based: 0.25, agent_based: 0.1, causal_based: 0.05 },
      diversityWeight: 0.2,
      noveltyWeight: 0.2,
      serendipityWeight: 0.1,
    },
    {
      strategyWeights: { content_based: 0.3, collaborative: 0.3, knowledge_based: 0.2, agent_based: 0.15, causal_based: 0.05 },
      diversityWeight: 0.25,
      noveltyWeight: 0.18,
      serendipityWeight: 0.12,
    },
  ],
  service_recommendation: [
    {
      strategyWeights: { content_based: 0.25, collaborative: 0.2, knowledge_based: 0.35, agent_based: 0.15, causal_based: 0.05 },
      diversityWeight: 0.1,
      noveltyWeight: 0.05,
      serendipityWeight: 0.03,
    },
  ],
  risk_recommendation: [
    {
      strategyWeights: { content_based: 0.15, collaborative: 0.1, knowledge_based: 0.25, agent_based: 0.2, causal_based: 0.3 },
      diversityWeight: 0.05,
      noveltyWeight: 0.02,
      serendipityWeight: 0.01,
      minScoreThreshold: 0.5,
    },
  ],
  investment_recommendation: [
    {
      strategyWeights: { content_based: 0.2, collaborative: 0.15, knowledge_based: 0.25, agent_based: 0.15, causal_based: 0.25 },
      diversityWeight: 0.1,
      noveltyWeight: 0.05,
      serendipityWeight: 0.02,
      minScoreThreshold: 0.4,
    },
  ],
  travel_recommendation: [
    {
      strategyWeights: { content_based: 0.3, collaborative: 0.25, knowledge_based: 0.3, agent_based: 0.1, causal_based: 0.05 },
      diversityWeight: 0.25,
      noveltyWeight: 0.2,
      serendipityWeight: 0.15,
    },
  ],
  career_recommendation: [
    {
      strategyWeights: { content_based: 0.25, collaborative: 0.2, knowledge_based: 0.35, agent_based: 0.15, causal_based: 0.05 },
      diversityWeight: 0.15,
      noveltyWeight: 0.1,
      serendipityWeight: 0.08,
    },
  ],
  general_recommendation: [
    {
      strategyWeights: { content_based: 0.25, collaborative: 0.25, knowledge_based: 0.2, agent_based: 0.15, causal_based: 0.15 },
      diversityWeight: 0.2,
      noveltyWeight: 0.15,
      serendipityWeight: 0.1,
    },
  ],
};

// ============================================================================
// 智能策略生成器类
// ============================================================================

export class StrategyGenerator {
  private config: StrategyGeneratorConfig;
  private strategies: RecommendedStrategy[] = [];

  constructor(config: Partial<StrategyGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_GENERATOR_CONFIG, ...config };
    this.initializeDefaultStrategies();
  }

  /**
   * 初始化默认策略
   */
  private initializeDefaultStrategies(): void {
    this.strategies = [
      {
        id: 'strategy_balanced',
        name: '均衡策略',
        description: '平衡各项指标，适用于大多数场景',
        config: {
          strategyWeights: { content_based: 0.25, collaborative: 0.25, knowledge_based: 0.2, agent_based: 0.15, causal_based: 0.15 },
          diversityWeight: 0.2,
          noveltyWeight: 0.15,
          serendipityWeight: 0.1,
          minScoreThreshold: 0.3,
          maxResults: 10,
          enableExplanation: true,
        },
        expectedPerformance: { accuracy: 0.75, diversity: 0.7, novelty: 0.6, serendipity: 0.55 },
        rationale: ['均衡分配各策略权重', '适度关注多样性和新颖性'],
        applicableScenarios: ['general_recommendation', 'product_recommendation'],
        priority: 'medium',
        createdAt: Date.now(),
      },
      {
        id: 'strategy_accuracy',
        name: '精准推荐策略',
        description: '优先保证推荐准确度',
        config: {
          strategyWeights: { content_based: 0.35, collaborative: 0.35, knowledge_based: 0.15, agent_based: 0.1, causal_based: 0.05 },
          diversityWeight: 0.1,
          noveltyWeight: 0.05,
          serendipityWeight: 0.02,
          minScoreThreshold: 0.4,
          maxResults: 10,
          enableExplanation: true,
        },
        expectedPerformance: { accuracy: 0.85, diversity: 0.5, novelty: 0.4, serendipity: 0.35 },
        rationale: ['强调内容匹配和协同过滤', '牺牲部分多样性换取准确度'],
        applicableScenarios: ['product_recommendation', 'service_recommendation'],
        priority: 'high',
        createdAt: Date.now(),
      },
      {
        id: 'strategy_discovery',
        name: '探索发现策略',
        description: '侧重发现用户未知兴趣',
        config: {
          strategyWeights: { content_based: 0.15, collaborative: 0.15, knowledge_based: 0.3, agent_based: 0.25, causal_based: 0.15 },
          diversityWeight: 0.35,
          noveltyWeight: 0.3,
          serendipityWeight: 0.2,
          minScoreThreshold: 0.2,
          maxResults: 15,
          enableExplanation: true,
        },
        expectedPerformance: { accuracy: 0.6, diversity: 0.85, novelty: 0.8, serendipity: 0.75 },
        rationale: ['知识图谱和智能体驱动探索', '最大化多样性和惊喜性'],
        applicableScenarios: ['content_recommendation', 'travel_recommendation'],
        priority: 'medium',
        createdAt: Date.now(),
      },
      {
        id: 'strategy_explainable',
        name: '可解释策略',
        description: '强调推荐原因的可解释性',
        config: {
          strategyWeights: { content_based: 0.3, collaborative: 0.2, knowledge_based: 0.3, agent_based: 0.1, causal_based: 0.1 },
          diversityWeight: 0.15,
          noveltyWeight: 0.1,
          serendipityWeight: 0.05,
          minScoreThreshold: 0.35,
          maxResults: 10,
          enableExplanation: true,
        },
        expectedPerformance: { accuracy: 0.7, diversity: 0.65, novelty: 0.55, serendipity: 0.5 },
        rationale: ['知识图谱提供结构化解释', '因果推断增强可信度'],
        applicableScenarios: ['risk_recommendation', 'investment_recommendation'],
        priority: 'high',
        createdAt: Date.now(),
      },
    ];
  }

  /**
   * 生成推荐策略
   */
  generateStrategy(context: ScenarioContext): RecommendedStrategy {
    // 获取场景模板
    const templates = SCENARIO_TEMPLATES[context.scenarioType] || [];
    
    // 根据上下文选择最佳模板
    let bestTemplate: Partial<StrategyConfig> = {};
    
    if (templates.length > 0) {
      // 根据用户数据丰富度选择模板
      const templateIndex = context.userDataRichness === 'rich' ? 0 : 
                           context.userDataRichness === 'sparse' ? templates.length - 1 : 
                           Math.floor(templates.length / 2);
      bestTemplate = templates[templateIndex] || templates[0];
    }

    // 根据业务目标调整
    const adjustedConfig = this.adjustForBusinessGoals(bestTemplate, context.businessGoals);

    // 根据其他上下文因素微调
    const finalConfig = this.fineTuneForContext(adjustedConfig, context);

    // 计算预期性能
    const expectedPerformance = this.predictPerformance(finalConfig, context);

    // 生成推荐理由
    const rationale = this.generateRationale(context, finalConfig);

    return {
      id: `strategy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: `${this.getScenarioName(context.scenarioType)}策略`,
      description: `针对${this.getScenarioName(context.scenarioType)}场景的优化策略`,
      config: finalConfig,
      expectedPerformance,
      rationale,
      applicableScenarios: [context.scenarioType],
      priority: 'high',
      createdAt: Date.now(),
    };
  }

  /**
   * 根据业务目标调整配置
   */
  private adjustForBusinessGoals(
    config: Partial<StrategyConfig>,
    goals: ScenarioContext['businessGoals']
  ): StrategyConfig {
    const result: StrategyConfig = {
      strategyWeights: config.strategyWeights || { content_based: 0.25, collaborative: 0.25, knowledge_based: 0.2, agent_based: 0.15, causal_based: 0.15 },
      diversityWeight: config.diversityWeight || 0.2,
      noveltyWeight: config.noveltyWeight || 0.15,
      serendipityWeight: config.serendipityWeight || 0.1,
      minScoreThreshold: config.minScoreThreshold || 0.3,
      maxResults: config.maxResults || 10,
      enableExplanation: config.enableExplanation !== false,
    };

    for (const goal of goals) {
      switch (goal) {
        case 'engagement':
          result.diversityWeight *= 1.2;
          result.noveltyWeight *= 1.1;
          break;
        case 'conversion':
          result.strategyWeights.content_based *= 1.15;
          result.strategyWeights.collaborative *= 1.15;
          result.minScoreThreshold *= 1.1;
          break;
        case 'diversity':
          result.diversityWeight *= 1.5;
          result.serendipityWeight *= 1.3;
          break;
        case 'discovery':
          result.noveltyWeight *= 1.4;
          result.strategyWeights.knowledge_based *= 1.2;
          result.strategyWeights.agent_based *= 1.2;
          break;
      }
    }

    // 归一化策略权重
    const totalWeight = Object.values(result.strategyWeights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(result.strategyWeights)) {
      result.strategyWeights[key as keyof typeof result.strategyWeights] /= totalWeight;
    }

    return result;
  }

  /**
   * 根据上下文微调配置
   */
  private fineTuneForContext(
    config: StrategyConfig,
    context: ScenarioContext
  ): StrategyConfig {
    const result = { ...config };

    // 根据实时性要求调整
    if (context.realtimeRequirement === 'high') {
      result.strategyWeights.agent_based *= 0.5;  // 智能体计算较慢
      result.strategyWeights.knowledge_based *= 0.7;
    }

    // 根据可解释性要求调整
    if (context.explainabilityRequirement === 'high') {
      result.enableExplanation = true;
      result.strategyWeights.knowledge_based *= 1.3;
      result.strategyWeights.causal_based *= 1.3;
    }

    // 根据物品池大小调整
    if (context.itemPoolSize === 'small') {
      result.maxResults = Math.min(result.maxResults, 5);
      result.diversityWeight *= 0.8;
    }

    // 归一化
    const totalWeight = Object.values(result.strategyWeights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(result.strategyWeights)) {
      result.strategyWeights[key as keyof typeof result.strategyWeights] /= totalWeight;
    }

    return result;
  }

  /**
   * 预测性能
   */
  predictPerformance(config: StrategyConfig, context: ScenarioContext): PerformancePrediction {
    const factors: PerformancePrediction['factors'] = [];

    // 基于策略权重预测
    factors.push({
      name: '内容匹配策略',
      impact: config.strategyWeights.content_based * 0.8,
      direction: 'positive',
    });
    factors.push({
      name: '协同过滤策略',
      impact: config.strategyWeights.collaborative * 0.75,
      direction: context.userDataRichness === 'rich' ? 'positive' : 'neutral',
    });
    factors.push({
      name: '知识图谱策略',
      impact: config.strategyWeights.knowledge_based * 0.7,
      direction: 'positive',
    });

    // 基于多样性设置预测
    factors.push({
      name: '多样性权重',
      impact: config.diversityWeight * 0.6,
      direction: 'positive',
    });

    // 计算预期性能
    const accuracy = 0.6 + factors.filter(f => f.direction === 'positive')
      .reduce((sum, f) => sum + f.impact, 0) * 0.3;
    
    const diversity = 0.4 + config.diversityWeight * 0.4;
    const novelty = 0.3 + config.noveltyWeight * 0.5;
    const serendipity = 0.2 + config.serendipityWeight * 0.6;

    return {
      accuracy: Math.min(1, accuracy),
      diversity: Math.min(1, diversity),
      novelty: Math.min(1, novelty),
      serendipity: Math.min(1, serendipity),
      confidence: 0.75,
      factors,
    };
  }

  /**
   * 生成推荐理由
   */
  private generateRationale(context: ScenarioContext, config: StrategyConfig): string[] {
    const reasons: string[] = [];

    reasons.push(`场景类型: ${this.getScenarioName(context.scenarioType)}`);
    
    if (config.strategyWeights.collaborative > 0.3) {
      reasons.push('协同过滤权重较高，利用用户行为模式');
    }
    
    if (config.strategyWeights.knowledge_based > 0.25) {
      reasons.push('知识图谱驱动，提供结构化推荐');
    }
    
    if (config.diversityWeight > 0.2) {
      reasons.push('强调多样性，避免推荐结果同质化');
    }
    
    if (context.explainabilityRequirement === 'high') {
      reasons.push('可解释性要求高，增强因果推断权重');
    }

    return reasons;
  }

  /**
   * 组合多个策略
   */
  combineStrategies(
    strategies: RecommendedStrategy[],
    weights?: number[]
  ): CombinedStrategy {
    const normalizedWeights = weights || strategies.map(() => 1 / strategies.length);
    
    // 合并配置
    const combinedConfig: StrategyConfig = {
      strategyWeights: { content_based: 0, collaborative: 0, knowledge_based: 0, agent_based: 0, causal_based: 0 },
      diversityWeight: 0,
      noveltyWeight: 0,
      serendipityWeight: 0,
      minScoreThreshold: 0,
      maxResults: 10,
      enableExplanation: true,
    };

    for (let i = 0; i < strategies.length; i++) {
      const weight = normalizedWeights[i];
      const config = strategies[i].config;

      for (const key of Object.keys(config.strategyWeights)) {
        combinedConfig.strategyWeights[key as keyof typeof combinedConfig.strategyWeights] += 
          config.strategyWeights[key as keyof typeof config.strategyWeights] * weight;
      }
      combinedConfig.diversityWeight += config.diversityWeight * weight;
      combinedConfig.noveltyWeight += config.noveltyWeight * weight;
      combinedConfig.serendipityWeight += config.serendipityWeight * weight;
      combinedConfig.minScoreThreshold += config.minScoreThreshold * weight;
    }

    // 计算预期性能
    const expectedPerformance = {
      accuracy: strategies.reduce((sum, s, i) => sum + s.expectedPerformance.accuracy * normalizedWeights[i], 0),
      diversity: strategies.reduce((sum, s, i) => sum + s.expectedPerformance.diversity * normalizedWeights[i], 0),
      novelty: strategies.reduce((sum, s, i) => sum + s.expectedPerformance.novelty * normalizedWeights[i], 0),
      serendipity: strategies.reduce((sum, s, i) => sum + s.expectedPerformance.serendipity * normalizedWeights[i], 0),
    };

    return {
      id: `combined_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: `组合策略 (${strategies.map(s => s.name).join(' + ')})`,
      strategies: strategies.map((s, i) => ({ strategy: s, weight: normalizedWeights[i] })),
      config: combinedConfig,
      expectedPerformance,
      rationale: `组合了 ${strategies.length} 个策略，平衡各维度性能`,
    };
  }

  /**
   * 获取所有预定义策略
   */
  getStrategies(): RecommendedStrategy[] {
    return [...this.strategies];
  }

  /**
   * 根据场景获取推荐策略
   */
  getStrategiesForScenario(scenario: RecommendationScenarioType): RecommendedStrategy[] {
    return this.strategies.filter(s => s.applicableScenarios.includes(scenario));
  }

  /**
   * 获取场景名称
   */
  private getScenarioName(scenario: RecommendationScenarioType): string {
    const names: Record<RecommendationScenarioType, string> = {
      product_recommendation: '商品推荐',
      content_recommendation: '内容推荐',
      service_recommendation: '服务推荐',
      risk_recommendation: '风险推荐',
      investment_recommendation: '投资推荐',
      travel_recommendation: '旅游推荐',
      career_recommendation: '职业推荐',
      general_recommendation: '通用推荐',
    };
    return names[scenario] || scenario;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let strategyGeneratorInstance: StrategyGenerator | null = null;

export function getStrategyGenerator(
  config: Partial<StrategyGeneratorConfig> = {}
): StrategyGenerator {
  if (!strategyGeneratorInstance) {
    strategyGeneratorInstance = new StrategyGenerator(config);
  }
  return strategyGeneratorInstance;
}

export function createStrategyGenerator(
  config: Partial<StrategyGeneratorConfig> = {}
): StrategyGenerator {
  return new StrategyGenerator(config);
}
