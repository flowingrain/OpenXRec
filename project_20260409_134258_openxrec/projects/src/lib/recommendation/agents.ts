// @ts-nocheck
/**
 * 推荐智能体系统
 *
 * 将推荐能力集成到现有的多智能体协作框架中
 * 利用 LangGraph 实现智能体间的协调与协作
 */

import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { LLMClient } from 'coze-coding-dev-sdk';
import {
  RecommendationAgentType,
  RecommendationAgentConfig,
  RecommendationItem,
  UserProfile,
  RecommendationContext,
  ExplanationFactor
} from './types';

/**
 * 创建 LLM 客户端（复用项目中的实现）
 */
function createLLMClient(): LLMClient {
  const config = new (require('coze-coding-dev-sdk').Config)();
  return new LLMClient(config);
}

/**
 * 调用 LLM 进行对话
 */
async function llmChat(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const llmClient = createLLMClient();
  const sdkMessages = messages.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content
  }));

  try {
    const response = await llmClient.invoke(sdkMessages, {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.7
    });
    return response.content || '';
  } catch (error) {
    console.error('[llmChat] Error:', error);
    throw error;
  }
}

// ============================================================================
// 推荐状态定义
// ============================================================================

export interface RecommendationState {
  // 输入
  userId: string;
  items: RecommendationItem[];
  context: RecommendationContext;
  options: any;

  // 意图分析
  intentAnalysis?: {
    scenarioType: string;
    recommendationType: 'comparison' | 'ranking' | 'single';
    entities: Array<{ name: string; type: string }>;
    constraints: Array<{ name: string; value: string }>;
    informationSufficiency: {
      score: number;
      missingFields: string[];
      isSufficient: boolean;
    };
    userIntent: string;
    confidence: number;
  };
  needsClarification?: boolean;
  missingInformation?: string[];

  // 知识抽取
  extractedKnowledge?: {
    entities: Array<{ id: string; name: string; type: string; importance: number }>;
    relations: Array<{ source: string; target: string; type: string; confidence: number }>;
    constraints: Array<{ entity: string; constraint: string; value: string }>;
  };

  // 知识图谱
  knowledgeGraph?: {
    entities: any[];
    relations: any[];
  };

  // 因果分析
  causalAnalysis?: {
    causalChains: Array<{
      cause: string;
      effect: string;
      mechanism: string;
      confidence: number;
    }>;
    riskFactors: string[];
    recommendations: string[];
  };

  // 中间状态
  userProfile?: UserProfile;
  features?: Map<string, any>;
  similarities?: Map<string, number>;
  rankings?: Array<{ itemId: string; score: number }>;
  explanations?: Map<string, ExplanationFactor[]>;

  // 输出
  results?: any[];
  error?: string;
}

export const RecommendationStateAnnotation = Annotation.Root({
  userId: Annotation<string>,
  items: Annotation<RecommendationItem[]>,
  context: Annotation<RecommendationContext>,
  options: Annotation<any>,
  // 意图分析
  intentAnalysis: Annotation<any>,
  needsClarification: Annotation<boolean>,
  missingInformation: Annotation<string[]>,
  // 知识抽取
  extractedKnowledge: Annotation<any>,
  // 知识图谱
  knowledgeGraph: Annotation<any>,
  // 因果分析
  causalAnalysis: Annotation<any>,
  // 中间状态
  userProfile: Annotation<UserProfile>,
  features: Annotation<Map<string, any>>,
  similarities: Annotation<Map<string, number>>,
  rankings: Annotation<Array<{ itemId: string; score: number }>>,
  explanations: Annotation<Map<string, ExplanationFactor[]>>,
  results: Annotation<any[]>,
  error: Annotation<string>
});

// ============================================================================
// 推荐智能体节点定义
// ============================================================================

/**
 * 智能体节点配置
 */
