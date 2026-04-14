/**
 * 向量嵌入服务
 * 提供文本向量化、语义搜索、相似度计算等功能
 * 
 * v2.0 重构：
 * - 使用 pgvector 实现真正的向量搜索
 * - 支持知识库文档、知识图谱实体、案例库的语义搜索
 * - 自动索引功能
 */

import { Config, EmbeddingClient } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== 类型定义 ====================

interface KnowledgeDoc {
  id: string;
  title: string;
  content?: string;
  metadata?: Record<string, unknown>;
  file_type?: string;
  file_url?: string;
}

interface AnalysisCase {
  id: string;
  query: string;
  conclusion?: unknown;
  confidence?: string;
  analyzed_at: string;
}

interface KGEntityRow {
  id: string;
  name: string;
  type: string;
  importance: string;
  description?: string;
  properties?: Record<string, unknown>;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  fileType?: string;
}

interface CaseSearchResult {
  id: string;
  topic: string;
  similarity: number;
  conclusion?: unknown;
  confidence?: string;
  createdAt: string;
}

interface EntitySearchResult {
  id: string;
  name: string;
  type: string;
  importance: string;
  similarity: number;
  description?: string;
  properties?: Record<string, unknown>;
}

interface VectorSearchResult {
  id: string;
  title: string;
  content: string;
  file_type: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

interface EntityVectorSearchResult {
  id: string;
  name: string;
  type: string;
  description: string;
  importance: string;
  similarity: number;
  properties: Record<string, unknown>;
}

interface CaseVectorSearchResult {
  id: string;
  query: string;
  conclusion: unknown;
  confidence: string;
  analyzed_at: string;
  similarity: number;
}

interface EmbeddingStats {
  knowledgeDocs: {
    total: number;
    embedded: number;
    percentage: number;
  };
  kgEntities: {
    total: number;
    embedded: number;
    percentage: number;
  };
}

// ==================== 向量嵌入服务类 ====================

/**
 * 向量嵌入服务类
 */
export class EmbeddingService {
  private cozeClient: EmbeddingClient | null = null;
  private dashScopeApiKey =
    process.env.EmbeddingService_API_KEY?.trim() || process.env.EMBEDDING_SERVICE_API_KEY?.trim() || '';
  private dashScopeModel =
    process.env.EMBEDDING_SERVICE_MODEL?.trim() || process.env.EmbeddingService_MODEL?.trim() || 'text-embedding-v4';
  private dashScopeBaseUrl =
    process.env.EMBEDDING_SERVICE_BASE_URL?.trim() ||
    process.env.EmbeddingService_BASE_URL?.trim() ||
    'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
  private embeddingModel = 'doubao-embedding-vision-251215';
  private embeddingDimensions = 2000;
  private cozeEmbeddingDisabled = false;
  private warnedCozeEmbeddingUnavailable = false;

  constructor() {
    this.cozeClient = new EmbeddingClient(new Config());
  }

  /**
   * 获取 Supabase 客户端
   */
  private getSupabase() {
    try {
      return getSupabaseClient();
    } catch (error) {
      console.warn('[EmbeddingService] Supabase not configured:', error);
      return null;
    }
  }

