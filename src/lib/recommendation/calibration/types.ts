/**
 * 置信度校准系统 - 类型定义
 * 
 * 功能：
 * 1. 置信度校准：收集反馈数据，优化置信度准确性
 * 2. 阈值调整：根据实际效果调整高低置信度阈值
 * 3. 多维度评估：扩展到推荐结果的置信度评估
 */

// ============================================================================
// 反馈数据类型
// ============================================================================

/**
 * 推荐反馈事件
 */
export interface RecommendationFeedbackEvent {
  /** 事件ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 请求ID */
  requestId: string;
  /** 时间戳 */
  timestamp: number;
  
  // 预测信息
  /** 意图分析预测的置信度 */
  intentConfidence: number;
  /** 推荐项置信度（如果有） */
  itemConfidences?: number[];
  /** 决策类型 */
  decision: 'high_confidence_search' | 'high_confidence_skip_search' | 'medium_confidence_verify' | 'low_confidence_force_search';
  /** 预测来源 */
  predictionSource: 'llm' | 'rule_fallback';
  /** 是否执行了搜索 */
  searchExecuted: boolean;
  
  // 实际结果
  /** 用户是否满意（综合评价） */
  satisfied: boolean | null;
  /** 用户是否点击了推荐项 */
  clickedItems: string[];
  /** 用户点赞的推荐项 */
  likedItems: string[];
  /** 用户评分（1-5） */
  rating: number | null;
  /** 是否购买/转化 */
  converted: boolean;
  
  // 结果评估
  /** 搜索结果是否有价值（如果有搜索） */
  searchUseful: boolean | null;
  /** 推荐结果相关性评分（1-5） */
  relevanceScore: number | null;
  /** 用户停留时间（秒） */
  dwellTime: number | null;
  
  // 元数据
  /** 场景 */
  scenario: string;
  /** 查询文本 */
  query: string;
}

/**
 * 反馈聚合统计
 */
export interface FeedbackAggregation {
  /** 时间窗口开始 */
  windowStart: number;
  /** 时间窗口结束 */
  windowEnd: number;
  /** 样本数量 */
  sampleCount: number;
  
  // 按置信度分组的统计
  /** 高置信度(>0.8)的准确率 */
  highConfidenceAccuracy: number;
  /** 中置信度(0.5-0.8)的准确率 */
  mediumConfidenceAccuracy: number;
  /** 低置信度(<0.5)的准确率 */
  lowConfidenceAccuracy: number;
  
  // 按决策类型分组的统计
  decisionStats: {
    high_confidence_search: DecisionStats;
    high_confidence_skip_search: DecisionStats;
    medium_confidence_verify: DecisionStats;
    low_confidence_force_search: DecisionStats;
  };
  
  // 按预测来源分组的统计
  llmAccuracy: number;
  ruleFallbackAccuracy: number;
}

/**
 * 决策类型统计
 */
export interface DecisionStats {
  count: number;
  accuracy: number;
  avgSatisfaction: number;
  avgRating: number;
  conversionRate: number;
  avgDwellTime: number;
}

// ============================================================================
// 校准曲线类型
// ============================================================================

/**
 * 校准曲线数据点
 */
export interface CalibrationPoint {
  /** 置信度区间（如0.8-0.9） */
  confidenceBin: [number, number];
  /** 该区间内的预测数量 */
  count: number;
  /** 实际准确率 */
  actualAccuracy: number;
  /** 平均预测置信度 */
  avgPredictedConfidence: number;
  /** 校准误差（预测置信度 - 实际准确率） */
  calibrationError: number;
}

/**
 * 校准曲线
 */
export interface CalibrationCurve {
  /** 创建时间 */
  createdAt: number;
  /** 样本总数 */
  totalSamples: number;
  /** 数据点 */
  points: CalibrationPoint[];
  /** 期望校准误差（ECE） */
  expectedCalibrationError: number;
  /** 最大校准误差（MCE） */
  maxCalibrationError: number;
  /** 校准系数（用于调整） */
  calibrationCoefficients: number[];
}

/**
 * 校准方法
 */
export type CalibrationMethod = 
  | 'isotonic_regression'   // 保序回归
  | 'platt_scaling'         // Platt缩放
  | 'beta_scaling'          // Beta缩放
  | 'histogram_binning';    // 直方图分箱

/**
 * 校准器配置
 */