export const RECOMMENDATION_AGENT_NODES: Array<{
  id: string;
  name: string;
  type: RecommendationAgentType;
  description: string;
  layer: string;
}> = [
  // ========== 感知层 ==========
  {
    id: 'intent_analyzer',
    name: '意图理解智能体',
    type: 'intent_analyzer',
    description: '理解用户查询意图，识别场景类型、推荐类型、信息充足性',
    layer: 'perception'
  },
  {
    id: 'user_profiler',
    name: '用户画像智能体',
    type: 'user_profiler',
    description: '构建和维护用户画像，提取用户兴趣、偏好和行为模式',
    layer: 'perception'
  },
  {
    id: 'item_profiler',
    name: '物品画像智能体',
    type: 'item_profiler',
    description: '提取物品特征，构建物品表示',
    layer: 'perception'
  },

  // ========== 认知层 ==========
  {
    id: 'knowledge_extractor',
    name: '知识抽取智能体',
    type: 'knowledge_extractor',
    description: '从查询和上下文中抽取实体、关系、约束',
    layer: 'cognition'
  },
  {
    id: 'kg_builder',
    name: '知识图谱构建智能体',
    type: 'kg_builder',
    description: '构建知识图谱，建立实体关系网络',
    layer: 'cognition'
  },
  {
    id: 'feature_extractor',
    name: '特征提取智能体',
    type: 'feature_extractor',
    description: '从用户和物品中提取特征，计算相似度',
    layer: 'cognition'
  },
  {
    id: 'similarity_calculator',
    name: '相似度计算智能体',
    type: 'similarity_calculator',
    description: '计算用户-物品相似度，物品-物品相似度',
    layer: 'cognition'
  },
  {
    id: 'kg_reasoner',
    name: '知识图谱推理智能体',
    type: 'kg_reasoner',
    description: '利用知识图谱进行推理，发现隐式关联',
    layer: 'cognition'
  },

  // ========== 决策层 ==========
  {
    id: 'causal_reasoner',
    name: '因果推理智能体',
    type: 'causal_reasoner',
    description: '基于知识图谱进行因果推断分析',
    layer: 'decision'
  },
  {
    id: 'ranking_agent',
    name: '排序智能体',
    type: 'ranking_agent',
    description: '根据多个因素对物品进行排序，考虑多样性、新颖性等',
    layer: 'decision'
  },
  {
    id: 'explanation_generator',
    name: '解释生成智能体',
    type: 'explanation_generator',
    description: '生成推荐结果的自然语言解释',
    layer: 'decision'
  },

  // ========== 优化层 ==========
  {
    id: 'diversity_optimizer',
    name: '多样性优化智能体',
    type: 'diversity_optimizer',
    description: '优化推荐结果的多样性',
    layer: 'decision'
  },
  {
    id: 'novelty_detector',
    name: '新颖性检测智能体',
    type: 'novelty_detector',
    description: '识别推荐结果的新颖性',
    layer: 'decision'
  }
];

// ============================================================================
// 推荐智能体节点函数
// ============================================================================

/**
 * 意图理解智能体
 * 
 * 理解用户查询意图，识别：
 * 1. 场景类型（开店、投资、旅游等）
 * 2. 推荐类型（对比型、排序型、单一答案型）
 * 3. 信息充足性（是否需要追问）
 * 4. 关键实体和约束条件
 */
export async function intentAnalyzerNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[intentAnalyzer] Analyzing user intent...');
  
  const query = state.context.query;
  
  try {
    const prompt = `分析用户查询意图，提取关键信息。

用户查询：${query}

请以JSON格式返回：
{
  "scenarioType": "开店|投资|旅游|购物|其他",
  "recommendationType": "comparison|ranking|single",
  "entities": [
    {"name": "西塘", "type": "地点"},
    {"name": "潮流小店", "type": "业务类型"}
  ],
  "constraints": [
    {"name": "客群", "value": "游客"}
  ],
  "informationSufficiency": {
    "score": 0.7,
    "missingFields": ["预算"],
    "isSufficient": false
  },
  "userIntent": "用户想在西塘开一家面向游客的潮流小店",
  "confidence": 0.9
}`;

    const response = await llmClient.invoke([
      { role: 'system', content: '你是一个意图理解专家，专门分析用户的查询意图。' },
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const intentResult = JSON.parse(jsonMatch[0]);
      
      console.log('[intentAnalyzer] Intent analysis result:', {
        scenario: intentResult.scenarioType,
        type: intentResult.recommendationType,
        entities: intentResult.entities?.length || 0,
        sufficient: intentResult.informationSufficiency?.isSufficient,
      });
      
      return {
        intentAnalysis: intentResult,
        // 如果信息不足，标记需要追问
        needsClarification: !intentResult.informationSufficiency?.isSufficient,
        missingInformation: intentResult.informationSufficiency?.missingFields || [],
      };
    }
    
    return { 
      intentAnalysis: { 
        scenarioType: '其他',
        recommendationType: 'single' as const,
        entities: [],
        constraints: [],
        informationSufficiency: { score: 0.5, missingFields: [], isSufficient: true },
        userIntent: '一般推荐',
        confidence: 0.5,
      } 
    };
  } catch (error) {
    console.error('[intentAnalyzer] Error:', error);
    return { error: `Intent analysis failed: ${error}` };
  }
}

