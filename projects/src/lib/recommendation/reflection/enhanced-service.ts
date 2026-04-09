/**
 * 反思增强服务
 * 
 * 将反思机制集成到推荐流程中，实现：
 * 1. 意图分析后反思 → 调整置信度和决策
 * 2. 推荐生成后反思 → 过滤低质量推荐
 * 3. 反馈循环 → 反思结果驱动优化
 */

import type { LLMClient } from 'coze-coding-dev-sdk';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import { 
  ReflectionService, 
  ReflectionResult,
  IntentReflectionInput,
  RecommendationReflectionInput,
} from './types';
import { AdaptiveOptimizerAgent, IntentFeedback } from '../adaptive-optimizer';
import { getCalibrationService } from '../calibration';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 意图分析结果（增强版）
 */
export interface EnhancedIntentAnalysis {
  needsSearch: boolean;
  reason: string;
  confidence: number;
  uncertainty?: string;
  source: 'llm' | 'rule_fallback';
  matchedKeywords?: string[];
  
  // 反思增强字段
  reflection?: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    adjustedConfidence: number;
    shouldTrust: boolean;
    alternativeDecision?: string;
  };
}

/**
 * 推荐结果（增强版）
 */
export interface EnhancedRecommendation {
  items: Array<{
    id: string;
    title: string;
    description?: string;
    score: number;
    confidence: number;
    source: string;
    metadata?: any;
    explanations?: Array<{
      type: string;
      reason: string;
      factors: Array<{ name: string; value: any; importance: number; category: string }>;
      weight: number;
    }>;
  }>;
  strategy: string;
  explanation: string;
  
  // 反思增强字段
  reflection?: {
    score: number;
    quality: 'high' | 'medium' | 'low';
    issues: string[];
    suggestions: string[];
    filteredCount: number;  // 被过滤的低质量项数量
  };
}

/**
 * 反馈循环结果
 */
export interface FeedbackLoopResult {
  recorded: boolean;
  triggeredOptimization: boolean;
  reflectionDrivenChanges: {
    confidenceAdjustment?: number;
    strategySwitch?: string;
    ruleUpdate?: {
      keyword: string;
      action: 'add' | 'remove' | 'update';
    };
  };
}

// ============================================================================
// 反思增强服务
// ============================================================================

/**
 * 反思增强服务
 * 
 * 集成反思机制到推荐流程的各个阶段
 */
export class ReflectionEnhancedService {
  private reflectionService: ReflectionService;
  private adaptiveOptimizer: AdaptiveOptimizerAgent;
  private llmClient: LLMClient;
  
  // 反思阈值配置
  private readonly REFLECTION_CONFIDENCE_THRESHOLD = 0.6;
  private readonly REFLECTION_QUALITY_THRESHOLD = 0.5;
  
  constructor(llmClient?: LLMClient) {
    // 使用正确的配置创建 LLMClient
    this.llmClient = llmClient ?? createLLMClient({});
    this.reflectionService = new ReflectionService(this.llmClient);
    this.adaptiveOptimizer = new AdaptiveOptimizerAgent(this.llmClient);
  }

  // ===========================================================================
  // 阶段1: 意图分析反思
  // ===========================================================================

  /**
   * 意图分析后反思
   * 
   * 在LLM或规则分析意图后，进行反思以：
   * 1. 验证决策合理性
   * 2. 调整置信度
   * 3. 提供替代方案
   */
  async reflectOnIntentAnalysis(
    query: string,
    scenario: string,
    baseAnalysis: {
      needsSearch: boolean;
      reason: string;
      confidence: number;
      uncertainty?: string;
      source: 'llm' | 'rule_fallback';
      matchedKeywords?: string[];
    }
  ): Promise<EnhancedIntentAnalysis> {
    try {
      // 低置信度或规则兜底时强制反思
      const shouldReflect = 
        baseAnalysis.confidence < this.REFLECTION_CONFIDENCE_THRESHOLD ||
        baseAnalysis.source === 'rule_fallback';
      
      if (!shouldReflect) {
        return { ...baseAnalysis };
      }
      
      // 执行反思
      const reflectionInput: IntentReflectionInput = {
        query,
        scenario,
        predictedNeedsSearch: baseAnalysis.needsSearch,
        predictedConfidence: baseAnalysis.confidence,
        reasoning: baseAnalysis.reason,
        matchedKeywords: baseAnalysis.matchedKeywords || [],
        source: baseAnalysis.source,
      };
      
      const reflection = await this.reflectionService.reflectOnIntentAnalysis(reflectionInput);
      
      // 根据反思结果调整
      const adjustedConfidence = this.adjustConfidenceByReflection(
        baseAnalysis.confidence,
        reflection
      );
      
      // 判断是否信任原决策
      const shouldTrust = reflection.selfEvaluation.score >= 0.5;
      
      // 提取替代决策
      const alternativeDecision = reflection.counterfactualAnalysis?.bestAlternative;
      
      return {
        ...baseAnalysis,
        confidence: adjustedConfidence,
        reflection: {
          score: reflection.selfEvaluation.score,
          strengths: reflection.selfEvaluation.strengths,
          weaknesses: reflection.selfEvaluation.weaknesses,
          adjustedConfidence,
          shouldTrust,
          alternativeDecision,
        },
      };
    } catch (error) {
      console.error('[ReflectionEnhanced] Intent analysis reflection failed:', error);
      return baseAnalysis;
    }
  }

