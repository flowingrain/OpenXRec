/**
 * PPO 持久化存储服务
 * 
 * 功能：
 * 1. 超参数版本管理 - 存储、回滚、激活
 * 2. 训练历史记录 - 持久化每次训练的指标
 * 3. 知识库管理 - 存储学习到的超参数知识
 * 4. 调整规则管理 - 存储和执行调整规则
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type {
  PPOHyperparamVersionRecord,
  PPOTrainingHistoryRecord,
  PPOHyperparamKnowledgeRecord,
  PPOAdjustmentRuleRecord,
} from './types';
import type { CurrentHyperparams, AdaptationHistory } from '../ppo/adaptive-hyperparams';
import type { TrainingStats } from '../ppo/types';

// ============================================================================
// PPO 持久化存储服务
// ============================================================================

/**
 * PPO 持久化存储服务
 */
export class PPOPersistenceService {
  private supabase: ReturnType<typeof getSupabaseClient>;
  private initialized: boolean = false;
  private memoryFallback: {
    versions: PPOHyperparamVersionRecord[];
    trainingHistory: PPOTrainingHistoryRecord[];
    knowledge: PPOHyperparamKnowledgeRecord[];
    rules: PPOAdjustmentRuleRecord[];
  };

  constructor() {
    this.supabase = getSupabaseClient();
    this.memoryFallback = {
      versions: [],
      trainingHistory: [],
      knowledge: [],
      rules: [],
    };
  }

  private getDb() {
    return this.supabase;
  }

  // ===========================================================================
  // 初始化
  // ===========================================================================

  /**
   * 初始化存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[PPOPersistence] Initializing...');

    // 检查表是否存在
    const tablesExist = await this.checkTablesExist();
    
    if (!tablesExist) {
      console.warn('[PPOPersistence] Tables do not exist, using memory fallback');
    }

    this.initialized = true;
    console.log('[PPOPersistence] Initialized successfully');
  }

  /**
   * 检查表是否存在
   */
  private async checkTablesExist(): Promise<boolean> {
    try {
      if (!this.supabase) return false;
      const { error } = await this.supabase
        .from('ppo_hyperparam_versions')
        .select('id')
        .limit(1);

      return !error || error.code !== '42P01';
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // 超参数版本管理
  // ===========================================================================

  /**
   * 保存超参数版本
   */
  async saveVersion(options: {
    config: CurrentHyperparams;
    performance?: PPOHyperparamVersionRecord['performance'];
    source?: 'auto' | 'manual' | 'rollback';
    parentVersion?: number;
    tags?: string[];
    notes?: string;
    createdBy?: string;
  }): Promise<PPOHyperparamVersionRecord | null> {
    const versionRecord: Omit<PPOHyperparamVersionRecord, 'id' | 'created_at'> = {
      version: await this.getNextVersionNumber(),
      config: options.config,
      performance: options.performance,
      is_active: false,
      is_verified: false,
      source: options.source || 'auto',
      parent_version: options.parentVersion,
      tags: options.tags || [],
      notes: options.notes,
      created_by: options.createdBy || 'system',
    };

    try {
      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('ppo_hyperparam_versions')
          .insert(versionRecord)
          .select()
          .single();

        if (!error) {
          return data as PPOHyperparamVersionRecord;
        }
        console.error('[PPOPersistence] Failed to save version:', error);
      }
      // 使用内存后备
      const record = {
        ...versionRecord,
        id: `mem_${Date.now()}`,
        created_at: new Date().toISOString(),
      } as PPOHyperparamVersionRecord;
      this.memoryFallback.versions.push(record);
      return record;
    } catch (e) {
      console.error('[PPOPersistence] Exception saving version:', e);
      // 使用内存后备
      const record = {
        ...versionRecord,
        id: `mem_${Date.now()}`,
        created_at: new Date().toISOString(),
      } as PPOHyperparamVersionRecord;
      this.memoryFallback.versions.push(record);
      return record;
    }
  }

  /**
   * 获取下一个版本号
   */
  private async getNextVersionNumber(): Promise<number> {
    try {
      if (!this.supabase) {
        if (this.memoryFallback.versions.length === 0) {
          return 1;
        }
        const maxVersion = Math.max(
          ...this.memoryFallback.versions.map(v => v.version)
        );
        return maxVersion + 1;
      }
      const { data, error } = await this.supabase
        .from('ppo_hyperparam_versions')
        .select('version')
        .order('version', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return 1;
      }

      return (data[0] as { version: number }).version + 1;
    } catch {
      // 从内存后备获取
      if (this.memoryFallback.versions.length === 0) {
        return 1;
      }
      const maxVersion = Math.max(
        ...this.memoryFallback.versions.map(v => v.version)
      );
      return maxVersion + 1;
    }
  }

  /**
   * 获取版本列表
   */
  async getVersions(options: {
    limit?: number;
    includeInactive?: boolean;
    tags?: string[];
  } = {}): Promise<PPOHyperparamVersionRecord[]> {
    try {
      if (!this.supabase) {
        return this.memoryFallback.versions.slice(0, options.limit || 20);
      }
      let query = this.supabase
        .from('ppo_hyperparam_versions')
        .select('*')
        .order('version', { ascending: false })
        .limit(options.limit || 20);

      if (!options.includeInactive) {
        query = query.eq('is_active', true);
      }

      if (options.tags && options.tags.length > 0) {
        query = query.contains('tags', options.tags);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PPOPersistence] Failed to get versions:', error);
        return this.memoryFallback.versions.slice(0, options.limit || 20);
      }

      return data as PPOHyperparamVersionRecord[];
    } catch {
      return this.memoryFallback.versions.slice(0, options.limit || 20);
    }
  }

