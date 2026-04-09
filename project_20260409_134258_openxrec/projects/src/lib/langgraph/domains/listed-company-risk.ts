/**
 * 上市公司风险分析领域配置
 * 
 * 定位：通过"数字人格+因果推断"双引擎，将多源数据转化为可解释的风险演化链
 * 
 * 核心能力：
 * 1. 多维度风险识别（财务、经营、治理、市场）
 * 2. 风险传导链构建与可视化
 * 3. 数字人格模拟关键决策者行为
 * 4. 因果推断支持风险归因与干预分析
 * 5. 风险预警与趋势预测
 */

import type { 
  DomainConfig, 
  ScenarioConfig, 
  DomainType, 
  ScenarioType 
} from '../domain-config';

// ============================================================================
// 扩展领域类型
// ============================================================================

/**
 * 上市公司风险分析领域类型
 * 注：需要添加到 domain-config.ts 的 DomainType 中
 */
export const LISTED_COMPANY_RISK_DOMAIN_TYPE = 'listed_company_risk' as DomainType;

/**
 * 上市公司风险分析场景类型
 */
export const LISTED_COMPANY_SCENARIO_TYPES = {
  RISK_ASSESSMENT: 'company_risk_assessment' as ScenarioType,      // 单公司风险评估
  COMPARATIVE_RISK: 'comparative_risk' as ScenarioType,            // 多公司风险对比
  INDUSTRY_RISK: 'industry_risk' as ScenarioType,                  // 行业风险扫描
  SUPPLY_CHAIN_RISK: 'supply_chain_risk' as ScenarioType,          // 供应链风险分析
  GOVERNANCE_RISK: 'governance_risk' as ScenarioType,              // 治理风险分析
} as const;

// ============================================================================
// 风险指标类型定义
// ============================================================================

/**
 * 风险维度
 */
export type RiskDimension = 
  | 'financial'      // 财务风险
  | 'operational'    // 经营风险
  | 'governance'     // 治理风险
  | 'market'         // 市场风险
  | 'compliance'     // 合规风险
  | 'esg';           // ESG风险

/**
 * 风险等级
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * 风险指标定义
 */
export interface RiskIndicator {
  id: string;
  name: string;
  dimension: RiskDimension;
  formula?: string;
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  direction: 'higher_is_risk' | 'lower_is_risk';
  weight: number;
  dataSource: string;
}

/**
 * 公司风险画像
 */
export interface CompanyRiskProfile {
  companyId: string;
  companyName: string;
  stockCode: string;
  industry: string;
  
  // 风险评分
  overallRiskScore: number;
  dimensionScores: Record<RiskDimension, number>;
  riskLevel: RiskLevel;
  
  // 关键风险点
  keyRisks: {
    dimension: RiskDimension;
    indicator: string;
    value: number;
    severity: RiskLevel;
    description: string;
  }[];
  
  // 风险传导链
  riskPropagationChains: RiskPropagationChain[];
  
  // 预警信号
  warningSignals: {
    type: string;
    description: string;
    timestamp: number;
    severity: RiskLevel;
  }[];
  
  // 历史趋势
  riskTrend: {
    date: string;
    score: number;
    level: RiskLevel;
  }[];
}

/**
 * 风险传导链
 */
export interface RiskPropagationChain {
  id: string;
  sourceRisk: {
    dimension: RiskDimension;
    indicator: string;
    description: string;
  };
  propagationPath: {
    node: string;
    type: 'risk' | 'factor' | 'entity';
    impactDirection: 'increase' | 'decrease';
    timeLag: string;
  }[];
  targetImpact: {
    dimension: RiskDimension;
    affectedIndicators: string[];
    estimatedImpact: number;
  };
  confidence: number;
  historicalEvidence: string[];
}

// ============================================================================
// 预置风险指标体系
// ============================================================================

/**
 * 财务风险指标
 */
export const FINANCIAL_RISK_INDICATORS: RiskIndicator[] = [
  {
    id: 'altman_z',
    name: 'Altman Z-Score',
    dimension: 'financial',
    formula: '1.2*WC/TA + 1.4*RE/TA + 3.3*EBIT/TA + 0.6*MV/TL + SA/TA',
    thresholds: { low: 3.0, medium: 2.7, high: 1.8, critical: 0 },
    direction: 'lower_is_risk',
    weight: 0.25,
    dataSource: '财务报表'
  },
  {
    id: 'debt_ratio',
    name: '资产负债率',
    dimension: 'financial',
    formula: '总负债/总资产',
    thresholds: { low: 0.4, medium: 0.6, high: 0.75, critical: 0.9 },
    direction: 'higher_is_risk',
    weight: 0.15,
    dataSource: '资产负债表'
  },
  {
    id: 'current_ratio',
    name: '流动比率',
    dimension: 'financial',
    formula: '流动资产/流动负债',
    thresholds: { low: 2.0, medium: 1.5, high: 1.0, critical: 0.5 },
    direction: 'lower_is_risk',
    weight: 0.10,
    dataSource: '资产负债表'
  },
  {
    id: 'interest_coverage',
    name: '利息保障倍数',
    dimension: 'financial',
    formula: 'EBIT/利息支出',
    thresholds: { low: 5.0, medium: 3.0, high: 1.5, critical: 1.0 },
    direction: 'lower_is_risk',
    weight: 0.15,
    dataSource: '利润表'
  },
  {
    id: 'cash_flow_ratio',
    name: '经营现金流比率',
    dimension: 'financial',
    formula: '经营活动现金流/流动负债',
    thresholds: { low: 0.5, medium: 0.3, high: 0.1, critical: 0 },
    direction: 'lower_is_risk',
    weight: 0.10,
    dataSource: '现金流量表'
  },
  {
    id: 'receivable_turnover',
    name: '应收账款周转天数',
    dimension: 'financial',
    formula: '365*平均应收账款/营业收入',
    thresholds: { low: 30, medium: 60, high: 90, critical: 180 },
    direction: 'higher_is_risk',
    weight: 0.08,
    dataSource: '财务报表'
  },
  {
    id: 'inventory_turnover',
    name: '存货周转天数',
    dimension: 'financial',
    formula: '365*平均存货/营业成本',
    thresholds: { low: 45, medium: 90, high: 180, critical: 365 },
    direction: 'higher_is_risk',
    weight: 0.07,
    dataSource: '财务报表'
  },
  {
    id: 'revenue_growth',
    name: '营业收入增长率',
    dimension: 'financial',
    formula: '(本期收入-上期收入)/上期收入',
    thresholds: { low: 0.2, medium: 0.0, high: -0.1, critical: -0.3 },
    direction: 'lower_is_risk',
    weight: 0.10,
    dataSource: '利润表'
  }
];

