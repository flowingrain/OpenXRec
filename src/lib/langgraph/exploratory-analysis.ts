/**
 * 交互式探秘分析引擎
 * 实现深度假设验证分析（五大标准能力#3）
 */

import { LLMClient, Config, SearchClient } from 'coze-coding-dev-sdk';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 假设状态
 */
export type HypothesisStatus = 'unverified' | 'supported' | 'refuted' | 'partially_supported';

/**
 * 证据类型
 */
export type EvidenceType = 'supporting' | 'refuting' | 'neutral';

/**
 * 假设
 */
export interface Hypothesis {
  id: string;
  statement: string; // 假设陈述
  confidence: number; // 置信度 0-1
  status: HypothesisStatus;
  source: 'user' | 'system' | 'derived'; // 来源
  parentId?: string; // 父假设ID（用于假设演化）
  createdAt: string;
  updatedAt: string;
  
  // 证据
  supportingEvidence: Evidence[];
  refutingEvidence: Evidence[];
  
  // 元数据
  tags: string[];
  relatedFactors: string[];
}

/**
 * 证据
 */
export interface Evidence {
  id: string;
  type: EvidenceType;
  content: string; // 证据内容
  source: string; // 来源（新闻、报告、数据等）
  sourceUrl?: string;
  relevance: number; // 相关度 0-1
  strength: number; // 证据强度 0-1
  
  // 因果链
  causalChain?: CausalChain;
  
  timestamp: string;
}

/**
 * 因果链
 */
export interface CausalChain {
  id: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  description: string;
  confidence: number;
}

/**
 * 因果节点
 */
export interface CausalNode {
  id: string;
  name: string;
  type: 'event' | 'factor' | 'outcome';
  description: string;
  importance: number;
}

/**
 * 因果边
 */
export interface CausalEdge {
  from: string;
  to: string;
  relationship: string; // "导致", "影响", "促进", "抑制"
  strength: number;
  delay?: string; // "立即", "1-3个月", "6个月以上"
}

/**
 * 探索路径
 */
export interface ExplorationPath {
  id: string;
  hypothesisId: string;
  question: string; // 用户追问的问题
  answer: string; // 系统回答
  newHypotheses: Hypothesis[]; // 衍生的新假设
  newEvidence: Evidence[]; // 新发现的证据
  timestamp: string;
}

/**
 * 探秘分析会话
 */
export interface ExplorationSession {
  id: string;
  topic: string;
  originalQuery: string;
  
  // 核心假设
  hypotheses: Hypothesis[];
  
  // 探索路径
  explorationPaths: ExplorationPath[];
  
  // 因果网络
  causalNetwork: CausalChain[];
  
  // 元数据
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'archived';
  
  // 分析结果
  conclusion?: string;
  confidence?: number;
}

/**
 * 探秘分析配置
 */
export interface ExplorationConfig {
  maxHypotheses: number;
  maxEvidencePerHypothesis: number;
  confidenceThreshold: number;
  searchDepth: number;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: ExplorationConfig = {
  maxHypotheses: 5,
  maxEvidencePerHypothesis: 10,
  confidenceThreshold: 0.7,
  searchDepth: 3
};

// ============================================================================
// 探秘分析引擎
// ============================================================================

/**
 * 交互式探秘分析引擎
 */
export class ExploratoryAnalysisEngine {
  private llmClient: LLMClient;
  private searchClient: SearchClient;
  private config: ExplorationConfig;
  
