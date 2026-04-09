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
import type {
  ExplanationFactor,
  RecommendationItem,
  RecommendationContext,
  UserProfile,
} from './types';
import { getChatModelId } from '@/lib/llm/chat-model';
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
    userSegment?: UserSegmentProfile;
    templateId?: string;
    [key: string]: unknown;
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
    /** 相对同批其他选项的差异（多推荐对比时使用） */
    differentiator?: string;
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

type TaskComplexity = 'simple' | 'moderate' | 'complex';

interface RecommendationExecutionPlan {
  complexity: TaskComplexity;
  useSimilarity: boolean;
  useKnowledgeGraphReasoning: boolean;
  useCausalReasoning: boolean;
  useDiversityOptimizer: boolean;
}

interface UserSegmentProfile {
  segment: string;
  experienceLevel: string;
  riskPreference: string;
  timeHorizon: string;
  primaryGoals: string[];
}

interface KGEvidence {
  relation: string;
  confidence: number;
  kind: 'association' | 'causal_hint';
  path?: string;
  evidence?: string;
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
      /** 服务端或客户端传入的用户画像（与查询合并用于解释） */
      userProfile?: Partial<UserProfile> | null;
      /** 会话级补充：设备、地域、上一轮追问答案等 */
      sessionHints?: string;
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

      const executionPlan = this.planExecutionByComplexity(query, context, intentResult);
      console.log('[AgentRecommendationService] Execution plan:', executionPlan);
      const userSegment = this.buildUserSegmentProfile(query, context);

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
      const similarityTask = executionPlan.useSimilarity
        ? this.runSimilarityCalculator(itemsWithFeatures, query, context)
        : Promise.resolve(new Map<string, number>());
      const kgTask = executionPlan.useKnowledgeGraphReasoning
        ? this.runKGReasoner(query, itemsWithFeatures)
        : Promise.resolve(new Map<string, KGEvidence[]>());

