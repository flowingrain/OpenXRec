/**
 * 在线增量校准服务
 * 
 * 核心理念：
 * 1. 无需等待大量样本即可开始校准
 * 2. 使用贝叶斯更新和遗忘因子
 * 3. 自适应学习率
 * 4. 冷启动策略
 * 
 * 算法：
 * - 增量更新：每个样本立即更新校准曲线
 * - 遗忘因子：老样本权重逐渐衰减
 * - 贝叶斯先验：使用先验知识初始化
 */

import { getPersistenceStorage } from './storage';
import type {
  OnlineLearningConfig,
  DEFAULT_ONLINE_LEARNING_CONFIG,
  IncrementalCalibrationState,
  CalibrationCurvePoint,
} from './types';

// ============================================================================
// 在线增量校准服务
// ============================================================================

/**
 * 在线增量校准服务
 */
export class OnlineCalibrationService {
  private config: OnlineLearningConfig;
  private state: IncrementalCalibrationState;
  private lastUpdateTime: number = 0;
  private pendingUpdates: Array<{
    predictedConfidence: number;
    isCorrect: boolean;
    timestamp: number;
  }> = [];

  constructor(config: Partial<OnlineLearningConfig> = {}) {
    this.config = {
      // 默认配置
      enableIncrementalUpdate: true,
      updateIntervalMs: 5000,
      minSamplesForUpdate: 5,
      forgettingFactor: 0.95,
      adaptiveLearningRate: true,
      initialLearningRate: 0.1,
      minLearningRate: 0.001,
      maxLearningRate: 0.5,
      coldStartStrategy: 'prior',
      priorStrength: 10,
      // 覆盖配置
      ...config,
    };

    // 初始化状态
    this.state = this.initializeState();
  }

  /**
   * 初始化校准状态
   */
  private initializeState(): IncrementalCalibrationState {
    const numBins = 10;
    const bins: IncrementalCalibrationState['bins'] = [];

    for (let i = 0; i < numBins; i++) {
      const binStart = i * 0.1;
      const binEnd = (i + 1) * 0.1;
      
      // 使用先验初始化（贝叶斯冷启动）
      const priorAlpha = this.config.priorStrength * (binStart + binEnd) / 2;
      const priorBeta = this.config.priorStrength - priorAlpha;

      bins.push({
        binIndex: i,
        binStart,
        binEnd,
        sumWeights: this.config.priorStrength,
        sumCorrect: priorAlpha,
        count: this.config.priorStrength,
        calibratedValue: (binStart + binEnd) / 2, // 初始使用理想值
        lastUpdate: Date.now(),
      });
    }

    return {
      bins,
      totalSamples: 0,
      lastUpdateTime: Date.now(),
      currentLearningRate: this.config.initialLearningRate,
    };
  }

  // ===========================================================================
  // 核心接口
  // ===========================================================================

  /**
   * 记录新的校准样本（在线更新）
   */
  async recordSample(
    predictedConfidence: number,
    actualOutcome: boolean,
    immediate: boolean = false
  ): Promise<void> {
    // 添加到待更新队列
    this.pendingUpdates.push({
      predictedConfidence,
      isCorrect: actualOutcome,
      timestamp: Date.now(),
    });

    // 判断是否立即更新
    if (immediate || this.shouldUpdateNow()) {
      await this.flush();
    }
  }

  /**
   * 获取校准后的置信度
   */
  getCalibratedConfidence(originalConfidence: number): number {
    const binIndex = this.findBinIndex(originalConfidence);
    const bin = this.state.bins[binIndex];

    if (bin.count < this.config.minSamplesForUpdate) {
      // 样本不足，使用线性插值
      return this.interpolateCalibration(originalConfidence);
    }

    return bin.calibratedValue;
  }

  /**
   * 获取校准曲线
   */
  getCalibrationCurve(): CalibrationCurvePoint[] {
    return this.state.bins.map(bin => ({
      predictedProbability: (bin.binStart + bin.binEnd) / 2,
      actualAccuracy: bin.calibratedValue,
      sampleCount: bin.count,
      confidenceInterval: this.calculateConfidenceInterval(bin),
    }));
  }

  /**
   * 获取期望校准误差 (ECE)
   */
  getExpectedCalibrationError(): number {
    const totalWeight = this.state.bins.reduce((sum, bin) => sum + bin.count, 0);
    if (totalWeight === 0) return 0;

    let ece = 0;
    for (const bin of this.state.bins) {
      const weight = bin.count / totalWeight;
      const gap = Math.abs((bin.binStart + bin.binEnd) / 2 - bin.calibratedValue);
      ece += weight * gap;
    }

    return ece;
  }

  /**
   * 获取状态
   */
  getState(): IncrementalCalibrationState {
    return { ...this.state };
  }

  /**
   * 强制刷新待更新队列
   */
  async flush(): Promise<void> {
    if (this.pendingUpdates.length === 0) return;

    // 应用遗忘因子
    this.applyForgettingFactor();

    // 处理所有待更新样本
    for (const update of this.pendingUpdates) {
      this.updateBin(update.predictedConfidence, update.isCorrect);
    }

    // 清空队列
    this.pendingUpdates = [];
    this.state.lastUpdateTime = Date.now();

    // 持久化到存储
    await this.persistState();
  }

