/**
 * 反思机制（Reflection Mechanism）
 * 
 * 在整个推荐流程中引入反思层：
 * 1. 意图分析反思：评估意图判断的合理性
 * 2. 推荐质量反思：评估推荐结果的质量
 * 3. 规则更新反思：评估规则变更的影响
 * 4. 策略优化反思：评估策略改进的效果
 * 
 * 核心价值：
 * - 自我评估决策质量
 * - 反事实推理：如果选择不同会怎样
 * - 提供改进建议
 * - 增强可解释性
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';

// ============================================================================
// 反思类型定义
// ============================================================================

/**
 * 反思触发时机
 */
export type ReflectionTrigger = 
  | 'after_intent_analysis'      // 意图分析后
  | 'after_recommendation'       // 推荐生成后
  | 'before_rule_update'         // 规则更新前
  | 'after_ppo_training'         // PPO训练后
  | 'low_confidence'             // 低置信度时
  | 'error_recovery'             // 错误恢复时
  | 'user_dissatisfaction';      // 用户不满意时

/**
 * 反思结果
 */
export interface ReflectionResult {
  // 基本信息
  trigger: ReflectionTrigger;
  timestamp: number;
  
  // 自我评估
  selfEvaluation: {
    score: number;               // 自评分数 0-1
    strengths: string[];         // 优点
    weaknesses: string[];        // 不足
  };
  
  // 反事实推理
  counterfactualAnalysis?: {
    alternativeDecisions: Array<{
      decision: string;
      expectedOutcome: string;
      probability: number;
    }>;
    bestAlternative?: string;
    reasoning: string;
  };
  
  // 改进建议
  improvements: Array<{
    area: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
    implementable: boolean;
  }>;
  
  // 可解释性
  explainability: {
    reasoningChain: string[];    // 推理链
    keyFactors: string[];        // 关键因素
    confidenceExplanation: string;
  };
  
  // 行动建议
  actions?: Array<{
    type: 'adjust_confidence' | 'trigger_fallback' | 'request_feedback' | 'log_issue';
    payload: any;
  }>;
}

/**
 * 意图分析反思输入
 */
export interface IntentReflectionInput {
  query: string;
  scenario: string;
  predictedNeedsSearch: boolean;
  predictedConfidence: number;
  reasoning: string;
  matchedKeywords: string[];
  source: 'llm' | 'rule_fallback';
}

/**
 * 推荐质量反思输入
 */
export interface RecommendationReflectionInput {
  query: string;
  recommendations: Array<{
    id: string;
    title: string;
    score: number;
    confidence: number;
    source: string;
  }>;
  overallConfidence: number;
  sources: string[];
}

/**
 * 规则更新反思输入
 */
export interface RuleUpdateReflectionInput {
  updateType: 'keyword_add' | 'keyword_remove' | 'keyword_recategory' | 'confidence_adjust';
  beforeState: {
    keyword?: string;
    category?: string;
    confidence?: number;
  };
  afterState: {
    keyword?: string;
    category?: string;
    confidence?: number;
  };
  triggerReason: string;
  sampleEvidence: Array<{
    query: string;
    predicted: boolean;
    actual: boolean;
  }>;
}

/**
 * PPO训练反思输入
 */
export interface PPOTrainingReflectionInput {
  epochsTrained: number;
  samplesUsed: number;
  policyLoss: number;
  valueLoss: number;
  avgReward: number;
  improvement: number;
  strategyWeightsBefore: Record<string, number>;
  strategyWeightsAfter: Record<string, number>;
}

// ============================================================================
// 反思服务
// ============================================================================

/**
 * 反思服务
 * 
 * 提供多种反思能力
 */
export class ReflectionService {
  private llmClient: LLMClient;
  private reflectionHistory: ReflectionResult[] = [];
  private maxHistorySize: number = 1000;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  // ===========================================================================
  // 核心反思方法
  // ===========================================================================

  /**
   * 意图分析反思
   * 
   * 在做出意图判断后，反思判断是否合理
   */
  async reflectOnIntentAnalysis(input: IntentReflectionInput): Promise<ReflectionResult> {
    const prompt = this.buildIntentReflectionPrompt(input);
    
    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: this.getIntentReflectionSystemPrompt() },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const result = this.parseReflectionResponse(response.content, 'after_intent_analysis');
      this.recordReflection(result);
      
