/**
 * 政策模拟分析器
 * 基于因果模型进行政策干预模拟，评估影响
 * 特别关注对中国市场的影响分析
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import {
  StructuralCausalModel,
  PolicyIntervention,
  PolicySimulationResult,
  Intervention,
  CausalVariable,
  CausalEdge,
} from './types';
import { CausalInferenceEngine, createCausalInferenceEngine } from './inference-engine';

// ============================================================================
// 预定义政策模板
// ============================================================================

/**
 * 货币政策干预模板
 */
export const MONETARY_POLICY_TEMPLATES: Record<string, Partial<PolicyIntervention>> = {
  interest_rate_hike: {
    name: '加息政策',
    description: '提高基准利率，收紧货币政策',
    parameters: {
      rateChange: 0.25, // 25个基点
    },
  },
  interest_rate_cut: {
    name: '降息政策',
    description: '降低基准利率，放松货币政策',
    parameters: {
      rateChange: -0.25,
    },
  },
  reserve_requirement_hike: {
    name: '提高存款准备金率',
    description: '提高存款准备金率，减少银行可贷资金',
    parameters: {
      rrChange: 0.5,
    },
  },
  quantitative_easing: {
    name: '量化宽松',
    description: '大规模资产购买，增加市场流动性',
    parameters: {
      assetPurchase: 1000000000000, // 1万亿
    },
  },
};

/**
 * 贸易政策干预模板
 */
export const TRADE_POLICY_TEMPLATES: Record<string, Partial<PolicyIntervention>> = {
  tariff_increase: {
    name: '提高关税',
    description: '对特定商品或国家提高进口关税',
    parameters: {
      tariffRate: 0.25,
    },
  },
  export_restriction: {
    name: '出口限制',
    description: '限制特定商品或技术的出口',
    parameters: {
      restrictedCategories: ['semiconductors', 'ai'],
    },
  },
  trade_agreement: {
    name: '贸易协定',
    description: '签署自由贸易协定，降低贸易壁垒',
    parameters: {
      tariffReduction: 0.5,
    },
  },
};

/**
 * 产业政策干预模板
 */
export const INDUSTRIAL_POLICY_TEMPLATES: Record<string, Partial<PolicyIntervention>> = {
  subsidy_increase: {
    name: '增加补贴',
    description: '对特定产业提供财政补贴',
    parameters: {
      subsidyAmount: 10000000000,
      targetSectors: ['new_energy', 'semiconductors'],
    },
  },
  regulation_tighten: {
    name: '加强监管',
    description: '加强对特定行业的监管力度',
    parameters: {
      targetSectors: ['fintech', 'platform_economy'],
      regulatoryIntensity: 'high',
    },
  },
  deregulation: {
    name: '放松监管',
    description: '减少对特定行业的监管限制',
    parameters: {
      targetSectors: ['manufacturing'],
      regulatoryIntensity: 'low',
    },
  },
};

// ============================================================================
// 政策模拟分析器类
// ============================================================================

/**
 * 政策模拟分析器
 */