/**
 * 经营风险指标
 */
export const OPERATIONAL_RISK_INDICATORS: RiskIndicator[] = [
  {
    id: 'gross_margin',
    name: '毛利率',
    dimension: 'operational',
    formula: '(营业收入-营业成本)/营业收入',
    thresholds: { low: 0.3, medium: 0.2, high: 0.1, critical: 0 },
    direction: 'lower_is_risk',
    weight: 0.20,
    dataSource: '利润表'
  },
  {
    id: 'net_margin',
    name: '净利率',
    dimension: 'operational',
    formula: '净利润/营业收入',
    thresholds: { low: 0.1, medium: 0.05, high: 0.02, critical: 0 },
    direction: 'lower_is_risk',
    weight: 0.15,
    dataSource: '利润表'
  },
  {
    id: 'roa',
    name: '资产收益率(ROA)',
    dimension: 'operational',
    formula: '净利润/平均总资产',
    thresholds: { low: 0.08, medium: 0.04, high: 0.02, critical: 0 },
    direction: 'lower_is_risk',
    weight: 0.15,
    dataSource: '财务报表'
  },
  {
    id: 'roe',
    name: '净资产收益率(ROE)',
    dimension: 'operational',
    formula: '净利润/平均净资产',
    thresholds: { low: 0.12, medium: 0.08, high: 0.04, critical: 0 },
    direction: 'lower_is_risk',
    weight: 0.15,
    dataSource: '财务报表'
  },
  {
    id: 'customer_concentration',
    name: '客户集中度',
    dimension: 'operational',
    formula: '前五大客户收入/总收入',
    thresholds: { low: 0.3, medium: 0.5, high: 0.7, critical: 0.9 },
    direction: 'higher_is_risk',
    weight: 0.15,
    dataSource: '年报'
  },
  {
    id: 'supplier_concentration',
    name: '供应商集中度',
    dimension: 'operational',
    formula: '前五大供应商采购额/总采购额',
    thresholds: { low: 0.3, medium: 0.5, high: 0.7, critical: 0.9 },
    direction: 'higher_is_risk',
    weight: 0.10,
    dataSource: '年报'
  },
  {
    id: 'r&d_ratio',
    name: '研发投入占比',
    dimension: 'operational',
    formula: '研发费用/营业收入',
    thresholds: { low: 0.05, medium: 0.03, high: 0.01, critical: 0 },
    direction: 'lower_is_risk',
    weight: 0.10,
    dataSource: '年报'
  }
];

/**
 * 治理风险指标
 */
export const GOVERNANCE_RISK_INDICATORS: RiskIndicator[] = [
  {
    id: 'controlling_shareholder',
    name: '控股股东持股比例',
    dimension: 'governance',
    thresholds: { low: 0.3, medium: 0.5, high: 0.7, critical: 0.9 },
    direction: 'higher_is_risk',
    weight: 0.20,
    dataSource: '股东名册'
  },
  {
    id: 'pledge_ratio',
    name: '股权质押比例',
    dimension: 'governance',
    formula: '质押股数/总股本',
    thresholds: { low: 0.2, medium: 0.4, high: 0.6, critical: 0.8 },
    direction: 'higher_is_risk',
    weight: 0.25,
    dataSource: '中登公司'
  },
  {
    id: 'board_independence',
    name: '独立董事占比',
    dimension: 'governance',
    formula: '独立董事人数/董事总人数',
    thresholds: { low: 0.4, medium: 0.33, high: 0.25, critical: 0 },
    direction: 'lower_is_risk',
    weight: 0.15,
    dataSource: '年报'
  },
  {
    id: 'executive_turnover',
    name: '高管变动频率',
    dimension: 'governance',
    formula: '年度高管离职人数/高管总人数',
    thresholds: { low: 0.1, medium: 0.2, high: 0.3, critical: 0.5 },
    direction: 'higher_is_risk',
    weight: 0.15,
    dataSource: '公告'
  },
  {
    id: 'related_party_ratio',
    name: '关联交易占比',
    dimension: 'governance',
    formula: '关联交易金额/营业收入',
    thresholds: { low: 0.1, medium: 0.2, high: 0.3, critical: 0.5 },
    direction: 'higher_is_risk',
    weight: 0.15,
    dataSource: '年报'
  },
  {
    id: 'audit_opinion',
    name: '审计意见类型',
    dimension: 'governance',
    thresholds: { low: 1, medium: 2, high: 3, critical: 4 }, // 1=无保留,2=保留,3=否定,4=无法表示
    direction: 'higher_is_risk',
    weight: 0.10,
    dataSource: '审计报告'
  }
];

