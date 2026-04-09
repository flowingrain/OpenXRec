/**
 * 知识使用统计服务
 * 
 * 记录知识被引用次数，辅助质量评估
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== 类型定义 ====================

export interface KnowledgeUsageStats {
  entityId: string;
  entityName: string;
  usageCount: number;
  lastAccessedAt?: string;
  recentUsageTrend: 'increasing' | 'stable' | 'decreasing';
  usageContexts: UsageContext[];
}

export interface UsageContext {
  type: 'recommendation' | 'search' | 'graph_view' | 'export' | 'edit';
  timestamp: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface UsageRecord {
  entityId: string;
  entityType: 'entity' | 'relation';
  contextType: 'recommendation' | 'search' | 'graph_view' | 'export' | 'edit';
  userId?: string;
  metadata?: Record<string, any>;
}

// ==================== 服务类 ====================

class KnowledgeUsageService {
  
  /**
   * 记录知识使用
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    const now = new Date().toISOString();
    
    try {
      if (record.entityType === 'entity') {
        // 更新实体使用计数
        const { data: entity } = await supabase
          .from('kg_entities')
          .select('properties')
          .eq('id', record.entityId)
          .single();
        
        if (entity) {
          const properties = entity.properties || {};
          const usageCount = (properties as any).usage_count || 0;
          const usageHistory = (properties as any).usage_history || [];
          
          // 添加新的使用记录
          usageHistory.push({
            type: record.contextType,
            timestamp: now,
            userId: record.userId,
          });
          
          // 只保留最近100条记录
          const trimmedHistory = usageHistory.slice(-100);
          
          await supabase
            .from('kg_entities')
            .update({
              properties: {
                ...properties,
                usage_count: usageCount + 1,
                usage_history: trimmedHistory,
                last_accessed_at: now,
              },
              updated_at: now,
            })
            .eq('id', record.entityId);
        }
      } else if (record.entityType === 'relation') {
        // 更新关系使用计数
        const { data: relation } = await supabase
          .from('kg_relations')
          .select('properties')
          .eq('id', record.entityId)
          .single();
        
        if (relation) {
          const properties = relation.properties || {};
          const usageCount = (properties as any).usage_count || 0;
          
          await supabase
            .from('kg_relations')
            .update({
              properties: {
                ...properties,
                usage_count: usageCount + 1,
                last_accessed_at: now,
              },
              updated_at: now,
            })
            .eq('id', record.entityId);
        }
      }
    } catch (error) {
      console.error('[KnowledgeUsageService] Failed to record usage:', error);
    }
  }
  
  /**
   * 批量记录使用
   */
  async recordBatchUsage(records: UsageRecord[]): Promise<void> {
    for (const record of records) {
      await this.recordUsage(record);
    }
  }
  
  /**
   * 获取实体使用统计
   */
  async getEntityUsageStats(entityId: string): Promise<KnowledgeUsageStats | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    
    try {
      const { data: entity } = await supabase
        .from('kg_entities')
        .select('id, name, properties')
        .eq('id', entityId)
        .single();
      
      if (!entity) return null;
      
      const properties = entity.properties || {};
      const usageCount = (properties as any).usage_count || 0;
      const usageHistory = (properties as any).usage_history || [];
      const lastAccessedAt = (properties as any).last_accessed_at;
      
      // 计算使用趋势
      const recentUsageTrend = this.calculateTrend(usageHistory);
      
      // 聚合使用上下文
      const usageContexts = usageHistory.slice(-20).map((h: any) => ({
        type: h.type,
        timestamp: h.timestamp,
        userId: h.userId,
      }));
      
      return {
        entityId: entity.id,
        entityName: entity.name,
        usageCount,
        lastAccessedAt,
        recentUsageTrend,
        usageContexts,
      };
    } catch (error) {
      console.error('[KnowledgeUsageService] Failed to get stats:', error);
      return null;
    }
  }
  
  /**
   * 获取热门实体
   */
  async getTopUsedEntities(limit: number = 20): Promise<KnowledgeUsageStats[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    try {
      const { data: entities } = await supabase
        .from('kg_entities')
        .select('id, name, properties')
        .limit(100);
      
      if (!entities) return [];
      
      // 提取使用计数并排序
      const stats = entities
        .map(e => {
          const properties = e.properties || {};
          const usageCount = (properties as any).usage_count || 0;
          const usageHistory = (properties as any).usage_history || [];
          const lastAccessedAt = (properties as any).last_accessed_at;
          
          return {
            entityId: e.id,
            entityName: e.name,
            usageCount,
            lastAccessedAt,
            recentUsageTrend: this.calculateTrend(usageHistory),
            usageContexts: [],
          };
        })
        .filter(s => s.usageCount > 0)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);
      
      return stats;
    } catch (error) {
      console.error('[KnowledgeUsageService] Failed to get top entities:', error);
      return [];
    }
  }
  
  /**
   * 计算使用趋势
   */
  private calculateTrend(usageHistory: any[]): 'increasing' | 'stable' | 'decreasing' {
    if (usageHistory.length < 5) return 'stable';
    
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    // 最近一周的使用次数
    const recentCount = usageHistory.filter(h => {
      const timestamp = new Date(h.timestamp).getTime();
      return now - timestamp < oneWeek;
    }).length;
    
    // 之前一周的使用次数
    const previousCount = usageHistory.filter(h => {
      const timestamp = new Date(h.timestamp).getTime();
      return now - timestamp < oneWeek * 2 && now - timestamp >= oneWeek;
    }).length;
    
    if (recentCount > previousCount * 1.5) return 'increasing';
    if (recentCount < previousCount * 0.7) return 'decreasing';
    return 'stable';
  }
  
  /**
   * 获取使用统计概览
   */
  async getUsageOverview(): Promise<{
    totalUsage: number;
    topEntities: KnowledgeUsageStats[];
    usageByType: Record<string, number>;
    usageByContext: Record<string, number>;
  }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        totalUsage: 0,
        topEntities: [],
        usageByType: {},
        usageByContext: {},
      };
    }
    
    try {
      const { data: entities } = await supabase
        .from('kg_entities')
        .select('name, type, properties');
      
      if (!entities) {
        return {
          totalUsage: 0,
          topEntities: [],
          usageByType: {},
          usageByContext: {},
        };
      }
      
      let totalUsage = 0;
      const usageByType: Record<string, number> = {};
      const usageByContext: Record<string, number> = {};
      const entityStats: Array<{ name: string; count: number }> = [];
      
      for (const entity of entities) {
        const properties = entity.properties || {};
        const usageCount = (properties as any).usage_count || 0;
        const usageHistory = (properties as any).usage_history || [];
        
        totalUsage += usageCount;
        usageByType[entity.type] = (usageByType[entity.type] || 0) + usageCount;
        
        // 聚合使用上下文
        for (const h of usageHistory) {
          usageByContext[h.type] = (usageByContext[h.type] || 0) + 1;
        }
        
        if (usageCount > 0) {
          entityStats.push({ name: entity.name, count: usageCount });
        }
      }
      
      const topEntities = entityStats
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(e => ({
          entityId: '',
          entityName: e.name,
          usageCount: e.count,
          recentUsageTrend: 'stable' as const,
          usageContexts: [],
        }));
      
      return {
        totalUsage,
        topEntities,
        usageByType,
        usageByContext,
      };
    } catch (error) {
      console.error('[KnowledgeUsageService] Failed to get overview:', error);
      return {
        totalUsage: 0,
        topEntities: [],
        usageByType: {},
        usageByContext: {},
      };
    }
  }
}

// 导出单例
export const knowledgeUsageService = new KnowledgeUsageService();
