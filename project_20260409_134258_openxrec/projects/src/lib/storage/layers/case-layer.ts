/**
 * 案例库层实现（经验知识层）
 * 
 * 职责：
 * - 完整案例：历史推荐案例
 * - 分析模板：可复用的分析框架
 * - 用户案例：用户生成的案例
 * - 失败案例：错误示范、边界情况
 * 
 * 特点：
 * - 以完整上下文为单位
 * - 包含查询、推理过程、结果、反馈
 * - 支持相似案例检索
 * - 质量评分、标签分类
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import {
  ICaseLayer,
  StorageResult,
  AnalysisCase,
  CaseTemplate,
  QueryOptions,
} from '../types';

/**
 * 案例库层实现类
 */
export class CaseLayer implements ICaseLayer {
  private client: SupabaseClient;
  private embeddingClient: EmbeddingClient;
  private initialized: boolean = false;

  constructor() {
    this.client = getSupabaseClient();
    this.embeddingClient = new EmbeddingClient(new Config());
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 检查连接
    const { error } = await this.client.from('analysis_cases').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('[CaseLayer] Connection check failed:', error);
    }

    this.initialized = true;
    console.log('[CaseLayer] Initialized');
  }

  // ============================================================================
  // 案例管理
  // ============================================================================

  /**
   * 创建案例
   */
  async createCase(
    caseData: Omit<AnalysisCase, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StorageResult<AnalysisCase>> {
    const startTime = Date.now();

    try {
      const id = `case_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      // 生成查询向量
      let queryEmbedding: number[] | null = null;
      try {
        queryEmbedding = await this.embeddingClient.embedText(caseData.query);
      } catch (e) {
        console.warn('[CaseLayer] Failed to generate query embedding:', e);
      }

      const record = {
        id,
        query: caseData.query,
        domain: caseData.domain,
        final_report: caseData.result.summary,
        conclusion: caseData.result,
        agent_outputs: caseData.process,
        confidence: caseData.result.confidence,
        quality_score: caseData.metadata.qualityScore,
        tags: caseData.metadata.tags,
        status: caseData.metadata.status,
        analyzed_at: now,
        created_at: now,
        updated_at: now,
      };

      const { error } = await this.client.from('analysis_cases').insert(record);

      if (error) {
        return { success: false, error: error.message };
      }

      // 存储向量嵌入
      if (queryEmbedding) {
        await this.storeEmbedding(id, 'case_query', queryEmbedding, caseData.query);
      }

      return {
        success: true,
        data: {
          id,
          ...caseData,
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
   * 获取案例
   */
  async getCase(id: string): Promise<StorageResult<AnalysisCase>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('analysis_cases')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToCase(data),
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
   * 更新案例
   */
  async updateCase(
    id: string,
    updates: Partial<AnalysisCase>
  ): Promise<StorageResult<AnalysisCase>> {
    const startTime = Date.now();

    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.feedback) {
        updateData.user_rating = updates.feedback.rating;
        updateData.feedback_count = 1;
      }
      if (updates.metadata?.qualityScore !== undefined) {
        updateData.quality_score = updates.metadata.qualityScore;
      }
      if (updates.metadata?.tags) {
        updateData.tags = updates.metadata.tags;
      }
      if (updates.metadata?.status) {
        updateData.status = updates.metadata.status;
      }

      const { data, error } = await this.client
        .from('analysis_cases')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToCase(data),
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
   * 删除案例
   */
  async deleteCase(id: string): Promise<StorageResult<void>> {
    const startTime = Date.now();

    try {
      // 删除关联的嵌入
      await this.client.from('case_embeddings').delete().eq('case_id', id);

      // 删除案例
      const { error } = await this.client.from('analysis_cases').delete().eq('id', id);

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
   * 搜索案例
   */
  async searchCases(
    query: string,
    options?: QueryOptions
  ): Promise<StorageResult<AnalysisCase[]>> {
    const startTime = Date.now();

    try {
      // 首先尝试向量搜索
      try {
        const queryEmbedding = await this.embeddingClient.embedText(query);

        const { data: vectorResults, error: vectorError } = await this.client.rpc(
          'search_case_by_vector',
          {
            query_embedding: queryEmbedding,
            match_limit: options?.limit || 10,
            match_threshold: 0.5,
          }
        );

        if (!vectorError && vectorResults && vectorResults.length > 0) {
          // 获取案例详情
          const caseIds = vectorResults.map((r: any) => r.case_id);
          const { data: cases, error: casesError } = await this.client
            .from('analysis_cases')
            .select('*')
            .in('id', caseIds);

          if (!casesError && cases) {
            return {
              success: true,
              data: cases.map(this.mapToCase),
              duration: Date.now() - startTime,
            };
          }
        }
      } catch (e) {
        console.warn('[CaseLayer] Vector search failed, falling back to text search:', e);
      }

      // 回退到文本搜索
      let dbQuery = this.client
        .from('analysis_cases')
        .select('*')
        .or(`query.ilike.%${query}%,final_report.ilike.%${query}%`);

      if (options?.filters?.domain) {
        dbQuery = dbQuery.eq('domain', options.filters.domain);
      }
      if (options?.filters?.status) {
        dbQuery = dbQuery.eq('status', options.filters.status);
      }

      dbQuery = dbQuery.order('analyzed_at', { ascending: false });

      if (options?.limit) {
        dbQuery = dbQuery.limit(options.limit);
      }

      const { data, error } = await dbQuery;

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map(this.mapToCase),
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
  // 模板管理
  // ============================================================================

  /**
   * 创建模板
   */
  async createTemplate(
    template: Omit<CaseTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'successRate'>
  ): Promise<StorageResult<CaseTemplate>> {
    const startTime = Date.now();

    try {
      const id = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      const record = {
        id,
        name: template.name,
        description: template.description,
        domain: template.domain,
        template: template.template,
        usage_count: 0,
        success_rate: 0,
        tags: template.tags,
        created_at: now,
        updated_at: now,
      };

      const { error } = await this.client.from('case_templates').insert(record);

      if (error) {
        // 如果表不存在，返回内存模板
        if (error.code === '42P01') {
          return {
            success: true,
            data: {
              id,
              ...template,
              usageCount: 0,
              successRate: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            duration: Date.now() - startTime,
          };
        }
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          id,
          ...template,
          usageCount: 0,
          successRate: 0,
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
   * 获取模板
   */
  async getTemplate(id: string): Promise<StorageResult<CaseTemplate>> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.client
        .from('case_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: this.mapToTemplate(data),
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
   * 列出模板
   */
  async listTemplates(domain?: string): Promise<StorageResult<CaseTemplate[]>> {
    const startTime = Date.now();

    try {
      let query = this.client.from('case_templates').select('*');

      if (domain) {
        query = query.eq('domain', domain);
      }

      query = query.order('usage_count', { ascending: false });

      const { data, error } = await query;

      if (error) {
        // 如果表不存在，返回预置模板
        if (error.code === '42P01') {
          return {
            success: true,
            data: this.getDefaultTemplates(domain),
            duration: Date.now() - startTime,
          };
        }
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map(this.mapToTemplate),
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
   * 存储嵌入向量
   */
  private async storeEmbedding(
    caseId: string,
    type: string,
    embedding: number[],
    textPreview: string
  ): Promise<void> {
    try {
      await this.client.from('case_embeddings').insert({
        id: `emb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        case_id: caseId,
        embedding_type: type,
        embedding,
        model: 'doubao-embedding-vision-251215',
        text_preview: textPreview.substring(0, 500),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[CaseLayer] Failed to store embedding:', e);
    }
  }

  /**
   * 获取默认模板
   */
  private getDefaultTemplates(domain?: string): CaseTemplate[] {
    const templates: CaseTemplate[] = [
      {
        id: 'tpl_comparison',
        name: '对比分析模板',
        description: '用于对比两个或多个选项的分析',
        domain: 'general',
        template: {
          queryPattern: '(对比|比较|vs|区别|差异)',
          analysisSteps: ['提取对比维度', '收集各选项信息', '生成对比表格', '总结结论'],
          outputFormat: 'comparison_table',
        },
        usageCount: 0,
        successRate: 0,
        tags: ['对比', '分析'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'tpl_trend',
        name: '趋势分析模板',
        description: '用于分析行业或技术趋势',
        domain: 'tech',
        template: {
          queryPattern: '(趋势|发展|未来|预测|展望)',
          analysisSteps: ['识别关键趋势', '分析驱动因素', '评估影响范围', '预测发展方向'],
          outputFormat: 'trend_report',
        },
        usageCount: 0,
        successRate: 0,
        tags: ['趋势', '预测'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'tpl_recommendation',
        name: '推荐分析模板',
        description: '用于生成个性化推荐',
        domain: 'general',
        template: {
          queryPattern: '(推荐|建议|选择|哪个好)',
          analysisSteps: ['理解用户需求', '筛选候选集', '评估匹配度', '生成推荐列表'],
          outputFormat: 'recommendation_list',
        },
        usageCount: 0,
        successRate: 0,
        tags: ['推荐', '建议'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    if (domain) {
      return templates.filter((t) => t.domain === domain || t.domain === 'general');
    }
    return templates;
  }

  /**
   * 映射数据库记录到案例
   */
  private mapToCase(data: any): AnalysisCase {
    return {
      id: data.id,
      query: data.query,
      domain: data.domain,
      context: {
        knowledgeUsed: [],
        searchUsed: false,
      },
      process: data.agent_outputs || {},
      result: data.conclusion || {
        recommendations: [],
        summary: data.final_report || '',
        confidence: parseFloat(data.confidence) || 0.5,
      },
      metadata: {
        qualityScore: data.quality_score ? parseFloat(data.quality_score) : undefined,
        tags: data.tags || [],
        status: data.status || 'completed',
      },
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at || data.created_at).getTime(),
    };
  }

  /**
   * 映射数据库记录到模板
   */
  private mapToTemplate(data: any): CaseTemplate {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      domain: data.domain,
      template: data.template,
      usageCount: data.usage_count || 0,
      successRate: data.success_rate || 0,
      tags: data.tags || [],
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }
}

// 导出单例
let caseLayerInstance: CaseLayer | null = null;

export function getCaseLayer(): CaseLayer {
  if (!caseLayerInstance) {
    caseLayerInstance = new CaseLayer();
  }
  return caseLayerInstance;
}
