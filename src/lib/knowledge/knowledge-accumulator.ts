/**
 * 知识积累系统
 * 
 * 支持多种知识来源：
 * 1. 文档上传：解析PDF、Word、Markdown等文档
 * 2. 用户描述：用户手动输入知识
 * 3. 自动积累：从分析过程中提取知识
 * 4. 交互学习：从用户反馈中学习
 */

import { LLMClient, Config, EmbeddingClient } from 'coze-coding-dev-sdk';
import { KnowledgeEntry, KnowledgeType, getKnowledgeManager } from './index';

// ==================== 类型定义 ====================

/**
 * 知识来源类型
 */
export type KnowledgeSource = 
  | 'document_upload'   // 文档上传
  | 'user_input'        // 用户手动输入
  | 'auto_extracted'    // 自动从分析中提取
  | 'feedback_learned'  // 从反馈中学习
  | 'preset';           // 预置知识

/**
 * 文档类型
 */
export type DocumentType = 
  | 'pdf'
  | 'docx'
  | 'markdown'
  | 'txt'
  | 'html';

/**
 * 上传的文档
 */
export interface UploadedDocument {
  id: string;
  filename: string;
  type: DocumentType;
  size: number;
  uploadedAt: string;
  content: string;
  metadata: {
    title?: string;
    author?: string;
    createdAt?: string;
    tags?: string[];
  };
}

/**
 * 知识提取结果
 */
export interface KnowledgeExtractionResult {
  entries: KnowledgeEntry[];
  confidence: number;
  source: string;
  extractedAt: string;
}

/**
 * 用户反馈知识
 */
export interface FeedbackKnowledge {
  caseId: string;
  feedbackType: 'correction' | 'enhancement' | 'validation';
  originalContent: string;
  userCorrection: string;
  reason?: string;
}

/**
 * 知识统计
 */
export interface KnowledgeStats {
  totalEntries: number;
  bySource: Record<KnowledgeSource, number>;
  byType: Record<KnowledgeType, number>;
  recentAdditions: number;
  averageConfidence: number;
}

// ==================== 知识积累器 ====================

/**
 * 知识积累器
 * 核心类：管理知识的添加、提取、学习
 */
export class KnowledgeAccumulator {
  private llmClient: LLMClient;
  private embeddingClient: EmbeddingClient;
  private knowledgeManager = getKnowledgeManager();
  
  // 知识来源追踪
  private sourceMap: Map<string, KnowledgeSource> = new Map();
  
  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
    this.embeddingClient = new EmbeddingClient(config);
    
