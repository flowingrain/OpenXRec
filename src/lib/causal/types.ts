/**
 * 因果推断系统 - 核心类型定义
 * 实现结构化因果模型（SCM）、do-calculus、反事实推断
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 变量类型
 */
export type VariableType = 'exogenous' | 'endogenous' | 'intervention' | 'outcome';

/**
 * 变量数据类型
 */
export type DataType = 'continuous' | 'discrete' | 'binary' | 'categorical' | 'temporal';

/**
 * 因果关系强度
 */
export type CausalStrength = 'necessary' | 'sufficient' | 'necessary_and_sufficient' | 'contributory';

/**
 * 置信度等级
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'speculative';

// ============================================================================
// 变量定义
// ============================================================================

/**
 * 因果变量
 */
export interface CausalVariable {
  /** 变量ID */
  id: string;
  /** 变量名称 */
  name: string;
  /** 变量描述 */
  description?: string;
  /** 变量类型 */
  type: VariableType;
  /** 数据类型 */
  dataType: DataType;
  /** 取值范围 */
  valueRange?: {
    min?: number;
    max?: number;
    categories?: string[];
  };
  /** 单位 */
  unit?: string;
  /** 可观测性 */
  observable: boolean;
  /** 时间属性 */
  temporal?: {
    isTimeVarying: boolean;
    lagEffects?: number[]; // 滞后效应期数
  };
  /** 领域标签 */
  domain?: string[];
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 变量状态
 */
export interface VariableState {
  variableId: string;
  value: any;
  probability?: number;
  confidence?: number;
  source?: 'observed' | 'inferred' | 'intervened' | 'counterfactual' | 'prior';
}

// ============================================================================
// 因果关系定义
// ============================================================================

/**
 * 因果边（因果关系）
 */
export interface CausalEdge {
  /** 边ID */
  id: string;
  /** 原因变量ID */
  cause: string;
  /** 结果变量ID */
  effect: string;
  /** 关系强度 */
  strength: CausalStrength;
  /** 效应方向 */
  direction: 'positive' | 'negative' | 'nonlinear' | 'conditional';
  /** 效应大小（标准化系数） */
  effectSize?: number;
  /** 置信度 */
  confidence: number;
  /** 置信度等级 */
  confidenceLevel: ConfidenceLevel;
  /** 机制描述 */
  mechanism?: string;
  /** 条件（何时生效） */
  conditions?: string[];
  /** 滞后期 */
  lag?: number;
  /** 中介变量 */
  mediators?: string[];
  /** 调节变量 */
  moderators?: string[];
  /** 证据来源 */
  evidence?: CausalEvidence[];
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 因果证据
 */
export interface CausalEvidence {
  /** 证据类型 */
  type: 'statistical' | 'experimental' | 'mechanistic' | 'expert' | 'literature';
  /** 证据来源 */
  source: string;
  /** 证据描述 */
  description: string;
  /** 支持强度 */
  supportStrength: 'strong' | 'moderate' | 'weak';
  /** 相关引用 */
  references?: string[];
  /** 数据来源 */
  dataPoints?: {
    sampleSize?: number;
    effectSize?: number;
    pValue?: number;
    confidenceInterval?: [number, number];
  };
}

/**
 * 混杂因素
 */
export interface Confounder {
  /** 混杂因素ID */
  id: string;
  /** 混杂因素名称 */
  name: string;
  /** 影响的变量对 */
  affectsPair: [string, string];
  /** 混杂机制 */
  mechanism: string;
  /** 是否可观测 */
  observable: boolean;
  /** 控制方法 */
  controlMethods?: ('stratification' | 'matching' | 'regression' | 'iv' | 'did' | 'rd')[];
}

// ============================================================================
// 结构化因果模型（SCM）
// ============================================================================

/**
 * 结构方程
 */
export interface StructuralEquation {
  /** 目标变量ID */
  targetVariable: string;
  /** 父变量（原因变量）ID列表 */
  parentVariables: string[];
  /** 函数形式 */
  functionalForm: 'linear' | 'nonlinear' | 'threshold' | 'probabilistic' | 'neural' | 'llm';
  /** 函数参数 */
  parameters?: {
    coefficients?: Record<string, number>;
    intercept?: number;
    threshold?: number;
    distribution?: string;
    customFunction?: string;
  };
  /** 噪声项 */
  noiseTerm?: {
    distribution: 'normal' | 'uniform' | 'exponential' | 'custom';
    params?: Record<string, number>;
  };
  /** 描述（自然语言形式） */
  description?: string;
  /** LLM生成的推理规则 */
  llmRule?: string;
}

/**
 * 结构化因果模型（SCM）
 */
export interface StructuralCausalModel {
  /** 模型ID */
  id: string;
  /** 模型名称 */
  name: string;
  /** 模型描述 */
  description?: string;
  /** 领域 */
  domain: string;
  /** 变量集合 */
  variables: CausalVariable[];
  /** 因果边集合 */
  edges: CausalEdge[];
  /** 结构方程集合 */
  structuralEquations: StructuralEquation[];
  /** 外生变量（噪声变量） */
  exogenousVariables: string[];
  /** 内生变量 */
  endogenousVariables: string[];
  /** 混杂因素 */
  confounders?: Confounder[];
  /** 模型假设 */
  assumptions?: string[];
  /** 模型验证状态 */
  validation?: {
    isValid: boolean;
    issues?: string[];
    lastValidated?: string;
  };
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt?: string;
}

/**
 * 因果图（DAG）
 */
export interface CausalGraph {
  /** 图ID */
  id: string;
  /** 节点（变量） */
  nodes: CausalVariable[];
  /** 边（因果关系） */
  edges: CausalEdge[];
  /** 拓扑排序 */
  topologicalOrder?: string[];
  /** 图统计 */
  statistics?: {
    nodeCount: number;
    edgeCount: number;
    avgInDegree: number;
    avgOutDegree: number;
    longestPath: number;
    cycles: string[][]; // 理论上DAG无环，但用于检测
  };
}

// ============================================================================
// 因果推断操作
// ============================================================================

/**
 * 干预操作 (do-operator)
 */
export interface Intervention {
  /** 干预ID */
  id: string;
  /** 干预变量ID */
  variable: string;
  /** 干预值 */
  value: any;
  /** 干预类型 */
  type: 'set' | 'shift' | 'scale' | 'conditional';
  /** 干预描述 */
  description?: string;
  /** 干预条件 */
  condition?: {
    variable: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
    value: any;
  };
}

/**
 * 反事实场景
 */
export interface CounterfactualScenario {
  /** 场景ID */
  id: string;
  /** 场景名称 */
  name: string;
  /** 事实状态（实际发生） */
  factualState: VariableState[];
  /** 反事实干预 */
  counterfactualIntervention: Intervention;
  /** 反事实假设 */
  assumptions?: string[];
  /** 共同原因（需要保持不变） */
  heldConstant?: string[];
}

/**
 * 反事实结果
 */
export interface CounterfactualResult {
  scenarioId: string;
  /** 反事实状态 */
  counterfactualState: VariableState[];
  /** 因果效应 */
  causalEffect: {
    variable: string;
    factualValue: any;
    counterfactualValue: any;
    difference: number;
    probabilityOfNecessity?: number; // PN
    probabilityOfSufficiency?: number; // PS
    probabilityOfNecessityAndSufficiency?: number; // PNS
  }[];
  /** 路径分析 */
  pathwayAnalysis: {
    directEffect?: number;
    indirectEffects?: {
      path: string[];
      effect: number;
    }[];
    totalEffect: number;
  };
  /** 置信度 */
  confidence: number;
  /** 解释 */
  explanation: string;
  /** 不确定性 */
  uncertainty?: {
    lowerBound: number;
    upperBound: number;
    confidenceLevel: number;
  };
}

// ============================================================================
// 因果推断查询
// ============================================================================

/**
 * 因果查询类型
 */
export type CausalQueryType = 
  | 'effect_of_intervention'  // P(Y|do(X))
  | 'conditional_effect'      // P(Y|do(X), Z=z)
  | 'counterfactual'          // P(Y_x|X=x', Y=y')
  | 'mediation'               // 直接/间接效应
  | 'identifiability'         // 可识别性判断
  | 'causal_effect'           // 平均因果效应 ACE
  | 'policy_evaluation';      // 政策评估

/**
 * 因果查询
 */
export interface CausalQuery {
  /** 查询ID */
  id: string;
  /** 查询类型 */
  type: CausalQueryType;
  /** 目标变量 */
  targetVariable: string;
  /** 干预变量 */
  interventionVariables?: string[];
  /** 条件变量 */
  conditioningVariables?: string[];
  /** 查询描述 */
  description: string;
  /** 反事实设定（如适用） */
  counterfactual?: CounterfactualScenario;
  /** 查询参数 */
  parameters?: Record<string, any>;
}

/**
 * 因果查询结果
 */
export interface CausalQueryResult {
  queryId: string;
  /** 查询是否可识别 */
  identifiable: boolean;
  /** 不可识别原因 */
  unidentifiableReason?: string;
  /** 估算结果 */
  estimate?: {
    value: number;
    type: 'probability' | 'expectation' | 'effect_size';
    distribution?: {
      type: string;
      params: Record<string, number>;
    };
  };
  /** 置信区间 */
  confidenceInterval?: [number, number];
  /** 置信水平 */
  confidenceLevel: number;
  /** 估算方法 */
  estimationMethod: string;
  /** 计算过程（调整公式） */
  adjustmentFormula?: string;
  /** 调整集 */
  adjustmentSet?: string[];
  /** 敏感性分析 */
  sensitivityAnalysis?: {
    robustnessScore: number;
    unmeasuredConfounderImpact: string;
    eValue?: number; // E-value for unmeasured confounding
  };
  /** 解释 */
  explanation: string;
  /** 警告 */
  warnings?: string[];
  /** 计算耗时 */
  computationTime?: number;
}

// ============================================================================
// 因果发现结果
// ============================================================================

/**
 * 发现的因果关系
 */
export interface DiscoveredCausalRelation {
  /** 原因 */
  cause: string;
  /** 结果 */
  effect: string;
  /** 关系类型 */
  relationType: 'causal' | 'associational' | 'potential_causal' | 'undetermined';
  /** 置信度 */
  confidence: number;
  /** 发现方法 */
  discoveryMethod: 'statistical' | 'llm' | 'expert' | 'hybrid';
  /** 证据 */
  evidence: string[];
  /** 可能的混杂因素 */
  potentialConfounders?: string[];
  /** 反向因果可能性 */
  reverseCausality?: {
    possible: boolean;
    confidence: number;
    reasoning?: string;
  };
}

/**
 * 因果发现结果
 */
export interface CausalDiscoveryResult {
  /** 发现的因果关系 */
  relations: DiscoveredCausalRelation[];
  /** 发现的变量 */
  variables: string[];
  /** 建议的因果图 */
  suggestedGraph: {
    nodes: string[];
    edges: Array<{
      from: string;
      to: string;
      confidence: number;
    }>;
  };
  /** 检测到的混杂因素 */
  confounders: string[];
  /** 检测到的中介变量 */
  mediators: string[];
  /** 发现质量评估 */
  qualityAssessment: {
    coverage: number;
    consistency: number;
    overallScore: number;
  };
  /** 建议 */
  recommendations: string[];
}

// ============================================================================
// 政策模拟
// ============================================================================

/**
 * 政策干预
 */
export interface PolicyIntervention {
  /** 政策ID */
  id: string;
  /** 政策名称 */
  name: string;
  /** 政策描述 */
  description: string;
  /** 干预集合 */
  interventions: Intervention[];
  /** 政策参数 */
  parameters?: Record<string, any>;
  /** 实施条件 */
  preconditions?: string[];
  /** 预期目标 */
  objectives?: string[];
  /** 时间范围 */
  timeHorizon?: string;
}

/**
 * 政策模拟结果
 */
export interface PolicySimulationResult {
  policyId: string;
  /** 短期影响 */
  shortTermEffects: {
    variable: string;
    baselineValue: any;
    simulatedValue: any;
    change: number;
    confidence: number;
  }[];
  /** 中长期影响 */
  longTermEffects: {
    variable: string;
    projectedValues: {
      time: string;
      value: any;
      confidence: number;
    }[];
  }[];
  /** 意外后果 */
  unintendedConsequences?: {
    variable: string;
    effect: string;
    probability: number;
    severity: 'low' | 'medium' | 'high';
  }[];
  /** 对中国市场的影响 */
  chinaMarketImpact?: {
    overallAssessment: string;
    sectorImpacts: {
      sector: string;
      impact: 'positive' | 'negative' | 'neutral' | 'mixed';
      magnitude: number;
      description: string;
    }[];
    riskLevel: 'low' | 'medium' | 'high';
    opportunities: string[];
    challenges: string[];
  };
  /** 优化建议 */
  optimizationSuggestions?: string[];
  /** 置信度 */
  overallConfidence: number;
  /** 执行时间 */
  simulationTime?: number;
}

// ============================================================================
// 分析报告
// ============================================================================

/**
 * 因果分析报告
 */
export interface CausalAnalysisReport {
  /** 报告ID */
  id: string;
  /** 分析场景 */
  scenario: string;
  /** 因果模型 */
  causalModel: StructuralCausalModel;
  /** 因果发现结果 */
  discoveryResult?: CausalDiscoveryResult;
  /** 因果推断结果 */
  inferenceResults: CausalQueryResult[];
  /** 反事实分析 */
  counterfactualAnalysis?: CounterfactualResult[];
  /** 政策模拟 */
  policySimulations?: PolicySimulationResult[];
  /** 关键发现 */
  keyFindings: string[];
  /** 因果链条 */
  causalChains: string[][];
  /** 不确定性说明 */
  uncertaintyNotes: string[];
  /** 局限性 */
  limitations: string[];
  /** 后续研究建议 */
  furtherResearchSuggestions: string[];
  /** 生成时间 */
  generatedAt: string;
  /** 置信度 */
  overallConfidence: number;
}
