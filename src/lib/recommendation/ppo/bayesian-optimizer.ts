/**
 * 贝叶斯优化器
 * 
 * 使用高斯过程作为代理模型，实现超参数的智能优化
 * 支持多种采集函数：Expected Improvement (EI), Upper Confidence Bound (UCB), Probability of Improvement (PI)
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 超参数配置
 */
export interface HyperparamConfig {
  learningRate: number;
  clipEpsilon: number;
  entropyCoef: number;
  gaeLambda: number;
}

/**
 * 超参数空间定义
 */
export interface HyperparamSpace {
  learningRate: { min: number; max: number; scale: 'log' | 'linear' };
  clipEpsilon: { min: number; max: number; scale: 'linear' };
  entropyCoef: { min: number; max: number; scale: 'log' };
  gaeLambda: { min: number; max: number; scale: 'linear' };
}

/**
 * 观测数据点
 */
export interface Observation {
  config: HyperparamConfig;
  performance: number;
  timestamp: number;
}

/**
 * 采集函数类型
 */
export type AcquisitionType = 'ei' | 'ucb' | 'pi';

/**
 * 贝叶斯优化器配置
 */
export interface BayesianOptimizerConfig {
  /** 超参数搜索空间 */
  space: HyperparamSpace;
  /** 采集函数类型 */
  acquisitionType: AcquisitionType;
  /** UCB 的探索参数 (通常 1-3) */
  ucbKappa: number;
  /** EI/PI 的探索参数 */
  xi: number;
  /** 高斯过程的噪声方差 */
  noiseVariance: number;
  /** 核函数类型 */
  kernelType: 'rbf' | 'matern' | 'linear';
  /** 核函数参数 */
  kernelParams: {
    lengthScale: number;
    variance: number;
  };
  /** 最大观测数量 */
  maxObservations: number;
}

/**
 * 默认超参数空间
 */
export const DEFAULT_SPACE: HyperparamSpace = {
  learningRate: { min: 1e-5, max: 1e-3, scale: 'log' },
  clipEpsilon: { min: 0.05, max: 0.3, scale: 'linear' },
  entropyCoef: { min: 0.001, max: 0.1, scale: 'log' },
  gaeLambda: { min: 0.9, max: 0.99, scale: 'linear' },
};

/**
 * 默认优化器配置
 */
export const DEFAULT_CONFIG: BayesianOptimizerConfig = {
  space: DEFAULT_SPACE,
  acquisitionType: 'ei',
  ucbKappa: 2.0,
  xi: 0.01,
  noiseVariance: 1e-4,
  kernelType: 'rbf',
  kernelParams: {
    lengthScale: 1.0,
    variance: 1.0,
  },
  maxObservations: 100,
};

// ============================================================================
// 核函数
// ============================================================================

/**
 * RBF (Radial Basis Function) 核函数
 */
function rbfKernel(
  x1: number[],
  x2: number[],
  lengthScale: number,
  variance: number
): number {
  const diff = x1.map((xi, i) => Math.pow(xi - x2[i], 2));
  const squaredDist = diff.reduce((sum, d) => sum + d, 0);
  return variance * Math.exp(-0.5 * squaredDist / Math.pow(lengthScale, 2));
}

/**
 * Matérn 5/2 核函数
 */
function maternKernel(
  x1: number[],
  x2: number[],
  lengthScale: number,
  variance: number
): number {
  const diff = x1.map((xi, i) => Math.abs(xi - x2[i]));
  const dist = Math.sqrt(diff.reduce((sum, d) => sum + d * d, 0));
  const r = dist / lengthScale;
  
  if (r === 0) return variance;
  
  const sqrt5 = Math.sqrt(5);
  return variance * (1 + sqrt5 * r + (5/3) * r * r) * Math.exp(-sqrt5 * r);
}

/**
 * 计算核矩阵
 */
function computeKernelMatrix(
  X: number[][],
  config: BayesianOptimizerConfig
): number[][] {
  const n = X.length;
  const K: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  const { lengthScale, variance } = config.kernelParams;
  const kernel = config.kernelType === 'rbf' ? rbfKernel : maternKernel;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      K[i][j] = kernel(X[i], X[j], lengthScale, variance);
      if (i === j) {
        K[i][j] += config.noiseVariance;
      }
    }
  }

  return K;
}

// ============================================================================
// 采集函数
// ============================================================================

/**
 * Expected Improvement (EI) 采集函数
 */
function expectedImprovement(
  x: number[],
  observations: Observation[],
  K: number[][],
  y: number[],
  KInv: number[][],
  muStar: number,
  xi: number
): number {
  const { mu, sigma } = gaussianProcessPredict(x, observations, K, y, KInv);
  
  if (sigma < 1e-10) return 0;
  
  const improvement = mu - muStar - xi;
  const Z = improvement / sigma;
  
  // 标准正态分布的 PDF 和 CDF
  const phiZ = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * Z * Z);
  const PhiZ = 0.5 * (1 + erf(Z / Math.sqrt(2)));
  
  return improvement * PhiZ + sigma * phiZ;
}

