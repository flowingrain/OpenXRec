/**
 * 多维度置信度评估器
 * 
 * 为推荐结果提供细粒度的置信度评估：
 * 1. 意图理解置信度
 * 2. 信息检索置信度
 * 3. 推荐生成置信度
 * 4. 来源可信度
 */

import {
  MultiDimensionalConfidence,
  ConfidenceFactor,
  ItemConfidenceAssessment,
} from './types';

// 推荐项类型（简化版，用于评估）
export interface RecommendedItemForAssessment {
  id: string;
  title: string;
  description?: string;
  score: number;
  explanations?: Array<{ type: string; reason: string; factors: any[]; weight: number }>;
  strategies?: string[];
  source?: string;
}

// ============================================================================
// 多维度评估器类
// ============================================================================

export class MultiDimensionalEvaluator {
  /**
   * 评估推荐项的多维度置信度
   */
  assessItemConfidence(
    item: RecommendedItemForAssessment,
    context: {
      query: string;
      sources: string[];
      hasKnowledge: boolean;
      hasWebSearch: boolean;
      intentConfidence: number;
    }
  ): ItemConfidenceAssessment {
    // 计算各维度置信度
    const intentUnderstanding = this.assessIntentUnderstanding(context);
    const informationRetrieval = this.assessInformationRetrieval(context);
    const recommendationGeneration = this.assessRecommendationGeneration(item, context);
    const sourceReliability = this.assessSourceReliability(context);
    
    // 计算整体置信度（加权平均）
    const weights = {
      intent: 0.25,
      retrieval: 0.25,
      generation: 0.3,
      source: 0.2,
    };
    
    const overall = 
      intentUnderstanding.confidence * weights.intent +
      informationRetrieval.confidence * weights.retrieval +
      recommendationGeneration.confidence * weights.generation +
      sourceReliability.confidence * weights.source;
    
    const confidence: MultiDimensionalConfidence = {
      overall,
      intentUnderstanding,
      informationRetrieval,
      recommendationGeneration,
      sourceReliability,
    };
    
    // 生成解释
    const explanation = this.generateExplanation(confidence);
    
    return {
      itemId: item.id,
      confidence,
      calibratedConfidence: overall, // 校准在后续步骤进行
      explanation,
    };
  }

  /**
   * 评估意图理解置信度
   */
  private assessIntentUnderstanding(context: {
    query: string;
    intentConfidence: number;
  }): MultiDimensionalConfidence['intentUnderstanding'] {
    const factors: ConfidenceFactor[] = [];
    let confidence = context.intentConfidence;
    
    // 因素1：查询长度和复杂度
    const queryLength = context.query.length;
    const lengthScore = queryLength > 10 && queryLength < 100 ? 0.9 : 
                        queryLength < 5 ? 0.5 : 0.7;
    factors.push({
      name: 'query_clarity',
      description: '查询长度适中，意图较清晰',
      score: lengthScore,
      weight: 0.3,
      source: 'rule',
    });
    
    // 因素2：原始意图置信度
    factors.push({
      name: 'intent_confidence',
      description: `LLM意图分析置信度: ${(context.intentConfidence * 100).toFixed(0)}%`,
      score: context.intentConfidence,
      weight: 0.5,
      source: 'llm',
    });
    
    // 因素3：查询结构化程度
    const hasStructure = context.query.includes('?') || 
                         context.query.includes('推荐') ||
                         context.query.includes('建议');
    factors.push({
      name: 'query_structure',
      description: hasStructure ? '查询包含明确的问题结构' : '查询结构较弱',
      score: hasStructure ? 0.8 : 0.6,
      weight: 0.2,
      source: 'rule',
    });
    
    // 加权计算
    confidence = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    
    return { confidence, factors };
  }

  /**
   * 评估信息检索置信度
   */
  private assessInformationRetrieval(context: {
    sources: string[];
    hasKnowledge: boolean;
    hasWebSearch: boolean;
  }): MultiDimensionalConfidence['informationRetrieval'] {
    const factors: ConfidenceFactor[] = [];
    let confidence = 0.5; // 基础置信度
    
    // 因素1：知识库匹配
    if (context.hasKnowledge) {
      factors.push({
        name: 'knowledge_match',
        description: '预置知识库有相关内容',
        score: 0.85,
        weight: 0.35,
        source: 'data',
      });
    } else {
      factors.push({
        name: 'knowledge_match',
        description: '预置知识库无匹配内容',
        score: 0.3,
        weight: 0.35,
        source: 'data',
      });
    }
    
    // 因素2：Web搜索结果
    if (context.hasWebSearch) {
      factors.push({
        name: 'web_search',
        description: '互联网搜索获取了实时信息',
        score: 0.8,
        weight: 0.35,
        source: 'data',
      });
    } else {
      factors.push({
        name: 'web_search',
        description: '未进行互联网搜索',
        score: 0.5,
        weight: 0.35,
        source: 'data',
      });
    }
    
    // 因素3：信息来源数量
    const sourceCount = context.sources.length;
    const sourceScore = Math.min(1, sourceCount / 3);
    factors.push({
      name: 'source_diversity',
      description: `使用了${sourceCount}个信息来源`,
      score: sourceScore,
      weight: 0.3,
      source: 'rule',
    });
    
    confidence = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    
    return { confidence, factors };
  }