/**
 * 市场风险指标
 */
export const MARKET_RISK_INDICATORS: RiskIndicator[] = [
  {
    id: 'price_volatility',
    name: '股价波动率',
    dimension: 'market',
    formula: '日收益率标准差(年化)',
    thresholds: { low: 0.3, medium: 0.5, high: 0.7, critical: 1.0 },
    direction: 'higher_is_risk',
    weight: 0.20,
    dataSource: '行情数据'
  },
  {
    id: 'beta',
    name: 'Beta系数',
    dimension: 'market',
    formula: 'Cov(Ri,Rm)/Var(Rm)',
    thresholds: { low: 1.0, medium: 1.5, high: 2.0, critical: 3.0 },
    direction: 'higher_is_risk',
    weight: 0.15,
    dataSource: '行情数据'
  },
  {
    id: 'pe_ratio',
    name: '市盈率(TTM)',
    dimension: 'market',
    formula: '市值/近12个月净利润',
    thresholds: { low: 30, medium: 50, high: 100, critical: 200 },
    direction: 'higher_is_risk',
    weight: 0.10,
    dataSource: '行情数据'
  },
  {
    id: 'pb_ratio',
    name: '市净率',
    dimension: 'market',
    formula: '市值/净资产',
    thresholds: { low: 3, medium: 5, high: 10, critical: 20 },
    direction: 'higher_is_risk',
    weight: 0.10,
    dataSource: '行情数据'
  },
  {
    id: 'turnover_rate',
    name: '换手率',
    dimension: 'market',
    formula: '成交量/流通股本',
    thresholds: { low: 0.05, medium: 0.1, high: 0.2, critical: 0.4 },
    direction: 'higher_is_risk',
    weight: 0.10,
    dataSource: '行情数据'
  },
  {
    id: 'short_interest',
    name: '融券余额占比',
    dimension: 'market',
    formula: '融券余额/流通市值',
    thresholds: { low: 0.01, medium: 0.03, high: 0.05, critical: 0.1 },
    direction: 'higher_is_risk',
    weight: 0.15,
    dataSource: '两融数据'
  },
  {
    id: 'institutional_ownership',
    name: '机构持股比例变化',
    dimension: 'market',
    formula: '本期机构持股比例-上期机构持股比例',
    thresholds: { low: -0.05, medium: -0.1, high: -0.2, critical: -0.3 },
    direction: 'lower_is_risk',
    weight: 0.10,
    dataSource: '基金持仓'
  },
  {
    id: 'analyst_downgrade',
    name: '分析师下调评级数',
    dimension: 'market',
    thresholds: { low: 0, medium: 1, high: 2, critical: 5 },
    direction: 'higher_is_risk',
    weight: 0.10,
    dataSource: '研报'
  }
];

/**
 * 合规风险指标
 */
export const COMPLIANCE_RISK_INDICATORS: RiskIndicator[] = [
  {
    id: 'regulatory_penalty',
    name: '监管处罚次数(近一年)',
    dimension: 'compliance',
    thresholds: { low: 0, medium: 1, high: 2, critical: 5 },
    direction: 'higher_is_risk',
    weight: 0.30,
    dataSource: '监管公告'
  },
  {
    id: 'litigation_count',
    name: '重大诉讼案件数',
    dimension: 'compliance',
    thresholds: { low: 0, medium: 3, high: 10, critical: 30 },
    direction: 'higher_is_risk',
    weight: 0.25,
    dataSource: '公告'
  },
  {
    id: 'disclosure_timeliness',
    name: '信息披露及时性评分',
    dimension: 'compliance',
    thresholds: { low: 90, medium: 70, high: 50, critical: 30 },
    direction: 'lower_is_risk',
    weight: 0.20,
    dataSource: '交易所评级'
  },
  {
    id: 'internal_control_defect',
    name: '内控缺陷数量',
    dimension: 'compliance',
    thresholds: { low: 0, medium: 1, high: 3, critical: 5 },
    direction: 'higher_is_risk',
    weight: 0.15,
    dataSource: '内控报告'
  },
  {
    id: 'environmental_violation',
    name: '环保违规次数',
    dimension: 'compliance',
    thresholds: { low: 0, medium: 1, high: 3, critical: 10 },
    direction: 'higher_is_risk',
    weight: 0.10,
    dataSource: '环保部门'
  }
];

/**
 * ESG风险指标
 */
export const ESG_RISK_INDICATORS: RiskIndicator[] = [
  {
    id: 'esg_score',
    name: 'ESG评级',
    dimension: 'esg',
    thresholds: { low: 70, medium: 50, high: 30, critical: 10 },
    direction: 'lower_is_risk',
    weight: 0.40,
    dataSource: 'ESG评级机构'
  },
  {
    id: 'carbon_intensity',
    name: '碳排放强度',
    dimension: 'esg',
    formula: '碳排放量/营业收入',
    thresholds: { low: 100, medium: 300, high: 500, critical: 1000 },
    direction: 'higher_is_risk',
    weight: 0.20,
    dataSource: 'ESG报告'
  },
  {
    id: 'employee_turnover',
    name: '员工流失率',
    dimension: 'esg',
    formula: '离职人数/平均员工数',
    thresholds: { low: 0.1, medium: 0.2, high: 0.3, critical: 0.5 },
    direction: 'higher_is_risk',
    weight: 0.15,
    dataSource: '年报'
  },
  {
    id: 'diversity_score',
    name: '董事会多样性评分',
    dimension: 'esg',
    thresholds: { low: 70, medium: 50, high: 30, critical: 10 },
    direction: 'lower_is_risk',
    weight: 0.15,
    dataSource: '年报'
  },
  {
    id: 'supply_chain_esg',
    name: '供应链ESG风险暴露',
    dimension: 'esg',
    thresholds: { low: 20, medium: 40, high: 60, critical: 80 },
    direction: 'higher_is_risk',
    weight: 0.10,
    dataSource: 'ESG评级机构'
  }
];

