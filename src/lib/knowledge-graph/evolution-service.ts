/**
 * 知识演化服务
 * 实现：
 * 1. 自动过期机制（根据置信度/来源类型设置有效期）
 * 2. 关系演化逻辑（新关系自动标记旧关系失效）
 * 3. 演化历史追踪
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// 过期策略配置
const EXPIRATION_POLICY = {
  // 根据来源类型的基础有效期（天）
  sourceType: {
    'manual': 365,      // 手动添加 - 1年
    'document': 180,    // 文档提取 - 半年
    'llm': 90,          // LLM提取 - 3个月
    'system': 365,      // 系统预置 - 1年
  },
  // 根据置信度的有效期调整系数
  confidence: {
    high: 1.5,     // > 0.8 置信度，延长50%
    medium: 1.0,   // 0.5-0.8，标准有效期
    low: 0.5,      // < 0.5 置信度，缩短50%
  },
  // 置信度阈值
  confidenceThresholds: {
    high: 0.8,
    low: 0.5,
  }
};

// 关系演化类型
export type EvolutionType = 
  | 'create'        // 创建新关系
  | 'update'        // 更新关系属性
  | 'replace'       // 替换旧关系
  | 'expire'        // 关系过期
  | 'delete';       // 关系删除

// 演化记录
export interface EvolutionRecord {
  id: string;
  relation_id?: string;
  entity_id?: string;
  evolution_type: EvolutionType;
  old_value?: any;
  new_value?: any;
  reason: string;
  triggered_by: 'auto' | 'manual' | 'system';
  created_at: string;
}

// 获取 Supabase 客户端
function getClient() {
  try {
    return getSupabaseClient();
  } catch {
    return null;
  }
}

/**
 * 知识演化服务类
 */
export class KnowledgeEvolutionService {
  
  /**
   * 计算关系的有效期
   * @param sourceType 来源类型
   * @param confidence 置信度
   * @returns 有效期天数
   */
  calculateExpirationDays(sourceType: string, confidence: number): number {
    // 基础有效期
    const baseDays = EXPIRATION_POLICY.sourceType[sourceType as keyof typeof EXPIRATION_POLICY.sourceType] 
      || EXPIRATION_POLICY.sourceType.llm;
    
    // 根据置信度调整
    let multiplier = 1.0;
    if (confidence >= EXPIRATION_POLICY.confidenceThresholds.high) {
      multiplier = EXPIRATION_POLICY.confidence.high;
    } else if (confidence < EXPIRATION_POLICY.confidenceThresholds.low) {
      multiplier = EXPIRATION_POLICY.confidence.low;
    }
    
    return Math.round(baseDays * multiplier);
  }
  
  /**
   * 为新关系设置有效期
   */
  async setRelationExpiration(
    relationId: string, 
    sourceType: string, 
    confidence: number
  ): Promise<boolean> {
    const client = getClient();
    if (!client) return false;
    
    const days = this.calculateExpirationDays(sourceType, confidence);
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + days);
    