/**
 * Upper Confidence Bound (UCB) 采集函数
 */
function upperConfidenceBound(
  x: number[],
  observations: Observation[],
  K: number[][],
  y: number[],
  KInv: number[][],
  kappa: number
): number {
  const { mu, sigma } = gaussianProcessPredict(x, observations, K, y, KInv);
  return mu + kappa * sigma;
}

/**
 * Probability of Improvement (PI) 采集函数
 */
function probabilityOfImprovement(
  x: number[],
  observations: Observation[],
  K: number[][],
  y: number[],
  KInv: number[][],
  muStar: number,
  xi: number
): number {
  const { mu, sigma } = gaussianProcessPredict(x, observations, K, y, KInv);
  
  if (sigma < 1e-10) return 0;
  
  const Z = (mu - muStar - xi) / sigma;
  return 0.5 * (1 + erf(Z / Math.sqrt(2)));
}

// ============================================================================
// 高斯过程
// ============================================================================

/**
 * 高斯过程预测
 */
function gaussianProcessPredict(
  x: number[],
  observations: Observation[],
  K: number[][],
  y: number[],
  KInv: number[][],
): { mu: number; sigma: number } {
  if (observations.length === 0) {
    return { mu: 0, sigma: 1 };
  }

  const X = observations.map(obs => configToVector(obs.config));
  const kStar = X.map(xi => rbfKernel(xi, x, 1.0, 1.0));
  
  // 计算均值: k*^T K^-1 y
  let mu = 0;
  for (let i = 0; i < observations.length; i++) {
    for (let j = 0; j < observations.length; j++) {
      mu += kStar[i] * KInv[i][j] * y[j];
    }
  }

  // 计算方差: k(x,x) - k*^T K^-1 k*
  let variance = 1.0; // k(x, x)
  for (let i = 0; i < observations.length; i++) {
    for (let j = 0; j < observations.length; j++) {
      variance -= kStar[i] * KInv[i][j] * kStar[j];
    }
  }

  return {
    mu,
    sigma: Math.sqrt(Math.max(0, variance)),
  };
}

/**
 * 矩阵求逆 (使用 Cholesky 分解)
 */
function matrixInverse(M: number[][]): number[][] {
  const n = M.length;
  const L = choleskyDecomposition(M);
  const LInv = lowerTriangularInverse(L);
  
  // M^-1 = (L L^T)^-1 = L^-T L^-1
  const MInv: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        MInv[i][j] += LInv[k][i] * LInv[k][j];
      }
    }
  }
  
  return MInv;
}

/**
 * Cholesky 分解
 */
function choleskyDecomposition(M: number[][]): number[][] {
  const n = M.length;
  const L: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(1e-10, M[i][i] - sum));
      } else {
        L[i][j] = (M[i][j] - sum) / L[j][j];
      }
    }
  }
  
  return L;
}

/**
 * 下三角矩阵求逆
 */
function lowerTriangularInverse(L: number[][]): number[][] {
  const n = L.length;
  const LInv: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    LInv[i][i] = 1 / L[i][i];
    
    for (let j = 0; j < i; j++) {
      let sum = 0;
      for (let k = j; k < i; k++) {
        sum += L[i][k] * LInv[k][j];
      }
      LInv[i][j] = -sum / L[i][i];
    }
  }
  
  return LInv;
}

/**
 * 误差函数 (近似)
 */
