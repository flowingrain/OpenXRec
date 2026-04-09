/**
 * 自适应优化持久化类型定义
 * 
 * 用于 Supabase 存储反馈数据、校准状态和优化历史
 */

// ============================================================================
// 数据库表结构类型
// ============================================================================

/**
 * 意图反馈记录表
 */
export interface IntentFeedbackRecord {
  id: string;
  user_id: string;
  session_id?: string;
  
  // 查询信息
  query: string;
  scenario: string;
  
  // 预测结果
  predicted_needs_search: boolean;
  predicted_confidence: number;
  prediction_source: 'llm' | 'rule_fallback' | 'history_fallback';
  
  // 实际结果
  actual_needs_search: boolean;
  actual_outcome: 'correct' | 'incorrect' | 'unknown';
  
  // 匹配的关键词
  matched_keywords: string[];
  
  // 元数据
  metadata?: {
    response_quality?: 'high' | 'medium' | 'low' | 'none';
    user_satisfied?: boolean;
    dwell_time_ms?: number;
    [key: string]: any;
  };
  
  // 时间戳
  created_at: string;
}

/**
 * 关键词规则表
 */
export interface KeywordRuleRecord {
  id: string;
  keyword: string;
  category: 'search' | 'no_search' | 'ambiguous';
  
  // 统计信息
  match_count: number;
  correct_count: number;
  confidence: number;
  
  // 来源
  source: 'initial' | 'learned' | 'expert';
  
  // 版本控制
  version: number;
  
  // 时间戳
  created_at: string;
  updated_at: string;
  last_matched_at?: string;
}

/**
 * 置信度校准数据表
 */
export interface CalibrationBinRecord {
  id: string;
  bin_index: number;
  bin_start: number;
  bin_end: number;
  
  // 统计信息
  predicted_count: number;
  correct_count: number;
  actual_accuracy: number;
  
  // 时间窗口
  time_window_start: string;
  time_window_end: string;
  
  // 更新时间
  updated_at: string;
}

/**
 * 兜底策略状态表
 */
export interface FallbackStateRecord {
  id: string;
  level_name: string;
  priority: number;
  
  // 状态
  enabled: boolean;
  current_level: boolean;
  
  // 统计
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_response_time_ms: number;
  
  // 时间戳
  last_used_at?: string;
  updated_at: string;
}

/**
 * A/B测试实验表
 */
export interface ABTestExperimentRecord {
  id: string;
  experiment_name: string;
  description?: string;
  
  // 实验配置
  variant_a: {
    type: 'calibration_method' | 'threshold' | 'keyword_set' | 'hyperparam_config';
    config: Record<string, any>;
  };
  variant_b: {
    type: 'calibration_method' | 'threshold' | 'keyword_set' | 'hyperparam_config';
    config: Record<string, any>;
  };
  
  // 流量分配
  traffic_split: number; // 0-100, A组流量百分比
  
  // 状态
  status: 'draft' | 'running' | 'paused' | 'completed';
  
  // 时间
  start_time?: string;
  end_time?: string;
  created_at: string;
  updated_at: string;
}

/**
 * A/B测试事件表
 */
export interface ABTestEventRecord {
  id: string;
  experiment_id: string;
  user_id: string;
  
  // 分组
  variant: 'A' | 'B';
  
  // 事件
  event_type: 'prediction' | 'outcome';
  event_data: {
    query?: string;
    predicted_needs_search?: boolean;
    predicted_confidence?: number;
    actual_needs_search?: boolean;
    is_correct?: boolean;
    response_quality?: string;
  };
  
  // 时间戳
  created_at: string;
}

/**
 * 优化历史表
 */
export interface OptimizationHistoryRecord {
  id: string;
  optimization_type: 'keyword_update' | 'calibration' | 'fallback_adjustment';
  
  // 变更内容
  changes: {
    before: Record<string, any>;
    after: Record<string, any>;
    reason: string;
  };
  
  // 效果评估
  metrics?: {
    accuracy_before?: number;
    accuracy_after?: number;
    improvement?: number;
  };
  
  // 触发方式
  trigger: 'auto' | 'manual' | 'scheduled';
  
  // 时间戳
  created_at: string;
}

