/**
 * 假设验证沙盒
 * 实现多假设并行对比验证功能
 */

import { LLMClient, Config, SearchClient } from 'coze-coding-dev-sdk';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 沙盒假设
 */
export interface SandboxHypothesis {
  id: string;
  statement: string;
  initialConfidence: number;
  currentConfidence: number;
  status: 'active' | 'validated' | 'refuted' | 'inconclusive';
  
  // 证据
  supportingEvidence: SandboxEvidence[];
  refutingEvidence: SandboxEvidence[];
  neutralEvidence: SandboxEvidence[];
  
  // 权重（用户可调整）
  weight: number;
  
  // 竞争假设关系
  competesWith: string[]; // 竞争假设ID列表
  
  // 元数据
  tags: string[];
  source: 'user' | 'system' | 'imported';
  createdAt: string;
  updatedAt: string;
}

/**
 * 沙盒证据
 */
export interface SandboxEvidence {
  id: string;
  content: string;
  source: string;
  sourceUrl?: string;
  timestamp: string;
  
  // 关联假设
  hypothesisId: string;
  
  // 证据属性
  type: 'supporting' | 'refuting' | 'neutral';
  strength: number; // 0-1
  relevance: number; // 0-1
  
  // 用户评估
  userRating?: number; // 1-5 用户评分
  userNotes?: string;
  isVerified: boolean; // 用户是否已核实
}

/**
 * 证据输入
 */
export interface EvidenceInput {
  content: string;
  source?: string;
  sourceUrl?: string;
}

/**
 * 沙盒配置
 */
export interface SandboxConfig {
  maxHypotheses: number;
  autoUpdateConfidence: boolean;
  showCompetingRelations: boolean;
  evidenceStrengthThreshold: number;
}

/**
 * 沙盒状态
 */
export interface SandboxState {
  id: string;
  name: string;
  description: string;
  hypotheses: SandboxHypothesis[];
  allEvidence: SandboxEvidence[];
  
  // 对比结果
  comparison: {
    leadingHypothesis: string | null;
    confidenceGap: number;
    consensusReached: boolean;
    recommendation: string;
  };
  
  // 元数据
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'completed';
}

/**
 * 对比矩阵
 */
export interface ComparisonMatrix {
  hypotheses: string[];
  evidenceToHypothesis: Map<string, Map<string, 'support' | 'refute' | 'neutral' | 'none'>>;
  scores: Map<string, { support: number; refute: number; net: number }>;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: SandboxConfig = {
  maxHypotheses: 5,
  autoUpdateConfidence: true,
  showCompetingRelations: true,
  evidenceStrengthThreshold: 0.5
};

// ============================================================================
// 假设验证沙盒类
// ============================================================================

/**
 * 假设验证沙盒
 */
export class HypothesisSandbox {
  private llmClient: LLMClient;
  private searchClient: SearchClient;
  private config: SandboxConfig;
  private state: SandboxState;
  
