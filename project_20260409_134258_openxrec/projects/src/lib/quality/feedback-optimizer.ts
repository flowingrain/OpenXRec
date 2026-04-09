/**
 * 反馈驱动优化服务
 * 
 * 功能：
 * 1. 收集用户反馈（点赞/点踩、评分、评论、标注错误）
 * 2. 根据反馈调整分析策略
 * 3. 学习优化方向，提升分析质量
 * 4. 支持个性化分析偏好
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { QualityReport, QualityDimension } from './quality-checker';

// ==================== 类型定义 ====================

/**
 * 数据库反馈行类型
 */
interface FeedbackRow {
  id: string;
  case_id: string;
  user_id?: string;
  type: FeedbackType;
  rating?: number;
  thumbs_up?: boolean;
  dimension_ratings?: Record<FeedbackDimension, number>;
  correction?: {
    type: 'entity' | 'relation' | 'event' | 'causal' | 'scenario' | 'other';
    original: string;
    corrected: string;
    reason: string;
  };
  suggestion?: {
    aspect: string;
    content: string;
    priority: 'high' | 'medium' | 'low';
  };
  preference?: {
    aspect: 'depth' | 'breadth' | 'speed' | 'source';
    value: 'high' | 'medium' | 'low';
  };
  quality_report_id?: string;
  comment?: string;
  created_at: string;
}

/**
 * 反馈类型
 */
export type FeedbackType = 
  | 'rating'        // 整体评分 1-5
  | 'thumbs'        // 点赞/点踩
  | 'dimension_rating' // 维度评分
  | 'correction'    // 错误纠正
  | 'suggestion'    // 改进建议
  | 'preference';   // 偏好设置

/**
 * 反馈维度
 */
export type FeedbackDimension = 
  | 'comprehensiveness'  // 全面性
  | 'accuracy'           // 准确性
  | 'timeliness'         // 时效性
  | 'clarity'            // 清晰度
  | 'actionability';     // 可操作性

/**
 * 用户反馈
 */
export interface UserFeedback {
  id: string;
  caseId: string;
  userId?: string;
  type: FeedbackType;
  
  // 评分类型
  rating?: number;           // 1-5分
  thumbsUp?: boolean;        // 点赞/点踩
  
  // 维度评分
  dimensionRatings?: Record<FeedbackDimension, number>;
  
  // 错误纠正
  correction?: {
    type: 'entity' | 'relation' | 'event' | 'causal' | 'scenario' | 'other';
    original: string;
    corrected: string;
    reason: string;
  };
  
  // 改进建议
  suggestion?: {
    aspect: string;
    content: string;
    priority: 'high' | 'medium' | 'low';
  };
  
  // 偏好设置
  preference?: {
    aspect: 'depth' | 'breadth' | 'speed' | 'source';
    value: 'high' | 'medium' | 'low';
  };
  
  // 元数据
  qualityReportId?: string;
  comment?: string;
  createdAt: string;
}

/**
 * 分析策略调整
 */
export interface StrategyAdjustment {
  id: string;
  triggeredBy: string[];     // 触发此调整的反馈ID
  adjustments: {
    // 搜索策略
    searchDepth?: number;         // 搜索深度 1-10
    searchBreadth?: number;       // 搜索广度（关键词数量）
    authorityWeight?: number;     // 权威来源权重
    freshnessWeight?: number;     // 时效性权重
    
    // 分析策略
    causalDepth?: number;         // 因果链深度
    scenarioCount?: number;       // 场景数量
    confidenceThreshold?: number; // 置信度阈值
    
    // 知识抽取策略
    entityMinConfidence?: number; // 实体抽取最小置信度
    relationMinConfidence?: number; // 关系抽取最小置信度
    
    // 报告策略
    reportDetailLevel?: 'brief' | 'normal' | 'detailed';
    reportLanguage?: 'formal' | 'semi-formal' | 'casual';
  };
  reason: string;
  createdAt: string;
  expiresAt?: string;        // 过期时间
}

/**
 * 学习模式
 */