// ============================================================================
// PPO 超参数持久化类型
// ============================================================================

/**
 * PPO 超参数版本记录
 */
export interface PPOHyperparamVersionRecord {
  id: string;
  version: number;
  
  // 超参数配置
  config: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
  };
  
  // 性能指标
  performance?: {
    avgReward: number;
    avgLoss: number;
    avgKl: number;
    trend: 'improving' | 'stable' | 'degrading';
    sampleCount: number;
  };
  
  // 状态
  is_active: boolean;
  is_verified: boolean;  // 专家审核通过
  
  // 来源
  source: 'auto' | 'manual' | 'rollback';
  
  // 元数据
  parent_version?: number;
  tags: string[];
  notes?: string;
  
  // 时间戳
  created_at: string;
  created_by: string;  // 'system' | 'expert' | userId
}

/**
 * PPO 训练历史记录
 */
export interface PPOTrainingHistoryRecord {
  id: string;
  session_id: string;
  epoch: number;
  
  // 超参数快照
  hyperparams: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
  };
  
  // 训练指标
  metrics: {
    policyLoss: number;
    valueLoss: number;
    entropy: number;
    klDivergence: number;
    clipFraction: number;
    avgReward: number;
    explainedVariance: number;
  };
  
  // 调整信息
  adaptation?: {
    adapted: boolean;
    reason: string;
    recommendations: string[];
  };
  
  // 时间戳
  created_at: string;
}

/**
 * PPO 超参数知识库
 */
export interface PPOHyperparamKnowledgeRecord {
  id: string;
  
  // 知识类型
  knowledge_type: 'correlation' | 'pattern' | 'constraint' | 'best_practice';
  
  // 参数名
  param_name: string;
  
  // 知识内容
  knowledge: {
    description: string;
    value?: number | string;
    range?: { min: number; max: number };
    conditions?: Record<string, any>;
    related_params?: string[];
  };
  
  // 置信度
  confidence: number;
  
  // 样本统计
  sample_count: number;
  success_count: number;
  
  // 来源
  source: 'learned' | 'expert' | 'literature';
  
  // 时间戳
  last_updated: string;
  created_at: string;
}

/**
 * PPO 调整规则
 */
export interface PPOAdjustmentRuleRecord {
  id: string;
  
  // 触发条件
  trigger_condition: {
    metric: string;           // 'klDivergence' | 'entropy' | 'avgReward' | 'policyLoss'
    operator: 'gt' | 'lt' | 'eq' | 'between';
    value: number | [number, number];
    consecutive_count?: number; // 连续满足多少次
  };
  
  // 调整动作
  adjustment_action: {
    param: string;            // 'learningRate' | 'clipEpsilon' | 'entropyCoef' | 'gaeLambda'
    action: 'increase' | 'decrease' | 'set' | 'reset';
    value?: number;
    factor?: number;          // 乘以多少
    bounds?: { min: number; max: number };
  };
  
  // 优先级
  priority: number;
  
  // 状态
  enabled: boolean;
  expert_verified: boolean;
  
  // 效果统计
  stats?: {
    trigger_count: number;
    success_count: number;
    avg_improvement: number;
  };
  
  // 时间戳
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 在线学习类型
// ============================================================================

/**
 * 在线学习配置
 */
export interface OnlineLearningConfig {
  // 增量更新
  enableIncrementalUpdate: boolean;
  updateIntervalMs: number;        // 更新间隔
  minSamplesForUpdate: number;     // 最小样本数
  
  // 遗忘因子
  forgettingFactor: number;        // 0-1, 越小遗忘越快
  
  // 自适应学习率
  adaptiveLearningRate: boolean;
  initialLearningRate: number;
  minLearningRate: number;
  maxLearningRate: number;
  
