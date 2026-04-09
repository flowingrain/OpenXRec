// ============================================================================
// 用户系统类型定义
// ============================================================================

// 用户相关类型
export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  role: 'user' | 'admin';
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
  full_name?: string;
  bio?: string;
}

export interface UserUpdate {
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  email?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  expires_at: string;
}

// 会话相关类型
export interface UserSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

// 交互历史类型
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

export type ItemType = 'recommendation' | 'knowledge' | 'entity' | 'relation' | 'case';

export interface UserInteraction {
  id: string;
  user_id: string;
  interaction_type: InteractionType;
  item_id?: string;
  item_type: ItemType;
  item_data: Record<string, any>;
  context: Record<string, any>;
  page_url?: string;
  session_id?: string;
  duration_ms?: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreateInteraction {
  interaction_type: InteractionType;
  item_id?: string;
  item_type?: ItemType;
  item_data?: Record<string, any>;
  context?: Record<string, any>;
  page_url?: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

// 用户画像类型
export interface UserProfile {
  id: string;
  user_id: string;

  // 兴趣偏好
  interests: Record<string, number>;
  preferred_categories: string[];
  preferred_entities: string[];
  preferred_topics: string[];

  // 行为模式
  behavior_pattern: Record<string, any>;
  activity_pattern: Record<string, any>;
  time_pattern: Record<string, any>;

  // 偏好权重
  diversity_weight: number;
  novelty_weight: number;
  relevance_weight: number;

  // 统计数据
  total_interactions: number;
  total_views: number;
  total_clicks: number;
  total_likes: number;
  total_dislikes: number;
  session_count: number;

  // 画像版本
  profile_version: number;
  last_updated_at: string;
  last_interaction_at?: string;

  created_at: string;
  updated_at: string;
}

// 推荐历史类型
export interface RecommendationHistory {
  id: string;
  user_id: string;
  recommendation_id: string;
  items: any[];
  context: Record<string, any>;
  algorithm: string;
  parameters: Record<string, any>;
  user_feedback: Record<string, any>;
  impressions: number;
  clicks: number;
  ctr: number;
  created_at: string;
}

// 用户反馈类型
export type FeedbackType = 'rating' | 'like' | 'dislike' | 'comment' | 'report' | 'suggestion';

export interface UserFeedback {
  id: string;
  user_id: string;
  item_id?: string;
  item_type: string;
  feedback_type: FeedbackType;
  rating?: number;
  comment?: string;
  sentiment_score?: number;
  is_anonymous: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreateFeedback {
  item_id?: string;
  item_type: string;
  feedback_type: FeedbackType;
  rating?: number;
  comment?: string;
  is_anonymous?: boolean;
  metadata?: Record<string, any>;
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

// 分页响应
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
