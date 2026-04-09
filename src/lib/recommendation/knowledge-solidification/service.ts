/**
 * 知识固化服务
 * 
 * 核心功能：
 * 1. 评估推荐结果内容的可固化程度
 * 2. 根据置信度决定固化路径
 * 3. 执行知识/案例固化
 * 4. 管理待审核队列
 */

import { LLMClient, Config, EmbeddingClient } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  InformationSourceType,
  InformationSource,
  SolidifiableContent,
  ContentConfidence,
  SolidificationThresholds,
  SolidificationTarget,
  SolidificationResult,
  PendingSolidification,
  SolidificationStats,
  SOURCE_CONFIDENCE_WEIGHTS,
  DEFAULT_SOLIDIFICATION_THRESHOLDS,
} from './types';
import { getKnowledgeAccumulator } from '@/lib/knowledge/knowledge-accumulator';

// ==================== 知识固化服务类 ====================

/**
 * 知识固化服务
 */
export class KnowledgeSolidificationService {
  private llmClient: LLMClient;
  private embeddingClient: EmbeddingClient;
  private thresholds: SolidificationThresholds;
  
  constructor(thresholds?: Partial<SolidificationThresholds>) {
    const config = new Config();
    this.llmClient = new LLMClient(config);
    this.embeddingClient = new EmbeddingClient(config);
    this.thresholds = { ...DEFAULT_SOLIDIFICATION_THRESHOLDS, ...thresholds };
  }
  
  // ==================== 核心方法：评估可固化内容 ====================
  
