// @ts-nocheck
/**
 * 基于 Supabase 的推荐记忆服务
 * 
 * 功能：
 * - 使用 recommendation_feedbacks 表记录推荐反馈
 * - 使用 user_interactions 表记录交互历史
 * - 使用 user_preferences 表存储用户偏好
 * - 支持用户行为分析和偏好学习
 * - 与推荐系统深度集成
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { userFeedbacks, userPreferences } from '@/storage/database/shared/schema';
import type { UserProfile } from './types';

// ==================== 类型定义 ====================

export interface SupabaseUserFeedback {
  id: string;
  userId: string;
  caseId: string;
  feedbackType: 'like' | 'dislike' | 'neutral' | 'click' | 'view' | 'purchase';
  rating?: number;
  comment?: string;
  aspects?: any;
  userContext?: any;
  createdAt: number;
}

export interface SupabaseUserPreference {
  id: string;
  userId: string;
  preferences: {
    interests?: string[];
    likedItems?: string[];
    dislikedItems?: string[];
    ratings?: Record<string, number>;
    behaviors?: Record<string, number>;
    [key: string]: any;
  };
  updatedAt: number;
}

export interface RecommendationSession {
  sessionId: string;
  userId: string;
  scenario: string;
  startTime: number;
  endTime?: number;
  recommendations: any[];
}

// ==================== Supabase 推荐记忆管理器 ====================

/**
 * Supabase 推荐记忆管理器
 */
export class SupabaseRecommendationMemoryManager {
  private supabase: ReturnType<typeof getSupabaseClient>;
  private currentSessions: Map<string, RecommendationSession> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[SupabaseRecommendationMemory] Initializing...');

    // 检查数据库连接 - 使用 recommendation_feedbacks 表
    const { data, error } = await this.supabase
      .from('recommendation_feedbacks')
      .select('count')
      .limit(1);

    if (error) {
      console.warn('[SupabaseRecommendationMemory] Database check failed:', error.message);
      // 不阻止初始化，允许降级
      this.initialized = false;
      return;
    }

