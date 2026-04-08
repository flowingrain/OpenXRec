/**
 * A/B 测试框架
 * 
 * 功能：
 * 1. 对比不同校准方法的效果
 * 2. 对比不同阈值配置
 * 3. 对比不同超参数配置（PPO）
 * 4. 统计显著性检验
 * 5. 自动选择优胜方案
 */

import { getPersistenceStorage } from './storage';
import type {
  ABTestExperimentRecord,
  PPOHyperparamABTestConfig,
  PPOABTestResult,
  StatisticalTestConfig,
  StatisticalTestResult,
} from './types';

// ============================================================================
// A/B 测试框架
// ============================================================================

/**
 * A/B 测试管理器
 */
export class ABTestingManager {
  private activeExperiments: Map<string, ABTestExperimentRecord> = new Map();
  private userAssignments: Map<string, Map<string, 'A' | 'B'>> = new Map(); // userId -> experimentId -> variant

  constructor() {
    this.loadActiveExperiments();
  }

  // ===========================================================================
  // 核心接口
  // ===========================================================================

  /**
   * 创建新的A/B测试
   */
  async createExperiment(options: {
    name: string;
    description?: string;
    variantA: {
      type: 'calibration_method' | 'threshold' | 'keyword_set' | 'hyperparam_config';
      config: Record<string, any>;
    };
    variantB: {
      type: 'calibration_method' | 'threshold' | 'keyword_set' | 'hyperparam_config';
      config: Record<string, any>;
    };
    trafficSplit?: number; // A组流量百分比，默认50
  }): Promise<ABTestExperimentRecord | null> {
    const storage = getPersistenceStorage();

    const experiment = await storage.createABExperiment({
      experiment_name: options.name,
      description: options.description,
      variant_a: options.variantA,
      variant_b: options.variantB,
      traffic_split: options.trafficSplit ?? 50,
      status: 'draft',
    });

    return experiment;
  }

  /**
   * 启动A/B测试
   */
  async startExperiment(experimentId: string): Promise<boolean> {
    try {
      const storage = getPersistenceStorage();
      
      // 更新状态为运行中
      const { data, error } = await storage['supabase']
        .from('ab_experiments')
        .update({ 
          status: 'running', 
          start_time: new Date().toISOString() 
        })
        .eq('id', experimentId)
        .select()
        .single();

      if (error || !data) return false;

      this.activeExperiments.set(experimentId, data as ABTestExperimentRecord);
      return true;
    } catch (e) {
      console.error('[ABTesting] Failed to start experiment:', e);
      return false;
    }
  }

  /**
   * 获取用户的实验分组
   */
  getUserVariant(userId: string, experimentId: string): 'A' | 'B' {
    // 检查缓存
    const userExperiments = this.userAssignments.get(userId);
    if (userExperiments?.has(experimentId)) {
      return userExperiments.get(experimentId)!;
    }

    // 获取实验配置
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) return 'A';

    // 基于用户ID哈希分配分组（确保一致性）
    const hash = this.hashUserId(userId, experimentId);
    const variant = hash < experiment.traffic_split ? 'A' : 'B';

    // 缓存分配结果
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    this.userAssignments.get(userId)!.set(experimentId, variant);