/**
 * 完整风险指标体系
 */
export const ALL_RISK_INDICATORS = [
  ...FINANCIAL_RISK_INDICATORS,
  ...OPERATIONAL_RISK_INDICATORS,
  ...GOVERNANCE_RISK_INDICATORS,
  ...MARKET_RISK_INDICATORS,
  ...COMPLIANCE_RISK_INDICATORS,
  ...ESG_RISK_INDICATORS,
];

// ============================================================================
// 风险传导模式库
// ============================================================================

/**
 * 预置风险传导模式
 */
export const RISK_PROPAGATION_PATTERNS = [
  // 财务风险传导
  {
    id: 'debt_to_liquidity',
    name: '高负债→流动性危机',
    pattern: '高资产负债率 → 利息负担加重 → 现金流紧张 → 流动性危机',
    trigger: { dimension: 'financial' as RiskDimension, indicator: 'debt_ratio', threshold: 0.7 },
    propagation: [
      { node: '利息支出增加', type: 'factor' as const, impactDirection: 'increase' as const, timeLag: '1季度' },
      { node: '经营现金流下降', type: 'factor' as const, impactDirection: 'decrease' as const, timeLag: '2季度' },
      { node: '融资能力受限', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '3季度' },
    ],
    target: { dimension: 'financial' as RiskDimension, indicators: ['current_ratio', 'cash_flow_ratio'] },
    confidence: 0.85,
    historicalCases: ['恒大', '华夏幸福', '蓝光发展']
  },
  {
    id: 'receivable_to_cash',
    name: '应收账款→现金流风险',
    pattern: '应收账款高企 → 回款困难 → 现金流紧张 → 经营困难',
    trigger: { dimension: 'financial' as RiskDimension, indicator: 'receivable_turnover', threshold: 90 },
    propagation: [
      { node: '坏账风险上升', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '1季度' },
      { node: '经营现金流恶化', type: 'factor' as const, impactDirection: 'decrease' as const, timeLag: '2季度' },
      { node: '筹资需求增加', type: 'factor' as const, impactDirection: 'increase' as const, timeLag: '2季度' },
    ],
    target: { dimension: 'financial' as RiskDimension, indicators: ['cash_flow_ratio', 'debt_ratio'] },
    confidence: 0.80,
    historicalCases: ['康美药业', '神雾环保']
  },
  
  // 治理风险传导
  {
    id: 'pledge_to_control',
    name: '高质押→控制权风险',
    pattern: '高股权质押 → 股价下跌 → 补仓压力 → 控制权不稳',
    trigger: { dimension: 'governance' as RiskDimension, indicator: 'pledge_ratio', threshold: 0.6 },
    propagation: [
      { node: '股价承压', type: 'factor' as const, impactDirection: 'decrease' as const, timeLag: '即时' },
      { node: '补仓/平仓压力', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '1周' },
      { node: '控制权动摇', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '1月' },
    ],
    target: { dimension: 'governance' as RiskDimension, indicators: ['controlling_shareholder'] },
    confidence: 0.90,
    historicalCases: ['神雾节能', '保千里', '东方金钰']
  },
  {
    id: 'governance_to_finance',
    name: '治理缺陷→融资风险',
    pattern: '治理缺陷 → 融资受限 → 资金链紧张 → 经营困难',
    trigger: { dimension: 'governance' as RiskDimension, indicator: 'audit_opinion', threshold: 2 },
    propagation: [
      { node: '信用评级下调', type: 'factor' as const, impactDirection: 'decrease' as const, timeLag: '1月' },
      { node: '融资成本上升', type: 'factor' as const, impactDirection: 'increase' as const, timeLag: '2月' },
      { node: '融资渠道受限', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '3月' },
    ],
    target: { dimension: 'financial' as RiskDimension, indicators: ['debt_ratio', 'interest_coverage'] },
    confidence: 0.85,
    historicalCases: ['康得新', '辅仁药业']
  },
  
  // 经营风险传导
  {
    id: 'margin_to_profit',
    name: '毛利率下滑→盈利风险',
    pattern: '毛利率持续下滑 → 盈利能力下降 → 估值下调 → 股价承压',
    trigger: { dimension: 'operational' as RiskDimension, indicator: 'gross_margin', threshold: 0.15 },
    propagation: [
      { node: '净利润率下降', type: 'factor' as const, impactDirection: 'decrease' as const, timeLag: '1季度' },
      { node: 'ROE下滑', type: 'factor' as const, impactDirection: 'decrease' as const, timeLag: '2季度' },
      { node: '估值下调', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '3季度' },
    ],
    target: { dimension: 'market' as RiskDimension, indicators: ['pe_ratio', 'pb_ratio'] },
    confidence: 0.80,
    historicalCases: ['格力电器', '美的集团(阶段性)']
  },
  {
    id: 'concentration_to_revenue',
    name: '客户集中→收入风险',
    pattern: '客户高度集中 → 核心客户流失 → 收入骤降 → 经营危机',
    trigger: { dimension: 'operational' as RiskDimension, indicator: 'customer_concentration', threshold: 0.5 },
    propagation: [
      { node: '议价能力下降', type: 'factor' as const, impactDirection: 'decrease' as const, timeLag: '1季度' },
      { node: '收入波动加剧', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '2季度' },
      { node: '盈利不确定性上升', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '3季度' },
    ],
    target: { dimension: 'operational' as RiskDimension, indicators: ['revenue_growth', 'net_margin'] },
    confidence: 0.75,
    historicalCases: ['欧菲光', '立讯精密(阶段性)']
  },
  
  // 合规风险传导
  {
    id: 'penalty_to_financing',
    name: '监管处罚→融资风险',
    pattern: '监管处罚 → 声誉受损 → 融资受限 → 经营困难',
    trigger: { dimension: 'compliance' as RiskDimension, indicator: 'regulatory_penalty', threshold: 1 },
    propagation: [
      { node: '投资者信心下降', type: 'factor' as const, impactDirection: 'decrease' as const, timeLag: '即时' },
      { node: '股价下跌', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '1周' },
      { node: '融资环境恶化', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '1月' },
    ],
    target: { dimension: 'financial' as RiskDimension, indicators: ['debt_ratio', 'interest_coverage'] },
    confidence: 0.85,
    historicalCases: ['长生生物', '康美药业']
  },
  
  // 市场风险传导
  {
    id: 'volatility_to_financing',
    name: '股价波动→质押风险',
    pattern: '股价剧烈波动 → 质押预警 → 强制平仓 → 控制权风险',
    trigger: { dimension: 'market' as RiskDimension, indicator: 'price_volatility', threshold: 0.5 },
    propagation: [
      { node: '质押风险上升', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '即时' },
      { node: '大股东补仓压力', type: 'factor' as const, impactDirection: 'increase' as const, timeLag: '1周' },
      { node: '控制权不稳', type: 'risk' as const, impactDirection: 'increase' as const, timeLag: '1月' },
    ],
    target: { dimension: 'governance' as RiskDimension, indicators: ['pledge_ratio', 'controlling_shareholder'] },
    confidence: 0.85,
    historicalCases: ['千山药机', '印记传媒']
  },
];

