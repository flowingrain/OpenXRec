/**
 * 反思机制集成示例
 * 
 * 展示如何在推荐流程的各个阶段使用反思机制
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import { ReflectionService } from './types';

/**
 * 反思增强的意图分析
 * 
 * 在LLM分析意图后，进行反思以验证决策
 */
export async function analyzeIntentWithReflection(
  query: string,
  scenario: string,
  llmClient: LLMClient
): Promise<{
  needsSearch: boolean;
  confidence: number;
  reason: string;
  reflection?: {
    score: number;
    improvements: string[];
    shouldTrust: boolean;
  };
}> {
  // 1. LLM意图分析
  const intentResponse = await llmClient.invoke([
    { role: 'system', content: '你是一个意图分析专家。分析用户查询是否需要实时信息搜索。' },
    { role: 'user', content: `查询: ${query}\n场景: ${scenario}\n\n请判断是否需要搜索实时信息。` },
  ], { model: 'doubao-seed-2-0-mini-260215' });

  // 简化的意图解析
  const needsSearch = intentResponse.content.includes('需要搜索') || 
                      intentResponse.content.includes('实时') ||
                      intentResponse.content.includes('最新');
  
  const confidence = needsSearch ? 0.75 : 0.80;
  const reason = needsSearch ? '查询可能涉及实时信息' : '查询可基于内置知识回答';

  // 2. 反思验证
  const reflectionService = new ReflectionService(llmClient);
  
  try {
    const reflection = await reflectionService.reflectOnIntentAnalysis({
      query,
      scenario,
      predictedNeedsSearch: needsSearch,
      predictedConfidence: confidence,
      reasoning: reason,
      matchedKeywords: [],
      source: 'llm',
    });

    // 3. 根据反思结果调整决策
    const shouldTrust = reflection.selfEvaluation.score >= 0.6;
    
    // 如果反思分数低，降低置信度
    const adjustedConfidence = shouldTrust ? confidence : confidence * 0.7;

    return {
      needsSearch,
      confidence: adjustedConfidence,
      reason,
      reflection: {
        score: reflection.selfEvaluation.score,
        improvements: reflection.improvements.map(i => i.suggestion),
        shouldTrust,
      },
    };
  } catch (error) {
    console.error('[Reflection] Failed to reflect on intent:', error);
    return { needsSearch, confidence, reason };
  }
}

/**
 * 反思增强的推荐生成
 * 
 * 在生成推荐后，进行反思以评估质量
 */
export async function generateRecommendationWithReflection(
  query: string,
  recommendations: Array<{
    id: string;
    title: string;
    score: number;
    confidence: number;
    source: string;
  }>,
  sources: string[],
  llmClient: LLMClient
): Promise<{
  recommendations: typeof recommendations;
  overallConfidence: number;
  reflection?: {
    score: number;
    topIssues: string[];
    suggestions: string[];
  };
}> {
  // 计算整体置信度
  const overallConfidence = recommendations.length > 0
    ? recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length
    : 0;

  // 反思评估
  const reflectionService = new ReflectionService(llmClient);
  
  try {
    const reflection = await reflectionService.reflectOnRecommendation({
      query,
      recommendations,
      overallConfidence,
      sources,
    });

    // 根据反思结果调整推荐
    let adjustedRecommendations = recommendations;
    
    if (reflection.selfEvaluation.score < 0.5) {
      // 质量不达标，降低推荐分数或过滤
      adjustedRecommendations = recommendations.map(r => ({
        ...r,
        score: r.score * 0.8,
        confidence: r.confidence * 0.8,
      }));
    }

    return {
      recommendations: adjustedRecommendations,
      overallConfidence,
      reflection: {
        score: reflection.selfEvaluation.score,
        topIssues: reflection.selfEvaluation.weaknesses,
        suggestions: reflection.improvements.map(i => i.suggestion),
      },
    };
  } catch (error) {
    console.error('[Reflection] Failed to reflect on recommendation:', error);
    return { recommendations, overallConfidence };
  }
}

/**
 * 反思增强的规则更新
 * 
 * 在规则更新前，进行反思以评估风险
 */
export async function updateRuleWithReflection(
  updateInput: {
    updateType: 'keyword_add' | 'keyword_remove' | 'keyword_recategory' | 'confidence_adjust';
    beforeState: any;
    afterState: any;
    triggerReason: string;
    sampleEvidence: Array<{ query: string; predicted: boolean; actual: boolean }>;
  },
  llmClient: LLMClient
): Promise<{
  shouldUpdate: boolean;
  reason: string;
  reflection?: {
    score: number;
    risks: string[];
    mitigation: string[];
  };
}> {
  const reflectionService = new ReflectionService(llmClient);
  
  try {
    const result = await reflectionService.reflectOnRuleUpdate(updateInput);

    if (!result.shouldProceed) {
      return {
        shouldUpdate: false,
        reason: '反思分析不建议执行此更新',
        reflection: {
          score: result.selfEvaluation.score,
          risks: result.selfEvaluation.weaknesses,
          mitigation: result.improvements.map(i => i.suggestion),
        },
      };
    }

    return {
      shouldUpdate: true,
      reason: '反思分析认为更新是合理的',
      reflection: {
        score: result.selfEvaluation.score,
        risks: result.selfEvaluation.weaknesses,
        mitigation: result.improvements.map(i => i.suggestion),
      },
    };
  } catch (error) {
    console.error('[Reflection] Failed to reflect on rule update:', error);
    return { shouldUpdate: true, reason: '反思分析失败，允许更新继续' };
  }
}

/**
 * 反思增强的PPO训练
 * 
 * 在PPO训练后，进行反思以评估策略改进
 */
export async function evaluatePPOTrainingWithReflection(
  trainingInput: {
    epochsTrained: number;
    samplesUsed: number;
    policyLoss: number;
    valueLoss: number;
    avgReward: number;
    improvement: number;
    strategyWeightsBefore: Record<string, number>;
    strategyWeightsAfter: Record<string, number>;
  },
  llmClient: LLMClient
): Promise<{
  acceptChanges: boolean;
  reason: string;
  reflection?: {
    score: number;
    isImproving: boolean;
    suggestions: string[];
  };
}> {
  const reflectionService = new ReflectionService(llmClient);
  
  try {
    const result = await reflectionService.reflectOnPPOTraining(trainingInput);

    if (!result.isImproving) {
      return {
        acceptChanges: false,
        reason: '反思分析检测到潜在问题，建议回滚',
        reflection: {
          score: result.selfEvaluation.score,
          isImproving: false,
          suggestions: result.improvements.map(i => i.suggestion),
        },
      };
    }

    return {
      acceptChanges: true,
      reason: '反思分析确认策略正在改进',
      reflection: {
        score: result.selfEvaluation.score,
        isImproving: true,
        suggestions: result.improvements.map(i => i.suggestion),
      },
    };
  } catch (error) {
    console.error('[Reflection] Failed to reflect on PPO training:', error);
    return { 
      acceptChanges: trainingInput.improvement > 0, 
      reason: '反思分析失败，基于训练指标判断' 
    };
  }
}