  // 冷启动策略
  coldStartStrategy: 'uniform' | 'prior' | 'transfer';
  priorStrength: number;           // 先验强度
}

/**
 * 默认在线学习配置
 */
export const DEFAULT_ONLINE_LEARNING_CONFIG: OnlineLearningConfig = {
  enableIncrementalUpdate: true,
  updateIntervalMs: 5000,          // 5秒
  minSamplesForUpdate: 5,          // 5个样本即可开始
  forgettingFactor: 0.95,
  adaptiveLearningRate: true,
  initialLearningRate: 0.1,
  minLearningRate: 0.001,
  maxLearningRate: 0.5,
  coldStartStrategy: 'prior',
  priorStrength: 10,               // 相当于10个虚拟样本
};

/**
 * 增量校准状态
 */
export interface IncrementalCalibrationState {
  // 每个区间的统计
  bins: Array<{
    binIndex: number;
    binStart: number;
    binEnd: number;
    
    // 在线统计
    sumWeights: number;            // 加权和
    sumCorrect: number;            // 正确数加权和
    count: number;                 // 样本数
    
    // 校准值
    calibratedValue: number;
    
    // 最后更新
    lastUpdate: number;
  }>;
  
  // 全局统计
  totalSamples: number;
  lastUpdateTime: number;
  
  // 学习率
  currentLearningRate: number;
}

// ============================================================================
// 可视化类型
// ============================================================================

/**
 * 校准曲线数据点
 */
export interface CalibrationCurvePoint {
  predictedProbability: number;
  actualAccuracy: number;
  sampleCount: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

/**
 * 仪表盘统计数据
 */
export interface DashboardStats {
  // 总览
  totalFeedbacks: number;
  totalKeywords: number;
  avgAccuracy: number;
  
  // 趋势
  accuracyTrend: Array<{
    time: string;
    accuracy: number;
    sampleCount: number;
  }>;
  
  // 关键词效果
  topKeywords: Array<{
    keyword: string;
    category: string;
    accuracy: number;
    matchCount: number;
  }>;
  
  // 校准曲线
  calibrationCurve: CalibrationCurvePoint[];
  
  // 兜底策略
  fallbackStats: Array<{
    level: string;
    successRate: number;
    usageCount: number;
  }>;
  
  // A/B测试
  activeExperiments: Array<{
    id: string;
    name: string;
    variantAPerformance: number;
    variantBPerformance: number;
    significance: number;
  }>;
}

// ============================================================================
// PPO A/B 测试类型
// ============================================================================

/**
 * PPO 超参数 A/B 测试配置
 */
export interface PPOHyperparamABTestConfig {
  // 变体名称
  name: string;
  
  // 超参数配置
  hyperparams: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
  };
  
  // 描述
  description?: string;
  
  // 来源
  source: 'manual' | 'version' | 'optimized';
  versionId?: string;
}

/**
 * PPO A/B 测试结果
 */
export interface PPOABTestResult {
  experimentId: string;
  
  // 各变体性能
  variantA: {
    hyperparams: PPOHyperparamABTestConfig['hyperparams'];
    metrics: {
      sampleCount: number;
      avgReward: number;
      avgLoss: number;
      avgKl: number;
      convergenceRate: number;
      stability: number;
    };
  };
  
  variantB: {
    hyperparams: PPOHyperparamABTestConfig['hyperparams'];
    metrics: {
      sampleCount: number;
      avgReward: number;
      avgLoss: number;
      avgKl: number;
      convergenceRate: number;
      stability: number;
    };
  };
  
  // 统计检验
  statisticalTest: {
    testType: 't_test' | 'mann_whitney' | 'bootstrap';
    pValue: number;
    confidenceLevel: number;
    effectSize: number;          // Cohen's d
    significance: 'significant' | 'not_significant';
  };
  
  // 推荐
  recommendation: {
    winner: 'A' | 'B' | 'inconclusive';
    confidence: number;
    reason: string;
  };
  
  // 时间戳
  timestamp: string;
}

/**
 * 统计显著性检验配置
 */
export interface StatisticalTestConfig {
  testType: 't_test' | 'mann_whitney' | 'bootstrap';
  alpha: number;              // 显著性水平，默认 0.05
  power: number;              // 统计功效，默认 0.8
  minSampleSize: number;      // 最小样本量
  bootstrapSamples?: number;  // Bootstrap 重采样次数
}

/**
 * 统计显著性检验结果
 */
export interface StatisticalTestResult {
  testType: string;
  statistic: number;
  pValue: number;
  isSignificant: boolean;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  effectSize: number;
  power: number;
}
