/**
 * 数据库层实现（元数据与事务层）
 * 
 * 职责：
 * - 用户数据：用户画像、偏好设置
 * - 关系数据：实体关系、社交图谱
 * - 事务数据：反馈、评分、交互记录
 * - 配置数据：系统配置、策略配置
 * - 日志审计：操作日志、变更历史
 * 
 * 特点：强一致性、ACID事务、复杂JOIN查询
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  IDatabaseLayer,
  StorageResult,
  UserProfile,
  SystemConfig,
  InteractionLog,
  UserFeedback,
  QueryOptions,
} from '../types';

/**
 * 数据库层实现类
 */
export class DatabaseLayer implements IDatabaseLayer {
  private client: SupabaseClient;
  private initialized: boolean = false;

  constructor() {
    this.client = getSupabaseClient();
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 检查连接
    const { error } = await this.client.from('health_check').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('[DatabaseLayer] Connection check failed:', error);
    }

    this.initialized = true;
    console.log('[DatabaseLayer] Initialized');
  }

  // ============================================================================
  // 用户管理
  // ============================================================================

  /**
   * 获取用户画像
   */
  async getUserProfile(userId: string): Promise<StorageResult<UserProfile>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 用户不存在，返回默认画像
          return {
            success: true,
            data: this.createDefaultProfile(userId),
            duration: Date.now() - startTime,
          };
        }
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToUserProfile(data),
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 更新用户画像
   */
  async updateUserProfile(
    userId: string,
    profile: Partial<UserProfile>
  ): Promise<StorageResult<UserProfile>> {
    const startTime = Date.now();

    try {
      const updateData: Record<string, any> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
      };

      if (profile.preferences) {
        updateData.preferences = profile.preferences;
      }
      if (profile.interests) {
        updateData.preferences = {
          ...(await this.getUserProfile(userId)).data?.preferences,
          interests: profile.interests,
        };
      }

      const { data, error } = await this.client
        .from('user_preferences')
        .upsert(updateData, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToUserProfile(data),
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 创建默认用户画像
   */
  private createDefaultProfile(userId: string): UserProfile {
    return {
      id: userId,
      userId,
      preferences: {
        domains: [],
        explanationDetail: 'normal',
        responseStyle: 'formal',
      },
      behavior: {
        queryCount: 0,
        feedbackCount: 0,
        avgRating: 0,
        lastActiveAt: Date.now(),
      },
      interests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 映射数据库记录到用户画像
   */
  private mapToUserProfile(data: any): UserProfile {
    const preferences = data.preferences || {};
    return {
      id: data.id,
      userId: data.user_id,
      preferences: {
        domains: preferences.domains || [],
        explanationDetail: preferences.explanationDetail || 'normal',
        responseStyle: preferences.responseStyle || 'formal',
      },
      behavior: {
        queryCount: preferences.queryCount || 0,
        feedbackCount: preferences.feedbackCount || 0,
        avgRating: preferences.avgRating || 0,
        lastActiveAt: preferences.lastActiveAt || Date.now(),
      },
      interests: preferences.interests || [],
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  /**
   * 获取配置
   */
  async getConfig(key: string): Promise<StorageResult<SystemConfig>> {
    const startTime = Date.now();

    try {
      // 使用内存缓存或默认配置
      const defaultConfigs: Record<string, SystemConfig> = {
        'recommendation.strategy_weights': {
          id: 'default_strategy_weights',
          key: 'recommendation.strategy_weights',
          value: {
            content_based: 0.3,
            collaborative: 0.3,
            knowledge_based: 0.2,
            agent_based: 0.1,
            causal_based: 0.1,
          },
          category: 'recommendation',
          description: '推荐策略权重配置',
          updatedAt: Date.now(),
          updatedBy: 'system',
        },
        'recommendation.diversity': {
          id: 'default_diversity',
          key: 'recommendation.diversity',
          value: {
            enabled: true,
            threshold: 0.7,
          },
          category: 'recommendation',
          description: '多样性优化配置',
          updatedAt: Date.now(),
          updatedBy: 'system',
        },
      };

      if (defaultConfigs[key]) {
        return {
          success: true,
          data: defaultConfigs[key],
          duration: Date.now() - startTime,
        };
      }

      // 尝试从数据库获取
      const { data, error } = await this.client
        .from('system_configs')
        .select('*')
        .eq('key', key)
        .single();

      if (error) {
        return { success: false, error: `Config not found: ${key}` };
      }

      return {
        success: true,
        data: {
          id: data.id,
          key: data.key,
          value: data.value,
          category: data.category,
          description: data.description,
          updatedAt: new Date(data.updated_at).getTime(),
          updatedBy: data.updated_by,
        },
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 设置配置
   */
  async setConfig(
    key: string,
    value: any,
    updatedBy: string
  ): Promise<StorageResult<SystemConfig>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('system_configs')
        .upsert(
          {
            key,
            value,
            updated_at: new Date().toISOString(),
            updated_by: updatedBy,
          },
          { onConflict: 'key' }
        )
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          id: data.id,
          key: data.key,
          value: data.value,
          category: data.category,
          description: data.description,
          updatedAt: new Date(data.updated_at).getTime(),
          updatedBy: data.updated_by,
        },
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ============================================================================
  // 日志管理
  // ============================================================================

  /**
   * 记录交互日志
   */
  async logInteraction(
    log: Omit<InteractionLog, 'id' | 'createdAt'>
  ): Promise<StorageResult<InteractionLog>> {
    const startTime = Date.now();

    try {
      const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const record = {
        id,
        user_id: log.userId,
        session_id: log.sessionId,
        type: log.type,
        data: log.data,
        metadata: log.metadata,
        created_at: new Date().toISOString(),
      };

      const { error } = await this.client.from('interaction_logs').insert(record);

      if (error) {
        console.error('[DatabaseLayer] Failed to log interaction:', error);
        // 日志失败不影响主流程
        return { success: true, data: { id, userId: log.userId, sessionId: log.sessionId, type: log.type, data: log.data, metadata: log.metadata, createdAt: Date.now() } };
      }

      return {
        success: true,
        data: {
          id,
          userId: log.userId,
          sessionId: log.sessionId,
          type: log.type,
          data: log.data,
          metadata: log.metadata,
          createdAt: Date.now(),
        },
        duration: Date.now() - startTime,
      };
    } catch (err) {
      console.error('[DatabaseLayer] Log interaction error:', err);
      return { success: true }; // 日志失败不影响主流程
    }
  }

  /**
   * 获取交互日志
   */
  async getInteractionLogs(
    filters: Record<string, any>,
    options?: QueryOptions
  ): Promise<StorageResult<InteractionLog[]>> {
    const startTime = Date.now();

    try {
      let query = this.client.from('interaction_logs').select('*');

      // 应用过滤器
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.sessionId) {
        query = query.eq('session_id', filters.sessionId);
      }
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.startTime) {
        query = query.gte('created_at', new Date(filters.startTime).toISOString());
      }
      if (filters.endTime) {
        query = query.lte('created_at', new Date(filters.endTime).toISOString());
      }

      // 应用排序和分页
      query = query.order('created_at', { ascending: false });
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map((item) => ({
          id: item.id,
          userId: item.user_id,
          sessionId: item.session_id,
          type: item.type,
          data: item.data,
          metadata: item.metadata,
          createdAt: new Date(item.created_at).getTime(),
        })),
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ============================================================================
  // 反馈管理
  // ============================================================================

  /**
   * 保存反馈
   */
  async saveFeedback(
    feedback: Omit<UserFeedback, 'id' | 'createdAt'>
  ): Promise<StorageResult<UserFeedback>> {
    const startTime = Date.now();

    try {
      const id = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const record = {
        id,
        user_id: feedback.userId,
        target_id: feedback.targetId,
        target_type: feedback.targetType,
        type: feedback.type,
        value: feedback.value,
        metadata: feedback.metadata,
        created_at: new Date().toISOString(),
      };

      const { error } = await this.client.from('user_feedbacks').insert(record);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          id,
          userId: feedback.userId,
          targetId: feedback.targetId,
          targetType: feedback.targetType,
          type: feedback.type,
          value: feedback.value,
          metadata: feedback.metadata,
          createdAt: Date.now(),
        },
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 获取反馈
   */
  async getFeedback(targetId: string): Promise<StorageResult<UserFeedback[]>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('user_feedbacks')
        .select('*')
        .eq('target_id', targetId)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map((item) => ({
          id: item.id,
          userId: item.user_id,
          targetId: item.target_id,
          targetType: item.target_type,
          type: item.type,
          value: item.value,
          metadata: item.metadata,
          createdAt: new Date(item.created_at).getTime(),
        })),
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// 导出单例
let databaseLayerInstance: DatabaseLayer | null = null;

export function getDatabaseLayer(): DatabaseLayer {
  if (!databaseLayerInstance) {
    databaseLayerInstance = new DatabaseLayer();
  }
  return databaseLayerInstance;
}
