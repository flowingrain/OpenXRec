/**
 * 领域适配配置系统
 * 
 * 核心目标：
 * 1. 通用性 - 架构能处理各种类型的分析任务
 * 2. 领域适配 - 针对特定领域的深度定制
 * 3. 场景适配 - 针对特定场景的灵活响应
 */

import { AgentLayer, TaskComplexity } from './state';
import { AgentCapability } from './intelligent-base';

// 导入上市公司风险分析领域配置
import {
  LISTED_COMPANY_RISK_DOMAIN,
  COMPANY_RISK_ASSESSMENT_SCENARIO,
  COMPARATIVE_RISK_SCENARIO,
  INDUSTRY_RISK_SCENARIO,
} from './domains/listed-company-risk';

// 导入推荐领域配置
import {
  RECOMMENDATION_DOMAIN,
  PRODUCT_RECOMMENDATION_SCENARIO,
  CONTENT_RECOMMENDATION_SCENARIO,
  TRAVEL_RECOMMENDATION_SCENARIO,
} from '../recommendation/domain-config';

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 领域类型
 */
export type DomainType =
  | 'finance'              // 金融领域
  | 'geopolitics'          // 地缘政治
  | 'supply_chain'         // 供应链
  | 'technology'           // 科技领域
  | 'energy'               // 能源领域
  | 'agriculture'          // 农业领域
  | 'listed_company_risk'  // 上市公司风险分析（v1.8新增）
  | 'recommendation'       // 推荐领域（v1.9新增）
  | 'general';             // 通用领域

/**
 * 场景类型
 */
export type ScenarioType =
  | 'event_analysis'           // 突发事件分析
  | 'trend_prediction'         // 趋势预测
  | 'risk_assessment'          // 风险评估
  | 'policy_impact'            // 政策影响
  | 'market_analysis'          // 市场分析
  | 'comparative_study'        // 对比研究
  | 'company_risk_assessment'  // 单公司风险评估（v1.8新增）
  | 'comparative_risk'         // 多公司风险对比（v1.8新增）
  | 'industry_risk'            // 行业风险扫描（v1.8新增）
  | 'supply_chain_risk'        // 供应链风险分析（v1.8新增）
  | 'governance_risk'          // 治理风险分析（v1.8新增）
  | 'product_recommendation'   // 商品推荐（v1.9新增）
  | 'content_recommendation'   // 内容推荐（v1.9新增）
  | 'travel_recommendation'    // 旅游推荐（v1.9新增）
  | 'general_inquiry';         // 通用查询

/**
 * 领域配置
 */
export interface DomainConfig {
  type: DomainType;
  name: string;
  description: string;
  
  // 领域特定的知识库
  knowledgeBases: KnowledgeBase[];
  
  // 领域特定的因果模式
  causalPatterns: DomainCausalPattern[];
  
  // 领域特定的风险传导路径
  riskPropagationPaths: DomainRiskPath[];
  
  // 领域特定的指标体系
  indicators: DomainIndicator[];
  
  // 领域特定的智能体增强
  agentEnhancements: AgentEnhancement[];
  
  // 领域特定的提示词模板
  promptTemplates: PromptTemplate[];
  
  // 领域特定的关键词
  keywords: {
    triggers: string[];      // 触发词
    entities: string[];      // 实体词
    factors: string[];       // 因素词
  };
}

/**
 * 知识库配置
 */
export interface KnowledgeBase {
  id: string;
  name: string;
  type: 'internal' | 'external' | 'hybrid';
  url?: string;
  description: string;
  priority: number;
}

/**
 * 领域因果模式
 */
export interface DomainCausalPattern {
  id: string;
  name: string;
  pattern: string;
  strength: number;
  applicableScenarios: ScenarioType[];
  domainSpecific: boolean;
}

/**
 * 领域风险路径
 */
export interface DomainRiskPath {
  id: string;
  sourceNode: string;
  targetNodes: string[];
  transmissionMechanism: string;
  timeLag: string;
  historicalCases: string[];
  domain: DomainType;
}

