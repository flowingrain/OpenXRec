/**
 * 推荐领域配置
 *
 * 将推荐场景集成到现有的领域配置系统
 */

import type {
  DomainConfig,
  ScenarioConfig,
  DomainType,
  ScenarioType
} from '../langgraph/domain-config';
import { RecommendationStrategy, RecommendationScenario } from './types';

// ============================================================================
// 领域类型扩展
// ============================================================================

/**
 * 推荐领域类型
 */
export const RECOMMENDATION_DOMAIN_TYPE = 'recommendation' as DomainType;

// ============================================================================
// 场景类型定义
// ============================================================================

/**
 * 推荐场景类型
 */
export const RECOMMENDATION_SCENARIO_TYPES = {
  PRODUCT_RECOMMENDATION: 'product_recommendation' as ScenarioType,
  CONTENT_RECOMMENDATION: 'content_recommendation' as ScenarioType,
  SERVICE_RECOMMENDATION: 'service_recommendation' as ScenarioType,
  TRAVEL_RECOMMENDATION: 'travel_recommendation' as ScenarioType,
  CAREER_RECOMMENDATION: 'career_recommendation' as ScenarioType,
  GENERAL_RECOMMENDATION: 'general_recommendation' as ScenarioType
} as const;

// ============================================================================
// 推荐领域配置
// ============================================================================

/**
 * 推荐领域配置
 */