  /**
   * 从推荐结果中提取可固化内容
   */
  async extractSolidifiableContent(
    recommendationResult: {
      items: Array<{
        id: string;
        title: string;
        description: string;
        score: number;
        confidence: number;
        source: string;
        sourceUrl?: string;
        explanations?: Array<{ reason: string; type: string }>;
      }>;
      query: string;
      scenario?: string;
    }
  ): Promise<SolidifiableContent[]> {
    const solidifiableContents: SolidifiableContent[] = [];
    
    for (const item of recommendationResult.items) {
      // 1. 分析信息来源
      const sources = this.analyzeInformationSources(item);
      
      // 2. 评估置信度
      const confidence = await this.assessContentConfidence(item, sources);
      
      // 3. 判断是否可固化
      if (confidence.solidificationLevel !== 'unsuitable') {
        const content: SolidifiableContent = {
          id: `solidifiable_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          category: this.categorizeContent(item),
          title: item.title,
          content: item.description,
          sources,
          confidence,
          entities: this.extractEntities(item),
          metadata: {
            query: recommendationResult.query,
            scenario: recommendationResult.scenario,
            recommendationId: item.id,
            createdAt: Date.now(),
          },
        };
        
        solidifiableContents.push(content);
      }
    }
    
    return solidifiableContents;
  }
  
  /**
   * 分析信息来源
   */
  private analyzeInformationSources(item: {
    source: string;
    sourceUrl?: string;
    confidence: number;
  }): InformationSource[] {
    const sources: InformationSource[] = [];
    const sourceLower = item.source.toLowerCase();
    
    // 分析来源类型（按优先级判断）
    
    // 1. 有外部链接 -> 系统检索的
    if (item.sourceUrl) {
      sources.push({
        type: 'system_retrieved',
        description: `来自外部来源: ${item.source}`,
        confidence: SOURCE_CONFIDENCE_WEIGHTS.system_retrieved,
        details: {
          url: item.sourceUrl,
          timestamp: Date.now(),
        },
      });
      return sources;
    }
    
    // 2. Web搜索相关关键词 -> 系统检索的
    if (sourceLower.includes('web') || 
        sourceLower.includes('search') || 
        sourceLower.includes('互联网') || 
        sourceLower.includes('搜索') ||
        sourceLower.includes('检索') ||
        sourceLower.includes('external')) {
      sources.push({
        type: 'system_retrieved',
        description: '来自互联网搜索',
        confidence: SOURCE_CONFIDENCE_WEIGHTS.system_retrieved,
        details: {
          timestamp: Date.now(),
        },
      });
      return sources;
    }
    
    // 3. 知识库相关关键词 -> 系统内置的
    if (sourceLower.includes('knowledge') || 
        sourceLower.includes('internal') || 
        sourceLower.includes('知识库') || 
        sourceLower.includes('内置') ||
        sourceLower.includes('preset') ||
        sourceLower.includes('预置')) {
      sources.push({
        type: 'system_builtin',
        description: '来自系统知识库',
        confidence: SOURCE_CONFIDENCE_WEIGHTS.system_builtin,
      });
      return sources;
    }
    
    // 4. LLM/AI相关关键词 -> 系统总结的
    if (sourceLower.includes('llm') || 
        sourceLower.includes('ai') || 
        sourceLower.includes('agent') || 
        sourceLower.includes('generated') ||
        sourceLower.includes('总结') ||
        sourceLower.includes('分析') ||
        sourceLower.includes('推理')) {
      sources.push({
        type: 'system_summarized',
        description: '由AI分析生成',
        confidence: SOURCE_CONFIDENCE_WEIGHTS.system_summarized,
        details: {
          llmModel: 'doubao-seed-2-0-pro-260215',
        },
      });
      return sources;
    }
    
    // 5. 用户相关关键词 -> 用户提供的
    if (sourceLower.includes('user') || 
        sourceLower.includes('用户') || 
        sourceLower.includes('input') ||
        sourceLower.includes('provided')) {
      sources.push({
        type: 'user_provided',
        description: '用户输入或确认的信息',
        confidence: SOURCE_CONFIDENCE_WEIGHTS.user_provided,
      });
      return sources;
    }
    
    // 6. 默认：根据置信度推断
    // 高置信度可能是内置知识，低置信度可能是AI生成
    if (item.confidence >= 0.9) {
      sources.push({
        type: 'system_builtin',
        description: '高置信度信息（可能是内置知识）',
        confidence: SOURCE_CONFIDENCE_WEIGHTS.system_builtin,
      });
    } else if (item.confidence >= 0.7) {
      sources.push({
        type: 'system_retrieved',
        description: '中等置信度信息（可能是检索结果）',
        confidence: SOURCE_CONFIDENCE_WEIGHTS.system_retrieved,
      });
    } else {
      sources.push({
        type: 'system_summarized',
        description: 'AI分析生成',
        confidence: SOURCE_CONFIDENCE_WEIGHTS.system_summarized,
      });
    }
    
    return sources;
  }
  
  /**
   * 评估内容置信度
   */
  private async assessContentConfidence(
    item: {
      title: string;
      description: string;
      score: number;
      confidence: number;
      explanations?: Array<{ reason: string; type: string }>;
    },
    sources: InformationSource[]
  ): Promise<ContentConfidence> {
    // 1. 计算来源可靠性（加权平均）
    const sourceReliability = sources.length > 0
      ? sources.reduce((sum, s) => sum + s.confidence, 0) / sources.length
      : 0.5;
    
    // 2. 计算内容连贯性
    // 对于高置信度内容，使用简化评估（避免额外的 LLM 调用）
    let contentCoherence: number;
    if (item.confidence >= 0.85 && item.description.length >= 20) {
      // 高置信度且有足够内容长度，认为内容连贯
      contentCoherence = Math.min(item.confidence * 0.95, 0.95);
    } else {
      // 使用 LLM 评估内容连贯性
      contentCoherence = await this.assessContentCoherence(item.title, item.description);
    }
    
    // 3. 用户验证（初始为 0.5，表示未验证但不是否定）
    const userValidation = 0.5;
    
    // 4. 历史准确率（从数据库查询）
    const historicalAccuracy = await this.getHistoricalAccuracy(item.title);
    
    // 5. 计算综合置信度（调整权重，减少用户验证的影响）
    const weights = {
      sourceReliability: 0.30,
      contentCoherence: 0.25,
      userValidation: 0.15,  // 降低权重
      historicalAccuracy: 0.15,
      itemConfidence: 0.15,  // 新增：使用原始推荐项的置信度
    };
    
    const overall = 
      sourceReliability * weights.sourceReliability +
      contentCoherence * weights.contentCoherence +
      userValidation * weights.userValidation +
      historicalAccuracy * weights.historicalAccuracy +
      item.confidence * weights.itemConfidence;
    
    // 6. 确定固化等级
    const solidificationLevel = this.determineSolidificationLevel(overall);
    
    // 7. 生成评估依据
    const reasoning = this.generateConfidenceReasoning({
      sourceReliability,
      contentCoherence,
      userValidation,
      historicalAccuracy,
      overall,
    });
    
    return {
      overall,
      factors: {
        sourceReliability,
        contentCoherence,
        userValidation,
        historicalAccuracy,
      },
      reasoning,
      solidificationLevel,
    };
  }
  
  /**
   * 评估内容连贯性
   */
  private async assessContentCoherence(title: string, content: string): Promise<number> {
    try {
      const prompt = `评估以下内容的连贯性和逻辑性。

标题：${title}
内容：${content}

请从以下维度评估（每项0-1分）：
1. 逻辑清晰度：内容是否有清晰的逻辑结构
2. 信息完整性：是否包含足够的关键信息
3. 表述准确性：表述是否准确、无歧义
4. 价值密度：是否包含有价值的信息

只返回一个JSON对象：
{
  "logicClarity": 0.8,
  "completeness": 0.9,
  "accuracy": 0.85,
  "valueDensity": 0.7,
  "overall": 0.8,
  "reasoning": "简要说明"
}`;
      
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是内容质量评估专家。' },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.1,
      });
      
      const cleaned = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleaned);
      
      return result.overall || 0.5;
    } catch (error) {
      console.warn('[KnowledgeSolidification] Content coherence assessment failed:', error);
      return 0.5;
    }
  }
  
  /**
   * 获取历史准确率
   */
  private async getHistoricalAccuracy(title: string): Promise<number> {
    const supabase = getSupabaseClient();
    if (!supabase) return 0.5;
    
    try {
      // 查询相似内容的准确率
      const { data } = await supabase
        .from('knowledge_solidifications')
        .select('accuracy, hit_count')
        .ilike('title', `%${title.substring(0, 20)}%`)
        .limit(5);
      
      if (data && data.length > 0) {
        const avgAccuracy = data.reduce((sum, d) => sum + (d.accuracy || 0.5), 0) / data.length;
        return avgAccuracy;
      }
      
      return 0.5; // 无历史数据，返回中等值
    } catch {
      return 0.5;
    }
  }
  
  /**
   * 确定固化等级
   */
  private determineSolidificationLevel(confidence: number): 'high' | 'medium' | 'low' | 'unsuitable' {
    if (confidence >= this.thresholds.confidenceThreshold.high) {
      return 'high';
    } else if (confidence >= this.thresholds.confidenceThreshold.medium) {
      return 'medium';
    } else if (confidence >= this.thresholds.confidenceThreshold.low) {
      return 'low';
    } else {
      return 'unsuitable';
    }
  }
  
  /**
   * 生成置信度评估依据
   */
  private generateConfidenceReasoning(factors: {
    sourceReliability: number;
    contentCoherence: number;
    userValidation: number;
    historicalAccuracy: number;
    overall: number;
  }): string {
    const parts: string[] = [];
    
    // 来源可靠性说明
    if (factors.sourceReliability >= 0.8) {
      parts.push('信息来源可靠');
    } else if (factors.sourceReliability >= 0.6) {
      parts.push('信息来源较为可靠');
    } else {
      parts.push('信息来源可靠性待验证');
    }
    
    // 内容连贯性说明
    if (factors.contentCoherence >= 0.8) {
      parts.push('内容逻辑清晰');
    } else if (factors.contentCoherence >= 0.6) {
      parts.push('内容基本连贯');
    }
    
    // 用户验证说明
    if (factors.userValidation === 0) {
      parts.push('等待用户验证');
    } else if (factors.userValidation >= 0.8) {
      parts.push('已获用户确认');
    }
    
    // 历史准确率说明
    if (factors.historicalAccuracy >= 0.7) {
      parts.push('历史表现良好');
    }
    
    return parts.join('；') + `。综合置信度：${(factors.overall * 100).toFixed(0)}%`;
  }
  
  // ==================== 核心方法：执行固化 ====================
  
  /**
   * 建议固化目标
   */
  suggestSolidificationTarget(content: SolidifiableContent): {
    target: SolidificationTarget;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  } {
    // 根据内容类别和置信度推荐固化目标
    switch (content.category) {
      case 'fact':
        return {
          target: 'knowledge_fact',
          reason: '事实性知识，适合作为知识点沉淀',
          priority: content.confidence.overall >= 0.85 ? 'high' : 'medium',
        };
      
      case 'relationship':
        return {
          target: 'knowledge_relation',
          reason: '关系型知识，可丰富知识图谱',
          priority: content.confidence.overall >= 0.8 ? 'high' : 'medium',
        };
      
      case 'insight':
      case 'recommendation':
        return {
          target: 'case_complete',
          reason: '完整的推荐案例，可作为参考案例沉淀',
          priority: 'medium',
        };
      
      case 'comparison':
        return {
          target: 'case_template',
          reason: '对比分析案例，可提取为可复用模板',
          priority: content.confidence.overall >= 0.8 ? 'high' : 'low',
        };
      
      default:
        return {
          target: 'knowledge_fact',
          reason: '默认作为知识沉淀',
          priority: 'low',
        };
    }
  }
  
  /**
   * 执行固化
   */
  async solidify(
    content: SolidifiableContent,
    options?: {
      skipUserConfirm?: boolean;
      skipExpertReview?: boolean;
    }
  ): Promise<SolidificationResult> {
    const suggestion = this.suggestSolidificationTarget(content);
    const { skipUserConfirm = false, skipExpertReview = true } = options || {};
    
    // 1. 判断固化路径
    const needsUserConfirm = !skipUserConfirm && 
      content.confidence.overall < this.thresholds.confidenceThreshold.high;
    
    const needsExpertReview = !skipExpertReview && 
      content.confidence.overall < this.thresholds.confidenceThreshold.medium;
    
    // 2. 如果需要用户确认，加入待确认队列
    if (needsUserConfirm) {
      const pending = await this.addToPendingQueue(content, suggestion);
      return {
        success: false,
        target: suggestion.target,
        status: 'pending_user_confirm',
        message: '内容已加入待确认队列，等待用户确认后固化',
        details: {
          originalConfidence: content.confidence.overall,
          finalConfidence: content.confidence.overall,
        },
      };
    }
    
    // 3. 如果需要专家审核，加入审核队列
    if (needsExpertReview) {
      const pending = await this.addToPendingQueue(content, suggestion);
      return {
        success: false,
        target: suggestion.target,
        status: 'pending_expert_review',
        message: '内容已加入专家审核队列',
        details: {
          originalConfidence: content.confidence.overall,
          finalConfidence: content.confidence.overall,
        },
      };
    }
    
    // 4. 执行固化
    try {
      const solidifiedId = await this.executeSolidification(content, suggestion.target);
      
      return {
        success: true,
        target: suggestion.target,
        solidifiedId,
        status: 'completed',
        message: '内容已成功固化',
        details: {
          originalConfidence: content.confidence.overall,
          finalConfidence: Math.min(content.confidence.overall * 1.1, 1.0),
          solidifiedAt: Date.now(),
        },
      };
    } catch (error) {
      console.error('[KnowledgeSolidification] Solidification failed:', error);
      return {
        success: false,
        target: suggestion.target,
        status: 'rejected',
        message: `固化失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }
  
  /**
   * 执行实际的固化操作
   */
  private async executeSolidification(
    content: SolidifiableContent,
    target: SolidificationTarget
  ): Promise<string> {
    const solidifiedId = `solidified_${target}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // 生成向量嵌入
    let embedding: number[] | undefined;
    try {
      embedding = await this.embeddingClient.embedText(
        `${content.title}\n${content.content}`,
        { dimensions: 1024 }
      );
    } catch (e) {
      console.warn('[KnowledgeSolidification] Embedding generation failed:', e);
    }
    
    // 根据目标类型执行不同的固化逻辑
    switch (target) {
      case 'knowledge_fact':
      case 'knowledge_relation':
        // 固化到知识库
        await this.solidifyToKnowledge(content, solidifiedId, embedding);
        break;
      
      case 'case_complete':
        // 固化到案例库
        await this.solidifyToCase(content, solidifiedId, embedding);
        break;
      
      case 'case_template':
        // 提取为模板
        await this.solidifyToTemplate(content, solidifiedId);
        break;
    }
    
    return solidifiedId;
  }
  
  /**
   * 固化到知识库
   */
  private async solidifyToKnowledge(
    content: SolidifiableContent,
    id: string,
    embedding?: number[]
  ): Promise<void> {
    // 使用知识积累器添加
    const knowledgeAccumulator = getKnowledgeAccumulator();
    
    await knowledgeAccumulator.addUserKnowledge({
      title: content.title,
      content: content.content,
      type: content.category === 'fact' ? 'entity' : 'relationship',
      tags: [content.category, '自动固化'],
      relatedEntities: content.entities?.map(e => e.name) || [],
    });
    
    // 同时保存到固化记录表
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('knowledge_solidifications').insert({
        id,
        type: content.category,
        title: content.title,
        content: content.content,
        confidence: content.confidence.overall,
        sources: content.sources,
        metadata: content.metadata,
        embedding,
        created_at: new Date().toISOString(),
      });
    }
  }
  
  /**
   * 固化到案例库
   */
  private async solidifyToCase(
    content: SolidifiableContent,
    id: string,
    embedding?: number[]
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    await supabase.from('analysis_cases').insert({
      id,
      query: content.metadata.query,
      domain: content.metadata.scenario || 'general',
      conclusion: {
        summary: content.title,
        details: content.content,
      },
      quality_score: content.confidence.overall,
      tags: [content.category, '自动固化'],
      embedding,
      created_at: new Date().toISOString(),
    });
  }
  
  /**
   * 提取为模板
   */
  private async solidifyToTemplate(
    content: SolidifiableContent,
    id: string
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    // 提取模板变量
    const variables = await this.extractTemplateVariables(content);
    
    await supabase.from('case_templates').insert({
      id,
      name: `模板：${content.title.substring(0, 30)}...`,
      description: content.content.substring(0, 200),
      domain: content.metadata.scenario || 'general',
      quality_score: content.confidence.overall,
      structure: {
        queryTemplate: content.metadata.query,
        keyFactorsTemplate: [],
        conclusionTemplate: content.content,
        tagsTemplate: [content.category],
      },
      variables,
      created_at: new Date().toISOString(),
    });
  }
  
  /**
   * 提取模板变量
   */
  private async extractTemplateVariables(
    content: SolidifiableContent
  ): Promise<Array<{ name: string; label: string; type: string; required: boolean }>> {
    try {
      const prompt = `从以下内容中提取可作为模板变量的元素。

标题：${content.title}
内容：${content.content}
查询：${content.metadata.query}

请识别可以参数化的元素（如年份、公司名、产品名等），返回JSON数组：
[
  { "name": "year", "label": "年份", "type": "text", "required": false, "defaultValue": "2024" },
  { "name": "company", "label": "公司名称", "type": "text", "required": true }
]`;
      
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是模板变量提取专家。' },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.1,
      });
      
      const cleaned = response.content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return [
        { name: 'topic', label: '主题', type: 'text', required: true },
      ];
    }
  }
  
  // ==================== 队列管理 ====================
  
  /**
   * 添加到待处理队列
   */
  private async addToPendingQueue(
    content: SolidifiableContent,
    suggestion: { target: SolidificationTarget; reason: string; priority: 'high' | 'medium' | 'low' }
  ): Promise<PendingSolidification> {
    const pending: PendingSolidification = {
      id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      content,
      suggestion,
      status: 'pending',
      createdAt: Date.now(),
    };
    
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('solidification_queue').insert({
        id: pending.id,
        content: pending.content,
        suggestion: pending.suggestion,
        status: pending.status,
        created_at: new Date().toISOString(),
      });
    }
    
    return pending;
  }
  
  /**
   * 获取待确认列表
   */
  async getPendingConfirmations(): Promise<PendingSolidification[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    const { data } = await supabase
      .from('solidification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    
    return data || [];
  }
  
  /**
   * 用户确认固化
   */
  async confirmByUser(pendingId: string): Promise<SolidificationResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        success: false,
        target: 'knowledge_fact',
        status: 'rejected',
        message: '数据库连接失败',
      };
    }
    
    // 获取待确认项
    const { data: pending } = await supabase
      .from('solidification_queue')
      .select('*')
      .eq('id', pendingId)
      .single();
    
    if (!pending) {
      return {
        success: false,
        target: 'knowledge_fact',
        status: 'rejected',
        message: '未找到待确认项',
      };
    }
    
    // 更新状态
    await supabase
      .from('solidification_queue')
      .update({ 
        status: 'user_confirmed', 
        confirmed_at: new Date().toISOString() 
      })
      .eq('id', pendingId);
    
    // 执行固化
    const content = pending.content as SolidifiableContent;
    return this.solidify(content, { skipUserConfirm: true });
  }
  
  /**
   * 用户拒绝固化
   */
  async rejectByUser(pendingId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    await supabase
      .from('solidification_queue')
      .update({ 
        status: 'rejected', 
        reviewed_at: new Date().toISOString() 
      })
      .eq('id', pendingId);
  }
  
  // ==================== 辅助方法 ====================
  
  /**
   * 内容分类
   */
  private categorizeContent(item: {
    title: string;
    description: string;
    source: string;
  }): 'fact' | 'relationship' | 'insight' | 'recommendation' | 'comparison' {
    const text = `${item.title} ${item.description}`.toLowerCase();
    
    // 简单的关键词匹配分类
    if (text.includes('对比') || text.includes('比较') || text.includes('vs') || text.includes('优缺点')) {
      return 'comparison';
    }
    if (text.includes('推荐') || text.includes('建议') || text.includes('适合')) {
      return 'recommendation';
    }
    if (text.includes('关系') || text.includes('影响') || text.includes('导致') || text.includes('因为')) {
      return 'relationship';
    }
    if (text.includes('趋势') || text.includes('洞察') || text.includes('发现') || text.includes('分析')) {
      return 'insight';
    }
    
    return 'fact';
  }
  
  /**
   * 提取实体
   */
  private extractEntities(item: { title: string; description: string }): Array<{ name: string; type: string }> {
    const entities: Array<{ name: string; type: string }> = [];
    const text = `${item.title} ${item.description}`;
    
    // 简单的实体识别（实际应用中可以使用NER模型）
    // 公司名称
    const companyMatch = text.match(/[\u4e00-\u9fa5]{2,}(公司|集团|科技|银行)/g);
    if (companyMatch) {
      companyMatch.forEach(name => {
        if (!entities.find(e => e.name === name)) {
          entities.push({ name, type: 'company' });
        }
      });
    }
    
    // 产品名称
    const productMatch = text.match(/[\u4e00-\u9fa5A-Za-z0-9]+(Pro|Max|Plus|版本|平台)/g);
    if (productMatch) {
      productMatch.forEach(name => {
        if (!entities.find(e => e.name === name)) {
          entities.push({ name, type: 'product' });
        }
      });
    }
    
    return entities;
  }
  
  /**
   * 获取统计信息
   */
  async getStats(): Promise<SolidificationStats> {
    const supabase = getSupabaseClient();
    
    const stats: SolidificationStats = {
      totalCandidates: 0,
      totalSolidified: 0,
      pendingUserConfirm: 0,
      pendingExpertReview: 0,
      bySource: {
        user_provided: { candidates: 0, solidified: 0, avgConfidence: 0 },
        system_retrieved: { candidates: 0, solidified: 0, avgConfidence: 0 },
        system_builtin: { candidates: 0, solidified: 0, avgConfidence: 0 },
        system_summarized: { candidates: 0, solidified: 0, avgConfidence: 0 },
      },
      byTarget: {
        knowledge_fact: 0,
        knowledge_relation: 0,
        case_complete: 0,
        case_template: 0,
      },
      recentSolidifications: [],
    };
    
    if (!supabase) return stats;
    
    try {
      // 统计待确认数量
      const { count: pendingCount } = await supabase
        .from('solidification_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      stats.pendingUserConfirm = pendingCount || 0;
      
      // 统计已固化数量
      const { count: solidifiedCount } = await supabase
        .from('knowledge_solidifications')
        .select('*', { count: 'exact', head: true });
      
      stats.totalSolidified = solidifiedCount || 0;
      
      // 获取最近固化
      const { data: recent } = await supabase
        .from('knowledge_solidifications')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (recent) {
        stats.recentSolidifications = recent.map(r => ({
          id: r.id,
          title: r.title,
          target: 'knowledge_fact' as SolidificationTarget,
          solidifiedAt: new Date(r.created_at).getTime(),
        }));
      }
    } catch (error) {
      console.warn('[KnowledgeSolidification] Failed to get stats:', error);
    }
    
    return stats;
  }
}

// ==================== 单例导出 ====================

let solidificationServiceInstance: KnowledgeSolidificationService | null = null;

export function getKnowledgeSolidificationService(
  thresholds?: Partial<SolidificationThresholds>
): KnowledgeSolidificationService {
  if (!solidificationServiceInstance) {
    solidificationServiceInstance = new KnowledgeSolidificationService(thresholds);
  }
  return solidificationServiceInstance;
}

export type {
  InformationSourceType,
  InformationSource,
  SolidifiableContent,
  ContentConfidence,
  SolidificationThresholds,
  SolidificationTarget,
  SolidificationResult,
  PendingSolidification,
  SolidificationStats,
};
