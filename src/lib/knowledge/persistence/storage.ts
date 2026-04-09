/**
 * 知识持久化服务 - Supabase存储实现
 * 
 * 功能：
 * 1. 知识条目的CRUD操作
 * 2. 向量嵌入存储与检索
 * 3. 批量操作支持
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import {
  KnowledgeEntryRecord,
  KnowledgePersistenceConfig,
  DEFAULT_PERSISTENCE_CONFIG,
  PersistenceResult,
  BatchPersistenceResult,
} from './types';
import { KnowledgeEntry, KnowledgeType } from '../index';

// ============================================================================
// Supabase知识存储类
// ============================================================================

export class SupabaseKnowledgeStorage {
  private client: SupabaseClient;
  private config: KnowledgePersistenceConfig;
  private embeddingClient: EmbeddingClient;
  private customHeaders?: Record<string, string>;

  constructor(
    customHeaders?: Record<string, string>,
    config?: Partial<KnowledgePersistenceConfig>
  ) {
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
    this.customHeaders = customHeaders;
    
    // 初始化Supabase客户端
    const supabaseUrl = process.env.COZE_SUPABASE_URL;
    const supabaseKey = process.env.COZE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured. Set COZE_SUPABASE_URL and COZE_SUPABASE_ANON_KEY');
    }
    
    this.client = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'public' },
    });
    
    // 初始化嵌入客户端
    this.embeddingClient = new EmbeddingClient(new Config(), customHeaders);
  }

  // ===========================================================================
  // 核心CRUD操作
  // ===========================================================================

  /**
   * 存储知识条目
   */
  async store(entry: KnowledgeEntry, options?: {
    isAutoLearned?: boolean;
    timeSensitivity?: 'high' | 'medium' | 'low';
    expiresAt?: Date;
  }): Promise<PersistenceResult> {
    try {
      // 计算过期时间
      const timeSensitivity = options?.timeSensitivity || this.detectTimeSensitivity(entry);
      const expiresAt = options?.expiresAt || this.calculateExpiry(timeSensitivity);
      
      // 生成向量嵌入
      let embedding: number[] | null = null;
      if (this.config.enableVectorStorage) {
        embedding = await this.generateEmbedding(entry.content);
      }
      
      const record: KnowledgeEntryRecord = {
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
        is_auto_learned: options?.isAutoLearned || false,
        status: 'active',
        time_sensitivity: timeSensitivity,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
        access_count: 0,
        conflict_with: [],
        expert_reviewed: false,
        expert_reviewer: null,
        expert_reviewed_at: null,
        expert_notes: null,
        embedding,
      };
      
      const { error } = await this.client
        .from('knowledge_entries')
        .upsert(record, { onConflict: 'id' });
      
      if (error) {
        return { success: false, error: error.message, entryId: entry.id };
      }
      
      return { success: true, entryId: entry.id };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : String(err),
        entryId: entry.id 
      };
    }
  }

  /**
   * 批量存储知识条目
   */
  async storeBatch(entries: KnowledgeEntry[], options?: {
    isAutoLearned?: boolean;
  }): Promise<BatchPersistenceResult> {
    const results: PersistenceResult[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    
    for (let i = 0; i < entries.length; i++) {
      const result = await this.store(entries[i], options);
      results.push(result);
      
      if (!result.success) {
        errors.push({ index: i, error: result.error || 'Unknown error' });
      }
    }
    
    return {
      success: errors.length === 0,
      total: entries.length,
      succeeded: results.filter(r => r.success).length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * 获取知识条目
   */
  async get(id: string): Promise<KnowledgeEntry | null> {
    const { data, error } = await this.client
      .from('knowledge_entries')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // 更新访问计数
    await this.updateAccessStats(id);
    
    return this.recordToEntry(data);
  }

  /**
   * 搜索知识条目
   */
  async search(options: {
    query?: string;
    type?: KnowledgeType;
    tags?: string[];
    limit?: number;
    offset?: number;
    includeExpired?: boolean;
  }): Promise<{ entries: KnowledgeEntry[]; total: number }> {
    let query = this.client
      .from('knowledge_entries')
      .select('*', { count: 'exact' });
    
    // 状态过滤
    if (!options.includeExpired) {
      query = query.eq('status', 'active');
    }
    
    // 类型过滤
    if (options.type) {
      query = query.eq('type', options.type);
    }
    
    // 标签过滤
    if (options.tags && options.tags.length > 0) {
      query = query.contains('tags', options.tags);
    }
    
    // 文本搜索
    if (options.query) {
      query = query.or(`title.ilike.%${options.query}%,content.ilike.%${options.query}%`);
    }
    
    // 分页
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error || !data) {
      return { entries: [], total: 0 };
    }
    
    return {
      entries: data.map(r => this.recordToEntry(r)),
      total: count || 0,
    };
  }

  /**
   * 向量相似度搜索
   */
  async vectorSearch(
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
      type?: KnowledgeType;
    }
  ): Promise<Array<{ entry: KnowledgeEntry; similarity: number }>> {
    if (!this.config.enableVectorStorage) {
      return [];
    }
    
    try {
      // 生成查询向量
      const queryEmbedding = await this.generateEmbedding(query);
      
      // 使用RPC函数进行向量搜索
      const { data, error } = await this.client.rpc('knowledge_vector_search', {
        query_embedding: queryEmbedding,
        match_threshold: options?.threshold || 0.7,
        match_count: options?.limit || 10,
        filter_type: options?.type || null,
      });
      
      if (error || !data) {
        // 如果RPC不存在，降级为普通搜索
        return this.fallbackSearch(query, options?.limit || 10);
      }
      
      return data.map((r: any) => ({
        entry: this.recordToEntry(r),
        similarity: r.similarity,
      }));
    } catch (err) {
      console.error('[VectorSearch] Error:', err);
      return this.fallbackSearch(query, options?.limit || 10);
    }
  }

  /**
   * 更新知识条目
   */
  async update(id: string, updates: Partial<KnowledgeEntryRecord>): Promise<PersistenceResult> {
    const { error } = await this.client
      .from('knowledge_entries')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) {
      return { success: false, error: error.message, entryId: id };
    }
    
    return { success: true, entryId: id };
  }

  /**
   * 删除知识条目
   */
  async delete(id: string): Promise<PersistenceResult> {
    const { error } = await this.client
      .from('knowledge_entries')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, error: error.message, entryId: id };
    }
    
    return { success: true, entryId: id };
  }

  /**
   * 归档知识条目
   */
  async archive(id: string): Promise<PersistenceResult> {
    return this.update(id, { status: 'archived' });
  }

  // ===========================================================================
  // 时效性管理
  // ===========================================================================

  /**
   * 获取过期条目
   */
  async getExpired(): Promise<KnowledgeEntryRecord[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await this.client
      .from('knowledge_entries')
      .select('*')
      .not('expires_at', 'is', null)
      .lt('expires_at', now)
      .eq('status', 'active');
    
    if (error || !data) {
      return [];
    }
    
    return data;
  }

  /**
   * 获取即将过期的条目
   */
  async getExpiringWithin(hours: number): Promise<KnowledgeEntryRecord[]> {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
    
    const { data, error } = await this.client
      .from('knowledge_entries')
      .select('*')
      .not('expires_at', 'is', null)
      .gte('expires_at', now.toISOString())
      .lte('expires_at', future.toISOString())
      .eq('status', 'active');
    
    if (error || !data) {
      return [];
    }
    
    return data;
  }

  /**
   * 标记过期条目
   */
  async markExpired(ids: string[]): Promise<number> {
    const { error } = await this.client
      .from('knowledge_entries')
      .update({ 
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .in('id', ids);
    
    if (error) {
      console.error('[MarkExpired] Error:', error);
      return 0;
    }
    
    return ids.length;
  }

  // ===========================================================================
  // 统计与监控
  // ===========================================================================

  /**
   * 获取存储统计
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byTimeSensitivity: Record<string, number>;
    expired: number;
    pendingReview: number;
    autoLearned: number;
    preset: number;
  }> {
    const { data, error } = await this.client
      .from('knowledge_entries')
      .select('type, status, time_sensitivity, is_preset, is_auto_learned, expires_at');
    
    if (error || !data) {
      return {
        total: 0,
        byType: {},
        byStatus: {},
        byTimeSensitivity: {},
        expired: 0,
        pendingReview: 0,
        autoLearned: 0,
        preset: 0,
      };
    }
    
    const now = new Date();
    const stats = {
      total: data.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byTimeSensitivity: {} as Record<string, number>,
      expired: 0,
      pendingReview: 0,
      autoLearned: 0,
      preset: 0,
    };
    
    for (const row of data) {
      // 按类型统计
      stats.byType[row.type] = (stats.byType[row.type] || 0) + 1;
      
      // 按状态统计
      stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + 1;
      
      // 按时效性统计
      stats.byTimeSensitivity[row.time_sensitivity] = 
        (stats.byTimeSensitivity[row.time_sensitivity] || 0) + 1;
      
      // 过期计数
      if (row.expires_at && new Date(row.expires_at) < now) {
        stats.expired++;
      }
      
      // 待审核
      if (row.status === 'pending_review') {
        stats.pendingReview++;
      }
      
      // 自动学习
      if (row.is_auto_learned) {
        stats.autoLearned++;
      }
      
      // 预置
      if (row.is_preset) {
        stats.preset++;
      }
    }
    
    return stats;
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 生成向量嵌入
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddingClient.embedText(text.substring(0, 8000));
      return embedding || [];
    } catch (err) {
      console.error('[GenerateEmbedding] Error:', err);
      return [];
    }
  }

  /**
   * 检测时效性
   */
  private detectTimeSensitivity(entry: KnowledgeEntry): 'high' | 'medium' | 'low' {
    const text = `${entry.title} ${entry.content}`.toLowerCase();
    
    // 检查高时效性关键词
    for (const keyword of ['今天', '昨天', '最新', '实时', '股价', '汇率', '比分']) {
      if (text.includes(keyword)) {
        return 'high';
      }
    }
    
    // 检查中时效性关键词
    for (const keyword of ['本周', '本月', '近期', '新闻', '公告', '趋势']) {
      if (text.includes(keyword)) {
        return 'medium';
      }
    }
    
    return 'low';
  }

  /**
   * 计算过期时间
   */
  private calculateExpiry(sensitivity: 'high' | 'medium' | 'low'): Date | null {
    const now = new Date();
    const hours = this.config.timeSensitivity[sensitivity];
    
    if (sensitivity === 'high') {
      return new Date(now.getTime() + hours * 60 * 60 * 1000);
    } else {
      return new Date(now.getTime() + hours * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * 更新访问统计
   */
  private async updateAccessStats(id: string): Promise<void> {
    await this.client
      .from('knowledge_entries')
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: this.client.rpc('increment_access_count', { entry_id: id }),
      })
      .eq('id', id);
  }

  /**
   * 降级搜索（当向量搜索不可用时）
   */
  private async fallbackSearch(
    query: string,
    limit: number
  ): Promise<Array<{ entry: KnowledgeEntry; similarity: number }>> {
    const { entries } = await this.search({ query, limit });
    
    return entries.map(entry => ({
      entry,
      similarity: 0.5, // 默认相似度
    }));
  }

  /**
   * 数据库记录转知识条目
   */
  private recordToEntry(record: KnowledgeEntryRecord): KnowledgeEntry {
    return {
      id: record.id,
      type: record.type,
      title: record.title,
      content: record.content,
      metadata: {
        source: record.source,
        confidence: record.confidence,
        timestamp: new Date(record.created_at).getTime(),
        tags: record.tags,
        relatedEntities: record.related_entities,
        region: record.region || undefined,
        sector: record.sector || undefined,
        isPreset: record.is_preset,
      },
      embedding: record.embedding || undefined,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let storageInstance: SupabaseKnowledgeStorage | null = null;

export function getKnowledgeStorage(
  customHeaders?: Record<string, string>,
  config?: Partial<KnowledgePersistenceConfig>
): SupabaseKnowledgeStorage {
  if (!storageInstance) {
    storageInstance = new SupabaseKnowledgeStorage(customHeaders, config);
  }
  return storageInstance;
}

export function createKnowledgeStorage(
  customHeaders?: Record<string, string>,
  config?: Partial<KnowledgePersistenceConfig>
): SupabaseKnowledgeStorage {
  return new SupabaseKnowledgeStorage(customHeaders, config);
}