/**
 * 领域指标
 */
export interface DomainIndicator {
  id: string;
  name: string;
  category: string;
  unit: string;
  source: string;
  updateFrequency: string;
  importance: 'critical' | 'important' | 'supplementary';
}

/**
 * 智能体增强配置
 */
export interface AgentEnhancement {
  agentId: string;
  enhancementType: 'prompt' | 'tool' | 'knowledge' | 'workflow';
  config: Record<string, any>;
  priority: number;
}

/**
 * 提示词模板
 */
export interface PromptTemplate {
  id: string;
  name: string;
  agentId: string;
  scenario: ScenarioType;
  template: string;
  variables: string[];
}

/**
 * 场景配置
 */
export interface ScenarioConfig {
  type: ScenarioType;
  name: string;
  description: string;
  
  // 场景特定的执行策略
  executionStrategy: {
    layers: AgentLayer[];
    skipAgents: string[];
    parallelWithinLayer: boolean;
    maxIterations: number;
  };
  
  // 场景特定的智能体权重
  agentWeights: Record<string, number>;
  
  // 场景特定的输出格式
  outputFormat: OutputFormatConfig;
  
  // 场景特定的质量检查标准
  qualityStandards: QualityStandard[];
}

/**
 * 输出格式配置
 */
export interface OutputFormatConfig {
  sections: {
    id: string;
    title: string;
    required: boolean;
    order: number;
    agentId?: string;
  }[];
  style: 'academic' | 'business' | 'brief' | 'detailed';
  language: 'zh' | 'en' | 'bilingual';
}

/**
 * 质量标准
 */
export interface QualityStandard {
  dimension: string;
  threshold: number;
  weight: number;
  criticalAgent: string;
}

// ============================================================================
// 预置领域配置
// ============================================================================

/**
 * 金融领域配置
 */
