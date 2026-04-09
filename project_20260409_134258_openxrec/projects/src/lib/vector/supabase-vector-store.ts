/**
 * 基于 Supabase 的向量存储服务
 * 
 * 功能：
 * - 使用 case_embeddings 表存储向量嵌入
 * - 支持向量检索和相似度计算
 * - 与推荐系统和知识库深度集成
 * - 支持多种嵌入类型
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { EmbeddingClient, Config } from 'coze-coding-dev-sdk';

// ==================== 类型定义 ====================

export interface SupabaseVectorEntry {
  id: string;
  caseId: string;
  embedding_type: string;
  embedding: number[];
  model: string;
  textPreview?: string;
  createdAt: number;
}

export interface VectorSearchResult {
  entry: SupabaseVectorEntry;
  similarity: number;
  distance: number;
}

export interface VectorStoreStats {
  total: number;
  byType: Record<string, number>;
  byModel: Record<string, number>;
}

// ==================== Supabase 向量存储管理器 ====================

/**
 * Supabase 向量存储管理器
 */
export class SupabaseVectorStore {
  private supabase: ReturnType<typeof getSupabaseClient>;
  private embeddingClient: EmbeddingClient;
  private initialized: boolean = false;

  constructor() {
    this.supabase = getSupabaseClient();
    const config = new Config();
    this.embeddingClient = new EmbeddingClient(config);
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[SupabaseVectorStore] Initializing...');

    // 检查数据库连接
    const { data, error } = await this.supabase
      .from('case_embeddings')
      .select('count')
      .limit(1);

    if (error) {
      console.error('[SupabaseVectorStore] Failed to connect to database:', error);
      throw error;
    }

    this.initialized = true;
    console.log('[SupabaseVectorStore] Initialized successfully');
  }

