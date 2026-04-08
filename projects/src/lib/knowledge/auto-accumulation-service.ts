/**
 * 知识自动积累服务
 * 
 * 功能：
 * 1. 分析完成后自动存储案例
 * 2. 自动提取可复用知识
 * 3. 知识冲突检测
 * 4. 专家确认机制
 * 
 * 核心流程：
 * 分析完成 → 案例存储 → 知识提取 → 冲突检测 → （如有冲突）→ 专家确认
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { vectorStorageService } from '@/lib/embedding/vector-storage-service';

// ==================== 类型定义 ====================

/**
 * 分析案例数据
 */
export interface AnalysisCaseData {
  id?: string;
  query: string;
  domain: string;
  finalReport: string;
  conclusion?: string;
  timeline?: Array<{
    timestamp: string;
    event: string;
    significance?: string;
  }>;
  keyFactors?: Array<{
    factor: string;
    description: string;
    impact: string;
    weight: number;
  }>;
  scenarios?: Array<{
    name: string;
    type: string;
    probability: number;
    description: string;
  }>;
  causalChains?: Array<{
    cause: string;
    effect: string;
    strength: number;
  }>;
  // 🔧 新增：已生成的知识图谱数据（来自 causal_analyst）
  knowledgeGraph?: {
    entities: Array<{
      id: string;
      name: string;
      type: string;
      importance: number;
      description?: string;
      verified?: boolean;
    }>;
    relations: Array<{
      id: string;
      source_entity_id: string;
      target_entity_id: string;
      source_name?: string;
      target_name?: string;
      type: string;
      confidence: number;
      evidence?: string;
      verified?: boolean;
    }>;
  } | null;
  confidence?: number;
  agentOutputs?: Record<string, unknown>;
  searchResults?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

/**
 * 提取的知识条目
 */
export interface ExtractedKnowledge {
  type: 'economic_indicator' | 'event' | 'entity' | 'policy' | 'relationship' | 'market_data';
  title: string;
  content: string;
  metadata: {
    source: string;
    confidence: number;
    sourceCaseId: string;
    timestamp: number;
    tags: string[];
    relatedEntities: string[];
  };
}

/**
 * 知识冲突
 */
export interface KnowledgeConflict {
  id: string;
  type: 'entity_conflict' | 'relation_conflict' | 'fact_conflict' | 'value_conflict';
  existingKnowledge: {
    id: string;
    content: string;
    source: string;
    createdAt: string;
  };
  newKnowledge: {
    content: string;
    source: string;
    sourceCaseId: string;
  };
  conflictDescription: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

/**
 * 专家确认请求
 */
export interface ExpertConfirmationRequest {
  id: string;
  conflictId: string;
  type: 'resolve_conflict' | 'validate_knowledge' | 'verify_entity';
  title: string;
  description: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  context: {
    existingKnowledge: unknown;
    newKnowledge: unknown;
    relatedCases: string[];
  };
  status: 'pending' | 'resolved' | 'expired';
  createdAt: string;
  expiresAt: string;
}

/**
 * 自动积累配置
 */
export interface AutoAccumulationConfig {
  autoStoreCases: boolean;
  autoExtractKnowledge: boolean;
  conflictDetectionEnabled: boolean;
  expertConfirmationRequired: boolean;
  conflictThresholds: {
    entitySimilarity: number;
    relationSimilarity: number;
    factContradiction: number;
  };
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: AutoAccumulationConfig = {
  autoStoreCases: true,
  autoExtractKnowledge: true,
  conflictDetectionEnabled: true,
  expertConfirmationRequired: true,
  conflictThresholds: {
    entitySimilarity: 0.85,
    relationSimilarity: 0.9,
    factContradiction: 0.7,
  },
};

// ==================== 知识自动积累服务 ====================

/**
 * 知识自动积累服务
 */
export class KnowledgeAccumulationService {
  private llmClient: LLMClient;
  private config: AutoAccumulationConfig;

  constructor(config: Partial<AutoAccumulationConfig> = {}) {
    this.llmClient = new LLMClient(new Config());
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getSupabase() {
    try {
      return getSupabaseClient();
    } catch {
      return null;
    }
  }

  // ==================== 案例存储 ====================

  /**
   * 存储分析案例
   */
  async storeCase(caseData: AnalysisCaseData): Promise<{ success: boolean; caseId?: string; error?: string }> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return { success: false, error: '数据库连接失败' };
    }