export const FINANCE_DOMAIN: DomainConfig = {
  type: 'finance',
  name: '金融领域',
  description: '覆盖货币政策、利率汇率、资本市场、跨境资本流动等金融相关分析',
  
  knowledgeBases: [
    {
      id: 'kb_fed_policy',
      name: '美联储政策数据库',
      type: 'external',
      url: 'https://www.federalreserve.gov',
      description: '美联储政策决议、会议纪要、讲话稿',
      priority: 10
    },
    {
      id: 'kb_pbc_policy',
      name: '央行政策数据库',
      type: 'internal',
      description: '中国人民银行政策工具、操作记录',
      priority: 10
    },
    {
      id: 'kb_market_data',
      name: '市场行情数据库',
      type: 'external',
      description: '股票、债券、外汇、商品行情数据',
      priority: 8
    }
  ],
  
  causalPatterns: [
    {
      id: 'rate_transmission',
      name: '利率传导机制',
      pattern: '政策利率变化 → 市场利率调整 → 资产价格重估 → 实体经济影响',
      strength: 0.85,
      applicableScenarios: ['policy_impact', 'trend_prediction'],
      domainSpecific: true
    },
    {
      id: 'risk_contagion',
      name: '风险传染机制',
      pattern: '冲击事件 → 避险情绪 → 资产配置调整 → 跨市场传导',
      strength: 0.80,
      applicableScenarios: ['event_analysis', 'risk_assessment'],
      domainSpecific: true
    },
    {
      id: 'capital_flow',
      name: '资本流动机制',
      pattern: '利差变化 → 资本流动 → 汇率波动 → 资产价格联动',
      strength: 0.75,
      applicableScenarios: ['market_analysis', 'trend_prediction'],
      domainSpecific: true
    }
  ],
  
  riskPropagationPaths: [
    {
      id: 'fed_rate_to_china',
      sourceNode: '美联储利率政策',
      targetNodes: ['美元指数', '人民币汇率', 'A股市场', '跨境资本', '债券市场'],
      transmissionMechanism: '利率差异 → 资本流动 → 汇率变化 → 资产价格',
      timeLag: '1-3个月',
      historicalCases: ['2015年加息周期', '2020年降息周期', '2022年激进加息'],
      domain: 'finance'
    },
    {
      id: 'geopolitical_to_market',
      sourceNode: '地缘政治事件',
      targetNodes: ['避险资产', '风险资产', '大宗商品', '波动率'],
      transmissionMechanism: '风险厌恶 → 避险需求 → 资产配置调整',
      timeLag: '即时-1周',
      historicalCases: ['俄乌冲突', '中东局势'],
      domain: 'finance'
    }
  ],
  
  indicators: [
    { id: 'ind_fed_rate', name: '联邦基金利率', category: '货币政策', unit: '%', source: 'FRED', updateFrequency: 'daily', importance: 'critical' },
    { id: 'ind_usd_index', name: '美元指数', category: '汇率', unit: '指数', source: 'ICE', updateFrequency: 'realtime', importance: 'critical' },
    { id: 'ind_cny_rate', name: '人民币汇率', category: '汇率', unit: 'CNY/USD', source: 'CFETS', updateFrequency: 'realtime', importance: 'critical' },
    { id: 'ind_shanghai', name: '上证指数', category: '股市', unit: '指数', source: 'SSE', updateFrequency: 'realtime', importance: 'important' },
    { id: 'ind_treasury_10y', name: '10年期国债收益率', category: '债券', unit: '%', source: '中债登', updateFrequency: 'daily', importance: 'important' },
    { id: 'ind_cpi', name: 'CPI', category: '通胀', unit: '%YoY', source: '统计局', updateFrequency: 'monthly', importance: 'important' }
  ],
  
  agentEnhancements: [
    {
      agentId: 'analyst',
      enhancementType: 'knowledge',
      config: {
        additionalKnowledgeBases: ['kb_fed_policy', 'kb_pbc_policy'],
        causalPatterns: ['rate_transmission', 'risk_contagion', 'capital_flow']
      },
      priority: 10
    },
    {
      agentId: 'simulation',
      enhancementType: 'prompt',
      config: {
        additionalInstructions: [
          '必须分析对中国市场的具体影响',
          '需包含A股、汇率、债券三大市场的预测',
          '提供具体的概率区间和影响幅度'
        ]
      },
      priority: 9
    }
  ],
  
  promptTemplates: [
    {
      id: 'tpl_finance_scenario',
      name: '金融场景推演模板',
      agentId: 'simulation',
      scenario: 'trend_prediction',
      template: `请分析以下金融主题的场景推演：

主题：{{query}}

关键变量：
- 美联储政策路径：{{fed_path}}
- 通胀趋势：{{inflation_trend}}
- 经济增长预期：{{growth_forecast}}

请分析：
1. 对中国市场的影响（A股、汇率、债券）
2. 具体的影响幅度和概率
3. 关键监测指标`,
      variables: ['query', 'fed_path', 'inflation_trend', 'growth_forecast']
    }
  ],
  
  keywords: {
    triggers: ['降息', '加息', '利率', '汇率', '央行', '美联储', '货币政策', 'QE', '缩表'],
    entities: ['美联储', '央行', '财政部', '证监会', '交易所', '投行'],
    factors: ['利率', '通胀', '就业', 'GDP', 'PMI', '流动性', '资本流动']
  }
};

/**
 * 地缘政治领域配置
 */