  constructor(config?: Partial<ExplorationConfig>) {
    const sdkConfig = new Config();
    this.llmClient = new LLMClient(sdkConfig);
    this.searchClient = new SearchClient(sdkConfig);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 启动探秘分析会话
   */
  async startSession(
    topic: string,
    initialContext?: string
  ): Promise<ExplorationSession> {
    const sessionId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    console.log(`[ExploratoryAnalysis] Starting session ${sessionId}`);
    console.log(`[ExploratoryAnalysis] Topic: ${topic}`);
    
    // 创建会话
    const session: ExplorationSession = {
      id: sessionId,
      topic,
      originalQuery: initialContext || topic,
      hypotheses: [],
      explorationPaths: [],
      causalNetwork: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };
    
    // 提取初始假设
    const hypotheses = await this.extractHypotheses(topic, initialContext);
    session.hypotheses = hypotheses;
    
    // 为每个假设收集证据
    for (const hypothesis of session.hypotheses) {
      const evidence = await this.collectEvidence(hypothesis, topic);
      hypothesis.supportingEvidence = evidence.filter(e => e.type === 'supporting');
      hypothesis.refutingEvidence = evidence.filter(e => e.type === 'refuting');
      
      // 更新置信度
      hypothesis.confidence = this.calculateConfidence(hypothesis);
      hypothesis.status = this.determineStatus(hypothesis);
    }
    
    // 构建因果网络
    session.causalNetwork = await this.buildCausalNetwork(session.hypotheses, topic);
    
    // 生成初步结论
    session.conclusion = await this.generateConclusion(session);
    session.confidence = this.calculateOverallConfidence(session);
    
    console.log(`[ExploratoryAnalysis] Session ${sessionId} initialized with ${session.hypotheses.length} hypotheses`);
    
    return session;
  }
  
  /**
   * 提取假设
   */
  private async extractHypotheses(
    topic: string,
    context?: string
  ): Promise<Hypothesis[]> {
    const prompt = `作为专业分析师，请从以下主题中提取可验证的核心假设。

主题：${topic}
${context ? `背景信息：${context}` : ''}

请提取3-5个核心假设，每个假设应该：
1. 明确可验证（可通过数据或事实证明/反驳）
2. 有明确的因果关系
3. 对主题有重要影响

请按以下JSON格式输出：
{
  "hypotheses": [
    {
      "statement": "假设陈述（明确的主张）",
      "initialConfidence": 0.5,
      "tags": ["标签1", "标签2"],
      "relatedFactors": ["相关因素1", "相关因素2"]
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是专业的宏观分析师，擅长提出可验证的假设。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return (parsed.hypotheses || []).slice(0, this.config.maxHypotheses).map((h: any, index: number) => ({
          id: `hyp_${Date.now()}_${index}`,
          statement: h.statement,
          confidence: h.initialConfidence || 0.5,
          status: 'unverified' as HypothesisStatus,
          source: 'system' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          supportingEvidence: [],
          refutingEvidence: [],
          tags: h.tags || [],
          relatedFactors: h.relatedFactors || []
        }));
      }
    } catch (error) {
      console.error('[extractHypotheses] Error:', error);
    }
    
    // 返回默认假设
    return [{
      id: `hyp_${Date.now()}_0`,
      statement: `${topic}将产生重要影响`,
      confidence: 0.5,
      status: 'unverified',
      source: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      supportingEvidence: [],
      refutingEvidence: [],
      tags: [topic],
      relatedFactors: []
    }];
  }
  
  /**
   * 收集证据
   */
  async collectEvidence(
    hypothesis: Hypothesis,
    topic: string
  ): Promise<Evidence[]> {
    console.log(`[collectEvidence] Collecting evidence for: ${hypothesis.statement.substring(0, 50)}...`);
    
    const evidence: Evidence[] = [];
    
    try {
      // 搜索支持证据
      const supportingQuery = `${topic} ${hypothesis.statement} 支持 证据`;
      const supportingResults = await this.searchClient.advancedSearch(supportingQuery, {
        searchType: 'web',
        count: 5,
        needSummary: true
      });
      
      const supportingItems = (supportingResults as any).web_items || [];
      for (const item of supportingItems.slice(0, 3)) {
        evidence.push({
          id: `evd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'supporting',
          content: item.summary || item.snippet || item.title,
          source: item.source || item.site || '网络搜索',
          sourceUrl: item.url || item.link,
          relevance: 0.8,
          strength: 0.7,
          timestamp: new Date().toISOString()
        });
      }
      
