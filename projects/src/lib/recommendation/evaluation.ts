/**
 * 推荐评估模块
 *
 * 提供推荐质量评估指标、A/B测试框架
 */

import {
  RecommendationMetrics,
  EvaluationDataset,
  RecommendationResult,
  RecommendationStats,
  ABTestConfig,
  ABTestResult
} from './types';

// ============================================================================
// 评估指标计算
// ============================================================================

/**
 * 计算推荐评估指标
 */
export class RecommendationEvaluator {
  /**
   * 计算精确率@K (Precision@K)
   */
  static precisionAtK(
    recommendations: string[],
    groundTruth: string[],
    k: number
  ): number {
    const topK = recommendations.slice(0, k);
    const relevant = topK.filter(item => groundTruth.includes(item)).length;
    return relevant / k;
  }

  /**
   * 计算召回率@K (Recall@K)
   */
  static recallAtK(
    recommendations: string[],
    groundTruth: string[],
    k: number
  ): number {
    const topK = recommendations.slice(0, k);
    const relevant = topK.filter(item => groundTruth.includes(item)).length;
    return relevant / groundTruth.length;
  }

  /**
   * 计算NDCG@K (Normalized Discounted Cumulative Gain)
   */
  static ndcgAtK(
    recommendations: string[],
    groundTruth: string[],
    k: number
  ): number {
    let dcg = 0;
    for (let i = 0; i < Math.min(k, recommendations.length); i++) {
      const item = recommendations[i];
      if (groundTruth.includes(item)) {
        // 假设所有相关物品的相关性为1
        dcg += 1 / Math.log2(i + 2);
      }
    }

    // 计算理想DCG
    let idcg = 0;
    for (let i = 0; i < Math.min(k, groundTruth.length); i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    return idcg === 0 ? 0 : dcg / idcg;
  }

  /**
   * 计算MAP (Mean Average Precision)
   */
  static meanAveragePrecision(
    recommendations: string[],
    groundTruth: string[]
  ): number {
    let sumPrecisions = 0;
    let relevantCount = 0;

    for (let i = 0; i < recommendations.length; i++) {
      if (groundTruth.includes(recommendations[i])) {
        relevantCount++;
        const precision = relevantCount / (i + 1);
        sumPrecisions += precision;
      }
    }

    return relevantCount === 0 ? 0 : sumPrecisions / relevantCount;
  }

  /**
   * 计算多样性分数（基于物品相似度）
   */
  static diversity(
    recommendations: RecommendationResult[],
    similarityFunction: (a: any, b: any) => number
  ): number {
    if (recommendations.length < 2) return 1;

    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < recommendations.length; i++) {
      for (let j = i + 1; j < recommendations.length; j++) {
        const similarity = similarityFunction(
          recommendations[i].item,
          recommendations[j].item
        );
        totalSimilarity += similarity;
        pairCount++;
      }
    }

    const avgSimilarity = totalSimilarity / pairCount;
    return 1 - avgSimilarity; // 多样性 = 1 - 平均相似度
  }

  /**
   * 计算新颖性分数（基于用户历史行为）
   */
  static novelty(
    recommendations: RecommendationResult[],
    userHistoryItems: string[]
  ): number {
    if (userHistoryItems.length === 0) return 1;

    let novelCount = 0;
    for (const rec of recommendations) {
      if (!userHistoryItems.includes(rec.item.id)) {
        novelCount++;
      }
    }

    return novelCount / recommendations.length;
  }

  /**
   * 计算覆盖率分数（物品库覆盖率）
   */
  static coverage(
    allRecommendations: string[][],
    totalItems: number
  ): number {
    const uniqueItems = new Set(allRecommendations.flat());
    return uniqueItems.size / totalItems;
  }

  /**
   * 计算惊喜性分数（新颖性但相关）
   */
  static serendipity(
    recommendations: RecommendationResult[],
    groundTruth: string[],
    userHistoryItems: string[]
  ): number {
    let serendipitousCount = 0;

    for (const rec of recommendations) {
      const isNovel = !userHistoryItems.includes(rec.item.id);
      const isRelevant = groundTruth.includes(rec.item.id);

      if (isNovel && isRelevant) {
        serendipitousCount++;
      }
    }

    return serendipitousCount / recommendations.length;
  }

