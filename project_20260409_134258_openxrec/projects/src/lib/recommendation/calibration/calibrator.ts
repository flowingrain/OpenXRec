/**
 * 置信度校准器
 * 
 * 实现多种校准方法：
 * 1. 直方图分箱（Histogram Binning）
 * 2. 保序回归（Isotonic Regression）
 * 3. Platt缩放
 * 4. Beta缩放
 */

import {
  CalibrationCurve,
  CalibrationPoint,
  CalibrationMethod,
  CalibratorConfig,
  RecommendationFeedbackEvent,
  FeedbackAggregation,
  DecisionStats,
} from './types';

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_CALIBRATOR_CONFIG: CalibratorConfig = {
  method: 'histogram_binning',
  minSamples: 100,
  numBins: 10,
  learningRate: 0.1,
  windowDays: 7,
};

// ============================================================================
// 校准器类
// ============================================================================

export class ConfidenceCalibrator {
  private config: CalibratorConfig;
  private feedbackBuffer: RecommendationFeedbackEvent[] = [];
  private calibrationCurve: CalibrationCurve | null = null;
  
  // 校准系数（用于不同方法）
  private plattA: number = 0;
  private plattB: number = 0;
  private betaAlpha: number = 1;
  private betaBeta: number = 1;
  
  // 分箱数据
  private binData: Map<string, { total: number; correct: number }> = new Map();

  constructor(config: Partial<CalibratorConfig> = {}) {
    this.config = { ...DEFAULT_CALIBRATOR_CONFIG, ...config };
    this.initializeBins();
  }

  // ===========================================================================
  // 核心接口
  // ===========================================================================

  /**
   * 添加反馈事件
   */
  addFeedback(event: RecommendationFeedbackEvent): void {
    this.feedbackBuffer.push(event);
    
    // 限制缓冲区大小
    const maxBuffer = 10000;
    if (this.feedbackBuffer.length > maxBuffer) {
      this.feedbackBuffer = this.feedbackBuffer.slice(-maxBuffer);
    }
    
    // 更新分箱数据
    this.updateBinData(event);
    
    // 如果样本足够，更新校准曲线
    if (this.feedbackBuffer.length >= this.config.minSamples) {
      this.updateCalibration();
    }
  }

  /**
   * 校准置信度
   */
  calibrate(rawConfidence: number, decision?: string): number {
    if (!this.calibrationCurve) {
      return rawConfidence; // 无校准数据，返回原始值
    }

    switch (this.config.method) {
      case 'histogram_binning':
        return this.calibrateByHistogram(rawConfidence);
      case 'platt_scaling':
        return this.calibrateByPlatt(rawConfidence);
      case 'beta_scaling':
        return this.calibrateByBeta(rawConfidence);
      case 'isotonic_regression':
        return this.calibrateByIsotonic(rawConfidence);
      default:
        return rawConfidence;
    }
  }

  /**
   * 获取校准曲线
   */
  getCalibrationCurve(): CalibrationCurve | null {
    return this.calibrationCurve;
  }

  /**
   * 获取反馈聚合统计
   */
  getFeedbackAggregation(windowDays?: number): FeedbackAggregation {
    const windowMs = (windowDays || this.config.windowDays) * 24 * 60 * 60 * 1000;
    const windowStart = Date.now() - windowMs;
    
    const recentEvents = this.feedbackBuffer.filter(e => e.timestamp >= windowStart);
    
    // 按置信度分组
    const highConf = recentEvents.filter(e => e.intentConfidence >= 0.8);
    const mediumConf = recentEvents.filter(e => e.intentConfidence >= 0.5 && e.intentConfidence < 0.8);
    const lowConf = recentEvents.filter(e => e.intentConfidence < 0.5);
    
    // 按决策类型分组
    const decisionStats = {
      high_confidence_search: this.computeDecisionStats(recentEvents.filter(e => e.decision === 'high_confidence_search')),
      high_confidence_skip_search: this.computeDecisionStats(recentEvents.filter(e => e.decision === 'high_confidence_skip_search')),
      medium_confidence_verify: this.computeDecisionStats(recentEvents.filter(e => e.decision === 'medium_confidence_verify')),
      low_confidence_force_search: this.computeDecisionStats(recentEvents.filter(e => e.decision === 'low_confidence_force_search')),
    };
    
    // 按预测来源分组
    const llmEvents = recentEvents.filter(e => e.predictionSource === 'llm');
    const ruleEvents = recentEvents.filter(e => e.predictionSource === 'rule_fallback');
    
    return {
      windowStart,
      windowEnd: Date.now(),
      sampleCount: recentEvents.length,
      highConfidenceAccuracy: this.computeAccuracy(highConf),
      mediumConfidenceAccuracy: this.computeAccuracy(mediumConf),
      lowConfidenceAccuracy: this.computeAccuracy(lowConf),
      decisionStats,
      llmAccuracy: this.computeAccuracy(llmEvents),
      ruleFallbackAccuracy: this.computeAccuracy(ruleEvents),
    };
  }

