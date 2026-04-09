/**
 * 质量检测与反馈优化 - 集成示例
 * 
 * 本文件展示如何在分析流程中集成质量检测和反馈优化功能
 */

import { qualityChecker } from '@/lib/quality/quality-checker';
import { feedbackOptimizer } from '@/lib/quality/feedback-optimizer';
import type { AnalysisStateType } from '@/lib/langgraph/state';

// ==================== 示例 1: 分析完成后自动质量检测 ====================

/**
 * 在分析流程完成后调用此函数
 */
export async function performQualityCheckAfterAnalysis(
  analysisState: AnalysisStateType
): Promise<void> {
  console.log('[Example] 开始质量检测...');
  
  // 执行质量检测
  const report = await qualityChecker.check(analysisState);
  
  console.log('[Example] 质量检测完成:');
  console.log(`  - 综合评分: ${report.overallScore}`);
  console.log(`  - 质量等级: ${report.grade}`);
  console.log(`  - 问题数量: ${report.issues.length}`);
  console.log(`  - 严重问题: ${report.criticalIssues.length}`);
  
  // 如果存在严重问题，可以触发告警或自动修复
  if (report.criticalIssues.length > 0) {
    console.log('[Example] 发现严重问题，需要关注:');
    report.criticalIssues.forEach(issue => {
      console.log(`  - ${issue.title}: ${issue.description}`);
    });
  }
  
  // 根据报告生成优化建议
  const suggestions = feedbackOptimizer.generateOptimizationSuggestions(report);
  console.log('[Example] 优化建议:', suggestions);
}

// ==================== 示例 2: 用户反馈处理 ====================

/**
 * 用户提交反馈后调用此函数
 */
export async function handleUserFeedback(
  caseId: string,
  userId: string,
  feedbackType: 'rating' | 'thumbs' | 'dimension_rating' | 'correction' | 'preference',
  feedbackData: any
): Promise<void> {
  console.log('[Example] 处理用户反馈...');
  
  // 根据反馈类型构造反馈对象
  const feedback = {
    caseId,
    userId,
    type: feedbackType,
    ...feedbackData,
  };
  
  // 提交反馈，触发策略调整
  const result = await feedbackOptimizer.submitFeedback(feedback);
  
  console.log('[Example] 反馈已提交:', result.id);
  
  // 获取更新后的策略
  const currentStrategy = feedbackOptimizer.getCurrentStrategy();
  console.log('[Example] 当前分析策略:', currentStrategy);
}

// ==================== 示例 3: 获取反馈统计 ====================

/**
 * 获取案例或用户的反馈统计
 */
export async function getFeedbackStatistics(
  caseId?: string,
  userId?: string
): Promise<void> {
  console.log('[Example] 获取反馈统计...');
  
  const stats = await feedbackOptimizer.getFeedbackStats(caseId, userId);
  
  console.log('[Example] 反馈统计:');
  console.log(`  - 总反馈数: ${stats.total}`);
  console.log(`  - 平均评分: ${stats.averageRating.toFixed(1)}`);
  console.log(`  - 点赞率: ${(stats.thumbsUpRatio * 100).toFixed(0)}%`);
  
  console.log('[Example] 维度平均分:');
  Object.entries(stats.dimensionAverages).forEach(([dim, score]) => {
    console.log(`  - ${dim}: ${score.toFixed(1)}`);
  });
  
  if (stats.topIssues.length > 0) {
    console.log('[Example] 主要问题类型:');
    stats.topIssues.forEach(({ type, count }) => {
      console.log(`  - ${type}: ${count}次`);
    });
  }
}

// ==================== 示例 4: 用户偏好管理 ====================

/**
 * 设置用户分析偏好
 */