  /**
   * 获取文本嵌入向量
   */
  async embedText(text: string, dimensions?: number): Promise<number[]> {
    if (this.dashScopeApiKey) {
      return this.embedTextByDashScope(text, dimensions);
    }

    if (this.cozeEmbeddingDisabled || !this.cozeClient) {
      throw new Error('No embedding provider available');
    }

    try {
      return await this.cozeClient.embedText(text, dimensions ? { dimensions } : undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      if (message.toLowerCase().includes('invalid url') || message.toLowerCase().includes('networkerror')) {
        this.cozeEmbeddingDisabled = true;
        if (!this.warnedCozeEmbeddingUnavailable) {
          this.warnedCozeEmbeddingUnavailable = true;
          console.warn(
            '[EmbeddingService] Coze Embedding unavailable in local runtime. Set EmbeddingService_API_KEY to use DashScope embedding.'
          );
        }
      }
      throw error;
    }
  }

  /**
   * 批量获取文本嵌入向量
   */
  async embedTexts(texts: string[], dimensions?: number): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.embedText(text, dimensions);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  private async embedTextByDashScope(text: string, dimensions?: number): Promise<number[]> {
    const requestPayloads: Array<Record<string, unknown>> = [
      {
        model: this.dashScopeModel,
        input: { texts: [text] },
      },
      {
        model: this.dashScopeModel,
        input: { text },
      },
    ];

    // DashScope 各模型维度参数兼容性不完全一致，默认不强制透传调用方的 dimensions。
    // 如需指定维度，可通过环境变量显式开启。
    const allowDimensionOverride = process.env.EMBEDDING_SERVICE_USE_DIMENSION === 'true';
    if (allowDimensionOverride && dimensions && Number.isFinite(dimensions) && dimensions > 0) {
      for (const payload of requestPayloads) {
        payload.parameters = { dimension: dimensions };
      }
    }

    const errors: string[] = [];

    for (const payload of requestPayloads) {
      const response = await fetch(this.dashScopeBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.dashScopeApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      if (!response.ok) {
        errors.push(`DashScope ${response.status}: ${raw.slice(0, 500)}`);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        errors.push('DashScope embedding response is not valid JSON');
        continue;
      }

      const embedding = this.extractEmbeddingFromDashScope(parsed);
      if (embedding) {
        return embedding;
      }
      errors.push('DashScope embedding response missing embedding vector');
    }

    throw new Error(errors.join(' | ') || 'DashScope embedding failed');
  }

  private extractEmbeddingFromDashScope(response: unknown): number[] | null {
    if (!response || typeof response !== 'object') return null;
    const data = response as Record<string, any>;
    const fromOutput = data.output?.embeddings?.[0]?.embedding;
    const fromList = data.output?.embeddings?.[0]?.vector;
    const fromData = data.data?.[0]?.embedding;
    const candidate = fromOutput || fromList || fromData;
    if (!Array.isArray(candidate)) return null;
    if (!candidate.every((v) => typeof v === 'number')) return null;
    return candidate as number[];
  }

  /**
   * 计算余弦相似度（应用层计算，用于无向量索引时的回退）
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
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

  /**
   * 简单文本相似度（关键词匹配）- 回退方案
   */
  private textSimilarity(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const textLower = text.toLowerCase();
    
    if (queryWords.length === 0) return 0;
    
    let matchCount = 0;
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        matchCount++;
      }
    }
    
    return matchCount / queryWords.length;
  }

  // ==================== 知识库文档搜索 ====================

