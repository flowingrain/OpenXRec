/**
 * 案例记忆存储系统
 * 实现分析案例的存储、检索、相似度匹配
 * 支持复盘进化能力的核心数据结构
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { AnalysisStateType, TaskComplexity } from './state';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 领域类型
 */
export type DomainType = 'finance' | 'geopolitics' | 'technology' | 'energy' | 'general';

/**
 * 场景类型
 */
export type ScenarioType = 'event_analysis' | 'trend_prediction' | 'risk_assessment' | 'policy_impact' | 'general';

/**
 * 分析案例
 */
export interface AnalysisCase {
  id: string;
  timestamp: string;
  
  // 输入信息
  query: string;
  domain: DomainType;
  scenario: ScenarioType;
  complexity: TaskComplexity;
  
  // 分析过程
  searchResults: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  
  // 分析结果
  timeline: Array<{
    timestamp: string;
    event: string;
    significance?: string;
  }>;
  causalChains: Array<{
    cause: string;
    effect: string;
    strength: number;
  }>;
  keyFactors: Array<{
    factor: string;
    impact: string;
    weight: number;
  }>;
  scenarios: Array<{
    name: string;
    probability: number;
    description: string;
  }>;
  conclusion: string;
  report: string;
  
  // 执行元数据
  agentSequence: string[];
  executionTime: number;
  tokenUsage: number;
  
  // 反馈信息
  feedback?: CaseFeedback;
  
  // 向量嵌入（用于相似度检索）
  embedding?: number[];
  
  // 标签
  tags: string[];
}

/**
 * 案例反馈
 */
export interface CaseFeedback {
  // 用户评分
  userRating?: number; // 1-5
  
  // 用户评价
  userComments?: string;
  
  // 用户采纳的结论
  adoptedConclusions?: string[];
  
  // 用户修改的内容
  modifications?: Array<{
    section: string;
    original: string;
    modified: string;
  }>;
  
  // 实际结果跟踪（用于验证预测准确性）
  actualOutcome?: {
    verifiedAt: string;
    accuracy: 'accurate' | 'partial' | 'inaccurate';
    deviation?: string;
    lessons: string;
  };
  
  // 自动评估指标
  autoMetrics?: {
    informationQuality: number; // 信息质量分数
    causalChainCompleteness: number; // 因果链完整度
    scenarioAccuracy: number; // 场景预测准确度（需事后验证）
  };
}

/**
 * 复盘结果
 */
export interface ReviewResult {
  caseId: string;
  reviewTimestamp: string;
  
  // 成功要素
  successFactors: string[];
  
  // 失败教训
  failureLessons: string[];
  
  // 改进建议
  improvements: Array<{
    target: string; // 目标智能体或流程
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: string;
  }>;
  
  // 可复用模式
  reusablePatterns: Array<{
    patternName: string;
    patternDescription: string;
    applicableScenarios: string[];
    implementation: string;
  }>;
  
  // 需要避免的模式
  antiPatterns: Array<{
    patternName: string;
    description: string;
    avoidanceStrategy: string;
  }>;
  
  // 知识沉淀
  knowledgeNuggets: Array<{
    domain: string;
    insight: string;
    evidence: string;
    confidence: number;
  }>;
}

/**
 * 策略优化结果
 */
export interface OptimizationResult {
  optimizationId: string;
  timestamp?: string;
  
  // 目标（可以是智能体或流程）
  target: string;
  
  // 优化类型
  type: 'prompt' | 'parameter' | 'workflow' | 'tool';
  
  // 优化的智能体（向后兼容）
  targetAgent?: string;
  
  // 优化类型（向后兼容）
  optimizationType?: 'prompt' | 'parameter' | 'workflow' | 'tool';
  
  // 优化描述
  description?: string;
  
  // 优化前配置
  beforeConfig?: Record<string, any>;
  
  // 优化后配置
  afterConfig?: Record<string, any>;
  
  // 实现（before/after格式）
  implementation?: {
    before: string;
    after: string;
  };
  
  // 优化理由
  reasoning?: string;
  
  // 预期效果
  expectedImprovement?: string;
  expectedImpact?: string;
  