export const GEOPOLITICS_DOMAIN: DomainConfig = {
  type: 'geopolitics',
  name: '地缘政治',
  description: '覆盖国际关系、地缘冲突、外交政策、安全局势等地缘政治分析',
  
  knowledgeBases: [
    {
      id: 'kb_intl_relations',
      name: '国际关系数据库',
      type: 'internal',
      description: '国家关系、条约、组织成员关系',
      priority: 10
    },
    {
      id: 'kb_conflict_db',
      name: '冲突事件数据库',
      type: 'internal',
      description: '历史冲突事件、演变过程、影响因素',
      priority: 9
    }
  ],
  
  causalPatterns: [
    {
      id: 'conflict_escalation',
      name: '冲突升级机制',
      pattern: '导火索事件 → 舆论发酵 → 立场对立 → 冲突升级 → 外溢效应',
      strength: 0.80,
      applicableScenarios: ['event_analysis', 'risk_assessment'],
      domainSpecific: true
    },
    {
      id: 'sanction_impact',
      name: '制裁影响机制',
      pattern: '制裁措施 → 贸易中断 → 供应链重组 → 价格传导 → 替代方案',
      strength: 0.75,
      applicableScenarios: ['policy_impact', 'market_analysis'],
      domainSpecific: true
    }
  ],
  
  riskPropagationPaths: [
    {
      id: 'geopolitical_to_energy',
      sourceNode: '地缘政治事件',
      targetNodes: ['能源供应', '运输通道', '能源价格', '替代能源'],
      transmissionMechanism: '供应中断预期 → 风险溢价 → 价格上涨',
      timeLag: '即时-1月',
      historicalCases: ['俄乌冲突', '霍尔木兹海峡紧张', '中东局势'],
      domain: 'geopolitics'
    }
  ],
  
  indicators: [
    { id: 'ind_gpr_index', name: '地缘政治风险指数', category: '风险', unit: '指数', source: 'Caldara-Iacoviello', updateFrequency: 'monthly', importance: 'critical' },
    { id: 'ind_oil_price', name: '原油价格', category: '大宗商品', unit: 'USD/桶', source: 'ICE', updateFrequency: 'realtime', importance: 'critical' }
  ],
  
  agentEnhancements: [
    {
      agentId: 'geo_extractor',
      enhancementType: 'knowledge',
      config: {
        geoDatabase: 'kb_intl_relations',
        conflictHistory: 'kb_conflict_db'
      },
      priority: 10
    }
  ],
  
  promptTemplates: [],
  
  keywords: {
    triggers: ['冲突', '战争', '制裁', '外交', '谈判', '紧张', '对峙'],
    entities: ['联合国', '北约', '欧盟', 'G7', 'G20'],
    factors: ['地缘', '主权', '利益', '联盟', '威慑']
  }
};

// ============================================================================
// 预置场景配置
// ============================================================================

/**
 * 突发事件分析场景
 */
export const EVENT_ANALYSIS_SCENARIO: ScenarioConfig = {
  type: 'event_analysis',
  name: '突发事件分析',
  description: '对突发事件的快速响应分析，强调时效性和关键影响识别',
  
  executionStrategy: {
    layers: ['perception', 'cognition', 'decision', 'action'],
    skipAgents: ['arbitrator', 'sensitivity_analysis', 'memory_agent', 'rl_trainer'],
    parallelWithinLayer: true,
    maxIterations: 1  // 快速响应，不循环修正
  },
  
  agentWeights: {
    'scout_cluster': 1.2,      // 搜索权重高，快速获取信息
    'alert_sentinel': 1.1,     // 信源评估重要
    'analyst': 1.0,
    'simulation': 0.8,         // 简化场景推演
    'action_advisor': 1.1      // 快速给出行动建议
  },
  
  outputFormat: {
    sections: [
      { id: 'event_overview', title: '事件概述', required: true, order: 1 },
      { id: 'key_impacts', title: '关键影响', required: true, order: 2 },
      { id: 'china_impact', title: '对中国影响', required: true, order: 3 },
      { id: 'action_required', title: '建议措施', required: true, order: 4 }
    ],
    style: 'brief',
    language: 'zh'
  },
  
  qualityStandards: [
    { dimension: 'timeliness', threshold: 0.9, weight: 0.3, criticalAgent: 'scout_cluster' },
    { dimension: 'accuracy', threshold: 0.7, weight: 0.3, criticalAgent: 'alert_sentinel' },
    { dimension: 'completeness', threshold: 0.6, weight: 0.2, criticalAgent: 'analyst' },
    { dimension: 'actionability', threshold: 0.8, weight: 0.2, criticalAgent: 'action_advisor' }
  ]
};