/**
 * 用户画像智能体
 */
export async function userProfilerNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[userProfiler] Building user profile...');

  try {
    // 从数据库获取用户画像
    // 这里简化实现，实际会调用数据库
    const userProfile: UserProfile = {
      userId: state.userId,
      interests: [],
      preferences: {},
      behaviorHistory: []
    };

    // 使用 LLM 分析用户历史行为，提取兴趣和偏好
    if (state.context.session?.previousItems && state.context.session.previousItems.length > 0) {
      const prompt = `分析用户的行为历史，提取用户的兴趣和偏好。

历史行为：
${state.context.session.previousItems.map((itemId, idx) => `${idx + 1}. ${itemId}`).join('\n')}

请以JSON格式返回：
{
  "interests": ["兴趣1", "兴趣2", ...],
  "preferences": {"category": "value", ...}
}`;

      const response = await llmClient.invoke([
        { role: 'system', content: '你是一个用户画像分析专家。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      try {
        const analysis = JSON.parse(response.content);
        userProfile.interests = analysis.interests || [];
        userProfile.preferences = analysis.preferences || {};
      } catch (e) {
        console.error('[userProfiler] Failed to parse LLM response:', e);
      }
    }

    return { userProfile };
  } catch (error) {
    console.error('[userProfiler] Error:', error);
    return { error: `User profiling failed: ${error}` };
  }
}

/**
 * 知识抽取智能体
 * 
 * 从用户查询中抽取实体、关系、约束
 * 这应该在因果推理之前完成
 */
export async function knowledgeExtractorNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[knowledgeExtractor] Extracting knowledge from query...');
  
  const query = state.context.query;
  const intentAnalysis = state.intentAnalysis;
  
  try {
    const prompt = `从用户查询中抽取知识三元组（实体-关系-实体）。

用户查询：${query}

${intentAnalysis ? `已识别的实体：${JSON.stringify(intentAnalysis.entities)}
已识别的约束：${JSON.stringify(intentAnalysis.constraints)}` : ''}

请抽取所有实体和关系，以JSON格式返回：
{
  "entities": [
    {"id": "e1", "name": "西塘", "type": "地点", "importance": 0.9},
    {"id": "e2", "name": "潮流小店", "type": "业务类型", "importance": 0.8}
  ],
  "relations": [
    {"source": "e1", "target": "e2", "type": "适合开设", "confidence": 0.85}
  ],
  "constraints": [
    {"entity": "e2", "constraint": "目标客群", "value": "游客"}
  ]
}`;

    const response = await llmClient.invoke([
      { role: 'system', content: '你是一个知识抽取专家，擅长从文本中提取结构化知识。' },
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.2,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const knowledge = JSON.parse(jsonMatch[0]);
      
      console.log('[knowledgeExtractor] Extracted:', {
        entities: knowledge.entities?.length || 0,
        relations: knowledge.relations?.length || 0,
        constraints: knowledge.constraints?.length || 0,
      });
      
      return {
        extractedKnowledge: knowledge,
      };
    }
    
    return { extractedKnowledge: { entities: [], relations: [], constraints: [] } };
  } catch (error) {
    console.error('[knowledgeExtractor] Error:', error);
    return { error: `Knowledge extraction failed: ${error}` };
  }
}

/**
 * 知识图谱构建智能体
 * 
 * 基于抽取的知识构建知识图谱，供后续因果推理使用
 */
export async function kgBuilderNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[kgBuilder] Building knowledge graph...');
  
  const extractedKnowledge = state.extractedKnowledge;
  
  if (!extractedKnowledge || extractedKnowledge.entities?.length === 0) {
    console.log('[kgBuilder] No extracted knowledge, skipping KG build');
    return { knowledgeGraph: { entities: [], relations: [] } };
  }
  
  try {
    // 使用 LLM 推断隐式关系
    const prompt = `基于已知实体和关系，推断可能存在的隐式关系。

已知实体：
${JSON.stringify(extractedKnowledge.entities, null, 2)}

已知关系：
${JSON.stringify(extractedKnowledge.relations, null, 2)}

请推断可能存在的隐式关系（如：替代关系、竞争关系、依赖关系等），返回JSON：
{
  "implicitRelations": [
    {"source": "实体ID", "target": "实体ID", "type": "关系类型", "confidence": 0.7, "evidence": "推断依据"}
  ]
}`;

    const response = await llmClient.invoke([
      { role: 'system', content: '你是一个知识图谱专家，擅长发现隐式关系。' },
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    let implicitRelations: any[] = [];
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      implicitRelations = result.implicitRelations || [];
      console.log(`[kgBuilder] Inferred ${implicitRelations.length} implicit relations`);
    }
    
    // 合并显式和隐式关系
    const knowledgeGraph = {
      entities: extractedKnowledge.entities,
      relations: [
        ...extractedKnowledge.relations,
        ...implicitRelations,
      ],
    };
    
    console.log(`[kgBuilder] Knowledge graph built: ${knowledgeGraph.entities.length} entities, ${knowledgeGraph.relations.length} relations`);
    
    return { knowledgeGraph };
  } catch (error) {
    console.error('[kgBuilder] Error:', error);
    return { 
      knowledgeGraph: {
        entities: extractedKnowledge.entities || [],
        relations: extractedKnowledge.relations || [],
      }
    };
  }
}

/**
 * 物品画像智能体
 */
export async function itemProfilerNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[itemProfiler] Extracting item features...');

  try {
    const features = new Map<string, any>();

    // 使用 LLM 提取物品特征
    for (const item of state.items.slice(0, 10)) { // 限制处理数量
      const prompt = `从以下物品信息中提取关键特征：

标题：${item.title}
描述：${item.description || '无'}
属性：${JSON.stringify(item.attributes)}

请以JSON格式返回：
{
  "categories": ["类别1", "类别2", ...],
  "keywords": ["关键词1", "关键词2", ...],
  "sentiment": "positive/neutral/negative",
  "price_range": "low/medium/high",
  "other_features": {}
}`;

      const response = await llmClient.invoke([
        { role: 'system', content: '你是一个物品特征提取专家。' },
        { role: 'user', content: prompt }
      ]);

      try {
        const itemFeatures = JSON.parse(response.content);
        features.set(item.id, itemFeatures);
      } catch (e) {
        console.error(`[itemProfiler] Failed to parse features for item ${item.id}:`, e);
        features.set(item.id, {
          categories: [],
          keywords: [],
          sentiment: 'neutral'
        });
      }
    }

    return { features };
  } catch (error) {
    console.error('[itemProfiler] Error:', error);
    return { error: `Item profiling failed: ${error}` };
  }
}