  /**
   * 在知识库中搜索相似文档（向量搜索优先）
   */
  async searchKnowledge(
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
      docType?: string;
    }
  ): Promise<SearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) {
      console.warn('[EmbeddingService] Supabase not configured');
      return [];
    }

    const limit = options?.limit || 10;
    const threshold = options?.threshold || 0.5;

    try {
      // 获取查询向量
      const queryEmbedding = await this.embedText(query, this.embeddingDimensions);
      
      // 尝试使用 RPC 函数进行向量搜索
      const { data: vectorResults, error } = await supabase.rpc('search_knowledge_docs', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        filter_file_type: options?.docType || null
      });

      if (!error && vectorResults && vectorResults.length > 0) {
        // 向量搜索成功
        return vectorResults.map((r: VectorSearchResult) => ({
          id: r.id,
          title: r.title || '',
          content: r.content?.slice(0, 500) || '',
          similarity: r.similarity,
          metadata: r.metadata || {},
          fileType: r.file_type
        }));
      }
      
      // 如果向量搜索失败或无结果，回退到文本搜索
      console.warn('[EmbeddingService] Vector search failed, falling back to text search');
      return await this.searchKnowledgeByText(query, { limit, threshold, docType: options?.docType });
      
    } catch (error) {
      console.error('[EmbeddingService] Knowledge search error:', error);
      // 回退到文本搜索
      return await this.searchKnowledgeByText(query, { limit, threshold, docType: options?.docType });
    }
  }

  /**
   * 知识库文本搜索（回退方案）
   */
  private async searchKnowledgeByText(
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
      docType?: string;
    }
  ): Promise<SearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 10;
    const threshold = options?.threshold || 0.3;

    const { data: docs, error } = await supabase
      .from('knowledge_docs')
      .select('id, title, content, metadata, file_type')
      .limit(100);

    if (error || !docs) return [];

    const results: SearchResult[] = docs
      .filter(doc => !options?.docType || doc.file_type === options?.docType)
      .map(doc => {
        const textMatch = this.textSimilarity(query, doc.content || '');
        return {
          id: doc.id,
          title: doc.title,
          content: doc.content?.slice(0, 500) || '',
          similarity: textMatch,
          metadata: (doc.metadata as Record<string, unknown>) || {},
          fileType: doc.file_type
        };
      })
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  // ==================== 案例库搜索 ====================

  /**
   * 搜索相似案例（向量搜索优先）
   */
  async searchSimilarCases(
    topic: string,
    options?: {
      limit?: number;
      threshold?: number;
    }
  ): Promise<CaseSearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 5;
    const threshold = options?.threshold || 0.3;

    try {
      // 获取查询向量
      const queryEmbedding = await this.embedText(topic, this.embeddingDimensions);
      
      // 尝试使用 RPC 函数进行向量搜索
      const { data: vectorResults, error } = await supabase.rpc('search_analysis_cases', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit
      });

      if (!error && vectorResults && vectorResults.length > 0) {
        // 向量搜索成功
        return vectorResults.map((r: CaseVectorSearchResult) => ({
          id: r.id,
          topic: r.query,
          similarity: r.similarity,
          conclusion: r.conclusion,
          confidence: r.confidence,
          createdAt: r.analyzed_at
        }));
      }
      
      // 回退到文本搜索
      return await this.searchSimilarCasesByText(topic, { limit, threshold });
      
    } catch (error) {
      console.error('[EmbeddingService] Case search error:', error);
      return await this.searchSimilarCasesByText(topic, { limit, threshold });
    }
  }

  /**
   * 案例库文本搜索（回退方案）
   */
  private async searchSimilarCasesByText(
    topic: string,
    options?: {
      limit?: number;
      threshold?: number;
    }
  ): Promise<CaseSearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 5;
    const threshold = options?.threshold || 0.2;

    const { data: cases, error } = await supabase
      .from('analysis_cases')
      .select('id, query, conclusion, confidence, analyzed_at')
      .order('analyzed_at', { ascending: false })
      .limit(50);

    if (error || !cases) return [];

    const results: CaseSearchResult[] = cases
      .map(c => ({
        id: c.id,
        topic: c.query,
        similarity: this.textSimilarity(topic, c.query),
        conclusion: c.conclusion,
        confidence: c.confidence,
        createdAt: c.analyzed_at,
      }))
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  // ==================== 知识图谱实体搜索 ====================

  /**
   * 搜索相似知识图谱实体（向量搜索优先）
   */
  async searchSimilarEntities(
    keyword: string,
    options?: {
      limit?: number;
      threshold?: number;
      entityType?: string;
    }
  ): Promise<EntitySearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 20;
    const threshold = options?.threshold || 0.3;

    try {
      // 获取查询向量
      const queryEmbedding = await this.embedText(keyword, this.embeddingDimensions);
      
      // 尝试使用 RPC 函数进行向量搜索
      const { data: vectorResults, error } = await supabase.rpc('search_kg_entities', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        filter_entity_type: options?.entityType || null
      });

      if (!error && vectorResults && vectorResults.length > 0) {
        // 向量搜索成功
        return vectorResults.map((r: EntityVectorSearchResult) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          importance: r.importance,
          similarity: r.similarity,
          description: r.description,
          properties: r.properties
        }));
      }
      
      // 回退到文本搜索
      return await this.searchSimilarEntitiesByText(keyword, { limit, threshold, entityType: options?.entityType });
      
    } catch (error) {
      console.error('[EmbeddingService] Entity search error:', error);
      return await this.searchSimilarEntitiesByText(keyword, { limit, threshold, entityType: options?.entityType });
    }
  }

  /**
   * 知识图谱实体文本搜索（回退方案）
   */
  private async searchSimilarEntitiesByText(
    keyword: string,
    options?: {
      limit?: number;
      threshold?: number;
      entityType?: string;
    }
  ): Promise<EntitySearchResult[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const limit = options?.limit || 20;
    const threshold = options?.threshold || 0.2;

    const { data: entities, error } = await supabase
      .from('kg_entities')
      .select('id, name, type, importance, description, properties')
      .order('importance', { ascending: false })
      .limit(100);

    if (error || !entities) return [];

    const filteredEntities = options?.entityType 
      ? entities.filter(e => e.type === options.entityType)
      : entities;

    const results: EntitySearchResult[] = filteredEntities
      .map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        importance: e.importance,
        similarity: Math.max(
          this.textSimilarity(keyword, e.name),
          e.description ? this.textSimilarity(keyword, e.description) : 0
        ),
        description: e.description,
        properties: e.properties as Record<string, unknown>
      }))
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  // ==================== 索引功能 ====================

  /**
   * 为文档生成嵌入并存储（使用 pgvector）
   */
  async indexDocument(
    docId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const supabase = this.getSupabase();
    if (!supabase) return false;

    try {
      // 生成嵌入向量
      const embedding = await this.embedText(content.slice(0, 8000), this.embeddingDimensions);
      
      // 使用 RPC 函数更新嵌入
      const { error } = await supabase.rpc('update_knowledge_doc_embedding', {
        doc_id: docId,
        new_embedding: embedding,
        model_name: this.embeddingModel
      });

      if (error) {
        // 如果 RPC 函数不存在，直接更新
        console.warn('[EmbeddingService] RPC not available, using direct update');
        
        const { error: updateError } = await supabase
          .from('knowledge_docs')
          .update({
            // @ts-ignore - pgvector 类型在 TypeScript 中需要特殊处理
            embedding: embedding,
            embedding_model: this.embeddingModel,
            embedding_generated_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              embedded: true,
              embeddedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', docId);

        if (updateError) {
          console.error('[EmbeddingService] Failed to index document:', updateError);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[EmbeddingService] Index document error:', error);
      return false;
    }
  }

  /**
   * 为实体生成嵌入并存储
   */
  async indexEntity(
    entityId: string,
    name: string,
    description?: string
  ): Promise<boolean> {
    const supabase = this.getSupabase();
    if (!supabase) return false;

    try {
      // 合并名称和描述作为嵌入文本
      const text = description ? `${name}: ${description}` : name;
      const embedding = await this.embedText(text.slice(0, 2000), this.embeddingDimensions);
      
      // 尝试使用 RPC 函数
      const { error } = await supabase.rpc('update_entity_embedding', {
        entity_id: entityId,
        new_embedding: embedding,
        model_name: this.embeddingModel
      });

      if (error) {
        // 直接更新
        const { error: updateError } = await supabase
          .from('kg_entities')
          .update({
            // @ts-ignore
            embedding: embedding,
            embedding_model: this.embeddingModel,
            embedding_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', entityId);

        if (updateError) {
          console.error('[EmbeddingService] Failed to index entity:', updateError);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[EmbeddingService] Index entity error:', error);
      return false;
    }
  }

  /**
   * 批量索引文档
   */
  async batchIndexDocuments(
    documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const doc of documents) {
      const result = await this.indexDocument(doc.id, doc.content, doc.metadata);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 批量索引实体
   */
  async batchIndexEntities(
    entities: Array<{ id: string; name: string; description?: string }>
  ): Promise<{ success: number; failed: number }> {
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

    return { success, failed };
  }

  // ==================== 统计与维护 ====================

  /**
   * 获取嵌入统计信息
   */
  async getEmbeddingStats(): Promise<EmbeddingStats> {
    const supabase = this.getSupabase();
    
    const defaultStats: EmbeddingStats = {
      knowledgeDocs: { total: 0, embedded: 0, percentage: 0 },
      kgEntities: { total: 0, embedded: 0, percentage: 0 }
    };

    if (!supabase) return defaultStats;

    try {
      // 尝试使用视图
      const { data: statsData, error } = await supabase.from('embedding_stats').select('*');
      
      if (!error && statsData) {
        const docsStat = statsData.find(s => s.table_name === 'knowledge_docs');
        const entitiesStat = statsData.find(s => s.table_name === 'kg_entities');
        
        return {
          knowledgeDocs: {
            total: docsStat?.total_records || 0,
            embedded: docsStat?.embedded_records || 0,
            percentage: docsStat?.embedding_percentage || 0
          },
          kgEntities: {
            total: entitiesStat?.total_records || 0,
            embedded: entitiesStat?.embedded_records || 0,
            percentage: entitiesStat?.embedding_percentage || 0
          }
        };
      }
      
      // 回退到手动统计
      const [docsResult, entitiesResult] = await Promise.all([
        supabase.from('knowledge_docs').select('id', { count: 'exact', head: true }),
        supabase.from('kg_entities').select('id', { count: 'exact', head: true })
      ]);

      return {
        knowledgeDocs: {
          total: docsResult.count || 0,
          embedded: 0,
          percentage: 0
        },
        kgEntities: {
          total: entitiesResult.count || 0,
          embedded: 0,
          percentage: 0
        }
      };
    } catch (error) {
      console.error('[EmbeddingService] Failed to get stats:', error);
      return defaultStats;
    }
  }

  /**
   * 为未索引的文档生成嵌入
   */
  async indexPendingDocuments(batchSize: number = 10): Promise<{ processed: number; success: number; failed: number }> {
    const supabase = this.getSupabase();
    if (!supabase) return { processed: 0, success: 0, failed: 0 };

    // 查询未生成嵌入的文档
    const { data: docs, error } = await supabase
      .from('knowledge_docs')
      .select('id, title, content')
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
   * 为未索引的实体生成嵌入
   */
  async indexPendingEntities(batchSize: number = 20): Promise<{ processed: number; success: number; failed: number }> {
    const supabase = this.getSupabase();
    if (!supabase) return { processed: 0, success: 0, failed: 0 };

    // 查询未生成嵌入的实体
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
}

// ==================== 工厂函数与单例 ====================

/**
 * 创建嵌入服务实例
 */
export function createEmbeddingService(): EmbeddingService {
  return new EmbeddingService();
}

// 导出单例
export const embeddingService = new EmbeddingService();
