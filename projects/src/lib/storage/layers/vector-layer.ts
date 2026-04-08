/**
 * 向量库层实现（语义索引层）
 * 
 * 职责：
 * - 语义检索：相似内容检索
 * - 聚类分析：内容自动分类
 * - 去重检测：相似内容检测
 * - 推荐召回：候选集召回
 * 
 * 特点：
 * - 不存储原始内容，仅存储向量+ID引用
 * - 高性能近似最近邻(ANN)检索
 * - 支持多模态（文本、图像、视频）
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import {
  IVectorLayer,
  StorageResult,
  BatchStorageResult,
  VectorIndexRecord,
  VectorSearchResult,
  VectorSearchOptions,
  VectorIndexStats,
} from '../types';

/**
 * 向量库层实现类
 */
export class VectorLayer implements IVectorLayer {
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
    const { error } = await this.client.from('case_embeddings').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('[VectorLayer] Connection check failed:', error);
    }

    this.initialized = true;
    console.log('[VectorLayer] Initialized');
  }

  // ============================================================================
  // 索引管理
  // ============================================================================

  /**
   * 索引单个向量
   */
  async indexVector(
    record: Omit<VectorIndexRecord, 'id' | 'createdAt'>
  ): Promise<StorageResult<VectorIndexRecord>> {
    const startTime = Date.now();

    try {
      const id = `vec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 根据来源类型选择存储表
      if (record.sourceType === 'case' || record.sourceType === 'query') {
        // 存储到 case_embeddings 表
        const { error } = await this.client.from('case_embeddings').insert({
          id,
          case_id: record.sourceId,
          embedding_type: record.sourceType,
          embedding: record.vector,
          model: record.model,
          text_preview: record.textPreview?.substring(0, 500),
          created_at: new Date().toISOString(),
        });

        if (error) {
          return { success: false, error: error.message };
        }
      } else if (record.sourceType === 'knowledge' || record.sourceType === 'entity') {
        // 存储到 knowledge_entries 表的 embedding 字段
        const { error } = await this.client
          .from('knowledge_entries')
          .update({ embedding: record.vector })
          .eq('id', record.sourceId);

        if (error) {
          console.warn('[VectorLayer] Failed to update knowledge embedding:', error);
        }
      }

      return {
        success: true,
        data: {
          id,
          ...record,
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
   * 批量索引向量
   */
  async batchIndex(
    records: Array<Omit<VectorIndexRecord, 'id' | 'createdAt'>>
  ): Promise<BatchStorageResult<VectorIndexRecord>> {
    const startTime = Date.now();
    const results: VectorIndexRecord[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const result = await this.indexVector(records[i]);
      if (result.success && result.data) {
        results.push(result.data);
      } else {
        errors.push({ index: i, error: result.error || 'Unknown error' });
      }
    }

    return {
      success: errors.length === 0,
      total: records.length,
      succeeded: results.length,
      failed: errors.length,
      data: results,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 删除向量
   */
  async deleteVector(id: string): Promise<StorageResult<void>> {
    const startTime = Date.now();

    try {
      // 尝试从 case_embeddings 删除
      const { error: caseError } = await this.client
        .from('case_embeddings')
        .delete()
        .eq('id', id);

      if (!caseError) {
        return { success: true, duration: Date.now() - startTime };
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
   * 根据来源删除向量
   */
  async deleteBySource(sourceType: string, sourceId: string): Promise<StorageResult<void>> {
    const startTime = Date.now();

    try {
      if (sourceType === 'case' || sourceType === 'query') {
        await this.client.from('case_embeddings').delete().eq('case_id', sourceId);
      } else if (sourceType === 'knowledge' || sourceType === 'entity') {
        await this.client
          .from('knowledge_entries')
          .update({ embedding: null })
          .eq('id', sourceId);
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
  // 搜索
  // ============================================================================

  /**
   * 向量搜索
   */
  async search(
    vector: number[],
    options?: VectorSearchOptions
  ): Promise<StorageResult<VectorSearchResult[]>> {
    const startTime = Date.now();
    const topK = options?.topK || 10;
    const minSimilarity = options?.minSimilarity || 0.5;
    const sourceTypes = options?.sourceTypes || ['entity', 'case', 'knowledge'];

    try {
      const results: VectorSearchResult[] = [];

      // 搜索知识库向量
      if (sourceTypes.includes('knowledge') || sourceTypes.includes('entity')) {
        const knowledgeResults = await this.searchKnowledgeVectors(vector, topK, minSimilarity);
        results.push(...knowledgeResults);
      }

      // 搜索案例向量
      if (sourceTypes.includes('case') || sourceTypes.includes('query')) {
        const caseResults = await this.searchCaseVectors(vector, topK, minSimilarity);
        results.push(...caseResults);
      }

      // 按相似度排序并截取
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK);

      return {
        success: true,
        data: topResults,
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
   * 搜索知识库向量
   */
  private async searchKnowledgeVectors(
    vector: number[],
    topK: number,
    minSimilarity: number
  ): Promise<VectorSearchResult[]> {
    try {
      // 使用 pgvector 的余弦相似度搜索
      const { data, error } = await this.client.rpc('search_knowledge_by_vector', {
        query_embedding: vector,
        match_limit: topK,
        match_threshold: minSimilarity,
      });

      if (error) {
        console.warn('[VectorLayer] Knowledge vector search failed:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        record: {
          id: item.id,
          vector: item.embedding,
          sourceType: 'knowledge' as const,
          sourceId: item.id,
          model: 'doubao-embedding-vision-251215',
          dimension: vector.length,
          textPreview: item.content?.substring(0, 200),
          metadata: {
            title: item.title,
            type: item.type,
            confidence: item.confidence,
          },
          createdAt: new Date(item.created_at).getTime(),
        },
        similarity: item.similarity || 0,
        distance: 1 - (item.similarity || 0),
      }));
    } catch (e) {
      console.warn('[VectorLayer] Knowledge vector search error:', e);
      return [];
    }
  }

  /**
   * 搜索案例向量
   */
  private async searchCaseVectors(
    vector: number[],
    topK: number,
    minSimilarity: number
  ): Promise<VectorSearchResult[]> {
    try {
      const { data, error } = await this.client.rpc('search_case_by_vector', {
        query_embedding: vector,
        match_limit: topK,
        match_threshold: minSimilarity,
      });

      if (error) {
        console.warn('[VectorLayer] Case vector search failed:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        record: {
          id: item.id,
          vector: item.embedding,
          sourceType: 'case' as const,
          sourceId: item.case_id,
          model: item.model || 'doubao-embedding-vision-251215',
          dimension: vector.length,
          textPreview: item.text_preview,
          metadata: {
            embeddingType: item.embedding_type,
          },
          createdAt: new Date(item.created_at).getTime(),
        },
        similarity: item.similarity || 0,
        distance: 1 - (item.similarity || 0),
      }));
    } catch (e) {
      console.warn('[VectorLayer] Case vector search error:', e);
      return [];
    }
  }

  // ============================================================================
  // 统计
  // ============================================================================

  /**
   * 获取向量索引统计
   */
  async getStats(): Promise<StorageResult<VectorIndexStats>> {
    const startTime = Date.now();

    try {
      // 获取案例嵌入统计
      const { data: caseData, error: caseError } = await this.client
        .from('case_embeddings')
        .select('embedding_type, model');

      // 获取知识嵌入统计
      const { data: knowledgeData, error: knowledgeError } = await this.client
        .from('knowledge_entries')
        .select('id')
        .not('embedding', 'is', null);

      const bySource: Record<string, number> = {
        case: caseData?.length || 0,
        knowledge: knowledgeData?.length || 0,
        entity: 0,
        query: caseData?.filter((d: any) => d.embedding_type === 'query').length || 0,
      };

      const byModel: Record<string, number> = {};
      (caseData || []).forEach((item: any) => {
        const model = item.model || 'unknown';
        byModel[model] = (byModel[model] || 0) + 1;
      });

      return {
        success: true,
        data: {
          total: bySource.case + bySource.knowledge,
          bySource,
          byModel,
          avgDimension: 1024, // 假设使用 doubao-embedding-vision-251215
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
  // 辅助方法
  // ============================================================================

  /**
   * 生成文本的向量嵌入
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      return await this.embeddingClient.embedText(text);
    } catch (e) {
      console.error('[VectorLayer] Failed to generate embedding:', e);
      return null;
    }
  }

  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 批量计算相似度
   */
  batchSimilarity(queryVector: number[], vectors: number[][]): number[] {
    return vectors.map((v) => this.cosineSimilarity(queryVector, v));
  }
}

// 导出单例
let vectorLayerInstance: VectorLayer | null = null;

export function getVectorLayer(): VectorLayer {
  if (!vectorLayerInstance) {
    vectorLayerInstance = new VectorLayer();
  }
  return vectorLayerInstance;
}