/**
 * 特征提取智能体
 */
export async function featureExtractorNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[featureExtractor] Calculating features...');

  try {
    if (!state.userProfile || !state.features) {
      return { error: 'Missing user profile or item features' };
    }

    const similarities = new Map<string, number>();

    // 计算每个物品与用户的匹配度
    for (const item of state.items) {
      let matchScore = 0;

      // 1. 兴趣匹配
      for (const interest of state.userProfile.interests) {
        const itemFeatures = state.features.get(item.id);
        if (itemFeatures?.keywords?.includes(interest) ||
            item.title.toLowerCase().includes(interest.toLowerCase())) {
          matchScore += 0.3;
        }
      }

      // 2. 偏好匹配
      for (const [key, value] of Object.entries(state.userProfile.preferences)) {
        if (item.attributes[key] === value) {
          matchScore += 0.2;
        }
      }

      similarities.set(item.id, Math.min(matchScore, 1));
    }

    return { similarities };
  } catch (error) {
    console.error('[featureExtractor] Error:', error);
    return { error: `Feature extraction failed: ${error}` };
  }
}

/**
 * 相似度计算智能体
 */
export async function similarityCalculatorNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[similarityCalculator] Calculating similarities...');

  try {
    if (!state.similarities) {
      return { error: 'Missing similarities' };
    }

    // 可以在这里进行更复杂的相似度计算
    // 例如使用协同过滤、物品相似度等

    return { similarities: state.similarities };
  } catch (error) {
    console.error('[similarityCalculator] Error:', error);
    return { error: `Similarity calculation failed: ${error}` };
  }
}

/**
 * 排序智能体
 */