// ============================================================================
// 数字人格配置（上市公司风险分析专用）
// ============================================================================

/**
 * 上市公司关键决策者人格
 */
export const LISTED_COMPANY_PERSONAS = [
  {
    id: 'company_ceo',
    name: '公司CEO',
    role: '公司最高管理者',
    personality: {
      decisionStyle: 'strategic' as const,
      riskTolerance: 'moderate' as const,
      timeHorizon: 'medium' as const,
    },
    biases: ['增长偏好', '乐观偏差'],
    keyConcerns: ['市值管理', '业绩增长', '战略执行', '团队稳定'],
    decisionHistory: [
      {
        context: '行业下行周期',
        decision: '收缩战线，聚焦主业',
        reasoning: '保持现金流，等待行业复苏',
        outcome: '成功度过下行周期'
      }
    ],
    institutionalConstraints: ['董事会授权', '监管合规', '信息披露'],
    domains: ['战略管理', '公司治理', '资本运作'],
  },
  {
    id: 'controlling_shareholder',
    name: '控股股东',
    role: '公司实际控制人',
    personality: {
      decisionStyle: 'controlling' as const,
      riskTolerance: 'aggressive' as const,
      timeHorizon: 'long' as const,
    },
    biases: ['控制权偏好', '利益输送倾向'],
    keyConcerns: ['控制权稳定', '股权价值', '融资渠道', '家族传承'],
    decisionHistory: [
      {
        context: '股价大幅下跌，质押风险',
        decision: '补充质押或减持',
        reasoning: '维持控制权，但可能进一步打压股价',
        outcome: '控制权暂时稳定，市场信心受损'
      }
    ],
    institutionalConstraints: ['减持新规', '信息披露', '关联交易限制'],
    domains: ['股权管理', '资本运作', '公司治理'],
  },
  {
    id: 'institutional_investor',
    name: '机构投资者',
    role: '专业投资机构',
    personality: {
      decisionStyle: 'analytical' as const,
      riskTolerance: 'moderate' as const,
      timeHorizon: 'medium' as const,
    },
    biases: ['羊群效应', '短期业绩压力'],
    keyConcerns: ['投资回报', '风险控制', '流动性', 'ESG合规'],
    decisionHistory: [
      {
        context: '公司出现风险信号',
        decision: '减仓或清仓',
        reasoning: '止损优先，保护组合收益',
        outcome: '股价进一步承压'
      }
    ],
    institutionalConstraints: ['投资限制', '风险预算', '合规要求'],
    domains: ['基本面分析', '风险评估', '组合管理'],
  },
  {
    id: 'regulator',
    name: '监管机构',
    role: '市场监管者',
    personality: {
      decisionStyle: 'cautious' as const,
      riskTolerance: 'conservative' as const,
      timeHorizon: 'long' as const,
    },
    biases: ['风险规避', '合规优先'],
    keyConcerns: ['市场稳定', '投资者保护', '信息披露', '违规查处'],
    decisionHistory: [
      {
        context: '公司涉嫌财务造假',
        decision: '立案调查',
        reasoning: '维护市场秩序，保护投资者',
        outcome: '股价暴跌，可能退市'
      }
    ],
    institutionalConstraints: ['法律法规', '执法程序', '证据要求'],
    domains: ['市场监管', '执法稽查', '规则制定'],
  },
  {
    id: 'auditor',
    name: '审计师',
    role: '财务信息把关人',
    personality: {
      decisionStyle: 'cautious' as const,
      riskTolerance: 'conservative' as const,
      timeHorizon: 'short' as const,
    },
    biases: ['风险规避', '客户依赖'],
    keyConcerns: ['审计风险', '职业责任', '声誉保护', '监管处罚'],
    decisionHistory: [
      {
        context: '发现公司财务异常',
        decision: '出具非标意见或辞任',
        reasoning: '保护自身免受连带责任',
        outcome: '市场质疑，股价下跌'
      }
    ],
    institutionalConstraints: ['审计准则', '独立性要求', '法律责任'],
    domains: ['财务审计', '内控评估', '风险识别'],
  },
  {
    id: 'creditor_bank',
    name: '债权银行',
    role: '主要债权人',
    personality: {
      decisionStyle: 'cautious' as const,
      riskTolerance: 'conservative' as const,
      timeHorizon: 'short' as const,
    },
    biases: ['风险规避', '抵押偏好'],
    keyConcerns: ['贷款安全', '利息收入', '不良率控制', '监管指标'],
    decisionHistory: [
      {
        context: '公司出现流动性紧张',
        decision: '收紧授信或要求增信',
        reasoning: '保护债权安全，防止损失扩大',
        outcome: '公司流动性压力加剧'
      }
    ],
    institutionalConstraints: ['授信政策', '监管指标', '风险分类'],
    domains: ['信用评估', '贷后管理', '风险预警'],
  },
];

