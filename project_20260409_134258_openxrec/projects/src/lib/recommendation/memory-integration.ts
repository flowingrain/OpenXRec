// @ts-nocheck
/**
 * 推荐系统与记忆系统集成服务
 * 
 * 功能：
 * - 记录用户反馈，学习用户偏好
 * - 存储推荐历史和上下文
 * - 支持基于记忆的个性化推荐
 */

import {
  getMemoryManager,
  MemoryManager,
  MemoryEntry,
  ConversationMemory
} from '../memory';
import type { RecommendationItem, UserProfile, RecommendationContext } from './types';
import type { UserBehavior as RecUserBehavior } from './types';

// ==================== 类型定义 ====================

export interface RecommendationMemoryContext {
  userId: string;
  scenario: string;
  sessionId?: string;
}

export interface RecommendationFeedback {
  userId: string;
  itemId: string;
  feedback: 'like' | 'dislike' | 'neutral' | 'click' | 'view' | 'purchase';
  rating?: number;
  timestamp: number;
  context?: {
    position?: number;
    strategy?: string;
    explanation?: string;
  };
}

export interface RecommendationSession {
  sessionId: string;
  userId: string;
  scenario: string;
  startTime: number;
  endTime?: number;
  recommendations: Array<{
    itemId: string;
    score: number;
    position: number;
    feedback?: RecommendationFeedback;
  }>;
  context: RecommendationContext;
}

export interface PreferenceLearning {
  userId: string;
  preferences: Record<string, any>;
  lastUpdated: number;
  confidence: number;
}

// ==================== 推荐记忆管理器 ====================

/**
 * 推荐记忆管理器
 * 将记忆系统能力集成到推荐系统中
 */
export class RecommendationMemoryManager {
  private memoryManager: MemoryManager;
  private currentSessions: Map<string, RecommendationSession> = new Map();
  
  constructor() {
    this.memoryManager = getMemoryManager();
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    console.log('[RecommendationMemory] Initializing...');
    
    // 确保有会话
    if (!this.memoryManager.getCurrentSession()) {
      await this.memoryManager.createSession();
    }
    
    console.log('[RecommendationMemory] Initialized successfully');
  }

  /**
   * 记录推荐会话
   */
  async recordRecommendationSession(
    session: RecommendationSession
  ): Promise<void> {
    // 1. 存储到内存
    this.currentSessions.set(session.sessionId, session);

    // 2. 转换为长期记忆
    const sessionData = {
      sessionId: session.sessionId,
      userId: session.userId,
      scenario: session.scenario,
      itemCount: session.recommendations.length
    };

    const memoryEntry: MemoryEntry = {
      id: `rec_session_${session.sessionId}`,
      type: 'context',
      content: `推荐会话：${session.scenario}，推荐了 ${session.recommendations.length} 个物品\n${JSON.stringify(sessionData)}`,
      metadata: {
        timestamp: Date.now(),
        importance: 0.7,
      }
    };

    await this.memoryManager.addMemory(memoryEntry);

    // 3. 更新会话记忆
    if (this.memoryManager.getCurrentSession()) {
      await this.memoryManager.addMessage(
        'system',
        `推荐会话：${session.scenario}`
      );
    }

    console.log(`[RecommendationMemory] Recorded session ${session.sessionId}`);
  }

  /**
   * 记录用户反馈
   */
  async recordUserFeedback(feedback: RecommendationFeedback): Promise<void> {
    const { userId, itemId, feedback: feedbackType, rating, timestamp, context } = feedback;

    // 1. 学习用户偏好
    await this.learnPreference(userId, {
      itemId,
      feedback: feedbackType,
      rating,
      context
    });

    // 2. 记录为长期记忆
    const feedbackData = {
      userId,
      itemId,
      feedback: feedbackType,
      rating,
      timestamp,
      context
    };

    const feedbackEntry: MemoryEntry = {
      id: `rec_feedback_${userId}_${itemId}_${timestamp}`,
      type: 'preference',
      content: `用户对物品 ${itemId} 的反馈：${feedbackType}${rating ? `，评分：${rating}` : ''}\n${JSON.stringify(feedbackData)}`,
      metadata: {
        timestamp,
        importance: this.calculateFeedbackImportance(feedbackType, rating),
      }
    };

    await this.memoryManager.addMemory(feedbackEntry);

    // 3. 更新会话上下文
    if (this.memoryManager.getCurrentSession()) {
      const lastFeedbackData = {
        itemId,
        feedback: feedbackType,
        rating,
        timestamp
      };
      await this.memoryManager.addMessage(
        'system',
        `用户反馈：${feedbackType} 物品 ${itemId}\n${JSON.stringify(lastFeedbackData)}`
      );
    }

    console.log(`[RecommendationMemory] Recorded feedback for user ${userId}, item ${itemId}`);
  }

  /**
   * 学习用户偏好
   */
  async learnPreference(
    userId: string,
    preference: {
      itemId: string;
      feedback: string;
      rating?: number;
      context?: any;
    }
  ): Promise<void> {
    const preferenceKey = `preference_${userId}_${preference.feedback}`;
    const value = {
      itemId: preference.itemId,
      feedback: preference.feedback,
      rating: preference.rating,
      timestamp: Date.now(),
      context: preference.context
    };

    // 使用记忆管理器学习偏好
    await this.memoryManager.learnPreference(preferenceKey, value);
  }

