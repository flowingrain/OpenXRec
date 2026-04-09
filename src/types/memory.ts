/**
 * 记忆系统类型定义
 */

import type { Timestamp } from './storage';

// 交互类型
export type InteractionType =
  | 'view'
  | 'click'
  | 'like'
  | 'dislike'
  | 'share'
  | 'bookmark'
  | 'comment'
  | 'rating'
  | 'search'
  | 'filter'
  | 'recommendation_request'
  | 'recommendation_accept'
  | 'recommendation_reject';

// 交互记录
export interface InteractionRecord {
  id: string;
  userId: string;
  type: InteractionType;
  itemId?: string;
  itemType?: 'recommendation' | 'knowledge' | 'entity' | 'relation' | 'case';
  itemData?: Record<string, any>;
  context: {
    scenario?: string;
    timestamp: Timestamp;
    pageUrl?: string;
    sessionId?: string;
    durationMs?: number;
  };
  metadata?: Record<string, any>;
  createdAt: Timestamp;
}

// 用户兴趣
export interface UserInterest {
  name: string;
  weight: number; // 0-1
  updatedAt: Timestamp;
}

// 用户偏好
export interface UserPreference {
  diversityWeight: number; // 0-1
  noveltyWeight: number; // 0-1
  relevanceWeight: number; // 0-1
  preferredCategories: string[];
  preferredEntities: string[];
  preferredTopics: string[];
  updatedAt: Timestamp;
}

// 用户行为模式
export interface BehaviorPattern {
  activeHours: number[]; // 0-23
  avgSessionDuration: number; // 秒
  avgClickRate: number; // 点击率
  avgDwellTime: number; // 停留时间（秒）
  diversityPreference: number; // 0-1
  noveltyPreference: number; // 0-1
  updatedAt: Timestamp;
}

// 用户画像
export interface UserProfile {
  userId: string;
  interests: UserInterest[];
  preference: UserPreference;
  behaviorPattern: BehaviorPattern;
  stats: {
    totalInteractions: number;
    totalViews: number;
    totalClicks: number;
    totalLikes: number;
    totalDislikes: number;
    sessionCount: number;
  };
  profileVersion: number;
  lastUpdatedAt: Timestamp;
  createdAt: Timestamp;
}

// 会话上下文
export interface SessionContext {
  sessionId: string;
  userId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  interactions: InteractionRecord[];
  currentView?: string;
  currentScenario?: string;
  metadata?: Record<string, any>;
}

// 记忆检索选项
export interface MemoryQueryOptions {
  userId: string;
  interactionTypes?: InteractionType[];
  itemTypes?: string[];
  startTime?: Timestamp;
  endTime?: Timestamp;
  limit?: number;
}

// 记忆统计
export interface MemoryStats {
  totalInteractions: number;
  interactionsByType: Record<InteractionType, number>;
  activeUsers: number;
  avgInteractionsPerUser: number;
  memorySizeBytes: number;
}