    this.initialized = true;
    console.log('[SupabaseRecommendationMemory] Initialized successfully');
  }

  /**
   * 记录用户反馈
   */
  async recordUserFeedback(feedback: {
    userId: string;
    itemId: string;
    feedbackType: 'like' | 'dislike' | 'neutral' | 'click' | 'view' | 'purchase';
    rating?: number;
    comment?: string;
    context?: any;
  }): Promise<void> {
    const { userId, itemId, feedbackType, rating, comment, context } = feedback;

    // 插入到 recommendation_feedbacks 表（支持匿名用户）
    const { data, error } = await this.supabase
      .from('recommendation_feedbacks')
      .insert({
        user_id: userId,  // 会话 ID 或用户 ID
        recommendation_id: 'session_' + userId,
        item_id: itemId,
        item_title: itemId,
        item_type: 'knowledge',
        feedback_type: feedbackType === 'like' ? 'helpful' : 
                      feedbackType === 'dislike' ? 'not_relevant' : 
                      feedbackType === 'click' ? 'click' : 
                      feedbackType === 'view' ? 'view' : feedbackType,
        rating: rating || null,
        comment: comment || null,
        metadata: context || {}
      })
      .select()
      .single();

    if (error) {
      console.warn('[SupabaseRecommendationMemory] Failed to record feedback:', error.message);
      // 不抛出错误，允许降级
      return;
    }

    console.log(`[SupabaseRecommendationMemory] Recorded feedback for user ${userId}, item ${itemId}`);
  }

  /**
   * 更新用户偏好
   */
  private async updateUserPreferences(
    userId: string,
    feedback: {
      itemId: string;
      feedbackType: string;
      rating?: number;
    }
  ): Promise<void> {
    // 获取当前偏好
    const { data: existingPref } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('userId', userId)
      .single();

    const preferences = existingPref?.preferences || {
      interests: [],
      likedItems: [],
      dislikedItems: [],
      ratings: {},
      behaviors: {}
    };

    // 更新偏好
    if (feedback.feedbackType === 'like' || feedback.feedbackType === 'purchase') {
      if (!preferences.likedItems.includes(feedback.itemId)) {
        preferences.likedItems.push(feedback.itemId);
      }
    } else if (feedback.feedbackType === 'dislike') {
      if (!preferences.dislikedItems.includes(feedback.itemId)) {
        preferences.dislikedItems.push(feedback.itemId);
      }
    }

    // 更新评分
    if (feedback.rating !== undefined) {
      preferences.ratings[feedback.itemId] = feedback.rating;
    }

    // 更新行为计数
    preferences.behaviors[feedback.feedbackType] = (preferences.behaviors[feedback.feedbackType] || 0) + 1;

    // 保存或更新
    if (existingPref) {
      const { error } = await this.supabase
        .from('user_preferences')
        .update({
          preferences: preferences,
          updatedAt: new Date().toISOString()
        })
        .eq('userId', userId);

      if (error) {
        console.error('[SupabaseRecommendationMemory] Failed to update preferences:', error);
      }
    } else {
      const { error } = await this.supabase
        .from('user_preferences')
        .insert({
          userId: userId,
          preferences: preferences
        });

      if (error) {
        console.error('[SupabaseRecommendationMemory] Failed to insert preferences:', error);
      }
    }
  }

  /**
   * 获取用户偏好
   */
  async getUserPreferences(userId: string): Promise<SupabaseUserPreference | null> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.userId,
      preferences: data.preferences,
      updatedAt: new Date(data.updatedAt).getTime()
    };
  }

  /**
   * 获取用户反馈历史
   */
  async getUserFeedbacks(
    userId: string,
    limit: number = 50
  ): Promise<SupabaseUserFeedback[]> {
    const { data, error } = await this.supabase
      .from('user_feedback')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      id: item.id,
      userId: item.userId,
      caseId: item.caseId,
      feedbackType: item.feedbackType as any,
      rating: item.rating,
      comment: item.comment,
      aspects: item.aspects,
      userContext: item.userContext,
      createdAt: new Date(item.createdAt).getTime()
    }));
  }

  /**
   * 创建推荐会话
   */
  createRecommendationSession(
    userId: string,
    scenario: string
  ): string {
    const sessionId = `rec_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: RecommendationSession = {
      sessionId,
      userId,
      scenario,
      startTime: Date.now(),
      recommendations: []
    };

    this.currentSessions.set(sessionId, session);

    return sessionId;
  }

  /**
   * 添加推荐到会话
   */
  addRecommendationToSession(
    sessionId: string,
    item: any,
    score: number
  ): void {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    session.recommendations.push({
      itemId: item.id,
      score,
      item
    });

    this.currentSessions.set(sessionId, session);
  }

  /**
   * 结束推荐会话
   */
  async endRecommendationSession(sessionId: string): Promise<void> {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    session.endTime = Date.now();
    this.currentSessions.set(sessionId, session);

    // 将会话信息记录到 user_feedback（作为会话记录）
    await this.supabase
      .from('user_feedback')
      .insert({
        caseId: sessionId,
        feedbackType: 'session',
        comment: JSON.stringify({
          scenario: session.scenario,
          startTime: session.startTime,
          endTime: session.endTime,
          recommendationCount: session.recommendations.length
        })
      });

    console.log(`[SupabaseRecommendationMemory] Ended session ${sessionId}`);
  }

  /**
   * 获取用户画像
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    // 获取用户偏好
    const userPref = await this.getUserPreferences(userId);
    const preferences = userPref?.preferences || {};

    // 获取用户反馈历史
    const feedbacks = await this.getUserFeedbacks(userId, 100);

    // 构建用户画像
    const interests = preferences.interests || [];
    const history = feedbacks.map(f => ({
      itemId: f.caseId,
      action: f.feedbackType,
      rating: f.rating,
      timestamp: f.createdAt
    }));

    return {
      userId,
      interests,
      preferences,
      behaviorHistory: history,
      createdAt: userPref?.createdAt || Date.now(),
      updatedAt: userPref?.updatedAt || Date.now(),
    };
  }

  /**
   * 分析用户行为模式
   */
  async analyzeUserBehavior(userId: string): Promise<{
    totalInteractions: number;
    likeRate: number;
    clickRate: number;
    purchaseRate: number;
    mostLikedCategory: string;
    mostActiveTime: string;
  }> {
    const feedbacks = await this.getUserFeedbacks(userId, 1000);

    if (feedbacks.length === 0) {
      return {
        totalInteractions: 0,
        likeRate: 0,
        clickRate: 0,
        purchaseRate: 0,
        mostLikedCategory: 'N/A',
        mostActiveTime: 'N/A'
      };
    }

    const totalInteractions = feedbacks.length;
    const likes = feedbacks.filter(f => f.feedbackType === 'like').length;
    const clicks = feedbacks.filter(f => f.feedbackType === 'click').length;
    const purchases = feedbacks.filter(f => f.feedbackType === 'purchase').length;

    // 分析活跃时间段
    const timeSlots: Record<string, number> = {};
    for (const feedback of feedbacks) {
      const hour = new Date(feedback.createdAt).getHours();
      const slot = hour < 6 ? '深夜' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上';
      timeSlots[slot] = (timeSlots[slot] || 0) + 1;
    }

    const mostActiveTime = Object.entries(timeSlots)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      totalInteractions,
      likeRate: likes / totalInteractions,
      clickRate: clicks / totalInteractions,
      purchaseRate: purchases / totalInteractions,
      mostLikedCategory: '推荐', // 简化版，可以更详细分析
      mostActiveTime
    };
  }

  /**
   * 获取推荐历史
   */
  async getRecommendationHistory(userId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('user_feedback')
      .select('*')
      .eq('userId', userId)
      .eq('feedbackType', 'session')
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      sessionId: item.caseId,
      ...JSON.parse(item.comment || '{}')
    }));
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    currentSessions: number;
    totalUsers: number;
    totalFeedbacks: number;
    avgFeedbacksPerUser: number;
  }> {
    // 统计用户数
    const { count: totalUsers } = await this.supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true });

    // 统计反馈数
    const { count: totalFeedbacks } = await this.supabase
      .from('user_feedback')
      .select('*', { count: 'exact', head: true });

    return {
      currentSessions: this.currentSessions.size,
      totalUsers: totalUsers || 0,
      totalFeedbacks: totalFeedbacks || 0,
      avgFeedbacksPerUser: totalUsers && totalFeedbacks ? totalFeedbacks / totalUsers : 0
    };
  }

  /**
   * 导出记忆数据
   */
  async exportData(options: {
    userId?: string;
    limit?: number;
    includeSessions?: boolean;
  } = {}): Promise<{
    preferences: SupabaseUserPreference[];
    feedbacks: SupabaseUserFeedback[];
    sessions: RecommendationSession[];
    metadata: {
      exportDate: string;
      totalUsers: number;
      totalFeedbacks: number;
    };
  }> {
    // 导出用户偏好
    let prefQuery = this.supabase
      .from('user_preferences')
      .select('*');

    if (options.userId) {
      prefQuery = prefQuery.eq('userId', options.userId);
    }

    if (options.limit) {
      prefQuery = prefQuery.limit(options.limit);
    } else {
      prefQuery = prefQuery.limit(10000);
    }

    const { data: prefData, error: prefError } = await prefQuery;

    if (prefError) {
      throw new Error(`导出偏好失败: ${prefError.message}`);
    }

    const preferences: SupabaseUserPreference[] = prefData.map(item => ({
      id: item.id,
      userId: item.userId,
      preferences: item.preferences || {},
      updatedAt: new Date(item.updatedAt).getTime()
    }));

    // 导出用户反馈
    let feedbackQuery = this.supabase
      .from('user_feedback')
      .select('*');

    if (options.userId) {
      feedbackQuery = feedbackQuery.eq('userId', options.userId);
    }

    if (options.limit) {
      feedbackQuery = feedbackQuery.limit(options.limit);
    } else {
      feedbackQuery = feedbackQuery.limit(10000);
    }

    const { data: feedbackData, error: feedbackError } = await feedbackQuery;

    if (feedbackError) {
      throw new Error(`导出反馈失败: ${feedbackError.message}`);
    }

    const feedbacks: SupabaseUserFeedback[] = feedbackData.map(item => ({
      id: item.id,
      userId: item.userId,
      caseId: item.caseId,
      feedbackType: item.feedbackType as any,
      rating: item.rating,
      comment: item.comment,
      aspects: item.aspects,
      userContext: item.userContext,
      createdAt: new Date(item.createdAt).getTime()
    }));

    // 导出会话
    const sessions: RecommendationSession[] = options.includeSessions
      ? Array.from(this.currentSessions.values())
      : [];

    return {
      preferences,
      feedbacks,
      sessions,
      metadata: {
        exportDate: new Date().toISOString(),
        totalUsers: preferences.length,
        totalFeedbacks: feedbacks.length
      }
    };
  }

  /**
   * 导入记忆数据
   */
  async importData(data: {
    preferences?: SupabaseUserPreference[];
    feedbacks?: SupabaseUserFeedback[];
    sessions?: RecommendationSession[];
    metadata?: any;
  }, options: {
    skipExisting?: boolean;
    updateExisting?: boolean;
    batchSize?: number;
  } = {}): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const {
      skipExisting = true,
      updateExisting = false,
      batchSize = 100
    } = options;

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // 导入用户偏好
    if (data.preferences) {
      for (let i = 0; i < data.preferences.length; i += batchSize) {
        const batch = data.preferences.slice(i, i + batchSize);

        for (const pref of batch) {
          try {
            if (skipExisting || updateExisting) {
              const { data: existing } = await this.supabase
                .from('user_preferences')
                .select('id')
                .eq('userId', pref.userId)
                .single();

              if (existing) {
                if (skipExisting) {
                  continue;
                }
                if (updateExisting) {
                  const { error: updateError } = await this.supabase
                    .from('user_preferences')
                    .update({
                      preferences: pref.preferences,
                      updatedAt: new Date(pref.updatedAt).toISOString()
                    })
                    .eq('id', pref.id);

                  if (updateError) {
                    errors.push(`更新偏好 ${pref.userId} 失败: ${updateError.message}`);
                    failed++;
                  } else {
                    success++;
                  }
                  continue;
                }
              }
            }

            const { error: insertError } = await this.supabase
              .from('user_preferences')
              .insert({
                id: pref.id,
                userId: pref.userId,
                preferences: pref.preferences,
                updatedAt: new Date(pref.updatedAt).toISOString()
              });

            if (insertError) {
              errors.push(`导入偏好 ${pref.userId} 失败: ${insertError.message}`);
              failed++;
            } else {
              success++;
            }
          } catch (error: any) {
            errors.push(`处理偏好 ${pref.userId} 时出错: ${error.message}`);
            failed++;
          }
        }
      }
    }

    // 导入用户反馈
    if (data.feedbacks) {
      for (let i = 0; i < data.feedbacks.length; i += batchSize) {
        const batch = data.feedbacks.slice(i, i + batchSize);

        for (const feedback of batch) {
          try {
            const { error: insertError } = await this.supabase
              .from('user_feedback')
              .insert({
                id: feedback.id,
                userId: feedback.userId,
                caseId: feedback.caseId,
                feedbackType: feedback.feedbackType,
                rating: feedback.rating,
                comment: feedback.comment,
                aspects: feedback.aspects,
                userContext: feedback.userContext,
                createdAt: new Date(feedback.createdAt).toISOString()
              });

            if (insertError) {
              errors.push(`导入反馈 ${feedback.id} 失败: ${insertError.message}`);
              failed++;
            } else {
              success++;
            }
          } catch (error: any) {
            errors.push(`处理反馈 ${feedback.id} 时出错: ${error.message}`);
            failed++;
          }
        }
      }
    }

    // 导入会话
    if (data.sessions) {
      for (const session of data.sessions) {
        this.currentSessions.set(session.sessionId, session);
      }
      console.log(`[SupabaseRecommendationMemory] Imported ${data.sessions.length} sessions`);
    }

    console.log(`[SupabaseRecommendationMemory] 导入完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed, errors };
  }

  /**
   * 清空记忆数据
   */
  async clearAll(options: {
    userId?: string;
    confirm?: boolean;
    clearPreferences?: boolean;
    clearFeedbacks?: boolean;
  } = {}): Promise<{
    preferencesCleared: number;
    feedbacksCleared: number;
  }> {
    if (!options.confirm) {
      throw new Error('需要确认才能清空数据（设置 confirm: true）');
    }

    let preferencesCleared = 0;
    let feedbacksCleared = 0;

    if (options.clearPreferences !== false) {
      let query = this.supabase.from('user_preferences').delete();

      if (options.userId) {
        query = query.eq('userId', options.userId);
      }

      const { count: prefCount } = await this.supabase
        .from('user_preferences')
        .select('*', { count: 'exact', head: true });

      const { error: prefError } = await query;

      if (!prefError) {
        preferencesCleared = prefCount || 0;
      }
    }

    if (options.clearFeedbacks !== false) {
      let query = this.supabase.from('user_feedback').delete();

      if (options.userId) {
        query = query.eq('userId', options.userId);
      }

      const { count: feedbackCount } = await this.supabase
        .from('user_feedback')
        .select('*', { count: 'exact', head: true });

      const { error: feedbackError } = await query;

      if (!feedbackError) {
        feedbacksCleared = feedbackCount || 0;
      }
    }

    // 清空会话
    this.currentSessions.clear();

    console.log(`[SupabaseRecommendationMemory] Cleared ${preferencesCleared} preferences, ${feedbacksCleared} feedbacks`);
    return { preferencesCleared, feedbacksCleared };
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(maxAge: number = 3600000): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.currentSessions) {
      const age = now - session.startTime;
      if (age > maxAge && session.endTime) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.currentSessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`[SupabaseRecommendationMemory] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
}

// ==================== 单例导出 ====================

let supabaseMemoryManagerInstance: SupabaseRecommendationMemoryManager | null = null;

export function getSupabaseRecommendationMemoryManager(): SupabaseRecommendationMemoryManager {
  if (!supabaseMemoryManagerInstance) {
    supabaseMemoryManagerInstance = new SupabaseRecommendationMemoryManager();
  }
  return supabaseMemoryManagerInstance;
}
