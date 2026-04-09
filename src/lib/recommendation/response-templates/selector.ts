/**
 * 模板选择器
 * 
 * 根据用户问题和意图分析结果，选择最合适的响应模板
 */

import type { 
  ResponseTemplate, 
  TemplateTriggers, 
  TemplateMatchResult 
} from './types';
import { TemplateType } from './types';
import { 
  COMPARISON_ANALYSIS_TEMPLATE,
  RANKING_LIST_TEMPLATE,
  SINGLE_ANSWER_TEMPLATE,
  RECOMMENDATION_ITEMS_TEMPLATE,
  CLARIFICATION_TEMPLATE,
} from './presets';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 意图分析结果（简化版）
 */
interface IntentResult {
  type: string;
  scenarioType?: string;
  confidence: number;
  entities?: Array<{ name: string; type?: string }>;
  queryType?: string;
  needsSearch?: boolean;
}

/**
 * 模板选择器配置
 */
interface TemplateSelectorConfig {
  /** 最小匹配分数阈值 */
  minMatchScore?: number;
  /** 是否启用调试日志 */
  enableDebug?: boolean;
  /** 自定义模板 */
  customTemplates?: ResponseTemplate[];
}

// ============================================================================
// 模板选择器
// ============================================================================

/**
 * 模板选择器
 * 
 * 负责根据用户问题和意图，选择最合适的响应模板
 */
export class TemplateSelector {
  private templates: Map<string, ResponseTemplate>;
  private config: Required<TemplateSelectorConfig>;