export const RECOMMENDATION_DOMAIN: DomainConfig = {
  type: RECOMMENDATION_DOMAIN_TYPE,
  name: '通用推荐',
  description: '基于多智能体协作的可解释推荐系统',

  // 领域特定的知识库
  knowledgeBases: [
    {
      id: 'recommendation_knowledge',
      name: '推荐知识库',
      type: 'internal',
      description: '推荐算法、用户行为模式、物品特征库',
      priority: 10
    }
  ],

  // 领域特定的因果模式
  causalPatterns: [
    {
      id: 'interest_to_behavior',
      name: '兴趣驱动行为模式',
      pattern: '用户兴趣 → 浏览行为 → 推荐结果 → 满意度',
      strength: 0.8,
      applicableScenarios: Object.values(RECOMMENDATION_SCENARIO_TYPES) as any,
      domainSpecific: true
    },
    {
      id: 'similarity_to_click',
      name: '相似度驱动点击模式',
      pattern: '物品相似度 → 推荐排序 → 点击行为 → 偏好强化',
      strength: 0.75,
      applicableScenarios: Object.values(RECOMMENDATION_SCENARIO_TYPES) as any,
      domainSpecific: true
    },
    {
      id: 'diversity_to_satisfaction',
      name: '多样性影响满意度',
      pattern: '推荐多样性 → 探索行为 → 发现新兴趣 → 长期满意度提升',
      strength: 0.7,
      applicableScenarios: Object.values(RECOMMENDATION_SCENARIO_TYPES) as any,
      domainSpecific: true
    }
  ],

  // 领域特定的风险传导路径
  riskPropagationPaths: [
    {
      id: 'bias_propagation',
      sourceNode: '历史偏见',
      targetNodes: ['推荐偏差', '信息茧房', '用户不满'],
      transmissionMechanism: '反馈循环强化',
      timeLag: '1-3个月',
      historicalCases: ['平台A的历史偏见导致用户流失'],
      domain: 'recommendation' as const,
      mitigation: '多样性优化、新颖性检测'
    },
    {
      id: 'cold_start',
      sourceNode: '新用户',
      targetNodes: ['推荐不准确', '用户流失', '数据稀疏'],
      transmissionMechanism: '行为数据缺失',
      timeLag: '1-2周',
      historicalCases: ['新用户冷启动失败的案例'],
      domain: 'recommendation' as const,
      mitigation: '基于内容推荐、人口统计学特征'
    }
  ],

  // 领域特定的指标体系
  indicators: [
    {
      id: 'click_through_rate',
      name: '点击率',
      category: 'engagement',
      unit: '%',
      source: 'user_behavior',
      updateFrequency: 'daily',
      importance: 'critical',
      formula: '点击次数 / 推荐次数',
      thresholds: {
        low: 0.05,
        medium: 0.1,
        high: 0.15,
        critical: 0.2
      },
      direction: 'higher_is_risk',
      weight: 0.3,
      dataSource: 'user_behavior'
    },
    {
      id: 'conversion_rate',
      name: '转化率',
      category: 'conversion',
      unit: '%',
      source: 'user_behavior',
      updateFrequency: 'daily',
      importance: 'critical',
      formula: '转化次数 / 点击次数',
      thresholds: {
        low: 0.02,
        medium: 0.05,
        high: 0.08,
        critical: 0.1
      },
      direction: 'higher_is_risk',
      weight: 0.3,
      dataSource: 'user_behavior'
    },
    {
      id: 'diversity_score',
      name: '多样性分数',
      category: 'quality',
      unit: 'score',
      source: 'recommendation_metrics',
      updateFrequency: 'daily',
      importance: 'important',
      formula: '1 - 平均相似度',
      thresholds: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        critical: 0.9
      },
      direction: 'higher_is_risk',
      weight: 0.2,
      dataSource: 'recommendation_metrics'
    },
    {
      id: 'novelty_score',
      name: '新颖性分数',
      category: 'quality',
      unit: 'score',
      source: 'recommendation_metrics',
      updateFrequency: 'daily',
      importance: 'important',
      formula: '新颖物品数 / 总推荐数',
      thresholds: {
        low: 0.2,
        medium: 0.4,
        high: 0.6,
        critical: 0.8
      },
      direction: 'higher_is_risk',
      weight: 0.2,
      dataSource: 'recommendation_metrics'
    }
  ],

  // 领域特定的智能体增强
  agentEnhancements: [
    {
      agentId: 'user_profiler',
      enhancementType: 'prompt' as const,
      config: {
        capabilities: ['兴趣挖掘', '偏好建模', '行为分析'],
        llmPrompt: '你是用户画像分析专家，擅长从用户行为数据中挖掘深层兴趣和偏好。'
      },
      priority: 1
    },
    {
      agentId: 'item_profiler',
      enhancementType: 'prompt' as const,
      config: {
        capabilities: ['特征提取', '分类标注', '相似度计算'],
        llmPrompt: '你是物品特征分析专家，擅长从物品描述中提取关键特征和属性。'
      },
      tools: ['NLP', 'Image Recognition', 'Knowledge Graph'],
      priority: 1
    },
    {
      agentId: 'explanation_generator',
      enhancementType: 'prompt' as const,
      config: {
        capabilities: ['自然语言生成', '推理链展示', '个性化解释'],
        llmPrompt: '你是推荐解释生成专家，擅长用简洁明了的语言向用户解释推荐理由。'
      },
      priority: 1
    },
    {
      agentId: 'causal_reasoner',
      enhancementType: 'prompt' as const,
      config: {
        capabilities: ['因果推断', '影响分析', '反事实推理'],
        llmPrompt: '你是因果推理专家，擅长分析推荐结果的潜在影响和因果链。'
      },
      tools: ['Causal Inference Engine', 'Counterfactual Simulator'],
      priority: 1
    }
  ],

  // 领域特定的提示词模板
  promptTemplates: [
    {
      id: 'user_interest_extraction',
      name: '用户兴趣提取',
      agentId: 'user_profiler',
      scenario: 'product_recommendation' as const,
      template: `分析用户行为历史，提取兴趣标签：

用户ID: {userId}
行为历史:
{behaviorHistory}

请提取5-10个主要兴趣标签，以JSON格式返回：
{
  "interests": ["兴趣1", "兴趣2", ...],
  "confidence": [置信度1, 置信度2, ...]
}`,
      variables: ['userId', 'behaviorHistory']
    },
    {
      id: 'recommendation_explanation',
      name: '推荐解释生成',
      agentId: 'explanation_generator',
      scenario: 'product_recommendation' as const,
      template: `为以下推荐生成简洁明了的解释：

用户画像: {userProfile}
推荐物品: {item}
推荐分数: {score}

请生成1-2句话的自然语言解释，突出用户兴趣和物品特征的匹配点。`,
      variables: ['userProfile', 'item', 'score']
    },
    {
      id: 'item_feature_extraction',
      name: '物品特征提取',
      agentId: 'item_profiler',
      scenario: 'product_recommendation' as const,
      template: `从物品信息中提取关键特征：

物品标题: {title}
物品描述: {description}
物品属性: {attributes}

请提取以下特征，以JSON格式返回：
{
  "categories": ["类别1", "类别2", ...],
  "keywords": ["关键词1", "关键词2", ...],
  "sentiment": "positive/neutral/negative",
  "price_range": "low/medium/high",
  "quality": "low/medium/high",
  "other_features": {}
}`,
      variables: ['title', 'description', 'attributes']
    }
  ],

  // 领域特定的关键词
  keywords: {
    triggers: ['推荐', '喜欢', '兴趣', '偏好', '浏览', '点击', '购买', '收藏'],
    entities: ['商品', '文章', '视频', '服务', '品牌', '类别'],
    factors: ['价格', '质量', '评分', '销量', '热度', '新鲜度']
  }
};

