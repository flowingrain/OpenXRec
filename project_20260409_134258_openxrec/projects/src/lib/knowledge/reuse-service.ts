/**
 * 跨案例知识复用服务
 * 从历史案例中提取可复用的知识，辅助新分析
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createEmbeddingService, EmbeddingService } from '@/lib/embedding/service';
import { LLMClient } from 'coze-coding-dev-sdk';

/**
 * 知识复用结果
 */
export interface KnowledgeReuseResult {
  similarCases: Array<{
    id: string;
    topic: string;
    similarity: number;
    relevantContent: string;
    applicable: boolean;
  }>;
  relatedEntities: Array<{
    id: string;
    name: string;
    type: string;
    relevance: number;
    usageCount: number;
  }>;
  patterns: Array<{
    pattern: string;
    frequency: number;
    applicability: number;
    examples: string[];
  }>;
  suggestions: string[];
}

/**
 * 知识复用服务类
 */
export class KnowledgeReuseService {
  private embeddingService: EmbeddingService;
  private llmClient: LLMClient;

  constructor() {
    this.embeddingService = createEmbeddingService();
    this.llmClient = new LLMClient();
  }

  /**
   * 获取 Supabase 客户端
   */
  private getSupabase() {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }

  /**
   * 分析新主题，提供可复用知识
   */
  async analyzeForReuse(
    topic: string,
    options?: {
      maxCases?: number;
      maxEntities?: number;
      maxPatterns?: number;
    }
  ): Promise<KnowledgeReuseResult> {
    const maxCases = options?.maxCases || 5;
    const maxEntities = options?.maxEntities || 10;
    const maxPatterns = options?.maxPatterns || 5;

    // 1. 搜索相似案例
    const similarCases = await this.findSimilarCases(topic, maxCases);

    // 2. 查找相关实体
    const relatedEntities = await this.findRelatedEntities(topic, maxEntities);

    // 3. 提取模式
    const patterns = await this.extractPatterns(topic, similarCases);

    // 4. 生成建议
    const suggestions = await this.generateSuggestions(topic, similarCases, patterns);

    return {
      similarCases,
      relatedEntities,
      patterns,
      suggestions,
    };
  }

  /**
   * 查找相似案例
   */
  private async findSimilarCases(
    topic: string,
    limit: number
  ): Promise<KnowledgeReuseResult['similarCases']> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const cases = await this.embeddingService.searchSimilarCases(topic, { limit: limit * 2 });

    // 分析每个案例的可复用内容
    return cases.slice(0, limit).map(c => {
      let relevantContent = '';
      if (c.conclusion) {
        if (typeof c.conclusion === 'string') {
          relevantContent = c.conclusion.slice(0, 200);
        } else if (typeof c.conclusion === 'object') {
          relevantContent = JSON.stringify(c.conclusion).slice(0, 200);
        }
      }
      return {
        id: c.id,
        topic: c.topic,
        similarity: c.similarity,
        relevantContent,
        applicable: c.similarity > 0.5,
      };
    });
  }

  /**
   * 查找相关实体
   */
  private async findRelatedEntities(
    topic: string,
    limit: number
  ): Promise<KnowledgeReuseResult['relatedEntities']> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    const entities = await this.embeddingService.searchSimilarEntities(topic, { limit: limit * 2 });

    // 获取实体的使用次数
    const entitiesWithUsage = await Promise.all(
      entities.slice(0, limit).map(async (e) => {
        // 统计实体在关系中出现的次数
        const { count, error } = await supabase
          .from('kg_relations')
          .select('*', { count: 'exact', head: true })
          .or(`source_entity_id.eq.${e.id},target_entity_id.eq.${e.id}`);

        return {
          id: e.id,
          name: e.name,
          type: e.type,
          relevance: e.similarity,
          usageCount: count || 0,
        };
      })
    );

    return entitiesWithUsage.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * 提取可复用模式
   */
  private async extractPatterns(
    topic: string,
    similarCases: KnowledgeReuseResult['similarCases']
  ): Promise<KnowledgeReuseResult['patterns']> {
    if (similarCases.length === 0) return [];

    // 使用 LLM 分析案例中的模式
    const casesText = similarCases
      .filter(c => c.applicable)
      .map(c => `- ${c.topic}`)
      .join('\n');

    const prompt = `分析以下相似案例，提取可复用的分析模式和关键因素：

相似案例：
${casesText}

当前分析主题：${topic}

请提取：
1. 常见的分析维度
2. 关键影响因素
3. 典型的因果模式
4. 可复用的分析方法

以 JSON 格式输出：
{
  "patterns": [
    {
      "pattern": "模式描述",
      "frequency": 出现频率(1-10),
      "applicability": 适用性(0-1),
      "examples": ["示例1", "示例2"]
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([{
        role: 'user',
        content: prompt,
      }], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });

      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.patterns || [];
      }
    } catch (error) {
      console.error('[KnowledgeReuse] Extract patterns error:', error);
    }

    return [];
  }

  /**
   * 生成分析建议
   */
  private async generateSuggestions(
    topic: string,
    similarCases: KnowledgeReuseResult['similarCases'],
    patterns: KnowledgeReuseResult['patterns']
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // 基于相似案例的建议
    if (similarCases.length > 0) {
      suggestions.push(`发现 ${similarCases.length} 个相似历史案例，可参考其分析结论`);
    }

    // 基于模式的建议
    if (patterns.length > 0) {
      const topPatterns = patterns
        .filter(p => p.applicability > 0.6)
        .slice(0, 3);
      
      topPatterns.forEach(p => {
        suggestions.push(`建议关注: ${p.pattern}`);
      });
    }

    // 通用建议
    suggestions.push('建议从政策、市场、技术、竞争四个维度分析');
    suggestions.push('关注关键时间节点和事件催化');

    return suggestions.slice(0, 5);
  }

  /**
   * 复用历史知识到新分析
   */
  async reuseKnowledge(
    sourceCaseId: string,
    targetTopic: string
  ): Promise<{
    success: boolean;
    reusedEntities: number;
    reusedRelations: number;
    message: string;
  }> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return {
        success: false,
        reusedEntities: 0,
        reusedRelations: 0,
        message: '数据库未配置',
      };
    }

    try {
      // 获取源案例
      const { data: sourceCase, error } = await supabase
        .from('analysis_cases')
        .select('id, query')
        .eq('id', sourceCaseId)
        .maybeSingle();

      if (error || !sourceCase) {
        return {
          success: false,
          reusedEntities: 0,
          reusedRelations: 0,
          message: '源案例不存在',
        };
      }

      // 查询相关实体
      const entities = await this.embeddingService.searchSimilarEntities(
        targetTopic,
        { limit: 20 }
      );

      return {
        success: true,
        reusedEntities: entities.length,
        reusedRelations: 0,
        message: `已复用 ${entities.length} 个相关实体知识`,
      };
    } catch (error: any) {
      return {
        success: false,
        reusedEntities: 0,
        reusedRelations: 0,
        message: error.message,
      };
    }
  }
}

// 导出单例
export const knowledgeReuseService = new KnowledgeReuseService();
