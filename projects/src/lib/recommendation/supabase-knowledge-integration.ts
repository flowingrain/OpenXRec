/**
 * 基于 Supabase 的推荐知识库服务
 * 
 * 功能：
 * - 使用 knowledge_docs 表存储推荐相关知识
 * - 使用 case_embeddings 表进行向量检索
 * - 支持知识增强的推荐解释
 * - 与推荐系统深度集成
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import { knowledgeDocs, caseEmbeddings } from '@/storage/database/shared/schema';
import { eq, like, or, sql } from 'drizzle-orm';

// ==================== 类型定义 ====================

export interface SupabaseKnowledgeEntry {
  id: string;
  title: string;
  content: string;
  metadata: {
    type?: string;
    tags?: string[];
    confidence?: number;
    timestamp?: number;
    relatedEntities?: string[];
    [key: string]: any;
  };
  embedding?: number[];
}

export interface SupabaseKnowledgeSearchResult {
  entry: SupabaseKnowledgeEntry;
  relevance: number;
  matchedFields: string[];
}

export interface RecommendationKnowledgeEnhancement {
  recommendations: any[];
  knowledgeContext: {
    entries: SupabaseKnowledgeSearchResult[];
    summary: string;
  };
  explanations: Map<string, string>;
}

// ==================== Supabase 推荐知识库管理器 ====================

/**
 * Supabase 推荐知识库管理器
 */
export class SupabaseRecommendationKnowledgeManager {
  private supabase: ReturnType<typeof getSupabaseClient>;
  private embeddingClient: EmbeddingClient;
  private initialized: boolean = false;

  constructor() {
    this.supabase = getSupabaseClient();
    this.embeddingClient = new EmbeddingClient({} as Config);
  }

  /**
   * 初始化：检查连接并加载推荐相关知识
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[SupabaseRecommendationKnowledge] Initializing...');

    // 检查数据库连接
    const { data, error } = await this.supabase
      .from('knowledge_docs')
      .select('count')
      .limit(1);

    if (error) {
      console.error('[SupabaseRecommendationKnowledge] Failed to connect to database:', error);
      throw error;
    }

    // 加载推荐相关知识（如果不存在）
    await this.ensureRecommendationKnowledge();

    this.initialized = true;
    console.log('[SupabaseRecommendationKnowledge] Initialized successfully');
  }

  /**
   * 确保推荐相关知识存在
   */
  private async ensureRecommendationKnowledge(): Promise<void> {
    // 检查是否已有推荐相关知识
    const { data: existingDocs } = await this.supabase
      .from('knowledge_docs')
      .select('id, title')
      .like('title', '推荐%');

    if (existingDocs && existingDocs.length >= 10) {
      console.log('[SupabaseRecommendationKnowledge] Recommendation knowledge already exists');
      return;
    }

    console.log('[SupabaseRecommendationKnowledge] Loading recommendation knowledge...');

    // 添加推荐相关知识
    const recommendationKnowledge = await this.generateRecommendationKnowledge();

    for (const knowledge of recommendationKnowledge) {
      await this.addKnowledge(knowledge);
    }

    console.log(`[SupabaseRecommendationKnowledge] Added ${recommendationKnowledge.length} knowledge entries`);
  }

