/**
 * PPO 超参数-性能知识库与分析服务
 * 
 * 功能：
 * 1. 从训练历史中自动提取知识
 * 2. 计算超参数-性能相关性
 * 3. 发现最优参数范围
 * 4. 生成调整建议
 * 5. 支持知识冲突检测和合并
 */

import type {
  PPOTrainingHistoryRecord,
  PPOHyperparamKnowledgeRecord,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 相关性分析结果
 */
export interface CorrelationAnalysisResult {
  paramName: string;
  metricName: string;
  
  // 统计指标
  correlation: number;           // Pearson 相关系数
  spearmanCorrelation: number;   // Spearman 等级相关
  pValue: number;                // 显著性 p 值
  sampleSize: number;            // 样本量
  
  // 解释
  interpretation: 'positive' | 'negative' | 'neutral';
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  confidence: number;            // 置信度 0-1
  
  // 可视化数据
  scatterData?: Array<{ x: number; y: number }>;
  regressionLine?: { slope: number; intercept: number };
}

/**
 * 参数范围分析结果
 */
export interface ParameterRangeAnalysis {
  paramName: string;
  
  // 最优范围
  optimalRange: {
    min: number;
    max: number;
    center: number;
  };
  
  // 统计信息
  statistics: {
    mean: number;
    median: number;
    std: number;
    quartiles: {
      q1: number;
      q2: number;
      q3: number;
    };
  };
  
  // 性能分布
  performanceByRange: Array<{
    range: string;
    avgReward: number;
    sampleCount: number;
  }>;
  
  // 置信度
  confidence: number;
}

/**
 * 调整建议
 */
export interface AdjustmentRecommendation {
  paramName: string;
  current: number;
  recommended: number;
  
  // 调整信息
  direction: 'increase' | 'decrease' | 'maintain';
  magnitude: number;             // 调整幅度
  reason: string;
  
  // 预期效果
  expectedImprovement: number;   // 预期提升比例
  confidence: number;
  
  // 基于的证据
  evidence: {
    correlation: number;
    sampleCount: number;
    knowledgeSource: string;
  };
}

/**
 * 知识冲突检测结果
 */
export interface KnowledgeConflict {
  id: string;
  type: 'range_conflict' | 'value_conflict' | 'trend_conflict';
  
  // 冲突的知识
  knowledge1: PPOHyperparamKnowledgeRecord;
  knowledge2: PPOHyperparamKnowledgeRecord;
  
  // 冲突描述
  description: string;
  
  // 解决建议
  resolution: 'keep_both' | 'prefer_newer' | 'prefer_higher_confidence' | 'merge';
}

/**
 * 分析配置
 */
export interface AnalysisConfig {
  // 最小样本量
  minSampleSize: number;
  
  // 相关性阈值
  correlationThreshold: number;
  
  // 分箱数量
  binCount: number;
  
  // 是否启用回归分析
  enableRegression: boolean;
  
  // 是否检测异常值
  detectOutliers: boolean;
  
  // 异常值阈值（标准差倍数）
  outlierThreshold: number;
}

/**
 * 默认配置
 */
const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  minSampleSize: 30,
  correlationThreshold: 0.3,
  binCount: 10,
  enableRegression: true,
  detectOutliers: true,
  outlierThreshold: 2,
};

// ============================================================================
// 知识分析服务
// ============================================================================

/**
 * PPO 超参数知识分析服务
 */