  /**
   * 带重试机制的嵌入生成
   */
  private async generateEmbeddingWithRetry(
    text: string,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<number[] | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const embedding = await this.embeddingClient.embedText(text);
        console.log(`[SupabaseVectorStore] Embedding generated successfully on attempt ${attempt}/${maxRetries}`);
        return embedding;
      } catch (error) {
        console.error(`[SupabaseVectorStore] Embedding attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt < maxRetries) {
          // 指数退避
          const delay = delayMs * Math.pow(2, attempt - 1);
          console.log(`[SupabaseVectorStore] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('[SupabaseVectorStore] All embedding attempts failed');
          return null;
        }
      }
    }
    return null;
  }

  /**
   * 添加向量
   */
  async addEntry(entry: {
    caseId: string;
    embedding_type: string;
    content: string;
    metadata?: any;
  }): Promise<string> {
    // 生成向量嵌入（带重试）
    const embedding = await this.generateEmbeddingWithRetry(entry.content);
    
    if (!embedding) {
      throw new Error('Failed to generate embedding after multiple attempts');
    }

    // 插入到数据库
    const { data, error } = await this.supabase
      .from('case_embeddings')
      .insert({
        caseId: entry.caseId,
        embedding_type: entry.embedding_type,
        embedding: embedding,
        model: 'text-embedding-3-small',
        textPreview: entry.content.substring(0, 200)
      })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseVectorStore] Failed to add entry:', error);
      throw error;
    }

    console.log(`[SupabaseVectorStore] Added entry for case ${entry.caseId}`);
    return data.id;
  }

  /**
   * 批量添加向量
   */
  async addBatch(entries: Array<{
    caseId: string;
    embedding_type: string;
    content: string;
    metadata?: any;
  }>): Promise<string[]> {
    const ids: string[] = [];

    for (const entry of entries) {
      const id = await this.addEntry(entry);
      ids.push(id);
    }

    return ids;
  }

  /**
   * 获取向量
   */
  async getEntry(id: string): Promise<SupabaseVectorEntry | null> {
    const { data, error } = await this.supabase
      .from('case_embeddings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      caseId: data.caseId,
      embedding_type: data.embedding_type,
      embedding: data.embedding as number[],
      model: data.model,
      textPreview: data.textPreview,
      createdAt: new Date(data.createdAt).getTime()
    };
  }

  /**
   * 删除向量
   */
  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('case_embeddings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseVectorStore] Failed to delete entry:', error);
      throw error;
    }

    console.log(`[SupabaseVectorStore] Deleted entry ${id}`);
  }

  /**
   * 向量搜索
   */
  async search(
    query: string,
    options: {
      topK?: number;
      threshold?: number;
      embedding_type?: string;
      metric?: 'cosine' | 'euclidean' | 'inner_product';
    } = {}
  ): Promise<VectorSearchResult[]> {
    const {
      topK = 10,
      threshold = 0.6,
      embedding_type,
      metric = 'cosine'
    } = options;

    // 生成查询向量（带重试）
    const queryVector = await this.generateEmbeddingWithRetry(query);
    
    if (!queryVector) {
      console.warn('[SupabaseVectorStore] Failed to generate query embedding, returning empty results');
      return [];
    }

    // 获取所有向量
    let queryBuilder = this.supabase
      .from('case_embeddings')
      .select('*');

    if (embedding_type) {
      queryBuilder = queryBuilder.eq('embedding_type', embedding_type);
    }

    const { data: embeddings, error } = await queryBuilder
      .limit(topK * 3);

    if (error || !embeddings) {
      console.error('[SupabaseVectorStore] Failed to fetch embeddings:', error);
      return [];
    }

    // 计算相似度
    const results: VectorSearchResult[] = [];

    for (const embeddingRecord of embeddings) {
      const embedding = embeddingRecord.embedding as number[];
      const similarity = this.calculateSimilarity(queryVector, embedding, metric);
      const distance = metric === 'cosine' ? 1 - similarity : similarity;

      if (similarity >= threshold) {
        results.push({
          entry: {
            id: embeddingRecord.id,
            caseId: embeddingRecord.caseId,
            embedding_type: embeddingRecord.embedding_type,
            embedding: embedding,
            model: embeddingRecord.model,
            textPreview: embeddingRecord.textPreview,
            createdAt: new Date(embeddingRecord.createdAt).getTime()
          },
          similarity,
          distance
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  /**
   * 计算相似度
   */
  private calculateSimilarity(
    vec1: number[],
    vec2: number[],
    metric: 'cosine' | 'euclidean' | 'inner_product'
  ): number {
    if (vec1.length !== vec2.length) return 0;

    switch (metric) {
      case 'cosine':
        return this.cosineSimilarity(vec1, vec2);
      case 'euclidean':
        return 1 / (1 + this.euclideanDistance(vec1, vec2));
      case 'inner_product':
        return this.dotProduct(vec1, vec2);
      default:
        return this.cosineSimilarity(vec1, vec2);
    }
  }

  /**
   * 计算点积
   */
  private dotProduct(vec1: number[], vec2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += vec1[i] * vec2[i];
    }
    return sum;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * 计算欧氏距离
   */
  private euclideanDistance(vec1: number[], vec2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * 按类型获取向量
   */
  async getEntriesByType(
    embedding_type: string,
    limit: number = 100
  ): Promise<SupabaseVectorEntry[]> {
    const { data, error } = await this.supabase
      .from('case_embeddings')
      .select('*')
      .eq('embedding_type', embedding_type)
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      id: item.id,
      caseId: item.caseId,
      embedding_type: item.embedding_type,
      embedding: item.embedding as number[],
      model: item.model,
      textPreview: item.textPreview,
      createdAt: new Date(item.createdAt).getTime()
    }));
  }

  /**
   * 按案例 ID 获取向量
   */
  async getEntriesByCaseId(caseId: string): Promise<SupabaseVectorEntry[]> {
    const { data, error } = await this.supabase
      .from('case_embeddings')
      .select('*')
      .eq('caseId', caseId);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      id: item.id,
      caseId: item.caseId,
      embedding_type: item.embedding_type,
      embedding: item.embedding as number[],
      model: item.model,
      textPreview: item.textPreview,
      createdAt: new Date(item.createdAt).getTime()
    }));
  }

  /**
   * 删除案例的所有向量
   */
  async deleteByCaseId(caseId: string): Promise<void> {
    const { error } = await this.supabase
      .from('case_embeddings')
      .delete()
      .eq('caseId', caseId);

    if (error) {
      console.error('[SupabaseVectorStore] Failed to delete by caseId:', error);
      throw error;
    }

    console.log(`[SupabaseVectorStore] Deleted all entries for case ${caseId}`);
  }

  /**
   * 更新向量
   */
  async updateEntry(
    id: string,
    updates: {
      content?: string;
      embedding_type?: string;
    }
  ): Promise<void> {
    const updateData: any = {};

    if (updates.embedding_type) {
      updateData.embedding_type = updates.embedding_type;
    }

    if (updates.content) {
      // 重新生成向量
      try {
        const embedding = await this.embeddingClient.embedText(updates.content);
        updateData.embedding = embedding;
        updateData.textPreview = updates.content.substring(0, 200);
      } catch (error) {
        console.error('[SupabaseVectorStore] Failed to regenerate embedding:', error);
        throw error;
      }
    }

    const { error } = await this.supabase
      .from('case_embeddings')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('[SupabaseVectorStore] Failed to update entry:', error);
      throw error;
    }

    console.log(`[SupabaseVectorStore] Updated entry ${id}`);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<VectorStoreStats> {
    const { data, error } = await this.supabase
      .from('case_embeddings')
      .select('*');

    if (error || !data) {
      return { total: 0, byType: {}, byModel: {} };
    }

    const byType: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const item of data) {
      byType[item.embedding_type] = (byType[item.embedding_type] || 0) + 1;
      byModel[item.model] = (byModel[item.model] || 0) + 1;
    }

    return {
      total: data.length,
      byType,
      byModel
    };
  }

  /**
   * 获取所有嵌入类型
   */
  async getEmbeddingTypes(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('case_embeddings')
      .select('embedding_type');

    if (error || !data) {
      return [];
    }

    const types = [...new Set(data.map(item => item.embedding_type))];
    return types;
  }

  /**
   * 导出所有向量数据
   */
  async exportData(options: {
    embedding_type?: string;
    limit?: number;
    includeEmbeddings?: boolean;
  } = {}): Promise<{
    entries: SupabaseVectorEntry[];
    metadata: {
      exportDate: string;
      totalEntries: number;
      embedding_types: string[];
    };
  }> {
    let query = this.supabase
      .from('case_embeddings')
      .select('*');

    if (options.embedding_type) {
      query = query.eq('embedding_type', options.embedding_type);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(10000); // 默认最大导出数量
    }

    const { data, error } = await query;

    if (error || !data) {
      throw new Error(`导出失败: ${error?.message}`);
    }

    const entries: SupabaseVectorEntry[] = data.map(item => ({
      id: item.id,
      caseId: item.caseId,
      embedding_type: item.embedding_type,
      embedding: options.includeEmbeddings !== false ? (item.embedding as number[]) : [],
      model: item.model,
      textPreview: item.textPreview,
      createdAt: new Date(item.createdAt).getTime()
    }));

    const embedding_types = [...new Set(data.map(item => item.embedding_type))];

    return {
      entries,
      metadata: {
        exportDate: new Date().toISOString(),
        totalEntries: entries.length,
        embedding_types
      }
    };
  }

  /**
   * 导入向量数据
   */
  async importData(data: {
    entries: SupabaseVectorEntry[];
    metadata?: any;
  }, options: {
    skipExisting?: boolean;
    updateExisting?: boolean;
    batchSize?: number;
  } = {}): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const {
      skipExisting = true,
      updateExisting = false,
      batchSize = 100
    } = options;

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // 分批处理
    for (let i = 0; i < data.entries.length; i += batchSize) {
      const batch = data.entries.slice(i, i + batchSize);

      for (const entry of batch) {
        try {
          // 检查是否已存在
          if (skipExisting || updateExisting) {
            const { data: existing } = await this.supabase
              .from('case_embeddings')
              .select('id')
              .eq('id', entry.id)
              .single();

            if (existing) {
              if (skipExisting) {
                continue;
              }
              if (updateExisting) {
                await this.updateEntry(entry.id, {
                  content: entry.textPreview || '',
                  embedding_type: entry.embedding_type
                });
                success++;
                continue;
              }
            }
          }

          // 插入新记录
          const { error: insertError } = await this.supabase
            .from('case_embeddings')
            .insert({
              id: entry.id,
              caseId: entry.caseId,
              embedding_type: entry.embedding_type,
              embedding: entry.embedding.length > 0 ? entry.embedding : null,
              model: entry.model,
              textPreview: entry.textPreview
            });

          if (insertError) {
            errors.push(`导入 ${entry.caseId} 失败: ${insertError.message}`);
            failed++;
          } else {
            success++;
          }
        } catch (error: any) {
          errors.push(`处理 ${entry.caseId} 时出错: ${error.message}`);
          failed++;
        }
      }
    }

    console.log(`[SupabaseVectorStore] 导入完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed, errors };
  }

  /**
   * 优化向量搜索使用 pgvector（使用数据库层面的向量计算）
   */
  async searchWithPgvector(
    query: string,
    options: {
      topK?: number;
      threshold?: number;
      embedding_type?: string;
      metric?: 'cosine' | 'euclidean' | 'inner_product';
      efSearch?: number; // HNSW 索引的 ef_search 参数
    } = {}
  ): Promise<VectorSearchResult[]> {
    const {
      topK = 10,
      threshold = 0.6,
      embedding_type,
      metric = 'cosine',
      efSearch = 40
    } = options;

    // 生成查询向量（带重试）
    const queryVector = await this.generateEmbeddingWithRetry(query);
    
    if (!queryVector) {
      console.warn('[SupabaseVectorStore] Failed to generate query embedding for pgvector search, returning empty results');
      return [];
    }

    // 将向量转换为 pgvector 格式
    const vectorString = `[${queryVector.join(',')}]`;

    // 根据度量标准选择距离函数
    let distanceFunction: string;
    let similarityCalculation: string;

    switch (metric) {
      case 'cosine':
        distanceFunction = `<=>`;
        similarityCalculation = '1 - distance';
        break;
      case 'euclidean':
        distanceFunction = `<->`;
        similarityCalculation = '1 / (1 + distance)';
        break;
      case 'inner_product':
        distanceFunction = `<#>`;
        similarityCalculation = 'distance';
        break;
      default:
        distanceFunction = `<=>`;
        similarityCalculation = '1 - distance';
    }

    // 构建查询（使用 pgvector 函数）
    let queryBuilder = this.supabase.rpc('search_embeddings_with_pgvector', {
      query_vector: vectorString,
      match_threshold: threshold,
      result_count: topK,
      embedding_type_filter: embedding_type,
      distance_function: distanceFunction
    });

    try {
      const { data, error } = await queryBuilder;

      if (error) {
        console.error('[SupabaseVectorStore] pgvector search failed:', error);
        // 降级到应用层计算
        return await this.search(query, options);
      }

      if (!data) return [];

      return data.map((item: any) => ({
        entry: {
          id: item.id,
          caseId: item.caseId,
          embedding_type: item.embedding_type,
          embedding: item.embedding as number[],
          model: item.model,
          textPreview: item.textPreview,
          createdAt: new Date(item.createdAt).getTime()
        },
        similarity: item.similarity || (eval(similarityCalculation.replace('distance', item.distance))),
        distance: item.distance
      }));
    } catch (error) {
      console.error('[SupabaseVectorStore] pgvector RPC failed:', error);
      // 降级到应用层计算
      return await this.search(query, options);
    }
  }

  /**
   * 批量添加向量（优化版本，支持批量插入）
   */
  async addBatchOptimized(entries: Array<{
    caseId: string;
    embedding_type: string;
    content: string;
    metadata?: any;
  }>): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // 分批处理（每批 50 个）
    const batchSize = 50;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      try {
        // 批量生成向量
        const insertData = [];
        for (const entry of batch) {
          const embedding = await this.embeddingClient.embedText(entry.content);
          insertData.push({
            caseId: entry.caseId,
            embedding_type: entry.embedding_type,
            embedding: embedding,
            model: 'text-embedding-3-small',
            textPreview: entry.content.substring(0, 200)
          });
        }

        // 批量插入
        const { error } = await this.supabase
          .from('case_embeddings')
          .insert(insertData);

        if (error) {
          console.error('[SupabaseVectorStore] Batch insert failed:', error);
          failed += batch.length;
        } else {
          success += batch.length;
        }
      } catch (error) {
        console.error('[SupabaseVectorStore] Batch processing failed:', error);
        failed += batch.length;
      }
    }

    console.log(`[SupabaseVectorStore] Batch add: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * 清空所有向量数据
   */
  async clearAll(options: {
    embedding_type?: string;
    confirm?: boolean;
  } = {}): Promise<number> {
    if (!options.confirm) {
      throw new Error('需要确认才能清空数据（设置 confirm: true）');
    }

    let query = this.supabase.from('case_embeddings').delete();

    if (options.embedding_type) {
      query = query.eq('embedding_type', options.embedding_type);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`清空失败: ${error.message}`);
    }

    const stats = await this.getStats();
    const deleted = options.embedding_type
      ? (stats.byType[options.embedding_type] || 0)
      : stats.total;

    console.log(`[SupabaseVectorStore] Cleared ${deleted} entries`);
    return deleted;
  }
}

// ==================== 单例导出 ====================

let supabaseVectorStoreInstance: SupabaseVectorStore | null = null;

export function getSupabaseVectorStore(): SupabaseVectorStore {
  if (!supabaseVectorStoreInstance) {
    supabaseVectorStoreInstance = new SupabaseVectorStore();
  }
  return supabaseVectorStoreInstance;
}