/**
 * 趋势预测场景
 */
export const TREND_PREDICTION_SCENARIO: ScenarioConfig = {
  type: 'trend_prediction',
  name: '趋势预测',
  description: '对未来发展趋势的中长期预测分析，强调场景完整性和概率评估',
  
  executionStrategy: {
    layers: ['perception', 'cognition', 'decision', 'action', 'evolution'],
    skipAgents: ['arbitrator'],
    parallelWithinLayer: true,
    maxIterations: 3  // 允许多轮修正
  },
  
  agentWeights: {
    'scout_cluster': 1.0,
    'analyst': 1.2,            // 分析师权重高，深度分析
    'simulation': 1.3,         // 场景推演核心
    'sensitivity_analysis': 1.2, // 敏感性分析重要
    'action_advisor': 1.1
  },
  
  outputFormat: {
    sections: [
      { id: 'current_state', title: '现状分析', required: true, order: 1 },
      { id: 'key_drivers', title: '核心驱动因素', required: true, order: 2 },
      { id: 'scenarios', title: '场景推演', required: true, order: 3, agentId: 'simulation' },
      { id: 'sensitivity', title: '敏感性分析', required: true, order: 4, agentId: 'sensitivity_analysis' },
      { id: 'recommendations', title: '策略建议', required: true, order: 5, agentId: 'action_advisor' }
    ],
    style: 'detailed',
    language: 'zh'
  },
  
  qualityStandards: [
    { dimension: 'scenario_coverage', threshold: 0.8, weight: 0.25, criticalAgent: 'simulation' },
    { dimension: 'probability_accuracy', threshold: 0.7, weight: 0.25, criticalAgent: 'simulation' },
    { dimension: 'causal_validity', threshold: 0.8, weight: 0.2, criticalAgent: 'analyst' },
    { dimension: 'action_relevance', threshold: 0.8, weight: 0.3, criticalAgent: 'action_advisor' }
  ]
};

// ============================================================================
// 领域适配管理器
// ============================================================================

/**
 * 领域适配管理器
 */
export class DomainAdapterManager {
  private domains: Map<DomainType, DomainConfig> = new Map();
  private scenarios: Map<ScenarioType, ScenarioConfig> = new Map();
  private currentDomain: DomainType = 'general';
  private currentScenario: ScenarioType = 'general_inquiry';
  
  constructor() {
    // 注册预置领域
    this.registerDomain(FINANCE_DOMAIN);
    this.registerDomain(GEOPOLITICS_DOMAIN);
    this.registerDomain(LISTED_COMPANY_RISK_DOMAIN); // 上市公司风险分析领域
    this.registerDomain(RECOMMENDATION_DOMAIN);       // 推荐领域（v1.9新增）

    // 注册预置场景
    this.registerScenario(EVENT_ANALYSIS_SCENARIO);
    this.registerScenario(TREND_PREDICTION_SCENARIO);
    this.registerScenario(COMPANY_RISK_ASSESSMENT_SCENARIO); // 单公司风险评估
    this.registerScenario(COMPARATIVE_RISK_SCENARIO);        // 多公司风险对比
    this.registerScenario(INDUSTRY_RISK_SCENARIO);           // 行业风险扫描
    this.registerScenario(PRODUCT_RECOMMENDATION_SCENARIO);  // 商品推荐（v1.9新增）
    this.registerScenario(CONTENT_RECOMMENDATION_SCENARIO);  // 内容推荐（v1.9新增）
    this.registerScenario(TRAVEL_RECOMMENDATION_SCENARIO);   // 旅游推荐（v1.9新增）

    // 注册通用领域和场景
    this.registerDomain(this.createGeneralDomain());
    this.registerScenario(this.createGeneralScenario());
  }