export interface LearningPattern {
  id: string;
  patternType: 'positive' | 'negative';
  condition: {
    queryPattern?: string;       // 查询模式（关键词、主题）
    qualityScoreRange?: [number, number]; // 质量分范围
    timeRange?: string;          // 时间范围
  };
  actions: {
    adjustmentType: string;
    value: number | string;
  }[];
  confidence: number;          // 学习置信度
  sampleCount: number;         // 样本数量
  createdAt: string;
  updatedAt: string;
}

/**
 * 用户偏好配置
 */
export interface UserPreferences {
  userId?: string;
  
  // 分析偏好
  depth: 'shallow' | 'normal' | 'deep';    // 分析深度
  breadth: 'narrow' | 'normal' | 'wide';   // 分析广度
  speed: 'fast' | 'normal' | 'thorough';   // 分析速度
  
  // 信息偏好
  preferredSources: string[];              // 偏好的信息源类型
  avoidedSources: string[];                // 避免的信息源
  minAuthorityLevel: number;               // 最小权威级别
  
  // 输出偏好
  reportStyle: 'brief' | 'normal' | 'detailed';  // 报告风格
  focusAreas: string[];                    // 关注领域
  
  // 时间偏好
  maxAnalysisTime: number;                 // 最大分析时间(秒)
  
  updatedAt: string;
}

/**
 * 反馈优化器类
 */
export class FeedbackOptimizer {
  private supabase = getSupabaseClient();
  
  // 默认策略
  private defaultStrategy: StrategyAdjustment['adjustments'] = {
    searchDepth: 5,
    searchBreadth: 3,
    authorityWeight: 0.6,
    freshnessWeight: 0.4,
    causalDepth: 3,
    scenarioCount: 3,
    confidenceThreshold: 0.5,
    entityMinConfidence: 0.6,
    relationMinConfidence: 0.5,
    reportDetailLevel: 'normal',
    reportLanguage: 'semi-formal',
  };
  
  // 当前策略
  private currentStrategy: StrategyAdjustment['adjustments'];
  
  constructor() {
    this.currentStrategy = { ...this.defaultStrategy };
  }
  
