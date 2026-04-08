/**
 * 自动复盘进化管理器
 * 
 * 核心职责：
 * 1. 分析完成后自动触发复盘
 * 2. 根据用户交互记录生成优化建议
 * 3. 后台持续学习和知识沉淀
 * 
 * 架构说明：
 * - 客户端：负责数据收集、本地缓存、UI交互
 * - 服务端：负责LLM分析、嵌入匹配、知识提取
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface UserInteraction {
  type: 'view_switch' | 'hypothesis_vote' | 'sandbox_complete' | 'simulation_complete' | 'user_feedback' | 'chat_question';
  topic: string;
  data: any;
  timestamp: number;
}

export interface AnalysisCase {
  id: string;
  topic: string;
  searchResults: any[];
  timeline: any[];
  keyFactors: any[];
  scenarios: any[];
  causalChains?: any[];
  conclusion: string;
  finalReport?: string;
  createdAt: number;
  userInteractions: UserInteraction[];
  feedback?: UserFeedback;
}

export interface UserFeedback {
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  helpful: boolean;
  timestamp: number;
}

export interface OptimizationSuggestion {
  id: string;
  type: 'prompt_improvement' | 'knowledge_gap' | 'agent_enhancement' | 'workflow_optimization';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  autoApplicable: boolean;
  details?: any;
  createdAt: number;
}

export interface KnowledgePattern {
  id: string;
  type: 'causal_chain' | 'risk_path' | 'indicator' | 'scenario_template';
  pattern: string;
  frequency: number;
  lastUsed: number;
  effectiveness: number;
  context: string[];
}

export interface EvolutionAnalysisResult {
  similarCases: AnalysisCase[];
  analysis: {
    userPreferences: {
      preferredViews: string[];
      analysisStyle: string;
      commonTopics: string[];
    };
    knowledgeGaps: Array<{
      topic: string;
      suggestion: string;
    }>;
    optimizationSuggestions: OptimizationSuggestion[];
  } | null;
  timestamp: number;
}

// ============================================================================
// 自动复盘进化管理器（客户端）
// ============================================================================

class AutoEvolutionManager {
  private interactions: UserInteraction[] = [];
  private cases: AnalysisCase[] = [];
  private patterns: KnowledgePattern[] = [];
  private maxInteractions: number = 100;
  private maxCases: number = 50;
  private analysisCache: Map<string, EvolutionAnalysisResult> = new Map();
  
  constructor() {
    this.loadFromStorage();
  }
  
  /**
   * 记录用户交互
   */
  recordInteraction(interaction: UserInteraction): void {
    this.interactions.push(interaction);
    
    if (this.interactions.length > this.maxInteractions) {
      this.interactions = this.interactions.slice(-this.maxInteractions);
    }
    
    this.saveToStorage();
  }
  
  /**
   * 保存分析案例
   */
  saveCase(caseData: Partial<AnalysisCase>): string {
    const id = `case_${Date.now()}`;
    const newCase: AnalysisCase = {
      id,
      topic: caseData.topic || '',
      searchResults: caseData.searchResults || [],
      timeline: caseData.timeline || [],
      keyFactors: caseData.keyFactors || [],
      scenarios: caseData.scenarios || [],
      causalChains: caseData.causalChains || [],
      conclusion: caseData.conclusion || '',
      finalReport: caseData.finalReport,
      createdAt: Date.now(),
      userInteractions: this.interactions.filter(i => i.topic === caseData.topic)
    };
    
    this.cases.push(newCase);
    
    if (this.cases.length > this.maxCases) {
      this.cases = this.cases.slice(-this.maxCases);
    }
    
    this.saveToStorage();
    
    // 异步提取知识模式（调用服务端LLM）
    this.extractPatternsAsync(newCase);
    
    return id;
  }
  
  /**
   * 获取优化建议（调用服务端LLM分析）
   */
  async getSuggestion(context: {
    topic: string;
    searchResults: any[];
    timeline: any[];
    keyFactors: any[];
    scenarios: any[];
    conclusion: string;
  }): Promise<OptimizationSuggestion | null> {
    try {
      // 调用服务端API进行智能分析
      const response = await fetch('/api/evolution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactions: this.interactions,
          cases: this.cases,
          currentAnalysis: context,
          patterns: this.patterns
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.analysis?.optimizationSuggestions?.length > 0) {
        const suggestion = result.data.analysis.optimizationSuggestions[0];
        return {
          id: `suggestion_${Date.now()}`,
          ...suggestion,
          createdAt: Date.now()
        };
      }
      
      // 缓存相似案例供后续使用
      if (result.data?.similarCases?.length > 0) {
        this.analysisCache.set(context.topic, result.data);
      }
      
    } catch (error) {
      console.error('[AutoEvolution] Failed to get suggestion:', error);
    }
    
    return null;
  }
  
  /**
   * 查找相似案例（使用嵌入模型）
   */
  async findSimilarCasesAsync(topic: string): Promise<AnalysisCase[]> {
    // 检查缓存
    const cached = this.analysisCache.get(topic);
    if (cached?.similarCases) {
      return cached.similarCases;
    }
    
    // 调用服务端进行语义匹配
    try {
      const response = await fetch('/api/evolution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactions: [],
          cases: this.cases,
          currentAnalysis: { topic },
          patterns: []
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.similarCases) {
        return result.data.similarCases;
      }
    } catch (error) {
      console.error('[AutoEvolution] Failed to find similar cases:', error);
    }
    
    // 降级：本地关键词匹配
    return this.findSimilarCasesLocal(topic);
  }
  
  /**
   * 本地降级：关键词匹配
   */
  findSimilarCasesLocal(topic: string): AnalysisCase[] {
    const keywords = topic.toLowerCase().split(/[\s,，]+/);
    
    return this.cases
      .map(c => ({
        case: c,
        score: this.calculateSimilarity(keywords, c.topic.toLowerCase())
      }))
      .filter(item => item.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .map(item => item.case);
  }
  
  /**
   * 获取所有案例
   */
  getCases(): AnalysisCase[] {
    return [...this.cases].sort((a, b) => b.createdAt - a.createdAt);
  }
  
  /**
   * 获取知识模式
   */
  getPatterns(): KnowledgePattern[] {
    return [...this.patterns].sort((a, b) => b.frequency - a.frequency);
  }
  
  /**
   * 应用优化建议
   */
  async applySuggestion(suggestion: OptimizationSuggestion): Promise<boolean> {
    switch (suggestion.type) {
      case 'workflow_optimization':
        if (suggestion.details?.suggestedDefaultView) {
          localStorage.setItem('preferredDefaultView', suggestion.details.suggestedDefaultView);
        }
        return true;
        
      case 'knowledge_gap':
        return true;
        
      case 'prompt_improvement':
        return false;
        
      default:
        return false;
    }
  }
  
  // ============================================================================
  // 私有方法
  // ============================================================================
  
  private calculateSimilarity(keywords: string[], target: string): number {
    const matches = keywords.filter(k => k.length > 1 && target.includes(k));
    return matches.length / keywords.length;
  }
  
  /**
   * 异步提取知识模式（调用服务端LLM）
   */
  private async extractPatternsAsync(caseData: AnalysisCase): Promise<void> {
    try {
      const response = await fetch('/api/evolution/analyze', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseData })
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const { causalPatterns, riskPaths, indicatorPatterns } = result.data;
        
        // 添加因果链模式
        (causalPatterns || []).forEach((p: any) => {
          this.upsertPattern({
            type: 'causal_chain',
            pattern: p.pattern,
            frequency: 1,
            effectiveness: p.confidence || 0.7,
            context: p.applicableContexts || [caseData.topic]
          });
        });
        
        // 添加风险路径
        (riskPaths || []).forEach((p: any) => {
          this.upsertPattern({
            type: 'risk_path',
            pattern: p.path,
            frequency: 1,
            effectiveness: p.probability || 0.7,
            context: [caseData.topic]
          });
        });
        
        // 添加指标模式
        (indicatorPatterns || []).forEach((p: any) => {
          this.upsertPattern({
            type: 'indicator',
            pattern: `${p.indicator}: ${p.signals?.join(', ')}`,
            frequency: 1,
            effectiveness: p.historicalAccuracy || 0.7,
            context: [caseData.topic]
          });
        });
      }
    } catch (error) {
      console.error('[AutoEvolution] Failed to extract patterns:', error);
      // 降级：本地简单提取
      this.extractPatternsLocal(caseData);
    }
  }
  
  /**
   * 本地降级：简单模式提取
   */
  private extractPatternsLocal(caseData: AnalysisCase): void {
    if (caseData.keyFactors && caseData.keyFactors.length > 0) {
      caseData.keyFactors.forEach(factor => {
        if (factor.name && factor.impact) {
          this.upsertPattern({
            type: 'indicator',
            pattern: `${factor.name} → ${factor.impact?.substring(0, 50)}`,
            frequency: 1,
            effectiveness: 0.7,
            context: [caseData.topic]
          });
        }
      });
    }
  }
  
  private upsertPattern(data: {
    type: KnowledgePattern['type'];
    pattern: string;
    frequency: number;
    effectiveness: number;
    context: string[];
  }): void {
    const existing = this.patterns.find(p => 
      p.type === data.type && p.pattern === data.pattern
    );
    
    if (existing) {
      existing.frequency += data.frequency;
      existing.lastUsed = Date.now();
      if (!existing.context.includes(data.context[0])) {
        existing.context.push(data.context[0]);
      }
    } else {
      this.patterns.push({
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: data.type,
        pattern: data.pattern,
        frequency: data.frequency,
        lastUsed: Date.now(),
        effectiveness: data.effectiveness,
        context: data.context
      });
    }
    
    if (this.patterns.length > 100) {
      this.patterns.sort((a, b) => b.frequency - a.frequency);
      this.patterns = this.patterns.slice(0, 100);
    }
    
    this.saveToStorage();
  }
  
  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('evolution_interactions', JSON.stringify(this.interactions));
        localStorage.setItem('evolution_cases', JSON.stringify(this.cases));
        localStorage.setItem('evolution_patterns', JSON.stringify(this.patterns));
      }
    } catch (e) {
      console.error('[AutoEvolution] Failed to save to storage:', e);
    }
  }
  
  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const interactions = localStorage.getItem('evolution_interactions');
        const cases = localStorage.getItem('evolution_cases');
        const patterns = localStorage.getItem('evolution_patterns');
        
        if (interactions) this.interactions = JSON.parse(interactions);
        if (cases) this.cases = JSON.parse(cases);
        if (patterns) this.patterns = JSON.parse(patterns);
      }
    } catch (e) {
      console.error('[AutoEvolution] Failed to load from storage:', e);
    }
  }
}

// 导出单例
export const autoEvolutionManager = new AutoEvolutionManager();