  constructor(name: string, description: string, config?: Partial<SandboxConfig>) {
    const sdkConfig = new Config();
    this.llmClient = new LLMClient(sdkConfig);
    this.searchClient = new SearchClient(sdkConfig);
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.state = {
      id: `sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name,
      description,
      hypotheses: [],
      allEvidence: [],
      comparison: {
        leadingHypothesis: null,
        confidenceGap: 0,
        consensusReached: false,
        recommendation: ''
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft'
    };
  }
  
  /**
   * 添加假设
   */
  addHypothesis(
    statement: string,
    initialConfidence: number = 0.5,
    options?: {
      weight?: number;
      tags?: string[];
      source?: 'user' | 'system' | 'imported';
      competesWith?: string[];
    }
  ): SandboxHypothesis {
    if (this.state.hypotheses.length >= this.config.maxHypotheses) {
      throw new Error(`Maximum hypotheses (${this.config.maxHypotheses}) reached`);
    }
    
    const hypothesis: SandboxHypothesis = {
      id: `hyp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      statement,
      initialConfidence,
      currentConfidence: initialConfidence,
      status: 'active',
      supportingEvidence: [],
      refutingEvidence: [],
      neutralEvidence: [],
      weight: options?.weight ?? 1.0,
      competesWith: options?.competesWith ?? [],
      tags: options?.tags ?? [],
      source: options?.source ?? 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.state.hypotheses.push(hypothesis);
    this.state.updatedAt = new Date().toISOString();
    
    return hypothesis;
  }
  
  /**
   * 添加证据
   */
  async addEvidence(
    evidenceInput: EvidenceInput,
    targetHypothesisIds?: string[]
  ): Promise<SandboxEvidence[]> {
    const targetIds = targetHypothesisIds || this.state.hypotheses.map(h => h.id);
    const createdEvidence: SandboxEvidence[] = [];
    
    // 使用LLM评估证据对每个假设的影响
    const evidenceAssessment = await this.assessEvidenceForHypotheses(
      evidenceInput.content,
      targetIds
    );
    
    for (const assessment of evidenceAssessment) {
      const evidence: SandboxEvidence = {
        id: `evd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        content: evidenceInput.content,
        source: evidenceInput.source || '用户输入',
        sourceUrl: evidenceInput.sourceUrl,
        timestamp: new Date().toISOString(),
        hypothesisId: assessment.hypothesisId,
        type: assessment.type,
        strength: assessment.strength,
        relevance: assessment.relevance,
        isVerified: false
      };
      
      // 添加到对应假设
      const hypothesis = this.state.hypotheses.find(h => h.id === assessment.hypothesisId);
      if (hypothesis) {
        switch (evidence.type) {
          case 'supporting':
            hypothesis.supportingEvidence.push(evidence);
            break;
          case 'refuting':
            hypothesis.refutingEvidence.push(evidence);
            break;
          case 'neutral':
            hypothesis.neutralEvidence.push(evidence);
            break;
        }
        hypothesis.updatedAt = new Date().toISOString();
      }
      
      this.state.allEvidence.push(evidence);
      createdEvidence.push(evidence);
    }
    
    // 自动更新置信度
    if (this.config.autoUpdateConfidence) {
      this.updateAllConfidences();
    }
    
    this.state.updatedAt = new Date().toISOString();
    
    return createdEvidence;
  }
  
  /**
   * 评估证据对假设的影响
   */
  private async assessEvidenceForHypotheses(
    evidenceContent: string,
    hypothesisIds: string[]
  ): Promise<Array<{
    hypothesisId: string;
    type: 'supporting' | 'refuting' | 'neutral';
    strength: number;
    relevance: number;
  }>> {
    const hypotheses = this.state.hypotheses.filter(h => hypothesisIds.includes(h.id));
    
    const prompt = `评估以下证据对各个假设的影响：

证据：
${evidenceContent}

假设：
${hypotheses.map((h, i) => `${i + 1}. [${h.id}] ${h.statement}`).join('\n')}

请对每个假设评估证据的影响，按以下JSON格式输出：
{
  "assessments": [
    {
      "hypothesisId": "假设ID",
      "type": "supporting/refuting/neutral",
      "strength": 0.0-1.0,
      "relevance": 0.0-1.0,
      "reasoning": "简短理由"
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是专业的证据评估专家。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.4
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.assessments || [];
      }
    } catch (error) {
      console.error('[assessEvidence] Error:', error);
    }
    
    // 默认评估：所有假设都是中性
    return hypothesisIds.map(id => ({
      hypothesisId: id,
      type: 'neutral' as const,
      strength: 0.5,
      relevance: 0.5
    }));
  }
  
  /**
   * 更新所有置信度
   */
  updateAllConfidences(): void {
    for (const hypothesis of this.state.hypotheses) {
      const newConfidence = this.calculateConfidence(hypothesis);
      hypothesis.currentConfidence = newConfidence;
      hypothesis.updatedAt = new Date().toISOString();
      
      // 更新状态
      if (newConfidence >= 0.8) {
        hypothesis.status = 'validated';
      } else if (newConfidence <= 0.2) {
        hypothesis.status = 'refuted';
      } else if (hypothesis.supportingEvidence.length === 0 && 
                 hypothesis.refutingEvidence.length === 0) {
        hypothesis.status = 'active';
      } else {
        hypothesis.status = 'inconclusive';
      }
    }
    
    this.updateComparison();
  }
  
  /**
   * 计算单个假设置信度
   */
  private calculateConfidence(hypothesis: SandboxHypothesis): number {
    const { initialConfidence, supportingEvidence, refutingEvidence, neutralEvidence } = hypothesis;
    
    // 加权证据强度
    const supportWeight = supportingEvidence.reduce(
      (sum, e) => sum + e.strength * e.relevance * (e.userRating ? e.userRating / 5 : 1),
      0
    );
    const refuteWeight = refutingEvidence.reduce(
      (sum, e) => sum + e.strength * e.relevance * (e.userRating ? e.userRating / 5 : 1),
      0
    );
    
    // 考虑竞争假设
    let competitionAdjustment = 0;
    for (const competitorId of hypothesis.competesWith) {
      const competitor = this.state.hypotheses.find(h => h.id === competitorId);
      if (competitor && competitor.currentConfidence > hypothesis.currentConfidence) {
        competitionAdjustment -= 0.05; // 竞争假设领先时略微降低置信度
      }
    }
    
    // 贝叶斯更新
    const totalEvidence = supportWeight + refuteWeight;
    if (totalEvidence === 0) {
      return Math.max(0.1, Math.min(0.9, initialConfidence + competitionAdjustment));
    }
    
    const likelihood = supportWeight / totalEvidence;
    const posterior = (initialConfidence * likelihood) / 
      (initialConfidence * likelihood + (1 - initialConfidence) * (1 - likelihood));
    
    return Math.max(0.1, Math.min(0.9, posterior + competitionAdjustment));
  }
  
  /**
   * 更新对比结果
   */
  private updateComparison(): void {
    const { hypotheses } = this.state;
    
    if (hypotheses.length === 0) {
      this.state.comparison = {
        leadingHypothesis: null,
        confidenceGap: 0,
        consensusReached: false,
        recommendation: '请添加假设开始验证'
      };
      return;
    }
    
    // 找出领先假设
    const sorted = [...hypotheses].sort((a, b) => 
      b.currentConfidence - a.currentConfidence
    );
    
    const leading = sorted[0];
    const second = sorted[1];
    
    const confidenceGap = second 
      ? leading.currentConfidence - second.currentConfidence 
      : leading.currentConfidence;
    
    // 判断是否达成共识
    const consensusReached = leading.currentConfidence >= 0.75 && confidenceGap >= 0.2;
    
    // 生成建议
    let recommendation = '';
    if (consensusReached) {
      recommendation = `建议采纳假设：「${leading.statement.substring(0, 30)}...」（置信度 ${(leading.currentConfidence * 100).toFixed(0)}%）`;
    } else if (leading.currentConfidence >= 0.6) {
      recommendation = `假设「${leading.statement.substring(0, 30)}...」领先，但需要更多证据支持`;
    } else {
      recommendation = '各假设置信度较低，建议收集更多证据';
    }
    
    this.state.comparison = {
      leadingHypothesis: leading.id,
      confidenceGap,
      consensusReached,
      recommendation
    };
  }
  
  /**
   * 设置假设竞争关系
   */
  setCompetition(hypothesisId: string, competitorIds: string[]): void {
    const hypothesis = this.state.hypotheses.find(h => h.id === hypothesisId);
    if (hypothesis) {
      hypothesis.competesWith = competitorIds;
      hypothesis.updatedAt = new Date().toISOString();
      
      if (this.config.autoUpdateConfidence) {
        this.updateAllConfidences();
      }
    }
  }
  
  /**
   * 设置证据用户评分
   */
  rateEvidence(evidenceId: string, rating: number, notes?: string): void {
    const evidence = this.state.allEvidence.find(e => e.id === evidenceId);
    if (evidence) {
      evidence.userRating = rating;
      evidence.userNotes = notes;
      evidence.isVerified = true;
      
      if (this.config.autoUpdateConfidence) {
        this.updateAllConfidences();
      }
    }
  }
  
  /**
   * 搜索相关证据
   */
  async searchEvidence(query: string): Promise<EvidenceInput[]> {
    try {
      const results = await this.searchClient.advancedSearch(query, {
        searchType: 'web',
        count: 5,
        needSummary: true
      });
      
      const items = (results as any).web_items || [];
      
      return items.map((item: any) => ({
        content: item.summary || item.snippet || item.title,
        source: item.source || item.site || '网络搜索',
        sourceUrl: item.url || item.link
      }));
    } catch (error) {
      console.error('[searchEvidence] Error:', error);
      return [];
    }
  }
  
  /**
   * 生成对比矩阵
   */
  generateComparisonMatrix(): ComparisonMatrix {
    const matrix: ComparisonMatrix = {
      hypotheses: this.state.hypotheses.map(h => h.id),
      evidenceToHypothesis: new Map(),
      scores: new Map()
    };
    
    // 为每个证据建立对假设的影响映射
    for (const evidence of this.state.allEvidence) {
      const hypothesisImpact = new Map<string, 'support' | 'refute' | 'neutral' | 'none'>();
      
      for (const hypothesis of this.state.hypotheses) {
        if (evidence.hypothesisId === hypothesis.id) {
          hypothesisImpact.set(hypothesis.id, 
            evidence.type === 'supporting' ? 'support' : 
            evidence.type === 'refuting' ? 'refute' : 'neutral'
          );
        } else {
          hypothesisImpact.set(hypothesis.id, 'none');
        }
      }
      
      matrix.evidenceToHypothesis.set(evidence.id, hypothesisImpact);
    }
    
    // 计算每个假设的得分
    for (const hypothesis of this.state.hypotheses) {
      const support = hypothesis.supportingEvidence.reduce((sum, e) => sum + e.strength, 0);
      const refute = hypothesis.refutingEvidence.reduce((sum, e) => sum + e.strength, 0);
      
      matrix.scores.set(hypothesis.id, {
        support,
        refute,
        net: support - refute
      });
    }
    
    return matrix;
  }
  
  /**
   * 获取状态快照
   */
  getState(): SandboxState {
    return { ...this.state };
  }
  
  /**
   * 导出报告
   */
  exportReport(): string {
    const { state } = this;
    
    let report = `# 假设验证沙盒报告\n\n`;
    report += `**名称**: ${state.name}\n`;
    report += `**描述**: ${state.description}\n`;
    report += `**状态**: ${state.status}\n`;
    report += `**创建时间**: ${state.createdAt}\n`;
    report += `**更新时间**: ${state.updatedAt}\n\n`;
    
    report += `## 假设对比\n\n`;
    report += `| 假设 | 初始置信度 | 当前置信度 | 状态 | 支持证据 | 反驳证据 |\n`;
    report += `|------|-----------|-----------|------|---------|--------|\n`;
    
    for (const h of state.hypotheses) {
      report += `| ${h.statement.substring(0, 30)}... | ${(h.initialConfidence * 100).toFixed(0)}% | ${(h.currentConfidence * 100).toFixed(0)}% | ${h.status} | ${h.supportingEvidence.length} | ${h.refutingEvidence.length} |\n`;
    }
    
    report += `\n## 对比结论\n\n`;
    report += `- **领先假设**: ${state.comparison.leadingHypothesis || '无'}\n`;
    report += `- **置信度差距**: ${(state.comparison.confidenceGap * 100).toFixed(0)}%\n`;
    report += `- **是否达成共识**: ${state.comparison.consensusReached ? '是' : '否'}\n`;
    report += `- **建议**: ${state.comparison.recommendation}\n`;
    
    report += `\n## 证据列表\n\n`;
    report += `共 ${state.allEvidence.length} 条证据\n`;
    
    return report;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建假设验证沙盒
 */
export function createHypothesisSandbox(
  name: string,
  description: string,
  config?: Partial<SandboxConfig>
): HypothesisSandbox {
  return new HypothesisSandbox(name, description, config);
}