// ============================================================================
// 领域配置
// ============================================================================

/**
 * 上市公司风险分析领域配置
 */
export const LISTED_COMPANY_RISK_DOMAIN: DomainConfig = {
  type: LISTED_COMPANY_RISK_DOMAIN_TYPE,
  name: '上市公司风险分析',
  description: '覆盖上市公司财务、经营、治理、市场、合规、ESG等多维度风险分析，支持风险传导链构建、数字人格推演和因果推断',
  
  knowledgeBases: [
    {
      id: 'kb_company_fundamentals',
      name: '上市公司基本面数据库',
      type: 'external',
      description: '财务报表、公司公告、股东信息、经营数据',
      priority: 10
    },
    {
      id: 'kb_market_data',
      name: '市场行情数据库',
      type: 'external',
      description: '股价、成交量、估值指标、融资融券',
      priority: 9
    },
    {
      id: 'kb_regulatory',
      name: '监管公告数据库',
      type: 'external',
      description: '监管处罚、问询函、立案调查、退市预警',
      priority: 10
    },
    {
      id: 'kb_news_sentiment',
      name: '新闻舆情数据库',
      type: 'external',
      description: '财经新闻、社交媒体、研报评论',
      priority: 8
    },
    {
      id: 'kb_industry_data',
      name: '行业数据数据库',
      type: 'external',
      description: '行业景气度、竞争格局、政策环境',
      priority: 7
    },
    {
      id: 'kb_risk_cases',
      name: '风险案例数据库',
      type: 'internal',
      description: '历史风险事件、传导路径、处置经验',
      priority: 9
    }
  ],
  
  causalPatterns: [
    {
      id: 'financial_distress_chain',
      name: '财务困境传导链',
      pattern: '盈利下滑 → 现金流恶化 → 债务违约 → 破产重整',
      strength: 0.85,
      applicableScenarios: ['risk_assessment', 'company_risk_assessment'],
      domainSpecific: true
    },
    {
      id: 'governance_crisis_chain',
      name: '治理危机传导链',
      pattern: '治理缺陷 → 信息披露问题 → 监管关注 → 投资者信心丧失',
      strength: 0.80,
      applicableScenarios: ['risk_assessment', 'governance_risk'],
      domainSpecific: true
    },
    {
      id: 'market_sentiment_chain',
      name: '市场情绪传导链',
      pattern: '负面舆情 → 股价下跌 → 质押风险 → 控制权不稳',
      strength: 0.75,
      applicableScenarios: ['market_analysis', 'company_risk_assessment'],
      domainSpecific: true
    },
    {
      id: 'industry_cycle_chain',
      name: '行业周期传导链',
      pattern: '行业下行 → 收入下滑 → 产能过剩 → 亏损加剧',
      strength: 0.70,
      applicableScenarios: ['industry_risk', 'trend_prediction'],
      domainSpecific: true
    }
  ],
  
  riskPropagationPaths: [
    {
      id: 'financial_to_governance',
      sourceNode: '财务风险',
      targetNodes: ['融资能力', '控制权稳定', '信息披露', '监管关注'],
      transmissionMechanism: '财务困境 → 融资受限 → 质押风险 → 治理危机',
      timeLag: '3-6个月',
      historicalCases: ['康美药业', '康得新', '辅仁药业'],
      domain: LISTED_COMPANY_RISK_DOMAIN_TYPE
    },
    {
      id: 'governance_to_market',
      sourceNode: '治理风险',
      targetNodes: ['投资者信心', '股价表现', '融资环境', '信用评级'],
      transmissionMechanism: '治理缺陷 → 信息披露问题 → 市场质疑 → 估值下调',
      timeLag: '1-3个月',
      historicalCases: ['长生生物', 'ST中安', 'ST保千里'],
      domain: LISTED_COMPANY_RISK_DOMAIN_TYPE
    },
    {
      id: 'operational_to_financial',
      sourceNode: '经营风险',
      targetNodes: ['盈利能力', '现金流', '债务偿还', '持续经营'],
      transmissionMechanism: '经营恶化 → 盈利下滑 → 现金流紧张 → 债务压力',
      timeLag: '2-4个季度',
      historicalCases: ['乐视网', '暴风集团', '神州优车'],
      domain: LISTED_COMPANY_RISK_DOMAIN_TYPE
    },
    {
      id: 'market_to_governance',
      sourceNode: '市场风险',
      targetNodes: ['质押安全', '控制权稳定', '融资能力', '管理层稳定'],
      transmissionMechanism: '股价暴跌 → 质押预警 → 平仓压力 → 控制权危机',
      timeLag: '1-4周',
      historicalCases: ['千山药机', '印记传媒', '神雾节能'],
      domain: LISTED_COMPANY_RISK_DOMAIN_TYPE
    }
  ],
  
  indicators: ALL_RISK_INDICATORS.map(ind => ({
    id: ind.id,
    name: ind.name,
    category: ind.dimension,
    unit: ind.formula ? '公式计算' : '数值',
    source: ind.dataSource,
    updateFrequency: '定期更新',
    importance: ind.weight >= 0.15 ? 'critical' as const : ind.weight >= 0.10 ? 'important' as const : 'supplementary' as const
  })),
  
  agentEnhancements: [
    {
      agentId: 'analyst',
      enhancementType: 'knowledge',
      config: {
        riskIndicators: ALL_RISK_INDICATORS,
        propagationPatterns: RISK_PROPAGATION_PATTERNS,
        personas: LISTED_COMPANY_PERSONAS
      },
      priority: 10
    },
    {
      agentId: 'analyst',
      enhancementType: 'prompt',
      config: {
        additionalInstructions: [
          '必须从六个维度评估风险：财务、经营、治理、市场、合规、ESG',
          '识别风险传导链，分析风险如何在不同维度间传递',
          '给出量化的风险评分和风险等级',
          '提供具体的风险预警信号和监测建议'
        ]
      },
      priority: 9
    },
    {
      agentId: 'simulation',
      enhancementType: 'knowledge',
      config: {
        personas: LISTED_COMPANY_PERSONAS,
        decisionSimulations: ['CEO决策模拟', '大股东行为模拟', '机构投资者反应模拟']
      },
      priority: 10
    },
    {
      agentId: 'simulation',
      enhancementType: 'prompt',
      config: {
        additionalInstructions: [
          '模拟关键决策者（CEO、大股东、机构投资者、监管机构）的行为',
          '分析不同情景下各方可能的决策和反应',
          '评估决策对风险传导的影响',
          '预测风险事件的演变路径'
        ]
      },
      priority: 9
    },
    {
      agentId: 'action_advisor',
      enhancementType: 'prompt',
      config: {
        additionalInstructions: [
          '针对识别的风险提供具体的应对措施',
          '区分短期应急措施和长期预防措施',
          '考虑不同利益相关者的视角',
          '给出风险监测的关键指标和阈值'
        ]
      },
      priority: 8
    }
  ],
  
  promptTemplates: [
    {
      id: 'tpl_company_risk_assessment',
      name: '单公司风险评估模板',
      agentId: 'analyst',
      scenario: 'company_risk_assessment',
      template: `请对以下上市公司进行多维度风险评估：

公司信息：
- 公司名称：{{company_name}}
- 股票代码：{{stock_code}}
- 所属行业：{{industry}}

请完成以下分析：

## 一、风险维度评估
从六个维度评估公司风险，每个维度给出：
1. 风险评分（0-100，分数越高风险越大）
2. 风险等级（低/中/高/极高）
3. 关键风险指标分析
4. 主要风险点描述

## 二、风险传导链分析
识别公司的主要风险传导链：
1. 风险源头
2. 传导路径
3. 潜在影响
4. 传导时间估计

## 三、关键决策者行为分析
模拟以下角色的可能行为：
1. 公司管理层
2. 控股股东
3. 机构投资者
4. 债权人

## 四、风险预警信号
列出需要重点关注的风险信号：
1. 财务预警信号
2. 治理预警信号
3. 市场预警信号

## 五、风险应对建议
针对识别的风险给出：
1. 短期应对措施
2. 长期预防措施
3. 监测指标建议`,
      variables: ['company_name', 'stock_code', 'industry']
    },
    {
      id: 'tpl_comparative_risk',
      name: '多公司风险对比模板',
      agentId: 'analyst',
      scenario: 'comparative_risk',
      template: `请对以下上市公司进行风险对比分析：

公司列表：
{{company_list}}

请完成以下分析：

## 一、风险评分对比
对各公司进行六维度风险评分，生成对比表格。

## 二、风险特征对比
分析各公司的主要风险特征和差异。

## 三、风险传导链对比
对比各公司的风险传导模式。

## 四、投资建议
基于风险分析，给出投资建议和风险提示。`,
      variables: ['company_list']
    },
    {
      id: 'tpl_industry_risk',
      name: '行业风险扫描模板',
      agentId: 'analyst',
      scenario: 'industry_risk',
      template: `请对以下行业进行风险扫描分析：

行业信息：
- 行业名称：{{industry_name}}
- 关注重点：{{focus_areas}}

请完成以下分析：

## 一、行业景气度分析
1. 当前景气度
2. 周期位置判断
3. 未来趋势预测

## 二、行业风险因素
1. 政策风险
2. 市场风险
3. 技术风险
4. 竞争风险

## 三、行业内公司风险分布
分析行业内主要公司的风险分布情况。

## 四、风险预警
行业层面的风险预警信号。`,
      variables: ['industry_name', 'focus_areas']
    }
  ],
  
  keywords: {
    triggers: ['风险', '风险评估', '风险分析', '风险预警', '财务风险', '经营风险', '治理风险', '违约', '退市', 'ST', '质押', '诉讼', '处罚', '暴雷', '财务造假'],
    entities: ['上市公司', '股东', '控股股东', '董事会', '管理层', '审计师', '监管机构', '交易所', '证监会'],
    factors: ['财务指标', '治理结构', '经营状况', '市场表现', '合规情况', 'ESG评级', '行业地位', '竞争格局']
  }
};

