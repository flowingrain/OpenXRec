/**
 * 知识库层实现（事实知识层）
 * 
 * 职责：
 * - 结构化知识：实体定义、属性、分类
 * - 关系知识：实体间的关系
 * - 规则知识：业务规则、逻辑规则
 * - 概念知识：领域概念、术语解释
 * 
 * 特点：
 * - 以三元组（实体-关系-实体）为核心
 * - 支持图查询（路径、邻居、子图）
 * - 置信度标记、来源追溯
 * - 版本管理、冲突检测
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import {
  IKnowledgeLayer,
  StorageResult,
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeRule,
  KnowledgeEntry,
  KnowledgeVersion,
  QueryOptions,
  KnowledgeSourceType,
} from '../types';

/**
 * 知识库层实现类
 */
export class KnowledgeLayer implements IKnowledgeLayer {
  private client: SupabaseClient;
  private embeddingClient: EmbeddingClient;
  private initialized: boolean = false;

  constructor() {
    this.client = getSupabaseClient();
    this.embeddingClient = new EmbeddingClient({} as Config);
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 检查连接
    const { error } = await this.client.from('kg_entities').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('[KnowledgeLayer] Connection check failed:', error);
    }

    this.initialized = true;
    console.log('[KnowledgeLayer] Initialized');
  }

  // ============================================================================
  // 实体管理
  // ============================================================================

  /**
   * 创建实体
   */
  async createEntity(
    entity: Omit<KnowledgeEntity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StorageResult<KnowledgeEntity>> {
    const startTime = Date.now();

    try {
      const id = `entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      const record = {
        id,
        name: entity.name,
        type: entity.type,
        aliases: entity.aliases,
        description: entity.description,
        importance: entity.importance,
        properties: entity.properties,
        source_type: entity.source,
        verified: entity.verified,
        created_at: now,
        updated_at: now,
      };

      const { error } = await this.client.from('kg_entities').insert(record);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          id,
          ...entity,
          createdAt: Date.now(),
          updatedAt: Date.now(),
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
   * 获取实体
   */
  async getEntity(id: string): Promise<StorageResult<KnowledgeEntity>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('kg_entities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToEntity(data),
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
   * 更新实体
   */
  async updateEntity(
    id: string,
    updates: Partial<KnowledgeEntity>
  ): Promise<StorageResult<KnowledgeEntity>> {
    const startTime = Date.now();

    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.type) updateData.type = updates.type;
      if (updates.aliases) updateData.aliases = updates.aliases;
      if (updates.description) updateData.description = updates.description;
      if (updates.importance !== undefined) updateData.importance = updates.importance;
      if (updates.properties) updateData.properties = updates.properties;
      if (updates.verified !== undefined) updateData.verified = updates.verified;

      const { data, error } = await this.client
        .from('kg_entities')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToEntity(data),
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
   * 删除实体
   */
  async deleteEntity(id: string): Promise<StorageResult<void>> {
    const startTime = Date.now();

    try {
      const { error } = await this.client.from('kg_entities').delete().eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, duration: Date.now() - startTime };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 搜索实体
   */
  async searchEntities(
    query: string,
    options?: QueryOptions
  ): Promise<StorageResult<KnowledgeEntity[]>> {
    const startTime = Date.now();

    try {
      let dbQuery = this.client
        .from('kg_entities')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

      if (options?.limit) {
        dbQuery = dbQuery.limit(options.limit);
      }

      const { data, error } = await dbQuery;

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map(this.mapToEntity),
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
  // 关系管理
  // ============================================================================

  /**
   * 创建关系
   */
  async createRelation(
    relation: Omit<KnowledgeRelation, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StorageResult<KnowledgeRelation>> {
    const startTime = Date.now();

    try {
      const id = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      const record = {
        id,
        source_entity_id: relation.sourceEntityId,
        target_entity_id: relation.targetEntityId,
        type: relation.type,
        confidence: relation.confidence,
        evidence: relation.evidence,
        properties: relation.properties,
        source_type: relation.source,
        verified: relation.verified,
        valid_from: relation.validFrom ? new Date(relation.validFrom).toISOString() : null,
        valid_to: relation.validTo ? new Date(relation.validTo).toISOString() : null,
        created_at: now,
        updated_at: now,
      };

      const { error } = await this.client.from('kg_relations').insert(record);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          id,
          ...relation,
          createdAt: Date.now(),
          updatedAt: Date.now(),
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
   * 获取关系
   */
  async getRelation(id: string): Promise<StorageResult<KnowledgeRelation>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('kg_relations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToRelation(data),
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
   * 获取实体的所有关系
   */
  async getRelationsByEntity(entityId: string): Promise<StorageResult<KnowledgeRelation[]>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('kg_relations')
        .select('*')
        .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map(this.mapToRelation),
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
   * 删除关系
   */
  async deleteRelation(id: string): Promise<StorageResult<void>> {
    const startTime = Date.now();

    try {
      const { error } = await this.client.from('kg_relations').delete().eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, duration: Date.now() - startTime };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ============================================================================
  // 条目管理
  // ============================================================================

  /**
   * 创建知识条目
   */
  async createEntry(entry: KnowledgeEntry): Promise<StorageResult<KnowledgeEntry>> {
    const startTime = Date.now();

    try {
      // 生成向量嵌入
      let embedding: number[] | null = null;
      try {
        embedding = await this.embeddingClient.embedText(entry.content);
      } catch (e) {
        console.warn('[KnowledgeLayer] Failed to generate embedding:', e);
      }

      const record = {
        id: entry.id,
        type: entry.type,
        title: entry.title,
        content: entry.content,
        source: entry.metadata.source,
        confidence: entry.metadata.confidence,
        tags: entry.metadata.tags || [],
        related_entities: entry.metadata.relatedEntities || [],
        region: entry.metadata.region || null,
        sector: entry.metadata.sector || null,
        is_preset: entry.metadata.isPreset || false,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        embedding,
      };

      const { error } = await this.client.from('knowledge_entries').upsert(record);

      if (error) {
        return { success: false, error: error.message };
      }

      // 创建版本记录
      await this.createVersion(entry, 'create', 'Initial creation');

      return {
        success: true,
        data: entry,
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
   * 获取知识条目
   */
  async getEntry(id: string): Promise<StorageResult<KnowledgeEntry>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('knowledge_entries')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToEntry(data),
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
   * 更新知识条目
   */
  async updateEntry(
    id: string,
    updates: Partial<KnowledgeEntry>
  ): Promise<StorageResult<KnowledgeEntry>> {
    const startTime = Date.now();

    try {
      // 获取当前条目
      const currentResult = await this.getEntry(id);
      if (!currentResult.success || !currentResult.data) {
        return { success: false, error: 'Entry not found' };
      }

      const current = currentResult.data;
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.title) updateData.title = updates.title;
      if (updates.content) updateData.content = updates.content;
      if (updates.type) updateData.type = updates.type;
      if (updates.metadata) {
        if (updates.metadata.tags) updateData.tags = updates.metadata.tags;
        if (updates.metadata.confidence !== undefined)
          updateData.confidence = updates.metadata.confidence;
        if (updates.metadata.source) updateData.source = updates.metadata.source;
        if (updates.metadata.relatedEntities)
          updateData.related_entities = updates.metadata.relatedEntities;
      }

      // 如果内容更新，重新生成嵌入
      if (updates.content) {
        try {
          updateData.embedding = await this.embeddingClient.embedText(updates.content);
        } catch (e) {
          console.warn('[KnowledgeLayer] Failed to regenerate embedding:', e);
        }
      }

      const { data, error } = await this.client
        .from('knowledge_entries')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // 创建版本记录
      const updatedEntry = this.mapToEntry(data);
      await this.createVersion(updatedEntry, 'update', 'Content updated');

      return {
        success: true,
        data: updatedEntry,
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
   * 删除知识条目
   */
  async deleteEntry(id: string): Promise<StorageResult<void>> {
    const startTime = Date.now();

    try {
      const { error } = await this.client.from('knowledge_entries').delete().eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, duration: Date.now() - startTime };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 搜索知识条目
   */
  async searchEntries(
    query: string,
    options?: QueryOptions
  ): Promise<StorageResult<KnowledgeEntry[]>> {
    const startTime = Date.now();

    try {
      // 首先尝试向量搜索
      try {
        const queryEmbedding = await this.embeddingClient.embedText(query);
        const { data: vectorResults, error: vectorError } = await this.client.rpc(
          'search_knowledge_by_vector',
          {
            query_embedding: queryEmbedding,
            match_limit: options?.limit || 10,
            match_threshold: 0.5,
          }
        );

        if (!vectorError && vectorResults && vectorResults.length > 0) {
          return {
            success: true,
            data: vectorResults.map((item: any) => this.mapToEntry(item)),
            duration: Date.now() - startTime,
          };
        }
      } catch (e) {
        console.warn('[KnowledgeLayer] Vector search failed, falling back to text search:', e);
      }

      // 回退到文本搜索
      let dbQuery = this.client
        .from('knowledge_entries')
        .select('*')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`);

      if (options?.limit) {
        dbQuery = dbQuery.limit(options.limit);
      }

      const { data, error } = await dbQuery;

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map(this.mapToEntry),
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
  // 版本管理
  // ============================================================================

  /**
   * 获取版本历史
   */
  async getVersionHistory(entryId: string): Promise<StorageResult<KnowledgeVersion[]>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('knowledge_versions')
        .select('*')
        .eq('entry_id', entryId)
        .order('version', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map(this.mapToVersion),
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
   * 回滚到指定版本
   */
  async rollbackVersion(entryId: string, versionId: string): Promise<StorageResult<KnowledgeEntry>> {
    const startTime = Date.now();

    try {
      // 获取目标版本
      const { data: versionData, error: versionError } = await this.client
        .from('knowledge_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (versionError || !versionData) {
        return { success: false, error: 'Version not found' };
      }

      const snapshot = versionData.snapshot;

      // 恢复条目
      const { error: updateError } = await this.client
        .from('knowledge_entries')
        .update({
          title: snapshot.title,
          content: snapshot.content,
          type: snapshot.type,
          tags: snapshot.metadata?.tags || [],
          confidence: snapshot.metadata?.confidence || 0.8,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // 创建回滚版本记录
      const restoredEntry = await this.getEntry(entryId);
      if (restoredEntry.success && restoredEntry.data) {
        await this.createVersion(restoredEntry.data, 'restore', `Restored from version ${versionId}`);
      }

      return {
        success: true,
        data: restoredEntry.data!,
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
   * 创建版本记录
   */
  private async createVersion(
    entry: KnowledgeEntry,
    changeType: KnowledgeVersion['changeType'],
    description: string
  ): Promise<void> {
    try {
      // 获取当前版本号
      const { data: versions } = await this.client
        .from('knowledge_versions')
        .select('version')
        .eq('entry_id', entry.id)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = (versions?.[0]?.version || 0) + 1;

      // 将之前的版本标记为非当前版本
      await this.client
        .from('knowledge_versions')
        .update({ is_current: false })
        .eq('entry_id', entry.id);

      // 创建新版本
      await this.client.from('knowledge_versions').insert({
        id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        entry_id: entry.id,
        version: nextVersion,
        snapshot: entry,
        change_type: changeType,
        change_description: description,
        change_source: { type: entry.metadata.source },
        is_current: true,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[KnowledgeLayer] Failed to create version:', e);
    }
  }

  // ============================================================================
  // 映射函数
  // ============================================================================

  private mapToEntity(data: any): KnowledgeEntity {
    return {
      id: data.id,
      name: data.name,
      type: data.type || 'other',
      aliases: data.aliases || [],
      description: data.description || '',
      importance: parseFloat(data.importance) || 0.5,
      properties: data.properties || {},
      source: data.source_type || 'llm_generated',
      verified: data.verified || false,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  private mapToRelation(data: any): KnowledgeRelation {
    return {
      id: data.id,
      sourceEntityId: data.source_entity_id,
      targetEntityId: data.target_entity_id,
      type: data.type,
      confidence: parseFloat(data.confidence) || 0.5,
      evidence: data.evidence,
      properties: data.properties || {},
      source: data.source_type || 'llm_generated',
      verified: data.verified || false,
      validFrom: data.valid_from ? new Date(data.valid_from).getTime() : undefined,
      validTo: data.valid_to ? new Date(data.valid_to).getTime() : undefined,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  private mapToEntry(data: any): KnowledgeEntry {
    return {
      id: data.id,
      type: data.type,
      title: data.title,
      content: data.content,
      metadata: {
        source: data.source,
        confidence: parseFloat(data.confidence) || 0.8,
        timestamp: new Date(data.created_at).getTime(),
        tags: data.tags || [],
        relatedEntities: data.related_entities || [],
        region: data.region,
        sector: data.sector,
        isPreset: data.is_preset,
      },
      embedding: data.embedding,
    };
  }

  private mapToVersion(data: any): KnowledgeVersion {
    return {
      id: data.id,
      entryId: data.entry_id,
      version: data.version,
      snapshot: data.snapshot,
      changeType: data.change_type,
      changeDescription: data.change_description,
      changeSource: data.change_source,
      diff: data.diff,
      createdAt: new Date(data.created_at).getTime(),
      createdBy: data.created_by || 'system',
      isCurrent: data.is_current,
      tags: data.tags || [],
    };
  }
}

// 导出单例
let knowledgeLayerInstance: KnowledgeLayer | null = null;

export function getKnowledgeLayer(): KnowledgeLayer {
  if (!knowledgeLayerInstance) {
    knowledgeLayerInstance = new KnowledgeLayer();
  }
  return knowledgeLayerInstance;
}