      const [similarities, kgRelations] = await Promise.all([
        similarityTask,
        kgTask,
      ]);
      const causalChain = executionPlan.useCausalReasoning
        ? await this.runCausalReasoner(query, itemsWithFeatures, kgRelations)
        : new Map<string, string>();
      if (executionPlan.useSimilarity) agentsUsed.push('similarity_calculator');
      if (executionPlan.useKnowledgeGraphReasoning) agentsUsed.push('kg_reasoner');
      if (executionPlan.useCausalReasoning) agentsUsed.push('causal_reasoner');

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
        kgRelations,
        userSegment
      );
      agentsUsed.push('ranking_agent');

      // ========================================
      // 阶段5：解释生成智能体（核心！）
      // ========================================
      console.log('[AgentRecommendationService] Phase 5: Explanation Generation Agent');
      const itemsWithExplanations = await this.runExplanationGenerator(
        rankedItems,
        query,
        {
          ...context,
          userProfile: context.userProfile ?? undefined,
          sessionHints: context.sessionHints,
        },
        intentResult,
        userSegment,
        kgRelations,
        causalChain
      );
      agentsUsed.push('explanation_generator');

      // ========================================
      // 阶段6：多样性优化智能体
      // ========================================
      let optimizedItems = itemsWithExplanations;
      if (executionPlan.useDiversityOptimizer) {
        console.log('[AgentRecommendationService] Phase 6: Diversity Optimization Agent');
        optimizedItems = await this.runDiversityOptimizer(itemsWithExplanations);
        agentsUsed.push('diversity_optimizer');
      }

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
        explanation: this.generateOverallExplanation(intentResult, optimizedItems, userSegment),
        metadata: {
          agentsUsed,
          confidence: avgConfidence,
          reasoningChain,
          queryType: 'recommendation' as const,
          userSegment,
        },
      };
    } catch (error) {
      console.error('[AgentRecommendationService] Error:', error);
      
      // 降级处理：直接使用 LLM 生成推荐
      console.log('[AgentRecommendationService] Falling back to direct LLM generation');
      return this.fallbackGeneration(query, context);
    }
  }

  /**
   * 基于任务复杂度动态编排推荐智能体。
   * - simple：轻链路（相似度 + 排序 + 解释）
   * - moderate：中链路（加入 KG）
   * - complex：全链路（KG + 因果 + 多样性）
   */
  private planExecutionByComplexity(
    query: string,
    context: {
      webContext?: string;
      knowledgeContext?: string;
      userProfile?: Partial<UserProfile> | null;
      sessionHints?: string;
    },
    intentResult: {
      recommendationType?: string;
      informationSufficiency?: { score?: number; isSufficient?: boolean; missingFields?: string[] };
      entities?: Array<{ name: string; type: string }>;
      constraints?: Array<{ name: string; value: string }>;
    }
  ): RecommendationExecutionPlan {
    if (this.config.useFullPipeline) {
      return {
        complexity: 'complex',
        useSimilarity: true,
        useKnowledgeGraphReasoning: !this.config.skipKnowledgeGraph,
        useCausalReasoning: true,
        useDiversityOptimizer: true,
      };
    }

    const queryLen = query.length;
    const hasExternalContext = Boolean(context.webContext || context.knowledgeContext);
    const hasProfile = Boolean(
      context.userProfile?.interests?.length ||
      (context.userProfile?.preferences && Object.keys(context.userProfile.preferences).length > 0)
    );
    const entityCount = intentResult.entities?.length || 0;
    const constraintCount = intentResult.constraints?.length || 0;
    const missingCount = intentResult.informationSufficiency?.missingFields?.length || 0;
    const suffScore = intentResult.informationSufficiency?.score ?? 0.5;
    const recType = intentResult.recommendationType || 'comparison';

    let complexity: TaskComplexity = 'simple';
    const complexSignals =
      queryLen > 35 || hasExternalContext || entityCount >= 3 || constraintCount >= 2 || missingCount >= 2;
    const moderateSignals =
      queryLen > 18 || entityCount >= 2 || constraintCount >= 1 || recType === 'ranking' || hasProfile;

    if (complexSignals) complexity = 'complex';
    else if (moderateSignals) complexity = 'moderate';
    if (suffScore < 0.55 && complexity !== 'complex') complexity = 'moderate';

    const useKnowledgeGraphReasoning =
      !this.config.skipKnowledgeGraph && (complexity === 'complex' || complexity === 'moderate');
    const useCausalReasoning = complexity === 'complex' && suffScore >= 0.5;
    const useDiversityOptimizer = complexity !== 'simple' || recType === 'comparison';

    return {
      complexity,
      useSimilarity: true,
      useKnowledgeGraphReasoning,
      useCausalReasoning,
      useDiversityOptimizer,
    };
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
        const parsed = JSON.parse(jsonMatch[0]) as { items?: Array<{ id: string; features?: Record<string, any>; relevanceScore?: number; matchReasons?: string[] }> };
        const featureMap = new Map<string, { id: string; features?: Record<string, any>; relevanceScore?: number; matchReasons?: string[] }>(
          (parsed.items || []).map((item) => [item.id, item])
        );
        
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
  ): Promise<Map<string, KGEvidence[]>> {
    console.log('[KGReasoner] Performing knowledge graph reasoning');

    const entities = items.map(item => ({
      id: item.id,
      name: item.title,
    }));
    const scopedKGContext = this.buildScopedKGContext(query, items);

    const prompt = `你将基于“局部相关子图”进行推理，不要假设全图信息。

请区分：
- association：共现/相关/相似/互补（非因果）
- causal_hint：可能存在方向性的影响线索（仅提示，不等同已证实因果）

分析用户查询和推荐项之间的潜在关系。

用户查询：${query}

推荐实体：
${entities.map((e, i) => `${i + 1}. [${e.id}] ${e.name}`).join('\n')}

局部子图证据（已按关键词过滤）：
${scopedKGContext || '无可用局部子图，仅基于查询与候选标题推理'}

请分析这些实体之间的关系类型，返回JSON：
{
  "relations": [
    {
      "id": "rec_1",
      "relations": [
        {
          "type": "相关",
          "kind": "association",
          "confidence": 0.8,
          "path": "A -> B",
          "evidence": "来自局部子图的相关关系"
        },
        {
          "type": "影响",
          "kind": "causal_hint",
          "confidence": 0.68,
          "path": "A -> C -> B",
          "evidence": "方向性线索，待因果模块验证"
        }
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
        const relationMap = new Map<string, KGEvidence[]>();
        parsed.relations.forEach((r: any) => {
          const relations = Array.isArray(r.relations) ? r.relations : [];
          relationMap.set(
            r.id,
            relations.map((x: any) => ({
              relation: x.type || '关联',
              confidence: Number(x.confidence) || 0.6,
              kind: x.kind === 'causal_hint' ? 'causal_hint' : 'association',
              path: typeof x.path === 'string' ? x.path : undefined,
              evidence: typeof x.evidence === 'string' ? x.evidence : undefined,
            }))
          );
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
    items: Array<{ id: string; title: string; description: string }>,
    kgRelations?: Map<string, KGEvidence[]>
  ): Promise<Map<string, string>> {
    console.log('[CausalReasoner] Performing causal reasoning');

    const prompt = `分析推荐这些项目的原因和推理过程。

用户查询：${query}

推荐项目：
${items.map((item, i) => `${i + 1}. [${item.id}] ${item.title} - ${item.description.substring(0, 80)}`).join('\n')}

知识图谱因果线索（causal_hint）：
${items.map((item) => {
  const hints = (kgRelations?.get(item.id) || [])
    .filter((r) => r.kind === 'causal_hint')
    .slice(0, 3)
    .map((r) => `${r.relation}(${(r.confidence * 100).toFixed(0)}%) ${r.path || ''}`.trim())
    .join('；');
  return `- ${item.id}: ${hints || '无'}`;
}).join('\n')}

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
    kgRelations?: Map<string, KGEvidence[]>,
    userSegment?: UserSegmentProfile
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
    kgRelationInfo?: KGEvidence[];
  }>> {
    console.log('[RankingAgent] Enhanced ranking with', {
      similarities: similarities?.size || 0,
      causalReasoning: causalChain?.size || 0,
      kgRelations: kgRelations?.size || 0,
    });

    const prompt = `对以下推荐候选进行综合评分排序。

用户查询：${query}

用户画像区分：
${userSegment ? JSON.stringify(userSegment, null, 2) : '未提供，按通用用户排序'}

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
   知识图谱关系：${kgRel?.map(r => `${r.kind === 'causal_hint' ? '因果线索' : '关联'}:${r.relation}(${(r.confidence * 100).toFixed(0)}%)`).join(', ') || '无'}
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
        const parsed = JSON.parse(jsonMatch[0]) as {
          rankings?: Array<{ id: string; score?: number; confidence?: number; rankingReasons?: string[] }>;
        };
        const rankingMap = new Map<string, { id: string; score?: number; confidence?: number; rankingReasons?: string[] }>(
          (parsed.rankings || []).map((r) => [r.id, r])
        );

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

  /** 合并显式画像、会话与查询推断，供推荐理由使用 */
  private async buildUserPerspectiveNarrative(
    query: string,
    context: {
      knowledgeContext?: string;
      webContext?: string;
      userProfile?: Partial<UserProfile> | null;
      sessionHints?: string;
    }
  ): Promise<string> {
    const parts: string[] = [];
    const segment = this.buildUserSegmentProfile(query, context);
    parts.push(
      `画像分层：${segment.segment}；经验层次=${segment.experienceLevel}；风险偏好=${segment.riskPreference}；时间视野=${segment.timeHorizon}`
    );
    if (segment.primaryGoals.length) {
      parts.push(`核心目标：${segment.primaryGoals.join('、')}`);
    }
    const p = context.userProfile;
    if (p?.interests?.length) {
      parts.push(`兴趣与关注：${p.interests.join('、')}`);
    }
    if (p?.preferences && typeof p.preferences === 'object') {
      const pref = p.preferences as Record<string, unknown>;
      const seg = pref.segment ?? pref.role ?? pref['用户类型'];
      if (typeof seg === 'string' && seg.trim()) {
        parts.push(`画像区分 / 角色：${seg.trim()}`);
      }
      if (Array.isArray(pref.goals) && pref.goals.length) {
        parts.push(`目标：${(pref.goals as string[]).join('、')}`);
      }
    }
    if (p?.demographics?.occupation) {
      parts.push(`职业/身份：${p.demographics.occupation}`);
    }
    if (p?.demographics?.location) {
      parts.push(`地域：${p.demographics.location}`);
    }
    if (context.sessionHints?.trim()) {
      parts.push(`会话补充：${context.sessionHints.trim().slice(0, 500)}`);
    }
    if (parts.length === 0) {
      return this.inferPersonaFromQuery(query);
    }
    return ['【用户画像与情境】', ...parts].join('\n');
  }

  private buildUserSegmentProfile(
    query: string,
    context: {
      userProfile?: Partial<UserProfile> | null;
      sessionHints?: string;
    }
  ): UserSegmentProfile {
    const p = context.userProfile;
    const pref = (p?.preferences || {}) as Record<string, unknown>;
    const text = `${query} ${context.sessionHints || ''}`.toLowerCase();

    const experienceLevel =
      (typeof pref.experienceLevel === 'string' && pref.experienceLevel) ||
      (typeof pref.level === 'string' && pref.level) ||
      (/入门|新手|基础|从零/.test(text) ? 'beginner' : /进阶|深入|系统|专业/.test(text) ? 'advanced' : 'intermediate');

    const riskPreference =
      (typeof pref.riskPreference === 'string' && pref.riskPreference) ||
      (typeof pref.risk === 'string' && pref.risk) ||
      (/保守|稳健|低风险/.test(text) ? 'conservative' : /激进|高风险|收益最大/.test(text) ? 'aggressive' : 'balanced');

    const timeHorizon =
      (typeof pref.timeHorizon === 'string' && pref.timeHorizon) ||
      (/短期|尽快|马上|本周/.test(text) ? 'short_term' : /长期|体系|长期规划/.test(text) ? 'long_term' : 'mid_term');

    const explicitGoals = Array.isArray(pref.goals) ? pref.goals.filter(Boolean).map(String) : [];
    const inferredGoals: string[] = [];
    if (/学习|课程|教程|资料/.test(text)) inferredGoals.push('系统学习');
    if (/实战|项目|落地|部署/.test(text)) inferredGoals.push('实战应用');
    if (/比较|对比|选型|优缺点/.test(text)) inferredGoals.push('方案对比决策');

    const segment =
      (typeof pref.segment === 'string' && pref.segment.trim()) ||
      (typeof pref.role === 'string' && pref.role.trim()) ||
      (typeof p?.demographics?.occupation === 'string' && p.demographics.occupation.trim()) ||
      '通用用户';

    return {
      segment,
      experienceLevel,
      riskPreference,
      timeHorizon,
      primaryGoals: Array.from(new Set([...explicitGoals, ...inferredGoals])).slice(0, 4),
    };
  }

  /** 无长期画像时从本次查询推断诉求（短文本） */
  private async inferPersonaFromQuery(query: string): Promise<string> {
    const prompt = `用户未提供显式画像。请只根据下面**当前查询**，用第二人称「您」概括：主要目标、约束或顾虑、经验层次（若可辨）。80字内，不要编造事实。

查询：
${query}

只输出一段中文。`;

    try {
      const res = await this.llmClient.invoke(
        [
          { role: 'system', content: '你是用户研究助手：合理推断、不编造。' },
          { role: 'user', content: prompt },
        ],
        { model: getChatModelId(), temperature: 0.2 }
      );
      const t = (res.content || '').trim();
      if (t) {
        return `【从本次提问推断的您的情况】\n${t}`;
      }
    } catch (e) {
      console.warn('[inferPersonaFromQuery]', e);
    }
    return '【未提供长期画像】请仅根据本次查询理解用户需求。';
  }

  /**
   * 多推荐一次生成：用户视角 + 条目间对比
   */
  private async generateContrastiveExplanations(
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
    context: {
      knowledgeContext?: string;
      webContext?: string;
      userProfile?: Partial<UserProfile> | null;
      sessionHints?: string;
    },
    intentResult: any,
    userPerspective: string,
    userSegment?: UserSegmentProfile,
    kgRelations?: Map<string, KGEvidence[]>,
    causalChain?: Map<string, string>
  ): Promise<AgentRecommendationItem[] | null> {
    const brief = items.map((it, i) => ({
      rank: i + 1,
      id: it.id,
      title: it.title,
      description: (it.description || '').slice(0, 360),
      scorePct: Math.round(it.score * 100),
      matchReasons: (it.matchReasons || []).slice(0, 5),
      source: (it.source || '').slice(0, 80),
    }));

    const prompt = `你是可解释推荐专家。请站在**用户（用「您」称呼）**的立场，说明每一条推荐与**其诉求/约束**的匹配关系，并写清**与同批其他选项相比**的定位差异。

## 用户查询
${query}

## 用户画像与情境（含显式画像与/或从查询推断；请区分事实与推断）
${userPerspective}

## 用户画像分层标签（用于差异化推荐）
${userSegment ? JSON.stringify(userSegment, null, 2) : '未提供'}

## 意图
- 场景：${intentResult.scenarioType}
- 推荐形态：${intentResult.recommendationType}
- 实体：${intentResult.entities?.map((e: any) => `${e.name}(${e.type})`).join('、') || '无'}
- 意图摘要：${intentResult.userIntent || '—'}

## 待解释列表（已排序，rank 越小越靠前）
${JSON.stringify(brief, null, 2)}

## 每个候选的证据（区分关联与因果）
${items.map((it) => {
  const kg = (kgRelations?.get(it.id) || []).slice(0, 4)
    .map((k) => `${k.kind === 'causal_hint' ? '因果线索' : '关联'}:${k.relation}(${(k.confidence * 100).toFixed(0)}%)`)
    .join('；');
  const causal = causalChain?.get(it.id) || '无';
  return `- ${it.id} KG=${kg || '无'} | 因果=${causal}`;
}).join('\n')}

## 可用背景（勿编造不存在的链接或机构）
${context.knowledgeContext ? `知识片段：${context.knowledgeContext.slice(0, 550)}` : ''}
${context.webContext ? `\n检索片段：${context.webContext.slice(0, 550)}` : ''}

## 任务
对每一条输出：
- reason：55～95 字；必须说明**本条如何回应查询中的具体诉求**（需求匹配），可点到来源类型（知识库/检索/模型分析），勿空洞套话。
- differentiator：45 字内；说明**若要在本批结果里选**，本条更适合哪类用户或场景（与其他条目的差异）。
- factors：2～4 条，category 仅 user|item|context|knowledge

**严格 JSON**（items 数组长度必须等于 ${brief.length}，且 itemId 与列表 id 一致）：
{
  "items": [
    {
      "itemId": "id",
      "type": "feature_similarity|behavioral|causal|knowledge_graph|collaborative|rule_based",
      "reason": "...",
      "differentiator": "...",
      "factors": [{"name":"...","value":"...","importance":0.8,"category":"user"}]
    }
  ]
}`;

    const res = await this.llmClient.invoke(
      [
        {
          role: 'system',
          content:
            '你只输出合法 JSON。推荐理由必须从用户视角写清「需求—匹配」关系，并体现多选项对比。',
        },
        { role: 'user', content: prompt },
      ],
      { model: getChatModelId(), temperature: 0.42 }
    );

    const jsonMatch = res.content?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const rows = parsed.items;
    if (!Array.isArray(rows) || rows.length !== items.length) {
      return null;
    }

    return items.map((item, idx) => {
      const row =
        rows.find((r: { itemId?: string }) => r.itemId === item.id) || rows[idx];
      const reason =
        typeof row?.reason === 'string' && row.reason.trim()
          ? row.reason.trim()
          : this.generateFallbackReason(item, intentResult, context);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        score: item.score,
        confidence: item.confidence,
        explanations: [
          {
            type: row?.type || 'feature_similarity',
            reason: this.formatEvidenceChainReason(
              reason,
              this.composeKGEvidenceLine(item.id, kgRelations),
              this.composeCausalEvidenceLine(item.id, causalChain),
              this.composeUserMatchLine(item.matchReasons, userSegment)
            ),
            differentiator:
              typeof row?.differentiator === 'string' ? row.differentiator.trim() : undefined,
            factors: Array.isArray(row?.factors) ? row.factors : [],
            weight: 1.0,
          },
        ],
        source: item.source,
        metadata: {
          features: item.features,
          matchReasons: item.matchReasons,
          comparison: this.buildComparisonMetadata(item, items),
        },
      };
    });
  }

  /**
   * 解释生成智能体（核心！）
   *
   * 多推荐时优先一次生成对比式理由；单条或批量失败时回退逐条生成。
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
    context: {
      knowledgeContext?: string;
      webContext?: string;
      sources?: string[];
      userProfile?: Partial<UserProfile> | null;
      sessionHints?: string;
    },
    intentResult: any,
    userSegment?: UserSegmentProfile,
    kgRelations?: Map<string, KGEvidence[]>,
    causalChain?: Map<string, string>
  ): Promise<AgentRecommendationItem[]> {
    console.log('[ExplanationGenerator] Generating explanations for', items.length, 'items');

    const userPerspective = await this.buildUserPerspectiveNarrative(query, context);

    if (items.length >= 2) {
      try {
        const contrast = await this.generateContrastiveExplanations(
          items,
          query,
          context,
          intentResult,
          userPerspective,
          userSegment,
          kgRelations,
          causalChain
        );
        if (contrast) {
          return contrast;
        }
      } catch (e) {
        console.warn('[ExplanationGenerator] contrastive batch failed, fallback per-item', e);
      }
    }

    const explanations = await Promise.all(
      items.map(async (item) => {
        const explanation = await this.generateSingleExplanation(
          item,
          query,
          context,
          intentResult,
          userPerspective,
          userSegment,
          kgRelations?.get(item.id),
          causalChain?.get(item.id)
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
            comparison: this.buildComparisonMetadata(item, items),
          },
        };
      })
    );

    return explanations;
  }

  /**
   * 生成单个推荐的解释（单条路径：仍带用户视角与需求匹配）
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
    intentResult: any,
    userPerspective: string,
    userSegment?: UserSegmentProfile,
    kgEvidence?: KGEvidence[],
    causalReasoning?: string
  ): Promise<{
    type: string;
    reason: string;
    factors: ExplanationFactor[];
    weight: number;
    differentiator?: string;
  }> {
    const prompt = `你是 OpenXRec 的解释生成智能体。请从**用户视角**写推荐理由：说明「用户的诉求/约束」与「本条内容」之间的**匹配关系**，避免泛泛的「很好、全面」。

## 用户查询
${query}

## 用户画像与情境
${userPerspective}

## 用户意图分析
- 场景类型：${intentResult.scenarioType}
- 推荐类型：${intentResult.recommendationType}
- 识别实体：${intentResult.entities?.map((e: any) => `${e.name}(${e.type})`).join('、') || '无'}
- 用户意图：${intentResult.userIntent}

## 推荐项目（本条）
- 标题：${item.title}
- 描述：${item.description}
- 匹配度：${(item.score * 100).toFixed(0)}%
- 信息来源：${item.source}
- 匹配原因：${item.matchReasons?.join('、') || '综合匹配'}

## 证据输入（必须区分关联与因果）
- KG关联证据：${(kgEvidence || []).filter((k) => k.kind === 'association').map((k) => `${k.relation}(${(k.confidence * 100).toFixed(0)}%)`).join('；') || '无'}
- KG因果线索：${(kgEvidence || []).filter((k) => k.kind === 'causal_hint').map((k) => `${k.relation}(${(k.confidence * 100).toFixed(0)}%)`).join('；') || '无'}
- 因果推断证据：${causalReasoning || '无'}
- 用户画像分层：${userSegment ? JSON.stringify(userSegment) : '未提供'}

## 信息来源
${context.knowledgeContext ? `知识库：${context.knowledgeContext.substring(0, 320)}` : '无知识库信息'}
${context.webContext ? `搜索结果：${context.webContext.substring(0, 320)}` : ''}

## 任务
用第二人称「您」写推荐理由（50～90 字），并保证可拼装为证据链模板。若只有单条推荐，differentiator 填「本批唯一推荐」或留空字符串。

**输出格式**（JSON）：
{
  "type": "feature_similarity|behavioral|causal|knowledge_graph|collaborative|rule_based",
  "reason": "…",
  "differentiator": "与其他选项相比的差异；仅一条时可空字符串",
  "factors": [
    {"name": "因素名称", "value": "因素值", "importance": 0.8, "category": "user|item|context|knowledge"}
  ]
}`;

    try {
      const response = await this.llmClient.invoke(
        [
          {
            role: 'system',
            content:
              '你是推荐解释专家：用户视角、需求匹配、可核验；只输出合法 JSON。',
          },
          { role: 'user', content: prompt },
        ],
        {
          model: getChatModelId(),
          temperature: 0.45,
        }
      );

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const diff =
          typeof parsed.differentiator === 'string' && parsed.differentiator.trim()
            ? parsed.differentiator.trim()
            : undefined;
        return {
          type: parsed.type || 'feature_similarity',
          reason: this.formatEvidenceChainReason(
            parsed.reason || '基于综合分析推荐',
            this.composeKGEvidenceLineFromItem(kgEvidence),
            this.composeCausalEvidenceLineFromText(causalReasoning),
            this.composeUserMatchLine(item.matchReasons, userSegment)
          ),
          factors: parsed.factors || [],
          weight: 1.0,
          differentiator: diff,
        };
      }
    } catch (e) {
      console.error('[ExplanationGenerator] Parse error for item', item.id, e);
    }

    const fallbackReason = this.generateFallbackReason(item, intentResult, context);
    return {
      type: 'feature_similarity',
      reason: this.formatEvidenceChainReason(
        fallbackReason,
        this.composeKGEvidenceLineFromItem(kgEvidence),
        this.composeCausalEvidenceLineFromText(causalReasoning),
        this.composeUserMatchLine(item.matchReasons, userSegment)
      ),
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

  private extractQueryKeywords(query: string, items: Array<{ title: string }>): string[] {
    const qTokens = query
      .split(/[\s,，。；;、|/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    const titleTokens = items
      .flatMap((i) => i.title.split(/[\s,，。；;、|/]+/))
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    return Array.from(new Set([...qTokens, ...titleTokens])).slice(0, 20);
  }

  /** 仅构建与 query + 候选强相关的局部子图文本，避免全图推理开销 */
  private buildScopedKGContext(query: string, items: Array<{ title: string }>): string {
    const keywords = this.extractQueryKeywords(query, items);
    const lines = [query, ...items.map((it) => it.title)]
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((line) => keywords.some((k) => line.includes(k)))
      .slice(0, 12);
    return lines.join('\n');
  }

  private composeKGEvidenceLine(itemId: string, kgRelations?: Map<string, KGEvidence[]>): string {
    return this.composeKGEvidenceLineFromItem(kgRelations?.get(itemId));
  }

  private composeKGEvidenceLineFromItem(kgEvidence?: KGEvidence[]): string {
    const assoc = (kgEvidence || [])
      .filter((k) => k.kind === 'association')
      .slice(0, 2)
      .map((k) => `${k.relation}(${(k.confidence * 100).toFixed(0)}%)`)
      .join('；');
    const causalHints = (kgEvidence || [])
      .filter((k) => k.kind === 'causal_hint')
      .slice(0, 2)
      .map((k) => `${k.relation}(${(k.confidence * 100).toFixed(0)}%)`)
      .join('；');
    return `KG证据=关联[${assoc || '无'}] 因果线索[${causalHints || '无'}]`;
  }

  private composeCausalEvidenceLine(itemId: string, causalChain?: Map<string, string>): string {
    return this.composeCausalEvidenceLineFromText(causalChain?.get(itemId));
  }

  private composeCausalEvidenceLineFromText(causalReasoning?: string): string {
    return `因果证据=${(causalReasoning || '无').slice(0, 120)}`;
  }

  private composeUserMatchLine(matchReasons?: string[], userSegment?: UserSegmentProfile): string {
    const reasons = (matchReasons || []).slice(0, 2).join('；') || '综合匹配';
    const seg = userSegment ? `${userSegment.segment}/${userSegment.experienceLevel}/${userSegment.riskPreference}` : '通用用户';
    return `用户匹配点=${reasons}（${seg}）`;
  }

  private formatEvidenceChainReason(
    baseReason: string,
    kgEvidenceLine: string,
    causalEvidenceLine: string,
    userMatchLine: string
  ): string {
    return `【证据链】${kgEvidenceLine} | ${causalEvidenceLine} | ${userMatchLine}\n【推荐说明】${baseReason}`;
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
    items: AgentRecommendationItem[],
    userSegment?: UserSegmentProfile
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

    const segmentPart = userSegment
      ? `面向${userSegment.segment}（${userSegment.experienceLevel}/${userSegment.riskPreference}/${userSegment.timeHorizon}）`
      : '基于通用用户偏好';
    return `基于${scenarioText}场景分析，${segmentPart}为您推荐${items.length}个选项。首选"${topItem.title}"，${topItem.explanations[0]?.reason || '综合评估最优'}`;
  }

  private buildComparisonMetadata(
    current: { id: string; score: number; source: string; matchReasons?: string[] },
    allItems: Array<{ id: string; score: number; source: string; matchReasons?: string[] }>
  ) {
    const sorted = [...allItems].sort((a, b) => b.score - a.score);
    const rank = Math.max(1, sorted.findIndex((it) => it.id === current.id) + 1);
    const topScore = sorted[0]?.score ?? current.score;
    const scoreGapToTop = Number((topScore - current.score).toFixed(4));
    const sameSourceAlternatives = allItems.filter((it) => it.id !== current.id && it.source === current.source).length;
    const currentReasons = new Set((current.matchReasons || []).map((r) => String(r)));
    const otherReasons = new Set(
      allItems
        .filter((it) => it.id !== current.id)
        .flatMap((it) => it.matchReasons || [])
        .map((r) => String(r))
    );
    const uniqueMatchReasons = Array.from(currentReasons).filter((r) => !otherReasons.has(r)).slice(0, 3);

    return {
      relativeRank: rank,
      scoreGapToTop,
      sameSourceAlternatives,
      uniqueMatchReasons,
    };
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
            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
              { role: 'system', content: '你是一个专业的推荐顾问，请严格按照指定的JSON格式输出。' },
              ...((params.messages || []) as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>),
            ];
            const response = await this.llmClient.invoke(
              messages,
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