    return variant;
  }

  /**
   * 获取实验配置
   */
  getExperimentConfig(userId: string, experimentId: string): Record<string, any> | null {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) return null;

    const variant = this.getUserVariant(userId, experimentId);
    return variant === 'A' ? experiment.variant_a.config : experiment.variant_b.config;
  }

  /**
   * 记录实验事件
   */
  async recordEvent(options: {
    experimentId: string;
    userId: string;
    eventType: 'prediction' | 'outcome';
    eventData: {
      query?: string;
      predictedNeedsSearch?: boolean;
      predictedConfidence?: number;
      actualNeedsSearch?: boolean;
      isCorrect?: boolean;
      responseQuality?: string;
    };
  }): Promise<void> {
    const storage = getPersistenceStorage();
    const variant = this.getUserVariant(options.userId, options.experimentId);

    await storage.recordABEvent({
      experiment_id: options.experimentId,
      user_id: options.userId,
      variant,
      event_type: options.eventType,
      event_data: options.eventData,
    });
  }

  /**
   * 获取实验结果
   */
  async getResults(experimentId: string): Promise<{
    experiment: ABTestExperimentRecord | null;
    variantA: { count: number; accuracy: number };
    variantB: { count: number; accuracy: number };
    significance: number;
    recommendation: 'A' | 'B' | 'inconclusive';
  }> {
    const storage = getPersistenceStorage();
    const experiment = this.activeExperiments.get(experimentId);

    if (!experiment) {
      return {
        experiment: null,
        variantA: { count: 0, accuracy: 0 },
        variantB: { count: 0, accuracy: 0 },
        significance: 0,
        recommendation: 'inconclusive',
      };
    }

    const results = await storage.getABTestResults(experimentId);

    // 生成推荐
    let recommendation: 'A' | 'B' | 'inconclusive' = 'inconclusive';
    if (results.significance >= 0.95) {
      recommendation = results.variantA.accuracy > results.variantB.accuracy ? 'A' : 'B';
    }

    return {
      experiment,
      ...results,
      recommendation,
    };
  }

  /**
   * 结束实验
   */
  async endExperiment(experimentId: string): Promise<boolean> {
    try {
      await getPersistenceStorage()['supabase']
        .from('ab_experiments')
        .update({ 
          status: 'completed', 
          end_time: new Date().toISOString() 
        })
        .eq('id', experimentId);

      this.activeExperiments.delete(experimentId);
      return true;
    } catch (e) {
      console.error('[ABTesting] Failed to end experiment:', e);
      return false;
    }
  }

  /**
   * 获取所有活跃实验
   */
  getActiveExperiments(): ABTestExperimentRecord[] {
    return Array.from(this.activeExperiments.values());
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 加载活跃实验
   */
  private async loadActiveExperiments(): Promise<void> {
    try {
      const storage = getPersistenceStorage();
      const experiments = await storage.getActiveABExperiments();
      
      for (const exp of experiments) {
        this.activeExperiments.set(exp.id, exp);
      }
    } catch (e) {
      console.error('[ABTesting] Failed to load active experiments:', e);
    }
  }

  /**
   * 哈希用户ID（0-100）
   */
  private hashUserId(userId: string, experimentId: string): number {
    const str = `${userId}:${experimentId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }
}

// ============================================================================
// 预定义实验模板
// ============================================================================

/**
 * 校准方法对比实验
 */
export const CALIBRATION_METHOD_EXPERIMENT = {
  name: 'calibration_method_comparison',
  description: '对比不同校准方法的效果',
  variantA: {
    type: 'calibration_method' as const,
    config: {
      method: 'histogram_binning',
      description: '直方图分箱校准',
    },
  },
  variantB: {
    type: 'calibration_method' as const,
    config: {
      method: 'online_bayesian',
      description: '在线贝叶斯校准',
    },
  },
};

/**
 * 阈值对比实验
 */
export const THRESHOLD_EXPERIMENT = {
  name: 'threshold_comparison',
  description: '对比不同置信度阈值的效果',
  variantA: {
    type: 'threshold' as const,
    config: {
      highThreshold: 0.8,
      lowThreshold: 0.5,
      description: '原始阈值',
    },
  },
  variantB: {
    type: 'threshold' as const,
    config: {
      highThreshold: 0.75,
      lowThreshold: 0.45,
      description: '优化阈值',
    },
  },
};

/**
 * PPO 超参数对比实验
 */
export const HYPERPARAM_EXPERIMENT = {
  name: 'ppo_hyperparam_comparison',
  description: '对比不同PPO超参数配置的效果',
  variantA: {
    type: 'hyperparam_config' as const,
    config: {
      learningRate: 3e-4,
      clipEpsilon: 0.2,
      entropyCoef: 0.01,
      gaeLambda: 0.95,
      description: '标准PPO配置',
    },
  },
  variantB: {
    type: 'hyperparam_config' as const,
    config: {
      learningRate: 1e-4,
      clipEpsilon: 0.15,
      entropyCoef: 0.02,
      gaeLambda: 0.98,
      description: '保守探索配置',
    },
  },
};

// ============================================================================
// 统计显著性检验工具
// ============================================================================

/**
 * 统计显著性检验器
 */
export class StatisticalTester {
  /**
   * 执行 t 检验
   */
  static tTest(
    sampleA: number[],
    sampleB: number[],
    alpha: number = 0.05
  ): StatisticalTestResult {
    const n1 = sampleA.length;
    const n2 = sampleB.length;
    
    if (n1 < 2 || n2 < 2) {
      return {
        testType: 't_test',
        statistic: 0,
        pValue: 1,
        isSignificant: false,
        confidenceInterval: { lower: 0, upper: 0 },
        effectSize: 0,
        power: 0,
      };
    }

    // 计算均值
    const meanA = sampleA.reduce((a, b) => a + b, 0) / n1;
    const meanB = sampleB.reduce((a, b) => a + b, 0) / n2;

    // 计算方差
    const varA = sampleA.reduce((sum, x) => sum + (x - meanA) ** 2, 0) / (n1 - 1);
    const varB = sampleB.reduce((sum, x) => sum + (x - meanB) ** 2, 0) / (n2 - 1);

    // 合并标准差
    const pooledVar = ((n1 - 1) * varA + (n2 - 1) * varB) / (n1 + n2 - 2);
    const pooledStd = Math.sqrt(pooledVar);

    // t 统计量
    const se = Math.sqrt(varA / n1 + varB / n2);
    const tStat = se > 0 ? (meanA - meanB) / se : 0;

    // 自由度
    const df = n1 + n2 - 2;

    // p 值（双尾检验）
    const pValue = this.tDistributionPValue(Math.abs(tStat), df);

    // 效应量 (Cohen's d)
    const effectSize = pooledStd > 0 ? (meanA - meanB) / pooledStd : 0;

    // 置信区间
    const tCrit = this.tDistributionCritical(alpha / 2, df);
    const ciLower = (meanA - meanB) - tCrit * se;
    const ciUpper = (meanA - meanB) + tCrit * se;

    // 统计功效
    const power = this.calculatePower(effectSize, n1 + n2, alpha);

    return {
      testType: 't_test',
      statistic: tStat,
      pValue,
      isSignificant: pValue < alpha,
      confidenceInterval: { lower: ciLower, upper: ciUpper },
      effectSize,
      power,
    };
  }

  /**
   * 执行 Mann-Whitney U 检验（非参数检验）
   */
  static mannWhitneyUTest(
    sampleA: number[],
    sampleB: number[],
    alpha: number = 0.05
  ): StatisticalTestResult {
    const n1 = sampleA.length;
    const n2 = sampleB.length;
    
    if (n1 < 2 || n2 < 2) {
      return {
        testType: 'mann_whitney',
        statistic: 0,
        pValue: 1,
        isSignificant: false,
        confidenceInterval: { lower: 0, upper: 0 },
        effectSize: 0,
        power: 0,
      };
    }

    // 合并并排序
    const combined = [
      ...sampleA.map((x, i) => ({ value: x, group: 'A' as const, index: i })),
      ...sampleB.map((x, i) => ({ value: x, group: 'B' as const, index: i })),
    ].sort((a, b) => a.value - b.value);

    // 计算秩
    let rankSum = 0;
    let u1 = 0;
    
    combined.forEach((item, index) => {
      const rank = index + 1;
      if (item.group === 'A') {
        rankSum += rank;
      }
    });

    // U 统计量
    u1 = rankSum - (n1 * (n1 + 1)) / 2;
    const u2 = n1 * n2 - u1;
    const uStat = Math.min(u1, u2);

    // 正态近似
    const meanU = (n1 * n2) / 2;
    const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const zScore = stdU > 0 ? (uStat - meanU) / stdU : 0;

    // p 值（双尾）
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    // 效应量 (rank-biserial correlation)
    const effectSize = 1 - (2 * uStat) / (n1 * n2);

    // 统计功效
    const power = this.calculatePower(effectSize, n1 + n2, alpha);

    return {
      testType: 'mann_whitney',
      statistic: uStat,
      pValue,
      isSignificant: pValue < alpha,
      confidenceInterval: { lower: 0, upper: 0 }, // 非参数检验置信区间计算复杂
      effectSize,
      power,
    };
  }

  /**
   * 执行 Bootstrap 检验
   */
  static bootstrapTest(
    sampleA: number[],
    sampleB: number[],
    options: {
      alpha?: number;
      bootstrapSamples?: number;
    } = {}
  ): StatisticalTestResult {
    const { alpha = 0.05, bootstrapSamples = 1000 } = options;
    const n1 = sampleA.length;
    const n2 = sampleB.length;

    if (n1 < 2 || n2 < 2) {
      return {
        testType: 'bootstrap',
        statistic: 0,
        pValue: 1,
        isSignificant: false,
        confidenceInterval: { lower: 0, upper: 0 },
        effectSize: 0,
        power: 0,
      };
    }

    // 原始差异
    const meanA = sampleA.reduce((a, b) => a + b, 0) / n1;
    const meanB = sampleB.reduce((a, b) => a + b, 0) / n2;
    const observedDiff = meanA - meanB;

    // Bootstrap 重采样
    const bootstrapDiffs: number[] = [];
    for (let i = 0; i < bootstrapSamples; i++) {
      const resampleA = this.resample(sampleA);
      const resampleB = this.resample(sampleB);
      const resampleMeanA = resampleA.reduce((a, b) => a + b, 0) / n1;
      const resampleMeanB = resampleB.reduce((a, b) => a + b, 0) / n2;
      bootstrapDiffs.push(resampleMeanA - resampleMeanB);
    }

    // 排序计算置信区间
    bootstrapDiffs.sort((a, b) => a - b);
    const ciLower = bootstrapDiffs[Math.floor(bootstrapSamples * (alpha / 2))];
    const ciUpper = bootstrapDiffs[Math.floor(bootstrapSamples * (1 - alpha / 2))];

    // p 值（双尾）
    const pValue = bootstrapDiffs.filter(d => Math.abs(d) >= Math.abs(observedDiff)).length / bootstrapSamples;

    // 效应量
    const pooledStd = Math.sqrt(
      (this.variance(sampleA) + this.variance(sampleB)) / 2
    );
    const effectSize = pooledStd > 0 ? observedDiff / pooledStd : 0;

    // 统计功效
    const power = this.calculatePower(effectSize, n1 + n2, alpha);

    return {
      testType: 'bootstrap',
      statistic: observedDiff,
      pValue,
      isSignificant: pValue < alpha,
      confidenceInterval: { lower: ciLower, upper: ciUpper },
      effectSize,
      power,
    };
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * t 分布 p 值（近似计算）
   */
  private static tDistributionPValue(t: number, df: number): number {
    // 使用正态近似（大样本）
    if (df > 30) {
      return 2 * (1 - this.normalCDF(t));
    }
    
    // 小样本使用近似公式
    const x = df / (df + t * t);
    return this.incompleteBeta(df / 2, 0.5, x);
  }

  /**
   * t 分布临界值（近似）
   */
  private static tDistributionCritical(alpha: number, df: number): number {
    // 常用临界值表
    const criticalValues: Record<number, Record<number, number>> = {
      0.025: { 1: 12.71, 2: 4.30, 5: 2.57, 10: 2.23, 20: 2.09, 30: 2.04, 60: 2.00, 120: 1.98 },
      0.05: { 1: 6.31, 2: 2.92, 5: 2.02, 10: 1.81, 20: 1.72, 30: 1.70, 60: 1.67, 120: 1.66 },
    };

    const table = criticalValues[alpha];
    if (!table) return 1.96; // 默认正态分布临界值

    // 找最接近的自由度
    const dfs = Object.keys(table).map(Number).sort((a, b) => a - b);
    for (const d of dfs) {
      if (df <= d) return table[d];
    }
    return table[dfs[dfs.length - 1]];
  }

  /**
   * 正态分布 CDF（近似）
   */
  private static normalCDF(x: number): number {
    // 使用误差函数近似
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * 不完全 Beta 函数（近似）
   */
  private static incompleteBeta(a: number, b: number, x: number): number {
    // 简化近似
    if (x === 0) return 0;
    if (x === 1) return 1;
    
    // 使用幂级数近似
    const maxIter = 100;
    let sum = 1;
    let term = 1;
    
    for (let i = 0; i < maxIter; i++) {
      term *= (a + b + i - 1) * x / (a + i);
      sum += term;
      if (Math.abs(term) < 1e-10) break;
    }
    
    return sum * Math.pow(x, a) * Math.pow(1 - x, b) / (a * this.beta(a, b));
  }

  /**
   * Beta 函数
   */
  private static beta(a: number, b: number): number {
    return Math.exp(this.logGamma(a) + this.logGamma(b) - this.logGamma(a + b));
  }

  /**
   * 对数 Gamma 函数（近似）
   */
  private static logGamma(x: number): number {
    const cof = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
    ];
    
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    
    for (const c of cof) {
      y += 1;
      ser += c / y;
    }
    
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  /**
   * 计算统计功效
   */
  private static calculatePower(effectSize: number, n: number, alpha: number): number {
    // 使用近似公式
    const delta = effectSize * Math.sqrt(n / 4);
    const zAlpha = this.normalInverse(1 - alpha / 2);
    return this.normalCDF(delta - zAlpha);
  }

  /**
   * 正态分布逆函数（近似）
   */
  private static normalInverse(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    
    // 使用近似公式
    const a = [
      -3.969683028665376e+01, 2.209460984245205e+02,
      -2.759285104469687e+02, 1.383577518672690e+02,
      -3.066479806614716e+01, 2.506628277459239e+00
    ];
    const b = [
      -5.447609879822406e+01, 1.615858368580409e+02,
      -1.556989798598866e+02, 6.680131188771972e+01,
      -1.328068155288572e+01
    ];
    const c = [
      -7.784894002430293e-03, -3.223964580411365e-01,
      -2.400758277161838e+00, -2.549732539343734e+00,
      4.374664141464968e+00, 2.938163982698783e+00
    ];
    const d = [
      7.784695709041462e-03, 3.224671290700398e-01,
      2.445134137142996e+00, 3.754408661907416e+00
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      const q = p - 0.5;
      const r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
             (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  }

  /**
   * 重采样
   */
  private static resample(sample: number[]): number[] {
    const n = sample.length;
    return Array.from({ length: n }, () => sample[Math.floor(Math.random() * n)]);
  }

  /**
   * 计算方差
   */
  private static variance(sample: number[]): number {
    const n = sample.length;
    const mean = sample.reduce((a, b) => a + b, 0) / n;
    return sample.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
  }
}

// ============================================================================
// 单例
// ============================================================================

let abTestingInstance: ABTestingManager | null = null;

export function getABTestingManager(): ABTestingManager {
  if (!abTestingInstance) {
    abTestingInstance = new ABTestingManager();
  }
  return abTestingInstance;
}

// ============================================================================
// PPO 超参数 A/B 测试扩展
// ============================================================================

/**
 * PPO 超参数 A/B 测试管理器
 */
export class PPOABTestingManager {
  private abTestingManager: ABTestingManager;

  constructor() {
    this.abTestingManager = getABTestingManager();
  }

  /**
   * 创建超参数对比实验
   */
  async createHyperparamExperiment(options: {
    name: string;
    description?: string;
    variantA: PPOHyperparamABTestConfig;
    variantB: PPOHyperparamABTestConfig;
    trafficSplit?: number;
  }): Promise<ABTestExperimentRecord | null> {
    return this.abTestingManager.createExperiment({
      name: options.name,
      description: options.description,
      variantA: {
        type: 'hyperparam_config',
        config: {
          ...options.variantA.hyperparams,
          name: options.variantA.name,
          description: options.variantA.description,
          source: options.variantA.source,
          versionId: options.variantA.versionId,
        },
      },
      variantB: {
        type: 'hyperparam_config',
        config: {
          ...options.variantB.hyperparams,
          name: options.variantB.name,
          description: options.variantB.description,
          source: options.variantB.source,
          versionId: options.variantB.versionId,
        },
      },
      trafficSplit: options.trafficSplit,
    });
  }

  /**
   * 从现有版本创建实验
   */
  async createExperimentFromVersions(options: {
    name: string;
    description?: string;
    versionAId: string;
    versionBId: string;
    trafficSplit?: number;
  }): Promise<ABTestExperimentRecord | null> {
    // 动态导入避免循环依赖
    const { getPPOPersistenceService } = await import('../ppo/adaptive-hyperparams');
    const ppoService = getPPOPersistenceService();

    // 获取版本列表并查找指定版本
    const versionsA = await ppoService.getVersions({ limit: 100 });
    const versionA = versionsA.find(v => v.id === options.versionAId);
    const versionB = versionsA.find(v => v.id === options.versionBId);

    if (!versionA || !versionB) {
      console.error('[PPOABTesting] Version not found');
      return null;
    }

    return this.createHyperparamExperiment({
      name: options.name,
      description: options.description,
      variantA: {
        name: `Version ${versionA.version}`,
        hyperparams: versionA.config,
        source: 'version',
        versionId: options.versionAId,
      },
      variantB: {
        name: `Version ${versionB.version}`,
        hyperparams: versionB.config,
        source: 'version',
        versionId: options.versionBId,
      },
      trafficSplit: options.trafficSplit,
    });
  }

  /**
   * 获取超参数配置
   */
  getHyperparamConfig(userId: string, experimentId: string): PPOHyperparamABTestConfig['hyperparams'] | null {
    const config = this.abTestingManager.getExperimentConfig(userId, experimentId);
    if (!config) return null;

    return {
      learningRate: config.learningRate,
      clipEpsilon: config.clipEpsilon,
      entropyCoef: config.entropyCoef,
      gaeLambda: config.gaeLambda,
    };
  }

  /**
   * 记录训练结果
   */
  async recordTrainingResult(options: {
    experimentId: string;
    userId: string;
    epoch: number;
    metrics: {
      policyLoss: number;
      valueLoss: number;
      entropy: number;
      klDivergence: number;
      avgReward: number;
    };
  }): Promise<void> {
    await this.abTestingManager.recordEvent({
      experimentId: options.experimentId,
      userId: options.userId,
      eventType: 'outcome',
      eventData: {
        responseQuality: 'high',
        ...options.metrics,
      },
    });
  }

  /**
   * 分析实验结果
   */
  async analyzeExperiment(experimentId: string): Promise<PPOABTestResult | null> {
    const results = await this.abTestingManager.getResults(experimentId);
    
    if (!results.experiment) return null;

    // 获取详细事件数据
    const storage = getPersistenceStorage();
    const events = await storage.getABEvents(experimentId);

    // 分组提取指标
    const groupA: number[] = [];
    const groupB: number[] = [];

    for (const event of events) {
      // 使用 is_correct 作为代理指标
      const successMetric = event.event_data?.is_correct ? 1 : 0;
      if (event.variant === 'A') {
        groupA.push(successMetric);
      } else {
        groupB.push(successMetric);
      }
    }

    // 执行统计检验
    const testResult = StatisticalTester.bootstrapTest(groupA, groupB, {
      alpha: 0.05,
      bootstrapSamples: 1000,
    });

    // 计算各变体指标
    const variantAMetrics = this.calculateMetrics(groupA);
    const variantBMetrics = this.calculateMetrics(groupB);

    // 确定胜者
    let winner: 'A' | 'B' | 'inconclusive' = 'inconclusive';
    if (testResult.isSignificant) {
      winner = variantAMetrics.avgReward > variantBMetrics.avgReward ? 'A' : 'B';
    }

    // 提取超参数配置
    const variantAConfig = results.experiment.variant_a.config as PPOABTestResult['variantA']['hyperparams'];
    const variantBConfig = results.experiment.variant_b.config as PPOABTestResult['variantB']['hyperparams'];

    return {
      experimentId,
      variantA: {
        hyperparams: {
          learningRate: variantAConfig.learningRate ?? 3e-4,
          clipEpsilon: variantAConfig.clipEpsilon ?? 0.2,
          entropyCoef: variantAConfig.entropyCoef ?? 0.01,
          gaeLambda: variantAConfig.gaeLambda ?? 0.95,
        },
        metrics: variantAMetrics,
      },
      variantB: {
        hyperparams: {
          learningRate: variantBConfig.learningRate ?? 3e-4,
          clipEpsilon: variantBConfig.clipEpsilon ?? 0.2,
          entropyCoef: variantBConfig.entropyCoef ?? 0.01,
          gaeLambda: variantBConfig.gaeLambda ?? 0.95,
        },
        metrics: variantBMetrics,
      },
      statisticalTest: {
        testType: 'bootstrap',
        pValue: testResult.pValue,
        confidenceLevel: 0.95,
        effectSize: testResult.effectSize,
        significance: testResult.isSignificant ? 'significant' : 'not_significant',
      },
      recommendation: {
        winner,
        confidence: 1 - testResult.pValue,
        reason: winner === 'inconclusive'
          ? '结果无统计显著性差异'
          : `变体 ${winner} 在平均奖励上表现更好 (${testResult.effectSize.toFixed(2)} 效应量)`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 计算指标
   */
  private calculateMetrics(samples: number[]): PPOABTestResult['variantA']['metrics'] {
    if (samples.length === 0) {
      return {
        sampleCount: 0,
        avgReward: 0,
        avgLoss: 0,
        avgKl: 0,
        convergenceRate: 0,
        stability: 0,
      };
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length;
    const std = Math.sqrt(variance);

    // 收敛率（后50%样本中改善的比例）
    const halfIndex = Math.floor(samples.length / 2);
    const firstHalf = samples.slice(0, halfIndex);
    const secondHalf = samples.slice(halfIndex);
    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length || 0;
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length || 0;
    const convergenceRate = firstMean > 0 ? (secondMean - firstMean) / Math.abs(firstMean) : 0;

    // 稳定性（变异系数的倒数）
    const stability = mean !== 0 ? Math.abs(mean) / (std + 1e-6) : 0;

    return {
      sampleCount: samples.length,
      avgReward: mean,
      avgLoss: 0, // 需要更多事件数据
      avgKl: 0,
      convergenceRate,
      stability,
    };
  }
}

// ============================================================================
// 单例
// ============================================================================

let ppoABTestingInstance: PPOABTestingManager | null = null;

export function getPPOABTestingManager(): PPOABTestingManager {
  if (!ppoABTestingInstance) {
    ppoABTestingInstance = new PPOABTestingManager();
  }
  return ppoABTestingInstance;
}