  /**
   * 注册领域配置
   */
  registerDomain(config: DomainConfig): void {
    this.domains.set(config.type, config);
    console.log(`[DomainManager] Registered domain: ${config.name}`);
  }

  /**
   * 注册场景配置
   */
  registerScenario(config: ScenarioConfig): void {
    this.scenarios.set(config.type, config);
    console.log(`[DomainManager] Registered scenario: ${config.name}`);
  }

  /**
   * 自动识别领域
   */
  detectDomain(query: string): DomainType {
    const queryLower = query.toLowerCase();
    
    // 遍历所有领域，计算匹配分数
    let bestMatch: DomainType = 'general';
    let bestScore = 0;
    
    this.domains.forEach((config, domainType) => {
      let score = 0;
      
      // 检查触发词
      config.keywords.triggers.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 2;
        }
      });
      
      // 检查实体词
      config.keywords.entities.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 1.5;
        }
      });
      
      // 检查因素词
      config.keywords.factors.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = domainType;
      }
    });
    
    console.log(`[DomainManager] Detected domain: ${bestMatch} (score: ${bestScore})`);
    return bestMatch;
  }

  /**
   * 自动识别场景
   */
  detectScenario(query: string): ScenarioType {
    const queryLower = query.toLowerCase();

    // 场景关键词映射
    const scenarioKeywords: Record<ScenarioType, string[]> = {
      'event_analysis': ['突发', '事件', '最新', '刚刚', '发生了什么', '影响是什么'],
      'trend_prediction': ['趋势', '预测', '未来', '展望', '走势', '概率', '可能性'],
      'risk_assessment': ['风险', '危机', '威胁', '脆弱性', '影响程度'],
      'policy_impact': ['政策', '影响', '效果', '后果', '反应'],
      'market_analysis': ['市场', '行情', '价格', '涨跌', '波动'],
      'comparative_study': ['对比', '比较', '差异', '区别', '哪个'],
      // 上市公司风险分析场景（v1.8新增）
      'company_risk_assessment': ['公司风险', '风险评估', '风险分析', '财务风险', '经营风险', '治理风险', '风险画像'],
      'comparative_risk': ['风险对比', '对比风险', '比较风险', '哪家风险', '风险差异'],
      'industry_risk': ['行业风险', '行业扫描', '行业分析', '行业景气'],
      'supply_chain_risk': ['供应链风险', '产业链风险'],
      'governance_risk': ['治理风险', '公司治理', '内控风险', '股权风险'],
      // 推荐场景（v1.9新增）
      'product_recommendation': ['推荐商品', '商品推荐', '购买推荐', '购物推荐', '产品推荐'],
      'content_recommendation': ['推荐内容', '内容推荐', '文章推荐', '视频推荐', '阅读推荐'],
      'travel_recommendation': ['旅游推荐', '旅行推荐', '景点推荐', '目的地推荐', '行程推荐'],
      'general_inquiry': []
    };

    let bestMatch: ScenarioType = 'general_inquiry';
    let bestScore = 0;

    Object.entries(scenarioKeywords).forEach(([scenario, keywords]) => {
      const score = keywords.filter(k => queryLower.includes(k)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = scenario as ScenarioType;
      }
    });

    console.log(`[DomainManager] Detected scenario: ${bestMatch}`);
    return bestMatch;
  }

  /**
   * 设置当前领域和场景
   */
  setContext(domain: DomainType, scenario: ScenarioType): void {
    this.currentDomain = domain;
    this.currentScenario = scenario;
    console.log(`[DomainManager] Context set to: ${domain}/${scenario}`);
  }

  /**
   * 获取当前领域配置
   */
  getCurrentDomain(): DomainConfig {
    return this.domains.get(this.currentDomain) || this.domains.get('general')!;
  }

  /**
   * 获取当前场景配置
   */
  getCurrentScenario(): ScenarioConfig {
    return this.scenarios.get(this.currentScenario) || this.scenarios.get('general_inquiry')!;
  }

  /**
   * 获取增强的智能体配置
   */
  getEnhancedAgentConfig(agentId: string): {
    baseConfig: AgentCapability | null;
    enhancements: AgentEnhancement[];
    promptTemplates: PromptTemplate[];
  } {
    const domain = this.getCurrentDomain();
    const scenario = this.getCurrentScenario();
    
    const enhancements = domain.agentEnhancements.filter(e => e.agentId === agentId);
    const promptTemplates = domain.promptTemplates.filter(
      t => t.agentId === agentId && t.scenario === scenario.type
    );
    
    return {
      baseConfig: null, // 从 LAYER_AGENTS 获取
      enhancements,
      promptTemplates
    };
  }

  /**
   * 获取领域特定的因果模式
   */
  getDomainCausalPatterns(): DomainCausalPattern[] {
    return this.getCurrentDomain().causalPatterns;
  }

  /**
   * 获取领域特定的风险传导路径
   */
  getDomainRiskPaths(): DomainRiskPath[] {
    return this.getCurrentDomain().riskPropagationPaths;
  }

  /**
   * 获取场景特定的执行策略
   */
  getScenarioExecutionStrategy(): ScenarioConfig['executionStrategy'] {
    return this.getCurrentScenario().executionStrategy;
  }

  /**
   * 生成领域特定的提示词
   */
  generateDomainPrompt(basePrompt: string, agentId: string): string {
    const domain = this.getCurrentDomain();
    const scenario = this.getCurrentScenario();
    
    // 获取增强配置
    const enhancements = domain.agentEnhancements.filter(e => e.agentId === agentId);
    const promptEnhancement = enhancements.find(e => e.enhancementType === 'prompt');
    
    let enhancedPrompt = basePrompt;
    
    // 添加领域特定指令
    if (promptEnhancement?.config.additionalInstructions) {
      const instructions = promptEnhancement.config.additionalInstructions as string[];
      enhancedPrompt += '\n\n## 领域特定要求\n' + instructions.map(i => `- ${i}`).join('\n');
    }
    
    // 添加场景特定要求
    if (scenario.type !== 'general_inquiry') {
      enhancedPrompt += `\n\n## 场景特定要求\n场景类型：${scenario.name}\n请按照该场景的分析重点进行输出。`;
    }
    
    return enhancedPrompt;
  }

  /**
   * 创建通用领域配置
   */
  private createGeneralDomain(): DomainConfig {
    return {
      type: 'general',
      name: '通用领域',
      description: '适用于各类通用分析任务',
      knowledgeBases: [],
      causalPatterns: [],
      riskPropagationPaths: [],
      indicators: [],
      agentEnhancements: [],
      promptTemplates: [],
      keywords: {
        triggers: [],
        entities: [],
        factors: []
      }
    };
  }

  /**
   * 创建通用场景配置
   */
  private createGeneralScenario(): ScenarioConfig {
    return {
      type: 'general_inquiry',
      name: '通用查询',
      description: '适用于各类通用查询任务',
      executionStrategy: {
        layers: ['perception', 'cognition', 'decision', 'action'],
        skipAgents: ['arbitrator', 'sensitivity_analysis'],
        parallelWithinLayer: true,
        maxIterations: 2
      },
      agentWeights: {},
      outputFormat: {
        sections: [
          { id: 'summary', title: '分析摘要', required: true, order: 1 },
          { id: 'details', title: '详细分析', required: true, order: 2 },
          { id: 'conclusion', title: '结论', required: true, order: 3 }
        ],
        style: 'business',
        language: 'zh'
      },
      qualityStandards: [
        { dimension: 'completeness', threshold: 0.7, weight: 0.5, criticalAgent: 'analyst' },
        { dimension: 'accuracy', threshold: 0.7, weight: 0.5, criticalAgent: 'alert_sentinel' }
      ]
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

export const domainManager = new DomainAdapterManager();