  // ===========================================================================
  // 阶段2: 推荐质量反思
  // ===========================================================================

  /**
   * 推荐生成后反思
   * 
   * 在生成推荐后，进行反思以：
   * 1. 评估推荐质量
   * 2. 过滤低质量项
   * 3. 提供改进建议
   */
  async reflectOnRecommendation(
    query: string,
    baseRecommendation: {
      items: Array<{
        id: string;
        title: string;
        description?: string;
        score: number;
        confidence: number;
        source: string;
        metadata?: any;
        explanations?: Array<{
          type: string;
          reason: string;
          factors: Array<{ name: string; value: any; importance: number; category: string }>;
          weight: number;
        }>;
      }>;
      strategy: string;
      explanation: string;
    },
    sources: string[]
  ): Promise<EnhancedRecommendation> {
    try {
      // 执行反思
      const reflectionInput: RecommendationReflectionInput = {
        query,
        recommendations: baseRecommendation.items.map(item => ({
          id: item.id,
          title: item.title,
          score: item.score,
          confidence: item.confidence,
          source: item.source,
        })),
        overallConfidence: this.calculateAverageConfidence(baseRecommendation.items),
        sources,
      };
      
      const reflection = await this.reflectionService.reflectOnRecommendation(reflectionInput);
      
      // 根据反思过滤低质量项
      const { filteredItems, filteredCount } = this.filterByReflection(
        baseRecommendation.items,
        reflection
      );
      
      // 确定质量等级
      const quality = this.determineQualityLevel(reflection.selfEvaluation.score);
      
      // 提取问题和建议
      const issues = reflection.selfEvaluation.weaknesses;
      const suggestions = reflection.improvements.map(i => i.suggestion);
      
      return {
        ...baseRecommendation,
        items: filteredItems,
        reflection: {
          score: reflection.selfEvaluation.score,
          quality,
          issues,
          suggestions,
          filteredCount,
        },
      };
    } catch (error) {
      console.error('[ReflectionEnhanced] Recommendation reflection failed:', error);
      return baseRecommendation;
    }
  }

  // ===========================================================================
  // 阶段3: 反馈循环
  // ===========================================================================