// ============================================================================
// 场景配置
// ============================================================================

/**
 * 单公司风险评估场景
 */
export const COMPANY_RISK_ASSESSMENT_SCENARIO: ScenarioConfig = {
  type: LISTED_COMPANY_SCENARIO_TYPES.RISK_ASSESSMENT,
  name: '单公司风险评估',
  description: '对单家上市公司进行全面的风险评估，涵盖六大风险维度，输出风险画像和传导链分析',
  
  executionStrategy: {
    layers: ['perception', 'cognition', 'decision', 'action'],
    skipAgents: ['arbitrator'],
    parallelWithinLayer: true,
    maxIterations: 2
  },
  
  agentWeights: {
    'scout_cluster': 1.2,        // 收集公司信息
    'analyst': 1.3,              // 核心分析
    'simulation': 1.1,           // 人格模拟
    'sensitivity_analysis': 1.0, // 敏感性分析
    'action_advisor': 1.1        // 建议输出
  },
  
  outputFormat: {
    sections: [
      { id: 'company_profile', title: '公司概况', required: true, order: 1 },
      { id: 'risk_scores', title: '风险维度评分', required: true, order: 2 },
      { id: 'risk_chains', title: '风险传导链', required: true, order: 3 },
      { id: 'persona_simulation', title: '决策者行为模拟', required: true, order: 4 },
      { id: 'warning_signals', title: '风险预警信号', required: true, order: 5 },
      { id: 'recommendations', title: '风险应对建议', required: true, order: 6 }
    ],
    style: 'detailed',
    language: 'zh'
  },
  
  qualityStandards: [
    { dimension: 'completeness', threshold: 0.9, weight: 0.2, criticalAgent: 'analyst' },
    { dimension: 'accuracy', threshold: 0.8, weight: 0.3, criticalAgent: 'analyst' },
    { dimension: 'causal_validity', threshold: 0.8, weight: 0.2, criticalAgent: 'analyst' },
    { dimension: 'actionability', threshold: 0.8, weight: 0.3, criticalAgent: 'action_advisor' }
  ]
};

