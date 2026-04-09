/**
 * 可视化仪表盘服务
 * 
 * 提供校准曲线、阈值调整历史、A/B测试结果等数据
 */

import { getPersistenceStorage } from './storage';
import { getOnlineCalibrationService } from './online-calibration';
import { getABTestingManager } from './ab-testing';
import type { DashboardStats, CalibrationCurvePoint } from './types';

// ============================================================================
// 仪表盘服务
// ============================================================================

/**
 * 可视化仪表盘服务
 */
export class DashboardService {
  /**
   * 获取完整仪表盘数据
   */
  async getDashboardStats(options: {
    startTime?: Date;
    endTime?: Date;
  } = {}): Promise<DashboardStats> {
    const storage = getPersistenceStorage();
    const calibrationService = getOnlineCalibrationService();
    const abTesting = getABTestingManager();

    // 并行获取数据
    const [
      feedbackStats,
      keywordRules,
      calibrationCurve,
      optimizationHistory,
      activeExperiments,
    ] = await Promise.all([
      storage.getFeedbackStats(options),
      storage.getKeywordRules(),
      this.getCalibrationCurveData(),
      storage.getOptimizationHistory({ limit: 10 }),
      abTesting.getActiveExperiments(),
    ]);

    // 计算准确率趋势
    const accuracyTrend = await this.getAccuracyTrend(options);

    // 获取关键词效果排名
    const topKeywords = this.getTopKeywords(keywordRules);

    // 获取兜底策略统计
    const fallbackStats = await this.getFallbackStats();

    // 获取A/B测试结果
    const activeExperimentsResults = await Promise.all(
      activeExperiments.map(exp => abTesting.getResults(exp.id))
    );

    return {
      totalFeedbacks: feedbackStats.total,
      totalKeywords: keywordRules.length,
      avgAccuracy: feedbackStats.accuracy,
      accuracyTrend,
      topKeywords,
      calibrationCurve,
      fallbackStats,
      activeExperiments: activeExperimentsResults.map((result, index) => ({
        id: activeExperiments[index].id,
        name: activeExperiments[index].experiment_name,
        variantAPerformance: result.variantA.accuracy,
        variantBPerformance: result.variantB.accuracy,
        significance: result.significance,
      })),
    };
  }

  /**
   * 获取校准曲线数据
   */
  async getCalibrationCurveData(): Promise<CalibrationCurvePoint[]> {
    const calibrationService = getOnlineCalibrationService();
    return calibrationService.getCalibrationCurve();
  }

  /**
   * 获取准确率趋势
   */
  private async getAccuracyTrend(options: {
    startTime?: Date;
    endTime?: Date;
  }): Promise<Array<{
    time: string;
    accuracy: number;
    sampleCount: number;
  }>> {
    const storage = getPersistenceStorage();
    
    // 默认最近24小时，每小时一个点
    const endTime = options.endTime || new Date();
    const startTime = options.startTime || new Date(endTime.getTime() - 24 * 3600000);

    const feedbacks = await storage.getIntentFeedbacks({
      startTime,
      endTime,
      limit: 10000,
    });

    // 按小时分组
    const hourlyStats: Map<string, { total: number; correct: number }> = new Map();

    for (const feedback of feedbacks) {
      const hour = new Date(feedback.created_at).toISOString().slice(0, 13) + ':00:00';
      
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { total: 0, correct: 0 });
      }

      const stats = hourlyStats.get(hour)!;
      stats.total++;
      if (feedback.predicted_needs_search === feedback.actual_needs_search) {
        stats.correct++;
      }
    }

    // 转换为数组
    const trend: Array<{ time: string; accuracy: number; sampleCount: number }> = [];
    for (const [time, stats] of hourlyStats) {
      trend.push({
        time,
        accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
        sampleCount: stats.total,
      });
    }

    // 按时间排序
    trend.sort((a, b) => a.time.localeCompare(b.time));

    return trend;
  }

  /**
   * 获取关键词效果排名
   */
  private getTopKeywords(keywords: Array<{
    keyword: string;
    category: string;
    match_count: number;
    correct_count: number;
    confidence: number;
  }>): Array<{
    keyword: string;
    category: string;
    accuracy: number;
    matchCount: number;
  }> {
    return keywords
      .filter(k => k.match_count >= 5) // 至少5次匹配
      .map(k => ({
        keyword: k.keyword,
        category: k.category,
        accuracy: k.match_count > 0 ? k.correct_count / k.match_count : 0,
        matchCount: k.match_count,
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 20);
  }

  /**
   * 获取兜底策略统计
   */
  private async getFallbackStats(): Promise<Array<{
    level: string;
    successRate: number;
    usageCount: number;
  }>> {
    // 从反馈统计中按来源获取
    const storage = getPersistenceStorage();
    const stats = await storage.getFeedbackStats();

    return [
      {
        level: 'LLM',
        successRate: stats.bySource['llm']?.accuracy || 0.95,
        usageCount: stats.bySource['llm']?.count || 0,
      },
      {
        level: 'Rule',
        successRate: stats.bySource['rule_fallback']?.accuracy || 0.75,
        usageCount: stats.bySource['rule_fallback']?.count || 0,
      },
      {
        level: 'History',
        successRate: stats.bySource['history_fallback']?.accuracy || 0.60,
        usageCount: stats.bySource['history_fallback']?.count || 0,
      },
    ];
  }

  /**
   * 导出报告
   */
  async exportReport(options: {
    format: 'json' | 'csv';
    startTime?: Date;
    endTime?: Date;
  }): Promise<string> {
    const stats = await this.getDashboardStats(options);

    if (options.format === 'json') {
      return JSON.stringify(stats, null, 2);
    }

    // CSV 格式
    const lines: string[] = [];
    
    // 总览
    lines.push('Summary');
    lines.push(`Total Feedbacks,${stats.totalFeedbacks}`);
    lines.push(`Total Keywords,${stats.totalKeywords}`);
    lines.push(`Average Accuracy,${stats.avgAccuracy.toFixed(4)}`);
    lines.push('');

    // 校准曲线
    lines.push('Calibration Curve');
    lines.push('Predicted,Actual,Count');
    for (const point of stats.calibrationCurve) {
      lines.push(`${point.predictedProbability},${point.actualAccuracy},${point.sampleCount}`);
    }
    lines.push('');

    // 关键词效果
    lines.push('Top Keywords');
    lines.push('Keyword,Category,Accuracy,MatchCount');
    for (const kw of stats.topKeywords) {
      lines.push(`${kw.keyword},${kw.category},${kw.accuracy.toFixed(4)},${kw.matchCount}`);
    }

    return lines.join('\n');
  }
}

// ============================================================================
// 单例
// ============================================================================

let dashboardInstance: DashboardService | null = null;

export function getDashboardService(): DashboardService {
  if (!dashboardInstance) {
    dashboardInstance = new DashboardService();
  }
  return dashboardInstance;
}