  /**
   * 计算可解释性分数（基于解释的质量）
   */
  static explainability(recommendations: RecommendationResult[]): number {
    if (recommendations.length === 0) return 0;

    let totalScore = 0;
    for (const rec of recommendations) {
      let score = 0;

      // 解释数量（至少1个）
      if (rec.explanations.length > 0) {
        score += 0.3;
      }

      // 解释多样性（多种类型）
      const types = new Set(rec.explanations.map(e => e.type));
      score += Math.min(types.size * 0.2, 0.5);

      // 解释权重（总权重）
      const totalWeight = rec.explanations.reduce((sum, e) => sum + e.weight, 0);
      score += Math.min(totalWeight * 0.2, 0.2);

      totalScore += score;
    }

    return totalScore / recommendations.length;
  }

  /**
   * 计算所有指标
   */
  static calculateMetrics(
    recommendations: RecommendationResult[],
    groundTruth: string[],
    userHistoryItems: string[] = [],
    totalItems: number = 1000
  ): RecommendationMetrics {
    const recommendedIds = recommendations.map(r => r.item.id);

    return {
      precision: this.precisionAtK(recommendedIds, groundTruth, 10),
      recall: this.recallAtK(recommendedIds, groundTruth, 10),
      ndcg: this.ndcgAtK(recommendedIds, groundTruth, 10),
      map: this.meanAveragePrecision(recommendedIds, groundTruth),
      diversity: this.diversity(recommendations, this.simpleSimilarity),
      novelty: this.novelty(recommendations, userHistoryItems),
      coverage: this.coverage([recommendedIds], totalItems),
      serendipity: this.serendipity(recommendations, groundTruth, userHistoryItems),
      explainability: this.explainability(recommendations)
    };
  }

  /**
   * 简单的相似度计算（基于标题）
   */
  private static simpleSimilarity(item1: any, item2: any): number {
    const title1 = item1.title?.toLowerCase() || '';
    const title2 = item2.title?.toLowerCase() || '';

    if (title1 === title2) return 1;

    const words1 = title1.split(/\s+/);
    const words2 = title2.split(/\s+/);

    const intersection = words1.filter(w => words2.includes(w));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size;
  }
}

// ============================================================================
// A/B测试框架
// ============================================================================

/**
 * A/B测试管理器
 */
export class ABTestManager {
  private tests: Map<string, ABTestConfig> = new Map();
  private results: Map<string, ABTestResult[]> = new Map();

  /**
   * 创建A/B测试
   */
  createTest(config: ABTestConfig): string {
    this.tests.set(config.testId, config);
    return config.testId;
  }

  /**
   * 获取测试配置
   */
  getTest(testId: string): ABTestConfig | undefined {
    return this.tests.get(testId);
  }

  /**
   * 为用户分配变体
   */
  assignVariant(testId: string, userId: string): string | null {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') return null;

    // 使用用户ID哈希分配变体
    const hash = this.hashString(userId + testId);
    const cumulativeProb = test.trafficSplit.reduce((sum, prob, idx) => {
      if (hash < sum + prob) {
        return idx; // 返回第一个超过hash的索引
      }
      return sum + prob;
    }, 0);

    return test.variants[Math.min(cumulativeProb, test.variants.length - 1)].variantId;
  }

  /**
   * 记录测试结果
   */
  recordResult(testId: string, variantId: string, metrics: Record<string, number>): void {
    const testResults = this.results.get(testId) || [];
    testResults.push({
      testId,
      variantId,
      metrics,
      improvement: {},
      significance: {},
      winner: false
    });
    this.results.set(testId, testResults);
  }

