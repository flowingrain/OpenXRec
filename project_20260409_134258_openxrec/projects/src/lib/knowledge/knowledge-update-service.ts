/**
 * 知识更新服务
 * 
 * 核心功能：
 * 1. 自动将Web Search检索到的有价值信息存储到知识库
 * 2. 生成向量嵌入，支持语义检索
 * 3. 知识时效性管理
 * 4. 知识去重与冲突检测
 * 
 * 流程：
 * Web Search结果 → 价值评估 → 知识提取 → 向量化 → 存储 → 下次优先使用
 */

import { LLMClient, EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import { KnowledgeEntry, KnowledgeType } from './index';

// 导入全局单例的获取函数
import { getKnowledgeManager } from './index';

// ==================== 类型定义 ====================

/**
 * 检索结果
 */
export interface SearchResult {
  title: string;
  snippet?: string;
  summary?: string;
  url?: string;
  siteName?: string;
  timestamp?: number;
}

/**
 * 知识提取请求
 */
export interface KnowledgeExtractionRequest {
  query: string;
  searchResults: SearchResult[];
  scenario: string;
}

/**
 * 提取的知识条目
 */
export interface ExtractedKnowledge {
  entry: KnowledgeEntry;
  embedding?: number[];
  valueScore: number;      // 价值评分 0-1
  timeSensitivity: 'high' | 'medium' | 'low';  // 时效性
  category: 'fact' | 'opinion' | 'data' | 'methodology';
}

/**
 * 知识更新结果
 */
export interface KnowledgeUpdateResult {
  success: boolean;
  extractedCount: number;
  storedCount: number;
  skippedReasons: string[];
  newEntries: KnowledgeEntry[];
}

// ==================== 知识更新服务 ====================

/**
 * 知识更新服务
 */
export class KnowledgeUpdateService {
  private llmClient: LLMClient;
  private embeddingClient: EmbeddingClient;
  private knowledgeManager: ReturnType<typeof getKnowledgeManager>;
  
  // 时效性阈值（毫秒）
  private TIME_SENSITIVITY_THRESHOLD = {
    high: 24 * 60 * 60 * 1000,    // 1天 - 实时数据
    medium: 7 * 24 * 60 * 60 * 1000,  // 1周 - 短期趋势
    low: 30 * 24 * 60 * 60 * 1000,    // 1月 - 长期知识
  };

  constructor(customHeaders?: Record<string, string>) {
    const config = new Config();
    this.llmClient = new LLMClient(config, customHeaders);
    this.embeddingClient = new EmbeddingClient(config, customHeaders);
    // 使用全局单例
    this.knowledgeManager = getKnowledgeManager();
  }

  /**
   * 从检索结果中提取并存储知识
   */
  async updateFromSearchResults(
    request: KnowledgeExtractionRequest
  ): Promise<KnowledgeUpdateResult> {
    const { query, searchResults, scenario } = request;
    const result: KnowledgeUpdateResult = {
      success: false,
      extractedCount: 0,
      storedCount: 0,
      skippedReasons: [],
      newEntries: [],
    };

    if (!searchResults || searchResults.length === 0) {
      result.skippedReasons.push('无搜索结果');
      return result;
    }

    try {
      // 步骤1: 评估搜索结果的价值
      const extractedKnowledge = await this.extractKnowledge(query, searchResults, scenario);
      result.extractedCount = extractedKnowledge.length;

      if (extractedKnowledge.length === 0) {
        result.skippedReasons.push('未提取到有价值的知识');
        return result;
      }

      // 步骤2: 存储知识
      for (const knowledge of extractedKnowledge) {
        // 检查是否已存在相似知识
        const exists = await this.checkDuplicate(knowledge.entry);
        if (exists) {
          result.skippedReasons.push(`知识已存在: ${knowledge.entry.title}`);
          continue;
        }

        // 添加到知识库
        await this.knowledgeManager.addKnowledge(knowledge.entry);
        result.storedCount++;
        result.newEntries.push(knowledge.entry);
      }

      result.success = result.storedCount > 0;
      console.log(`[KnowledgeUpdateService] Updated ${result.storedCount} knowledge entries from search results`);
      
      return result;
    } catch (error) {
      console.error('[KnowledgeUpdateService] Error updating knowledge:', error);
      result.skippedReasons.push(`更新失败: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * 从搜索结果中提取知识
   */
  private async extractKnowledge(
    query: string,
    searchResults: SearchResult[],
    scenario: string
  ): Promise<ExtractedKnowledge[]> {
    const systemPrompt = `你是一个知识提取专家。从搜索结果中提取有价值、可复用的知识。

**提取原则**：
1. 只提取客观事实、数据、方法论，不提取观点
2. 知识应该是通用的、可复用的
3. 避免提取时效性过强的信息（如"今天的股价"）
4. 每条知识应该独立、完整

**输出格式**（JSON数组）：
[
  {
    "title": "知识标题",
    "content": "知识内容（100-200字）",
    "type": "economic_indicator|event|entity|policy|market_data",
    "tags": ["标签1", "标签2"],
    "entities": ["相关实体1", "相关实体2"],
    "valueScore": 0.8,
    "timeSensitivity": "high|medium|low",
    "category": "fact|opinion|data|methodology"
  }
]

如果没有有价值的知识，返回空数组 []`;

    const searchContext = searchResults.map((r, i) => 
      `${i + 1}. ${r.title}\n   ${r.summary || r.snippet || ''}\n   来源: ${r.siteName || '互联网'}`
    ).join('\n\n');

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `原始查询：${query}\n场景：${scenario}\n\n搜索结果：\n${searchContext}` },
    ];

    try {
      const response = await this.llmClient.invoke(messages, {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const extracted = JSON.parse(jsonMatch[0]);
      
      return extracted.map((item: any, index: number): ExtractedKnowledge => {
        const entry: KnowledgeEntry = {
          id: `auto_${Date.now()}_${index}`,
          type: this.mapKnowledgeType(item.type),
          title: item.title,
          content: item.content,
          metadata: {
            source: '互联网检索',
            confidence: item.valueScore || 0.8,
            timestamp: Date.now(),
            tags: item.tags || [],
            relatedEntities: item.entities || [],
            region: '全球',
            autoExtracted: true,
            timeSensitivity: item.timeSensitivity,
            category: item.category,
          },
        };

        return {
          entry,
          valueScore: item.valueScore || 0.8,
          timeSensitivity: item.timeSensitivity || 'medium',
          category: item.category || 'fact',
        };
      });
    } catch (error) {
      console.error('[KnowledgeUpdateService] Error extracting knowledge:', error);
      return [];
    }
  }

  /**
   * 检查知识是否已存在（基于标题相似度）
   */
  private async checkDuplicate(entry: KnowledgeEntry): Promise<boolean> {
    const existing = await this.knowledgeManager.searchKnowledge(entry.title, { limit: 3 });
    
    for (const result of existing) {
      // 如果标题高度相似，认为已存在
      if (this.calculateSimilarity(entry.title, result.entry.title) > 0.8) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 计算字符串相似度（简单的字符重合度）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    // 计算字符重合度
    const chars1 = new Set(s1.split(''));
    const chars2 = new Set(s2.split(''));
    const intersection = new Set([...chars1].filter(x => chars2.has(x)));
    const union = new Set([...chars1, ...chars2]);
    
    return intersection.size / union.size;
  }

  /**
   * 映射知识类型
   */
  private mapKnowledgeType(type: string): KnowledgeType {
    const typeMap: Record<string, KnowledgeType> = {
      economic_indicator: 'economic_indicator',
      event: 'event',
      entity: 'entity',
      policy: 'policy',
      market_data: 'market_data',
      relationship: 'relationship',
    };
    return typeMap[type] || 'entity';
  }

  /**
   * 生成知识嵌入向量
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const response = await this.embeddingClient.embed([text]);
      const data = response.data as unknown as Array<{ embedding?: number[] }>;
      return data?.[0]?.embedding || null;
    } catch (error) {
      console.warn('[KnowledgeUpdateService] Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * 清理过期知识
   */
  async cleanupExpiredKnowledge(): Promise<number> {
    // 这里可以添加清理逻辑
    // 根据知识的时效性清理过期知识
    console.log('[KnowledgeUpdateService] Cleanup expired knowledge - not implemented yet');
    return 0;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建知识更新服务实例
 */
export function createKnowledgeUpdateService(customHeaders?: Record<string, string>): KnowledgeUpdateService {
  return new KnowledgeUpdateService(customHeaders);
}