export class PPOKnowledgeAnalyzer {
  private config: AnalysisConfig;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = { ...DEFAULT_ANALYSIS_CONFIG, ...config };
  }

  // ===========================================================================
  // 核心分析接口
  // ===========================================================================

  /**
   * 分析超参数与性能的相关性
   */
  analyzeCorrelation(
    history: PPOTrainingHistoryRecord[],
    paramName: keyof PPOTrainingHistoryRecord['hyperparams'],
    metricName: keyof PPOTrainingHistoryRecord['metrics']
  ): CorrelationAnalysisResult | null {
    if (history.length < this.config.minSampleSize) {
      return null;
    }
    
    // 提取数据对
    const pairs: Array<{ x: number; y: number }> = history.map(h => ({
      x: Number(h.hyperparams[paramName]),
      y: Number(h.metrics[metricName]),
    }));
    
    // 过滤无效值
    const validPairs = pairs.filter(p => !isNaN(p.x) && !isNaN(p.y) && isFinite(p.x) && isFinite(p.y));
    
    if (validPairs.length < this.config.minSampleSize) {
      return null;
    }
    
    // 移除异常值
    const cleanedPairs = this.config.detectOutliers
      ? this.removeOutliers(validPairs)
      : validPairs;
    
    const xValues = cleanedPairs.map(p => p.x);
    const yValues = cleanedPairs.map(p => p.y);
    
    // 计算 Pearson 相关系数
    const pearsonCorrelation = this.calculatePearsonCorrelation(xValues, yValues);
    
    // 计算 Spearman 等级相关
    const spearmanCorrelation = this.calculateSpearmanCorrelation(xValues, yValues);
    
    // 计算 p 值（使用 t 分布近似）
    const n = cleanedPairs.length;
    const tStatistic = Math.abs(pearsonCorrelation) * Math.sqrt((n - 2) / (1 - pearsonCorrelation ** 2));
    const pValue = this.tDistributionPValue(tStatistic, n - 2);
    
    // 计算回归线
    const regressionLine = this.config.enableRegression
      ? this.calculateRegressionLine(xValues, yValues)
      : undefined;
    
    // 解释相关性
    const interpretation = this.interpretCorrelation(pearsonCorrelation);
    const strength = this.determineStrength(Math.abs(pearsonCorrelation));
    const confidence = this.calculateConfidence(pearsonCorrelation, n, pValue);
    
    return {
      paramName: paramName as string,
      metricName: metricName as string,
      correlation: pearsonCorrelation,
      spearmanCorrelation,
      pValue,
      sampleSize: n,
      interpretation,
      strength,
      confidence,
      scatterData: cleanedPairs,
      regressionLine,
    };
  }

  /**
   * 分析参数最优范围
   */
  analyzeOptimalRange(
    history: PPOTrainingHistoryRecord[],
    paramName: keyof PPOTrainingHistoryRecord['hyperparams'],
    topPercentile: number = 25
  ): ParameterRangeAnalysis | null {
    if (history.length < this.config.minSampleSize) {
      return null;
    }
    
    // 提取参数值和对应的奖励
    const data = history.map(h => ({
      value: Number(h.hyperparams[paramName]),
      reward: h.metrics.avgReward,
    })).filter(d => !isNaN(d.value) && !isNaN(d.reward));
    
    if (data.length < this.config.minSampleSize) {
      return null;
    }
    
    // 按奖励排序
    const sorted = [...data].sort((a, b) => b.reward - a.reward);
    
    // 取前 topPercentile 的数据
    const topCount = Math.ceil(data.length * topPercentile / 100);
    const topData = sorted.slice(0, topCount);
    
    // 计算最优范围
    const topValues = topData.map(d => d.value);
    const optimalMin = Math.min(...topValues);
    const optimalMax = Math.max(...topValues);
    const optimalCenter = topValues.reduce((a, b) => a + b, 0) / topValues.length;
    
    // 计算统计信息
    const allValues = data.map(d => d.value);
    const statistics = this.calculateStatistics(allValues);
    
    // 分箱分析性能分布
    const performanceByRange = this.binAnalysis(data, this.config.binCount);
    
    // 计算置信度
    const confidence = this.calculateRangeConfidence(topData, data.length);
    
    return {
      paramName: paramName as string,
      optimalRange: {
        min: optimalMin,
        max: optimalMax,
        center: optimalCenter,
      },
      statistics,
      performanceByRange,
      confidence,
    };
  }

  /**
   * 生成调整建议
   */
  generateRecommendations(
    currentConfig: {
      learningRate: number;
      clipEpsilon: number;
      entropyCoef: number;
      gaeLambda: number;
    },
    knowledge: PPOHyperparamKnowledgeRecord[]
  ): AdjustmentRecommendation[] {
    const recommendations: AdjustmentRecommendation[] = [];
    
    for (const [paramName, currentValue] of Object.entries(currentConfig)) {
      // 查找相关约束知识
      const constraintKnowledge = knowledge.find(
        k => k.param_name === paramName && k.knowledge_type === 'constraint'
      );
      
      // 查找相关性知识
      const correlationKnowledge = knowledge.find(
        k => k.param_name === paramName && k.knowledge_type === 'correlation'
      );
      
      // 查找最佳实践
      const bestPractice = knowledge.find(
        k => k.param_name === paramName && k.knowledge_type === 'best_practice'
      );
      
      let recommendation: AdjustmentRecommendation | null = null;
      
      // 优先使用最佳实践
      if (bestPractice && bestPractice.knowledge.value !== undefined) {
        const recommendedValue = Number(bestPractice.knowledge.value);
        if (Math.abs(currentValue - recommendedValue) > 0.0001) {
          recommendation = {
            paramName,
            current: currentValue,
            recommended: recommendedValue,
            direction: currentValue < recommendedValue ? 'increase' : 'decrease',
            magnitude: Math.abs(recommendedValue - currentValue),
            reason: `基于最佳实践: ${bestPractice.knowledge.description}`,
            expectedImprovement: bestPractice.confidence * 0.1,
            confidence: bestPractice.confidence,
            evidence: {
              correlation: 0,
              sampleCount: bestPractice.sample_count,
              knowledgeSource: bestPractice.source,
            },
          };
        }
      }
      
      // 使用约束知识检查范围
      if (!recommendation && constraintKnowledge && constraintKnowledge.knowledge.range) {
        const { min, max } = constraintKnowledge.knowledge.range;
        
        if (currentValue < min) {
          recommendation = {
            paramName,
            current: currentValue,
            recommended: min,
            direction: 'increase',
            magnitude: min - currentValue,
            reason: `当前值低于推荐范围下限 (${min})`,
            expectedImprovement: constraintKnowledge.confidence * 0.05,
            confidence: constraintKnowledge.confidence,
            evidence: {
              correlation: 0,
              sampleCount: constraintKnowledge.sample_count,
              knowledgeSource: constraintKnowledge.source,
            },
          };
        } else if (currentValue > max) {
          recommendation = {
            paramName,
            current: currentValue,
            recommended: max,
            direction: 'decrease',
            magnitude: currentValue - max,
            reason: `当前值高于推荐范围上限 (${max})`,
            expectedImprovement: constraintKnowledge.confidence * 0.05,
            confidence: constraintKnowledge.confidence,
            evidence: {
              correlation: 0,
              sampleCount: constraintKnowledge.sample_count,
              knowledgeSource: constraintKnowledge.source,
            },
          };
        }
      }
      
      // 使用相关性知识
      if (!recommendation && correlationKnowledge) {
        const correlation = Number(correlationKnowledge.knowledge.value) || 0;
        
        if (Math.abs(correlation) > this.config.correlationThreshold) {
          // 基于相关性给出建议（简化：正相关时建议保持在范围内的较高值）
          const direction = correlation > 0 ? 'increase' : 'decrease';
          
          recommendation = {
            paramName,
            current: currentValue,
            recommended: currentValue, // 保持当前，但提示相关性
            direction: 'maintain',
            magnitude: 0,
            reason: `${paramName} 与性能呈 ${correlation > 0 ? '正' : '负'}相关 (${correlation.toFixed(3)})`,
            expectedImprovement: Math.abs(correlation) * 0.02,
            confidence: correlationKnowledge.confidence,
            evidence: {
              correlation,
              sampleCount: correlationKnowledge.sample_count,
              knowledgeSource: correlationKnowledge.source,
            },
          };
        }
      }
      
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }
    
    // 按预期改进排序
    return recommendations.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
  }

  /**
   * 检测知识冲突
   */
  detectConflicts(knowledge: PPOHyperparamKnowledgeRecord[]): KnowledgeConflict[] {
    const conflicts: KnowledgeConflict[] = [];
    
    // 按参数分组
    const grouped = new Map<string, PPOHyperparamKnowledgeRecord[]>();
    for (const k of knowledge) {
      if (!grouped.has(k.param_name)) {
        grouped.set(k.param_name, []);
      }
      grouped.get(k.param_name)!.push(k);
    }
    
    // 检测同参数不同知识之间的冲突
    for (const [paramName, records] of grouped) {
      // 范围冲突
      const constraints = records.filter(r => r.knowledge_type === 'constraint' && r.knowledge.range);
      for (let i = 0; i < constraints.length; i++) {
        for (let j = i + 1; j < constraints.length; j++) {
          const range1 = constraints[i].knowledge.range!;
          const range2 = constraints[j].knowledge.range!;
          
          // 检查范围是否重叠
          if (range1.max < range2.min || range2.max < range1.min) {
            conflicts.push({
              id: `conflict_${paramName}_${i}_${j}`,
              type: 'range_conflict',
              knowledge1: constraints[i],
              knowledge2: constraints[j],
              description: `参数 ${paramName} 的推荐范围不重叠: [${range1.min}, ${range1.max}] vs [${range2.min}, ${range2.max}]`,
              resolution: constraints[i].confidence > constraints[j].confidence
                ? 'prefer_higher_confidence'
                : 'merge',
            });
          }
        }
      }
      
      // 趋势冲突
      const correlations = records.filter(r => r.knowledge_type === 'correlation');
      for (let i = 0; i < correlations.length; i++) {
        for (let j = i + 1; j < correlations.length; j++) {
          const corr1 = Number(correlations[i].knowledge.value) || 0;
          const corr2 = Number(correlations[j].knowledge.value) || 0;
          
          // 检查趋势是否相反
          if (corr1 * corr2 < 0 && Math.abs(corr1) > 0.3 && Math.abs(corr2) > 0.3) {
            conflicts.push({
              id: `conflict_${paramName}_trend_${i}_${j}`,
              type: 'trend_conflict',
              knowledge1: correlations[i],
              knowledge2: correlations[j],
              description: `参数 ${paramName} 的相关性趋势相反: ${corr1.toFixed(3)} vs ${corr2.toFixed(3)}`,
              resolution: correlations[i].sample_count > correlations[j].sample_count
                ? 'prefer_newer'
                : 'keep_both',
            });
          }
        }
      }
    }
    
    return conflicts;
  }

  // ===========================================================================
  // 统计方法
  // ===========================================================================

  /**
   * 计算 Pearson 相关系数
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
    
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }
    
    const denominator = Math.sqrt(sumX2 * sumY2);
    return denominator > 0 ? sumXY / denominator : 0;
  }

  /**
   * 计算 Spearman 等级相关
   */
  private calculateSpearmanCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    // 计算秩
    const rankX = this.calculateRanks(x.slice(0, n));
    const rankY = this.calculateRanks(y.slice(0, n));
    
    // 使用 Pearson 公式计算秩相关
    return this.calculatePearsonCorrelation(rankX, rankY);
  }

  /**
   * 计算秩
   */
  private calculateRanks(values: number[]): number[] {
    const sorted = values
      .map((v, i) => ({ value: v, index: i }))
      .sort((a, b) => a.value - b.value);
    
    const ranks = new Array(values.length);
    
    for (let i = 0; i < sorted.length; i++) {
      ranks[sorted[i].index] = i + 1;
    }
    
    return ranks;
  }

  /**
   * 计算 t 分布 p 值（近似）
   */
  private tDistributionPValue(t: number, df: number): number {
    // 使用正态近似
    if (df > 30) {
      return 2 * (1 - this.normalCDF(Math.abs(t)));
    }
    
    // 小样本使用近似公式
    const x = df / (df + t * t);
    return this.incompleteBeta(df / 2, 0.5, x);
  }

  /**
   * 计算回归线
   */
  private calculateRegressionLine(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = Math.min(x.length, y.length);
    
    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += (x[i] - meanX) ** 2;
    }
    
    const slope = denominator > 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;
    
    return { slope, intercept };
  }

  /**
   * 移除异常值
   */
  private removeOutliers(pairs: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    const yValues = pairs.map(p => p.y);
    const mean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    const std = Math.sqrt(yValues.reduce((sum, y) => sum + (y - mean) ** 2, 0) / yValues.length);
    
    const threshold = std * this.config.outlierThreshold;
    
    return pairs.filter(p => Math.abs(p.y - mean) <= threshold);
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(values: number[]): ParameterRangeAnalysis['statistics'] {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    const std = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n);
    
    const q1Index = Math.floor(n * 0.25);
    const q2Index = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);
    
    return {
      mean,
      median,
      std,
      quartiles: {
        q1: sorted[q1Index],
        q2: sorted[q2Index],
        q3: sorted[q3Index],
      },
    };
  }

  /**
   * 分箱分析
   */
  private binAnalysis(
    data: Array<{ value: number; reward: number }>,
    binCount: number
  ): ParameterRangeAnalysis['performanceByRange'] {
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / binCount;
    
    const bins: Array<{ range: string; rewards: number[] }> = [];
    
    for (let i = 0; i < binCount; i++) {
      const binMin = min + i * binWidth;
      const binMax = min + (i + 1) * binWidth;
      bins.push({
        range: `[${binMin.toFixed(4)}, ${binMax.toFixed(4)})`,
        rewards: [],
      });
    }
    
    for (const d of data) {
      let binIndex = Math.floor((d.value - min) / binWidth);
      binIndex = Math.max(0, Math.min(binCount - 1, binIndex));
      bins[binIndex].rewards.push(d.reward);
    }
    
    return bins.map(b => ({
      range: b.range,
      avgReward: b.rewards.length > 0
        ? b.rewards.reduce((a, r) => a + r, 0) / b.rewards.length
        : 0,
      sampleCount: b.rewards.length,
    }));
  }

  /**
   * 解释相关性
   */
  private interpretCorrelation(correlation: number): 'positive' | 'negative' | 'neutral' {
    if (correlation > 0.1) return 'positive';
    if (correlation < -0.1) return 'negative';
    return 'neutral';
  }

  /**
   * 确定相关性强度
   */
  private determineStrength(absCorrelation: number): 'strong' | 'moderate' | 'weak' | 'none' {
    if (absCorrelation >= 0.7) return 'strong';
    if (absCorrelation >= 0.4) return 'moderate';
    if (absCorrelation >= 0.1) return 'weak';
    return 'none';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(correlation: number, sampleSize: number, pValue: number): number {
    // 基于样本量、相关性和显著性
    const sampleFactor = Math.min(1, sampleSize / 100);
    const correlationFactor = Math.abs(correlation);
    const significanceFactor = 1 - pValue;
    
    return (sampleFactor * 0.3 + correlationFactor * 0.4 + significanceFactor * 0.3);
  }

  /**
   * 计算范围置信度
   */
  private calculateRangeConfidence(topData: Array<{ value: number; reward: number }>, totalSamples: number): number {
    const topCount = topData.length;
    const proportion = topCount / totalSamples;
    
    // 基于比例和样本量计算置信度
    return Math.min(0.95, proportion * 2 + topCount / 50);
  }

  /**
   * 正态分布 CDF（近似）
   */
  private normalCDF(x: number): number {
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
  private incompleteBeta(a: number, b: number, x: number): number {
    if (x === 0) return 0;
    if (x === 1) return 1;
    
    // 简化近似
    return x ** a * (1 - x) ** b / (a * this.beta(a, b));
  }

  /**
   * Beta 函数
   */
  private beta(a: number, b: number): number {
    return Math.exp(this.logGamma(a) + this.logGamma(b) - this.logGamma(a + b));
  }

  /**
   * 对数 Gamma 函数（近似）
   */
  private logGamma(x: number): number {
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
}

// ============================================================================
// 单例
// ============================================================================

let analyzerInstance: PPOKnowledgeAnalyzer | null = null;

export function getPPOKnowledgeAnalyzer(config?: Partial<AnalysisConfig>): PPOKnowledgeAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new PPOKnowledgeAnalyzer(config);
  }
  return analyzerInstance;
}

export default PPOKnowledgeAnalyzer;