  /**
   * 获取缓冲区大小
   */
  getBufferSize(): number {
    return this.feedbackBuffer.length;
  }

  // ===========================================================================
  // 校准方法实现
  // ===========================================================================

  /**
   * 直方图分箱校准
   */
  private calibrateByHistogram(rawConfidence: number): number {
    const binIndex = Math.min(
      Math.floor(rawConfidence * this.config.numBins),
      this.config.numBins - 1
    );
    const binKey = `bin_${binIndex}`;
    const bin = this.binData.get(binKey);
    
    if (!bin || bin.total === 0) {
      return rawConfidence;
    }
    
    return bin.correct / bin.total;
  }

  /**
   * Platt缩放校准
   * P(y=1|f) = 1 / (1 + exp(A * f + B))
   */
  private calibrateByPlatt(rawConfidence: number): number {
    const z = this.plattA * rawConfidence + this.plattB;
    return 1 / (1 + Math.exp(-z));
  }

  /**
   * Beta缩放校准
   * 使用Beta分布拟合
   */
  private calibrateByBeta(rawConfidence: number): number {
    // Beta分布的累积分布函数近似
    const eps = 1e-10;
    const x = Math.max(eps, Math.min(1 - eps, rawConfidence));
    
    // 简化的Beta CDF近似
    const calibrated = x * (this.betaAlpha / (this.betaAlpha + this.betaBeta));
    return Math.max(0, Math.min(1, calibrated));
  }

