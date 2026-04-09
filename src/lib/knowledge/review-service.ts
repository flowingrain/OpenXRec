/**
 * 知识审核服务
 * 
 * 管理知识的审核队列、审核流程
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== 类型定义 ====================

export interface ReviewItem {
  id: string;
  type: 'entity' | 'relation';
  data: Record<string, any>;
  source: 'manual' | 'auto_extracted' | 'feedback' | 'import';
  confidence: number;
  submittedBy?: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  conflicts?: ConflictInfo[];
}

export interface ConflictInfo {
  type: 'duplicate' | 'contradiction' | 'low_confidence';
  description: string;
  relatedItems?: string[];
}

export interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
  byType: {
    entities: number;
    relations: number;
  };
  avgConfidence: number;
  recentApproved: number;
  recentRejected: number;
}

export interface ReviewFilter {
  type?: 'entity' | 'relation';
  status?: 'pending' | 'approved' | 'rejected';
  source?: string;
  minConfidence?: number;
  hasConflicts?: boolean;
  startDate?: string;
  endDate?: string;
}

// ==================== 审核服务类 ====================

class ReviewService {
  /**
   * 获取审核队列
   */
  async getReviewQueue(filter: ReviewFilter = {}, limit = 50, offset = 0): Promise<ReviewItem[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const items: ReviewItem[] = [];

      // 获取待审核实体
      if (!filter.type || filter.type === 'entity') {
        let query = supabase
          .from('kg_entities')
          .select('*')
          .eq('verified', false);

        if (filter.status === 'pending') {
          query = query.is('reviewed_at', null);
        } else if (filter.status === 'approved') {
          query = query.not('reviewed_at', 'is', null);
        }

        if (filter.minConfidence) {
          query = query.gte('importance', filter.minConfidence);
        }

        if (filter.startDate) {
          query = query.gte('created_at', filter.startDate);
        }
        if (filter.endDate) {
          query = query.lte('created_at', filter.endDate);
        }

        const { data: entities, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && entities) {
          for (const entity of entities) {
            items.push({
              id: entity.id,
              type: 'entity',
              data: {
                name: entity.name,
                type: entity.type,
                description: entity.description,
                aliases: entity.aliases,
                properties: entity.properties,
                importance: entity.importance,
              },
              source: entity.source_type || 'manual',
              confidence: entity.importance || 0.5,
              submittedBy: entity.created_by,
              submittedAt: entity.created_at,
              status: entity.reviewed_at ? 
                (entity.verified ? 'approved' : 'rejected') : 'pending',
              reviewedBy: entity.reviewed_by,
              reviewedAt: entity.reviewed_at,
              reviewNote: entity.review_note,
            });
          }
        }
      }

      // 获取待审核关系
      if (!filter.type || filter.type === 'relation') {
        let query = supabase
          .from('kg_relations')
          .select(`
            *,
            source_entity:kg_entities!kg_relations_source_entity_id_fkey(name),
            target_entity:kg_entities!kg_relations_target_entity_id_fkey(name)
          `)
          .eq('verified', false);

        if (filter.status === 'pending') {
          query = query.is('reviewed_at', null);
        } else if (filter.status === 'approved') {
          query = query.not('reviewed_at', 'is', null);
        }

        if (filter.minConfidence) {
          query = query.gte('confidence', filter.minConfidence);
        }

        if (filter.startDate) {
          query = query.gte('created_at', filter.startDate);
        }
        if (filter.endDate) {
          query = query.lte('created_at', filter.endDate);
        }

        const { data: relations, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error && relations) {
          for (const relation of relations) {
            items.push({
              id: relation.id,
              type: 'relation',
              data: {
                source_entity_id: relation.source_entity_id,
                source_name: relation.source_entity?.name,
                target_entity_id: relation.target_entity_id,
                target_name: relation.target_entity?.name,
                type: relation.type,
                evidence: relation.evidence,
                confidence: relation.confidence,
              },
              source: relation.source_type || 'manual',
              confidence: relation.confidence || 0.5,
              submittedBy: relation.created_by,
              submittedAt: relation.created_at,
              status: relation.reviewed_at ? 
                (relation.verified ? 'approved' : 'rejected') : 'pending',
              reviewedBy: relation.reviewed_by,
              reviewedAt: relation.reviewed_at,
              reviewNote: relation.review_note,
            });
          }
        }
      }

      // 按置信度和时间排序
      items.sort((a, b) => {
        // 待审核优先
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        // 置信度高的优先
        if (a.confidence !== b.confidence) return b.confidence - a.confidence;
        // 时间新的优先
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });

      return items.slice(0, limit);
    } catch (error) {
      console.error('[ReviewService] Get review queue error:', error);
      return [];
    }
  }

  /**
   * 获取审核统计
   */
  async getReviewStats(): Promise<ReviewStats> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        pending: 0,
        approved: 0,
        rejected: 0,
        byType: { entities: 0, relations: 0 },
        avgConfidence: 0,
        recentApproved: 0,
        recentRejected: 0,
      };
    }

    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 统计实体
      const { data: entityStats } = await supabase
        .from('kg_entities')
        .select('id, verified, reviewed_at, importance');

      // 统计关系
      const { data: relationStats } = await supabase
        .from('kg_relations')
        .select('id, verified, reviewed_at, confidence');

      const entities = entityStats || [];
      const relations = relationStats || [];

      // 计算各项统计
      const pendingEntities = entities.filter(e => !e.verified && !e.reviewed_at).length;
      const pendingRelations = relations.filter(r => !r.verified && !r.reviewed_at).length;
      
      const approvedEntities = entities.filter(e => e.verified).length;
      const approvedRelations = relations.filter(r => r.verified).length;
      
      const rejectedEntities = entities.filter(e => !e.verified && e.reviewed_at).length;
      const rejectedRelations = relations.filter(r => !r.verified && r.reviewed_at).length;

      // 计算平均置信度
      const allConfidences = [
        ...entities.map(e => e.importance || 0.5),
        ...relations.map(r => r.confidence || 0.5),
      ];
      const avgConfidence = allConfidences.length > 0
        ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
        : 0;

      // 最近审核统计
      const recentApprovedEntities = entities.filter(e => 
        e.verified && e.reviewed_at && new Date(e.reviewed_at) > new Date(oneWeekAgo)
      ).length;
      const recentApprovedRelations = relations.filter(r => 
        r.verified && r.reviewed_at && new Date(r.reviewed_at) > new Date(oneWeekAgo)
      ).length;
      const recentRejectedEntities = entities.filter(e => 
        !e.verified && e.reviewed_at && new Date(e.reviewed_at) > new Date(oneWeekAgo)
      ).length;
      const recentRejectedRelations = relations.filter(r => 
        !r.verified && r.reviewed_at && new Date(r.reviewed_at) > new Date(oneWeekAgo)
      ).length;

      return {
        pending: pendingEntities + pendingRelations,
        approved: approvedEntities + approvedRelations,
        rejected: rejectedEntities + rejectedRelations,
        byType: {
          entities: pendingEntities,
          relations: pendingRelations,
        },
        avgConfidence,
        recentApproved: recentApprovedEntities + recentApprovedRelations,
        recentRejected: rejectedEntities + rejectedRelations,
      };
    } catch (error) {
      console.error('[ReviewService] Get stats error:', error);
      return {
        pending: 0,
        approved: 0,
        rejected: 0,
        byType: { entities: 0, relations: 0 },
        avgConfidence: 0,
        recentApproved: 0,
        recentRejected: 0,
      };
    }
  }

  /**
   * 审核知识项（通过/拒绝）
   */
  async reviewItem(
    type: 'entity' | 'relation',
    id: string,
    approved: boolean,
    reviewerId: string,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: '数据库连接失败' };
    }

    try {
      const table = type === 'entity' ? 'kg_entities' : 'kg_relations';
      const now = new Date().toISOString();

      const updateData = {
        verified: approved,
        reviewed_by: reviewerId,
        reviewed_at: now,
        review_note: note,
        updated_at: now,
      };

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('[ReviewService] Review error:', error);
        return { success: false, error: '审核失败' };
      }

      // 如果是通过，更新使用统计
      if (approved) {
        // 可以触发其他操作，如更新索引等
      }

      return { success: true };
    } catch (error) {
      console.error('[ReviewService] Review error:', error);
      return { success: false, error: '审核失败' };
    }
  }

  /**
   * 批量审核
   */
  async batchReview(
    items: Array<{ type: 'entity' | 'relation'; id: string }>,
    approved: boolean,
    reviewerId: string,
    note?: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const item of items) {
      const result = await this.reviewItem(item.type, item.id, approved, reviewerId, note);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 检测冲突
   */
  async detectConflicts(itemId: string, type: 'entity' | 'relation'): Promise<ConflictInfo[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const conflicts: ConflictInfo[] = [];

    try {
      if (type === 'entity') {
        // 获取当前实体
        const { data: entity } = await supabase
          .from('kg_entities')
          .select('*')
          .eq('id', itemId)
          .single();

        if (!entity) return [];

        // 检查重复名称
        const { data: duplicates } = await supabase
          .from('kg_entities')
          .select('id, name')
          .neq('id', itemId)
          .or(`name.eq.${entity.name},aliases.cs.["${entity.name}"]`)
          .limit(5);

        if (duplicates && duplicates.length > 0) {
          conflicts.push({
            type: 'duplicate',
            description: `发现 ${duplicates.length} 个可能重复的实体`,
            relatedItems: duplicates.map(d => d.id),
          });
        }

        // 低置信度警告
        if (entity.importance < 0.5) {
          conflicts.push({
            type: 'low_confidence',
            description: `置信度较低 (${(entity.importance * 100).toFixed(0)}%)`,
          });
        }
      } else {
        // 获取当前关系
        const { data: relation } = await supabase
          .from('kg_relations')
          .select('*')
          .eq('id', itemId)
          .single();

        if (!relation) return [];

        // 检查重复关系
        const { data: duplicates } = await supabase
          .from('kg_relations')
          .select('id')
          .neq('id', itemId)
          .eq('source_entity_id', relation.source_entity_id)
          .eq('target_entity_id', relation.target_entity_id)
          .eq('type', relation.type);

        if (duplicates && duplicates.length > 0) {
          conflicts.push({
            type: 'duplicate',
            description: '存在相同的关系',
            relatedItems: duplicates.map(d => d.id),
          });
        }

        // 低置信度警告
        if (relation.confidence < 0.5) {
          conflicts.push({
            type: 'low_confidence',
            description: `置信度较低 (${(relation.confidence * 100).toFixed(0)}%)`,
          });
        }
      }

      return conflicts;
    } catch (error) {
      console.error('[ReviewService] Detect conflicts error:', error);
      return [];
    }
  }

  /**
   * 获取审核历史
   */
  async getReviewHistory(
    reviewerId?: string,
    limit = 50
  ): Promise<ReviewItem[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const items: ReviewItem[] = [];

      // 获取已审核实体
      let entityQuery = supabase
        .from('kg_entities')
        .select('*')
        .not('reviewed_at', 'is', null);

      if (reviewerId) {
        entityQuery = entityQuery.eq('reviewed_by', reviewerId);
      }

      const { data: entities } = await entityQuery
        .order('reviewed_at', { ascending: false })
        .limit(limit);

      if (entities) {
        for (const entity of entities) {
          items.push({
            id: entity.id,
            type: 'entity',
            data: {
              name: entity.name,
              type: entity.type,
              description: entity.description,
            },
            source: entity.source_type || 'manual',
            confidence: entity.importance || 0.5,
            submittedAt: entity.created_at,
            status: entity.verified ? 'approved' : 'rejected',
            reviewedBy: entity.reviewed_by,
            reviewedAt: entity.reviewed_at,
            reviewNote: entity.review_note,
          });
        }
      }

      // 获取已审核关系
      let relationQuery = supabase
        .from('kg_relations')
        .select(`
          *,
          source_entity:kg_entities!kg_relations_source_entity_id_fkey(name),
          target_entity:kg_entities!kg_relations_target_entity_id_fkey(name)
        `)
        .not('reviewed_at', 'is', null);

      if (reviewerId) {
        relationQuery = relationQuery.eq('reviewed_by', reviewerId);
      }

      const { data: relations } = await relationQuery
        .order('reviewed_at', { ascending: false })
        .limit(limit);

      if (relations) {
        for (const relation of relations) {
          items.push({
            id: relation.id,
            type: 'relation',
            data: {
              source_name: relation.source_entity?.name,
              target_name: relation.target_entity?.name,
              type: relation.type,
            },
            source: relation.source_type || 'manual',
            confidence: relation.confidence || 0.5,
            submittedAt: relation.created_at,
            status: relation.verified ? 'approved' : 'rejected',
            reviewedBy: relation.reviewed_by,
            reviewedAt: relation.reviewed_at,
            reviewNote: relation.review_note,
          });
        }
      }

      // 按审核时间排序
      items.sort((a, b) => 
        new Date(b.reviewedAt || 0).getTime() - new Date(a.reviewedAt || 0).getTime()
      );

      return items.slice(0, limit);
    } catch (error) {
      console.error('[ReviewService] Get history error:', error);
      return [];
    }
  }
}

// 单例
export const reviewService = new ReviewService();
