/**
 * 动态阈值调整器
 * 
 * 根据实际效果自动调整置信度阈值：
 * - 高置信度阈值（默认0.8）
 * - 低置信度阈值（默认0.5）
 */

import {
  ConfidenceThresholds,
  ThresholdAdjustmentStrategy,
  ThresholdAdjustmentRecord,
  FeedbackAggregation,
} from './types';

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_THRESHOLD_STRATEGY: ThresholdAdjustmentStrategy = {
  name: 'adaptive',
  adjustIntervalHours: 24,
  maxAdjustment: 0.05,
  targetAccuracy: 0.85,
  minSamples: 50,
};

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  high: 0.8,
  low: 0.5,
  lastUpdated: Date.now(),
  updateCount: 0,
};

// ============================================================================
// 阈值调整器类
// ============================================================================

export class ThresholdAdjuster {
  private strategy: ThresholdAdjustmentStrategy;
  private currentThresholds: ConfidenceThresholds;
  private adjustmentHistory: ThresholdAdjustmentRecord[] = [];
  private lastAdjustmentTime: number = 0;

  constructor(
    strategy: Partial<ThresholdAdjustmentStrategy> = {},
    initialThresholds: Partial<ConfidenceThresholds> = {}
  ) {
    this.strategy = { ...DEFAULT_THRESHOLD_STRATEGY, ...strategy };
    this.currentThresholds = { ...DEFAULT_THRESHOLDS, ...initialThresholds };
  }

  // ===========================================================================
  // 核心接口
  // ===========================================================================

  /**
   * 获取当前阈值
   */
  getThresholds(): ConfidenceThresholds {
    return { ...this.currentThresholds };
  }

  /**
   * 手动设置阈值
   */
  setThresholds(thresholds: Partial<ConfidenceThresholds>): void {
    const oldThresholds = { ...this.currentThresholds };
    this.currentThresholds = {
      ...this.currentThresholds,
      ...thresholds,
      lastUpdated: Date.now(),
      updateCount: this.currentThresholds.updateCount + 1,
    };
    
    // 记录调整历史
    this.recordAdjustment(oldThresholds, 'manual_adjustment', 0);
  }

  /**
   * 检查是否需要调整
   */
  shouldAdjust(aggregation: FeedbackAggregation): boolean {
    // 检查样本数是否足够
    if (aggregation.sampleCount < this.strategy.minSamples) {
      return false;
    }
    
    // 检查调整间隔
    const hoursSinceLastAdjustment = 
      (Date.now() - this.lastAdjustmentTime) / (1000 * 60 * 60);
    if (hoursSinceLastAdjustment < this.strategy.adjustIntervalHours) {
      return false;
    }
    
    return true;
  }