  /**
   * 分析测试结果
   */
  analyzeTest(testId: string): Map<string, ABTestResult> {
    const test = this.tests.get(testId);
    const testResults = this.results.get(testId);

    if (!test || !testResults || testResults.length === 0) {
      return new Map();
    }

    // 按变体分组
    const variantResults = new Map<string, any[]>();
    for (const result of testResults) {
      const results = variantResults.get(result.variantId) || [];
      results.push(result.metrics);
      variantResults.set(result.variantId, results);
    }

    // 计算每个变体的统计信息
    const analyzedResults = new Map<string, ABTestResult>();

    for (const [variantId, metrics] of variantResults) {
      const avgMetrics: Record<string, number> = {};
      for (const metric of test.metrics) {
        const values = metrics.map(m => m[metric]).filter(v => typeof v === 'number');
        if (values.length > 0) {
          avgMetrics[metric] = values.reduce((sum, v) => sum + v, 0) / values.length;
        }
      }

      analyzedResults.set(variantId, {
        testId,
        variantId,
        metrics: avgMetrics,
        improvement: {},
        significance: {},
        winner: false
      });
    }

    // 计算改进和显著性（简化实现）
    const baselineMetrics = analyzedResults.get(test.variants[0].variantId)?.metrics || {};
    for (const variant of test.variants) {
      if (variant.variantId === test.variants[0].variantId) continue;

      const result = analyzedResults.get(variant.variantId);
      if (!result) continue;

      for (const metric of test.metrics) {
        const baseline = baselineMetrics[metric] || 0;
        const current = result.metrics[metric] || 0;
        result.improvement[metric] = baseline === 0 ? 0 : (current - baseline) / baseline;
        result.significance[metric] = 0.95; // 简化实现，实际应进行统计检验
      }

      analyzedResults.set(variant.variantId, result);
    }

    // 确定获胜者（基于主要指标）
    const primaryMetric = test.metrics[0];
    let bestVariant = test.variants[0].variantId;
    let bestScore = analyzedResults.get(bestVariant)?.metrics[primaryMetric] || 0;

    for (const variant of test.variants) {
      const score = analyzedResults.get(variant.variantId)?.metrics[primaryMetric] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestVariant = variant.variantId;
      }
    }

    const winner = analyzedResults.get(bestVariant);
    if (winner) {
      winner.winner = true;
      analyzedResults.set(bestVariant, winner);
    }

    return analyzedResults;
  }

  /**
   * 字符串哈希函数
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash / 2147483647); // Normalize to 0-1
  }
}

// ============================================================================
// 离线评估
// ============================================================================

/**
 * 离线评估器
 */
export class OfflineEvaluator {
  /**
   * 评估数据集
   */
  static async evaluateDataset(
    dataset: EvaluationDataset,
    recommendationEngine: any
  ): Promise<RecommendationMetrics[]> {
    const allMetrics: RecommendationMetrics[] = [];

    for (const testCase of dataset.testCases) {
      // 生成推荐
      const recommendations = await recommendationEngine.recommend({
        userId: testCase.userId,
        scenario: 'general_recommendation',
        limit: 10,
        context: testCase.context
      });

      // 计算指标
      const metrics = RecommendationEvaluator.calculateMetrics(
        recommendations,
        testCase.groundTruth,
        [],
        testCase.candidates.length
      );

      allMetrics.push(metrics);
    }

    return allMetrics;
  }

  /**
   * 计算平均指标
   */
  static calculateAverageMetrics(metricsList: RecommendationMetrics[]): RecommendationMetrics {
    if (metricsList.length === 0) {
      return {
        precision: 0,
        recall: 0,
        ndcg: 0,
        map: 0,
        diversity: 0,
        novelty: 0,
        coverage: 0,
        serendipity: 0,
        explainability: 0
      };
    }

    const sum = metricsList.reduce((acc, metrics) => ({
      precision: acc.precision + metrics.precision,
      recall: acc.recall + metrics.recall,
      ndcg: acc.ndcg + metrics.ndcg,
      map: acc.map + metrics.map,
      diversity: acc.diversity + metrics.diversity,
      novelty: acc.novelty + metrics.novelty,
      coverage: acc.coverage + metrics.coverage,
      serendipity: acc.serendipity + metrics.serendipity,
      explainability: acc.explainability + metrics.explainability
    }), {
      precision: 0,
      recall: 0,
      ndcg: 0,
      map: 0,
      diversity: 0,
      novelty: 0,
      coverage: 0,
      serendipity: 0,
      explainability: 0
    });

    const count = metricsList.length;
    return {
      precision: sum.precision / count,
      recall: sum.recall / count,
      ndcg: sum.ndcg / count,
      map: sum.map / count,
      diversity: sum.diversity / count,
      novelty: sum.novelty / count,
      coverage: sum.coverage / count,
      serendipity: sum.serendipity / count,
      explainability: sum.explainability / count
    };
  }
}

// ============================================================================
// 导出单例
// ============================================================================

export const abTestManager = new ABTestManager();