      return result;
    } catch (error) {
      console.error('[Reflection] Intent analysis reflection failed:', error);
      return this.getDefaultReflection('after_intent_analysis');
    }
  }

  /**
   * 推荐质量反思
   * 
   * 在生成推荐后，反思推荐质量
   */
  async reflectOnRecommendation(input: RecommendationReflectionInput): Promise<ReflectionResult> {
    const prompt = this.buildRecommendationReflectionPrompt(input);
    
    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: this.getRecommendationReflectionSystemPrompt() },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const result = this.parseReflectionResponse(response.content, 'after_recommendation');
      this.recordReflection(result);
      
      return result;
    } catch (error: any) {
      console.error('[Reflection] Recommendation reflection failed:', error?.message || error);
      return this.getDefaultReflection('after_recommendation');
    }
  }

  /**
   * 规则更新反思
   * 
   * 在规则更新前，反思变更是否合理
   */
  async reflectOnRuleUpdate(input: RuleUpdateReflectionInput): Promise<ReflectionResult & { shouldProceed: boolean }> {
    const prompt = this.buildRuleUpdateReflectionPrompt(input);
    
    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: this.getRuleUpdateReflectionSystemPrompt() },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const result = this.parseReflectionResponse(response.content, 'before_rule_update');
      this.recordReflection(result);
      
      // 判断是否应该继续执行更新
      const shouldProceed = result.selfEvaluation.score >= 0.6 && 
        !result.improvements.some(i => i.priority === 'high' && i.suggestion.includes('不建议'));
      
      return { ...result, shouldProceed };
    } catch (error) {
      console.error('[Reflection] Rule update reflection failed:', error);
      return { ...this.getDefaultReflection('before_rule_update'), shouldProceed: true };
    }
  }

  /**
   * PPO训练反思
   * 
   * 在PPO训练后，反思策略是否真的在改进
   */
  async reflectOnPPOTraining(input: PPOTrainingReflectionInput): Promise<ReflectionResult & { isImproving: boolean }> {
    const prompt = this.buildPPOTrainingReflectionPrompt(input);
    
    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: this.getPPOTrainingReflectionSystemPrompt() },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const result = this.parseReflectionResponse(response.content, 'after_ppo_training');
      this.recordReflection(result);
      
      // 判断是否真的在改进
      const isImproving = input.improvement > 0 && 
        result.selfEvaluation.score >= 0.5 &&
        !result.improvements.some(i => i.suggestion.includes('过拟合') || i.suggestion.includes('退化'));
      
      return { ...result, isImproving };
    } catch (error) {
      console.error('[Reflection] PPO training reflection failed:', error);
      return { ...this.getDefaultReflection('after_ppo_training'), isImproving: input.improvement > 0 };
    }
  }

  // ===========================================================================
  // 批量反思
  // ===========================================================================

  /**
   * 批量反思（用于定期审查）
   */
  async performBatchReflection(options: {
    recentFeedbackCount?: number;
    timeWindowMs?: number;
  } = {}): Promise<{
    summary: {
      totalReflections: number;
      avgSelfScore: number;
      topIssues: string[];
      topSuggestions: string[];
    };
    detailedResults: ReflectionResult[];
  }> {
    const recentReflections = this.reflectionHistory.slice(-(options.recentFeedbackCount || 50));
    
    if (recentReflections.length === 0) {
      return {
        summary: {
          totalReflections: 0,
          avgSelfScore: 0,
          topIssues: [],
          topSuggestions: [],
        },
        detailedResults: [],
      };
    }

    // 计算平均自评分数
    const avgSelfScore = recentReflections.reduce((sum, r) => sum + r.selfEvaluation.score, 0) / recentReflections.length;

    // 提取所有问题和建议
    const allWeaknesses = recentReflections.flatMap(r => r.selfEvaluation.weaknesses);
    const allSuggestions = recentReflections.flatMap(r => r.improvements.map(i => i.suggestion));

    // 统计频率
    const weaknessCounts = this.countFrequency(allWeaknesses);
    const suggestionCounts = this.countFrequency(allSuggestions);

    return {
      summary: {
        totalReflections: recentReflections.length,
        avgSelfScore,
        topIssues: weaknessCounts.slice(0, 5).map(w => w.item),
        topSuggestions: suggestionCounts.slice(0, 5).map(s => s.item),
      },
      detailedResults: recentReflections,
    };
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  private getIntentReflectionSystemPrompt(): string {
    return `你是一个推荐系统的反思分析专家。你的任务是评估意图分析决策的合理性。

评估维度：
1. 决策一致性：判断是否与查询语义一致
2. 置信度合理性：置信度是否反映了真实的不确定性
3. 关键词匹配：关键词匹配是否准确
4. 边界情况处理：是否考虑了歧义和边界情况

输出格式（JSON）：
{
  "selfEvaluation": {
    "score": 0.8,
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1"]
  },
  "counterfactualAnalysis": {
    "alternativeDecisions": [
      {"decision": "不同选择", "expectedOutcome": "预期结果", "probability": 0.3}
    ],
    "bestAlternative": "最佳替代方案",
    "reasoning": "反事实推理过程"
  },
  "improvements": [
    {"area": "改进领域", "suggestion": "具体建议", "priority": "high", "implementable": true}
  ],
  "explainability": {
    "reasoningChain": ["推理步骤1", "推理步骤2"],
    "keyFactors": ["关键因素1", "关键因素2"],
    "confidenceExplanation": "置信度解释"
  }
}`;
  }

  private getRecommendationReflectionSystemPrompt(): string {
    return `你是一个推荐系统的反思分析专家。你的任务是评估推荐结果的质量。

评估维度：
1. 相关性：推荐是否与查询相关
2. 多样性：推荐是否有足够的多样性
3. 可信度：置信度评估是否准确
4. 来源质量：信息来源是否可靠

输出格式（必须是有效的JSON）：
{
  "selfEvaluation": {
    "score": 0.8,
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["不足1"]
  },
  "improvements": [
    {"area": "改进领域", "suggestion": "具体建议", "priority": "high", "implementable": true}
  ],
  "explainability": {
    "reasoningChain": ["推理步骤1", "推理步骤2"],
    "keyFactors": ["关键因素1", "关键因素2"],
    "confidenceExplanation": "置信度解释"
  }
}

请确保输出是纯JSON格式，不要包含任何其他文字。`;
  }

  private getRuleUpdateReflectionSystemPrompt(): string {
    return `你是一个推荐系统的反思分析专家。你的任务是评估规则更新的合理性和风险。

评估维度：
1. 证据充分性：样本证据是否足够支持变更
2. 影响范围：变更可能影响多少查询
3. 风险评估：变更可能带来的负面影响
4. 回滚策略：如果出问题如何回滚

输出格式同上。`;
  }

  private getPPOTrainingReflectionSystemPrompt(): string {
    return `你是一个推荐系统的反思分析专家。你的任务是评估PPO训练效果和策略改进。

评估维度：
1. 训练稳定性：损失函数是否收敛
2. 策略变化：策略权重变化是否合理
3. 泛化能力：模型是否过拟合
4. 改进方向：下一步优化建议

输出格式同上。`;
  }

  private buildIntentReflectionPrompt(input: IntentReflectionInput): string {
    return `请评估以下意图分析决策：

**查询**: ${input.query}
**场景**: ${input.scenario}
**预测结果**: ${input.predictedNeedsSearch ? '需要搜索' : '不需要搜索'}
**置信度**: ${input.predictedConfidence}
**推理过程**: ${input.reasoning}
**匹配关键词**: ${input.matchedKeywords.join(', ') || '无'}
**决策来源**: ${input.source}

请进行反思分析，评估决策的合理性。`;
  }

  private buildRecommendationReflectionPrompt(input: RecommendationReflectionInput): string {
    return `请评估以下推荐结果：

**查询**: ${input.query}
**信息来源**: ${input.sources.join(', ')}
**整体置信度**: ${input.overallConfidence}

**推荐项**:
${input.recommendations.map((r, i) => 
  `${i + 1}. ${r.title} (分数: ${r.score.toFixed(2)}, 置信度: ${r.confidence.toFixed(2)}, 来源: ${r.source})`
).join('\n')}

请进行反思分析，评估推荐质量。`;
  }

  private buildRuleUpdateReflectionPrompt(input: RuleUpdateReflectionInput): string {
    return `请评估以下规则更新：

**更新类型**: ${input.updateType}
**更新原因**: ${input.triggerReason}

**变更前**:
${JSON.stringify(input.beforeState, null, 2)}

**变更后**:
${JSON.stringify(input.afterState, null, 2)}

**样本证据**:
${input.sampleEvidence.slice(0, 5).map(e => 
  `- 查询: "${e.query}" → 预测: ${e.predicted ? '搜索' : '不搜索'}, 实际: ${e.actual ? '搜索' : '不搜索'}`
).join('\n')}

请进行反思分析，评估变更的合理性和风险。`;
  }

  private buildPPOTrainingReflectionPrompt(input: PPOTrainingReflectionInput): string {
    return `请评估以下PPO训练结果：

**训练轮数**: ${input.epochsTrained}
**使用样本数**: ${input.samplesUsed}
**策略损失**: ${input.policyLoss.toFixed(4)}
**价值损失**: ${input.valueLoss.toFixed(4)}
**平均奖励**: ${input.avgReward.toFixed(4)}
**改进幅度**: ${(input.improvement * 100).toFixed(2)}%

**策略权重变化**:
${Object.keys(input.strategyWeightsBefore).map(k => 
  `- ${k}: ${(input.strategyWeightsBefore as any)[k].toFixed(3)} → ${(input.strategyWeightsAfter as any)[k].toFixed(3)}`
).join('\n')}

请进行反思分析，评估训练效果和策略改进。`;
  }

  private parseReflectionResponse(content: string, trigger: ReflectionTrigger): ReflectionResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          trigger,
          timestamp: Date.now(),
          selfEvaluation: parsed.selfEvaluation || { score: 0.5, strengths: [], weaknesses: [] },
          counterfactualAnalysis: parsed.counterfactualAnalysis,
          improvements: parsed.improvements || [],
          explainability: parsed.explainability || {
            reasoningChain: [],
            keyFactors: [],
            confidenceExplanation: '',
          },
        };
      }
    } catch (e) {
      console.error('[Reflection] Failed to parse response:', e);
    }
    
    return this.getDefaultReflection(trigger);
  }

  private getDefaultReflection(trigger: ReflectionTrigger): ReflectionResult {
    return {
      trigger,
      timestamp: Date.now(),
      selfEvaluation: {
        score: 0.5,
        strengths: [],
        weaknesses: ['反思分析暂时不可用'],
      },
      improvements: [],
      explainability: {
        reasoningChain: [],
        keyFactors: [],
        confidenceExplanation: '反思分析暂时不可用',
      },
    };
  }

  private recordReflection(result: ReflectionResult): void {
    this.reflectionHistory.push(result);
    
    if (this.reflectionHistory.length > this.maxHistorySize) {
      this.reflectionHistory = this.reflectionHistory.slice(-this.maxHistorySize);
    }
  }

  private countFrequency(items: string[]): Array<{ item: string; count: number }> {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 获取反思历史
   */
  getReflectionHistory(limit: number = 50): ReflectionResult[] {
    return this.reflectionHistory.slice(-limit);
  }

  /**
   * 导出反思报告
   */
  exportReflectionReport(): string {
    const summary = {
      totalReflections: this.reflectionHistory.length,
      byTrigger: {} as Record<string, number>,
      avgScores: {} as Record<string, number>,
    };

    for (const r of this.reflectionHistory) {
      summary.byTrigger[r.trigger] = (summary.byTrigger[r.trigger] || 0) + 1;
      summary.avgScores[r.trigger] = (summary.avgScores[r.trigger] || 0) + r.selfEvaluation.score;
    }

    for (const trigger of Object.keys(summary.avgScores)) {
      summary.avgScores[trigger] /= summary.byTrigger[trigger];
    }

    return JSON.stringify(summary, null, 2);
  }
}

// ============================================================================
// 单例
// ============================================================================

let reflectionServiceInstance: ReflectionService | null = null;

export function getReflectionService(llmClient?: LLMClient): ReflectionService {
  if (!reflectionServiceInstance) {
    // 使用正确的配置创建 LLMClient
    const config = new Config();
    reflectionServiceInstance = new ReflectionService(llmClient || new LLMClient(config));
  }
  return reflectionServiceInstance;
}