// ============================================================================
// 场景配置
// ============================================================================

/**
 * 商品推荐场景
 */
export const PRODUCT_RECOMMENDATION_SCENARIO: ScenarioConfig = {
  type: 'product_recommendation',
  name: '商品推荐',
  description: '基于用户兴趣和行为，推荐相关商品',
  domainType: RECOMMENDATION_DOMAIN_TYPE,

  recommendedStrategies: [
    'hybrid',
    'collaborative',
    'content_based'
  ] as any,

  agentLayers: {
    required: ['perception', 'cognition', 'decision'],
    optional: ['evolution']
  },

  specificAgents: [
    'user_profiler',
    'item_profiler',
    'feature_extractor',
    'similarity_calculator',
    'ranking_agent',
    'explanation_generator'
  ],

  evaluationMetrics: [
    'click_through_rate',
    'conversion_rate',
    'average_rating'
  ],

  outputFormat: {
    sections: [
      { id: 'summary', title: '推荐概要', required: true, order: 1 },
      { id: 'items', title: '推荐列表', required: true, order: 2, agentId: 'ranking_agent' },
      { id: 'explanations', title: '推荐理由', required: true, order: 3, agentId: 'explanation_generator' },
      { id: 'metadata', title: '元信息', required: false, order: 4 }
    ],
    style: 'business' as const,
    language: 'zh' as const
  }
};

/**
 * 内容推荐场景
 */
export const CONTENT_RECOMMENDATION_SCENARIO: ScenarioConfig = {
  type: 'content_recommendation',
  name: '内容推荐',
  description: '基于用户阅读历史和兴趣，推荐相关内容',
  domainType: RECOMMENDATION_DOMAIN_TYPE,

  recommendedStrategies: [
    'knowledge_based',
    'content_based'
  ] as any,

  agentLayers: {
    required: ['perception', 'cognition', 'decision'],
    optional: ['evolution']
  },

  specificAgents: [
    'user_profiler',
    'item_profiler',
    'feature_extractor',
    'kg_reasoner',
    'ranking_agent',
    'explanation_generator'
  ],

  evaluationMetrics: [
    'click_through_rate',
    'read_rate',
    'engagement_time'
  ],

  outputFormat: {
    sections: [
      { id: 'summary', title: '推荐概要', required: true, order: 1 },
      { id: 'items', title: '推荐列表', required: true, order: 2, agentId: 'ranking_agent' },
      { id: 'explanations', title: '推荐理由', required: true, order: 3, agentId: 'explanation_generator' },
      { id: 'metadata', title: '元信息', required: false, order: 4 }
    ],
    style: 'business' as const,
    language: 'zh' as const
  }
};

/**
 * 旅游推荐场景
 */
export const TRAVEL_RECOMMENDATION_SCENARIO: ScenarioConfig = {
  type: 'travel_recommendation',
  name: '旅游推荐',
  description: '基于用户偏好和位置，推荐旅游目的地和行程',
  domainType: RECOMMENDATION_DOMAIN_TYPE,

  recommendedStrategies: [
    'content_based',
    'knowledge_based'
  ] as any,

  agentLayers: {
    required: ['perception', 'cognition', 'decision'],
    optional: ['evolution']
  },

  specificAgents: [
    'user_profiler',
    'item_profiler',
    'geo_extractor',
    'kg_reasoner',
    'ranking_agent',
    'explanation_generator'
  ],

  evaluationMetrics: [
    'click_through_rate',
    'booking_rate',
    'satisfaction_rate'
  ],

  outputFormat: {
    sections: [
      { id: 'summary', title: '推荐概要', required: true, order: 1 },
      { id: 'items', title: '推荐列表', required: true, order: 2, agentId: 'ranking_agent' },
      { id: 'explanations', title: '推荐理由', required: true, order: 3, agentId: 'explanation_generator' },
      { id: 'metadata', title: '元信息', required: false, order: 4 }
    ],
    style: 'business' as const,
    language: 'zh' as const
  }
};

// ============================================================================
// 导出
// ============================================================================

export const RECOMMENDATION_SCENARIOS = {
  product: PRODUCT_RECOMMENDATION_SCENARIO,
  content: CONTENT_RECOMMENDATION_SCENARIO,
  travel: TRAVEL_RECOMMENDATION_SCENARIO
};