function erf(x: number): number {
  // Horner 形式的近似
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 将配置转换为向量（归一化到 [0, 1]）
 */
function configToVector(config: HyperparamConfig): number[] {
  return [
    Math.log(config.learningRate),
    config.clipEpsilon,
    Math.log(config.entropyCoef),
    config.gaeLambda,
  ];
}

/**
 * 从向量恢复配置
 */
function vectorToConfig(vector: number[], space: HyperparamSpace): HyperparamConfig {
  return {
    learningRate: Math.exp(vector[0]),
    clipEpsilon: vector[1],
    entropyCoef: Math.exp(vector[2]),
    gaeLambda: vector[3],
  };
}

/**
 * 生成随机配置
 */
function randomConfig(space: HyperparamSpace): HyperparamConfig {
  const randomInRange = (min: number, max: number, scale: 'log' | 'linear') => {
    if (scale === 'log') {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      return Math.exp(logMin + Math.random() * (logMax - logMin));
    }
    return min + Math.random() * (max - min);
  };

  return {
    learningRate: randomInRange(space.learningRate.min, space.learningRate.max, space.learningRate.scale),
    clipEpsilon: randomInRange(space.clipEpsilon.min, space.clipEpsilon.max, space.clipEpsilon.scale),
    entropyCoef: randomInRange(space.entropyCoef.min, space.entropyCoef.max, space.entropyCoef.scale),
    gaeLambda: randomInRange(space.gaeLambda.min, space.gaeLambda.max, space.gaeLambda.scale),
  };
}

// ============================================================================
// 贝叶斯优化器类
// ============================================================================

export class BayesianOptimizer {
  private config: BayesianOptimizerConfig;
  private observations: Observation[] = [];
  private K: number[][] = [];
  private KInv: number[][] = [];
  private y: number[] = [];
  private bestObservation: Observation | null = null;

  constructor(config: Partial<BayesianOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 建议下一个采样点
   */
  suggestNext(): HyperparamConfig {
    // 如果观测太少，随机采样
    if (this.observations.length < 3) {
      return randomConfig(this.config.space);
    }

    // 使用采集函数优化
    let bestConfig = randomConfig(this.config.space);
    let bestAcquisition = -Infinity;

    // 随机搜索最佳采集值
    for (let i = 0; i < 100; i++) {
      const candidate = randomConfig(this.config.space);
      const x = configToVector(candidate);
      let acquisition: number;

      switch (this.config.acquisitionType) {
        case 'ei':
          acquisition = expectedImprovement(
            x, this.observations, this.K, this.y, this.KInv,
            this.bestObservation?.performance || 0,
            this.config.xi
          );
          break;
        case 'ucb':
          acquisition = upperConfidenceBound(
            x, this.observations, this.K, this.y, this.KInv,
            this.config.ucbKappa
          );
          break;
        case 'pi':
          acquisition = probabilityOfImprovement(
            x, this.observations, this.K, this.y, this.KInv,
            this.bestObservation?.performance || 0,
            this.config.xi
          );
          break;
        default:
          acquisition = 0;
      }

      if (acquisition > bestAcquisition) {
        bestAcquisition = acquisition;
        bestConfig = candidate;
      }
    }

    return bestConfig;
  }

  /**
   * 更新观测
   */
  update(config: HyperparamConfig, performance: number): void {
    const observation: Observation = {
      config,
      performance,
      timestamp: Date.now(),
    };

    this.observations.push(observation);

    // 更新最佳观测
    if (!this.bestObservation || performance > this.bestObservation.performance) {
      this.bestObservation = observation;
    }

    // 限制观测数量
    if (this.observations.length > this.config.maxObservations) {
      this.observations.shift();
    }

    // 更新高斯过程
    this.updateGP();
  }

  /**
   * 更新高斯过程
   */
  private updateGP(): void {
    if (this.observations.length === 0) return;

    const X = this.observations.map(obs => configToVector(obs.config));
    this.y = this.observations.map(obs => obs.performance);

    this.K = computeKernelMatrix(X, this.config);
    
    try {
      this.KInv = matrixInverse(this.K);
    } catch (e) {
      console.warn('[BayesianOptimizer] Matrix inversion failed, using identity');
      const n = this.K.length;
      this.KInv = Array(n).fill(null).map((_, i) => 
        Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
      );
    }
  }

  /**
   * 获取当前最优
   */
  getBest(): { config: HyperparamConfig; expectedPerformance: number } | null {
    if (!this.bestObservation) return null;
    
    return {
      config: this.bestObservation.config,
      expectedPerformance: this.bestObservation.performance,
    };
  }

  /**
   * 获取所有观测
   */
  getObservations(): Observation[] {
    return [...this.observations];
  }

  /**
   * 预测配置的性能
   */
  predict(config: HyperparamConfig): { mean: number; std: number } {
    if (this.observations.length === 0) {
      return { mean: 0, std: 1 };
    }

    const x = configToVector(config);
    const { mu, sigma } = gaussianProcessPredict(x, this.observations, this.K, this.y, this.KInv);
    
    return { mean: mu, std: sigma };
  }

  /**
   * 获取状态
   */
  getState(): {
    observationsCount: number;
    bestPerformance: number | null;
    acquisitionType: AcquisitionType;
  } {
    return {
      observationsCount: this.observations.length,
      bestPerformance: this.bestObservation?.performance || null,
      acquisitionType: this.config.acquisitionType,
    };
  }

  /**
   * 重置优化器
   */
  reset(): void {
    this.observations = [];
    this.K = [];
    this.KInv = [];
    this.y = [];
    this.bestObservation = null;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建贝叶斯优化器
 */
export function createBayesianOptimizer(
  config: Partial<BayesianOptimizerConfig> = {}
): BayesianOptimizer {
  return new BayesianOptimizer(config);
}