export async function setUserAnalysisPreferences(
  userId: string,
  preferences: {
    depth?: 'shallow' | 'normal' | 'deep';
    breadth?: 'narrow' | 'normal' | 'wide';
    speed?: 'fast' | 'normal' | 'thorough';
  }
): Promise<void> {
  console.log('[Example] 设置用户偏好...');
  
  await feedbackOptimizer.updateUserPreferences(userId, preferences);
  
  // 提交偏好作为反馈（每个偏好维度单独提交）
  if (preferences.depth) {
    await feedbackOptimizer.submitFeedback({
      caseId: 'preferences',
      userId,
      type: 'preference',
      preference: {
        aspect: 'depth',
        value: preferences.depth === 'deep' ? 'high' : preferences.depth === 'shallow' ? 'low' : 'medium',
      },
    });
  }
  
  console.log('[Example] 用户偏好已更新');
}

// ==================== 示例 5: 从历史反馈中学习 ====================

/**
 * 定期执行学习，优化策略
 */
export async function learnFromHistoricalFeedback(): Promise<void> {
  console.log('[Example] 从历史反馈中学习...');
  
  // 分析最近30天的反馈
  const patterns = await feedbackOptimizer.learnFromHistory(30);
  
  console.log('[Example] 发现学习模式:');
  patterns.forEach(pattern => {
    console.log(`  - ${pattern.patternType} 模式:`);
    console.log(`    置信度: ${(pattern.confidence * 100).toFixed(0)}%`);
    console.log(`    样本数: ${pattern.sampleCount}`);
    console.log(`    调整动作: ${JSON.stringify(pattern.actions)}`);
  });
}

// ==================== 示例 6: 在 LangGraph 节点中集成 ====================

/**
 * 质量检测节点 - 可添加到 LangGraph 流程中
 */
export async function qualityCheckNode(state: AnalysisStateType): Promise<Record<string, any>> {
  // 仅在分析完成后执行质量检测
  if (!state.finalReport) {
    return {};
  }
  
  try {
    const report = await qualityChecker.check(state);
    
    // 将质量报告添加到状态中（通过扩展字段）
    return {
      qualityReport: report,
    };
  } catch (error) {
    console.error('[QualityCheckNode] 质量检测失败:', error);
    return {};
  }
}

// ==================== 示例 7: 快速质量检测（用于实时反馈） ====================

/**
 * 在分析过程中进行快速质量检测
 */
export async function quickQualityCheck(state: AnalysisStateType): Promise<{
  score: number;
  criticalIssues: number;
  needsAttention: boolean;
}> {
  const quickResult = await qualityChecker.quickCheck(state);
  
  return {
    score: quickResult.score,
    criticalIssues: quickResult.criticalIssueCount,
    needsAttention: quickResult.criticalIssueCount > 0 || quickResult.score < 50,
  };
}

// ==================== 使用示例 ====================

async function main() {
  // 模拟分析状态（简化版本，实际使用时需要完整的状态结构）
  const mockState: any = {
    query: '国际油价波动对全球经济的影响',
    sessionId: 'demo_session',
    searchResults: [
      { title: 'OPEC+决定减产', url: 'https://example.com/1', snippet: '...' },
      { title: '原油价格走势分析', url: 'https://example.com/2', snippet: '...' },
    ],
    timeline: [
      { timestamp: '2024-01', event: 'OPEC+减产决定', significance: '重要' },
    ],
    causalChain: [
      { type: 'cause', factor: 'OPEC+减产', description: '供应减少', strength: 0.8 },
    ],
    keyFactors: [],
    scenarios: [
      { name: '油价持续上涨', type: 'pessimistic', probability: 0.3, description: '...' },
    ],
    knowledgeGraph: { entities: [], relations: [] },
    finalReport: '# 分析报告\n\n...',
  };
  
  // 示例 1: 质量检测
  await performQualityCheckAfterAnalysis(mockState);
  
  // 示例 2: 用户反馈
  await handleUserFeedback('case_123', 'user_456', 'rating', { rating: 4 });
  
  // 示例 3: 反馈统计
  await getFeedbackStatistics('case_123');
  
  // 示例 4: 用户偏好
  await setUserAnalysisPreferences('user_456', { depth: 'deep' });
  
  // 示例 5: 学习
  await learnFromHistoricalFeedback();
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  main().catch(console.error);
}