  /**
   * 重置校准状态
   */
  reset(): void {
    this.state = this.initializeState();
    this.pendingUpdates = [];
    this.lastUpdateTime = Date.now();
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 判断是否应该立即更新
   */
  private shouldUpdateNow(): boolean {
    if (!this.config.enableIncrementalUpdate) return false;
    
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    
    // 时间间隔或样本数达到阈值
    return (
      timeSinceLastUpdate >= this.config.updateIntervalMs ||
      this.pendingUpdates.length >= this.config.minSamplesForUpdate
    );
  }

  /**
   * 查找置信度所属的区间
   */
  private findBinIndex(confidence: number): number {
    return Math.min(9, Math.max(0, Math.floor(confidence * 10)));
  }

  /**
   * 更新区间统计
   */
  private updateBin(predictedConfidence: number, isCorrect: boolean): void {
    const binIndex = this.findBinIndex(predictedConfidence);
    const bin = this.state.bins[binIndex];

    // 计算学习率
    const learningRate = this.calculateLearningRate(bin);

    // 增量更新
    const weight = 1.0;
    const correctValue = isCorrect ? 1.0 : 0.0;

    // 使用指数移动平均更新
    bin.calibratedValue = 
      (1 - learningRate) * bin.calibratedValue + 
      learningRate * correctValue;

    bin.sumWeights += weight;
    if (isCorrect) bin.sumCorrect += weight;
    bin.count++;
    bin.lastUpdate = Date.now();

    // 更新全局统计
    this.state.totalSamples++;
    this.state.currentLearningRate = learningRate;
  }

  /**
   * 计算自适应学习率
   */
  private calculateLearningRate(bin: IncrementalCalibrationState['bins'][0]): number {
    if (!this.config.adaptiveLearningRate) {
      return this.config.initialLearningRate;
    }

    // 基于样本数的学习率衰减
    // 样本越多，学习率越小（更稳定）
    const sampleBasedRate = 1.0 / (1 + bin.count * 0.01);

    // 基于时间的学习率
    const timeSinceUpdate = Date.now() - bin.lastUpdate;
    const timeBasedRate = Math.min(1.0, timeSinceUpdate / 3600000); // 1小时内线性增长

    // 综合学习率
    const combinedRate = sampleBasedRate * (0.5 + 0.5 * timeBasedRate);

    // 限制范围
    return Math.max(
      this.config.minLearningRate,
      Math.min(this.config.maxLearningRate, combinedRate)
    );
  }

  /**
   * 应用遗忘因子
   */
  private applyForgettingFactor(): void {
    const now = Date.now();
    const decayFactor = this.config.forgettingFactor;

    for (const bin of this.state.bins) {
      const timeSinceUpdate = (now - bin.lastUpdate) / 3600000; // 小时
      const decay = Math.pow(decayFactor, timeSinceUpdate);

      bin.sumWeights *= decay;
      bin.sumCorrect *= decay;
      bin.count *= decay;

      // 重新计算校准值
      if (bin.count > 0) {
        bin.calibratedValue = bin.sumCorrect / bin.sumWeights;
      }
    }
  }

  /**
   * 插值校准（样本不足时）
   */
  private interpolateCalibration(confidence: number): number {
    const binIndex = this.findBinIndex(confidence);
    const bin = this.state.bins[binIndex];

    // 找到最近的足够样本的区间
    let leftBin = binIndex;
    let rightBin = binIndex;

    while (leftBin > 0 && this.state.bins[leftBin].count < this.config.minSamplesForUpdate) {
      leftBin--;
    }
    while (rightBin < 9 && this.state.bins[rightBin].count < this.config.minSamplesForUpdate) {
      rightBin++;
    }

    const left = this.state.bins[leftBin];
    const right = this.state.bins[rightBin];

    if (leftBin === rightBin) {
      return left.calibratedValue;
    }

    // 线性插值
    const t = (confidence - left.binEnd) / (right.binStart - left.binEnd);
    return left.calibratedValue * (1 - t) + right.calibratedValue * t;
  }

  /**
   * 计算置信区间
   */
  private calculateConfidenceInterval(bin: IncrementalCalibrationState['bins'][0]): {
    lower: number;
    upper: number;
  } {
    const n = bin.count;
    const p = bin.calibratedValue;

    // Wilson score interval
    const z = 1.96; // 95%置信度
    const denominator = 1 + z * z / n;
    const center = p + z * z / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);

    return {
      lower: Math.max(0, (center - margin) / denominator),
      upper: Math.min(1, (center + margin) / denominator),
    };
  }

  /**
   * 持久化状态到存储
   */
  private async persistState(): Promise<void> {
    try {
      const storage = getPersistenceStorage();
      
      for (const bin of this.state.bins) {
        await storage.saveCalibrationBin({
          bin_index: bin.binIndex,
          bin_start: bin.binStart,
          bin_end: bin.binEnd,
          predicted_count: Math.round(bin.count),
          correct_count: Math.round(bin.sumCorrect),
          actual_accuracy: bin.calibratedValue,
          time_window_start: new Date(Date.now() - 3600000).toISOString(),
          time_window_end: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[OnlineCalibration] Failed to persist state:', e);
    }
  }
}

// ============================================================================
// 单例
// ============================================================================

let calibrationServiceInstance: OnlineCalibrationService | null = null;

export function getOnlineCalibrationService(
  config?: Partial<OnlineLearningConfig>
): OnlineCalibrationService {
  if (!calibrationServiceInstance) {
    calibrationServiceInstance = new OnlineCalibrationService(config);
  }
  return calibrationServiceInstance;
}
