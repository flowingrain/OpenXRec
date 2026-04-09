/**
 * 因果发现引擎
 * 从文本、数据中自动识别因果关系
 * 结合LLM语义理解和统计方法
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import {
  CausalVariable,
  CausalEdge,
  CausalDiscoveryResult,
  DiscoveredCausalRelation,
  CausalEvidence,
  ConfidenceLevel,
  Confounder,
} from './types';

// ============================================================================
// 因果关系模式库
// ============================================================================

/**
 * 中文因果表达模式
 */
const CAUSAL_PATTERNS_ZH = [
  // 明确因果
  { pattern: /(.+?)导致(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const },
  { pattern: /(.+?)引发(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const },
  { pattern: /(.+?)造成(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const },
  { pattern: /(.+?)使得(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const },
  { pattern: /(.+?)促使(.+?)(?:，|。|；|$)/g, strength: 'contributory' as const },
  { pattern: /(.+?)推动(.+?)(?:，|。|；|$)/g, strength: 'contributory' as const },
  
  // 条件因果
  { pattern: /如果(.+?)，(?:那么|则)?(.+?)(?:，|。|；|$)/g, strength: 'necessary' as const },
  { pattern: /(.+?)的前提是(.+?)(?:，|。|；|$)/g, strength: 'necessary' as const },
  
  // 影响关系
  { pattern: /(.+?)影响(.+?)(?:，|。|；|$)/g, strength: 'contributory' as const },
  { pattern: /(.+?)对(.+?)产生(?:重大|重要|一定)?影响/g, strength: 'contributory' as const },
  { pattern: /(.+?)冲击(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const },
  
  // 因果链
  { pattern: /(.+?)进而(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const },
  { pattern: /(.+?)从而(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const },
  
  // 阻止/抑制
  { pattern: /(.+?)阻止(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const, direction: 'negative' as const },
  { pattern: /(.+?)抑制(.+?)(?:，|。|；|$)/g, strength: 'sufficient' as const, direction: 'negative' as const },
  { pattern: /(.+?)削弱(.+?)(?:，|。|；|$)/g, strength: 'contributory' as const, direction: 'negative' as const },
];

/**
 * 因果连接词
 */
const CAUSAL_CONNECTORS = {
  forward: ['导致', '引发', '造成', '使得', '促使', '推动', '影响', '冲击', '进而', '从而'],
  backward: ['因为', '由于', '源于', '归因于', '起因于', '受制于', '取决于'],
  bidirectional: ['与...相关', '关联', '联系'],
  negative: ['阻止', '抑制', '削弱', '减少', '降低'],
};

// ============================================================================
// 因果发现引擎类
// ============================================================================

/**
 * 因果发现引擎
 */
export class CausalDiscoveryEngine {
  private llmClient: LLMClient;
  
  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
  }
  
  // ===========================================================================
  // 主要方法
  // ===========================================================================
  
  /**
   * 从文本中发现因果关系
   */
  async discoverFromText(
    text: string,
    context?: {
      domain?: string;
      knownVariables?: CausalVariable[];
      existingRelations?: CausalEdge[];
    }
  ): Promise<CausalDiscoveryResult> {
    // 1. 基于模式匹配的快速发现
    const patternRelations = this.extractByPatterns(text);
    
    // 2. 基于LLM的深度发现
    const llmRelations = await this.extractByLLM(text, context);
    
    // 3. 合并结果
    const mergedRelations = this.mergeRelations(patternRelations, llmRelations);
    
    // 4. 识别混杂因素
    const confounders = await this.identifyConfounders(mergedRelations, text);
    
    // 5. 识别中介变量
    const mediators = this.identifyMediators(mergedRelations);
    
    // 6. 构建因果图建议
    const suggestedGraph = this.buildSuggestedGraph(mergedRelations);
    
    // 7. 质量评估
    const qualityAssessment = this.assessQuality(mergedRelations, confounders);
    
    // 8. 生成建议
    const recommendations = this.generateRecommendations(mergedRelations, confounders, mediators);
    
    // 提取变量
    const variables = this.extractVariables(mergedRelations);
    
    return {
      relations: mergedRelations,
      variables,
      suggestedGraph,
      confounders: confounders.map(c => c.name),
      mediators,
      qualityAssessment,
      recommendations,
    };
  }
  
  /**
   * 从搜索结果中发现因果关系
   */
  async discoverFromSearchResults(
    items: Array<{ title?: string; snippet?: string; content?: string }>,
    domain?: string
  ): Promise<CausalDiscoveryResult> {
    // 合并所有文本
    const combinedText = items
      .map(item => `${item.title || ''} ${item.snippet || ''} ${item.content || ''}`)
      .join('\n\n');
    
    return this.discoverFromText(combinedText, { domain });
  }
  
  // ===========================================================================
  // 模式匹配提取
  // ===========================================================================
  
  /**
   * 基于模式匹配提取因果关系
   */
  private extractByPatterns(text: string): DiscoveredCausalRelation[] {
    const relations: DiscoveredCausalRelation[] = [];
    
    for (const { pattern, strength, direction } of CAUSAL_PATTERNS_ZH) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(text)) !== null) {
        const cause = this.cleanEntity(match[1]);
        const effect = this.cleanEntity(match[2]);
        
        if (this.isValidCausalPair(cause, effect)) {
          relations.push({
            cause,
            effect,
            relationType: 'causal',
            confidence: this.calculatePatternConfidence(pattern.source, text),
            discoveryMethod: 'statistical',
            evidence: [match[0]],
            reverseCausality: this.checkReverseCausality(cause, effect, text),
          });
        }
      }
    }
    
    return this.deduplicateRelations(relations);
  }
  
  /**
   * 清理实体名称
   */
  private cleanEntity(entity: string): string {
    return entity
      .replace(/^[，。、；：？！""''（）【】《》\s]+/, '')
      .replace(/[，。、；：？！""''（）【】《》\s]+$/, '')
      .trim()
      .slice(0, 50); // 限制长度
  }
  
  /**
   * 验证因果对是否有效
   */
  private isValidCausalPair(cause: string, effect: string): boolean {
    // 长度检查
    if (cause.length < 2 || effect.length < 2) return false;
    if (cause.length > 50 || effect.length > 50) return false;
    
    // 相同检查
    if (cause === effect) return false;
    
    // 包含检查
    if (cause.includes(effect) || effect.includes(cause)) return false;
    
    // 无意义词汇检查
    const stopWords = ['这', '那', '其', '之', '而', '且', '或', '但', '然而'];
    if (stopWords.includes(cause) || stopWords.includes(effect)) return false;
    
    return true;
  }
  
  /**
   * 计算模式置信度
   */
  private calculatePatternConfidence(pattern: string, text: string): number {
    // 基础置信度
    let confidence = 0.6;
    
    // 根据模式类型调整
    if (pattern.includes('导致') || pattern.includes('引发') || pattern.includes('造成')) {
      confidence += 0.2;
    } else if (pattern.includes('影响') || pattern.includes('关联')) {
      confidence -= 0.1;
    }
    
    // 根据上下文证据调整
    const evidenceWords = ['研究', '数据', '分析', '表明', '显示', '证明'];
    for (const word of evidenceWords) {
      if (text.includes(word)) {
        confidence += 0.05;
      }
    }
    
    return Math.min(0.95, Math.max(0.3, confidence));
  }
  
  /**
   * 检查反向因果可能性
   */
  private checkReverseCausality(
    cause: string,
    effect: string,
    text: string
  ): { possible: boolean; confidence: number; reasoning?: string } {
    // 检查文本中是否存在反向表述
    const reversePatterns = [
      new RegExp(`${effect}.*(?:导致|引发|造成|使得).*${cause}`),
      new RegExp(`${effect}.*(?:因为|由于|源于).*${cause}`),
    ];
    
    for (const pattern of reversePatterns) {
      if (pattern.test(text)) {
        return {
          possible: true,
          confidence: 0.5,
          reasoning: '文本中存在反向因果表述',
        };
      }
    }
    
    // 基于常识判断（简化版）
    const temporalKeywords = ['之后', '随后', '接着', '继而'];
    const causeTemporal = temporalKeywords.some(kw => text.includes(`${cause}${kw}`));
    const effectTemporal = temporalKeywords.some(kw => text.includes(`${effect}${kw}`));
    
    if (effectTemporal && !causeTemporal) {
      return {
        possible: true,
        confidence: 0.4,
        reasoning: '时间顺序暗示可能的反向因果',
      };
    }
    
    return {
      possible: false,
      confidence: 0.1,
    };
  }
  
  /**
   * 去重关系
   */
  private deduplicateRelations(relations: DiscoveredCausalRelation[]): DiscoveredCausalRelation[] {
    const seen = new Map<string, DiscoveredCausalRelation>();
    
    for (const rel of relations) {
      const key = `${rel.cause}→${rel.effect}`;
      const existing = seen.get(key);
      
      if (!existing || rel.confidence > existing.confidence) {
        seen.set(key, rel);
      } else if (existing) {
        // 合并证据
        existing.evidence = [...new Set([...existing.evidence, ...rel.evidence])];
      }
    }
    
    return Array.from(seen.values());
  }
  
  // ===========================================================================
  // LLM深度发现
  // ===========================================================================
  
  /**
   * 基于LLM提取因果关系
   */
  private async extractByLLM(
    text: string,
    context?: {
      domain?: string;
      knownVariables?: CausalVariable[];
      existingRelations?: CausalEdge[];
    }
  ): Promise<DiscoveredCausalRelation[]> {
    const systemPrompt = `你是一个专业的因果关系分析专家。你的任务是从文本中识别和分析因果关系。

分析原则：
1. 区分相关性和因果性：因果关系需要机制解释，不仅仅是统计关联
2. 识别混杂因素：考虑是否有第三方变量同时影响原因和结果
3. 考虑反向因果：评估是否存在结果影响原因的可能性
4. 时序检查：因果关系中，原因应该先于结果
5. 机制分析：提供因果作用的机制解释

输出格式（JSON数组）：
[
  {
    "cause": "原因变量/事件",
    "effect": "结果变量/事件",
    "mechanism": "因果机制解释",
    "confidence": 0.85,
    "evidence": ["支撑证据1", "支撑证据2"],
    "potentialConfounders": ["可能的混杂因素1"],
    "reverseCausalityPossible": false
  }
]`;

    const userPrompt = `请分析以下文本中的因果关系：

${text}

${context?.domain ? `分析领域：${context.domain}` : ''}

${context?.knownVariables ? `已知变量：${context.knownVariables.map(v => v.name).join('、')}` : ''}

请识别文本中的所有因果关系，并提供详细的机制分析和置信度评估。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });
      
      return this.parseLLMResponse(response.content || '');
    } catch (error) {
      console.error('[CausalDiscovery] LLM提取失败:', error);
      return [];
    }
  }
  
  /**
   * 解析LLM响应
   */
  private parseLLMResponse(content: string): DiscoveredCausalRelation[] {
    try {
      // 提取JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return parsed.map((item: any) => ({
        cause: item.cause || '',
        effect: item.effect || '',
        relationType: 'causal' as const,
        confidence: Math.min(1, Math.max(0, item.confidence || 0.5)),
        discoveryMethod: 'llm' as const,
        evidence: item.evidence || [],
        potentialConfounders: item.potentialConfounders || [],
        reverseCausality: {
          possible: item.reverseCausalityPossible || false,
          confidence: item.reverseCausalityPossible ? 0.5 : 0.1,
        },
      }));
    } catch (error) {
      console.error('[CausalDiscovery] 解析LLM响应失败:', error);
      return [];
    }
  }
  
  // ===========================================================================
  // 合并与增强
  // ===========================================================================
  
  /**
   * 合并模式和LLM提取结果
   */
  private mergeRelations(
    patternRelations: DiscoveredCausalRelation[],
    llmRelations: DiscoveredCausalRelation[]
  ): DiscoveredCausalRelation[] {
    const merged = new Map<string, DiscoveredCausalRelation>();
    
    // 添加模式匹配结果
    for (const rel of patternRelations) {
      const key = `${rel.cause}→${rel.effect}`;
      merged.set(key, rel);
    }
    
    // 合并或添加LLM结果
    for (const rel of llmRelations) {
      const key = `${rel.cause}→${rel.effect}`;
      const existing = merged.get(key);
      
      if (existing) {
        // 提升置信度（两种方法都发现）
        existing.confidence = Math.min(0.95, existing.confidence * 1.2);
        existing.evidence = [...new Set([...existing.evidence, ...rel.evidence])];
        existing.potentialConfounders = [
          ...new Set([...(existing.potentialConfounders || []), ...(rel.potentialConfounders || [])]),
        ];
        existing.discoveryMethod = 'hybrid';
      } else {
        merged.set(key, rel);
      }
    }
    
    return Array.from(merged.values());
  }
  
  /**
   * 识别混杂因素
   */
  private async identifyConfounders(
    relations: DiscoveredCausalRelation[],
    text: string
  ): Promise<Confounder[]> {
    const confounders: Confounder[] = [];
    
    // 从关系中提取潜在的混杂因素
    const potentialConfounders = new Set<string>();
    for (const rel of relations) {
      for (const cf of rel.potentialConfounders || []) {
        potentialConfounders.add(cf);
      }
    }
    
    // 如果混杂因素太少，用LLM补充识别
    if (potentialConfounders.size < 3 && relations.length > 0) {
      const additionalConfounders = await this.llmIdentifyConfounders(relations, text);
      for (const cf of additionalConfounders) {
        potentialConfounders.add(cf);
      }
    }
    
    // 转换为Confounder对象
    for (const name of potentialConfounders) {
      const affectedPairs = this.findAffectedPairs(name, relations);
      if (affectedPairs.length > 0) {
        confounders.push({
          id: `confounder-${confounders.length}`,
          name,
          affectsPair: affectedPairs[0],
          mechanism: '需要进一步分析混杂机制',
          observable: false, // 默认假设不可观测
          controlMethods: ['stratification', 'regression'],
        });
      }
    }
    
    return confounders;
  }
  
  /**
   * 使用LLM识别混杂因素
   */
  private async llmIdentifyConfounders(
    relations: DiscoveredCausalRelation[],
    text: string
  ): Promise<string[]> {
    const prompt = `基于以下因果关系，识别可能影响这些关系的混杂因素（同时影响原因和结果的第三方变量）：

因果关系：
${relations.map(r => `${r.cause} → ${r.effect}`).join('\n')}

文本背景：
${text.slice(0, 1000)}

请列出最可能的3-5个混杂因素，仅输出因素名称，用逗号分隔。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });
      
      return (response.content || '')
        .split(/[,，、\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 1 && s.length < 20);
    } catch {
      return [];
    }
  }
  
  /**
   * 找到混杂因素影响的变量对
   */
  private findAffectedPairs(
    confounder: string,
    relations: DiscoveredCausalRelation[]
  ): [string, string][] {
    const pairs: [string, string][] = [];
    
    for (const rel of relations) {
      // 简化判断：如果混杂因素名称与原因或结果相关
      if (rel.cause.includes(confounder) || rel.effect.includes(confounder)) {
        pairs.push([rel.cause, rel.effect]);
      }
    }
    
    return pairs;
  }
  
  /**
   * 识别中介变量
   */
  private identifyMediators(relations: DiscoveredCausalRelation[]): string[] {
    const mediators = new Set<string>();
    
    // 构建因果图
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();
    
    for (const rel of relations) {
      if (!outgoing.has(rel.cause)) outgoing.set(rel.cause, []);
      if (!incoming.has(rel.effect)) incoming.set(rel.effect, []);
      outgoing.get(rel.cause)!.push(rel.effect);
      incoming.get(rel.effect)!.push(rel.cause);
    }
    
    // 找出既是结果又是原因的变量（中介变量）
    for (const [variable, causes] of incoming) {
      if (outgoing.has(variable) && causes.length > 0) {
        mediators.add(variable);
      }
    }
    
    return Array.from(mediators);
  }
  
  // ===========================================================================
  // 图构建与质量评估
  // ===========================================================================
  
  /**
   * 构建建议的因果图
   */
  private buildSuggestedGraph(
    relations: DiscoveredCausalRelation[]
  ): CausalDiscoveryResult['suggestedGraph'] {
    const nodes = new Set<string>();
    const edges: Array<{ from: string; to: string; confidence: number }> = [];
    
    for (const rel of relations) {
      nodes.add(rel.cause);
      nodes.add(rel.effect);
      
      if (rel.relationType === 'causal' || rel.relationType === 'potential_causal') {
        edges.push({
          from: rel.cause,
          to: rel.effect,
          confidence: rel.confidence,
        });
      }
    }
    
    return {
      nodes: Array.from(nodes),
      edges,
    };
  }
  
  /**
   * 评估发现质量
   */
  private assessQuality(
    relations: DiscoveredCausalRelation[],
    confounders: Confounder[]
  ): CausalDiscoveryResult['qualityAssessment'] {
    // 覆盖率：有多少因果关系被高置信度发现
    const highConfidence = relations.filter(r => r.confidence >= 0.7).length;
    const coverage = relations.length > 0 ? highConfidence / relations.length : 0;
    
    // 一致性：检查是否有矛盾的因果方向
    const inconsistencies = this.checkConsistency(relations);
    const consistency = Math.max(0, 1 - inconsistencies / (relations.length + 1));
    
    // 总体评分
    const overallScore = (coverage * 0.4 + consistency * 0.3 + (relations.length > 0 ? 0.3 : 0));
    
    return {
      coverage,
      consistency,
      overallScore,
    };
  }
  
  /**
   * 检查一致性
   */
  private checkConsistency(relations: DiscoveredCausalRelation[]): number {
    let inconsistencies = 0;
    
    for (let i = 0; i < relations.length; i++) {
      for (let j = i + 1; j < relations.length; j++) {
        // 检查反向关系
        if (relations[i].cause === relations[j].effect && 
            relations[i].effect === relations[j].cause) {
          inconsistencies++;
        }
      }
    }
    
    return inconsistencies;
  }
  
  /**
   * 生成建议
   */
  private generateRecommendations(
    relations: DiscoveredCausalRelation[],
    confounders: Confounder[],
    mediators: string[]
  ): string[] {
    const recommendations: string[] = [];
    
    // 置信度建议
    const lowConfidenceCount = relations.filter(r => r.confidence < 0.5).length;
    if (lowConfidenceCount > 0) {
      recommendations.push(`有 ${lowConfidenceCount} 个因果关系的置信度较低，建议收集更多证据`);
    }
    
    // 混杂因素建议
    if (confounders.length > 0) {
      recommendations.push(`检测到 ${confounders.length} 个潜在混杂因素，建议进行控制分析`);
    }
    
    // 中介分析建议
    if (mediators.length > 0) {
      recommendations.push(`发现 ${mediators.length} 个中介变量，建议进行中介效应分析`);
    }
    
    // 反向因果建议
    const reverseCausalityCount = relations.filter(r => r.reverseCausality?.possible).length;
    if (reverseCausalityCount > 0) {
      recommendations.push(`有 ${reverseCausalityCount} 个关系存在反向因果可能，建议进行时序分析`);
    }
    
    // 数据建议
    if (relations.length === 0) {
      recommendations.push('未发现明确的因果关系，建议提供更详细的背景信息');
    }
    
    return recommendations;
  }
  
  /**
   * 提取变量列表
   */
  private extractVariables(relations: DiscoveredCausalRelation[]): string[] {
    const variables = new Set<string>();
    for (const rel of relations) {
      variables.add(rel.cause);
      variables.add(rel.effect);
    }
    return Array.from(variables);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建因果发现引擎
 */
export function createCausalDiscoveryEngine(): CausalDiscoveryEngine {
  return new CausalDiscoveryEngine();
}