export class PolicySimulator {
  private llmClient: LLMClient;
  private inferenceEngine: CausalInferenceEngine;
  
  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
    this.inferenceEngine = createCausalInferenceEngine();
  }
  
  // ===========================================================================
  // 主要方法
  // ===========================================================================
  
  /**
   * 模拟政策干预
   */
  async simulatePolicy(
    scm: StructuralCausalModel,
    policy: PolicyIntervention
  ): Promise<PolicySimulationResult> {
    const startTime = Date.now();
    
    // 1. 执行每个干预
    const interventionResults = await this.executeInterventions(scm, policy.interventions);
    
    // 2. 计算短期影响
    const shortTermEffects = this.calculateShortTermEffects(scm, interventionResults);
    
    // 3. 预测长期影响
    const longTermEffects = await this.predictLongTermEffects(scm, policy, interventionResults);
    
    // 4. 识别意外后果
    const unintendedConsequences = await this.identifyUnintendedConsequences(
      scm,
      policy,
      interventionResults
    );
    
    // 5. 分析对中国市场的影响
    const chinaMarketImpact = await this.analyzeChinaMarketImpact(
      scm,
      policy,
      interventionResults
    );
    
    // 6. 生成优化建议
    const optimizationSuggestions = this.generateOptimizationSuggestions(
      policy,
      shortTermEffects,
      unintendedConsequences,
      chinaMarketImpact
    );
    
    // 7. 计算整体置信度
    const overallConfidence = this.calculateOverallConfidence(
      shortTermEffects,
      unintendedConsequences
    );
    
    return {
      policyId: policy.id,
      shortTermEffects,
      longTermEffects,
      unintendedConsequences,
      chinaMarketImpact,
      optimizationSuggestions,
      overallConfidence,
      simulationTime: Date.now() - startTime,
    };
  }
  
  /**
   * 快速政策评估
   */
  async quickAssess(
    scm: StructuralCausalModel,
    policyDescription: string
  ): Promise<{
    feasibility: number;
    expectedImpact: 'positive' | 'negative' | 'neutral' | 'mixed';
    keyRisks: string[];
    recommendations: string[];
  }> {
    const prompt = `基于以下因果模型，快速评估政策可行性：

**政策描述**: ${policyDescription}

**模型变量**: ${scm.variables.map(v => v.name).join('、')}

**因果关系**: ${scm.edges.slice(0, 10).map(e => {
  const cause = scm.variables.find(v => v.id === e.cause)?.name;
  const effect = scm.variables.find(v => v.id === e.effect)?.name;
  return `${cause}→${effect}`;
}).join('、')}

**模型领域**: ${scm.domain}

请输出JSON格式：
{
  "feasibility": 0.75,
  "expectedImpact": "positive/negative/neutral/mixed",
  "keyRisks": ["风险1", "风险2"],
  "recommendations": ["建议1", "建议2"]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });
      
      const jsonMatch = (response.content || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[PolicySimulator] 快速评估失败:', error);
    }
    
    return {
      feasibility: 0.5,
      expectedImpact: 'mixed',
      keyRisks: ['评估失败，请重试'],
      recommendations: ['建议提供更详细的政策信息'],
    };
  }
  
  /**
   * 对比分析多个政策方案
   */
  async comparePolicies(
    scm: StructuralCausalModel,
    policies: PolicyIntervention[]
  ): Promise<{
    rankings: Array<{ policyId: string; rank: number; score: number }>;
    comparison: Record<string, {
      effectiveness: number;
      riskLevel: number;
      chinaBenefit: number;
    }>;
    recommendation: string;
  }> {
    const results: Array<{
      policyId: string;
      simulation: PolicySimulationResult;
    }> = [];
    
    // 模拟每个政策
    for (const policy of policies) {
      const simulation = await this.simulatePolicy(scm, policy);
      results.push({ policyId: policy.id, simulation });
    }
    
    // 计算综合评分
    const scores = results.map(({ policyId, simulation }) => {
      const effectiveness = this.calculateEffectivenessScore(simulation);
      const riskLevel = this.calculateRiskScore(simulation);
      const chinaBenefit = simulation.chinaMarketImpact?.riskLevel === 'low' ? 0.8 :
                          simulation.chinaMarketImpact?.riskLevel === 'medium' ? 0.5 : 0.2;
      
      const score = effectiveness * 0.4 + (1 - riskLevel) * 0.3 + chinaBenefit * 0.3;
      
      return { policyId, score, effectiveness, riskLevel, chinaBenefit };
    });
    
    // 排序
    scores.sort((a, b) => b.score - a.score);
    const rankings = scores.map((s, i) => ({
      policyId: s.policyId,
      rank: i + 1,
      score: s.score,
    }));
    
    // 生成对比分析
    const comparison: Record<string, any> = {};
    for (const s of scores) {
      comparison[s.policyId] = {
        effectiveness: s.effectiveness,
        riskLevel: s.riskLevel,
        chinaBenefit: s.chinaBenefit,
      };
    }
    
    // 生成推荐
    const bestPolicy = policies.find(p => p.id === rankings[0].policyId);
    const recommendation = await this.generateComparisonRecommendation(
      policies,
      rankings,
      comparison
    );
    
    return { rankings, comparison, recommendation };
  }
  
  // ===========================================================================
  // 内部方法
  // ===========================================================================
  
  /**
   * 执行干预列表
   */
  private async executeInterventions(
    scm: StructuralCausalModel,
    interventions: Intervention[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    
    for (const intervention of interventions) {
      const result = await this.inferenceEngine.performIntervention(
        scm,
        intervention,
        intervention.variable
      );
      
      results.set(intervention.id, result);
    }
    
    return results;
  }
  
  /**
   * 计算短期影响
   */
  private calculateShortTermEffects(
    scm: StructuralCausalModel,
    interventionResults: Map<string, any>
  ): PolicySimulationResult['shortTermEffects'] {
    const effects: PolicySimulationResult['shortTermEffects'] = [];
    
    for (const [interventionId, result] of interventionResults) {
      for (const state of result.posteriorDistribution) {
        const variable = scm.variables.find(v => v.id === state.variableId);
        if (!variable) continue;
        
        const priorState = result.priorDistribution.find((s: any) => s.variableId === state.variableId);
        const baselineValue = priorState?.value || 0.5;
        const simulatedValue = state.value || baselineValue;
        
        effects.push({
          variable: variable.name,
          baselineValue,
          simulatedValue,
          change: simulatedValue - baselineValue,
          confidence: state.probability || 0.7,
        });
      }
    }
    
    return effects;
  }
  
  /**
   * 预测长期影响
   */
  private async predictLongTermEffects(
    scm: StructuralCausalModel,
    policy: PolicyIntervention,
    interventionResults: Map<string, any>
  ): Promise<PolicySimulationResult['longTermEffects']> {
    const longTermEffects: PolicySimulationResult['longTermEffects'] = [];
    
    // 对每个关键变量预测长期趋势
    const keyVariables = scm.endogenousVariables.slice(0, 5);
    
    for (const varId of keyVariables) {
      const variable = scm.variables.find(v => v.id === varId);
      if (!variable) continue;
      
      const projection = await this.projectVariableTrend(
        scm,
        variable,
        policy,
        interventionResults
      );
      
      longTermEffects.push({
        variable: variable.name,
        projectedValues: projection,
      });
    }
    
    return longTermEffects;
  }
  
  /**
   * 投影变量趋势
   */
  private async projectVariableTrend(
    scm: StructuralCausalModel,
    variable: CausalVariable,
    policy: PolicyIntervention,
    interventionResults: Map<string, any>
  ): Promise<Array<{ time: string; value: any; confidence: number }>> {
    const prompt = `基于以下因果模型和政策干预，预测变量"${variable.name}"在未来12个月的变化趋势：

**政策**: ${policy.name} - ${policy.description}

**变量领域**: ${scm.domain}

请输出JSON数组格式，预测每月的值（假设当前值为基准）：
[
  {"month": 1, "value": 1.05, "confidence": 0.8},
  {"month": 2, "value": 1.08, "confidence": 0.75},
  ...
  {"month": 12, "value": 1.15, "confidence": 0.6}
]`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.4,
      });
      
      const jsonMatch = (response.content || '').match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((item: any) => ({
          time: `Month ${item.month}`,
          value: item.value,
          confidence: item.confidence,
        }));
      }
    } catch (error) {
      console.error('[PolicySimulator] 趋势预测失败:', error);
    }
    
    // 默认返回平稳预测
    return [
      { time: 'Month 1', value: 1.0, confidence: 0.7 },
      { time: 'Month 6', value: 1.02, confidence: 0.6 },
      { time: 'Month 12', value: 1.05, confidence: 0.5 },
    ];
  }
  
  /**
   * 识别意外后果
   */
  private async identifyUnintendedConsequences(
    scm: StructuralCausalModel,
    policy: PolicyIntervention,
    interventionResults: Map<string, any>
  ): Promise<PolicySimulationResult['unintendedConsequences']> {
    const prompt = `分析以下政策干预可能的意外后果：

**政策**: ${policy.name} - ${policy.description}

**因果模型变量**: ${scm.variables.map(v => v.name).join('、')}

**主要因果关系**:
${scm.edges.slice(0, 15).map(e => {
  const cause = scm.variables.find(v => v.id === e.cause)?.name || e.cause;
  const effect = scm.variables.find(v => v.id === e.effect)?.name || e.effect;
  return `- ${cause} → ${effect}`;
}).join('\n')}

请识别可能的意外后果（非预期但可能发生的副作用），输出JSON数组：
[
  {
    "variable": "受影响的变量",
    "effect": "具体影响描述",
    "probability": 0.6,
    "severity": "low/medium/high"
  }
]`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5,
      });
      
      const jsonMatch = (response.content || '').match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[PolicySimulator] 意外后果识别失败:', error);
    }
    
    return [];
  }
  
  /**
   * 分析对中国市场的影响
   */
  private async analyzeChinaMarketImpact(
    scm: StructuralCausalModel,
    policy: PolicyIntervention,
    interventionResults: Map<string, any>
  ): Promise<PolicySimulationResult['chinaMarketImpact']> {
    const prompt = `深入分析以下政策对中国市场的具体影响：

**政策**: ${policy.name} - ${policy.description}

**政策来源国/地区**: ${policy.parameters?.sourceRegion || '美国'}

**主要影响路径**:
${Array.from(interventionResults.entries()).map(([id, result]) => 
  `干预${id}: 因果效应 = ${result.causalEffect?.toFixed(3) || '未知'}`
).join('\n')}

请输出JSON格式，重点分析对中国各行业的具体影响：
{
  "overallAssessment": "整体评估（1-2句话）",
  "sectorImpacts": [
    {
      "sector": "行业名称（如：半导体、新能源、金融、消费等）",
      "impact": "positive/negative/neutral/mixed",
      "magnitude": 0.75,
      "description": "具体影响描述"
    }
  ],
  "riskLevel": "low/medium/high",
  "opportunities": ["机遇1", "机遇2"],
  "challenges": ["挑战1", "挑战2"]
}`;

    try {
      const response = await this.llmClient.invoke([
        { 
          role: 'system', 
          content: '你是中国市场分析专家，熟悉中美贸易、全球供应链、中国产业结构。请提供深入、具体、数据支撑的分析。' 
        },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.4,
      });
      
      const jsonMatch = (response.content || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[PolicySimulator] 中国市场分析失败:', error);
    }
    
    // 默认返回
    return {
      overallAssessment: '需要更多信息进行准确评估',
      sectorImpacts: [],
      riskLevel: 'medium',
      opportunities: [],
      challenges: ['政策不确定性'],
    };
  }
  
  /**
   * 生成优化建议
   */
  private generateOptimizationSuggestions(
    policy: PolicyIntervention,
    shortTermEffects: PolicySimulationResult['shortTermEffects'],
    unintendedConsequences: PolicySimulationResult['unintendedConsequences'],
    chinaMarketImpact: PolicySimulationResult['chinaMarketImpact']
  ): string[] {
    const suggestions: string[] = [];
    
    // 基于短期影响
    const negativeEffects = shortTermEffects.filter(e => e.change < -0.1);
    if (negativeEffects.length > 0) {
      suggestions.push(`关注负面影响较大的变量：${negativeEffects.map(e => e.variable).join('、')}`);
    }
    
    // 基于意外后果
    const highSeverityConsequences = unintendedConsequences?.filter(c => c.severity === 'high') || [];
    if (highSeverityConsequences.length > 0) {
      suggestions.push(`制定应对措施以减轻高风险意外后果：${highSeverityConsequences.map(c => c.effect).join('、')}`);
    }
    
    // 基于中国市场影响
    if (chinaMarketImpact?.riskLevel === 'high') {
      suggestions.push('建议加强风险监控，制定应急预案');
    }
    
    const negativeSectors = chinaMarketImpact?.sectorImpacts?.filter(s => s.impact === 'negative') || [];
    if (negativeSectors.length > 0) {
      suggestions.push(`关注受负面影响行业：${negativeSectors.map(s => s.sector).join('、')}，考虑补偿措施`);
    }
    
    // 基于机遇
    if (chinaMarketImpact?.opportunities && chinaMarketImpact.opportunities.length > 0) {
      suggestions.push(`把握潜在机遇：${chinaMarketImpact.opportunities.slice(0, 2).join('、')}`);
    }
    
    return suggestions;
  }
  
  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(
    shortTermEffects: PolicySimulationResult['shortTermEffects'],
    unintendedConsequences: PolicySimulationResult['unintendedConsequences']
  ): number {
    if (shortTermEffects.length === 0) return 0.5;
    
    const avgConfidence = shortTermEffects.reduce((sum, e) => sum + e.confidence, 0) / shortTermEffects.length;
    
    // 根据意外后果调整
    const highSeverityCount = unintendedConsequences?.filter(c => c.severity === 'high').length || 0;
    const penalty = highSeverityCount * 0.05;
    
    return Math.max(0.3, Math.min(0.95, avgConfidence - penalty));
  }
  
  /**
   * 计算有效性评分
   */
  private calculateEffectivenessScore(simulation: PolicySimulationResult): number {
    if (simulation.shortTermEffects.length === 0) return 0.5;
    
    const positiveChanges = simulation.shortTermEffects.filter(e => e.change > 0);
    const avgChange = simulation.shortTermEffects.reduce((sum, e) => sum + Math.abs(e.change), 0) / simulation.shortTermEffects.length;
    
    return Math.min(1, avgChange * 2 + (positiveChanges.length / simulation.shortTermEffects.length) * 0.3);
  }
  
  /**
   * 计算风险评分
   */
  private calculateRiskScore(simulation: PolicySimulationResult): number {
    const unintendedCount = simulation.unintendedConsequences?.length || 0;
    const highSeverityCount = simulation.unintendedConsequences?.filter(c => c.severity === 'high').length || 0;
    
    let riskScore = 0.3;
    riskScore += unintendedCount * 0.05;
    riskScore += highSeverityCount * 0.15;
    
    if (simulation.chinaMarketImpact?.riskLevel === 'high') riskScore += 0.2;
    if (simulation.chinaMarketImpact?.riskLevel === 'medium') riskScore += 0.1;
    
    return Math.min(1, riskScore);
  }
  
  /**
   * 生成对比推荐
   */
  private async generateComparisonRecommendation(
    policies: PolicyIntervention[],
    rankings: Array<{ policyId: string; rank: number; score: number }>,
    comparison: Record<string, any>
  ): Promise<string> {
    const bestPolicy = policies.find(p => p.id === rankings[0].policyId);
    const bestScore = rankings[0].score;
    
    return `综合评估推荐：${bestPolicy?.name || '未知政策'}

**推荐理由**：
- 综合得分：${(bestScore * 100).toFixed(1)}分
- 有效性：${((comparison[rankings[0].policyId]?.effectiveness || 0.5) * 100).toFixed(0)}%
- 风险等级：${((comparison[rankings[0].policyId]?.riskLevel || 0.5) * 100).toFixed(0)}%
- 中国市场受益度：${((comparison[rankings[0].policyId]?.chinaBenefit || 0.5) * 100).toFixed(0)}%

该政策在有效性和风险平衡方面表现最佳，建议优先考虑实施。`;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建政策模拟分析器
 */
export function createPolicySimulator(): PolicySimulator {
  return new PolicySimulator();
}

/**
 * 从模板创建政策干预
 */
export function createPolicyFromTemplate(
  templateId: string,
  templateType: 'monetary' | 'trade' | 'industrial',
  customizations?: Partial<PolicyIntervention>
): PolicyIntervention | null {
  const templates = templateType === 'monetary' ? MONETARY_POLICY_TEMPLATES :
                   templateType === 'trade' ? TRADE_POLICY_TEMPLATES :
                   INDUSTRIAL_POLICY_TEMPLATES;
  
  const template = templates[templateId];
  if (!template) return null;
  
  return {
    id: `policy-${Date.now()}`,
    name: template.name || templateId,
    description: template.description || '',
    interventions: [],
    parameters: template.parameters,
    ...customizations,
  };
}