export async function rankingAgentNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[rankingAgent] Ranking items...');

  try {
    if (!state.similarities) {
      return { error: 'Missing similarities' };
    }

    // 根据相似度排序
    const rankings = state.items
      .map(item => ({
        itemId: item.id,
        score: state.similarities!.get(item.id) || 0
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);

    return { rankings };
  } catch (error) {
    console.error('[rankingAgent] Error:', error);
    return { error: `Ranking failed: ${error}` };
  }
}

/**
 * 解释生成智能体
 */
export async function explanationGeneratorNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[explanationGenerator] Generating explanations...');

  try {
    if (!state.userProfile || !state.rankings) {
      return { error: 'Missing user profile or rankings' };
    }

    const explanations = new Map<string, ExplanationFactor[]>();

    // 为前10个推荐结果生成解释
    for (let i = 0; i < Math.min(state.rankings.length, 10); i++) {
      const ranking = state.rankings[i];
      const item = state.items.find(item => item.id === ranking.itemId);

      if (!item) continue;

      // 使用 LLM 生成自然语言解释
      const prompt = `为以下推荐生成解释：

用户画像：
兴趣：${state.userProfile.interests.join('、')}
偏好：${JSON.stringify(state.userProfile.preferences)}

推荐物品：
标题：${item.title}
描述：${item.description || '无'}
推荐分数：${ranking.score.toFixed(2)}

请以JSON格式返回：
{
  "factors": [
    {
      "name": "因素名称",
      "value": "因素值",
      "importance": 0.8,
      "category": "user/item/context/knowledge"
    }
  ],
  "reason": "自然语言解释（1-2句话）"
}`;

      const response = await llmClient.invoke([
        { role: 'system', content: '你是一个推荐解释生成专家，擅长用简洁明了的语言解释推荐理由。' },
        { role: 'user', content: prompt }
      ]);

      try {
        const explanation = JSON.parse(response.content);
        explanations.set(item.id, explanation.factors || []);
      } catch (e) {
        console.error(`[explanationGenerator] Failed to parse explanation for item ${item.id}:`, e);
        explanations.set(item.id, [{
          name: 'similarity',
          value: ranking.score,
          importance: ranking.score,
          category: 'item'
        }]);
      }
    }

    return { explanations };
  } catch (error) {
    console.error('[explanationGenerator] Error:', error);
    return { error: `Explanation generation failed: ${error}` };
  }
}

/**
 * 因果推理智能体
 * 
 * 基于知识图谱进行因果推理
 * 注意：必须在知识图谱构建之后执行
 */
export async function causalReasonerNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[causalReasoner] Performing causal reasoning based on knowledge graph...');

  try {
    const knowledgeGraph = state.knowledgeGraph;
    
    if (!knowledgeGraph || knowledgeGraph.entities?.length === 0) {
      console.log('[causalReasoner] No knowledge graph available, skipping causal reasoning');
      return { causalAnalysis: undefined };
    }
    
    // 基于知识图谱进行因果推理
    const prompt = `基于知识图谱进行因果推理分析。

知识图谱实体：
${JSON.stringify(knowledgeGraph.entities, null, 2)}

知识图谱关系：
${JSON.stringify(knowledgeGraph.relations, null, 2)}

用户查询：${state.context.query}

请分析：
1. 关键实体之间的因果关系
2. 推荐决策的因果链
3. 潜在的风险因素

以JSON格式返回：
{
  "causalChains": [
    {
      "cause": "原因实体",
      "effect": "结果实体",
      "mechanism": "因果机制说明",
      "confidence": 0.85
    }
  ],
  "riskFactors": ["风险1", "风险2"],
  "recommendations": ["建议1", "建议2"]
}`;

    const response = await llmClient.invoke([
      { role: 'system', content: '你是一个因果推理专家，擅长基于知识图谱分析因果关系。' },
      { role: 'user', content: prompt }
    ], {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const causalAnalysis = JSON.parse(jsonMatch[0]);
      
      console.log('[causalReasoner] Causal analysis complete:', {
        chains: causalAnalysis.causalChains?.length || 0,
        risks: causalAnalysis.riskFactors?.length || 0,
      });
      
      return { causalAnalysis };
    }
    
    return { causalAnalysis: undefined };
  } catch (error) {
    console.error('[causalReasoner] Error:', error);
    return { error: `Causal reasoning failed: ${error}` };
  }
}

/**
 * 知识图谱推理智能体
 */
export async function kgReasonerNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[kgReasoner] Performing knowledge graph reasoning...');

  try {
    if (!state.userProfile || !state.rankings) {
      return { error: 'Missing user profile or rankings' };
    }

    // 简化实现：使用知识图谱推理
    // 实际实现中会调用项目的知识图谱服务

    return {};
  } catch (error) {
    console.error('[kgReasoner] Error:', error);
    return { error: `Knowledge graph reasoning failed: ${error}` };
  }
}