    try {
      const caseId = caseData.id || `case_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // 存储案例
      const { error: insertError } = await supabase
        .from('analysis_cases')
        .insert({
          id: caseId,
          query: caseData.query,
          domain: caseData.domain || 'general',
          final_report: caseData.finalReport,
          conclusion: { summary: caseData.conclusion },
          timeline: caseData.timeline || [],
          key_factors: caseData.keyFactors || [],
          scenarios: caseData.scenarios || [],
          causal_chains: caseData.causalChains || [],
          confidence: caseData.confidence?.toString() || '0.7',
          agent_outputs: caseData.agentOutputs || {},
          status: 'completed',
          analyzed_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[KnowledgeAccumulation] Store case error:', insertError);
        return { success: false, error: insertError.message };
      }

      // 后台生成嵌入向量
      vectorStorageService.indexCase(caseId, caseData.query, caseData.finalReport)
        .then(success => {
          console.log(`[KnowledgeAccumulation] Case embedding generated: ${success}`);
        })
        .catch(err => {
          console.warn('[KnowledgeAccumulation] Case embedding failed:', err);
        });

      console.log(`[KnowledgeAccumulation] Case stored: ${caseId}`);
      return { success: true, caseId };
    } catch (error) {
      console.error('[KnowledgeAccumulation] Store case error:', error);
      return { success: false, error: String(error) };
    }
  }

  // ==================== 知识提取 ====================

  /**
   * 从分析结果中提取知识
   */
  async extractKnowledge(caseData: AnalysisCaseData): Promise<ExtractedKnowledge[]> {
    const knowledge: ExtractedKnowledge[] = [];

    console.log(`[KnowledgeAccumulation] extractKnowledge called for case: ${caseData.id || 'unknown'}`);
    console.log(`[KnowledgeAccumulation] keyFactors: ${caseData.keyFactors?.length || 0}, causalChains: ${caseData.causalChains?.length || 0}, timeline: ${caseData.timeline?.length || 0}, scenarios: ${caseData.scenarios?.length || 0}`);

    try {
      // 1. 从关键因素中提取
      if (caseData.keyFactors && caseData.keyFactors.length > 0) {
        for (const factor of caseData.keyFactors) {
          if (factor.weight > 0.5) {  // 降低阈值从0.6到0.5
            console.log(`[KnowledgeAccumulation] Extracting key factor: ${factor.factor} (weight: ${factor.weight})`);
            knowledge.push({
              type: 'entity',
              title: factor.factor,
              content: factor.description || `关键因素：${factor.factor}`,
              metadata: {
                source: 'analysis_extraction',
                confidence: factor.weight,
                sourceCaseId: caseData.id || '',
                timestamp: Date.now(),
                tags: ['关键因素', factor.impact],
                relatedEntities: [],
              },
            });
          }
        }
      }

      // 2. 从因果链中提取关系
      if (caseData.causalChains && caseData.causalChains.length > 0) {
        for (const chain of caseData.causalChains) {
          if (chain.strength > 0.5) {  // 降低阈值从0.6到0.5
            knowledge.push({
              type: 'relationship',
              title: `${chain.cause} → ${chain.effect}`,
              content: `因果关系：${chain.cause} 对 ${chain.effect} 有影响，强度：${chain.strength}`,
              metadata: {
                source: 'analysis_extraction',
                confidence: chain.strength,
                sourceCaseId: caseData.id || '',
                timestamp: Date.now(),
                tags: ['因果关系'],
                relatedEntities: [chain.cause, chain.effect],
              },
            });
          }
        }
      }

      // 3. 从时间线事件中提取实体
      if (caseData.timeline && caseData.timeline.length > 0) {
        for (const event of caseData.timeline) {
          if (event.event && event.significance) {
            knowledge.push({
              type: 'entity',
              title: event.event,
              content: event.significance,
              metadata: {
                source: 'timeline_extraction',
                confidence: 0.6,
                sourceCaseId: caseData.id || '',
                timestamp: Date.now(),
                tags: ['时间线事件'],
                relatedEntities: [],
              },
            });
          }
        }
      }

      // 4. 从场景中提取知识
      if (caseData.scenarios && caseData.scenarios.length > 0) {
        for (const scenario of caseData.scenarios) {
          if (scenario.probability > 0.3) {  // 概率超过30%的场景
            knowledge.push({
              type: 'entity',
              title: scenario.name,
              content: scenario.description || `场景：${scenario.name}，概率：${(scenario.probability * 100).toFixed(0)}%`,
              metadata: {
                source: 'scenario_extraction',
                confidence: scenario.probability,
                sourceCaseId: caseData.id || '',
                timestamp: Date.now(),
                tags: ['场景推演', scenario.type],
                relatedEntities: [],
              },
            });
          }
        }
      }

      // 5. 使用LLM深度提取（降低条件：报告长度 > 50 或 有关键因素）
      if ((caseData.finalReport && caseData.finalReport.length > 50) || 
          (caseData.keyFactors && caseData.keyFactors.length > 0)) {
        const llmExtracted = await this.extractKnowledgeWithLLM(caseData);
        knowledge.push(...llmExtracted);
      }

      return knowledge;
    } catch (error) {
      console.error('[KnowledgeAccumulation] Extract knowledge error:', error);
      return knowledge;
    }
  }

  /**
   * 使用LLM提取知识
   */
  private async extractKnowledgeWithLLM(caseData: AnalysisCaseData): Promise<ExtractedKnowledge[]> {
    const prompt = `从以下分析报告中提取可复用的知识条目。

分析主题：${caseData.query}
分析报告：
${caseData.finalReport?.slice(0, 3000)}

请提取以下类型的知识：
1. 经济指标：重要的经济数据和指标解读
2. 实体：涉及的机构、人物、国家等
3. 政策：相关的政策法规
4. 关系：实体之间的因果关系、影响关系

输出JSON格式：
{
  "knowledge": [
    {
      "type": "economic_indicator|entity|policy|relationship",
      "title": "知识标题",
      "content": "知识内容描述",
      "confidence": 0.8,
      "tags": ["标签1", "标签2"],
      "relatedEntities": ["相关实体"]
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([{
        role: 'user',
        content: prompt
      }], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3
      });

      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const result = JSON.parse(jsonMatch[0]);
      return (result.knowledge || []).map((k: any) => ({
        type: k.type,
        title: k.title,
        content: k.content,
        metadata: {
          source: 'llm_extraction',
          confidence: k.confidence || 0.7,
          sourceCaseId: caseData.id || '',
          timestamp: Date.now(),
          tags: k.tags || [],
          relatedEntities: k.relatedEntities || [],
        },
      }));
    } catch (error) {
      console.error('[KnowledgeAccumulation] LLM extraction error:', error);
      return [];
    }
  }

  // ==================== 冲突检测 ====================

  /**
   * 检测知识冲突
   */
  async detectConflicts(
    newKnowledge: ExtractedKnowledge[],
    sourceCaseId: string
  ): Promise<KnowledgeConflict[]> {
    const conflicts: KnowledgeConflict[] = [];
    const supabase = this.getSupabase();

    if (!supabase || !this.config.conflictDetectionEnabled) {
      return conflicts;
    }

    for (const knowledge of newKnowledge) {
      // 检查实体冲突
      if (knowledge.type === 'entity') {
        const entityConflicts = await this.detectEntityConflicts(knowledge, sourceCaseId, supabase);
        conflicts.push(...entityConflicts);
      }

      // 检查关系冲突
      if (knowledge.type === 'relationship') {
        const relationConflicts = await this.detectRelationConflicts(knowledge, sourceCaseId, supabase);
        conflicts.push(...relationConflicts);
      }
    }

    // 存储冲突记录
    for (const conflict of conflicts) {
      await this.storeConflict(conflict, supabase);
    }

    return conflicts;
  }

  /**
   * 检测实体冲突
   */
  private async detectEntityConflicts(
    knowledge: ExtractedKnowledge,
    sourceCaseId: string,
    supabase: any
  ): Promise<KnowledgeConflict[]> {
    const conflicts: KnowledgeConflict[] = [];

    // 搜索相似实体
    const { data: existingEntities, error } = await supabase
      .from('kg_entities')
      .select('id, name, description, type, created_at')
      .ilike('name', `%${knowledge.title}%`)
      .limit(5);

    if (error || !existingEntities) return conflicts;

    for (const entity of existingEntities) {
      // 检查是否有实质冲突（描述矛盾）
      const hasConflict = await this.checkFactConflict(
        entity.description || '',
        knowledge.content,
        knowledge.title
      );

      if (hasConflict) {
        conflicts.push({
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: 'entity_conflict',
          existingKnowledge: {
            id: entity.id,
            content: entity.description || entity.name,
            source: '知识图谱',
            createdAt: entity.created_at,
          },
          newKnowledge: {
            content: knowledge.content,
            source: 'analysis_extraction',
            sourceCaseId,
          },
          conflictDescription: `实体"${knowledge.title}"的描述与新提取的知识存在冲突`,
          severity: 'medium',
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }
    }

    return conflicts;
  }

  /**
   * 检测关系冲突
   */
  private async detectRelationConflicts(
    knowledge: ExtractedKnowledge,
    sourceCaseId: string,
    supabase: any
  ): Promise<KnowledgeConflict[]> {
    const conflicts: KnowledgeConflict[] = [];

    // 解析关系中的实体
    const relationMatch = knowledge.title.match(/(.+?)\s*[→\->]+\s*(.+)/);
    if (!relationMatch) return conflicts;

    const [, sourceEntity, targetEntity] = relationMatch;

    // 搜索相反方向的关系
    const { data: reverseRelations, error } = await supabase
      .from('kg_relations')
      .select(`
        id, type, confidence, evidence, created_at,
        source_entity:kg_entities!kg_relations_source_entity_id_fkey(name),
        target_entity:kg_entities!kg_relations_target_entity_id_fkey(name)
      `)
      .ilike('kg_entities.name', `%${targetEntity.trim()}%`);

    if (error || !reverseRelations) return conflicts;

    for (const relation of reverseRelations) {
      const sourceName = relation.source_entity?.name || '';
      if (sourceName.toLowerCase().includes(targetEntity.trim().toLowerCase())) {
        conflicts.push({
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: 'relation_conflict',
          existingKnowledge: {
            id: relation.id,
            content: `${sourceName} → ${relation.target_entity?.name}`,
            source: '知识图谱',
            createdAt: relation.created_at,
          },
          newKnowledge: {
            content: knowledge.content,
            source: 'analysis_extraction',
            sourceCaseId,
          },
          conflictDescription: `发现相反方向的关系：${sourceEntity} → ${targetEntity} vs ${targetEntity} → ${sourceName}`,
          severity: 'medium',
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }
    }

    return conflicts;
  }

  /**
   * 使用LLM检查事实冲突
   */
  private async checkFactConflict(
    existingContent: string,
    newContent: string,
    subject: string
  ): Promise<boolean> {
    if (!existingContent || existingContent.length < 10) return false;
    if (!newContent || newContent.length < 10) return false;

    const prompt = `判断以下两段关于"${subject}"的描述是否存在事实冲突或矛盾。

现有知识：${existingContent}
新提取知识：${newContent}

请判断：
1. 是否存在直接矛盾？（如：一个说上涨，一个说下跌）
2. 是否存在关键数据冲突？（如：数值不一致）
3. 是否存在因果关系冲突？（如：因果关系方向相反）

输出JSON：
{
  "hasConflict": true/false,
  "conflictType": "直接矛盾|数据冲突|因果冲突|无冲突",
  "description": "冲突描述"
}`;

    try {
      const response = await this.llmClient.invoke([{
        role: 'user',
        content: prompt
      }], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.2
      });

      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return false;

      const result = JSON.parse(jsonMatch[0]);
      return result.hasConflict === true;
    } catch (error) {
      console.error('[KnowledgeAccumulation] Conflict check error:', error);
      return false;
    }
  }

  /**
   * 存储冲突记录
   */
  private async storeConflict(conflict: KnowledgeConflict, supabase: any): Promise<void> {
    try {
      // 创建冲突表（如果不存在）
      // 这里使用 knowledge_patterns 表临时存储冲突信息
      await supabase
        .from('knowledge_patterns')
        .insert({
          id: conflict.id,
          pattern_type: 'knowledge_conflict',
          name: `冲突: ${conflict.type}`,
          description: conflict.conflictDescription,
          pattern_data: {
            type: conflict.type,
            existingKnowledge: conflict.existingKnowledge,
            newKnowledge: conflict.newKnowledge,
            severity: conflict.severity,
            status: conflict.status,
          },
          confidence: conflict.severity === 'high' ? 0.9 : conflict.severity === 'medium' ? 0.7 : 0.5,
          is_verified: false,
        });
    } catch (error) {
      console.error('[KnowledgeAccumulation] Store conflict error:', error);
    }
  }

  // ==================== 专家确认 ====================

  /**
   * 创建专家确认请求
   */
  async createExpertConfirmationRequest(
    conflict: KnowledgeConflict
  ): Promise<ExpertConfirmationRequest> {
    const request: ExpertConfirmationRequest = {
      id: `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      conflictId: conflict.id,
      type: 'resolve_conflict',
      title: `知识冲突需要确认：${conflict.type}`,
      description: conflict.conflictDescription,
      options: [
        {
          id: 'keep_existing',
          label: '保留现有知识',
          description: '拒绝新知识，保留现有知识图谱中的内容',
        },
        {
          id: 'accept_new',
          label: '接受新知识',
          description: '用新知识替换现有知识',
        },
        {
          id: 'merge',
          label: '合并两者',
          description: '将现有知识和新知识合并',
        },
        {
          id: 'both',
          label: '两者并存',
          description: '两者都是正确的，只是视角不同',
        },
      ],
      context: {
        existingKnowledge: conflict.existingKnowledge,
        newKnowledge: conflict.newKnowledge,
        relatedCases: [conflict.newKnowledge.sourceCaseId],
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后过期
    };

    return request;
  }

  /**
   * 处理专家确认响应
   */
  async handleExpertConfirmation(
    requestId: string,
    optionId: string,
    expertNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getSupabase();
    if (!supabase) {
      return { success: false, error: '数据库连接失败' };
    }

    try {
      // 更新冲突状态
      const { error } = await supabase
        .from('knowledge_patterns')
        .update({
          pattern_data: {
            status: optionId === 'keep_existing' ? 'rejected' : 
                   optionId === 'accept_new' ? 'approved' : 'merged',
            resolution: expertNote,
            resolvedAt: new Date().toISOString(),
          },
          is_verified: true,
        })
        .eq('pattern_type', 'knowledge_conflict')
        .eq('id', requestId);

      if (error) {
        return { success: false, error: error.message };
      }

      // 如果选择接受新知识，执行知识更新
      if (optionId === 'accept_new' || optionId === 'merge') {
        // TODO: 执行知识图谱更新
        console.log('[KnowledgeAccumulation] Knowledge updated based on expert confirmation');
      }

      return { success: true };
    } catch (error) {
      console.error('[KnowledgeAccumulation] Handle confirmation error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取待确认的冲突列表
   */
  async getPendingConflicts(): Promise<KnowledgeConflict[]> {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('knowledge_patterns')
        .select('*')
        .eq('pattern_type', 'knowledge_conflict')
        .eq('is_verified', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !data) return [];

      return data.map((item: any) => ({
        id: item.id,
        type: item.pattern_data.type,
        existingKnowledge: item.pattern_data.existingKnowledge,
        newKnowledge: item.pattern_data.newKnowledge,
        conflictDescription: item.description,
        severity: item.pattern_data.severity,
        status: item.pattern_data.status,
        createdAt: item.created_at,
      }));
    } catch (error) {
      console.error('[KnowledgeAccumulation] Get pending conflicts error:', error);
      return [];
    }
  }

  // ==================== 完整流程 ====================

  /**
   * 执行完整的知识积累流程
   */
  async accumulate(caseData: AnalysisCaseData): Promise<{
    caseStored: boolean;
    caseId?: string;
    knowledgeExtracted: number;
    conflictsDetected: number;
    pendingConfirmations: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let caseStored = false;
    let caseId: string | undefined;
    let knowledgeExtracted = 0;
    let conflictsDetected = 0;
    let pendingConfirmations = 0;

    // 1. 存储案例
    if (this.config.autoStoreCases) {
      const storeResult = await this.storeCase(caseData);
      caseStored = storeResult.success;
      caseId = storeResult.caseId;
      if (!storeResult.success) {
        errors.push(`案例存储失败: ${storeResult.error}`);
      }
    }

    // 2. 知识积累（优先使用已有的 knowledgeGraph）
    if (this.config.autoExtractKnowledge && caseStored) {
      // 🔧 优先使用 causal_analyst 已生成的知识图谱数据
      if (caseData.knowledgeGraph && caseData.knowledgeGraph.entities.length > 0) {
        console.log(`[KnowledgeAccumulation] 使用已有知识图谱: ${caseData.knowledgeGraph.entities.length} 实体, ${caseData.knowledgeGraph.relations?.length || 0} 关系`);
        
        // 直接存储已有的实体和关系
        const storedCount = await this.storeExistingKnowledgeGraph(caseData.knowledgeGraph, caseId || '');
        knowledgeExtracted = storedCount;
      } else {
        // 回退：从其他字段提取知识
        console.log('[KnowledgeAccumulation] 回退：从其他字段提取知识');
        const knowledge = await this.extractKnowledge({ ...caseData, id: caseId });
        knowledgeExtracted = knowledge.length;

        // 检测冲突
        if (this.config.conflictDetectionEnabled && knowledge.length > 0) {
          const conflicts = await this.detectConflicts(knowledge, caseId || '');
          conflictsDetected = conflicts.length;

          // 创建专家确认请求
          if (this.config.expertConfirmationRequired && conflicts.length > 0) {
            for (const conflict of conflicts) {
              await this.createExpertConfirmationRequest(conflict);
              pendingConfirmations++;
            }
          }
        }

        // 存储无冲突的知识
        if (knowledge.length > 0) {
          await this.storeKnowledge(knowledge, caseId || '');
        }
      }
    }

    return {
      caseStored,
      caseId,
      knowledgeExtracted,
      conflictsDetected,
      pendingConfirmations,
      errors,
    };
  }

  /**
   * 🔧 新增：存储已有的知识图谱数据（来自 causal_analyst）
   */
  private async storeExistingKnowledgeGraph(
    kg: NonNullable<AnalysisCaseData['knowledgeGraph']>,
    caseId: string
  ): Promise<number> {
    const supabase = this.getSupabase();
    if (!supabase) {
      console.warn('[KnowledgeAccumulation] storeExistingKnowledgeGraph: Supabase not available');
      return 0;
    }

    let storedCount = 0;
    const entityIdMap: Record<string, string> = {};

    // 1. 存储实体
    for (const entity of kg.entities) {
      try {
        // 检查实体是否已存在
        const { data: existingEntity } = await supabase
          .from('kg_entities')
          .select('id')
          .eq('name', entity.name)
          .maybeSingle();

        if (existingEntity) {
          entityIdMap[entity.id] = existingEntity.id;
          console.log(`[KnowledgeAccumulation] 实体已存在: ${entity.name}`);
        } else {
          // 创建新实体
          const { data: newEntity, error } = await supabase
            .from('kg_entities')
            .insert({
              name: entity.name,
              type: entity.type || '其他',
              description: entity.description,
              importance: entity.importance.toString(),
              source_type: 'llm',
              verified: false,
            })
            .select()
            .single();

          if (error) {
            console.error(`[KnowledgeAccumulation] 存储实体失败 "${entity.name}":`, error.message);
          } else if (newEntity) {
            entityIdMap[entity.id] = newEntity.id;
            storedCount++;
            console.log(`[KnowledgeAccumulation] 存储实体: ${entity.name}`);
          }
        }
      } catch (err) {
        console.error(`[KnowledgeAccumulation] 处理实体异常 "${entity.name}":`, err);
      }
    }

    // 2. 存储关系
    if (kg.relations && kg.relations.length > 0) {
      for (const relation of kg.relations) {
        try {
          // 优先使用 source_entity_id/target_entity_id，如果没有则使用 source_name/target_name
          const sourceId = entityIdMap[relation.source_entity_id] || entityIdMap[relation.source_name || ''];
          const targetId = entityIdMap[relation.target_entity_id] || entityIdMap[relation.target_name || ''];

          if (!sourceId || !targetId) {
            console.warn(`[KnowledgeAccumulation] 跳过关系: 缺少实体ID (source=${relation.source_entity_id || relation.source_name}, target=${relation.target_entity_id || relation.target_name})`);
            continue;
          }

          // 检查关系是否已存在
          const { data: existingRelation } = await supabase
            .from('kg_relations')
            .select('id')
            .eq('source_entity_id', sourceId)
            .eq('target_entity_id', targetId)
            .eq('type', relation.type)
            .maybeSingle();

          if (existingRelation) {
            console.log(`[KnowledgeAccumulation] 关系已存在: ${relation.source_name || sourceId} -> ${relation.target_name || targetId}`);
          } else {
            // 创建新关系
            const { error } = await supabase
              .from('kg_relations')
              .insert({
                source_entity_id: sourceId,
                target_entity_id: targetId,
                type: relation.type,
                confidence: relation.confidence.toString(),
                evidence: relation.evidence,
                source_type: 'llm',
                verified: false,
              });

            if (error) {
              console.error(`[KnowledgeAccumulation] 存储关系失败 "${relation.source_name || sourceId} -> ${relation.target_name || targetId}":`, error.message);
            } else {
              storedCount++;
              console.log(`[KnowledgeAccumulation] 存储关系: ${relation.source_name || sourceId} -[${relation.type}]-> ${relation.target_name || targetId}`);
            }
          }
        } catch (err) {
          console.error(`[KnowledgeAccumulation] 处理关系异常:`, err);
        }
      }
    }

    console.log(`[KnowledgeAccumulation] storeExistingKnowledgeGraph 完成: 存储 ${storedCount} 条数据`);
    return storedCount;
  }

  /**
   * 存储知识到知识图谱
   */
  private async storeKnowledge(knowledge: ExtractedKnowledge[], caseId: string): Promise<void> {
    const supabase = this.getSupabase();
    if (!supabase) {
      console.warn('[KnowledgeAccumulation] storeKnowledge: Supabase not available');
      return;
    }

    console.log(`[KnowledgeAccumulation] storeKnowledge: Storing ${knowledge.length} knowledge items`);

    for (const k of knowledge) {
      try {
        if (k.type === 'entity') {
          // 存储实体
          const { data, error } = await supabase.from('kg_entities').upsert({
            name: k.title,
            type: '其他',
            description: k.content,
            importance: k.metadata.confidence.toString(),
            source_type: 'llm',
            verified: false,
          }, { onConflict: 'name' }).select();
          
          if (error) {
            console.error(`[KnowledgeAccumulation] Failed to store entity "${k.title}":`, error.message);
          } else {
            console.log(`[KnowledgeAccumulation] Stored entity: ${k.title}`);
          }
        } else if (k.type === 'relationship') {
          // 存储关系（需要先获取实体ID）
          // 这里简化处理，实际需要先获取或创建实体
          const relationMatch = k.title.match(/(.+?)\s*[→\->]+\s*(.+)/);
          if (relationMatch) {
            const [, source, target] = relationMatch;
            // 创建或获取源实体
            const { data: sourceEntity } = await supabase
              .from('kg_entities')
              .upsert({ name: source.trim(), type: '其他', source_type: 'llm' }, { onConflict: 'name' })
              .select('id')
              .maybeSingle();

            // 创建或获取目标实体
            const { data: targetEntity } = await supabase
              .from('kg_entities')
              .upsert({ name: target.trim(), type: '其他', source_type: 'llm' }, { onConflict: 'name' })
              .select('id')
              .maybeSingle();

            if (sourceEntity && targetEntity) {
              // 创建关系
              await supabase.from('kg_relations').upsert({
                source_entity_id: sourceEntity.id,
                target_entity_id: targetEntity.id,
                type: '影响',
                confidence: k.metadata.confidence.toString(),
                evidence: k.content,
                source_type: 'llm',
              });
            }
          }
        }
      } catch (error) {
        console.error('[KnowledgeAccumulation] Store knowledge error:', error);
      }
    }
  }
}

// ==================== 导出 ====================

export const knowledgeAccumulationService = new KnowledgeAccumulationService();
export function createKnowledgeAccumulationService(config?: Partial<AutoAccumulationConfig>): KnowledgeAccumulationService {
  return new KnowledgeAccumulationService(config);
}
