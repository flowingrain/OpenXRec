/**
 * 置信度校准服务
 * 
 * 整合所有校准组件：
 * 1. 置信度校准器
 * 2. 动态阈值调整器
 * 3. 多维度评估器
 * 
 * 提供统一的API接口
 */

import { ConfidenceCalibrator, createCalibrator } from './calibrator';
import { ThresholdAdjuster, createThresholdAdjuster } from './threshold-adjuster';
import { MultiDimensionalEvaluator, createMultiDimensionalEvaluator, RecommendedItemForAssessment } from './multi-dimensional';
import {
  CalibrationServiceConfig,
  DEFAULT_CALIBRATION_CONFIG,
  RecommendationFeedbackEvent,
  FeedbackAggregation,
  ConfidenceThresholds,
  CalibrationCurve,
  MultiDimensionalConfidence,
  ItemConfidenceAssessment,
  ThresholdAdjustmentRecord,
} from './types';

// ============================================================================
// 置信度校准服务类
// ============================================================================

export class ConfidenceCalibrationService {
  private config: CalibrationServiceConfig;
  private calibrator: ConfidenceCalibrator;
  private thresholdAdjuster: ThresholdAdjuster;
  private multiDimEvaluator: MultiDimensionalEvaluator;
  
  // 服务状态
  private isInitialized: boolean = false;
  private stats: {
    totalFeedbacks: number;
    lastUpdateTime: number;
    autoAdjustmentsCount: number;
  };

  constructor(config: Partial<CalibrationServiceConfig> = {}) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
    
    // 初始化组件
    this.calibrator = createCalibrator(this.config.calibrator);
    this.thresholdAdjuster = createThresholdAdjuster(
      this.config.thresholdStrategy
    );
    this.multiDimEvaluator = createMultiDimensionalEvaluator();
    
    this.stats = {
      totalFeedbacks: 0,
      lastUpdateTime: Date.now(),
      autoAdjustmentsCount: 0,
    };
    