  /**
   * 自动调整阈值
   * 
   * 调整逻辑：
   * 1. 高置信度区域准确率低于目标 → 提高高阈值
   * 2. 低置信度区域准确率高于目标 → 降低低阈值
   * 3. 中置信度区域准确率异常 → 调整两个阈值
   */
  adjust(aggregation: FeedbackAggregation): ThresholdAdjustmentRecord | null {
    if (!this.shouldAdjust(aggregation)) {
      return null;
    }
    
    const oldThresholds = { ...this.currentThresholds };
    const adjustments: string[] = [];
    let newHigh = this.currentThresholds.high;
    let newLow = this.currentThresholds.low;
    
    const targetAcc = this.strategy.targetAccuracy;
    const maxAdj = this.strategy.maxAdjustment;
    
    // 分析高置信度区域
    if (aggregation.highConfidenceAccuracy < targetAcc - 0.1) {
      // 高置信度准确率过低，提高阈值
      const adjustment = Math.min(
        maxAdj,
        (targetAcc - aggregation.highConfidenceAccuracy) * 0.5
      );
      newHigh = Math.min(0.95, newHigh + adjustment);
      adjustments.push(`提高高阈值(${adjustment.toFixed(3)})，因高置信度准确率(${(aggregation.highConfidenceAccuracy * 100).toFixed(1)}%)低于目标`);
    } else if (aggregation.highConfidenceAccuracy > targetAcc + 0.1) {
      // 高置信度准确率很高，可以适当降低阈值（更积极的信任）
      const adjustment = Math.min(maxAdj * 0.5, 
        (aggregation.highConfidenceAccuracy - targetAcc) * 0.3);
      newHigh = Math.max(0.7, newHigh - adjustment);
      adjustments.push(`降低高阈值(${adjustment.toFixed(3)})，因高置信度准确率(${(aggregation.highConfidenceAccuracy * 100).toFixed(1)}%)高于目标`);
    }
    
    // 分析低置信度区域
    if (aggregation.lowConfidenceAccuracy > targetAcc) {
      // 低置信度准确率意外地高，可以降低阈值（减少过度谨慎）
      const adjustment = Math.min(maxAdj * 0.5,
        (aggregation.lowConfidenceAccuracy - targetAcc) * 0.3);
      newLow = Math.max(0.3, newLow - adjustment);
      adjustments.push(`降低低阈值(${adjustment.toFixed(3)})，因低置信度准确率(${(aggregation.lowConfidenceAccuracy * 100).toFixed(1)}%)意外地高`);
    } else if (aggregation.lowConfidenceAccuracy < targetAcc - 0.2) {
      // 低置信度准确率过低，提高阈值（更保守）
      const adjustment = Math.min(maxAdj,
        (targetAcc - aggregation.lowConfidenceAccuracy) * 0.3);
      newLow = Math.min(newHigh - 0.1, newLow + adjustment);
      adjustments.push(`提高低阈值(${adjustment.toFixed(3)})，因低置信度准确率(${(aggregation.lowConfidenceAccuracy * 100).toFixed(1)}%)过低`);
    }
    
    // 确保阈值有效（high > low）
    if (newHigh <= newLow) {
      newHigh = newLow + 0.1;
    }
    
    // 如果没有有效调整
    if (adjustments.length === 0) {
      return null;
    }
    
    // 应用调整
    this.currentThresholds = {
      high: newHigh,
      low: newLow,
      lastUpdated: Date.now(),
      updateCount: this.currentThresholds.updateCount + 1,
    };
    
    this.lastAdjustmentTime = Date.now();
    
    // 记录调整
    const record: ThresholdAdjustmentRecord = {
      timestamp: Date.now(),
      oldThresholds,
      newThresholds: { ...this.currentThresholds },
      reason: adjustments.join('; '),
      beforeAccuracy: (aggregation.highConfidenceAccuracy + aggregation.mediumConfidenceAccuracy + aggregation.lowConfidenceAccuracy) / 3,
      afterAccuracy: null,
      triggerStats: aggregation,
    };
    
    this.adjustmentHistory.push(record);
    
    // 限制历史记录数量
    if (this.adjustmentHistory.length > 100) {
      this.adjustmentHistory = this.adjustmentHistory.slice(-100);
    }
    
    return record;
  }

  /**
   * 获取调整历史
   */
  getAdjustmentHistory(limit: number = 10): ThresholdAdjustmentRecord[] {
    return this.adjustmentHistory.slice(-limit);
  }

  /**
   * 获取上次调整记录
   */
  getLastAdjustment(): ThresholdAdjustmentRecord | null {
    return this.adjustmentHistory.length > 0 
      ? this.adjustmentHistory[this.adjustmentHistory.length - 1]
      : null;
  }

  /**
   * 根据置信度确定决策类型
   */
  classifyConfidence(confidence: number): {
    level: 'high' | 'medium' | 'low';
    decision: 'high_confidence_search' | 'high_confidence_skip_search' | 'medium_confidence_verify' | 'low_confidence_force_search';
  } {
    const { high, low } = this.currentThresholds;
    
    if (confidence >= high) {
      return { level: 'high', decision: 'high_confidence_search' };
    } else if (confidence >= low) {
      return { level: 'medium', decision: 'medium_confidence_verify' };
    } else {
      return { level: 'low', decision: 'low_confidence_force_search' };
    }
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 记录调整
   */
  private recordAdjustment(
    oldThresholds: ConfidenceThresholds,
    reason: string,
    beforeAccuracy: number
  ): void {
    const record: ThresholdAdjustmentRecord = {
      timestamp: Date.now(),
      oldThresholds,
      newThresholds: { ...this.currentThresholds },
      reason,
      beforeAccuracy,
      afterAccuracy: null,
      triggerStats: {} as FeedbackAggregation,
    };
    
    this.adjustmentHistory.push(record);
    this.lastAdjustmentTime = Date.now();
  }

  /**
   * 验证上次调整效果（供外部调用）
   */
  validateLastAdjustment(currentAccuracy: number): void {
    if (this.adjustmentHistory.length > 0) {
      const lastRecord = this.adjustmentHistory[this.adjustmentHistory.length - 1];
      lastRecord.afterAccuracy = currentAccuracy;
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createThresholdAdjuster(
  strategy?: Partial<ThresholdAdjustmentStrategy>,
  initialThresholds?: Partial<ConfidenceThresholds>
): ThresholdAdjuster {
  return new ThresholdAdjuster(strategy, initialThresholds);
}
