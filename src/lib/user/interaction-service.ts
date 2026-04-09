// ============================================================================
// 交互历史服务
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type {
  UserInteraction,
  CreateInteraction,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  UserProfile,
} from '@/types/user';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export class InteractionService {
  /**
   * 记录用户交互
   */
  static async recordInteraction(
    userId: string,
    interaction: CreateInteraction
  ): Promise<ApiResponse<UserInteraction>> {
    try {
      const { data, error } = await supabase
        .from('user_interactions')
        .insert({
          user_id: userId,
          interaction_type: interaction.interaction_type,
          item_id: interaction.item_id,
          item_type: interaction.item_type || 'recommendation',
          item_data: interaction.item_data || {},
          context: interaction.context || {},
          page_url: interaction.page_url,
          duration_ms: interaction.duration_ms,
          metadata: interaction.metadata || {}
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data,
        message: '交互记录成功'
      };
    } catch (error) {
      console.error('Record interaction error:', error);
      return {
        success: false,
        error: '记录交互失败'
      };
    }
  }

  /**
   * 获取用户交互历史
   */
  static async getUserInteractions(
    userId: string,
    params: PaginationParams & {
      interaction_type?: string;
      item_type?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaginatedResponse<UserInteraction>> {
    try {
      const {
        page = 1,
        limit = 20,
        interaction_type,
        item_type
      } = params;
      const offset = (page - 1) * limit;

      let query = supabase
        .from('user_interactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (interaction_type) {
        query = query.eq('interaction_type', interaction_type);
      }

      if (item_type) {
        query = query.eq('item_type', item_type);
      }

      const { data, error, count } = await query;

      if (error) {
        return {
          success: false,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0
          }
        };
      }

      const totalPages = count ? Math.ceil(count / limit) : 0;

      return {
        success: true,
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages
        }
      };
    } catch (error) {
      console.error('Get user interactions error:', error);
      return {
        success: false,
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        }
      };
    }
  }

  /**
   * 批量记录交互
   */
  static async batchRecordInteractions(
    userId: string,
    interactions: CreateInteraction[]
  ): Promise<ApiResponse<{ success_count: number; error_count: number }>> {
    try {
      const records = interactions.map(interaction => ({
        user_id: userId,
        interaction_type: interaction.interaction_type,
        item_id: interaction.item_id,
        item_type: interaction.item_type || 'recommendation',
        item_data: interaction.item_data || {},
        context: interaction.context || {},
        page_url: interaction.page_url,
        duration_ms: interaction.duration_ms,
        metadata: interaction.metadata || {}
      }));

      const { data, error } = await supabase
        .from('user_interactions')
        .insert(records)
        .select();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data: {
          success_count: data?.length || 0,
          error_count: 0
        },
        message: `成功记录 ${data?.length || 0} 条交互`
      };
    } catch (error) {
      console.error('Batch record interactions error:', error);
      return {
        success: false,
        error: '批量记录交互失败'
      };
    }
  }

  /**
   * 获取用户统计
   */
  static async getUserStats(userId: string): Promise<ApiResponse<{
    total_interactions: number;
    total_views: number;
    total_clicks: number;
    total_likes: number;
    total_dislikes: number;
    interaction_counts: Record<string, number>;
    activity_by_day: Array<{ date: string; count: number }>;
  }>> {
    try {
      // 获取总交互数
      const { count: totalInteractions } = await supabase
        .from('user_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // 获取各类型交互数
      const { data: typeCounts } = await supabase
        .from('user_interactions')
        .select('interaction_type')
        .eq('user_id', userId);

      const interactionCounts: Record<string, number> = {};
      typeCounts?.forEach(item => {
        interactionCounts[item.interaction_type] =
          (interactionCounts[item.interaction_type] || 0) + 1;
      });

      // 获取最近7天的活动
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentActivity } = await supabase
        .from('user_interactions')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString());

      const activityByDay: Record<string, number> = {};
      recentActivity?.forEach(item => {
        const date = item.created_at.split('T')[0];
        activityByDay[date] = (activityByDay[date] || 0) + 1;
      });

      const activityByDayArray = Object.entries(activityByDay)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        success: true,
        data: {
          total_interactions: totalInteractions || 0,
          total_views: interactionCounts['view'] || 0,
          total_clicks: interactionCounts['click'] || 0,
          total_likes: interactionCounts['like'] || 0,
          total_dislikes: interactionCounts['dislike'] || 0,
          interaction_counts: interactionCounts,
          activity_by_day: activityByDayArray
        }
      };
    } catch (error) {
      console.error('Get user stats error:', error);
      return {
        success: false,
        error: '获取用户统计失败'
      };
    }
  }

  /**
   * 删除交互记录
   */
  static async deleteInteraction(
    userId: string,
    interactionId: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('user_interactions')
        .delete()
        .eq('id', interactionId)
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        message: '删除成功'
      };
    } catch (error) {
      console.error('Delete interaction error:', error);
      return {
        success: false,
        error: '删除失败'
      };
    }
  }
}