  /**
   * 获取用户偏好
   */
  async getUserPreferences(userId: string): Promise<{
    likes: string[];
    dislikes: string[];
    ratings: Record<string, number>;
    recentFeedbacks: RecommendationFeedback[];
  }> {
    // 从记忆中搜索相关反馈
    const memories = await this.memoryManager.recall(
      `用户 ${userId} 的反馈`,
      20
    );

    const preferences = {
      likes: [] as string[],
      dislikes: [] as string[],
      ratings: {} as Record<string, number>,
      recentFeedbacks: [] as RecommendationFeedback[]
    };

    for (const memory of memories) {
      if (memory.entry.type === 'preference') {
        // 尝试从 content 中解析 JSON 数据
        const lines = memory.entry.content.split('\n');
        let feedbackData: any = null;

        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            try {
              feedbackData = JSON.parse(line.trim());
              break;
            } catch {
              // 解析失败，跳过
            }
          }
        }

        if (feedbackData) {
          const { userId: memUserId, itemId, feedback, rating, timestamp, context } = feedbackData;

          if (memUserId === userId) {
            // 添加到喜欢/不喜欢列表
            if (feedback === 'like' || feedback === 'purchase') {
              preferences.likes.push(itemId);
            } else if (feedback === 'dislike') {
              preferences.dislikes.push(itemId);
            }

            // 记录评分
            if (rating) {
              preferences.ratings[itemId] = rating;
            }

            // 添加到最近反馈
            preferences.recentFeedbacks.push({
              userId: memUserId,
              itemId,
              feedback: feedback as any,
              rating,
              timestamp,
              context
            });
          }
        }
      }
    }

    // 按时间排序最近反馈
    preferences.recentFeedbacks.sort((a, b) => b.timestamp - a.timestamp);
    preferences.recentFeedbacks = preferences.recentFeedbacks.slice(0, 50);

    return preferences;
  }

  /**
   * 获取推荐历史
   */
  async getRecommendationHistory(
    userId: string,
    limit: number = 20
  ): Promise<RecommendationSession[]> {
    // 从记忆中搜索推荐会话
    const memories = await this.memoryManager.recall(
      `用户 ${userId} 的推荐会话`,
      limit
    );

    const sessions: RecommendationSession[] = [];

    for (const memory of memories) {
      if (memory.entry.type === 'context') {
        // 尝试从 content 中解析会话 ID
        const lines = memory.entry.content.split('\n');
        let sessionId: string | null = null;

        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            try {
              const data = JSON.parse(line.trim());
              if (data.sessionId) {
                sessionId = data.sessionId;
                break;
              }
            } catch {
              // 解析失败，跳过
            }
          }
        }

        if (sessionId) {
          const session = this.currentSessions.get(sessionId);
          if (session && session.userId === userId) {
            sessions.push(session);
          }
        }
      }
    }

    // 按时间排序
    sessions.sort((a, b) => b.startTime - a.startTime);

    return sessions.slice(0, limit);
  }

  /**
   * 创建推荐会话
   */
  async createRecommendationSession(
    userId: string,
    scenario: string,
    context: RecommendationContext
  ): Promise<string> {
    const sessionId = `rec_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: RecommendationSession = {
      sessionId,
      userId,
      scenario,
      startTime: Date.now(),
      recommendations: [],
      context
    };

    this.currentSessions.set(sessionId, session);

    return sessionId;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(sessionId: string): RecommendationSession | null {
    return this.currentSessions.get(sessionId) || null;
  }

  /**
   * 更新推荐会话
   */
  async updateRecommendationSession(
    sessionId: string,
    updates: Partial<RecommendationSession>
  ): Promise<void> {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    const updatedSession = {
      ...session,
      ...updates
    };

    this.currentSessions.set(sessionId, updatedSession);
  }

  /**
   * 添加推荐到会话
   */
  async addRecommendationToSession(
    sessionId: string,
    itemId: string,
    score: number,
    position: number
  ): Promise<void> {
    const session = this.currentSessions.get(sessionId);
    if (!session) return;

    session.recommendations.push({
      itemId,
      score,
      position
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

    // 持久化到记忆
    await this.recordRecommendationSession(session);
  }

  /**
   * 计算反馈重要性
   */
  private calculateFeedbackImportance(
    feedback: string,
    rating?: number
  ): number {
    let importance = 0.5;

    switch (feedback) {
      case 'purchase':
        importance = 0.9;
        break;
      case 'like':
        importance = 0.8;
        break;
      case 'dislike':
        importance = 0.7;
        break;
      case 'click':
        importance = 0.6;
        break;
      case 'view':
        importance = 0.5;
        break;
      default:
        importance = 0.5;
    }

    // 考虑评分
    if (rating) {
      importance = (importance + rating / 5) / 2;
    }

    return importance;
  }

  /**
   * 获取记忆统计
   */
  getStats(): {
    currentSessions: number;
    totalMemories: number;
    currentSession: ConversationMemory | null;
  } {
    return {
      currentSessions: this.currentSessions.size,
      totalMemories: this.memoryManager.getCurrentSession()?.messages.length || 0,
      currentSession: this.memoryManager.getCurrentSession()
    };
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(maxAge: number = 86400000): Promise<void> {
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
      console.log(`[RecommendationMemory] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }
}

// ==================== 单例导出 ====================

let recommendationMemoryManagerInstance: RecommendationMemoryManager | null = null;

export function getRecommendationMemoryManager(): RecommendationMemoryManager {
  if (!recommendationMemoryManagerInstance) {
    recommendationMemoryManagerInstance = new RecommendationMemoryManager();
  }
  return recommendationMemoryManagerInstance;
}
