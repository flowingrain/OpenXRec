/**
 * 响应模板系统
 * 
 * 提供基于模板的响应生成能力，实现展示格式与业务逻辑分离
 * 
 * @example
 * ```typescript
 * import { getTemplateSelector, TemplateType } from '@/lib/recommendation/response-templates';
 * 
 * // 获取模板选择器
 * const selector = getTemplateSelector({ enableDebug: true });
 * 
 * // 选择模板
 * const result = selector.selectTemplate(
 *   '对比特斯拉和比亚迪的优缺点',
 *   { type: 'comparison_analysis', confidence: 0.9 }
 * );
 * 
 * console.log('匹配的模板:', result.template.name);
 * console.log('匹配分数:', result.score);
 * ```
 */

// 类型导出
export type {
  ResponseTemplate,
  TemplateTriggers,
  RenderConfig,
  TemplateExample,
  ComparisonAnalysisOutput,
  RankingListOutput,
  SingleAnswerOutput,
  RecommendationItemsOutput,
  ClarificationOutput,
  StepByStepOutput,
  DataInsightOutput,
  TemplateMatchResult,
  TemplateRenderContext,
  TemplateOutput,
} from './types';

// 导入类型供内部使用
import type { 
  ResponseTemplate as ResponseTemplateType,
  TemplateOutput as TemplateOutputType,
} from './types';

// 枚举导出
export { 
  TemplateType, 
  DEFAULT_RENDER_CONFIGS 
} from './types';

// 选择器导出
export {
  TemplateSelector,
  getTemplateSelector,
  createTemplateSelector,
} from './selector';

// 预置模板导出
export {
  COMPARISON_ANALYSIS_TEMPLATE,
  RANKING_LIST_TEMPLATE,
  SINGLE_ANSWER_TEMPLATE,
  RECOMMENDATION_ITEMS_TEMPLATE,
  CLARIFICATION_TEMPLATE,
  PRESET_TEMPLATES,
} from './presets';

// ============================================================================
// 模板渲染工具
// ============================================================================

/**
 * 简单的模板字符串渲染
 * 
 * 支持语法：
 * - {{variable}} - 变量替换
 * - {{#array}}...{{/array}} - 数组循环
 * - {{^array}}...{{/array}} - 空数组时显示
 */
export function renderTemplate(template: string, data: Record<string, any>): string {
  let result = template;

  // 处理数组循环 {{#array}}...{{/array}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    const array = data[key];
    if (!Array.isArray(array) || array.length === 0) {
      return '';
    }
    return array.map((item: any, index: number) => {
      let itemContent = content;
      if (typeof item === 'object') {
        // 对象项：替换所有 {{property}}
        for (const [k, v] of Object.entries(item)) {
          itemContent = itemContent.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
          // 处理条件块 {{#property}}...{{/property}}
          itemContent = itemContent.replace(new RegExp(`\\{\\{#${k}\\}\\}([\\s\\S]*?)\\{\\{\\/${k}\\}\\}`, 'g'), v ? '$1' : '');
        }
      } else {
        // 简单值：替换 {{.}}
        itemContent = itemContent.replace(/\{\{\.\}\}/g, String(item));
      }
      // 替换 {{@index}} 为索引
      itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index + 1));
      return itemContent;
    }).join('');
  });

  // 处理空数组 {{^array}}...{{/array}}
  result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    const array = data[key];
    if (!Array.isArray(array) || array.length === 0) {
      return content;
    }
    return '';
  });

  // 处理简单变量 {{variable}}
  result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], data);
    return value !== undefined ? String(value) : '';
  });

  return result.trim();
}

// ============================================================================
// 输出验证工具
// ============================================================================

/**
 * 验证输出是否符合 Schema
 */
export function validateOutput(output: any, schema: Record<string, any>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  function validate(value: any, schema: any, path: string): void {
    if (!schema) return;

    // 类型检查
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        errors.push(`${path}: expected ${schema.type}, got ${actualType}`);
        return;
      }
    }

    // 常量检查
    if (schema.const !== undefined && value !== schema.const) {
      errors.push(`${path}: expected ${schema.const}, got ${value}`);
      return;
    }

    // 枚举检查
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path}: value must be one of ${schema.enum.join(', ')}`);
      return;
    }

    // 必需字段检查
    if (schema.required && Array.isArray(schema.required) && typeof value === 'object') {
      for (const field of schema.required) {
        if (value[field] === undefined) {
          errors.push(`${path}: missing required field "${field}"`);
        }
      }
    }

    // 属性检查
    if (schema.properties && typeof value === 'object') {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (value[key] !== undefined) {
          validate(value[key], propSchema, `${path}.${key}`);
        }
      }
    }

    // 数组项检查
    if (schema.items && Array.isArray(value)) {
      value.forEach((item, index) => {
        validate(item, schema.items, `${path}[${index}]`);
      });
    }

    // 最小/最大值检查
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: value ${value} is less than minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: value ${value} is greater than maximum ${schema.maximum}`);
      }
    }
  }

  validate(output, schema, 'root');

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// 模板渲染服务
// ============================================================================

/**
 * 模板渲染服务
 */
export class TemplateRenderService {
  /**
   * 渲染模板并调用 LLM 生成输出
   */
  static async renderWithLLM(
    template: ResponseTemplateType,
    context: Record<string, any>,
    llmClient: {
      chat: (params: { messages: Array<{ role: string; content: string }> }) => Promise<{ content: string }>;
    }
  ): Promise<{ output: any; raw: string }> {
    // 渲染 Prompt
    const prompt = renderTemplate(template.promptTemplate, context);

    // 调用 LLM
    const response = await llmClient.chat({
      messages: [{ role: 'user', content: prompt }],
    });

    // 解析 JSON 输出
    let output: any;
    try {
      // 提取 JSON 代码块
      const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response.content;
      output = JSON.parse(jsonStr);
    } catch (error) {
      console.error('[TemplateRenderService] Failed to parse LLM output:', error);
      throw new Error('LLM 输出格式错误，无法解析为 JSON');
    }

    // 验证输出
    const validation = validateOutput(output, template.outputSchema);
    if (!validation.valid) {
      console.warn('[TemplateRenderService] Output validation warnings:', validation.errors);
      // 不阻止输出，仅记录警告
    }

    // 添加渲染配置
    output._renderConfig = template.renderConfig;
    output._templateId = template.id;

    return { output, raw: response.content };
  }
}