    // 标记预置知识来源
    this.knowledgeManager.getAllKnowledge().forEach(entry => {
      this.sourceMap.set(entry.id, 'preset');
    });
  }
  
  // ==================== 文档上传 ====================
  
  /**
   * 从上传文档中提取知识
   */
  async extractFromDocument(
    document: UploadedDocument,
    options: {
      customHeaders?: Record<string, string>;
      autoTag?: boolean;
      extractEntities?: boolean;
      persistToKnowledge?: boolean;
    } = {}
  ): Promise<KnowledgeExtractionResult> {
    console.log(`[KnowledgeAccumulator] Extracting knowledge from document: ${document.filename}`);
    
    const { autoTag = true, extractEntities = true, persistToKnowledge = true } = options;
    
    // 1. 使用LLM提取知识点
    const extractionPrompt = `你是一个专业知识提取专家。请从以下文档中提取有价值的知识点。

## 文档内容
标题：${document.metadata.title || document.filename}
内容：
${document.content.substring(0, 8000)}

## 提取要求
1. 识别文档中的关键概念、定义、规律
2. 提取重要的事实性知识
3. 识别实体（机构、人物、事件）及其关系
4. 提取可复用的方法论或框架

## 输出格式
请严格按照以下JSON格式输出：
{
  "entries": [
    {
      "type": "economic_indicator|event|entity|policy|relationship|market_data",
      "title": "知识点标题",
      "content": "知识点内容（详细描述）",
      "metadata": {
        "source": "来源文档名",
        "confidence": 0.8,
        "tags": ["标签1", "标签2"],
        "relatedEntities": ["相关实体1", "相关实体2"]
      }
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是知识提取专家，严格按照JSON格式输出。' },
        { role: 'user', content: extractionPrompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3
      });
      
      // 解析结果
      const cleaned = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleaned);
      
      // 2. 为每个知识点生成向量嵌入
      const entries: KnowledgeEntry[] = [];
      
      for (const item of result.entries || []) {
        const entry: KnowledgeEntry = {
          id: `doc_${document.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: item.type,
          title: item.title,
          content: item.content,
          metadata: {
            source: document.filename,
            confidence: item.metadata?.confidence || 0.7,
            timestamp: Date.now(),
            tags: item.metadata?.tags || [],
            relatedEntities: item.metadata?.relatedEntities || []
          }
        };
        
        // 生成向量嵌入
        if (extractEntities) {
          try {
            const embedding = await this.embeddingClient.embedText(
              `${entry.title}\n${entry.content}`,
              { dimensions: 1024 }
            );
            entry.embedding = embedding;
          } catch (e) {
            console.warn('[KnowledgeAccumulator] Embedding generation failed:', e);
          }
        }
        
        // 自动标签
        if (autoTag && entry.metadata.tags.length === 0) {
          entry.metadata.tags = await this.autoTag(entry);
        }
        
        entries.push(entry);
        
        if (persistToKnowledge) {
          // 追踪来源
          this.sourceMap.set(entry.id, 'document_upload');
          // 添加到知识库
          await this.knowledgeManager.addKnowledge(entry);
        }
      }
      
      console.log(`[KnowledgeAccumulator] Extracted ${entries.length} knowledge entries from document`);
      
      return {
        entries,
        confidence: this.calculateOverallConfidence(entries),
        source: document.filename,
        extractedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[KnowledgeAccumulator] Document extraction failed:', error);
      throw error;
    }
  }

  /**
   * 将已抽取条目写入知识层（用于上传 API 的门禁后入库）。
   */
  async persistExtractedEntries(
    entries: KnowledgeEntry[],
    source: KnowledgeSource = 'document_upload'
  ): Promise<void> {
    for (const entry of entries) {
      this.sourceMap.set(entry.id, source);
      await this.knowledgeManager.addKnowledge(entry);
    }
  }
  
  // ==================== 用户手动输入 ====================
  
  /**
   * 添加用户输入的知识
   */
  async addUserKnowledge(
    input: {
      title: string;
      content: string;
      type?: KnowledgeType;
      tags?: string[];
      relatedEntities?: string[];
    },
    options?: { customHeaders?: Record<string, string> }
  ): Promise<KnowledgeEntry> {
    console.log(`[KnowledgeAccumulator] Adding user knowledge: ${input.title}`);
    
    // 1. 自动推断类型（如果未指定）
    const type = input.type || await this.inferKnowledgeType(input.title, input.content, options?.customHeaders);
    
    // 2. 创建知识条目
    const entry: KnowledgeEntry = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      title: input.title,
      content: input.content,
      metadata: {
        source: '用户输入',
        confidence: 0.9, // 用户输入通常可信度较高
        timestamp: Date.now(),
        tags: input.tags || [],
        relatedEntities: input.relatedEntities || []
      }
    };
    
    // 3. 生成向量嵌入
    try {
      const embedding = await this.embeddingClient.embedText(
        `${entry.title}\n${entry.content}`,
        { dimensions: 1024 }
      );
      entry.embedding = embedding;
    } catch (e) {
      console.warn('[KnowledgeAccumulator] Embedding generation failed:', e);
    }
    
    // 4. 追踪来源并保存
    this.sourceMap.set(entry.id, 'user_input');
    await this.knowledgeManager.addKnowledge(entry);
    
    console.log(`[KnowledgeAccumulator] User knowledge added: ${entry.id}`);
    
    return entry;
  }
  
  // ==================== 自动提取 ====================
  
  /**
   * 从分析结果中自动提取知识
   */
  async extractFromAnalysis(
    analysisResult: {
      query: string;
      conclusion: string;
      keyFactors: Array<{ factor: string; impact: string }>;
      causalChains: Array<{ cause: string; effect: string }>;
      scenarios: Array<{ name: string; description: string }>;
    },
    options?: { customHeaders?: Record<string, string> }
  ): Promise<KnowledgeEntry[]> {
    console.log('[KnowledgeAccumulator] Extracting knowledge from analysis result');
    
    const entries: KnowledgeEntry[] = [];
    
    // 1. 提取关键因素作为知识
    for (const factor of analysisResult.keyFactors) {
      const entry: KnowledgeEntry = {
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'relationship',
        title: `关键因素：${factor.factor}`,
        content: `在分析"${analysisResult.query}"中发现：${factor.factor} 对结果有重要影响。影响机制：${factor.impact}`,
        metadata: {
          source: '自动提取',
          confidence: 0.75,
          timestamp: Date.now(),
          tags: ['关键因素', '自动提取'],
          relatedEntities: []
        }
      };
      
      this.sourceMap.set(entry.id, 'auto_extracted');
      await this.knowledgeManager.addKnowledge(entry);
      entries.push(entry);
    }
    
    // 2. 提取因果链作为知识
    for (const chain of analysisResult.causalChains) {
      const entry: KnowledgeEntry = {
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'relationship',
        title: `因果关系：${chain.cause} → ${chain.effect}`,
        content: `在"${analysisResult.query}"的分析中验证的因果链：${chain.cause} 导致 ${chain.effect}`,
        metadata: {
          source: '自动提取',
          confidence: 0.7,
          timestamp: Date.now(),
          tags: ['因果链', '自动提取'],
          relatedEntities: []
        }
      };
      
      this.sourceMap.set(entry.id, 'auto_extracted');
      await this.knowledgeManager.addKnowledge(entry);
      entries.push(entry);
    }
    
    // 3. 如果结论有足够深度，提取为知识
    if (analysisResult.conclusion && analysisResult.conclusion.length > 200) {
      const entry: KnowledgeEntry = {
        id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'event',
        title: `分析结论：${analysisResult.query.substring(0, 50)}...`,
        content: analysisResult.conclusion,
        metadata: {
          source: '自动提取',
          confidence: 0.7,
          timestamp: Date.now(),
          tags: ['分析结论', '自动提取'],
          relatedEntities: []
        }
      };
      
      this.sourceMap.set(entry.id, 'auto_extracted');
      await this.knowledgeManager.addKnowledge(entry);
      entries.push(entry);
    }
    
    console.log(`[KnowledgeAccumulator] Auto-extracted ${entries.length} knowledge entries`);
    
    return entries;
  }
  
  // ==================== 反馈学习 ====================
  
  /**
   * 从用户反馈中学习
   */
  async learnFromFeedback(
    feedback: FeedbackKnowledge,
    options?: { customHeaders?: Record<string, string> }
  ): Promise<KnowledgeEntry | null> {
    console.log(`[KnowledgeAccumulator] Learning from feedback: ${feedback.feedbackType}`);
    
    // 只有修正和增强类型的反馈会生成新知识
    if (feedback.feedbackType === 'validation') {
      console.log('[KnowledgeAccumulator] Validation feedback, no new knowledge generated');
      return null;
    }
    
    // 生成修正后的知识条目
    const entry: KnowledgeEntry = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'entity', // 反馈通常是关于某个具体事实或实体
      title: `用户修正：${feedback.originalContent.substring(0, 30)}...`,
      content: `原始内容：${feedback.originalContent}\n\n用户修正：${feedback.userCorrection}\n\n修正原因：${feedback.reason || '用户认为原始内容有误或不够准确'}`,
      metadata: {
        source: `反馈学习（案例${feedback.caseId}）`,
        confidence: feedback.feedbackType === 'correction' ? 0.85 : 0.75,
        timestamp: Date.now(),
        tags: ['用户修正', '反馈学习'],
        relatedEntities: []
      }
    };
    
    this.sourceMap.set(entry.id, 'feedback_learned');
    await this.knowledgeManager.addKnowledge(entry);
    
    console.log(`[KnowledgeAccumulator] Learned from feedback: ${entry.id}`);
    
    return entry;
  }
  
  // ==================== 辅助方法 ====================
  
  /**
   * 推断知识类型
   */
  private async inferKnowledgeType(
    title: string,
    content: string,
    customHeaders?: Record<string, string>
  ): Promise<KnowledgeType> {
    const prompt = `根据以下知识的标题和内容，判断其类型。

标题：${title}
内容：${content}

类型选项：
- economic_indicator: 经济指标（GDP、CPI、利率等）
- event: 历史事件
- entity: 机构、人物等实体
- policy: 政策法规
- relationship: 实体关系、因果关系
- market_data: 市场数据

只返回类型名称，不要其他内容。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是知识分类专家。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.1
      });
      
      const type = response.content.trim() as KnowledgeType;
      const validTypes: KnowledgeType[] = [
        'economic_indicator', 'event', 'entity', 
        'policy', 'relationship', 'market_data'
      ];
      
      return validTypes.includes(type) ? type : 'entity';
    } catch {
      return 'entity';
    }
  }
  
  /**
   * 自动生成标签
   */
  private async autoTag(entry: KnowledgeEntry): Promise<string[]> {
    const prompt = `为以下知识生成3-5个标签。

标题：${entry.title}
内容：${entry.content}
类型：${entry.type}

只返回标签数组，格式：["标签1", "标签2", "标签3"]`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是知识标签专家。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.2
      });
      
      const cleaned = response.content.replace(/[\[\]]/g, '').replace(/"/g, '').trim();
      return cleaned.split(',').map(t => t.trim()).filter(t => t.length > 0);
    } catch {
      return [entry.type];
    }
  }
  
  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(entries: KnowledgeEntry[]): number {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((acc, e) => acc + e.metadata.confidence, 0);
    return sum / entries.length;
  }
  
  /**
   * 获取知识统计
   */
  getStats(): KnowledgeStats {
    const allEntries = this.knowledgeManager.getAllKnowledge();
    const baseStats = this.knowledgeManager.getStats();
    
    // 按来源统计
    const bySource: Record<KnowledgeSource, number> = {
      document_upload: 0,
      user_input: 0,
      auto_extracted: 0,
      feedback_learned: 0,
      preset: 0
    };
    
    allEntries.forEach(entry => {
      const source = this.sourceMap.get(entry.id) || 'preset';
      bySource[source]++;
    });
    
    // 计算平均置信度
    const avgConfidence = allEntries.length > 0
      ? allEntries.reduce((sum, e) => sum + e.metadata.confidence, 0) / allEntries.length
      : 0;
    
    // 最近7天新增
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentAdditions = allEntries.filter(e => e.metadata.timestamp > weekAgo).length;
    
    return {
      totalEntries: baseStats.total,
      bySource,
      byType: baseStats.byType,
      recentAdditions,
      averageConfidence: avgConfidence
    };
  }
  
  /**
   * 获取知识来源
   */
  getSource(entryId: string): KnowledgeSource | undefined {
    return this.sourceMap.get(entryId);
  }
}

// ==================== 单例导出 ====================

let knowledgeAccumulatorInstance: KnowledgeAccumulator | null = null;

export function getKnowledgeAccumulator(): KnowledgeAccumulator {
  if (!knowledgeAccumulatorInstance) {
    knowledgeAccumulatorInstance = new KnowledgeAccumulator();
  }
  return knowledgeAccumulatorInstance;
}
