// ============================================================================
// 用户画像服务 - 基于用户交互历史生成和更新用户画像
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type {
  UserProfile,
  ApiResponse,
} from '@/types/user';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export class UserProfileService {
  /**
   * 获取用户画像
   */
  static async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: error?.message || '用户画像不存在'
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Get user profile error:', error);
      return {
        success: false,
        error: '获取用户画像失败'
      };
    }
  }

  /**
   * 生成用户画像（基于交互历史）
   */
  static async generateUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    try {
      // 获取用户的交互历史
      const { data: interactions, error } = await supabase
        .from('user_interactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // 分析交互历史，生成画像
      const profile = await this.analyzeInteractions(userId, interactions || []);

      // 检查是否已存在画像
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id, profile_version')
        .eq('user_id', userId)
        .single();

      let result;
      if (existingProfile) {
        // 更新现有画像
        result = await supabase
          .from('user_profiles')
          .update({
            ...profile,
            profile_version: existingProfile.profile_version + 1,
            last_updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // 创建新画像
        result = await supabase
          .from('user_profiles')
          .insert(profile)
          .select()
          .single();
      }

      if (result.error) {
        return {
          success: false,
          error: result.error.message
        };
      }

      return {
        success: true,
        data: result.data,
        message: '用户画像生成成功'
      };
    } catch (error) {
      console.error('Generate user profile error:', error);
      return {
        success: false,
        error: '生成用户画像失败'
      };
    }
  }

  /**
   * 分析交互历史，提取用户画像特征
   */
  private static async analyzeInteractions(
    userId: string,
    interactions: any[]
  ): Promise<any> {
    // 兴趣偏好分析
    const interests: Record<string, number> = {};
    const preferredCategories: string[] = [];
    const preferredEntities: string[] = [];
    const preferredTopics: string[] = [];

    // 行为模式分析
    const behaviorPattern: Record<string, any> = {
      view_to_click_ratio: 0,
      like_to_dislike_ratio: 0,
      avg_session_duration: 0,
      peak_activity_hours: []
    };

    // 活动模式分析
    const activityPattern: Record<string, any> = {
      daily_active_sessions: 0,
      most_active_days: [],
      session_frequency: 0
    };

    // 时间模式分析
    const timePattern: Record<string, any> = {
      morning_sessions: 0,
      afternoon_sessions: 0,
      evening_sessions: 0,
      night_sessions: 0
    };

    // 统计数据
    let totalViews = 0;
    let totalClicks = 0;
    let totalLikes = 0;
    let totalDislikes = 0;
    let totalDuration = 0;
    const durationCount: number[] = [];

    // 按小时统计
    const hourCounts: Record<number, number> = {};

    // 分析每个交互
    interactions.forEach(interaction => {
      // 更新统计
      if (interaction.interaction_type === 'view') totalViews++;
      if (interaction.interaction_type === 'click') totalClicks++;
      if (interaction.interaction_type === 'like') totalLikes++;
      if (interaction.interaction_type === 'dislike') totalDislikes++;

      if (interaction.duration_ms) {
        totalDuration += interaction.duration_ms;
        durationCount.push(interaction.duration_ms);
      }

      // 分析时间模式
      const hour = new Date(interaction.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;

      if (hour >= 5 && hour < 12) timePattern.morning_sessions++;
      else if (hour >= 12 && hour < 18) timePattern.afternoon_sessions++;
      else if (hour >= 18 && hour < 22) timePattern.evening_sessions++;
      else timePattern.night_sessions++;

      // 分析兴趣偏好
      if (interaction.item_data && interaction.item_data.category) {
        const category = interaction.item_data.category;
        interests[category] = (interests[category] || 0) + 1;
      }

      if (interaction.item_data && interaction.item_data.entity) {
        const entity = interaction.item_data.entity;
        interests[entity] = (interests[entity] || 0) + 1;
      }
    });

    // 计算行为比率
    if (totalViews > 0) {
      behaviorPattern.view_to_click_ratio = totalClicks / totalViews;
    }
    if (totalDislikes > 0) {
      behaviorPattern.like_to_dislike_ratio = totalLikes / totalDislikes;
    }
    if (durationCount.length > 0) {
      behaviorPattern.avg_session_duration =
        durationCount.reduce((a, b) => a + b, 0) / durationCount.length;
    }

    // 找出活跃时段
    const sortedHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    behaviorPattern.peak_activity_hours = sortedHours.map(([hour]) => parseInt(hour));

    // 提取偏好
    const sortedInterests = Object.entries(interests)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sortedInterests.forEach(([interest, count]) => {
      preferredTopics.push(interest);
    });

    // 计算偏好权重（基于用户行为）
    const totalInteractions = interactions.length;
    let diversityWeight = 0.3;
    let noveltyWeight = 0.3;
    let relevanceWeight = 0.4;

    if (totalInteractions > 10) {
      // 根据用户行为调整权重
      if (behaviorPattern.like_to_dislike_ratio > 2) {
        // 用户喜欢更多样化的内容
        diversityWeight = 0.4;
        noveltyWeight = 0.35;
        relevanceWeight = 0.25;
      } else if (behaviorPattern.like_to_dislike_ratio < 1) {
        // 用户更喜欢相关性强的内容
        diversityWeight = 0.2;
        noveltyWeight = 0.2;
        relevanceWeight = 0.6;
      }
    }

    return {
      user_id: userId,
      interests,
      preferred_categories: preferredCategories,
      preferred_entities: preferredEntities,
      preferred_topics: preferredTopics,
      behavior_pattern: behaviorPattern,
      activity_pattern: activityPattern,
      time_pattern: timePattern,
      diversity_weight: diversityWeight,
      novelty_weight: noveltyWeight,
      relevance_weight: relevanceWeight,
      total_interactions: totalInteractions,
      total_views: totalViews,
      total_clicks: totalClicks,
      total_likes: totalLikes,
      total_dislikes: totalDislikes,
      session_count: interactions.filter(i => i.session_id).length,
      profile_version: 1,
      last_interaction_at: interactions[0]?.created_at,
      last_updated_at: new Date().toISOString()
    };
  }

  /**
   * 更新用户画像
   */
  static async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<ApiResponse<UserProfile>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          last_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        return {
          success: false,
          error: error?.message || '更新失败'
        };
      }

      return {
        success: true,
        data,
        message: '用户画像更新成功'
      };
    } catch (error) {
      console.error('Update user profile error:', error);
      return {
        success: false,
        error: '更新用户画像失败'
      };
    }
  }

  /**
   * 重置用户画像权重
   */
  static async resetProfileWeights(userId: string): Promise<ApiResponse<UserProfile>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          diversity_weight: 0.3,
          novelty_weight: 0.3,
          relevance_weight: 0.4,
          last_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        return {
          success: false,
          error: error?.message || '重置失败'
        };
      }

      return {
        success: true,
        data,
        message: '权重重置成功'
      };
    } catch (error) {
      console.error('Reset profile weights error:', error);
      return {
        success: false,
        error: '重置权重失败'
      };
    }
  }
}