/**
 * 多公司风险对比场景
 */
export const COMPARATIVE_RISK_SCENARIO: ScenarioConfig = {
  type: LISTED_COMPANY_SCENARIO_TYPES.COMPARATIVE_RISK,
  name: '多公司风险对比',
  description: '对多家上市公司进行风险对比分析，识别相对风险高低和风险特征差异',
  
  executionStrategy: {
    layers: ['perception', 'cognition', 'decision', 'action'],
    skipAgents: ['arbitrator', 'sensitivity_analysis'],
    parallelWithinLayer: true,
    maxIterations: 1
  },
  
  agentWeights: {
    'scout_cluster': 1.3,
    'analyst': 1.3,
    'action_advisor': 1.0
  },
  
  outputFormat: {
    sections: [
      { id: 'comparison_table', title: '风险评分对比', required: true, order: 1 },
      { id: 'risk_profiles', title: '风险特征对比', required: true, order: 2 },
      { id: 'investment_implications', title: '投资影响', required: true, order: 3 }
    ],
    style: 'business',
    language: 'zh'
  },
  
  qualityStandards: [
    { dimension: 'comparability', threshold: 0.8, weight: 0.4, criticalAgent: 'analyst' },
    { dimension: 'completeness', threshold: 0.8, weight: 0.3, criticalAgent: 'analyst' },
    { dimension: 'actionability', threshold: 0.8, weight: 0.3, criticalAgent: 'action_advisor' }
  ]
};

/**
 * 行业风险扫描场景
 */
export const INDUSTRY_RISK_SCENARIO: ScenarioConfig = {
  type: LISTED_COMPANY_SCENARIO_TYPES.INDUSTRY_RISK,
  name: '行业风险扫描',
  description: '对特定行业进行风险扫描，分析行业景气度、风险因素和行业内公司风险分布',
  
  executionStrategy: {
    layers: ['perception', 'cognition', 'decision', 'action'],
    skipAgents: ['arbitrator'],
    parallelWithinLayer: true,
    maxIterations: 2
  },
  
  agentWeights: {
    'scout_cluster': 1.2,
    'analyst': 1.3,
    'simulation': 0.8,
    'action_advisor': 1.0
  },
  
  outputFormat: {
    sections: [
      { id: 'industry_overview', title: '行业概况', required: true, order: 1 },
      { id: 'industry_cycle', title: '行业周期分析', required: true, order: 2 },
      { id: 'risk_factors', title: '行业风险因素', required: true, order: 3 },
      { id: 'company_distribution', title: '公司风险分布', required: true, order: 4 },
      { id: 'industry_outlook', title: '行业展望', required: true, order: 5 }
    ],
    style: 'detailed',
    language: 'zh'
  },
  
  qualityStandards: [
    { dimension: 'completeness', threshold: 0.8, weight: 0.3, criticalAgent: 'analyst' },
    { dimension: 'accuracy', threshold: 0.7, weight: 0.3, criticalAgent: 'analyst' },
    { dimension: 'forward_looking', threshold: 0.7, weight: 0.4, criticalAgent: 'simulation' }
  ]
};

// ============================================================================
// 导出说明
// ============================================================================
// 所有导出已在定义时完成，无需重复导出