      // 搜索反驳证据
      const refutingQuery = `${topic} ${hypothesis.statement} 反对 质疑 不同观点`;
      const refutingResults = await this.searchClient.advancedSearch(refutingQuery, {
        searchType: 'web',
        count: 5,
        needSummary: true
      });
      
      const refutingItems = (refutingResults as any).web_items || [];
      for (const item of refutingItems.slice(0, 3)) {
        evidence.push({
          id: `evd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'refuting',
          content: item.summary || item.snippet || item.title,
          source: item.source || item.site || '网络搜索',
          sourceUrl: item.url || item.link,
          relevance: 0.8,
          strength: 0.7,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('[collectEvidence] Error:', error);
    }
    
    return evidence.slice(0, this.config.maxEvidencePerHypothesis);
  }
  
  /**
   * 计算置信度（贝叶斯更新）
   */
  private calculateConfidence(hypothesis: Hypothesis): number {
    let prior = hypothesis.confidence;
    
    // 贝叶斯更新
    const supportingStrength = hypothesis.supportingEvidence.reduce(
      (sum, e) => sum + e.strength * e.relevance,
      0
    );
    const refutingStrength = hypothesis.refutingEvidence.reduce(
      (sum, e) => sum + e.strength * e.relevance,
      0
    );
    
    // 简化的贝叶斯更新
    const totalEvidence = supportingStrength + refutingStrength;
    if (totalEvidence === 0) return prior;
    
    const likelihood = supportingStrength / totalEvidence;
    
    // 后验概率
    const posterior = (prior * likelihood) / 
      (prior * likelihood + (1 - prior) * (1 - likelihood));
    
    return Math.min(Math.max(posterior, 0.1), 0.95); // 限制在 0.1-0.95
  }
  
  /**
   * 确定假设状态
   */
  private determineStatus(hypothesis: Hypothesis): HypothesisStatus {
    const { supportingEvidence, refutingEvidence, confidence } = hypothesis;
    
    if (supportingEvidence.length === 0 && refutingEvidence.length === 0) {
      return 'unverified';
    }
    
    if (confidence >= 0.7) {
      return 'supported';
    }
    
    if (confidence <= 0.3) {
      return 'refuted';
    }
    
    return 'partially_supported';
  }
  
  /**
   * 构建因果网络
   */
  private async buildCausalNetwork(
    hypotheses: Hypothesis[],
    topic: string
  ): Promise<CausalChain[]> {
    const prompt = `基于以下假设和相关因素，构建因果关系网络。

主题：${topic}

假设：
${hypotheses.map((h, i) => `${i + 1}. ${h.statement}`).join('\n')}

相关因素：
${hypotheses.flatMap(h => h.relatedFactors).join(', ')}

请构建因果链条，按以下JSON格式输出：
{
  "chains": [
    {
      "description": "因果链描述",
      "confidence": 0.8,
      "nodes": [
        {"id": "n1", "name": "事件名", "type": "event", "description": "描述", "importance": 0.8}
      ],
      "edges": [
        {"from": "n1", "to": "n2", "relationship": "导致", "strength": 0.7, "delay": "1-3个月"}
      ]
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是专业的因果分析专家。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.6
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return (parsed.chains || []).map((chain: any, index: number) => ({
          id: `chain_${Date.now()}_${index}`,
          nodes: chain.nodes || [],
          edges: chain.edges || [],
          description: chain.description,
          confidence: chain.confidence || 0.7
        }));
      }
    } catch (error) {
      console.error('[buildCausalNetwork] Error:', error);
    }
    
    return [];
  }
  
  /**
   * 生成结论
   */
  private async generateConclusion(session: ExplorationSession): Promise<string> {
    const prompt = `基于以下假设和证据，生成分析结论。

主题：${session.topic}

假设及其状态：
${session.hypotheses.map(h => 
  `- ${h.statement} (置信度: ${(h.confidence * 100).toFixed(0)}%, 状态: ${h.status})
   支持: ${h.supportingEvidence.length}条, 反驳: ${h.refutingEvidence.length}条`
).join('\n')}

请生成100-200字的分析结论，包括：
1. 主要发现
2. 关键洞察
3. 需要关注的因素`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });
      
      return response.content || '分析完成，但无法生成结论。';
    } catch (error) {
      console.error('[generateConclusion] Error:', error);
      return '分析完成，请查看各假设详情。';
    }
  }
  
  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(session: ExplorationSession): number {
    if (session.hypotheses.length === 0) return 0;
    
    // 加权平均，权重为假设的重要性（根据证据数量）
    const totalWeight = session.hypotheses.reduce(
      (sum, h) => sum + h.supportingEvidence.length + h.refutingEvidence.length + 1,
      0
    );
    
    const weightedSum = session.hypotheses.reduce(
      (sum, h) => {
        const weight = h.supportingEvidence.length + h.refutingEvidence.length + 1;
        return sum + h.confidence * weight;
      },
      0
    );
    
    return weightedSum / totalWeight;
  }
  
