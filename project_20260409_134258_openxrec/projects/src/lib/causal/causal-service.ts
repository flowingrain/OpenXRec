/**
 * 因果分析统一服务
 * 整合因果发现、建模、推断、政策模拟
 * 提供一站式因果分析能力
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import {
  StructuralCausalModel,
  CausalDiscoveryResult,
  CausalQuery,
  CausalQueryResult,
  Intervention,
  CounterfactualScenario,
  CounterfactualResult,
  PolicyIntervention,
  PolicySimulationResult,
  CausalAnalysisReport,
} from './types';
import { createCausalDiscoveryEngine, CausalDiscoveryEngine } from './discovery-engine';
import { createSCMBuilder, SCMBuilder } from './scm-builder';
import { createCausalInferenceEngine, CausalInferenceEngine } from './inference-engine';
import { createPolicySimulator, PolicySimulator } from './policy-simulator';

// ============================================================================
// 因果分析服务类
// ============================================================================

/**
 * 因果分析服务
 */
export class CausalAnalysisService {
  private llmClient: LLMClient;
  private discoveryEngine: CausalDiscoveryEngine;
  private scmBuilder: SCMBuilder;
  private inferenceEngine: CausalInferenceEngine;
  private policySimulator: PolicySimulator;
  
  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
    this.discoveryEngine = createCausalDiscoveryEngine();
    this.scmBuilder = createSCMBuilder();
    this.inferenceEngine = createCausalInferenceEngine();
    this.policySimulator = createPolicySimulator();
  }
  
  // ===========================================================================
  // 一站式分析方法
  // ===========================================================================
  
  /**
   * 完整因果分析流程
   */
  async analyze(
    text: string,
    options?: {
      domain?: string;
      scenario?: string;
      queries?: CausalQuery[];
      policies?: PolicyIntervention[];
      counterfactualScenarios?: CounterfactualScenario[];
    }
  ): Promise<CausalAnalysisReport> {
    const startTime = Date.now();
    
    // 1. 因果发现
    const discoveryResult = await this.discoveryEngine.discoverFromText(text, {
      domain: options?.domain,
    });
    
    // 2. 构建因果模型
    const scm = await this.scmBuilder.buildFromDiscovery(discoveryResult, {
      domain: options?.domain,
      scenario: options?.scenario,
    });
    
    // 3. 执行因果查询
    const inferenceResults: CausalQueryResult[] = [];
    if (options?.queries) {
      for (const query of options.queries) {
        const result = await this.inferenceEngine.executeQuery(scm, query);
        inferenceResults.push(result);
      }
    }
    
    // 4. 执行反事实分析
    let counterfactualAnalysis: CounterfactualResult[] | undefined;
    if (options?.counterfactualScenarios && options.counterfactualScenarios.length > 0) {
      counterfactualAnalysis = [];
      for (const scenario of options.counterfactualScenarios) {
        const result = await this.inferenceEngine.performCounterfactual(scm, scenario);
        counterfactualAnalysis.push(result);
      }
    }
    
    // 5. 执行政策模拟
    let policySimulations: PolicySimulationResult[] | undefined;
    if (options?.policies && options.policies.length > 0) {
      policySimulations = [];
      for (const policy of options.policies) {
        const result = await this.policySimulator.simulatePolicy(scm, policy);
        policySimulations.push(result);
      }
    }
    
    // 6. 提取关键发现
    const keyFindings = this.extractKeyFindings(
      discoveryResult,
      inferenceResults,
      counterfactualAnalysis,
      policySimulations
    );
    
    // 7. 提取因果链条
    const causalChains = this.extractCausalChains(scm);
    
    // 8. 生成不确定性说明
    const uncertaintyNotes = this.generateUncertaintyNotes(scm, discoveryResult);
    
    // 9. 生成局限性说明
    const limitations = this.generateLimitations(scm, discoveryResult);
    
    // 10. 生成后续研究建议
    const furtherResearchSuggestions = this.generateFurtherResearchSuggestions(
      scm,
      discoveryResult,
      limitations
    );
    
    // 11. 计算整体置信度
    const overallConfidence = this.calculateOverallConfidence(
      discoveryResult,
      inferenceResults,
      counterfactualAnalysis
    );
    
    return {
      id: `causal-report-${Date.now()}`,
      scenario: options?.scenario || '因果分析报告',
      causalModel: scm,
      discoveryResult,
      inferenceResults,
      counterfactualAnalysis,
      policySimulations,
      keyFindings,
      causalChains,
      uncertaintyNotes,
      limitations,
      furtherResearchSuggestions,
      generatedAt: new Date().toISOString(),
      overallConfidence,
    };
  }
  
  /**
   * 快速因果分析（简化版）
   */
  async quickAnalyze(
    text: string,
    domain?: string
  ): Promise<{
    causalRelations: Array<{ cause: string; effect: string; confidence: number }>;
    keyVariables: string[];
    summary: string;
  }> {
    // 快速发现
    const discoveryResult = await this.discoveryEngine.discoverFromText(text, { domain });
    
    // 提取关键关系
    const causalRelations = discoveryResult.relations
      .filter(r => r.relationType === 'causal')
      .slice(0, 10)
      .map(r => ({
        cause: r.cause,
        effect: r.effect,
        confidence: r.confidence,
      }));
    
    // 生成摘要
    const summary = await this.generateQuickSummary(discoveryResult, domain);
    
    return {
      causalRelations,
      keyVariables: discoveryResult.variables.slice(0, 10),
      summary,
    };
  }
  
  /**
   * 场景推演（结合数字人格）
   */
  async scenarioAnalysis(
    text: string,
    options?: {
      domain?: string;
      scenario?: string;
      interventions?: Intervention[];
    }
  ): Promise<{
    discoveryResult: CausalDiscoveryResult;
    scm: StructuralCausalModel;
    interventionResults?: Array<{
      intervention: Intervention;
      effects: Array<{ variable: string; change: number }>;
    }>;
    chinaMarketImplications: string;
  }> {
    // 发现因果关系
    const discoveryResult = await this.discoveryEngine.discoverFromText(text, {
      domain: options?.domain,
    });
    
    // 构建模型
    const scm = await this.scmBuilder.buildFromDiscovery(discoveryResult, {
      domain: options?.domain,
      scenario: options?.scenario,
    });
    
    // 执行干预
    let interventionResults;
    if (options?.interventions && options.interventions.length > 0) {
      interventionResults = [];
      for (const intervention of options.interventions) {
        const result = await this.inferenceEngine.performIntervention(
          scm,
          intervention,
          scm.endogenousVariables[0] // 默认目标变量
        );
        
        interventionResults.push({
          intervention,
          effects: result.posteriorDistribution
            .filter(s => s.source === 'inferred')
            .map(s => ({
              variable: scm.variables.find(v => v.id === s.variableId)?.name || s.variableId,
              change: (s.value as number) || 0,
            })),
        });
      }
    }
    
    // 分析对中国市场的影响
    const chinaMarketImplications = await this.analyzeChinaMarketImplications(
      discoveryResult,
      scm,
      interventionResults
    );
    
    return {
      discoveryResult,
      scm,
      interventionResults,
      chinaMarketImplications,
    };
  }
  
  // ===========================================================================
  // 辅助方法
  // ===========================================================================
  
  /**
   * 提取关键发现
   */
  private extractKeyFindings(
    discoveryResult: CausalDiscoveryResult,
    inferenceResults: CausalQueryResult[],
    counterfactualAnalysis?: CounterfactualResult[],
    policySimulations?: PolicySimulationResult[]
  ): string[] {
    const findings: string[] = [];
    
    // 从发现结果中提取
    const topRelations = discoveryResult.relations
      .filter(r => r.confidence >= 0.7)
      .slice(0, 5);
    
    for (const rel of topRelations) {
      findings.push(`发现因果关系：${rel.cause} → ${rel.effect}（置信度：${(rel.confidence * 100).toFixed(0)}%）`);
    }
    
    // 从推断结果中提取
    for (const result of inferenceResults) {
      if (result.estimate && result.identifiable) {
        findings.push(`因果效应估计：${result.estimate.value.toFixed(3)}（${result.explanation.slice(0, 50)}...）`);
      }
    }
    
    // 从反事实分析中提取
    if (counterfactualAnalysis) {
      for (const cf of counterfactualAnalysis) {
        const mainEffect = cf.causalEffect[0];
        if (mainEffect && Math.abs(mainEffect.difference) > 0.1) {
          findings.push(`反事实分析：如果改变干预条件，${mainEffect.variable}将变化${mainEffect.difference >= 0 ? '+' : ''}${mainEffect.difference.toFixed(3)}`);
        }
      }
    }
    
    // 从政策模拟中提取
    if (policySimulations) {
      for (const sim of policySimulations) {
        if (sim.chinaMarketImpact) {
          findings.push(`政策影响：${sim.chinaMarketImpact.overallAssessment}`);
        }
      }
    }
    
    return findings;
  }
  
  /**
   * 提取因果链条
   */
  private extractCausalChains(scm: StructuralCausalModel): string[][] {
    const chains: string[][] = [];
    const variableNames = new Map(scm.variables.map(v => [v.id, v.name]));
    
    // 找出所有从外生变量到内生变量的路径
    for (const exogVar of scm.exogenousVariables) {
      const paths = this.findAllPaths(scm, exogVar);
      for (const path of paths) {
        chains.push(path.map(id => variableNames.get(id) || id));
      }
    }
    
    return chains.slice(0, 10); // 返回前10条
  }
  
  /**
   * 查找所有路径
   */
  private findAllPaths(scm: StructuralCausalModel, start: string): string[][] {
    const paths: string[][] = [];
    const adjList = new Map<string, string[]>();
    
    for (const e of scm.edges) {
      if (!adjList.has(e.cause)) adjList.set(e.cause, []);
      adjList.get(e.cause)!.push(e.effect);
    }
    
    const dfs = (node: string, path: string[], visited: Set<string>) => {
      const newPath = [...path, node];
      const neighbors = adjList.get(node) || [];
      
      if (neighbors.length === 0) {
        paths.push(newPath);
        return;
      }
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          dfs(neighbor, newPath, visited);
          visited.delete(neighbor);
        }
      }
    };
    
    dfs(start, [], new Set([start]));
    return paths;
  }
  
  /**
   * 生成不确定性说明
   */
  private generateUncertaintyNotes(
    scm: StructuralCausalModel,
    discoveryResult: CausalDiscoveryResult
  ): string[] {
    const notes: string[] = [];
    
    // 模型假设
    if (scm.assumptions) {
      notes.push(...scm.assumptions.map(a => `模型假设：${a}`));
    }
    
    // 低置信度关系
    const lowConfidenceRelations = discoveryResult.relations.filter(r => r.confidence < 0.5);
    if (lowConfidenceRelations.length > 0) {
      notes.push(`${lowConfidenceRelations.length}个因果关系的置信度较低，需进一步验证`);
    }
    
    // 未观测混杂
    const unmeasuredConfounders = scm.confounders?.filter(c => !c.observable) || [];
    if (unmeasuredConfounders.length > 0) {
      notes.push(`存在${unmeasuredConfounders.length}个未观测混杂因素，可能影响推断准确性`);
    }
    
    return notes;
  }
  
  /**
   * 生成局限性说明
   */
  private generateLimitations(
    scm: StructuralCausalModel,
    discoveryResult: CausalDiscoveryResult
  ): string[] {
    const limitations: string[] = [];
    
    // 数据局限
    limitations.push('因果发现基于文本数据，可能遗漏未明确表述的因果关系');
    
    // 模型局限
    if (scm.validation && !scm.validation.isValid) {
      limitations.push(...(scm.validation.issues || []));
    }
    
    // 方法局限
    limitations.push('因果推断依赖于模型假设的正确性');
    
    // 质量局限
    if (discoveryResult.qualityAssessment.overallScore < 0.7) {
      limitations.push(`发现质量评分较低（${(discoveryResult.qualityAssessment.overallScore * 100).toFixed(0)}%），建议收集更多数据`);
    }
    
    return limitations;
  }
  
  /**
   * 生成后续研究建议
   */
  private generateFurtherResearchSuggestions(
    scm: StructuralCausalModel,
    discoveryResult: CausalDiscoveryResult,
    limitations: string[]
  ): string[] {
    const suggestions: string[] = [];
    
    // 基于局限性的建议
    if (limitations.some(l => l.includes('未观测混杂'))) {
      suggestions.push('建议收集更多潜在混杂因素的数据');
    }
    
    // 基于发现结果的建议
    if (discoveryResult.confounders.length > 0) {
      suggestions.push('建议进行敏感性分析，评估混杂因素的影响');
    }
    
    // 基于模型的建议
    if (scm.edges.length > 10) {
      suggestions.push('模型较复杂，建议进行简化或分层分析');
    }
    
    // 通用建议
    suggestions.push('建议与领域专家验证因果关系的合理性');
    suggestions.push('建议收集定量数据以验证因果效应估计');
    
    return suggestions;
  }
  
  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(
    discoveryResult: CausalDiscoveryResult,
    inferenceResults: CausalQueryResult[],
    counterfactualAnalysis?: CounterfactualResult[]
  ): number {
    let confidence = discoveryResult.qualityAssessment.overallScore;
    
    // 考虑推断结果的置信度
    if (inferenceResults.length > 0) {
      const avgInferenceConfidence = inferenceResults
        .filter(r => r.identifiable)
        .reduce((sum, r) => sum + r.confidenceLevel, 0) / inferenceResults.length;
      confidence = confidence * 0.6 + avgInferenceConfidence * 0.4;
    }
    
    // 考虑反事实分析的置信度
    if (counterfactualAnalysis && counterfactualAnalysis.length > 0) {
      const avgCFConfidence = counterfactualAnalysis.reduce((sum, cf) => sum + cf.confidence, 0) / counterfactualAnalysis.length;
      confidence = confidence * 0.8 + avgCFConfidence * 0.2;
    }
    
    return Math.min(0.95, Math.max(0.3, confidence));
  }
  
  /**
   * 生成快速摘要
   */
  private async generateQuickSummary(
    discoveryResult: CausalDiscoveryResult,
    domain?: string
  ): Promise<string> {
    const topRelations = discoveryResult.relations
      .filter(r => r.confidence >= 0.6)
      .slice(0, 5);
    
    if (topRelations.length === 0) {
      return '未发现明确的因果关系';
    }
    
    const relationsText = topRelations
      .map(r => `${r.cause}→${r.effect}(${(r.confidence * 100).toFixed(0)}%)`)
      .join('、');
    
    return `发现${discoveryResult.relations.length}个潜在因果关系，其中置信度较高的有：${relationsText}。` +
           `检测到${discoveryResult.confounders.length}个潜在混杂因素。`;
  }
  
  /**
   * 分析对中国市场的影响
   */
  private async analyzeChinaMarketImplications(
    discoveryResult: CausalDiscoveryResult,
    scm: StructuralCausalModel,
    interventionResults?: Array<{
      intervention: Intervention;
      effects: Array<{ variable: string; change: number }>;
    }>
  ): Promise<string> {
    const prompt = `基于以下因果分析结果，分析对中国市场的影响：

**领域**: ${scm.domain}

**发现的因果关系**:
${discoveryResult.relations.slice(0, 10).map(r => 
  `- ${r.cause} → ${r.effect} (置信度: ${(r.confidence * 100).toFixed(0)}%)`
).join('\n')}

**检测到的混杂因素**: ${discoveryResult.confounders.join('、') || '无'}

**干预影响**（如有）:
${interventionResults?.map(ir => 
  `干预${ir.intervention.variable}：${ir.effects.map(e => `${e.variable}(${e.change >= 0 ? '+' : ''}${e.change.toFixed(3)})`).join(', ')}`
).join('\n') || '无'}

请分析这些因果关系和干预对中国市场的影响，特别关注：
1. 受影响的行业和领域
2. 风险和机遇
3. 建议的应对措施

输出1-2段简洁的分析。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.4,
      });
      
      return response.content || '需要更多上下文进行分析';
    } catch (error) {
      console.error('[CausalService] 中国市场分析失败:', error);
      return '分析过程中出现错误';
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建因果分析服务
 */
export function createCausalAnalysisService(): CausalAnalysisService {
  return new CausalAnalysisService();
}