/**
 * 多样性优化智能体
 */
export async function diversityOptimizerNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[diversityOptimizer] Optimizing diversity...');

  try {
    if (!state.rankings) {
      return { error: 'Missing rankings' };
    }

    // 简化实现：确保推荐结果的多样性
    // 实际实现中会使用 MMR 等算法

    return { rankings: state.rankings };
  } catch (error) {
    console.error('[diversityOptimizer] Error:', error);
    return { error: `Diversity optimization failed: ${error}` };
  }
}

/**
 * 新颖性检测智能体
 */
export async function noveltyDetectorNode(
  state: RecommendationState,
  llmClient: LLMClient
): Promise<Partial<RecommendationState>> {
  console.log('[noveltyDetector] Detecting novelty...');

  try {
    if (!state.rankings || !state.userProfile) {
      return { error: 'Missing rankings or user profile' };
    }

    // 简化实现：根据用户历史行为判断新颖性
    const noveltyRankings = state.rankings.map(ranking => {
      const historyCount = state.userProfile!.behaviorHistory.filter(
        b => b.itemId === ranking.itemId
      ).length;
      const noveltyScore = Math.max(0, 1 - historyCount * 0.2);

      return {
        ...ranking,
        score: ranking.score * 0.8 + noveltyScore * 0.2
      };
    });

    return { rankings: noveltyRankings.sort((a, b) => b.score - a.score) };
  } catch (error) {
    console.error('[noveltyDetector] Error:', error);
    return { error: `Novelty detection failed: ${error}` };
  }
}

// ============================================================================
// 推荐工作流图构建
// ============================================================================

/**
 * 构建推荐工作流图
 * 
 * 正确的顺序：
 * 1. 意图分析 → 2. 用户画像 → 3. 知识抽取 → 4. 知识图谱构建
 * 5. 物品画像 → 6. 特征提取 → 7. 相似度计算
 * 8. 知识图谱推理 → 9. 因果推理（基于知识图谱）
 * 10. 排序 → 11. 解释生成 → 12. 多样性优化 → 13. 新颖性检测
 */
export function buildRecommendationGraph(): StateGraph<any> {
  const workflow = new StateGraph(RecommendationStateAnnotation)
    // 感知层
    .addNode('intent_analyzer', intentAnalyzerNode)
    .addNode('user_profiler', userProfilerNode)
    .addNode('knowledge_extractor', knowledgeExtractorNode)
    .addNode('kg_builder', kgBuilderNode)
    .addNode('item_profiler', itemProfilerNode)
    // 认知层
    .addNode('feature_extractor', featureExtractorNode)
    .addNode('similarity_calculator', similarityCalculatorNode)
    .addNode('kg_reasoner', kgReasonerNode)
    // 决策层
    .addNode('causal_reasoner', causalReasonerNode)
    .addNode('ranking_agent', rankingAgentNode)
    .addNode('explanation_generator', explanationGeneratorNode)
    // 优化层
    .addNode('diversity_optimizer', diversityOptimizerNode)
    .addNode('novelty_detector', noveltyDetectorNode);

  // 定义边：正确的顺序
  workflow
    // 感知层
    .addEdge(START, 'intent_analyzer')
    .addEdge('intent_analyzer', 'user_profiler')
    .addEdge('user_profiler', 'knowledge_extractor')
    .addEdge('knowledge_extractor', 'kg_builder')
    .addEdge('kg_builder', 'item_profiler')
    // 认知层
    .addEdge('item_profiler', 'feature_extractor')
    .addEdge('feature_extractor', 'similarity_calculator')
    .addEdge('similarity_calculator', 'kg_reasoner')
    // 决策层（因果推理在知识图谱推理之后）
    .addEdge('kg_reasoner', 'causal_reasoner')
    .addEdge('causal_reasoner', 'ranking_agent')
    .addEdge('ranking_agent', 'explanation_generator')
    // 优化层
    .addEdge('explanation_generator', 'diversity_optimizer')
    .addEdge('diversity_optimizer', 'novelty_detector')
    .addEdge('novelty_detector', END);

  return workflow.compile();
}

// ============================================================================
// 导出
// ============================================================================

export const recommendationGraph = buildRecommendationGraph();