  constructor(config?: TemplateSelectorConfig) {
    this.config = {
      minMatchScore: config?.minMatchScore ?? 0.5,
      enableDebug: config?.enableDebug ?? false,
      customTemplates: config?.customTemplates ?? [],
    };

    this.templates = new Map();
    this.registerDefaultTemplates();
    
    // 注册自定义模板
    for (const template of this.config.customTemplates) {
      this.registerTemplate(template);
    }
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 选择最佳模板
   */
  selectTemplate(query: string, intent: IntentResult): TemplateMatchResult {
    const candidates: Array<{ template: ResponseTemplate; score: number; details: any }> = [];

    this.log(`[TemplateSelector] Selecting template for query: "${query}"`);
    this.log(`[TemplateSelector] Intent:`, intent);

    for (const template of this.templates.values()) {
      const { score, details } = this.calculateMatchScore(query, intent, template);
      
      if (score >= this.config.minMatchScore) {
        candidates.push({ template, score, details });
        this.log(`[TemplateSelector] Template ${template.id} score: ${score.toFixed(2)}`);
      }
    }

    // 按分数排序
    candidates.sort((a, b) => b.score - a.score);

    // 返回最佳匹配
    if (candidates.length === 0) {
      // 兜底：使用推荐列表模板
      this.log(`[TemplateSelector] No template matched, using fallback`);
      return {
        template: this.templates.get(TemplateType.RECOMMENDATION_ITEMS)!,
        score: 0.5,
        details: { reason: 'fallback' },
      };
    }

    const best = candidates[0];
    this.log(`[TemplateSelector] Selected template: ${best.template.id} (${best.template.name})`);

    return {
      template: best.template,
      score: best.score,
      details: best.details,
    };
  }

  /**
   * 注册模板
   */
  registerTemplate(template: ResponseTemplate): void {
    this.templates.set(template.id, template);
    this.log(`[TemplateSelector] Registered template: ${template.id}`);
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): ResponseTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 根据ID获取模板
   */
  getTemplate(id: string): ResponseTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 根据意图类型快速获取模板
   */
  getTemplateByIntent(intentType: string): ResponseTemplate | undefined {
    for (const template of this.templates.values()) {
      if (template.triggers.intentTypes?.includes(intentType)) {
        return template;
      }
    }
    return undefined;
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 注册默认模板
   */
  private registerDefaultTemplates(): void {
    const defaultTemplates = [
      COMPARISON_ANALYSIS_TEMPLATE,
      RANKING_LIST_TEMPLATE,
      SINGLE_ANSWER_TEMPLATE,
      RECOMMENDATION_ITEMS_TEMPLATE,
      CLARIFICATION_TEMPLATE,
    ];

    for (const template of defaultTemplates) {
      this.registerTemplate(template);
    }
  }

  /**
   * 计算模板匹配分数
   */
  private calculateMatchScore(
    query: string,
    intent: IntentResult,
    template: ResponseTemplate
  ): { score: number; details: any } {
    const details: any = {};
    let score = 0;
    let weights = 0;

    // 1. 意图类型匹配 (权重 0.35)
    if (template.triggers.intentTypes?.length) {
      const intentType = intent.queryType || intent.type;
      if (template.triggers.intentTypes.includes(intentType)) {
        score += 0.35;
        details.intentMatched = intentType;
      }
      weights += 0.35;
    }

    // 2. 问题模式匹配 (权重 0.30)
    if (template.triggers.queryPatterns?.length) {
      const patternScore = this.matchPatterns(query, template.triggers.queryPatterns);
      if (patternScore > 0) {
        score += 0.30 * patternScore;
        details.patternMatched = template.triggers.queryPatterns.find(p => 
          this.matchSinglePattern(query, p)
        );
      }
      weights += 0.30;
    }

    // 3. 关键词匹配 (权重 0.15)
    if (template.triggers.keywords?.length) {
      const keywordScore = this.matchKeywords(query, template.triggers.keywords);
      if (keywordScore > 0) {
        score += 0.15 * keywordScore;
        details.keywordsMatched = template.triggers.keywords.filter(k => 
          query.toLowerCase().includes(k.toLowerCase())
        );
      }
      weights += 0.15;
    }

    // 4. 实体数量匹配 (权重 0.20)
    if (template.triggers.entityCount) {
      const entityCount = intent.entities?.length || 0;
      const { min, max } = template.triggers.entityCount;
      if (entityCount >= min && entityCount <= max) {
        score += 0.20;
        details.entityCountMatched = true;
      } else if (entityCount > 0) {
        // 部分匹配
        const ratio = Math.min(entityCount / min, max / entityCount);
        score += 0.20 * ratio * 0.5;
      }
      weights += 0.20;
    }

    // 5. 场景类型匹配 (权重 0.10)
    if (template.triggers.scenarioTypes?.length && intent.scenarioType) {
      if (template.triggers.scenarioTypes.includes(intent.scenarioType)) {
        score += 0.10;
        details.scenarioMatched = intent.scenarioType;
      }
      weights += 0.10;
    }

    // 归一化分数
    const normalizedScore = weights > 0 ? score / weights : 0;

    return { score: normalizedScore, details };
  }

  /**
   * 匹配问题模式列表
   */
  private matchPatterns(query: string, patterns: string[]): number {
    for (const pattern of patterns) {
      if (this.matchSinglePattern(query, pattern)) {
        return 1.0;
      }
    }
    return 0;
  }

  /**
   * 匹配单个模式
   * 
   * 支持：
   * - {A}、{B} 等占位符
   * - 正则表达式语法
   */
  private matchSinglePattern(query: string, pattern: string): boolean {
    try {
      // 将占位符转换为正则表达式
      const regexPattern = pattern
        .replace(/{(\w+)}/g, '(.+?)')  // {A} -> (.+?)
        .replace(/\s+/g, '\\s*')        // 空格 -> \s*
        .replace(/[？?！!]/g, '[?？!！]?'); // 标点可选
      
      const regex = new RegExp(regexPattern, 'i');
      return regex.test(query);
    } catch (error) {
      // 正则表达式错误，使用简单包含匹配
      return query.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  /**
   * 匹配关键词
   */
  private matchKeywords(query: string, keywords: string[]): number {
    const queryLower = query.toLowerCase();
    let matchCount = 0;

    for (const keyword of keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    // 返回匹配比例
    return keywords.length > 0 ? matchCount / keywords.length : 0;
  }

  /**
   * 日志输出
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableDebug) {
      console.log(message, ...args);
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let templateSelectorInstance: TemplateSelector | null = null;

/**
 * 获取模板选择器单例
 */
export function getTemplateSelector(config?: TemplateSelectorConfig): TemplateSelector {
  if (!templateSelectorInstance) {
    templateSelectorInstance = new TemplateSelector(config);
  }
  return templateSelectorInstance;
}

/**
 * 创建新的模板选择器实例
 */
export function createTemplateSelector(config?: TemplateSelectorConfig): TemplateSelector {
  return new TemplateSelector(config);
}