  /**
   * 保序回归校准
   * 查找校准曲线中的最近点
   */
  private calibrateByIsotonic(rawConfidence: number): number {
    if (!this.calibrationCurve || this.calibrationCurve.points.length === 0) {
      return rawConfidence;
    }
    
    // 找到最近的校准点
    for (const point of this.calibrationCurve.points) {
      const [low, high] = point.confidenceBin;
      if (rawConfidence >= low && rawConfidence < high) {
        return point.actualAccuracy;
      }
    }
    
    // 如果超出范围，使用最近的点
    const lastPoint = this.calibrationCurve.points[this.calibrationCurve.points.length - 1];
    return lastPoint.actualAccuracy;
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 初始化分箱
   */
  private initializeBins(): void {
    for (let i = 0; i < this.config.numBins; i++) {
      this.binData.set(`bin_${i}`, { total: 0, correct: 0 });
    }
  }

  /**
   * 更新分箱数据
   */
  private updateBinData(event: RecommendationFeedbackEvent): void {
    const binIndex = Math.min(
      Math.floor(event.intentConfidence * this.config.numBins),
      this.config.numBins - 1
    );
    const binKey = `bin_${binIndex}`;
    const bin = this.binData.get(binKey);
    
    if (bin) {
      bin.total += 1;
      if (this.isCorrect(event)) {
        bin.correct += 1;
      }
    }
  }

  /**
   * 判断反馈是否"正确"
   */
  private isCorrect(event: RecommendationFeedbackEvent): boolean {
    // 综合判断：满意度、点击、评分等
    if (event.satisfied !== null) {
      return event.satisfied;
    }
    if (event.rating !== null) {
      return event.rating >= 4;
    }
    if (event.clickedItems.length > 0 || event.likedItems.length > 0) {
      return true;
    }
    return false;
  }

  /**
   * 计算准确率
   */
  private computeAccuracy(events: RecommendationFeedbackEvent[]): number {
    if (events.length === 0) return 0;
    const correct = events.filter(e => this.isCorrect(e)).length;
    return correct / events.length;
  }

  /**
   * 计算决策统计
   */
  private computeDecisionStats(events: RecommendationFeedbackEvent[]): DecisionStats {
    if (events.length === 0) {
      return {
        count: 0,
        accuracy: 0,
        avgSatisfaction: 0,
        avgRating: 0,
        conversionRate: 0,
        avgDwellTime: 0,
      };
    }
    
    const correct = events.filter(e => this.isCorrect(e)).length;
    const satisfiedEvents = events.filter(e => e.satisfied === true);
    const ratedEvents = events.filter(e => e.rating !== null);
    const convertedEvents = events.filter(e => e.converted);
    const dwellTimeEvents = events.filter(e => e.dwellTime !== null);
    
    return {
      count: events.length,
      accuracy: correct / events.length,
      avgSatisfaction: satisfiedEvents.length / events.length,
      avgRating: ratedEvents.length > 0 
        ? ratedEvents.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedEvents.length 
        : 0,
      conversionRate: convertedEvents.length / events.length,
      avgDwellTime: dwellTimeEvents.length > 0
        ? dwellTimeEvents.reduce((sum, e) => sum + (e.dwellTime || 0), 0) / dwellTimeEvents.length
        : 0,
    };
  }

  /**
   * 更新校准曲线
   */
  private updateCalibration(): void {
    const points: CalibrationPoint[] = [];
    const binWidth = 1 / this.config.numBins;
    
    for (let i = 0; i < this.config.numBins; i++) {
      const binKey = `bin_${i}`;
      const bin = this.binData.get(binKey);
      
      if (bin && bin.total > 0) {
        const low = i * binWidth;
        const high = (i + 1) * binWidth;
        const actualAccuracy = bin.correct / bin.total;
        const avgPredicted = (low + high) / 2;
        
        points.push({
          confidenceBin: [low, high],
          count: bin.total,
          actualAccuracy,
          avgPredictedConfidence: avgPredicted,
          calibrationError: Math.abs(avgPredicted - actualAccuracy),
        });
      }
    }
    
    // 计算期望校准误差（ECE）
    const totalSamples = points.reduce((sum, p) => sum + p.count, 0);
    const ece = points.reduce((sum, p) => sum + (p.calibrationError * p.count / totalSamples), 0);
    
    // 计算最大校准误差（MCE）
    const mce = Math.max(...points.map(p => p.calibrationError));
    
    // 生成校准系数（基于直方图）
    const coefficients = points.map(p => 
      p.avgPredictedConfidence > 0 
        ? p.actualAccuracy / p.avgPredictedConfidence 
        : 1
    );
    
    this.calibrationCurve = {
      createdAt: Date.now(),
      totalSamples,
      points,
      expectedCalibrationError: ece,
      maxCalibrationError: mce,
      calibrationCoefficients: coefficients,
    };
    
    // 同时更新其他校准方法的参数
    this.updatePlattParameters();
    this.updateBetaParameters();
  }

  /**
   * 更新Platt缩放参数（简化版）
   */
  private updatePlattParameters(): void {
    // 使用梯度下降优化（简化实现）
    // 实际应用中应使用更复杂的优化算法
    if (this.calibrationCurve && this.calibrationCurve.points.length >= 5) {
      // 基于校准曲线估计参数
      const avgError = this.calibrationCurve.expectedCalibrationError;
      
      // 简单调整：如果系统过度自信，调整A和B
      if (avgError > 0.1) {
        this.plattA = 1 - avgError;  // 降低斜率
        this.plattB = avgError * 0.5; // 增加偏移
      } else {
        this.plattA = 1;
        this.plattB = 0;
      }
    }
  }

  /**
   * 更新Beta缩放参数
   */
  private updateBetaParameters(): void {
    // 基于校准曲线估计Beta分布参数
    if (this.calibrationCurve && this.calibrationCurve.points.length >= 3) {
      const avgAccuracy = this.calibrationCurve.points.reduce(
        (sum, p) => sum + p.actualAccuracy * p.count, 0
      ) / this.calibrationCurve.totalSamples;
      
      // 简化的Beta参数估计
      // 当准确率高时，alpha > beta
      if (avgAccuracy > 0.5) {
        this.betaAlpha = avgAccuracy * 2;
        this.betaBeta = (1 - avgAccuracy) * 2;
      } else {
        this.betaAlpha = avgAccuracy * 2;
        this.betaBeta = (1 - avgAccuracy) * 2;
      }
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createCalibrator(config?: Partial<CalibratorConfig>): ConfidenceCalibrator {
  return new ConfidenceCalibrator(config);
}