  /**
   * 处理用户追问
   */
  async processFollowUp(
    session: ExplorationSession,
    question: string,
    targetHypothesisId?: string
  ): Promise<ExplorationPath> {
    console.log(`[processFollowUp] Processing: ${question.substring(0, 50)}...`);
    
    const pathId = `path_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // 确定目标假设
    const targetHypothesis = targetHypothesisId
      ? session.hypotheses.find(h => h.id === targetHypothesisId)
      : session.hypotheses[0];
    
    // 生成回答
    const answer = await this.generateAnswer(session, question, targetHypothesis);
    
    // 提取新假设
    const newHypotheses = await this.extractDerivedHypotheses(
      session,
      question,
      answer,
      targetHypothesis
    );
    
    // 收集新证据
    const newEvidence = await this.collectEvidenceForQuestion(question, session.topic);
    
    // 创建探索路径
    const path: ExplorationPath = {
      id: pathId,
      hypothesisId: targetHypothesis?.id || '',
      question,
      answer,
      newHypotheses,
      newEvidence,
      timestamp: new Date().toISOString()
    };
    
    // 更新会话
    session.explorationPaths.push(path);
    session.hypotheses.push(...newHypotheses);
    
    // 重新计算置信度
    if (targetHypothesis) {
      targetHypothesis.confidence = this.calculateConfidence(targetHypothesis);
      targetHypothesis.status = this.determineStatus(targetHypothesis);
      targetHypothesis.updatedAt = new Date().toISOString();
    }
    
    // 更新结论
    session.conclusion = await this.generateConclusion(session);
    session.confidence = this.calculateOverallConfidence(session);
    session.updatedAt = new Date().toISOString();
    
    return path;
  }
  
  /**
   * 生成回答
   */
  private async generateAnswer(
    session: ExplorationSession,
    question: string,
    targetHypothesis?: Hypothesis
  ): Promise<string> {
    const context = `
主题：${session.topic}

当前假设：
${session.hypotheses.map(h => `- ${h.statement} (置信度: ${(h.confidence * 100).toFixed(0)}%)`).join('\n')}

${targetHypothesis ? `重点分析的假设：${targetHypothesis.statement}
支持证据：${targetHypothesis.supportingEvidence.map(e => e.content.substring(0, 50)).join('; ')}
反驳证据：${targetHypothesis.refutingEvidence.map(e => e.content.substring(0, 50)).join('; ')}` : ''}

用户问题：${question}

请基于以上信息，回答用户的问题（150-250字）。如果问题需要更多数据，说明需要什么数据。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是专业的宏观分析师，擅长深入分析问题。' },
        { role: 'user', content: context }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.6
      });
      
      return response.content || '我需要更多信息来回答这个问题。';
    } catch (error) {
      console.error('[generateAnswer] Error:', error);
      return '抱歉，我暂时无法回答这个问题。';
    }
  }
  
  /**
   * 提取衍生假设
   */
  private async extractDerivedHypotheses(
    session: ExplorationSession,
    question: string,
    answer: string,
    parentHypothesis?: Hypothesis
  ): Promise<Hypothesis[]> {
    const prompt = `基于用户的追问和系统的回答，提取新的假设。

主题：${session.topic}

用户追问：${question}

系统回答：${answer}

${parentHypothesis ? `父假设：${parentHypothesis.statement}` : ''}

请提取1-2个新的衍生假设，按以下JSON格式输出：
{
  "hypotheses": [
    {
      "statement": "新假设陈述",
      "initialConfidence": 0.5,
      "tags": ["标签"],
      "relatedFactors": ["因素"]
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return (parsed.hypotheses || []).map((h: any, index: number) => ({
          id: `hyp_${Date.now()}_derived_${index}`,
          statement: h.statement,
          confidence: h.initialConfidence || 0.5,
          status: 'unverified' as HypothesisStatus,
          source: 'derived' as const,
          parentId: parentHypothesis?.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          supportingEvidence: [],
          refutingEvidence: [],
          tags: h.tags || [],
          relatedFactors: h.relatedFactors || []
        }));
      }
    } catch (error) {
      console.error('[extractDerivedHypotheses] Error:', error);
    }
    
    return [];
  }
  
  /**
   * 为问题收集证据
   */
  private async collectEvidenceForQuestion(
    question: string,
    topic: string
  ): Promise<Evidence[]> {
    try {
      const results = await this.searchClient.advancedSearch(`${topic} ${question}`, {
        searchType: 'web',
        count: 3,
        needSummary: true
      });
      
      const items = (results as any).web_items || [];
      
      return items.map((item: any) => ({
        id: `evd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'neutral' as EvidenceType,
        content: item.summary || item.snippet || item.title,
        source: item.source || item.site || '网络搜索',
        sourceUrl: item.url || item.link,
        relevance: 0.7,
        strength: 0.6,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('[collectEvidenceForQuestion] Error:', error);
      return [];
    }
  }
  
  /**
   * 获取假设的建议追问
   */
  async getSuggestedQuestions(
    session: ExplorationSession,
    hypothesisId?: string
  ): Promise<string[]> {
    const targetHypothesis = hypothesisId
      ? session.hypotheses.find(h => h.id === hypothesisId)
      : session.hypotheses[0];
    
    if (!targetHypothesis) return [];
    
    const prompt = `基于以下假设和证据，生成3-5个有价值的追问。

假设：${targetHypothesis.statement}
置信度：${(targetHypothesis.confidence * 100).toFixed(0)}%
状态：${targetHypothesis.status}

支持证据：
${targetHypothesis.supportingEvidence.map(e => `- ${e.content.substring(0, 80)}`).join('\n')}

反驳证据：
${targetHypothesis.refutingEvidence.map(e => `- ${e.content.substring(0, 80)}`).join('\n')}

请生成能深入验证假设的问题，按以下JSON格式输出：
{
  "questions": ["问题1", "问题2", "问题3"]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是专业的分析顾问，擅长提出关键问题。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.questions || [];
      }
    } catch (error) {
      console.error('[getSuggestedQuestions] Error:', error);
    }
    
    return [
      '这个假设的主要依据是什么？',
      '有哪些因素可能导致这个假设不成立？',
      '如果这个假设成立，会产生什么影响？'
    ];
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建探秘分析引擎
 */
export function createExploratoryEngine(
  config?: Partial<ExplorationConfig>
): ExploratoryAnalysisEngine {
  return new ExploratoryAnalysisEngine(config);
}

/**
 * 快速启动探秘分析
 */
export async function quickExplore(
  topic: string,
  context?: string
): Promise<ExplorationSession> {
  const engine = new ExploratoryAnalysisEngine();
  return engine.startSession(topic, context);
}