  /**
   * 反馈循环处理
   * 
   * 将反思结果和实际结果结合，驱动系统优化：
   * 1. 记录意图反馈
   * 2. 触发自适应优化
   * 3. 应用反思驱动的变更
   */
  async processFeedbackLoop(params: {
    query: string;
    intentAnalysis: EnhancedIntentAnalysis;
    recommendation: EnhancedRecommendation;
    actualOutcome?: {
      userSatisfied?: boolean;
      clickedItems?: string[];
      dwellTime?: number;
    };
  }): Promise<FeedbackLoopResult> {
    const result: FeedbackLoopResult = {
      recorded: false,
      triggeredOptimization: false,
      reflectionDrivenChanges: {},
    };
    
    try {
      // 1. 推断实际是否需要搜索
      const actualNeedsSearch = this.inferActualNeedsSearch(
        params.intentAnalysis,
        params.recommendation,
        params.actualOutcome
      );
      
      // 2. 构建意图反馈
      const feedback: IntentFeedback = {
        query: params.query,
        predictedNeedsSearch: params.intentAnalysis.needsSearch,
        predictedConfidence: params.intentAnalysis.confidence,
        actualNeedsSearch,
        matchedKeywords: params.intentAnalysis.matchedKeywords || [],
        source: params.intentAnalysis.source,
        timestamp: Date.now(),
      };
      
      // 3. 记录反馈并学习
      await this.adaptiveOptimizer.recordFeedbackAndLearn(feedback);
      result.recorded = true;
      
      // 4. 反思驱动的调整
      if (params.intentAnalysis.reflection && !params.intentAnalysis.reflection.shouldTrust) {
        // 反思认为决策不可信，触发调整
        result.reflectionDrivenChanges.confidenceAdjustment = 
          params.intentAnalysis.confidence * 0.7;
      }
      
      if (params.recommendation.reflection && params.recommendation.reflection.quality === 'low') {
        // 反思认为推荐质量低，触发策略检查
        result.reflectionDrivenChanges.strategySwitch = 'fallback';
      }
      
      // 5. 检查是否触发优化
      const report = this.adaptiveOptimizer.getOptimizationReport();
      const feedbackCount = report.feedbackCount;
      
      if (feedbackCount % 50 === 0 && feedbackCount > 0) {
        // 每50条反馈触发一次优化
        result.triggeredOptimization = true;
        
        // 异步触发优化（不阻塞）
        setImmediate(async () => {
          try {
            await this.adaptiveOptimizer.runOptimization();
          } catch (e) {
            console.error('[ReflectionEnhanced] Optimization failed:', e);
          }
        });
      }
      
      return result;
    } catch (error) {
      console.error('[ReflectionEnhanced] Feedback loop failed:', error);
      return result;
    }
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 根据反思调整置信度
   */
  private adjustConfidenceByReflection(
    originalConfidence: number,
    reflection: ReflectionResult
  ): number {
    const reflectionScore = reflection.selfEvaluation.score;
    
    // 反思分数低 → 降低置信度
    if (reflectionScore < 0.4) {
      return originalConfidence * 0.6;
    } else if (reflectionScore < 0.6) {
      return originalConfidence * 0.8;
    } else if (reflectionScore > 0.8) {
      // 反思分数高 → 略微提升置信度
      return Math.min(originalConfidence * 1.1, 1.0);
    }
    
    return originalConfidence;
  }

  /**
   * 根据反思过滤推荐项
   */
  private filterByReflection(
    items: EnhancedRecommendation['items'],
    reflection: ReflectionResult
  ): { filteredItems: typeof items; filteredCount: number } {
    const reflectionScore = reflection.selfEvaluation.score;
    
    // 反思分数高 → 信任原结果
    if (reflectionScore >= 0.6) {
      return { filteredItems: items, filteredCount: 0 };
    }
    
    // 反思分数中等 → 过滤低置信度项
    if (reflectionScore >= 0.4) {
      const filtered = items.filter(item => item.confidence >= 0.5);
      return { filteredItems: filtered, filteredCount: items.length - filtered.length };
    }
    
    // 反思分数低 → 只保留高置信度项
    const filtered = items.filter(item => item.confidence >= 0.7);
    return { filteredItems: filtered, filteredCount: items.length - filtered.length };
  }

  /**
   * 计算平均置信度
   */
  private calculateAverageConfidence(
    items: EnhancedRecommendation['items']
  ): number {
    if (items.length === 0) return 0;
    return items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
  }

  /**
   * 确定质量等级
   */
  private determineQualityLevel(
    reflectionScore: number
  ): 'high' | 'medium' | 'low' {
    if (reflectionScore >= 0.7) return 'high';
    if (reflectionScore >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * 推断实际是否需要搜索
   */
  private inferActualNeedsSearch(
    intentAnalysis: EnhancedIntentAnalysis,
    recommendation: EnhancedRecommendation,
    actualOutcome?: { userSatisfied?: boolean; clickedItems?: string[]; dwellTime?: number }
  ): boolean {
    // 基于用户行为推断
    if (actualOutcome?.userSatisfied === false) {
      // 用户不满意，可能应该搜索
      return true;
    }
    
    // 基于推荐质量推断
    if (recommendation.reflection?.quality === 'low') {
      return !intentAnalysis.needsSearch;  // 反转决策
    }
    
    // 基于反思推断
    if (intentAnalysis.reflection && !intentAnalysis.reflection.shouldTrust) {
      // 反思认为决策不可信，假设应该搜索
      return true;
    }
    
    // 默认信任原判断
    return intentAnalysis.needsSearch;
  }

  /**
   * 获取反思服务实例
   */
  getReflectionService(): ReflectionService {
    return this.reflectionService;
  }

  /**
   * 获取自适应优化器实例
   */
  getAdaptiveOptimizer(): AdaptiveOptimizerAgent {
    return this.adaptiveOptimizer;
  }
}

// ============================================================================
// 服务获取
// ============================================================================

let reflectionEnhancedServiceInstance: ReflectionEnhancedService | null = null;

/**
 * 获取反思增强服务实例
 * 
 * @param llmClient - 可选的 LLM 客户端，如果传入则创建新实例以确保使用正确的请求上下文
 * @returns 反思增强服务实例
 */
export function getReflectionEnhancedService(llmClient?: LLMClient): ReflectionEnhancedService {
  // 如果传入了 LLMClient，总是创建新实例以确保使用正确的请求上下文（如 customHeaders）
  if (llmClient) {
    return new ReflectionEnhancedService(llmClient);
  }
  
  // 否则使用缓存的实例（用于不需要请求上下文的场景）
  if (!reflectionEnhancedServiceInstance) {
    reflectionEnhancedServiceInstance = new ReflectionEnhancedService();
  }
  return reflectionEnhancedServiceInstance;
}