export interface CalibratorConfig {
  /** 校准方法 */
  method: CalibrationMethod;
  /** 最小样本数（低于此数不更新校准） */
  minSamples: number;
  /** 置信度分箱数量 */
  numBins: number;
  /** 学习率（用于在线更新） */
  learningRate: number;
  /** 滑动窗口大小（天） */
  windowDays: number;
}

// ============================================================================
// 动态阈值类型
// ============================================================================

/**
 * 置信度阈值配置
 */
export interface ConfidenceThresholds {
  /** 高置信度阈值 */
  high: number;        // 默认 0.8
  /** 低置信度阈值 */
  low: number;         // 默认 0.5
  /** 最后更新时间 */
  lastUpdated: number;
  /** 更新次数 */
  updateCount: number;
}

/**
 * 阈值调整策略
 */
export interface ThresholdAdjustmentStrategy {
  /** 策略名称 */
  name: string;
  /** 调整周期（小时） */
  adjustIntervalHours: number;
  /** 最大单次调整幅度 */
  maxAdjustment: number;
  /** 目标准确率 */
  targetAccuracy: number;
  /** 最小样本数 */
  minSamples: number;
}

/**
 * 阈值调整记录
 */
export interface ThresholdAdjustmentRecord {
  /** 时间戳 */
  timestamp: number;
  /** 旧阈值 */
  oldThresholds: ConfidenceThresholds;
  /** 新阈值 */
  newThresholds: ConfidenceThresholds;
  /** 调整原因 */
  reason: string;
  /** 调整前的准确率 */
  beforeAccuracy: number;
  /** 调整后的准确率（后续验证） */
  afterAccuracy: number | null;
  /** 触发调整的统计 */
  triggerStats: FeedbackAggregation;
}

// ============================================================================
// 多维度置信度评估类型
// ============================================================================

/**
 * 多维度置信度
 */
export interface MultiDimensionalConfidence {
  /** 整体置信度 */
  overall: number;
  
  /** 意图理解置信度 */
  intentUnderstanding: {
    confidence: number;
    factors: ConfidenceFactor[];
  };
  
  /** 信息检索置信度 */
  informationRetrieval: {
    confidence: number;
    factors: ConfidenceFactor[];
  };
  
  /** 推荐生成置信度 */
  recommendationGeneration: {
    confidence: number;
    factors: ConfidenceFactor[];
  };
  
  /** 来源可信度 */
  sourceReliability: {
    confidence: number;
    factors: ConfidenceFactor[];
  };
}

/**
 * 置信度因素
 */
export interface ConfidenceFactor {
  /** 因素名称 */
  name: string;
  /** 因素描述 */
  description: string;
  /** 因素得分（0-1） */
  score: number;
  /** 权重 */
  weight: number;
  /** 来源 */
  source: 'llm' | 'rule' | 'data';
}

/**
 * 推荐项置信度评估
 */
export interface ItemConfidenceAssessment {
  /** 物品ID */
  itemId: string;
  /** 多维度置信度 */
  confidence: MultiDimensionalConfidence;
  /** 校准后的置信度 */
  calibratedConfidence: number;
  /** 置信度解释 */
  explanation: string;
}

// ============================================================================
// 校准服务配置
// ============================================================================

/**
 * 置信度校准服务配置
 */
export interface CalibrationServiceConfig {
  /** 校准器配置 */
  calibrator: CalibratorConfig;
  /** 阈值调整策略 */
  thresholdStrategy: ThresholdAdjustmentStrategy;
  /** 是否启用自动阈值调整 */
  autoAdjustThresholds: boolean;
  /** 是否启用多维度评估 */
  enableMultiDimensional: boolean;
  /** 反馈缓冲区大小 */
  feedbackBufferSize: number;
  /** 持久化存储类型 */
  storageType: 'memory' | 'supabase';
}

/**
 * 默认配置
 */
export const DEFAULT_CALIBRATION_CONFIG: CalibrationServiceConfig = {
  calibrator: {
    method: 'histogram_binning',
    minSamples: 100,
    numBins: 10,
    learningRate: 0.1,
    windowDays: 7,
  },
  thresholdStrategy: {
    name: 'adaptive',
    adjustIntervalHours: 24,
    maxAdjustment: 0.05,
    targetAccuracy: 0.85,
    minSamples: 50,
  },
  autoAdjustThresholds: true,
  enableMultiDimensional: true,
  feedbackBufferSize: 1000,
  storageType: 'memory',
};