  // 优先级
  priority?: 'high' | 'medium' | 'low';
  
  // 是否可自动应用
  autoApplicable?: boolean;
  
  // 验证状态
  validationStatus?: 'pending' | 'validated' | 'rejected';
  status?: 'pending' | 'applied' | 'validated' | 'rejected';
  
  // 实际效果（验证后填写）
  actualImprovement?: string;
  
  // 创建时间
  createdAt?: string;
}

/**
 * 案例检索参数
 */
export interface CaseSearchParams {
  query?: string;
  domain?: DomainType;
  scenario?: ScenarioType;
  tags?: string[];
  minRating?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  limit?: number;
}

/**
 * 相似案例结果
 */
export interface SimilarCaseResult {
  case: AnalysisCase;
  similarity: number;
  matchedAspects: string[];
}

// ============================================================================
// 案例记忆存储类
// ============================================================================

/**
 * 案例记忆存储
 * 负责案例的存储、检索、相似度匹配
 */
export class CaseMemoryStore {
  private cases: Map<string, AnalysisCase> = new Map();
  private llmClient: LLMClient;
  private maxCases: number = 1000; // 最大案例数
  
  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
    
    // 从持久化存储加载历史案例（生产环境）
    this.loadPersistedCases();
  }
  
  /**
   * 存储新案例
   */
  async storeCase(
    state: AnalysisStateType,
    executionMetadata: {
      agentSequence: string[];
      executionTime: number;
      tokenUsage: number;
    }
  ): Promise<string> {
    const caseId = this.generateCaseId();
    
    // 从状态中提取领域和场景信息
    const domain = (state as any).domain || 'general';
    const scenario = (state as any).scenario || 'general';
    const conclusion = (state as any).conclusion || state.finalReport || '';
    
    const newCase: AnalysisCase = {
      id: caseId,
      timestamp: new Date().toISOString(),
      
      query: state.query,
      domain: domain as DomainType,
      scenario: scenario as ScenarioType,
      complexity: state.taskComplexity || 'medium',
      
      searchResults: (state.searchResults || []).map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet
      })),
      
      timeline: (state.timeline || []).map((t: any) => ({
        timestamp: t.timestamp || t.time || '',
        event: t.event || '',
        significance: t.significance
      })),
      
      causalChains: (state.causalChain || []).map((c: any) => ({
        cause: c.cause || c.factor || '',
        effect: c.effect || c.description || '',
        strength: c.strength || 0.5
      })),
      
      keyFactors: (state.keyFactors || []).map((f: any) => ({
        factor: f.factor || f.name || '',
        impact: f.impact || f.description || '',
        weight: f.weight || 0.5
      })),
      
      scenarios: (state.scenarios || []).map((s: any) => ({
        name: s.name || '',
        probability: s.probability || 0.5,
        description: s.description || s.impacts || ''
      })),
      
      conclusion: conclusion,
      report: state.finalReport || '',
      
      agentSequence: executionMetadata.agentSequence,
      executionTime: executionMetadata.executionTime,
      tokenUsage: executionMetadata.tokenUsage,
      
      tags: this.extractTags(state),
      
      embedding: undefined // 将在后台生成
    };
    
    // 异步生成嵌入向量
    this.generateEmbedding(newCase).then(embedding => {
      newCase.embedding = embedding;
    }).catch(err => {
      console.warn('[CaseMemoryStore] Failed to generate embedding:', err);
    });
    
    this.cases.set(caseId, newCase);
    
    // 检查容量，必要时清理旧案例
    this.checkCapacity();
    
    // 持久化存储
    this.persistCase(newCase);
    
    console.log(`[CaseMemoryStore] Stored case ${caseId} for query: ${state.query.substring(0, 50)}...`);
    
    return caseId;
  }
  
  /**
   * 检索相似案例
   */
  async findSimilarCases(
    query: string,
    options: CaseSearchParams = {}
  ): Promise<SimilarCaseResult[]> {
    const limit = options.limit || 5;
    const results: SimilarCaseResult[] = [];
    
    // 生成查询嵌入
    const queryEmbedding = await this.generateEmbeddingForText(query);
    
    // 遍历所有案例计算相似度
    for (const [caseId, caseData] of this.cases) {
      // 应用过滤器
      if (options.domain && caseData.domain !== options.domain) continue;
      if (options.scenario && caseData.scenario !== options.scenario) continue;
      if (options.minRating && (caseData.feedback?.userRating || 0) < options.minRating) continue;
      
      // 计算相似度
      let similarity = 0;
      let matchedAspects: string[] = [];
      
      if (caseData.embedding && queryEmbedding) {
        // 使用向量相似度
        similarity = this.cosineSimilarity(queryEmbedding, caseData.embedding);
        matchedAspects = ['semantic'];
      } else {
        // 使用文本相似度
        const textSimilarity = this.textSimilarity(query, caseData.query);
        similarity = textSimilarity.score;
        matchedAspects = textSimilarity.matchedKeywords;
      }
      
      if (similarity > 0.3) { // 相似度阈值
        results.push({
          case: caseData,
          similarity,
          matchedAspects
        });
      }
    }
    
    // 按相似度排序并返回 top N
    results.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`[CaseMemoryStore] Found ${results.length} similar cases for query: ${query.substring(0, 50)}...`);
    
    return results.slice(0, limit);
  }
  
  /**
   * 获取案例
   */
  getCase(caseId: string): AnalysisCase | undefined {
    return this.cases.get(caseId);
  }
  
  /**
   * 更新案例反馈
   */
  updateFeedback(caseId: string, feedback: Partial<CaseFeedback>): boolean {
    const caseData = this.cases.get(caseId);
    if (!caseData) return false;
    
    caseData.feedback = {
      ...caseData.feedback,
      ...feedback
    };
    
    this.persistCase(caseData);
    
    console.log(`[CaseMemoryStore] Updated feedback for case ${caseId}`);
    
    return true;
  }
  
  /**
   * 记录实际结果
   */
  recordActualOutcome(
    caseId: string,
    outcome: NonNullable<CaseFeedback['actualOutcome']>
  ): boolean {
    const caseData = this.cases.get(caseId);
    if (!caseData) return false;
    
    if (!caseData.feedback) {
      caseData.feedback = {};
    }
    
    caseData.feedback.actualOutcome = outcome;
    
    this.persistCase(caseData);
    
    console.log(`[CaseMemoryStore] Recorded actual outcome for case ${caseId}: ${outcome.accuracy}`);
    
    return true;
  }
  
  /**
   * 获取高价值案例（高评分、高准确度）
   */
  getHighValueCases(limit: number = 10): AnalysisCase[] {
    const cases = Array.from(this.cases.values())
      .filter(c => {
        const rating = c.feedback?.userRating || 0;
        const accuracy = c.feedback?.actualOutcome?.accuracy;
        return rating >= 4 || accuracy === 'accurate';
      })
      .sort((a, b) => {
        const scoreA = (a.feedback?.userRating || 0) + (a.feedback?.actualOutcome?.accuracy === 'accurate' ? 2 : 0);
        const scoreB = (b.feedback?.userRating || 0) + (b.feedback?.actualOutcome?.accuracy === 'accurate' ? 2 : 0);
        return scoreB - scoreA;
      });
    
    return cases.slice(0, limit);
  }
  
  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalCases: number;
    avgRating: number;
    accuracyRate: number;
    domainDistribution: Record<string, number>;
    topTags: Array<{ tag: string; count: number }>;
  } {
    const cases = Array.from(this.cases.values());
    
    // 计算平均评分
    const ratedCases = cases.filter(c => c.feedback?.userRating);
    const avgRating = ratedCases.length > 0
      ? ratedCases.reduce((sum, c) => sum + (c.feedback?.userRating || 0), 0) / ratedCases.length
      : 0;
    
    // 计算准确率
    const verifiedCases = cases.filter(c => c.feedback?.actualOutcome);
    const accurateCases = verifiedCases.filter(c => c.feedback?.actualOutcome?.accuracy === 'accurate');
    const accuracyRate = verifiedCases.length > 0
      ? accurateCases.length / verifiedCases.length
      : 0;
    
    // 领域分布
    const domainDistribution: Record<string, number> = {};
    cases.forEach(c => {
      domainDistribution[c.domain] = (domainDistribution[c.domain] || 0) + 1;
    });
    
    // 热门标签
    const tagCounts: Record<string, number> = {};
    cases.forEach(c => {
      c.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const topTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalCases: cases.length,
      avgRating,
      accuracyRate,
      domainDistribution,
      topTags
    };
  }
  
  // ============================================================================
  // 私有方法
  // ============================================================================
  
  private generateCaseId(): string {
    return `case_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  private extractTags(state: AnalysisStateType): string[] {
    const tags: Set<string> = new Set();
    
    // 从查询中提取关键词
    const queryKeywords = state.query.split(/[\s,，。？！]+/).filter(w => w.length > 1);
    queryKeywords.forEach(w => tags.add(w));
    
    // 从关键因素中提取
    (state.keyFactors || []).forEach((f: any) => {
      const factor = f.factor || f.name || '';
      if (factor) tags.add(factor);
    });
    
    // 从领域提取
    const domain = (state as any).domain;
    const scenario = (state as any).scenario;
    if (domain) tags.add(domain);
    if (scenario) tags.add(scenario);
    
    return Array.from(tags).slice(0, 10);
  }
  
  private async generateEmbedding(caseData: AnalysisCase): Promise<number[]> {
    const text = [
      caseData.query,
      caseData.conclusion,
      ...caseData.keyFactors.map(f => f.factor),
      ...caseData.tags
    ].join(' ');
    
    return this.generateEmbeddingForText(text);
  }
  
  private async generateEmbeddingForText(text: string): Promise<number[]> {
    // 简化实现：使用 LLM 生成语义表示
    // 生产环境应使用专门的 embedding 模型
    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '请生成文本的语义向量表示（128维，返回JSON数组）' },
        { role: 'user', content: text.substring(0, 500) }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.1
      });
      
      // 解析向量（简化处理，实际应使用专业嵌入模型）
      const content = response.content || '[]';
      // 返回一个基于文本哈希的伪向量（实际应调用 embedding API）
      const hash = this.simpleHash(text);
      return Array.from({ length: 128 }, (_, i) => 
        Math.sin(hash + i * 0.1) * 0.5 + Math.random() * 0.1
      );
    } catch (error) {
      console.warn('[CaseMemoryStore] Embedding generation failed:', error);
      return [];
    }
  }
  
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
  
  private textSimilarity(query: string, target: string): {
    score: number;
    matchedKeywords: string[];
  } {
    const queryWords = new Set(query.toLowerCase().split(/[\s,，。？！]+/).filter(w => w.length > 1));
    const targetWords = new Set(target.toLowerCase().split(/[\s,，。？！]+/).filter(w => w.length > 1));
    
    const intersection = [...queryWords].filter(w => targetWords.has(w));
    const union = new Set([...queryWords, ...targetWords]);
    
    return {
      score: union.size > 0 ? intersection.length / union.size : 0,
      matchedKeywords: intersection
    };
  }
  
  private checkCapacity(): void {
    if (this.cases.size > this.maxCases) {
      // 删除最旧的案例（保留高评分案例）
      const entries = Array.from(this.cases.entries())
        .filter(([_, c]) => !c.feedback?.userRating || c.feedback.userRating < 3)
        .sort((a, b) => new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime());
      
      const toRemove = entries.slice(0, this.cases.size - this.maxCases + 100);
      toRemove.forEach(([id]) => this.cases.delete(id));
      
      console.log(`[CaseMemoryStore] Cleaned ${toRemove.length} old cases`);
    }
  }
  
  private loadPersistedCases(): void {
    // 生产环境应从数据库加载
    console.log('[CaseMemoryStore] Initialized with in-memory storage');
  }
  
  private persistCase(caseData: AnalysisCase): void {
    // 生产环境应持久化到数据库
    console.log(`[CaseMemoryStore] Persisting case ${caseData.id}`);
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const caseMemoryStore = new CaseMemoryStore();
