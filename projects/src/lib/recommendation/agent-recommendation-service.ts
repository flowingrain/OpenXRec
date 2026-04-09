/**
 * 智能体推荐服务
 * 
 * 作为 API 和智能体系统之间的桥梁，实现：
 * 1. 调用 LangGraph 智能体工作流
 * 2. 整合多源信息（知识库、Web搜索、LLM知识）
 * 3. 通过解释生成智能体生成有依据的推荐理由
 */

import type { LLMClient } from 'coze-coding-dev-sdk';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import {
  RecommendationState,
  intentAnalyzerNode,
  explanationGeneratorNode,
} from './agents-nodes';
import type { ExplanationFactor, RecommendationItem, RecommendationContext } from './types';
import {
  getTemplateSelector,
  TemplateRenderService,
  type ResponseTemplate,
  type TemplateMatchResult,
} from './response-templates';

// ============================================================================
// 类型定义
// ============================================================================

export interface AgentRecommendationResult {
  items: AgentRecommendationItem[];
  strategy: string;
  explanation: string;
  metadata: {
    agentsUsed: string[];
    confidence: number;
    reasoningChain: string[];
    queryType?: 'recommendation' | 'comparison_analysis';  // 区分推荐型和对比分析型
  };
}

/**
 * 对比分析结果
 */
export interface ComparisonAnalysisResult {
  type: 'comparison_analysis';
  entities: Array<{ name: string; type: string }>;
  analysis: {
    [entityName: string]: {
      name: string;
      pros: string[];
      cons: string[];
      score?: number;
    };
  };
  conclusion: string;
  sources: Array<{ title: string; url?: string; snippet?: string }>;
  recommendation?: {
    preferred: string;
    reason: string;
  };
}

export interface AgentRecommendationItem {
  id: string;
  title: string;
  description: string;
  score: number;
  confidence: number;
  explanations: Array<{
    type: string;
    reason: string;
    factors: ExplanationFactor[];
    weight: number;
  }>;
  source: string;
  sourceUrl?: string;  // 信息源链接
  metadata?: any;
}

export interface AgentServiceConfig {
  useFullPipeline?: boolean;  // 是否使用完整智能体管道
  skipKnowledgeGraph?: boolean;  // 跳过知识图谱构建（用于简单查询）
  maxAgentsParallel?: number;  // 最大并行智能体数
  /** 最终返回条数上限（默认 5，API 可传入与 RECOMMENDATION_MAX_ITEMS 对齐） */
  maxReturnItems?: number;
}

// ============================================================================
// 智能体推荐服务
// ============================================================================

/**
 * 智能体推荐服务
 * 
 * 协调多个智能体完成推荐任务
 */
export class AgentRecommendationService {
  private llmClient: LLMClient;
  private config: AgentServiceConfig;
  private templateSelector: ReturnType<typeof getTemplateSelector>;

  constructor(llmClient?: LLMClient, config?: AgentServiceConfig) {
    this.llmClient = llmClient ?? createLLMClient({});
    this.config = config || {};
    this.templateSelector = getTemplateSelector({ enableDebug: true });
  }