  /**
   * 提交用户反馈
   */
  async submitFeedback(feedback: Omit<UserFeedback, 'id' | 'createdAt'>): Promise<UserFeedback> {
    const newFeedback: UserFeedback = {
      ...feedback,
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    
    // 存储反馈到数据库
    if (this.supabase) {
      const { error } = await this.supabase
        .from('analysis_feedback')
        .insert({
          id: newFeedback.id,
          case_id: newFeedback.caseId,
          user_id: newFeedback.userId,
          type: newFeedback.type,
          rating: newFeedback.rating,
          thumbs_up: newFeedback.thumbsUp,
          dimension_ratings: newFeedback.dimensionRatings,
          correction: newFeedback.correction,
          suggestion: newFeedback.suggestion,
          preference: newFeedback.preference,
          quality_report_id: newFeedback.qualityReportId,
          comment: newFeedback.comment,
          created_at: newFeedback.createdAt,
        });
      
      if (error) {
        console.error('[FeedbackOptimizer] 存储反馈失败:', error);
        // 即使存储失败也继续处理
      }
    }
    
    // 触发策略调整
    await this.adjustStrategy(newFeedback);
    
    console.log(`[FeedbackOptimizer] 收到反馈: ${feedback.type}, 案例ID: ${feedback.caseId}`);
    
    return newFeedback;
  }
  
  /**
   * 批量提交反馈
   */
  async submitBatchFeedback(feedbacks: Omit<UserFeedback, 'id' | 'createdAt'>[]): Promise<UserFeedback[]> {
    const results: UserFeedback[] = [];
    for (const feedback of feedbacks) {
      const result = await this.submitFeedback(feedback);
      results.push(result);
    }
    return results;
  }
  
  /**
   * 根据反馈调整策略
   */
  private async adjustStrategy(feedback: UserFeedback): Promise<void> {
    switch (feedback.type) {
      case 'rating':
        await this.adjustByRating(feedback);
        break;
      case 'thumbs':
        await this.adjustByThumbs(feedback);
        break;
      case 'dimension_rating':
        await this.adjustByDimensionRating(feedback);
        break;
      case 'correction':
        await this.adjustByCorrection(feedback);
        break;
      case 'suggestion':
        await this.adjustBySuggestion(feedback);
        break;
      case 'preference':
        await this.adjustByPreference(feedback);
        break;
    }
  }
  
  /**
   * 根据评分调整策略
   */
  private async adjustByRating(feedback: UserFeedback): Promise<void> {
    const rating = feedback.rating || 3;
    
    if (rating <= 2) {
      // 低分反馈：增强搜索深度和广度
      this.currentStrategy = {
        ...this.currentStrategy,
        searchDepth: Math.min(10, (this.currentStrategy.searchDepth || 5) + 1),
        searchBreadth: Math.min(5, (this.currentStrategy.searchBreadth || 3) + 1),
        causalDepth: Math.min(5, (this.currentStrategy.causalDepth || 3) + 1),
        scenarioCount: Math.min(5, (this.currentStrategy.scenarioCount || 3) + 1),
      };
      
      await this.recordAdjustment(
        [feedback.id],
        this.currentStrategy,
        `低评分(${rating}分)，增强分析深度和广度`
      );
    } else if (rating >= 4) {
      // 高分反馈：可以适当降低成本
      this.currentStrategy = {
        ...this.currentStrategy,
        searchDepth: Math.max(3, (this.currentStrategy.searchDepth || 5) - 0.5),
      };
    }
  }
  
  /**
   * 根据点赞/点踩调整策略
   */
  private async adjustByThumbs(feedback: UserFeedback): Promise<void> {
    if (feedback.thumbsUp === false) {
      // 点踩：增强分析
      this.currentStrategy = {
        ...this.currentStrategy,
        searchDepth: Math.min(10, (this.currentStrategy.searchDepth || 5) + 2),
        causalDepth: Math.min(5, (this.currentStrategy.causalDepth || 3) + 1),
        confidenceThreshold: Math.min(0.7, (this.currentStrategy.confidenceThreshold || 0.5) + 0.05),
      };
      
      await this.recordAdjustment(
        [feedback.id],
        this.currentStrategy,
        '用户点踩，增强分析质量'
      );
    }
  }
  
  /**
   * 根据维度评分调整策略
   */
  private async adjustByDimensionRating(feedback: UserFeedback): Promise<void> {
    const ratings = feedback.dimensionRatings;
    if (!ratings) return;
    
    const adjustments: Partial<StrategyAdjustment['adjustments']> = {};
    const reasons: string[] = [];
    
    // 全面性评分低 -> 增加广度
    if (ratings.comprehensiveness && ratings.comprehensiveness < 3) {
      adjustments.searchBreadth = Math.min(5, (this.currentStrategy.searchBreadth || 3) + 1);
      adjustments.scenarioCount = Math.min(5, (this.currentStrategy.scenarioCount || 3) + 1);
      reasons.push('全面性评分低');
    }
    
    // 准确性评分低 -> 提高置信度阈值
    if (ratings.accuracy && ratings.accuracy < 3) {
      adjustments.confidenceThreshold = Math.min(0.7, (this.currentStrategy.confidenceThreshold || 0.5) + 0.1);
      adjustments.entityMinConfidence = Math.min(0.8, (this.currentStrategy.entityMinConfidence || 0.6) + 0.1);
      reasons.push('准确性评分低');
    }
    
    // 时效性评分低 -> 增加时效性权重
    if (ratings.timeliness && ratings.timeliness < 3) {
      adjustments.freshnessWeight = Math.min(0.7, (this.currentStrategy.freshnessWeight || 0.4) + 0.1);
      reasons.push('时效性评分低');
    }
    
    // 清晰度评分低 -> 调整报告风格
    if (ratings.clarity && ratings.clarity < 3) {
      adjustments.reportDetailLevel = 'detailed';
      reasons.push('清晰度评分低');
    }
    
    // 可操作性评分低 -> 增加场景数量
    if (ratings.actionability && ratings.actionability < 3) {
      adjustments.scenarioCount = Math.min(5, (this.currentStrategy.scenarioCount || 3) + 1);
      reasons.push('可操作性评分低');
    }
    
    if (Object.keys(adjustments).length > 0) {
      this.currentStrategy = { ...this.currentStrategy, ...adjustments };
      await this.recordAdjustment([feedback.id], this.currentStrategy, reasons.join('，'));
    }
  }
  
  /**
   * 根据错误纠正调整策略
   */
  private async adjustByCorrection(feedback: UserFeedback): Promise<void> {
    const correction = feedback.correction;
    if (!correction) return;
    
    const adjustments: Partial<StrategyAdjustment['adjustments']> = {};
    
    switch (correction.type) {
      case 'entity':
        // 实体错误：提高实体抽取置信度
        adjustments.entityMinConfidence = Math.min(0.8, (this.currentStrategy.entityMinConfidence || 0.6) + 0.1);
        break;
      case 'relation':
        // 关系错误：提高关系抽取置信度
        adjustments.relationMinConfidence = Math.min(0.7, (this.currentStrategy.relationMinConfidence || 0.5) + 0.1);
        break;
      case 'causal':
        // 因果错误：增强因果分析深度
        adjustments.causalDepth = Math.min(5, (this.currentStrategy.causalDepth || 3) + 1);
        break;
      case 'scenario':
        // 场景错误：增加场景数量
        adjustments.scenarioCount = Math.min(5, (this.currentStrategy.scenarioCount || 3) + 1);
        break;
    }
    
    if (Object.keys(adjustments).length > 0) {
      this.currentStrategy = { ...this.currentStrategy, ...adjustments };
      await this.recordAdjustment(
        [feedback.id],
        this.currentStrategy,
        `纠正${correction.type}类型错误`
      );
    }
  }
  
  /**
   * 根据改进建议调整策略
   */
  private async adjustBySuggestion(feedback: UserFeedback): Promise<void> {
    const suggestion = feedback.suggestion;
    if (!suggestion) return;
    
    // 根据建议内容和优先级调整
    if (suggestion.priority === 'high') {
      this.currentStrategy = {
        ...this.currentStrategy,
        searchDepth: Math.min(10, (this.currentStrategy.searchDepth || 5) + 2),
        causalDepth: Math.min(5, (this.currentStrategy.causalDepth || 3) + 1),
      };
      
      await this.recordAdjustment(
        [feedback.id],
        this.currentStrategy,
        `高优先级改进建议: ${suggestion.aspect}`
      );
    }
  }
  
  /**
   * 根据偏好设置调整策略
   */
  private async adjustByPreference(feedback: UserFeedback): Promise<void> {
    const preference = feedback.preference;
    if (!preference) return;
    
    const adjustments: Partial<StrategyAdjustment['adjustments']> = {};
    
    switch (preference.aspect) {
      case 'depth':
        if (preference.value === 'high') {
          adjustments.causalDepth = 5;
          adjustments.searchDepth = 8;
        } else if (preference.value === 'low') {
          adjustments.causalDepth = 2;
          adjustments.searchDepth = 3;
        }
        break;
      case 'breadth':
        if (preference.value === 'high') {
          adjustments.searchBreadth = 5;
          adjustments.scenarioCount = 5;
        } else if (preference.value === 'low') {
          adjustments.searchBreadth = 2;
          adjustments.scenarioCount = 2;
        }
        break;
      case 'speed':
        if (preference.value === 'high') {
          adjustments.searchDepth = 3;
          adjustments.scenarioCount = 2;
        } else if (preference.value === 'low') {
          adjustments.searchDepth = 8;
          adjustments.scenarioCount = 5;
        }
        break;
      case 'source':
        if (preference.value === 'high') {
          adjustments.authorityWeight = 0.8;
        } else if (preference.value === 'low') {
          adjustments.authorityWeight = 0.4;
        }
        break;
    }
    
    if (Object.keys(adjustments).length > 0) {
      this.currentStrategy = { ...this.currentStrategy, ...adjustments };
      await this.recordAdjustment(
        [feedback.id],
        this.currentStrategy,
        `偏好设置: ${preference.aspect}=${preference.value}`
      );
    }
  }
  
  /**
   * 记录策略调整
   */
  private async recordAdjustment(
    triggeredBy: string[],
    adjustments: StrategyAdjustment['adjustments'],
    reason: string
  ): Promise<void> {
    const record: StrategyAdjustment = {
      id: `adjust_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      triggeredBy,
      adjustments,
      reason,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后过期
    };
    
    // 存储到数据库
    if (this.supabase) {
      const { error } = await this.supabase
        .from('strategy_adjustments')
        .insert({
          id: record.id,
          triggered_by: record.triggeredBy,
          adjustments: record.adjustments,
          reason: record.reason,
          created_at: record.createdAt,
          expires_at: record.expiresAt,
        });
      
      if (error) {
        console.error('[FeedbackOptimizer] 记录调整失败:', error);
      }
    }
    
    console.log(`[FeedbackOptimizer] 策略调整: ${reason}`);
  }
  
  /**
   * 获取当前策略
   */
  getCurrentStrategy(): StrategyAdjustment['adjustments'] {
    return { ...this.currentStrategy };
  }
  
  /**
   * 重置策略到默认值
   */
  resetStrategy(): void {
    this.currentStrategy = { ...this.defaultStrategy };
    console.log('[FeedbackOptimizer] 策略已重置为默认值');
  }
  
  /**
   * 获取用户偏好
   */
  async getUserPreferences(userId?: string): Promise<UserPreferences> {
    // 如果有userId，从数据库获取
    if (userId && this.supabase) {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (!error && data) {
        return {
          userId: data.user_id,
          depth: data.depth,
          breadth: data.breadth,
          speed: data.speed,
          preferredSources: data.preferred_sources || [],
          avoidedSources: data.avoided_sources || [],
          minAuthorityLevel: data.min_authority_level || 3,
          reportStyle: data.report_style || 'normal',
          focusAreas: data.focus_areas || [],
          maxAnalysisTime: data.max_analysis_time || 120,
          updatedAt: data.updated_at,
        };
      }
    }
    
    // 返回默认偏好
    return {
      userId,
      depth: 'normal',
      breadth: 'normal',
      speed: 'normal',
      preferredSources: [],
      avoidedSources: [],
      minAuthorityLevel: 3,
      reportStyle: 'normal',
      focusAreas: [],
      maxAnalysisTime: 120,
      updatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * 更新用户偏好
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        depth: preferences.depth,
        breadth: preferences.breadth,
        speed: preferences.speed,
        preferred_sources: preferences.preferredSources,
        avoided_sources: preferences.avoidedSources,
        min_authority_level: preferences.minAuthorityLevel,
        report_style: preferences.reportStyle,
        focus_areas: preferences.focusAreas,
        max_analysis_time: preferences.maxAnalysisTime,
        updated_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error('[FeedbackOptimizer] 更新偏好失败:', error);
    }
    
    // 根据偏好调整策略
    if (preferences.depth === 'deep') {
      this.currentStrategy.causalDepth = 5;
      this.currentStrategy.searchDepth = 8;
    } else if (preferences.depth === 'shallow') {
      this.currentStrategy.causalDepth = 2;
      this.currentStrategy.searchDepth = 3;
    }
    
    console.log('[FeedbackOptimizer] 用户偏好已更新');
  }
  
  /**
   * 获取反馈统计
   */
  async getFeedbackStats(caseId?: string, userId?: string): Promise<{
    total: number;
    averageRating: number;
    thumbsUpRatio: number;
    dimensionAverages: Record<FeedbackDimension, number>;
    topIssues: { type: string; count: number }[];
  }> {
    if (!this.supabase) {
      return {
        total: 0,
        averageRating: 0,
        thumbsUpRatio: 0,
        dimensionAverages: {
          comprehensiveness: 0,
          accuracy: 0,
          timeliness: 0,
          clarity: 0,
          actionability: 0,
        },
        topIssues: [],
      };
    }
    let query = this.supabase
      .from('analysis_feedback')
      .select('*');
    
    if (caseId) {
      query = query.eq('case_id', caseId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data: feedbacks, error } = await query;
    
    if (error || !feedbacks || feedbacks.length === 0) {
      return {
        total: 0,
        averageRating: 0,
        thumbsUpRatio: 0,
        dimensionAverages: {
          comprehensiveness: 0,
          accuracy: 0,
          timeliness: 0,
          clarity: 0,
          actionability: 0,
        },
        topIssues: [],
      };
    }
    
    // 使用类型断言
    const typedFeedbacks = feedbacks as FeedbackRow[];
    
    const ratings = typedFeedbacks.filter((f: FeedbackRow) => f.rating).map((f: FeedbackRow) => f.rating!);
    const thumbs = typedFeedbacks.filter((f: FeedbackRow) => f.thumbs_up !== null && f.thumbs_up !== undefined);
    
    // 计算维度平均分
    const dimensionAverages: Record<FeedbackDimension, number> = {
      comprehensiveness: 0,
      accuracy: 0,
      timeliness: 0,
      clarity: 0,
      actionability: 0,
    };
    
    const dimensionFeedbacks = typedFeedbacks.filter((f: FeedbackRow) => f.dimension_ratings);
    if (dimensionFeedbacks.length > 0) {
      for (const dim of Object.keys(dimensionAverages) as FeedbackDimension[]) {
        const scores = dimensionFeedbacks
          .map((f: FeedbackRow) => f.dimension_ratings?.[dim])
          .filter((s: number | undefined): s is number => s !== undefined);
        if (scores.length > 0) {
          dimensionAverages[dim] = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        }
      }
    }
    
    // 统计问题类型
    const issueCounts: Record<string, number> = {};
    typedFeedbacks.forEach((f: FeedbackRow) => {
      if (f.correction) {
        const type = f.correction.type;
        issueCounts[type] = (issueCounts[type] || 0) + 1;
      }
    });
    
    const topIssues = Object.entries(issueCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      total: typedFeedbacks.length,
      averageRating: ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0,
      thumbsUpRatio: thumbs.length > 0 ? thumbs.filter((t: FeedbackRow) => t.thumbs_up).length / thumbs.length : 0,
      dimensionAverages,
      topIssues,
    };
  }
  
  /**
   * 根据质量报告生成优化建议
   */
  generateOptimizationSuggestions(report: QualityReport): string[] {
    const suggestions: string[] = [];
    
    // 根据维度分数给出建议
    report.dimensionScores.forEach(ds => {
      if (ds.score < 60) {
        ds.issues.forEach(issue => {
          suggestions.push(issue.suggestion);
        });
      }
    });
    
    // 去重
    return [...new Set(suggestions)];
  }
  
  /**
   * 学习模式更新（从历史反馈中学习）
   */
  async learnFromHistory(days: number = 30): Promise<LearningPattern[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    if (!this.supabase) return [];
    const { data: feedbacks, error } = await this.supabase
      .from('analysis_feedback')
      .select('*')
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });
    
    if (error || !feedbacks) {
      return [];
    }
    
    // 使用类型断言
    const typedFeedbacks = feedbacks as FeedbackRow[];
    const patterns: LearningPattern[] = [];
    
    // 分析低分反馈模式
    const lowRatingFeedbacks = typedFeedbacks.filter((f: FeedbackRow) => f.rating && f.rating <= 2);
    if (lowRatingFeedbacks.length >= 5) {
      patterns.push({
        id: `pattern_low_rating_${Date.now()}`,
        patternType: 'negative',
        condition: {
          qualityScoreRange: [0, 40],
        },
        actions: [
          { adjustmentType: 'searchDepth', value: 8 },
          { adjustmentType: 'causalDepth', value: 4 },
        ],
        confidence: Math.min(0.9, lowRatingFeedbacks.length / 20),
        sampleCount: lowRatingFeedbacks.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    // 分析纠正类型分布
    const correctionTypes: Record<string, number> = {};
    typedFeedbacks.forEach((f: FeedbackRow) => {
      if (f.correction) {
        correctionTypes[f.correction.type] = (correctionTypes[f.correction.type] || 0) + 1;
      }
    });
    
    const topCorrectionType = Object.entries(correctionTypes)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topCorrectionType && topCorrectionType[1] >= 3) {
      const typeToAdjustment: Record<string, string> = {
        entity: 'entityMinConfidence',
        relation: 'relationMinConfidence',
        causal: 'causalDepth',
        scenario: 'scenarioCount',
      };
      
      patterns.push({
        id: `pattern_correction_${topCorrectionType[0]}_${Date.now()}`,
        patternType: 'negative',
        condition: {},
        actions: [{
          adjustmentType: typeToAdjustment[topCorrectionType[0]] || 'searchDepth',
          value: 0.7,
        }],
        confidence: Math.min(0.85, topCorrectionType[1] / 10),
        sampleCount: topCorrectionType[1],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    console.log(`[FeedbackOptimizer] 学习完成，发现 ${patterns.length} 个模式`);
    
    return patterns;
  }
}

// 导出单例
export const feedbackOptimizer = new FeedbackOptimizer();
