/**
 * 知识清理服务
 * 
 * 功能：
 * 1. 自动清理过期的关系（valid_to 已过）
 * 2. 清理过期的专家确认请求
 * 3. 清理未验证的低置信度实体（可选）
 * 4. 统计知识库健康状态
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== 类型定义 ====================

export interface CleanupResult {
  expiredRelations: number;
  expiredConfirmations: number;
  unverifiedEntities: number;
  totalCleaned: number;
  errors: string[];
}

export interface KnowledgeHealthStatus {
  totalEntities: number;
  totalRelations: number;
  verifiedEntities: number;
  verifiedRelations: number;
  expiredRelations: number;
  pendingConflicts: number;
  healthScore: number; // 0-100
  lastCleanupAt: string | null;
}

export interface CleanupConfig {
  cleanExpiredRelations: boolean;
  cleanExpiredConfirmations: boolean;
  cleanUnverifiedEntities: boolean;
  unverifiedEntityDays: number; // 未验证实体保留天数
  confirmationExpiryDays: number; // 专家确认过期天数
  dryRun: boolean; // 仅预览，不执行
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: CleanupConfig = {
  cleanExpiredRelations: true,
  cleanExpiredConfirmations: true,
  cleanUnverifiedEntities: false, // 默认不清理未验证实体
  unverifiedEntityDays: 90,
  confirmationExpiryDays: 7,
  dryRun: false,
};

// ==================== 知识清理服务 ====================

export class KnowledgeCleanupService {
  private config: CleanupConfig;

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getSupabase() {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }

  /**
   * 执行清理任务
   */
  async cleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      expiredRelations: 0,
      expiredConfirmations: 0,
      unverifiedEntities: 0,
      totalCleaned: 0,
      errors: [],
    };

    const supabase = this.getSupabase();
    if (!supabase) {
      result.errors.push('数据库连接失败');
      return result;
    }

    console.log('[KnowledgeCleanup] 开始清理任务, dryRun:', this.config.dryRun);

    // 1. 清理过期关系
    if (this.config.cleanExpiredRelations) {
      const expiredRelations = await this.cleanExpiredRelations(supabase);
      result.expiredRelations = expiredRelations;
      result.totalCleaned += expiredRelations;
    }

    // 2. 清理过期确认请求
    if (this.config.cleanExpiredConfirmations) {
      const expiredConfirmations = await this.cleanExpiredConfirmations(supabase);
      result.expiredConfirmations = expiredConfirmations;
      result.totalCleaned += expiredConfirmations;
    }

    // 3. 清理未验证实体（可选）
    if (this.config.cleanUnverifiedEntities) {
      const unverifiedEntities = await this.cleanUnverifiedEntities(supabase);
      result.unverifiedEntities = unverifiedEntities;
      result.totalCleaned += unverifiedEntities;
    }

    // 4. 记录清理日志
    await this.logCleanup(supabase, result);

    console.log('[KnowledgeCleanup] 清理完成:', result);
    return result;
  }

  /**
   * 清理过期关系（valid_to < 今天）
   */
  private async cleanExpiredRelations(supabase: any): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 查询过期关系
      const { data: expiredRelations, error: queryError } = await supabase
        .from('kg_relations')
        .select('id, source_entity_id, target_entity_id, type, valid_to')
        .not('valid_to', 'is', null)
        .lt('valid_to', today);

      if (queryError) {
        console.error('[KnowledgeCleanup] 查询过期关系失败:', queryError);
        return 0;
      }

      if (!expiredRelations || expiredRelations.length === 0) {
        console.log('[KnowledgeCleanup] 没有过期关系需要清理');
        return 0;
      }

      console.log(`[KnowledgeCleanup] 发现 ${expiredRelations.length} 条过期关系`);

      if (this.config.dryRun) {
        console.log('[KnowledgeCleanup] [DRY RUN] 将删除以下关系:', expiredRelations.map((r: any) => r.id));
        return expiredRelations.length;
      }

      // 物理删除过期关系
      const { error: deleteError } = await supabase
        .from('kg_relations')
        .delete()
        .in('id', expiredRelations.map((r: any) => r.id));

      if (deleteError) {
        console.error('[KnowledgeCleanup] 删除过期关系失败:', deleteError);
        return 0;
      }

      console.log(`[KnowledgeCleanup] 已删除 ${expiredRelations.length} 条过期关系`);
      return expiredRelations.length;
    } catch (error) {
      console.error('[KnowledgeCleanup] cleanExpiredRelations 异常:', error);
      return 0;
    }
  }

  /**
   * 清理过期的专家确认请求
   */
  private async cleanExpiredConfirmations(supabase: any): Promise<number> {
    try {
      const now = new Date().toISOString();

      // 查询过期且未处理的确认请求
      const { data: expiredConfirmations, error: queryError } = await supabase
        .from('knowledge_patterns')
        .select('id, created_at')
        .eq('pattern_type', 'knowledge_conflict')
        .eq('is_verified', false)
        .lt('pattern_data->expiresAt', now);

      if (queryError) {
        console.error('[KnowledgeCleanup] 查询过期确认请求失败:', queryError);
        return 0;
      }

      if (!expiredConfirmations || expiredConfirmations.length === 0) {
        console.log('[KnowledgeCleanup] 没有过期确认请求需要清理');
        return 0;
      }

      console.log(`[KnowledgeCleanup] 发现 ${expiredConfirmations.length} 条过期确认请求`);

      if (this.config.dryRun) {
        console.log('[KnowledgeCleanup] [DRY RUN] 将标记以下请求为过期:', expiredConfirmations.map((r: any) => r.id));
        return expiredConfirmations.length;
      }

      // 更新状态为 expired
      const { error: updateError } = await supabase
        .from('knowledge_patterns')
        .update({
          is_verified: true,
          pattern_data: supabase.rpc('jsonb_set', {
            path: '{status}',
            value: '"expired"',
          }),
        })
        .in('id', expiredConfirmations.map((r: any) => r.id));

      if (updateError) {
        console.error('[KnowledgeCleanup] 更新过期确认请求失败:', updateError);
        return 0;
      }

      console.log(`[KnowledgeCleanup] 已标记 ${expiredConfirmations.length} 条确认请求为过期`);
      return expiredConfirmations.length;
    } catch (error) {
      console.error('[KnowledgeCleanup] cleanExpiredConfirmations 异常:', error);
      return 0;
    }
  }

  /**
   * 清理长时间未验证的低置信度实体（可选）
   */
  private async cleanUnverifiedEntities(supabase: any): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.unverifiedEntityDays);
      const cutoffStr = cutoffDate.toISOString();

      // 查询未验证且低置信度的实体
      const { data: unverifiedEntities, error: queryError } = await supabase
        .from('kg_entities')
        .select('id, name, importance, created_at')
        .eq('verified', false)
        .lt('importance', 0.5)
        .lt('created_at', cutoffStr);

      if (queryError) {
        console.error('[KnowledgeCleanup] 查询未验证实体失败:', queryError);
        return 0;
      }

      if (!unverifiedEntities || unverifiedEntities.length === 0) {
        console.log('[KnowledgeCleanup] 没有未验证实体需要清理');
        return 0;
      }

      console.log(`[KnowledgeCleanup] 发现 ${unverifiedEntities.length} 个未验证低置信度实体`);

      if (this.config.dryRun) {
        console.log('[KnowledgeCleanup] [DRY RUN] 将删除以下实体:', unverifiedEntities.map((e: any) => e.name));
        return unverifiedEntities.length;
      }

      // 删除实体（级联删除相关关系）
      const { error: deleteError } = await supabase
        .from('kg_entities')
        .delete()
        .in('id', unverifiedEntities.map((e: any) => e.id));

      if (deleteError) {
        console.error('[KnowledgeCleanup] 删除未验证实体失败:', deleteError);
        return 0;
      }

      console.log(`[KnowledgeCleanup] 已删除 ${unverifiedEntities.length} 个未验证实体`);
      return unverifiedEntities.length;
    } catch (error) {
      console.error('[KnowledgeCleanup] cleanUnverifiedEntities 异常:', error);
      return 0;
    }
  }

  /**
   * 记录清理日志
   */
  private async logCleanup(supabase: any, result: CleanupResult): Promise<void> {
    try {
      await supabase.from('system_logs').insert({
        type: 'knowledge_cleanup',
        data: {
          ...result,
          config: this.config,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // 日志记录失败不影响主流程
      console.warn('[KnowledgeCleanup] 记录清理日志失败:', error);
    }
  }

  /**
   * 获取知识库健康状态
   */
  async getHealthStatus(): Promise<KnowledgeHealthStatus> {
    const supabase = this.getSupabase();
    const defaultStatus: KnowledgeHealthStatus = {
      totalEntities: 0,
      totalRelations: 0,
      verifiedEntities: 0,
      verifiedRelations: 0,
      expiredRelations: 0,
      pendingConflicts: 0,
      healthScore: 0,
      lastCleanupAt: null,
    };

    if (!supabase) return defaultStatus;

    try {
      const today = new Date().toISOString().split('T')[0];

      // 并行查询各项统计
      const [
        entitiesCount,
        relationsCount,
        verifiedEntitiesCount,
        verifiedRelationsCount,
        expiredRelationsCount,
        pendingConflictsCount,
        lastCleanup,
      ] = await Promise.all([
        supabase.from('kg_entities').select('id', { count: 'exact', head: true }),
        supabase.from('kg_relations').select('id', { count: 'exact', head: true }),
        supabase.from('kg_entities').select('id', { count: 'exact', head: true }).eq('verified', true),
        supabase.from('kg_relations').select('id', { count: 'exact', head: true }).eq('verified', true),
        supabase.from('kg_relations').select('id', { count: 'exact', head: true }).not('valid_to', 'is', null).lt('valid_to', today),
        supabase.from('knowledge_patterns').select('id', { count: 'exact', head: true }).eq('pattern_type', 'knowledge_conflict').eq('is_verified', false),
        supabase.from('system_logs').select('created_at').eq('type', 'knowledge_cleanup').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const status: KnowledgeHealthStatus = {
        totalEntities: entitiesCount.count || 0,
        totalRelations: relationsCount.count || 0,
        verifiedEntities: verifiedEntitiesCount.count || 0,
        verifiedRelations: verifiedRelationsCount.count || 0,
        expiredRelations: expiredRelationsCount.count || 0,
        pendingConflicts: pendingConflictsCount.count || 0,
        healthScore: 0,
        lastCleanupAt: lastCleanup.data?.created_at || null,
      };

      // 计算健康分数（0-100）
      const verificationRate = status.totalEntities > 0 
        ? (status.verifiedEntities / status.totalEntities) * 0.4 
        : 0;
      const relationHealth = status.totalRelations > 0 
        ? ((status.totalRelations - status.expiredRelations) / status.totalRelations) * 0.3 
        : 0.3;
      const conflictPenalty = Math.min(status.pendingConflicts * 5, 30);
      
      status.healthScore = Math.round((verificationRate + relationHealth + 0.3) * 100 - conflictPenalty);
      status.healthScore = Math.max(0, Math.min(100, status.healthScore));

      return status;
    } catch (error) {
      console.error('[KnowledgeCleanup] getHealthStatus 异常:', error);
      return defaultStatus;
    }
  }
}

// ==================== 导出单例 ====================

export const knowledgeCleanupService = new KnowledgeCleanupService();