  /**
   * 评估推荐生成置信度
   */
  private assessRecommendationGeneration(
    item: RecommendedItemForAssessment,
    context: { query: string }
  ): MultiDimensionalConfidence['recommendationGeneration'] {
    const factors: ConfidenceFactor[] = [];
    
    // 因素1：推荐分数
    const scoreFactor: ConfidenceFactor = {
      name: 'recommendation_score',
      description: `推荐分数: ${(item.score * 100).toFixed(0)}%`,
      score: item.score,
      weight: 0.3,
      source: 'llm',
    };
    factors.push(scoreFactor);
    
    // 因素2：描述质量
    const descLength = item.description?.length || 0;
    const descScore = descLength > 50 ? 0.9 : descLength > 20 ? 0.7 : 0.5;
    factors.push({
      name: 'description_quality',
      description: `推荐描述长度: ${descLength}字符`,
      score: descScore,
      weight: 0.2,
      source: 'rule',
    });
    
    // 因素3：解释完整度
    const hasExplanation = item.explanations && item.explanations.length > 0;
    factors.push({
      name: 'explanation_coverage',
      description: hasExplanation ? `有${item.explanations?.length}条解释` : '无解释',
      score: hasExplanation ? 0.85 : 0.5,
      weight: 0.25,
      source: 'rule',
    });
    
    // 因素4：策略多样性
    const strategyCount = item.strategies?.length || 0;
    const strategyScore = Math.min(1, strategyCount / 2);
    factors.push({
      name: 'strategy_diversity',
      description: `使用了${strategyCount}种推荐策略`,
      score: strategyScore,
      weight: 0.25,
      source: 'rule',
    });
    
    const confidence = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    
    return { confidence, factors };
  }

  /**
   * 评估来源可信度
   */
  private assessSourceReliability(context: {
    sources: string[];
    hasKnowledge: boolean;
    hasWebSearch: boolean;
  }): MultiDimensionalConfidence['sourceReliability'] {
    const factors: ConfidenceFactor[] = [];
    
    // 因素1：LLM知识（始终可用）
    const hasLLM = context.sources.includes('llm_knowledge');
    factors.push({
      name: 'llm_knowledge',
      description: 'LLM内置知识',
      score: hasLLM ? 0.75 : 0,
      weight: 0.3,
      source: 'llm',
    });
    
    // 因素2：预置知识库
    const hasPreset = context.sources.includes('preset_knowledge');
    factors.push({
      name: 'preset_knowledge',
      description: '预置知识库（经过验证）',
      score: hasPreset ? 0.9 : 0,
      weight: 0.35,
      source: 'data',
    });
    
    // 因素3：Web搜索（时效性高，但可信度中等）
    const hasWeb = context.sources.includes('web_search');
    factors.push({
      name: 'web_search',
      description: '互联网搜索（时效性高）',
      score: hasWeb ? 0.7 : 0,
      weight: 0.35,
      source: 'data',
    });
    
    const confidence = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    
    return { confidence, factors };
  }

  /**
   * 生成置信度解释
   */
  private generateExplanation(confidence: MultiDimensionalConfidence): string {
    const parts: string[] = [];
    
    // 整体评价
    const overallLevel = confidence.overall >= 0.8 ? '高' : 
                         confidence.overall >= 0.6 ? '中等' : '较低';
    parts.push(`整体置信度: ${overallLevel} (${(confidence.overall * 100).toFixed(0)}%)`);
    
    // 各维度详情
    if (confidence.intentUnderstanding.confidence < 0.6) {
      parts.push('意图理解存在不确定性');
    }
    
    if (confidence.informationRetrieval.confidence < 0.5) {
      parts.push('信息检索结果有限');
    }
    
    if (confidence.sourceReliability.confidence > 0.8) {
      parts.push('信息来源可靠');
    }
    
    return parts.join('；');
  }

  /**
   * 批量评估推荐项
   */
  assessBatch(
    items: RecommendedItemForAssessment[],
    context: {
      query: string;
      sources: string[];
      hasKnowledge: boolean;
      hasWebSearch: boolean;
      intentConfidence: number;
    }
  ): ItemConfidenceAssessment[] {
    return items.map(item => this.assessItemConfidence(item, context));
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createMultiDimensionalEvaluator(): MultiDimensionalEvaluator {
  return new MultiDimensionalEvaluator();
}