  /**
   * 生成推荐（使用智能体协作）
   */
  async generateRecommendations(
    query: string,
    context: {
      scenario?: string;
      knowledgeContext?: string;
      webContext?: string;
      sources?: string[];
      recommendationType?: { type: string; suggestedOutput: string };
    }
  ): Promise<AgentRecommendationResult> {
    const startTime = Date.now();
    const agentsUsed: string[] = [];

    console.log('[AgentRecommendationService] Starting agent-based recommendation...');
    console.log('[AgentRecommendationService] Query:', query);

    try {
      // ========================================
      // 阶段1：意图分析智能体
      // ========================================
      console.log('[AgentRecommendationService] Phase 1: Intent Analysis Agent');
      const intentResult = await this.runIntentAnalyzer(query, context.scenario);
      agentsUsed.push('intent_analyzer');
      
      console.log('[AgentRecommendationService] Intent:', {
        scenario: intentResult.scenarioType,
        type: intentResult.recommendationType,
        queryType: intentResult.queryType,
        confidence: intentResult.confidence,
      });

      // ========================================
      // 分流：对比分析型 vs 推荐型
      // ========================================
      if (intentResult.queryType === 'comparison_analysis') {
        console.log('[AgentRecommendationService] Routing to Comparison Analysis flow');
        return this.generateComparisonAnalysis(query, context, intentResult);
      }

      // ========================================
      // 阶段2：候选生成（LLM + 外部知识）
      // ========================================
      console.log('[AgentRecommendationService] Phase 2: Candidate Generation');
      const candidates = await this.generateCandidates(query, context);
      agentsUsed.push('candidate_generator');

      console.log('[AgentRecommendationService] Generated candidates:', candidates.length);

      // ========================================
      // 阶段3：特征提取智能体
      // ========================================
      console.log('[AgentRecommendationService] Phase 3: Feature Extraction Agent');
      const itemsWithFeatures = await this.runFeatureExtractor(candidates, query, context);
      agentsUsed.push('feature_extractor');

      // ========================================
      // 阶段3.1：相似度计算智能体（高优先级优化）
      // ========================================
      console.log('[AgentRecommendationService] Phase 3.1: Similarity Calculator Agent');
      const similarities = await this.runSimilarityCalculator(itemsWithFeatures, query, context);
      agentsUsed.push('similarity_calculator');

      // ========================================
      // 阶段3.2：知识图谱推理智能体（中优先级优化）
      // ========================================
      console.log('[AgentRecommendationService] Phase 3.2: Knowledge Graph Reasoning Agent');
      const kgRelations = await this.runKGReasoner(query, itemsWithFeatures);
      agentsUsed.push('kg_reasoner');

      // ========================================
      // 阶段3.3：因果推理智能体（中优先级优化）
      // ========================================
      console.log('[AgentRecommendationService] Phase 3.3: Causal Reasoning Agent');
      const causalChain = await this.runCausalReasoner(query, itemsWithFeatures);
      agentsUsed.push('causal_reasoner');

      // ========================================
      // 阶段4：评分与排序智能体（增强版）
      // ========================================
      console.log('[AgentRecommendationService] Phase 4: Enhanced Ranking Agent');
      const rankedItems = await this.runRankingAgent(
        itemsWithFeatures,
        query,
        context,
        similarities,
        causalChain,
        kgRelations
      );
      agentsUsed.push('ranking_agent');

      // ========================================
      // 阶段5：解释生成智能体（核心！）
      // ========================================
      console.log('[AgentRecommendationService] Phase 5: Explanation Generation Agent');
      const itemsWithExplanations = await this.runExplanationGenerator(
        rankedItems,
        query,
        context,
        intentResult
      );
      agentsUsed.push('explanation_generator');

      // ========================================
      // 阶段6：多样性优化智能体
      // ========================================
      console.log('[AgentRecommendationService] Phase 6: Diversity Optimization Agent');
      const optimizedItems = await this.runDiversityOptimizer(itemsWithExplanations);
      agentsUsed.push('diversity_optimizer');

      // ========================================
      // 异步：配置优化智能体（低优先级优化）
      // ========================================
      // 异步调用，不阻塞推荐流程
      setImmediate(async () => {
        try {
          console.log('[AgentRecommendationService] Running Config Optimizer Agent asynchronously');
          await this.runConfigOptimizer({
            query,
            intent: intentResult,
            recommendations: optimizedItems,
            context,
          });
          agentsUsed.push('config_optimizer');
          console.log('[AgentRecommendationService] Config optimization completed');
        } catch (e) {
          console.error('[AgentRecommendationService] Config optimizer error:', e);
        }
      });

      // 构建推理链
      const reasoningChain = this.buildReasoningChain(intentResult, rankedItems, agentsUsed);

      // 计算整体置信度
      const avgConfidence = optimizedItems.length > 0
        ? optimizedItems.reduce((sum, item) => sum + item.confidence, 0) / optimizedItems.length
        : 0.7;

      const maxItems = Math.min(
        20,
        Math.max(1, this.config.maxReturnItems ?? 5)
      );

      return {
        items: optimizedItems.slice(0, maxItems),
        strategy: this.determineStrategy(context.sources),
        explanation: this.generateOverallExplanation(intentResult, optimizedItems),
        metadata: {
          agentsUsed,
          confidence: avgConfidence,
          reasoningChain,
          queryType: 'recommendation' as const,
        },
      };
    } catch (error) {
      console.error('[AgentRecommendationService] Error:', error);
      
      // 降级处理：直接使用 LLM 生成推荐
      console.log('[AgentRecommendationService] Falling back to direct LLM generation');
      return this.fallbackGeneration(query, context);
    }
  }

  // ============================================================================
  // 智能体节点实现
  // ============================================================================