  /**
   * 获取当前激活版本
   */
  async getActiveVersion(): Promise<PPOHyperparamVersionRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('ppo_hyperparam_versions')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error) {
        // 从内存后备查找
        return this.memoryFallback.versions.find(v => v.is_active) || null;
      }

      return data as PPOHyperparamVersionRecord;
    } catch {
      return this.memoryFallback.versions.find(v => v.is_active) || null;
    }
  }

  /**
   * 激活版本
   */
  async activateVersion(versionId: string): Promise<boolean> {
    try {
      // 先取消所有激活状态
      await this.supabase
        .from('ppo_hyperparam_versions')
        .update({ is_active: false })
        .eq('is_active', true);

      // 激活指定版本
      const { error } = await this.supabase
        .from('ppo_hyperparam_versions')
        .update({ is_active: true })
        .eq('id', versionId);

      if (error) {
        console.error('[PPOPersistence] Failed to activate version:', error);
        // 内存后备
        this.memoryFallback.versions.forEach(v => {
          v.is_active = v.id === versionId;
        });
        return this.memoryFallback.versions.some(v => v.id === versionId);
      }

      return true;
    } catch (e) {
      console.error('[PPOPersistence] Exception activating version:', e);
      return false;
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(versionId: string): Promise<PPOHyperparamVersionRecord | null> {
    try {
      // 获取目标版本
      const { data: targetVersion, error: fetchError } = await this.supabase
        .from('ppo_hyperparam_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (fetchError || !targetVersion) {
        console.error('[PPOPersistence] Target version not found:', versionId);
        return null;
      }

      const target = targetVersion as PPOHyperparamVersionRecord;

      // 创建新版本作为回滚记录
      const rollbackVersion = await this.saveVersion({
        config: {
          ...target.config,
          timestamp: Date.now(),
        },
        performance: target.performance,
        source: 'rollback',
        parentVersion: target.version,
        tags: [...target.tags, 'rollback'],
        notes: `Rollback to version ${target.version}`,
        createdBy: 'system',
      });

      if (rollbackVersion) {
        // 激活回滚版本
        await this.activateVersion(rollbackVersion.id);
      }

      return rollbackVersion;
    } catch (e) {
      console.error('[PPOPersistence] Exception rolling back:', e);
      return null;
    }
  }

  /**
   * 验证版本（专家审核）
   */
  async verifyVersion(versionId: string, approved: boolean | string = true, notes?: string): Promise<boolean> {
    try {
      // 兼容旧参数格式：verifyVersion(versionId, notes)
      const isApproved = typeof approved === 'boolean' ? approved : true;
      const notesText = typeof approved === 'string' ? approved : notes;
      
      const { error } = await this.supabase
        .from('ppo_hyperparam_versions')
        .update({ 
          is_verified: isApproved,
          notes: notesText || undefined,
        })
        .eq('id', versionId);

      if (error) {
        console.error('[PPOPersistence] Failed to verify version:', error);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // 训练历史管理
  // ===========================================================================

  /**
   * 保存训练历史
   */
  async saveTrainingHistory(options: {
    sessionId: string;
    epoch: number;
    hyperparams: CurrentHyperparams;
    metrics: TrainingStats & { avgReward: number };
    adaptation?: AdaptationHistory;
  }): Promise<PPOTrainingHistoryRecord | null> {
    const record: Omit<PPOTrainingHistoryRecord, 'id' | 'created_at'> = {
      session_id: options.sessionId,
      epoch: options.epoch,
      hyperparams: options.hyperparams,
      metrics: {
        policyLoss: options.metrics.policyLoss,
        valueLoss: options.metrics.valueLoss,
        entropy: options.metrics.entropy,
        klDivergence: options.metrics.klDivergence,
        clipFraction: options.metrics.clipFraction,
        avgReward: options.metrics.avgReward,
        explainedVariance: options.metrics.explainedVariance,
      },
      adaptation: options.adaptation ? {
        adapted: true,
        reason: options.adaptation.reason,
        recommendations: [],  // 从 AdaptationHistory 提取
      } : undefined,
    };

    try {
      const { data, error } = await this.supabase
        .from('ppo_training_history')
        .insert(record)
        .select()
        .single();

      if (error) {
        console.error('[PPOPersistence] Failed to save training history:', error);
        // 内存后备
        const memRecord = {
          ...record,
          id: `mem_${Date.now()}`,
          created_at: new Date().toISOString(),
        } as PPOTrainingHistoryRecord;
        this.memoryFallback.trainingHistory.push(memRecord);
        return memRecord;
      }

      return data as PPOTrainingHistoryRecord;
    } catch (e) {
      console.error('[PPOPersistence] Exception saving training history:', e);
      const memRecord = {
        ...record,
        id: `mem_${Date.now()}`,
        created_at: new Date().toISOString(),
      } as PPOTrainingHistoryRecord;
      this.memoryFallback.trainingHistory.push(memRecord);
      return memRecord;
    }
  }

  /**
   * 获取训练历史
   */
  async getTrainingHistory(options: {
    sessionId?: string;
    limit?: number;
    startTime?: Date;
    endTime?: Date;
  } = {}): Promise<PPOTrainingHistoryRecord[]> {
    try {
      let query = this.supabase
        .from('ppo_training_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options.limit || 100);

      if (options.sessionId) {
        query = query.eq('session_id', options.sessionId);
      }
      if (options.startTime) {
        query = query.gte('created_at', options.startTime.toISOString());
      }
      if (options.endTime) {
        query = query.lte('created_at', options.endTime.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PPOPersistence] Failed to get training history:', error);
        return this.memoryFallback.trainingHistory.slice(0, options.limit || 100);
      }

      return data as PPOTrainingHistoryRecord[];
    } catch {
      return this.memoryFallback.trainingHistory.slice(0, options.limit || 100);
    }
  }

  /**
   * 获取最近N次训练的统计
   */
  async getRecentStats(limit: number = 10): Promise<{
    avgReward: number;
    avgLoss: number;
    avgKl: number;
    trend: 'improving' | 'stable' | 'degrading';
  }> {
    const history = await this.getTrainingHistory({ limit });
    
    if (history.length === 0) {
      return {
        avgReward: 0,
        avgLoss: 0,
        avgKl: 0,
        trend: 'stable',
      };
    }

    const avgReward = history.reduce((s, h) => s + h.metrics.avgReward, 0) / history.length;
    const avgLoss = history.reduce((s, h) => s + h.metrics.policyLoss, 0) / history.length;
    const avgKl = history.reduce((s, h) => s + h.metrics.klDivergence, 0) / history.length;

    // 计算趋势
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (history.length >= 5) {
      const firstHalf = history.slice(Math.floor(history.length / 2));
      const secondHalf = history.slice(0, Math.floor(history.length / 2));
      
      const firstAvg = firstHalf.reduce((s, h) => s + h.metrics.avgReward, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, h) => s + h.metrics.avgReward, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.05) {
        trend = 'improving';
      } else if (secondAvg < firstAvg * 0.95) {
        trend = 'degrading';
      }
    }

    return { avgReward, avgLoss, avgKl, trend };
  }

  // ===========================================================================
  // 知识库管理
  // ===========================================================================

  /**
   * 保存知识
   */
  async saveKnowledge(options: {
    knowledgeType: PPOHyperparamKnowledgeRecord['knowledge_type'];
    paramName: string;
    knowledge: PPOHyperparamKnowledgeRecord['knowledge'];
    confidence: number;
    source: 'learned' | 'expert' | 'literature';
  }): Promise<PPOHyperparamKnowledgeRecord | null> {
    try {
      // 检查是否已存在相同类型的知识
      const { data: existing } = await this.supabase
        .from('ppo_hyperparam_knowledge')
        .select('*')
        .eq('knowledge_type', options.knowledgeType)
        .eq('param_name', options.paramName)
        .single();

      if (existing) {
        // 更新现有知识
        const existingRecord = existing as PPOHyperparamKnowledgeRecord;
        const { error } = await this.supabase
          .from('ppo_hyperparam_knowledge')
          .update({
            knowledge: options.knowledge,
            confidence: (existingRecord.confidence + options.confidence) / 2,
            sample_count: existingRecord.sample_count + 1,
            last_updated: new Date().toISOString(),
          })
          .eq('id', existingRecord.id);

        if (error) {
          console.error('[PPOPersistence] Failed to update knowledge:', error);
          return null;
        }

        return { ...existingRecord, ...options } as PPOHyperparamKnowledgeRecord;
      }

      // 创建新知识
      const { data, error } = await this.supabase
        .from('ppo_hyperparam_knowledge')
        .insert({
          knowledge_type: options.knowledgeType,
          param_name: options.paramName,
          knowledge: options.knowledge,
          confidence: options.confidence,
          sample_count: 1,
          success_count: 0,
          source: options.source,
        })
        .select()
        .single();

      if (error) {
        console.error('[PPOPersistence] Failed to save knowledge:', error);
        return null;
      }

      return data as PPOHyperparamKnowledgeRecord;
    } catch (e) {
      console.error('[PPOPersistence] Exception saving knowledge:', e);
      return null;
    }
  }

  /**
   * 获取参数相关知识
   */
  async getKnowledgeForParam(paramName: string): Promise<PPOHyperparamKnowledgeRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('ppo_hyperparam_knowledge')
        .select('*')
        .eq('param_name', paramName)
        .order('confidence', { ascending: false });

      if (error) {
        return [];
      }

      return data as PPOHyperparamKnowledgeRecord[];
    } catch {
      return [];
    }
  }

  /**
   * 获取所有知识（支持分页）
   */
  async getKnowledge(options?: { limit?: number; offset?: number }): Promise<PPOHyperparamKnowledgeRecord[]> {
    try {
      let query = this.supabase
        .from('ppo_hyperparam_knowledge')
        .select('*')
        .order('confidence', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        return this.memoryFallback.knowledge;
      }

      return data as PPOHyperparamKnowledgeRecord[];
    } catch {
      return this.memoryFallback.knowledge;
    }
  }

  // ===========================================================================
  // 清理和维护
  // ===========================================================================

  /**
   * 清理旧数据
   */
  async cleanup(olderThanDays: number = 30): Promise<{
    versionsDeleted: number;
    historyDeleted: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let versionsDeleted = 0;
    let historyDeleted = 0;

    try {
      // 清理非激活的旧版本
      const { data: deletedVersions } = await this.supabase
        .from('ppo_hyperparam_versions')
        .delete()
        .eq('is_active', false)
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      versionsDeleted = deletedVersions?.length || 0;

      // 清理旧训练历史
      const { data: deletedHistory } = await this.supabase
        .from('ppo_training_history')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      historyDeleted = deletedHistory?.length || 0;

      console.log(`[PPOPersistence] Cleaned up ${versionsDeleted} versions, ${historyDeleted} history records`);
    } catch (e) {
      console.error('[PPOPersistence] Cleanup failed:', e);
    }

    return { versionsDeleted, historyDeleted };
  }

  /**
   * 导出状态
   */
  async exportState(): Promise<{
    versions: PPOHyperparamVersionRecord[];
    recentHistory: PPOTrainingHistoryRecord[];
    knowledge: PPOHyperparamKnowledgeRecord[];
  }> {
    const versions = await this.getVersions({ limit: 50, includeInactive: true });
    const recentHistory = await this.getTrainingHistory({ limit: 100 });
    
    try {
      const { data: knowledge } = await this.supabase
        .from('ppo_hyperparam_knowledge')
        .select('*')
        .order('confidence', { ascending: false });

      return {
        versions,
        recentHistory,
        knowledge: (knowledge as PPOHyperparamKnowledgeRecord[]) || [],
      };
    } catch {
      return {
        versions,
        recentHistory,
        knowledge: this.memoryFallback.knowledge,
      };
    }
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let ppoPersistenceInstance: PPOPersistenceService | null = null;

/**
 * 获取 PPO 持久化服务实例
 */
export function getPPOPersistence(): PPOPersistenceService {
  if (!ppoPersistenceInstance) {
    ppoPersistenceInstance = new PPOPersistenceService();
  }
  return ppoPersistenceInstance;
}