    const { error } = await client
      .from('kg_relations')
      .update({
        valid_from: validFrom.toISOString().split('T')[0],
        valid_to: validTo.toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', relationId);
    
    if (error) {
      console.error('[KnowledgeEvolution] 设置有效期失败:', error);
      return false;
    }
    
    console.log(`[KnowledgeEvolution] 关系 ${relationId} 有效期设置为 ${days} 天`);
    return true;
  }
  
  /**
   * 检查并处理关系演化
   * 当添加新关系时，检查是否存在需要演化的旧关系
   */
  async handleRelationEvolution(params: {
    sourceEntityId: string;
    targetEntityId: string;
    relationType: string;
    newConfidence: number;
    newEvidence?: string;
    sourceType: string;
  }): Promise<{ evolved: boolean; oldRelationId?: string; action?: string }> {
    const client = getClient();
    if (!client) return { evolved: false };
    
    const { sourceEntityId, targetEntityId, relationType, newConfidence, newEvidence, sourceType } = params;
    
    // 1. 查找是否存在相同的有效关系
    const { data: existingRelations } = await client
      .from('kg_relations')
      .select('*')
      .eq('source_entity_id', sourceEntityId)
      .eq('target_entity_id', targetEntityId)
      .eq('type', relationType)
      .is('valid_to', null)  // 尚未过期
      .maybeSingle();
    
    if (!existingRelations) {
      // 没有冲突，无需演化
      return { evolved: false };
    }
    
    // 2. 判断是否需要演化
    const oldConfidence = parseFloat(existingRelations.confidence || '0.5');
    const shouldEvolve = this.shouldEvolveRelation({
      oldConfidence,
      newConfidence,
      oldSourceType: existingRelations.source_type,
      newSourceType: sourceType
    });
    
    if (!shouldEvolve) {
      // 保留旧关系，不创建新关系
      return { evolved: false, action: 'keep_old' };
    }
    
    // 3. 执行演化：标记旧关系过期
    const today = new Date().toISOString().split('T')[0];
    
    const { error: updateError } = await client
      .from('kg_relations')
      .update({
        valid_to: today,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingRelations.id);
    
    if (updateError) {
      console.error('[KnowledgeEvolution] 标记旧关系过期失败:', updateError);
      return { evolved: false };
    }
    
    // 4. 记录演化历史
    await this.recordEvolution({
      relation_id: existingRelations.id,
      evolution_type: 'replace',
      old_value: {
        confidence: oldConfidence,
        source_type: existingRelations.source_type,
        evidence: existingRelations.evidence
      },
      new_value: {
        confidence: newConfidence,
        source_type: sourceType,
        evidence: newEvidence
      },
      reason: `新关系置信度(${newConfidence.toFixed(2)})更高，替换旧关系置信度(${oldConfidence.toFixed(2)})`,
      triggered_by: 'auto'
    });
    
    console.log(`[KnowledgeEvolution] 关系演化完成: ${existingRelations.id} 已过期`);
    
    return { 
      evolved: true, 
      oldRelationId: existingRelations.id,
      action: 'replaced'
    };
  }
  
  /**
   * 判断是否应该演化关系
   */
  private shouldEvolveRelation(params: {
    oldConfidence: number;
    newConfidence: number;
    oldSourceType: string;
    newSourceType: string;
  }): boolean {
    const { oldConfidence, newConfidence, oldSourceType, newSourceType } = params;
    
    // 来源优先级：manual > document > llm
    const sourcePriority = { manual: 3, document: 2, system: 2, llm: 1 };
    const oldPriority = sourcePriority[oldSourceType as keyof typeof sourcePriority] || 1;
    const newPriority = sourcePriority[newSourceType as keyof typeof sourcePriority] || 1;
    
    // 新来源优先级更高，直接演化
    if (newPriority > oldPriority) {
      return true;
    }
    
    // 来源相同或更低，比较置信度
    // 新置信度比旧置信度高 20% 以上才演化
    if (newConfidence > oldConfidence + 0.2) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 记录演化历史
   */
  async recordEvolution(params: {
    relation_id?: string;
    entity_id?: string;
    evolution_type: EvolutionType;
    old_value?: any;
    new_value?: any;
    reason: string;
    triggered_by: 'auto' | 'manual' | 'system';
  }): Promise<boolean> {
    const client = getClient();
    if (!client) return false;
    
    const { error } = await client
      .from('kg_corrections')
      .insert({
        relation_id: params.relation_id || null,
        entity_id: params.entity_id || null,
        change_type: `evolution_${params.evolution_type}`,
        old_value: params.old_value || null,
        new_value: params.new_value || null,
        reason: params.reason,
        corrected_by: params.triggered_by,
        corrected_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('[KnowledgeEvolution] 记录演化历史失败:', error);
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取实体的演化历史
   */
  async getEntityEvolutionHistory(entityId: string): Promise<EvolutionRecord[]> {
    const client = getClient();
    if (!client) return [];
    
    const { data, error } = await client
      .from('kg_corrections')
      .select('*')
      .or(`entity_id.eq.${entityId},relation_id.in.(select id from kg_relations where source_entity_id eq ${entityId} or target_entity_id eq ${entityId})`)
      .like('change_type', 'evolution_%')
      .order('corrected_at', { ascending: false })
      .limit(50);
    
    if (error || !data) {
      return [];
    }
    
    return data.map(record => ({
      id: record.id,
      relation_id: record.relation_id || undefined,
      entity_id: record.entity_id || undefined,
      evolution_type: record.change_type.replace('evolution_', '') as EvolutionType,
      old_value: record.old_value,
      new_value: record.new_value,
      reason: record.reason || '',
      triggered_by: (record.corrected_by as 'auto' | 'manual' | 'system') || 'auto',
      created_at: record.corrected_at
    }));
  }
  
  /**
   * 获取关系的时间线
   */
  async getRelationTimeline(relationId: string): Promise<{
    current: any;
    history: EvolutionRecord[];
  }> {
    const client = getClient();
    if (!client) return { current: null, history: [] };
    
    // 获取当前关系状态
    const { data: relation } = await client
      .from('kg_relations')
      .select('*')
      .eq('id', relationId)
      .single();
    
    // 获取演化历史
    const { data: history } = await client
      .from('kg_corrections')
      .select('*')
      .eq('relation_id', relationId)
      .like('change_type', 'evolution_%')
      .order('corrected_at', { ascending: false });
    
    return {
      current: relation,
      history: (history || []).map(record => ({
        id: record.id,
        relation_id: record.relation_id || undefined,
        entity_id: record.entity_id || undefined,
        evolution_type: record.change_type.replace('evolution_', '') as EvolutionType,
        old_value: record.old_value,
        new_value: record.new_value,
        reason: record.reason || '',
        triggered_by: (record.corrected_by as 'auto' | 'manual' | 'system') || 'auto',
        created_at: record.corrected_at
      }))
    };
  }
  
  /**
   * 批量设置关系有效期（定时任务用）
   */
  async batchSetExpiration(): Promise<{ 
    processed: number; 
    success: number; 
    failed: number;
  }> {
    const client = getClient();
    if (!client) return { processed: 0, success: 0, failed: 0 };
    
    // 查找所有没有设置有效期的关系
    const { data: relations, error } = await client
      .from('kg_relations')
      .select('id, source_type, confidence')
      .is('valid_from', null)
      .limit(100);
    
    if (error || !relations) {
      console.error('[KnowledgeEvolution] 查询关系失败:', error);
      return { processed: 0, success: 0, failed: 0 };
    }
    
    let success = 0;
    let failed = 0;
    
    for (const relation of relations) {
      const confidence = parseFloat(relation.confidence || '0.5');
      const result = await this.setRelationExpiration(
        relation.id,
        relation.source_type || 'llm',
        confidence
      );
      
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
    
    console.log(`[KnowledgeEvolution] 批量设置有效期完成: ${success} 成功, ${failed} 失败`);
    
    return {
      processed: relations.length,
      success,
      failed
    };
  }
  
  /**
   * 清理过期关系（定时任务用）
   */
  async cleanupExpiredRelations(): Promise<{
    processed: number;
    expired: number;
    archived: number;
  }> {
    const client = getClient();
    if (!client) return { processed: 0, expired: 0, archived: 0 };
    
    const today = new Date().toISOString().split('T')[0];
    
    // 查找所有过期但仍显示为有效的关系
    const { data: expiredRelations, error } = await client
      .from('kg_relations')
      .select('id, source_entity_id, target_entity_id, type')
      .lt('valid_to', today)
      .is('valid_to', null);  // 这里的逻辑是：valid_to < 今天 但还没有被标记为过期
    
    if (error || !expiredRelations) {
      return { processed: 0, expired: 0, archived: 0 };
    }
    
    // 记录过期事件
    for (const relation of expiredRelations) {
      await this.recordEvolution({
        relation_id: relation.id,
        evolution_type: 'expire',
        old_value: { status: 'active' },
        new_value: { status: 'expired', expired_at: today },
        reason: '关系有效期已过，自动过期',
        triggered_by: 'system'
      });
    }
    
    console.log(`[KnowledgeEvolution] 清理过期关系完成: ${expiredRelations.length} 条`);
    
    return {
      processed: expiredRelations.length,
      expired: expiredRelations.length,
      archived: expiredRelations.length
    };
  }
  
  /**
   * 获取演化统计信息
   */
  async getEvolutionStats(): Promise<{
    totalEvolutions: number;
    recentEvolutions: number;
    byType: Record<EvolutionType, number>;
    byTrigger: Record<string, number>;
  }> {
    const client = getClient();
    if (!client) {
      return {
        totalEvolutions: 0,
        recentEvolutions: 0,
        byType: { create: 0, update: 0, replace: 0, expire: 0, delete: 0 },
        byTrigger: { auto: 0, manual: 0, system: 0 }
      };
    }
    
    // 总演化数
    const { count: totalEvolutions } = await client
      .from('kg_corrections')
      .select('*', { count: 'exact', head: true })
      .like('change_type', 'evolution_%');
    
    // 近7天演化数
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { count: recentEvolutions } = await client
      .from('kg_corrections')
      .select('*', { count: 'exact', head: true })
      .like('change_type', 'evolution_%')
      .gte('corrected_at', weekAgo.toISOString());
    
    // 按类型统计
    const byType: Record<EvolutionType, number> = { create: 0, update: 0, replace: 0, expire: 0, delete: 0 };
    const byTrigger: Record<string, number> = { auto: 0, manual: 0, system: 0 };
    
    const { data: typeStats } = await client
      .from('kg_corrections')
      .select('change_type, corrected_by')
      .like('change_type', 'evolution_%');
    
    if (typeStats) {
      for (const stat of typeStats) {
        const type = stat.change_type.replace('evolution_', '') as EvolutionType;
        if (byType[type] !== undefined) {
          byType[type]++;
        }
        const trigger = stat.corrected_by || 'auto';
        if (byTrigger[trigger] !== undefined) {
          byTrigger[trigger]++;
        }
      }
    }
    
    return {
      totalEvolutions: totalEvolutions || 0,
      recentEvolutions: recentEvolutions || 0,
      byType,
      byTrigger
    };
  }
}

// 导出单例
export const knowledgeEvolutionService = new KnowledgeEvolutionService();