  /**
   * 意图分析智能体
   * 
   * 分析用户查询意图，确定推荐类型和场景
   * 关键改进：区分"对比分析型"和"推荐型"查询
   */
  private async runIntentAnalyzer(
    query: string,
    scenario?: string
  ): Promise<{
    scenarioType: string;
    recommendationType: 'comparison' | 'ranking' | 'single' | 'comparison_analysis';
    queryType: 'recommendation' | 'comparison_analysis';  // 新增：区分查询类型
    entities: Array<{ name: string; type: string }>;
    constraints: Array<{ name: string; value: string }>;
    informationSufficiency: { score: number; missingFields: string[]; isSufficient: boolean };
    userIntent: string;
    confidence: number;
  }> {
    const prompt = `分析用户查询意图，提取关键信息。

用户查询：${query}
场景类型：${scenario || '未指定'}

**重要**：区分以下两种查询类型：
1. **对比分析型**：用户明确要求对比两个或多个已知选项的优缺点
   - 特征：包含"对比"、"比较"、"优缺点"、"区别"等关键词
   - 用户已经知道要比较的对象，只是想了解它们的差异
   - 示例："对比特斯拉Model 3和比亚迪汉的优缺点"、"iPhone和安卓手机哪个好"
   
2. **推荐型**：用户需要系统推荐选项
   - 特征：用户在寻找建议、推荐、选择
   - 示例："推荐几本AI书籍"、"帮我选一个咖啡机"、"哪个品牌好"

请以JSON格式返回：
{
  "scenarioType": "开店|投资|旅游|购物|学习|汽车|数码|其他",
  "recommendationType": "comparison_analysis|comparison|ranking|single",
  "queryType": "comparison_analysis|recommendation",
  "entities": [
    {"name": "实体名称", "type": "实体类型（如：汽车品牌、手机型号等）"}
  ],
  "constraints": [
    {"name": "约束名称", "value": "约束值"}
  ],
  "informationSufficiency": {
    "score": 0.7,
    "missingFields": ["缺失字段"],
    "isSufficient": true
  },
  "userIntent": "用户意图描述",
  "confidence": 0.9
}`;

    const response = await this.llmClient.invoke([
      { role: 'system', content: '你是一个意图理解专家，专门分析用户的查询意图。返回JSON格式。' },
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[IntentAnalyzer] Parse error:', e);
    }

    return {
      scenarioType: scenario || 'general',
      recommendationType: 'comparison',
      queryType: 'recommendation',
      entities: [],
      constraints: [],
      informationSufficiency: { score: 0.5, missingFields: [], isSufficient: true },
      userIntent: query,
      confidence: 0.5,
    };
  }

  /**
   * 候选生成
   * 
   * 使用 LLM 生成推荐候选
   */
  private async generateCandidates(
    query: string,
    context: {
      knowledgeContext?: string;
      webContext?: string;
      sources?: string[];
      recommendationType?: { type: string; suggestedOutput: string };
    }
  ): Promise<Array<{ id: string; title: string; description: string; source: string }>> {
    const outputType = context.recommendationType?.suggestedOutput || 'items';
    const hasExternalData = context.knowledgeContext || context.webContext;

    const systemPrompt = `你是OpenXRec推荐助手的候选生成智能体。

**你的能力**：
1. 利用内置的专业知识
2. 整合预置知识库的经济/政策/市场信息
3. 分析互联网实时搜索结果
4. 提供具体、可操作、有价值的建议

**输出要求**：
- 提供3-5个具体的推荐项目
- 每个推荐要有：标题、详细描述（100-200字）
- 如果有外部信息源，请注明信息来源

**输出格式**（严格JSON）：
{
  "items": [
    {
      "id": "rec_1",
      "title": "推荐标题",
      "description": "详细描述",
      "type": "recommendation",
      "source": "知识库/互联网/AI分析"
    }
  ]
}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `用户需求：${query}

${hasExternalData ? `请根据以下信息来源给出推荐：${context.knowledgeContext || ''}${context.webContext || ''}` : '请根据你的专业知识给出推荐。'}
` 
      },
    ];

    const response = await this.llmClient.invoke(messages, {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.items || []).map((item: any, index: number) => ({
          id: item.id || `rec_${index + 1}`,
          title: item.title || `推荐 ${index + 1}`,
          description: item.description || '',
          source: item.source || (hasExternalData ? '多源整合' : 'AI分析'),
        }));
      }
    } catch (e) {
      console.error('[CandidateGenerator] Parse error:', e);
    }

    return [];
  }

  /**
   * 特征提取智能体
   * 
   * 提取每个候选项的特征
   */
  private async runFeatureExtractor(
    candidates: Array<{ id: string; title: string; description: string; source: string }>,
    query: string,
    context: { knowledgeContext?: string; webContext?: string }
  ): Promise<Array<{
    id: string;
    title: string;
    description: string;
    source: string;
    features: Record<string, any>;
    relevanceScore: number;
  }>> {
    const prompt = `为以下推荐候选提取特征并评估相关性。

用户查询：${query}
${context.knowledgeContext ? `知识库信息：${context.knowledgeContext.substring(0, 500)}` : ''}

候选项目：
${candidates.map((c, i) => `${i + 1}. [${c.id}] ${c.title}\n   ${c.description}`).join('\n')}

请为每个候选提取特征并评估相关性，返回JSON：
{
  "items": [
    {
      "id": "rec_1",
      "features": {
        "category": "分类",
        "price_range": "价格范围",
        "target_audience": "目标受众",
        "key_benefits": ["优势1", "优势2"]
      },
      "relevanceScore": 0.9,
      "matchReasons": ["匹配原因1", "匹配原因2"]
    }
  ]
}`;

    const response = await this.llmClient.invoke([
      { role: 'system', content: '你是一个特征提取专家，擅长分析推荐项目与用户需求的匹配度。返回JSON格式。' },
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const featureMap = new Map(parsed.items.map((item: any) => [item.id, item]));
        
        return candidates.map(c => {
          const features = featureMap.get(c.id);
          return {
            ...c,
            features: features?.features || {},
            relevanceScore: features?.relevanceScore || 0.7,
            matchReasons: features?.matchReasons || [],
          };
        });
      }
    } catch (e) {
      console.error('[FeatureExtractor] Parse error:', e);
    }

    return candidates.map(c => ({
      ...c,
      features: {},
      relevanceScore: 0.7,
      matchReasons: [],
    }));
  }

  /**
   * 相似度计算智能体（高优先级优化）
   *
   * 计算用户与候选项的相似度
   */
  private async runSimilarityCalculator(
    items: Array<{
      id: string;
      title: string;
      description: string;
      source: string;
      features: Record<string, any>;
      relevanceScore: number;
      matchReasons?: string[];
    }>,
    query: string,
    context: { knowledgeContext?: string; webContext?: string }
  ): Promise<Map<string, number>> {
    console.log('[SimilarityCalculator] Calculating similarities for', items.length, 'items');

    const prompt = `计算以下推荐候选与用户查询的相似度。

用户查询：${query}
${context.knowledgeContext ? `知识库信息：${context.knowledgeContext.substring(0, 300)}` : ''}

候选项目：
${items.map((item, i) => `${i + 1}. [${item.id}] ${item.title} - ${item.description.substring(0, 100)}`).join('\n')}

请为每个候选计算相似度分数（0-1），返回JSON：
{
  "similarities": [
    { "id": "rec_1", "score": 0.85 },
    { "id": "rec_2", "score": 0.72 }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是一个相似度计算专家，擅长分析文本相似度。返回JSON格式。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const similarityMap = new Map<string, number>();
        parsed.similarities.forEach((s: any) => {
          similarityMap.set(s.id, s.score);
        });
        console.log('[SimilarityCalculator] Calculated', similarityMap.size, 'similarities');
        return similarityMap;
      }
    } catch (e) {
      console.error('[SimilarityCalculator] Parse error:', e);
    }

    // 默认使用 relevanceScore 作为相似度
    const defaultMap = new Map<string, number>();
    items.forEach(item => {
      defaultMap.set(item.id, item.relevanceScore);
    });
    return defaultMap;
  }

  /**
   * 知识图谱推理智能体（中优先级优化）
   *
   * 利用知识图谱发现隐式关联
   */
  private async runKGReasoner(
    query: string,
    items: Array<{ id: string; title: string }>
  ): Promise<Map<string, Array<{ relation: string; confidence: number }>>> {
    console.log('[KGReasoner] Performing knowledge graph reasoning');

    const entities = items.map(item => ({
      id: item.id,
      name: item.title,
    }));

    const prompt = `分析用户查询和推荐项之间的潜在关系。

用户查询：${query}

推荐实体：
${entities.map((e, i) => `${i + 1}. [${e.id}] ${e.name}`).join('\n')}

请分析这些实体之间的关系类型，返回JSON：
{
  "relations": [
    {
      "id": "rec_1",
      "relations": [
        { "type": "相似", "confidence": 0.8 },
        { "type": "补充", "confidence": 0.7 }
      ]
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是一个知识图谱推理专家，擅长发现实体间的关系。返回JSON格式。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const relationMap = new Map<string, Array<{ relation: string; confidence: number }>>();
        parsed.relations.forEach((r: any) => {
          relationMap.set(r.id, r.relations);
        });
        console.log('[KGReasoner] Found', relationMap.size, 'relations');
        return relationMap;
      }
    } catch (e) {
      console.error('[KGReasoner] Parse error:', e);
    }

    // 返回空关系
    return new Map();
  }

  /**
   * 因果推理智能体（中优先级优化）
   *
   * 基于因果推断分析推荐影响
   */
  private async runCausalReasoner(
    query: string,
    items: Array<{ id: string; title: string; description: string }>
  ): Promise<Map<string, string>> {
    console.log('[CausalReasoner] Performing causal reasoning');

    const prompt = `分析推荐这些项目的原因和推理过程。

用户查询：${query}

推荐项目：
${items.map((item, i) => `${i + 1}. [${item.id}] ${item.title} - ${item.description.substring(0, 80)}`).join('\n')}

请为每个推荐项目生成因果推理链，返回JSON：
{
  "reasonings": [
    { "id": "rec_1", "reasoning": "因为用户关注学习，而这个是经典教材..." },
    { "id": "rec_2", "reasoning": "由于用户提到实践需求，推荐这个项目..." }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是一个因果推理专家，擅长分析推荐背后的原因。返回JSON格式。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const reasoningMap = new Map<string, string>();
        parsed.reasonings.forEach((r: any) => {
          reasoningMap.set(r.id, r.reasoning);
        });
        console.log('[CausalReasoner] Generated', reasoningMap.size, 'reasonings');
        return reasoningMap;
      }
    } catch (e) {
      console.error('[CausalReasoner] Parse error:', e);
    }

    // 返回空推理
    return new Map();
  }

  /**
   * 排序智能体（增强版）
   *
   * 对候选项进行综合评分排序（融合相似度、因果推理、知识图谱）
   */
  private async runRankingAgent(
    items: Array<{
      id: string;
      title: string;
      description: string;
      source: string;
      features: Record<string, any>;
      relevanceScore: number;
      matchReasons?: string[];
    }>,
    query: string,
    context: { knowledgeContext?: string; webContext?: string },
    similarities?: Map<string, number>,
    causalChain?: Map<string, string>,
    kgRelations?: Map<string, Array<{ relation: string; confidence: number }>>
  ): Promise<Array<{
    id: string;
    title: string;
    description: string;
    source: string;
    features: Record<string, any>;
    score: number;
    confidence: number;
    matchReasons: string[];
    similarityScore?: number;
    causalReasoning?: string;
    kgRelationInfo?: Array<{ relation: string; confidence: number }>;
  }>> {
    console.log('[RankingAgent] Enhanced ranking with', {
      similarities: similarities?.size || 0,
      causalReasoning: causalChain?.size || 0,
      kgRelations: kgRelations?.size || 0,
    });

    const prompt = `对以下推荐候选进行综合评分排序。

用户查询：${query}

候选项目：
${items.map((item, i) => {
  const similarity = similarities?.get(item.id);
  const causal = causalChain?.get(item.id);
  const kgRel = kgRelations?.get(item.id);
  return `
${i + 1}. [${item.id}] ${item.title}
   描述：${item.description}
   相关性：${item.relevanceScore}
   相似度：${similarity?.toFixed(2) || 'N/A'}
   因果推理：${causal || '无'}
   知识图谱关系：${kgRel?.map(r => `${r.relation}(${(r.confidence * 100).toFixed(0)}%)`).join(', ') || '无'}
   匹配原因：${item.matchReasons?.join('、') || '未知'}
`;
}).join('\n')}

请综合考虑以下因素进行评分：
1. 与用户查询的相关性
2. 信息来源的可靠性
3. 推荐的实用价值
4. 相似度分数
5. 因果推理的合理性
6. 知识图谱关系的置信度

返回JSON：
{
  "rankings": [
    {
      "id": "rec_1",
      "score": 0.95,
      "confidence": 0.85,
      "rankingReasons": ["原因1", "原因2"]
    }
  ]
}`;

    const response = await this.llmClient.invoke([
      { role: 'system', content: '你是一个推荐排序专家，擅长综合评估推荐质量。返回JSON格式。' },
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const rankingMap = new Map(parsed.rankings.map((r: any) => [r.id, r]));

        return items.map(item => {
          const ranking = rankingMap.get(item.id);
          return {
            ...item,
            score: ranking?.score || item.relevanceScore,
            confidence: ranking?.confidence || 0.7,
            matchReasons: ranking?.rankingReasons || item.matchReasons || [],
            // 新增：融合额外信息
            similarityScore: similarities?.get(item.id),
            causalReasoning: causalChain?.get(item.id),
            kgRelationInfo: kgRelations?.get(item.id),
          };
        }).sort((a, b) => b.score - a.score);
      }
    } catch (e) {
      console.error('[RankingAgent] Parse error:', e);
    }

    return items.map(item => ({
      ...item,
      score: item.relevanceScore,
      confidence: 0.7,
      matchReasons: item.matchReasons || [],
      similarityScore: similarities?.get(item.id),
      causalReasoning: causalChain?.get(item.id),
      kgRelationInfo: kgRelations?.get(item.id),
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * 解释生成智能体（核心！）
   * 
   * 为每个推荐生成有依据的解释
   */
  private async runExplanationGenerator(
    items: Array<{
      id: string;
      title: string;
      description: string;
      source: string;
      features: Record<string, any>;
      score: number;
      confidence: number;
      matchReasons: string[];
    }>,
    query: string,
    context: { knowledgeContext?: string; webContext?: string; sources?: string[] },
    intentResult: any
  ): Promise<AgentRecommendationItem[]> {
    console.log('[ExplanationGenerator] Generating explanations for', items.length, 'items');

    const explanations = await Promise.all(
      items.map(async (item) => {
        const explanation = await this.generateSingleExplanation(
          item,
          query,
          context,
          intentResult
        );
        
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          score: item.score,
          confidence: item.confidence,
          explanations: [explanation],
          source: item.source,
          metadata: {
            features: item.features,
            matchReasons: item.matchReasons,
          },
        };
      })
    );

    return explanations;
  }

  /**
   * 生成单个推荐的解释
   */
  private async generateSingleExplanation(
    item: {
      id: string;
      title: string;
      description: string;
      source: string;
      features: Record<string, any>;
      score: number;
      confidence: number;
      matchReasons: string[];
    },
    query: string,
    context: { knowledgeContext?: string; webContext?: string; sources?: string[] },
    intentResult: any
  ): Promise<{
    type: string;
    reason: string;
    factors: ExplanationFactor[];
    weight: number;
  }> {
    const prompt = `你是OpenXRec的解释生成智能体。为以下推荐生成有依据、可解释的推荐理由。

## 用户查询
${query}

## 用户意图分析
- 场景类型：${intentResult.scenarioType}
- 推荐类型：${intentResult.recommendationType}
- 识别实体：${intentResult.entities?.map((e: any) => `${e.name}(${e.type})`).join('、') || '无'}
- 用户意图：${intentResult.userIntent}

## 推荐项目
- 标题：${item.title}
- 描述：${item.description}
- 评分：${(item.score * 100).toFixed(0)}%
- 信息来源：${item.source}
- 匹配原因：${item.matchReasons?.join('、') || '综合匹配'}

## 信息来源
${context.knowledgeContext ? `知识库：${context.knowledgeContext.substring(0, 300)}...` : '无知识库信息'}
${context.webContext ? `搜索结果：${context.webContext.substring(0, 300)}...` : '无搜索结果'}

## 任务
生成一个简洁、有说服力、基于事实的推荐理由。

**要求**：
1. 推荐理由要具体，说明为什么这个推荐适合用户
2. 引用具体的信息来源（如果有）
3. 突出这个推荐的核心优势
4. 控制在50-80字

**输出格式**（JSON）：
{
  "type": "feature_similarity|behavioral|causal|knowledge_graph|collaborative|rule_based",
  "reason": "推荐理由（50-80字，具体、有说服力）",
  "factors": [
    {"name": "因素名称", "value": "因素值", "importance": 0.8, "category": "user|item|context|knowledge"}
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是推荐解释生成专家，擅长生成简洁、有说服力的推荐理由。返回JSON格式。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.5,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'feature_similarity',
          reason: parsed.reason || '基于综合分析推荐',
          factors: parsed.factors || [],
          weight: 1.0,
        };
      }
    } catch (e) {
      console.error('[ExplanationGenerator] Parse error for item', item.id, e);
    }

    // 降级：基于现有信息生成简单理由
    const fallbackReason = this.generateFallbackReason(item, intentResult, context);
    return {
      type: 'feature_similarity',
      reason: fallbackReason,
      factors: item.matchReasons.map((reason, i) => ({
        name: `匹配因素${i + 1}`,
        value: reason,
        importance: item.score * (1 - i * 0.1),
        category: 'item' as const,
      })),
      weight: 1.0,
    };
  }

  /**
   * 生成降级推荐理由
   */
  private generateFallbackReason(
    item: {
      title: string;
      description: string;
      source: string;
      score: number;
      matchReasons: string[];
    },
    intentResult: any,
    context: { knowledgeContext?: string; webContext?: string }
  ): string {
    const parts: string[] = [];

    // 基于来源
    if (item.source.includes('知识库')) {
      parts.push('来自预置知识库的专业内容');
    } else if (item.source.includes('互联网') || item.source.includes('搜索')) {
      parts.push('基于互联网实时信息');
    } else {
      parts.push('基于AI专业分析');
    }

    // 基于匹配原因
    if (item.matchReasons.length > 0) {
      parts.push(item.matchReasons[0]);
    }

    // 基于评分
    if (item.score >= 0.9) {
      parts.push('高度匹配您的需求');
    } else if (item.score >= 0.7) {
      parts.push('较好地满足您的需求');
    }

    return parts.join('，') + '。';
  }

  /**
   * 多样性优化智能体
   * 
   * 优化推荐结果的多样性
   */
  private async runDiversityOptimizer(
    items: AgentRecommendationItem[]
  ): Promise<AgentRecommendationItem[]> {
    // 简化实现：确保推荐结果的多样性
    // 如果有多个相同来源的推荐，适当调整顺序
    const sourceCounts = new Map<string, number>();
    
    return items.map(item => {
      const sourceKey = item.source.split('/')[0]; // 取主要来源
      const count = sourceCounts.get(sourceKey) || 0;
      sourceCounts.set(sourceKey, count + 1);
      
      // 同来源连续出现的项降低优先级
      if (count >= 2) {
        return {
          ...item,
          score: item.score * 0.95,
        };
      }
      return item;
    }).sort((a, b) => b.score - a.score);
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 确定推荐策略
   */
  private determineStrategy(sources?: string[]): string {
    if (!sources || sources.length === 0) {
      return 'agent_based';
    }
    
    if (sources.includes('preset_knowledge') && sources.includes('web_search')) {
      return 'multi_source_agent';
    }
    
    if (sources.includes('preset_knowledge')) {
      return 'knowledge_agent';
    }
    
    if (sources.includes('web_search')) {
      return 'web_search_agent';
    }
    
    return 'llm_agent';
  }

  /**
   * 构建推理链
   */
  private buildReasoningChain(
    intentResult: any,
    items: any[],
    agentsUsed: string[]
  ): string[] {
    const chain: string[] = [];

    chain.push(`意图分析：识别为${intentResult.scenarioType}场景，${intentResult.recommendationType}型推荐`);
    chain.push(`候选生成：生成${items.length}个推荐候选`);
    chain.push(`特征提取：分析每个候选的特征和相关性`);
    chain.push(`排序决策：综合评分排序`);
    chain.push(`解释生成：为每个推荐生成推荐理由`);
    chain.push(`多样性优化：优化推荐结果的多样性`);

    return chain;
  }

  /**
   * 生成整体解释
   */
  private generateOverallExplanation(
    intentResult: any,
    items: AgentRecommendationItem[]
  ): string {
    if (items.length === 0) {
      return '暂无符合您需求的推荐结果。';
    }

    const topItem = items[0];
    const scenarioText = {
      '开店': '选址开店',
      '投资': '投资决策',
      '旅游': '旅行规划',
      '购物': '购物选择',
      '学习': '学习资源',
      'general': '综合推荐',
    }[intentResult.scenarioType] || '综合分析';

    return `基于${scenarioText}场景分析，为您推荐${items.length}个选项。首选"${topItem.title}"，${topItem.explanations[0]?.reason || '综合评估最优'}`;
  }

  /**
   * 降级处理：直接使用 LLM 生成
   */
  private async fallbackGeneration(
    query: string,
    context: {
      knowledgeContext?: string;
      webContext?: string;
      sources?: string[];
    }
  ): Promise<AgentRecommendationResult> {
    console.log('[AgentRecommendationService] Using fallback generation');

    const systemPrompt = `你是OpenXRec推荐助手。

**输出要求**：
- 提供3-5个具体的推荐项目
- 每个推荐要有：标题、详细描述、推荐理由

**输出格式**（严格JSON）：
{
  "items": [
    {
      "id": "rec_1",
      "title": "推荐标题",
      "description": "详细描述",
      "reason": "推荐理由",
      "score": 0.9
    }
  ],
  "explanation": "整体推荐说明"
}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `用户需求：${query}

${context.knowledgeContext || context.webContext ? `请根据以下信息来源给出推荐：${context.knowledgeContext || ''}${context.webContext || ''}` : '请根据你的专业知识给出推荐。'}
` 
      },
    ];

    const response = await this.llmClient.invoke(messages, {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const items: AgentRecommendationItem[] = (parsed.items || []).map((item: any, index: number) => ({
          id: item.id || `rec_${index + 1}`,
          title: item.title || `推荐 ${index + 1}`,
          description: item.description || '',
          score: item.score || 0.8,
          confidence: 0.7,
          explanations: [{
            type: 'feature_similarity',
            reason: item.reason || '基于综合分析推荐',
            factors: [],
            weight: 1.0,
          }],
          source: context.sources?.join('+') || 'LLM',
        }));

        return {
          items,
          strategy: 'llm_fallback',
          explanation: parsed.explanation || '基于AI分析的推荐',
          metadata: {
            agentsUsed: ['llm_fallback'],
            confidence: 0.7,
            reasoningChain: ['降级处理：直接LLM生成'],
          },
        };
      }
    } catch (e) {
      console.error('[AgentRecommendationService] Fallback parse error:', e);
    }

    // 最终兜底
    return {
      items: [],
      strategy: 'error_fallback',
      explanation: '抱歉，推荐服务暂时遇到问题，请稍后重试。',
      metadata: {
        agentsUsed: [],
        confidence: 0,
        reasoningChain: ['错误：推荐生成失败'],
      },
    };
  }

  // ============================================================================
  // 对比分析型查询处理
  // ============================================================================

  /**
   * 生成对比分析结果
   * 
   * 专门处理"对比A和B的优缺点"这类查询
   * 输出一个综合分析结果，而不是多个推荐项
   */
  private async generateComparisonAnalysis(
    query: string,
    context: {
      knowledgeContext?: string;
      webContext?: string;
      sources?: string[];
    },
    intentResult: any
  ): Promise<AgentRecommendationResult> {
    console.log('[ComparisonAnalysis] Generating comparison analysis...');
    console.log('[ComparisonAnalysis] Entities:', intentResult.entities?.map((e: any) => e.name).join(' vs '));

    // ========================================
    // 使用模板系统
    // ========================================
    const templateMatch = this.templateSelector.selectTemplate(query, {
      type: intentResult.queryType || 'comparison_analysis',
      confidence: intentResult.confidence,
      entities: intentResult.entities,
    });

    console.log('[Template] Selected:', templateMatch.template.id, 'Score:', templateMatch.score);

    const entities = intentResult.entities || [];
    const sources = this.extractSources(context);

    // 构建模板渲染上下文
    const templateContext = {
      query,
      entities: entities.map((e: any) => ({
        name: e.name,
        type: e.type || '未知类型',
      })),
      sources,
      requirements: intentResult.constraints?.map((c: any) => `${c.name}: ${c.value}`) || [],
    };

    try {
      // 使用模板渲染
      const { output } = await TemplateRenderService.renderWithLLM(
        templateMatch.template,
        templateContext,
        {
          chat: async (params) => {
            const response = await this.llmClient.invoke(
              [
                { role: 'system', content: '你是一个专业的推荐顾问，请严格按照指定的JSON格式输出。' },
                ...params.messages,
              ],
              {
                model: 'doubao-seed-2-0-pro-260215',
                temperature: 0.5,
              }
            );
            return { content: response.content };
          },
        }
      );

      console.log('[ComparisonAnalysis] Analysis generated for', output.entities?.length, 'entities');

      // 将对比分析结果转换为单个"推荐项"
      const comparisonItem = this.convertAnalysisToItem(output, query);

      return {
        items: [comparisonItem],
        strategy: 'comparison_analysis',
        explanation: output.summary || output.conclusion || `为您对比分析了${entities.map((e: any) => e.name).join('和')}的优缺点。`,
        metadata: {
          agentsUsed: ['intent_analyzer', 'template_renderer'],
          confidence: 0.85,
          reasoningChain: [
            '意图分析：识别为对比分析型查询',
            `模板选择：${templateMatch.template.name} (分数: ${templateMatch.score.toFixed(2)})`,
            `实体识别：${entities.map((e: any) => e.name).join(' vs ')}`,
            '对比分析：生成优缺点对比',
            '综合结论：提供选择建议',
          ],
          queryType: 'comparison_analysis',
          templateId: templateMatch.template.id,
          templateName: templateMatch.template.name,
        },
      };
    } catch (e) {
      console.error('[ComparisonAnalysis] Template rendering error:', e);
      // 降级：使用原有的直接 LLM 方式
      return this.fallbackComparisonAnalysis(query, context, entities);
    }
  }

  /**
   * 提取信息来源
   */
  private extractSources(context: {
    knowledgeContext?: string;
    webContext?: string;
    sources?: string[];
  }): Array<{ title: string; snippet?: string; url?: string }> {
    const sources: Array<{ title: string; snippet?: string; url?: string }> = [];

    if (context.knowledgeContext) {
      sources.push({
        title: '知识库',
        snippet: context.knowledgeContext.substring(0, 200),
      });
    }

    if (context.webContext) {
      // 尝试从网页上下文中提取来源
      const lines = context.webContext.split('\n').filter((l) => l.trim());
      for (const line of lines.slice(0, 3)) {
        sources.push({
          title: line.substring(0, 50),
          snippet: line.substring(0, 150),
        });
      }
    }

    return sources;
  }

  /**
   * 降级的对比分析
   */
  private async fallbackComparisonAnalysis(
    query: string,
    context: any,
    entities: any[]
  ): Promise<AgentRecommendationResult> {
    const prompt = `你是一个专业的对比分析专家。用户想要对比以下选项的优缺点。

## 用户查询
${query}

## 要对比的实体
${entities.map((e: any) => `- ${e.name}（${e.type}）`).join('\n') || '需要从查询中识别'}

## 输出格式（严格JSON）
{
  "entities": [
    {
      "name": "实体名称",
      "pros": ["优点1", "优点2"],
      "cons": ["缺点1"]
    }
  ],
  "summary": "对比总结",
  "conclusion": "选择建议"
}`;

    const response = await this.llmClient.invoke([
      { role: 'system', content: '你是一个专业的对比分析专家。返回JSON格式。' },
      { role: 'user', content: prompt },
    ]);

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      const comparisonItem = this.convertAnalysisToItem(analysis, query);
      return {
        items: [comparisonItem],
        strategy: 'comparison_analysis_fallback',
        explanation: analysis.summary || '对比分析完成',
        metadata: {
          agentsUsed: ['intent_analyzer', 'fallback_analyzer'],
          confidence: 0.7,
          reasoningChain: ['降级处理：直接LLM生成'],
          queryType: 'comparison_analysis',
        },
      };
    }

    throw new Error('Fallback comparison analysis failed');
  }

  /**
   * 将对比分析结果转换为推荐项格式
   */
  private convertAnalysisToItem(analysis: any, query: string): AgentRecommendationItem {
    const entities = analysis.entities || [];
    
    // 构建综合描述
    let description = '';
    
    // 逐个实体展示优缺点
    entities.forEach((entity: any, index: number) => {
      description += `### ${entity.name}\n\n`;
      
      if (entity.pros && entity.pros.length > 0) {
        description += `**优点：**\n`;
        entity.pros.forEach((pro: string) => {
          description += `- ✅ ${pro}\n`;
        });
      }
      
      if (entity.cons && entity.cons.length > 0) {
        description += `\n**缺点：**\n`;
        entity.cons.forEach((con: string) => {
          description += `- ❌ ${con}\n`;
        });
      }
      
      description += '\n---\n\n';
    });

    // 添加综合结论
    if (analysis.conclusion) {
      description += `### 综合建议\n\n`;
      if (analysis.conclusion.summary) {
        description += `${analysis.conclusion.summary}\n\n`;
      }
      if (analysis.conclusion.recommendation) {
        description += `**选择建议**：${analysis.conclusion.recommendation}\n`;
      }
    }

    // 构建推荐理由
    let reason = '';
    if (entities.length >= 2) {
      reason = `对比分析了${entities[0].name}和${entities[1].name}的优缺点。`;
      if (analysis.conclusion?.recommendation) {
        reason += analysis.conclusion.recommendation;
      }
    } else {
      reason = '提供了综合对比分析，帮助您做出选择。';
    }

    // 构建信息源
    const sources = analysis.sources || [];
    let sourceText = '综合分析';
    let sourceUrl: string | undefined;
    
    if (sources.length > 0) {
      sourceText = sources.map((s: any) => s.title).join('、');
    }

    return {
      id: 'comparison_analysis_1',
      title: `${entities.map((e: any) => e.name).join(' vs ')} 对比分析`,
      description: description.trim(),
      score: 0.95,
      confidence: 0.85,
      explanations: [{
        type: 'comparison_analysis',
        reason: reason,
        factors: entities.map((e: any, i: number) => ({
          name: e.name,
          value: `优点${e.pros?.length || 0}条，缺点${e.cons?.length || 0}条`,
          importance: 0.9 - i * 0.1,
          category: 'item' as const,
        })),
        weight: 1.0,
      }],
      source: sourceText,
      sourceUrl: sourceUrl,
      metadata: {
        entities: entities.map((e: any) => ({
          name: e.name,
          pros: e.pros,
          cons: e.cons,
        })),
        conclusion: analysis.conclusion,
        sources: sources,
        isComparisonAnalysis: true,
      },
    };
  }

  /**
   * 配置优化智能体（低优先级优化，异步调用）
   *
   * 基于推荐结果动态调整推荐配置
   */
  private async runConfigOptimizer(data: {
    query: string;
    intent: any;
    recommendations: any[];
    context: any;
  }): Promise<void> {
    console.log('[ConfigOptimizer] Analyzing recommendation performance for config optimization');

    const { query, intent, recommendations, context } = data;

    // 计算推荐质量指标
    const avgConfidence = recommendations.length > 0
      ? recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length
      : 0;

    const avgScore = recommendations.length > 0
      ? recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length
      : 0;

    const prompt = `基于以下推荐结果分析并优化推荐策略配置。

用户查询：${query}
查询意图：${JSON.stringify(intent)}

推荐结果统计：
- 推荐数量：${recommendations.length}
- 平均置信度：${(avgConfidence * 100).toFixed(1)}%
- 平均评分：${(avgScore * 100).toFixed(1)}%

信息来源：${context.sources?.join(', ') || '未知'}

当前推荐策略权重（假设）：
- 基于内容：30%
- 协同过滤：30%
- 知识图谱：20%
- 智能体驱动：10%
- 因果推断：10%

请分析当前推荐策略的效果，返回JSON：
{
  "analysis": {
    "quality": "high|medium|low",
    "confidence": 0.85,
    "suggestions": ["建议1", "建议2"]
  },
  "optimizedWeights": {
    "content_based": 0.35,
    "collaborative": 0.25,
    "knowledge_based": 0.25,
    "agent_based": 0.10,
    "causal_based": 0.05
  },
  "reasoning": "基于分析结果，建议调整权重的原因"
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是一个推荐策略优化专家，擅长分析推荐效果并优化配置。返回JSON格式。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[ConfigOptimizer] Optimization result:', {
          quality: parsed.analysis.quality,
          suggestions: parsed.analysis.suggestions,
          weights: parsed.optimizedWeights,
          reasoning: parsed.reasoning,
        });
        // TODO: 实际应用中，这里应该将优化的权重保存到数据库或配置管理器
      }
    } catch (e) {
      console.error('[ConfigOptimizer] Parse error:', e);
    }
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let serviceInstance: AgentRecommendationService | null = null;

export function getAgentRecommendationService(
  llmClient?: LLMClient,
  config?: AgentServiceConfig
): AgentRecommendationService {
  if (!serviceInstance || llmClient) {
    serviceInstance = new AgentRecommendationService(llmClient, config);
  }
  return serviceInstance;
}