  /**
   * 生成推荐相关知识
   */
  private async generateRecommendationKnowledge(): Promise<SupabaseKnowledgeEntry[]> {
    const baseEntries = [
      {
        id: 'rec_strategy_content_based',
        title: '基于内容的推荐策略',
        content: '基于内容的推荐通过分析物品的特征（如标题、描述、类别）与用户历史喜好的相似性来推荐物品。适合冷启动场景，推荐结果可解释性强。',
        metadata: {
          type: 'recommendation_strategy',
          tags: ['推荐算法', '内容推荐', '冷启动'],
          confidence: 0.95,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_strategy_collaborative',
        title: '协同过滤推荐策略',
        content: '协同过滤通过分析用户行为模式，找到相似用户或相似物品进行推荐。能发现用户未接触过的物品，但存在冷启动问题。',
        metadata: {
          type: 'recommendation_strategy',
          tags: ['推荐算法', '协同过滤', '用户行为'],
          confidence: 0.95,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_diversity',
        title: '推荐多样性',
        content: '推荐多样性指推荐结果的差异性。过高的相似度会导致推荐结果单调，降低用户体验。常用优化算法包括 MMR（Maximal Marginal Relevance）。',
        metadata: {
          type: 'recommendation_optimization',
          tags: ['推荐优化', '多样性', 'MMR'],
          confidence: 0.9,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_novelty',
        title: '推荐新颖性',
        content: '推荐新颖性指推荐用户未接触过的物品。新颖性过高可能导致用户不感兴趣，需要在相关性和新颖性之间取得平衡。',
        metadata: {
          type: 'recommendation_optimization',
          tags: ['推荐优化', '新颖性', '用户体验'],
          confidence: 0.9,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_serendipity',
        title: '推荐惊喜性',
        content: '推荐惊喜性指推荐用户意想不到但会感兴趣的物品。惊喜性能提升用户满意度，但需要准确把握用户兴趣边界。',
        metadata: {
          type: 'recommendation_optimization',
          tags: ['推荐优化', '惊喜性', '用户满意度'],
          confidence: 0.85,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_cold_start',
        title: '冷启动问题',
        content: '冷启动问题指新用户或新物品缺乏历史数据，导致推荐效果不佳。解决方案包括：使用用户注册信息、物品元数据、基于内容的推荐等。',
        metadata: {
          type: 'recommendation_challenge',
          tags: ['推荐挑战', '冷启动', '解决方案'],
          confidence: 0.95,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_explainability',
        title: '推荐可解释性',
        content: '推荐可解释性指能否向用户解释为什么推荐该物品。可解释性强的推荐能提升用户信任度和满意度。常见解释方式包括：基于特征相似、基于行为、基于知识图谱等。',
        metadata: {
          type: 'recommendation_feature',
          tags: ['推荐特性', '可解释性', '用户信任'],
          confidence: 0.95,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_personalization',
        title: '推荐个性化',
        content: '推荐个性化指根据用户的兴趣、偏好、行为历史等特征提供个性化的推荐结果。个性化程度越高，用户满意度通常越高。',
        metadata: {
          type: 'recommendation_feature',
          tags: ['推荐特性', '个性化', '用户画像'],
          confidence: 0.95,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_ab_testing',
        title: '推荐A/B测试',
        content: 'A/B测试是评估推荐算法效果的重要方法。通过对比不同算法的点击率、转化率等指标，选择最优算法。需要注意统计显著性检验。',
        metadata: {
          type: 'recommendation_evaluation',
          tags: ['推荐评估', 'A/B测试', '指标'],
          confidence: 0.9,
          timestamp: Date.now()
        }
      },
      {
        id: 'rec_metrics',
        title: '推荐评估指标',
        content: '常用推荐评估指标包括：准确率（Precision）、召回率（Recall）、F1分数、NDCG、MAP等。不同场景下应选择合适的指标。',
        metadata: {
          type: 'recommendation_evaluation',
          tags: ['推荐评估', '指标', '准确率'],
          confidence: 0.95,
          timestamp: Date.now()
        }
      }
    ];

    // 为每个条目生成向量嵌入
    for (const entry of baseEntries) {
      try {
        const embedding = await this.llmClient.createEmbedding({
          input: [entry.content],
          model: 'text-embedding-3-small'
        });
        entry.embedding = embedding[0];
      } catch (error) {
        console.error(`[SupabaseRecommendationKnowledge] Failed to generate embedding for ${entry.id}:`, error);
      }
    }

    return baseEntries;
  }

  /**
   * 添加知识条目
   */
  async addKnowledge(entry: SupabaseKnowledgeEntry): Promise<void> {
    const { data, error } = await this.supabase
      .from('knowledge_docs')
      .insert({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        metadata: entry.metadata
      })
      .select()
      .single();

    if (error) {
      console.error(`[SupabaseRecommendationKnowledge] Failed to add knowledge ${entry.id}:`, error);
      throw error;
    }

    // 如果有向量嵌入，保存到 embeddings 表
    if (entry.embedding && entry.embedding.length > 0) {
      const { error: embeddingError } = await this.supabase
        .from('case_embeddings')
        .insert({
          caseId: entry.id,
          embeddingType: 'recommendation_knowledge',
          embedding: entry.embedding,
          model: 'text-embedding-3-small',
          textPreview: entry.content.substring(0, 200)
        });

      if (embeddingError) {
        console.error(`[SupabaseRecommendationKnowledge] Failed to add embedding for ${entry.id}:`, embeddingError);
      }
    }

    console.log(`[SupabaseRecommendationKnowledge] Added knowledge entry: ${entry.title}`);
  }

  /**
   * 查询推荐相关知识（向量搜索）
   */
  async queryRecommendationKnowledge(
    query: string,
    options: {
      limit?: number;
      types?: string[];
      tags?: string[];
      threshold?: number;
    } = {}
  ): Promise<SupabaseKnowledgeSearchResult[]> {
    const {
      limit = 10,
      threshold = 0.6
    } = options;

    // 生成查询向量
    let queryVector: number[] | null = null;
    try {
      const embedding = await this.embeddingClient.embedText(query);
      queryVector = embedding;
    } catch (error) {
      console.error('[SupabaseRecommendationKnowledge] Failed to generate query embedding:', error);
    }

    if (queryVector) {
      // 使用向量搜索
      return await this.vectorSearch(queryVector, limit, threshold);
    } else {
      // 降级到文本搜索
      return await this.textSearch(query, limit);
    }
  }

  /**
   * 向量搜索
   */
  private async vectorSearch(
    queryVector: number[],
    limit: number,
    threshold: number
  ): Promise<SupabaseKnowledgeSearchResult[]> {
    // 获取所有推荐知识的嵌入
    const { data: embeddings, error } = await this.supabase
      .from('case_embeddings')
      .select('*')
      .eq('embeddingType', 'recommendation_knowledge')
      .limit(limit * 2);

    if (error || !embeddings) {
      console.error('[SupabaseRecommendationKnowledge] Failed to fetch embeddings:', error);
      return [];
    }

    // 计算余弦相似度
    const results: SupabaseKnowledgeSearchResult[] = [];

    for (const embeddingRecord of embeddings) {
      const embedding = embeddingRecord.embedding as number[];
      const similarity = this.cosineSimilarity(queryVector, embedding);

      if (similarity >= threshold) {
        // 获取对应的知识条目
        const { data: doc } = await this.supabase
          .from('knowledge_docs')
          .select('*')
          .eq('id', embeddingRecord.caseId)
          .single();

        if (doc) {
          results.push({
            entry: {
              id: doc.id,
              title: doc.title,
              content: doc.content,
              metadata: doc.metadata
            },
            relevance: similarity,
            matchedFields: ['content']
          });
        }
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.relevance - a.relevance);

    return results.slice(0, limit);
  }

  /**
   * 文本搜索
   */
  private async textSearch(
    query: string,
    limit: number
  ): Promise<SupabaseKnowledgeSearchResult[]> {
    const { data, error } = await this.supabase
      .from('knowledge_docs')
      .select('*')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(limit);

    if (error || !data) {
      console.error('[SupabaseRecommendationKnowledge] Failed to search text:', error);
      return [];
    }

    return data.map(doc => ({
      entry: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        metadata: doc.metadata
      },
      relevance: 0.7, // 默认相关度
      matchedFields: ['title', 'content']
    }));
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

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
   * 获取知识增强的推荐解释
   */
  async generateEnhancedExplanation(
    item: any,
    userProfile: any,
    score: number,
    strategy: string
  ): Promise<{
    explanation: string;
    knowledgeSources: SupabaseKnowledgeSearchResult[];
    confidence: number;
  }> {
    // 获取策略相关知识
    const strategyKnowledge = await this.queryRecommendationKnowledge(
      strategy || '推荐',
      { limit: 3 }
    );

    // 获取用户兴趣相关知识
    const interestQuery = userProfile.interests?.join(' ') || '推荐';
    const interestKnowledge = await this.queryRecommendationKnowledge(
      interestQuery,
      { limit: 2 }
    );

    // 合并所有相关知识
    const allKnowledge = [...strategyKnowledge, ...interestKnowledge];

    // 生成解释
    const explanation = this.buildExplanation(item, userProfile, allKnowledge, strategy);

    // 计算置信度
    const confidence = this.calculateConfidence(score, allKnowledge);

    return {
      explanation,
      knowledgeSources: allKnowledge.slice(0, 3),
      confidence
    };
  }

  /**
   * 构建解释
   */
  private buildExplanation(
    item: any,
    userProfile: any,
    knowledge: SupabaseKnowledgeSearchResult[],
    strategy: string
  ): string {
    const parts: string[] = [];

    // 基于用户兴趣
    if (userProfile.interests && userProfile.interests.length > 0) {
      const matchedInterests = userProfile.interests.slice(0, 3);
      parts.push(`基于你的兴趣：${matchedInterests.join('、')}`);
    }

    // 基于推荐策略
    if (strategy) {
      parts.push(`采用${strategy}策略`);
    }

    // 基于知识
    if (knowledge.length > 0) {
      const knowledgeTitles = knowledge.slice(0, 2).map(k => k.entry.title);
      parts.push(`结合相关知识：${knowledgeTitles.join('、')}`);
    }

    // 基于物品
    if (item.title) {
      parts.push(`推荐"${item.title}"`);
    }

    return parts.join('，') + '。';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    score: number,
    knowledge: SupabaseKnowledgeSearchResult[]
  ): number {
    let confidence = score;

    // 知识增强
    const knowledgeBoost = Math.min(knowledge.length * 0.05, 0.15);

    // 知识可信度
    const avgKnowledgeConfidence = knowledge.length > 0
      ? knowledge.reduce((sum, k) => sum + (k.entry.metadata.confidence || 0.5), 0) / knowledge.length
      : 0.5;

    // 综合计算
    confidence = confidence * 0.7 + knowledgeBoost + avgKnowledgeConfidence * 0.2;

    return Math.min(confidence, 1);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    const { data, error } = await this.supabase
      .from('knowledge_docs')
      .select('*');

    if (error || !data) {
      return { total: 0, byType: {} };
    }

    const byType: Record<string, number> = {};
    for (const doc of data) {
      const type = doc.metadata?.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    }

    return {
      total: data.length,
      byType
    };
  }

  /**
   * 导出知识库数据
   */
  async exportData(options: {
    type?: string;
    limit?: number;
    includeEmbeddings?: boolean;
  } = {}): Promise<{
    entries: SupabaseKnowledgeEntry[];
    metadata: {
      exportDate: string;
      totalEntries: number;
      types: string[];
    };
  }> {
    let query = this.supabase
      .from('knowledge_docs')
      .select('*');

    if (options.type) {
      query = query.like('metadata->>type', options.type);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(10000);
    }

    const { data, error } = await query;

    if (error || !data) {
      throw new Error(`导出失败: ${error?.message}`);
    }

    const entries: SupabaseKnowledgeEntry[] = data.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      metadata: item.metadata || {}
    }));

    const types = [...new Set(data.map(item => item.metadata?.type || 'unknown'))];

    return {
      entries,
      metadata: {
        exportDate: new Date().toISOString(),
        totalEntries: entries.length,
        types
      }
    };
  }

  /**
   * 导入知识库数据
   */
  async importData(data: {
    entries: SupabaseKnowledgeEntry[];
    metadata?: any;
  }, options: {
    skipExisting?: boolean;
    updateExisting?: boolean;
    generateEmbeddings?: boolean;
    batchSize?: number;
  } = {}): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const {
      skipExisting = true,
      updateExisting = false,
      generateEmbeddings = true,
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
              .from('knowledge_docs')
              .select('id')
              .eq('id', entry.id)
              .single();

            if (existing) {
              if (skipExisting) {
                continue;
              }
              if (updateExisting) {
                const { error: updateError } = await this.supabase
                  .from('knowledge_docs')
                  .update({
                    title: entry.title,
                    content: entry.content,
                    metadata: entry.metadata
                  })
                  .eq('id', entry.id);

                if (updateError) {
                  errors.push(`更新 ${entry.id} 失败: ${updateError.message}`);
                  failed++;
                } else {
                  success++;
                }
                continue;
              }
            }
          }

          // 插入新记录
          const { error: insertError } = await this.supabase
            .from('knowledge_docs')
            .insert({
              id: entry.id,
              title: entry.title,
              content: entry.content,
              metadata: entry.metadata
            });

          if (insertError) {
            errors.push(`导入 ${entry.id} 失败: ${insertError.message}`);
            failed++;
          } else {
            success++;

            // 生成嵌入
            if (generateEmbeddings) {
              try {
                const embedding = await this.embeddingClient.embedText(entry.content);

                await this.supabase
                  .from('case_embeddings')
                  .insert({
                    caseId: entry.id,
                    embeddingType: 'recommendation_knowledge',
                    embedding: embedding,
                    model: 'text-embedding-3-small',
                    textPreview: entry.content.substring(0, 200)
                  });
              } catch (embedError: any) {
                console.error(`生成嵌入 ${entry.id} 失败:`, embedError.message);
              }
            }
          }
        } catch (error: any) {
          errors.push(`处理 ${entry.id} 时出错: ${error.message}`);
          failed++;
        }
      }
    }

    console.log(`[SupabaseRecommendationKnowledge] 导入完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed, errors };
  }

  /**
   * 清空知识库
   */
  async clearAll(options: {
    type?: string;
    confirm?: boolean;
  } = {}): Promise<number> {
    if (!options.confirm) {
      throw new Error('需要确认才能清空数据（设置 confirm: true）');
    }

    let query = this.supabase.from('knowledge_docs').delete();

    if (options.type) {
      query = query.like('metadata->>type', options.type);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`清空失败: ${error.message}`);
    }

    const stats = await this.getStats();
    const deleted = options.type
      ? (stats.byType[options.type] || 0)
      : stats.total;

    console.log(`[SupabaseRecommendationKnowledge] Cleared ${deleted} entries`);
    return deleted;
  }
}

// ==================== 单例导出 ====================

let supabaseKnowledgeManagerInstance: SupabaseRecommendationKnowledgeManager | null = null;

export function getSupabaseRecommendationKnowledgeManager(): SupabaseRecommendationKnowledgeManager {
  if (!supabaseKnowledgeManagerInstance) {
    supabaseKnowledgeManagerInstance = new SupabaseRecommendationKnowledgeManager();
  }
  return supabaseKnowledgeManagerInstance;
}
