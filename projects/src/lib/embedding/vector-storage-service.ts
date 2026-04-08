/**
 * 向量存储服务
 * 
 * 使用数据库原生向量列（pgvector）存储向量，支持高效的语义搜索
 * 
 * 存储策略：
 * - knowledge_docs.embedding: 文档向量（原生vector列）
 * - kg_entities.embedding: 实体向量（原生vector列）
 * - case_embeddings.embedding: 案例向量（JSONB存储）
 * 
 * 数据库函数：
 * - search_knowledge_docs(): 文档向量搜索
 * - search_kg_entities(): 实体向量搜索
 * - update_knowledge_doc_embedding(): 更新文档向量
 * - update_entity_embedding(): 更新实体向量
 */

import { EmbeddingClient } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== 类型定义 ====================

interface SearchResult {
  id: string;
  similarity: number;
  text: string;
  metadata: Record<string, unknown>;
}

interface VectorSearchResult {
  id: string;
  similarity: number;
  title?: string;
  content?: string;
  text?: string;
  name?: string;
  type?: string;
  description?: string;
  importance?: number;
  file_type?: string;
  metadata?: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

// ==================== 向量存储服务 ====================

/**
 * 向量存储服务
 * 使用数据库原生向量列进行存储和搜索
 */
export class VectorStorageService {
  private embeddingClient: EmbeddingClient;
  private embeddingModel = 'doubao-embedding-vision-251215';
  private embeddingDimensions = 2048;

  constructor() {
    this.embeddingClient = new EmbeddingClient();
  }

  private getSupabase() {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }

  /**
   * 将向量数组转换为PostgreSQL向量格式字符串
   */
  private vectorToString(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }

  /**
   * 计算余弦相似度（应用层备用）
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dotProduct / norm;
  }

  // ==================== 知识库文档操作 ====================

  /**
   * 为文档生成并存储向量（使用数据库原生向量列）
   */
  async indexDocument(docId: string, content: string): Promise<boolean> {
    const supabase = this.getSupabase();
    if (!supabase) return false;

    try {
      // 生成向量
      const embedding = await this.embeddingClient.embedText(content.slice(0, 8000));
      
      // 使用数据库函数更新向量
      const { error } = await supabase.rpc('update_knowledge_doc_embedding', {
        doc_id: docId,
        new_embedding: embedding,
        model_name: this.embeddingModel,
      });

      if (error) {
        console.error('[VectorStorage] Failed to update document embedding:', error);
        // 回退到直接更新
        const { error: directError } = await supabase
          .from('knowledge_docs')
          .update({
            embedding: embedding,
            embedding_model: this.embeddingModel,
            embedding_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', docId);
        
        if (directError) {
          console.error('[VectorStorage] Direct update also failed:', directError);
          return false;
        }
      }

      console.log(`[VectorStorage] Document ${docId} indexed successfully`);
      return true;
    } catch (error) {
      console.error('[VectorStorage] Index document error:', error);
      return false;
    }
  }

  /**
   * 搜索相似文档（使用数据库向量搜索函数）
   */
  async searchDocuments(
    queryText: string,
    options?: {
      limit?: number;
      threshold?: number;
      fileType?: string;
    }
  ): Promise<SearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 10;
    const threshold = options?.threshold || 0.5;

    try {
      // 生成查询向量
      const queryVector = await this.embeddingClient.embedText(queryText);

      // 使用数据库向量搜索函数
      const { data, error } = await supabase.rpc('search_knowledge_docs', {
        query_embedding: queryVector,
        match_threshold: threshold,
        match_count: limit,
        filter_file_type: options?.fileType || null,
      });

      if (error) {
        console.error('[VectorStorage] Vector search failed, falling back:', error);
        // 回退到应用层搜索
        return this.searchDocumentsFallback(queryVector, options);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // 转换结果格式
      return data.map((item: VectorSearchResult) => ({
        id: item.id,
        similarity: item.similarity,
        text: item.content || item.title || '',
        metadata: {
          title: item.title,
          fileType: item.file_type,
          ...(item.metadata || {}),
        },
      }));
    } catch (error) {
      console.error('[VectorStorage] Search documents error:', error);
      return [];
    }
  }

  /**
   * 应用层文档搜索回退
   */
  private async searchDocumentsFallback(
    queryVector: number[],
    options?: { limit?: number; threshold?: number; fileType?: string; }
  ): Promise<SearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 10;
    const threshold = options?.threshold || 0.5;

    // 获取所有文档
    let queryBuilder = supabase
      .from('knowledge_docs')
      .select('id, title, content, metadata, file_type, embedding')
      .not('embedding', 'is', null);

    if (options?.fileType) {
      queryBuilder = queryBuilder.eq('file_type', options.fileType);
    }

    const { data: docs, error } = await queryBuilder.limit(500);

    if (error || !docs) {
      return [];
    }

    // 应用层计算相似度
    const results: SearchResult[] = [];
    
    for (const doc of docs) {
      const docVector = doc.embedding;
      if (!docVector || !Array.isArray(docVector)) continue;
      
      const similarity = this.cosineSimilarity(queryVector, docVector);
      
      if (similarity >= threshold) {
        results.push({
          id: doc.id,
          similarity,
          text: doc.content || doc.title,
          metadata: { title: doc.title, fileType: doc.file_type },
        });
      }
    }
    
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // ==================== 知识图谱实体操作 ====================

  /**
   * 为实体生成并存储向量（使用数据库原生向量列）
   */
  async indexEntity(entityId: string, name: string, description?: string): Promise<boolean> {
    const supabase = this.getSupabase();
    if (!supabase) return false;

    try {
      // 生成向量（名称 + 描述）
      const text = description ? `${name}: ${description}` : name;
      const embedding = await this.embeddingClient.embedText(text.slice(0, 2000));

      // 使用数据库函数更新向量
      const { error } = await supabase.rpc('update_entity_embedding', {
        entity_id: entityId,
        new_embedding: embedding,
        model_name: this.embeddingModel,
      });

      if (error) {
        console.error('[VectorStorage] Failed to update entity embedding:', error);
        // 回退到直接更新
        const { error: directError } = await supabase
          .from('kg_entities')
          .update({
            embedding: embedding,
            embedding_model: this.embeddingModel,
            embedding_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', entityId);
        
        if (directError) {
          console.error('[VectorStorage] Direct update also failed:', directError);
          return false;
        }
      }

      console.log(`[VectorStorage] Entity ${entityId} indexed successfully`);
      return true;
    } catch (error) {
      console.error('[VectorStorage] Index entity error:', error);
      return false;
    }
  }

  /**
   * 搜索相似实体（使用数据库向量搜索函数）
   */
  async searchEntities(
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
      entityType?: string;
    }
  ): Promise<SearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 20;
    const threshold = options?.threshold || 0.3;

    try {
      // 生成查询向量
      const queryVector = await this.embeddingClient.embedText(query);

      // 使用数据库向量搜索函数
      const { data, error } = await supabase.rpc('search_kg_entities', {
        query_embedding: queryVector,
        match_threshold: threshold,
        match_count: limit,
        filter_entity_type: options?.entityType || null,
      });

      if (error) {
        console.error('[VectorStorage] Entity vector search failed, falling back:', error);
        return this.searchEntitiesFallback(queryVector, options);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // 转换结果格式
      return data.map((item: VectorSearchResult) => ({
        id: item.id,
        similarity: item.similarity,
        text: item.name || '',
        metadata: {
          type: item.type,
          description: item.description,
          importance: item.importance,
          ...(item.properties || {}),
        },
      }));
    } catch (error) {
      console.error('[VectorStorage] Search entities error:', error);
      return [];
    }
  }

  /**
   * 应用层实体搜索回退
   */
  private async searchEntitiesFallback(
    queryVector: number[],
    options?: { limit?: number; threshold?: number; entityType?: string; }
  ): Promise<SearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 20;
    const threshold = options?.threshold || 0.3;

    let queryBuilder = supabase
      .from('kg_entities')
      .select('id, name, type, description, properties, importance, embedding')
      .not('embedding', 'is', null);

    if (options?.entityType) {
      queryBuilder = queryBuilder.eq('type', options.entityType);
    }

    const { data: entities, error } = await queryBuilder.limit(500);

    if (error || !entities) {
      return [];
    }

    const results: SearchResult[] = [];
    
    for (const entity of entities) {
      const entityVector = entity.embedding;
      if (!entityVector || !Array.isArray(entityVector)) continue;
      
      const similarity = this.cosineSimilarity(queryVector, entityVector);
      
      if (similarity >= threshold) {
        results.push({
          id: entity.id,
          similarity,
          text: entity.name,
          metadata: {
            type: entity.type,
            description: entity.description,
            importance: entity.importance,
          },
        });
      }
    }
    
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // ==================== 案例库操作 ====================

  /**
   * 为案例生成并存储向量
   */
  async indexCase(caseId: string, query: string, conclusion?: string): Promise<boolean> {
    const supabase = this.getSupabase();
    if (!supabase) return false;

    try {
      // 生成查询向量
      const queryEmbedding = await this.embeddingClient.embedText(query.slice(0, 2000));

      // 存储到 case_embeddings 表
      const { error } = await supabase
        .from('case_embeddings')
        .upsert({
          id: `emb_${caseId}_query`,
          case_id: caseId,
          embedding_type: 'query',
          embedding: { vector: queryEmbedding, dimensions: this.embeddingDimensions },
          model: this.embeddingModel,
          text_preview: query.slice(0, 200),
        });

      if (error) {
        console.error('[VectorStorage] Failed to index case:', error);
        return false;
      }

      // 如果有结论，也生成向量
      if (conclusion && conclusion.length > 50) {
        const conclusionEmbedding = await this.embeddingClient.embedText(conclusion.slice(0, 2000));
        
        await supabase
          .from('case_embeddings')
          .upsert({
            id: `emb_${caseId}_conclusion`,
            case_id: caseId,
            embedding_type: 'conclusion',
            embedding: { vector: conclusionEmbedding, dimensions: this.embeddingDimensions },
            model: this.embeddingModel,
            text_preview: conclusion.slice(0, 200),
          });
      }

      return true;
    } catch (error) {
      console.error('[VectorStorage] Index case error:', error);
      return false;
    }
  }

  /**
   * 搜索相似案例（使用数据库向量搜索函数）
   */
  async searchCases(
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
    }
  ): Promise<SearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 5;
    const threshold = options?.threshold || 0.3;

    try {
      // 生成查询向量
      const queryVector = await this.embeddingClient.embedText(query);

      // 尝试使用数据库函数
      const { data, error } = await supabase.rpc('search_analysis_cases', {
        query_embedding: queryVector,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        console.error('[VectorStorage] Case search RPC failed:', error);
        return this.searchCasesFallback(queryVector, options);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((item: { id: string; query: string; similarity: number; conclusion?: unknown; confidence?: number; }) => ({
        id: item.id,
        similarity: item.similarity,
        text: item.query,
        metadata: {
          conclusion: item.conclusion,
          confidence: item.confidence,
        },
      }));
    } catch (error) {
      console.error('[VectorStorage] Search cases error:', error);
      return [];
    }
  }

  /**
   * 应用层案例搜索回退
   */
  private async searchCasesFallback(
    queryVector: number[],
    options?: { limit?: number; threshold?: number; }
  ): Promise<SearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 5;
    const threshold = options?.threshold || 0.3;

    const { data: embeddings, error } = await supabase
      .from('case_embeddings')
      .select('case_id, embedding, text_preview')
      .eq('embedding_type', 'query');

    if (error || !embeddings) {
      return [];
    }

    const results: SearchResult[] = [];
    
    for (const emb of embeddings) {
      const caseVector = emb.embedding?.vector;
      if (!caseVector || !Array.isArray(caseVector)) continue;
      
      const similarity = this.cosineSimilarity(queryVector, caseVector);
      
      if (similarity >= threshold) {
        results.push({
          id: emb.case_id,
          similarity,
          text: emb.text_preview || '',
          metadata: { embeddingType: 'query' },
        });
      }
    }
    
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // ==================== 批量操作 ====================

  /**
   * 批量为未索引文档生成向量
   */
  async batchIndexDocuments(batchSize: number = 10): Promise<{ processed: number; success: number; failed: number }> {
    const supabase = this.getSupabase();
    if (!supabase) return { processed: 0, success: 0, failed: 0 };

    // 查询未索引文档（embedding列为null的）
    const { data: docs, error } = await supabase
      .from('knowledge_docs')
      .select('id, content, title')
      .is('embedding', null)
      .not('content', 'is', null)
      .limit(batchSize);

    if (error || !docs || docs.length === 0) {
      return { processed: 0, success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const doc of docs) {
      const result = await this.indexDocument(doc.id, doc.content || doc.title);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { processed: docs.length, success, failed };
  }

  /**
   * 批量为未索引实体生成向量
   */
  async batchIndexEntities(batchSize: number = 20): Promise<{ processed: number; success: number; failed: number }> {
    const supabase = this.getSupabase();
    if (!supabase) return { processed: 0, success: 0, failed: 0 };

    // 查询未索引实体
    const { data: entities, error } = await supabase
      .from('kg_entities')
      .select('id, name, description')
      .is('embedding', null)
      .limit(batchSize);

    if (error || !entities || entities.length === 0) {
      return { processed: 0, success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const entity of entities) {
      const result = await this.indexEntity(entity.id, entity.name, entity.description);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { processed: entities.length, success, failed };
  }

  /**
   * 获取向量索引统计
   */
  async getStats(): Promise<{
    knowledgeDocs: { total: number; embedded: number; percentage: number };
    kgEntities: { total: number; embedded: number; percentage: number };
  }> {
    const supabase = this.getSupabase();
    
    const defaultStats = {
      knowledgeDocs: { total: 0, embedded: 0, percentage: 0 },
      kgEntities: { total: 0, embedded: 0, percentage: 0 },
    };

    if (!supabase) return defaultStats;

    try {
      const { data, error } = await supabase.from('embedding_stats').select('*');
      
      if (error || !data) {
        return defaultStats;
      }

      const stats = defaultStats;
      
      for (const row of data) {
        if (row.table_name === 'knowledge_docs') {
          stats.knowledgeDocs = {
            total: Number(row.total_records) || 0,
            embedded: Number(row.embedded_records) || 0,
            percentage: Number(row.embedding_percentage) || 0,
          };
        } else if (row.table_name === 'kg_entities') {
          stats.kgEntities = {
            total: Number(row.total_records) || 0,
            embedded: Number(row.embedded_records) || 0,
            percentage: Number(row.embedding_percentage) || 0,
          };
        }
      }

      return stats;
    } catch {
      return defaultStats;
    }
  }
}

// 导出单例
export const vectorStorageService = new VectorStorageService();