    this.isInitialized = true;
  }

  // ===========================================================================
  // 反馈收集接口
  // ===========================================================================

  /**
   * 记录反馈事件
   */
  recordFeedback(event: RecommendationFeedbackEvent): void {
    // 添加到校准器
    this.calibrator.addFeedback(event);
    
    // 更新统计
    this.stats.totalFeedbacks += 1;
    this.stats.lastUpdateTime = Date.now();
    
    // 尝试自动阈值调整
    if (this.config.autoAdjustThresholds) {
      this.tryAutoAdjustThresholds();
    }
  }

  /**
   * 批量记录反馈
   */
  recordFeedbackBatch(events: RecommendationFeedbackEvent[]): void {
    events.forEach(event => this.calibrator.addFeedback(event));
    this.stats.totalFeedbacks += events.length;
    this.stats.lastUpdateTime = Date.now();
    
    if (this.config.autoAdjustThresholds) {
      this.tryAutoAdjustThresholds();
    }
  }

  // ===========================================================================
  // 置信度校准接口
  // ===========================================================================

  /**
   * 校准置信度
   */
  calibrateConfidence(rawConfidence: number, decision?: string): number {
    return this.calibrator.calibrate(rawConfidence, decision);
  }

  /**
   * 获取校准曲线
   */
  getCalibrationCurve(): CalibrationCurve | null {
    return this.calibrator.getCalibrationCurve();
  }

  /**
   * 获取反馈聚合统计
   */
  getFeedbackAggregation(windowDays?: number): FeedbackAggregation {
    return this.calibrator.getFeedbackAggregation(windowDays);
  }

  // ===========================================================================
  // 阈值管理接口
  // ===========================================================================

  /**
   * 获取当前阈值
   */
  getThresholds(): ConfidenceThresholds {
    return this.thresholdAdjuster.getThresholds();
  }

  /**
   * 手动设置阈值
   */
  setThresholds(thresholds: Partial<ConfidenceThresholds>): void {
    this.thresholdAdjuster.setThresholds(thresholds);
  }

  /**
   * 根据置信度确定决策类型
   */
  classifyConfidence(confidence: number): {
    level: 'high' | 'medium' | 'low';
    decision: 'high_confidence_search' | 'high_confidence_skip_search' | 'medium_confidence_verify' | 'low_confidence_force_search';
  } {
    return this.thresholdAdjuster.classifyConfidence(confidence);
  }

  /**
   * 获取阈值调整历史
   */
  getThresholdAdjustmentHistory(limit?: number): ThresholdAdjustmentRecord[] {
    return this.thresholdAdjuster.getAdjustmentHistory(limit);
  }

  // ===========================================================================
  // 多维度评估接口
  // ===========================================================================

  /**
   * 评估推荐项置信度
   */
  assessItemConfidence(
    item: RecommendedItemForAssessment,
    context: {
      query: string;
      sources: string[];
      hasKnowledge: boolean;
      hasWebSearch: boolean;
      intentConfidence: number;
    }
  ): ItemConfidenceAssessment {
    const assessment = this.multiDimEvaluator.assessItemConfidence(item, context);
    
    // 应用校准
    assessment.calibratedConfidence = this.calibrator.calibrate(assessment.confidence.overall);
    
    return assessment;
  }

  /**
   * 批量评估推荐项
   */
  assessItemsBatch(
    items: RecommendedItemForAssessment[],
    context: {
      query: string;
      sources: string[];
      hasKnowledge: boolean;
      hasWebSearch: boolean;
      intentConfidence: number;
    }
  ): ItemConfidenceAssessment[] {
    return this.multiDimEvaluator.assessBatch(items, context).map(assessment => {
      assessment.calibratedConfidence = this.calibrator.calibrate(assessment.confidence.overall);
      return assessment;
    });
  }

  // ===========================================================================
  // 综合接口
  // ===========================================================================

  /**
   * 获取服务状态
   */
  getStatus(): {
    isInitialized: boolean;
    bufferSize: number;
    totalFeedbacks: number;
    lastUpdateTime: number;
    autoAdjustmentsCount: number;
    currentThresholds: ConfidenceThresholds;
    calibrationReady: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      bufferSize: this.calibrator.getBufferSize(),
      totalFeedbacks: this.stats.totalFeedbacks,
      lastUpdateTime: this.stats.lastUpdateTime,
      autoAdjustmentsCount: this.stats.autoAdjustmentsCount,
      currentThresholds: this.thresholdAdjuster.getThresholds(),
      calibrationReady: this.calibrator.getBufferSize() >= this.config.calibrator.minSamples,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): CalibrationServiceConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CalibrationServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 尝试自动调整阈值
   */
  private tryAutoAdjustThresholds(): void {
    const aggregation = this.calibrator.getFeedbackAggregation();
    const adjustment = this.thresholdAdjuster.adjust(aggregation);
    
    if (adjustment) {
      this.stats.autoAdjustmentsCount += 1;
      console.log('[CalibrationService] Threshold adjusted:', {
        high: adjustment.newThresholds.high.toFixed(3),
        low: adjustment.newThresholds.low.toFixed(3),
        reason: adjustment.reason,
      });
    }
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let serviceInstance: ConfidenceCalibrationService | null = null;

/**
 * 获取校准服务实例（单例）
 */
export function getCalibrationService(
  config?: Partial<CalibrationServiceConfig>
): ConfidenceCalibrationService {
  if (!serviceInstance) {
    serviceInstance = new ConfidenceCalibrationService(config);
  }
  return serviceInstance;
}

/**
 * 创建新的校准服务实例
 */
export function createCalibrationService(
  config?: Partial<CalibrationServiceConfig>
): ConfidenceCalibrationService {
  return new ConfidenceCalibrationService(config);
}

// ============================================================================
// 便捷工具函数
// ============================================================================

/**
 * 创建反馈事件
 */
export function createFeedbackEvent(
  data: Partial<RecommendationFeedbackEvent>
): RecommendationFeedbackEvent {
  return {
    id: data.id || `fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    userId: data.userId || 'anonymous',
    requestId: data.requestId || '',
    timestamp: data.timestamp || Date.now(),
    intentConfidence: data.intentConfidence ?? 0.5,
    itemConfidences: data.itemConfidences,
    decision: data.decision || 'medium_confidence_verify',
    predictionSource: data.predictionSource || 'llm',
    searchExecuted: data.searchExecuted ?? false,
    satisfied: data.satisfied ?? null,
    clickedItems: data.clickedItems || [],
    likedItems: data.likedItems || [],
    rating: data.rating ?? null,
    converted: data.converted ?? false,
    searchUseful: data.searchUseful ?? null,
    relevanceScore: data.relevanceScore ?? null,
    dwellTime: data.dwellTime ?? null,
    scenario: data.scenario || 'general',
    query: data.query || '',
  };
}
