/**
 * 工具注册表
 * 
 * 管理所有可用工具的注册、查找和执行
 */

import type {
  ToolDefinition,
  ToolCallRequest,
  ToolCallResult,
  RegisteredTool,
  ToolExecutor,
} from './types';

// ============================================================================
// 工具注册表类
// ============================================================================

class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private initialized = false;

  /**
   * 注册工具
   */
  register(definition: ToolDefinition, executor: ToolExecutor): void {
    if (this.tools.has(definition.name)) {
      console.warn(`[ToolRegistry] Tool "${definition.name}" already registered, overwriting`);
    }
    
    this.tools.set(definition.name, {
      definition,
      executor,
    });
    
    console.log(`[ToolRegistry] Registered tool: ${definition.name}`);
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: Array<{ definition: ToolDefinition; executor: ToolExecutor }>): void {
    for (const { definition, executor } of tools) {
      this.register(definition, executor);
    }
  }

  /**
   * 获取工具定义
   */
  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  /**
   * 获取所有工具定义（供 LLM 使用）
   */
  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /**
   * 获取指定类别的工具
   */
  getToolsByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.definition.category === category)
      .map(t => t.definition);
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 执行工具
   */
  async execute(request: ToolCallRequest): Promise<ToolCallResult> {
    const registered = this.tools.get(request.name);
    
    if (!registered) {
      return {
        success: false,
        error: `Tool "${request.name}" not found`,
        summary: `请求的工具 "${request.name}" 不存在`,
      };
    }

    // 参数验证
    const validationError = this.validateParameters(
      registered.definition,
      request.parameters
    );
    
    if (validationError) {
      return {
        success: false,
        error: validationError,
        summary: `参数验证失败: ${validationError}`,
      };
    }

    // 执行工具
    const startTime = Date.now();
    try {
      const result = await registered.executor(request);
      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        summary: `工具执行失败: ${error}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 验证参数
   */
  private validateParameters(
    definition: ToolDefinition,
    parameters: Record<string, any>
  ): string | null {
    // 检查必需参数
    if (definition.required) {
      for (const param of definition.required) {
        if (parameters[param] === undefined || parameters[param] === null) {
          return `Missing required parameter: ${param}`;
        }
      }
    }

    // 检查参数类型
    for (const [key, value] of Object.entries(parameters)) {
      const schema = definition.parameters[key];
      if (schema) {
        const typeError = this.validateType(key, value, schema);
        if (typeError) {
          return typeError;
        }
      }
    }

    return null;
  }

  /**
   * 验证参数类型
   */
  private validateType(key: string, value: any, schema: any): string | null {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (schema.type && actualType !== schema.type) {
      // 宽松检查：数字字符串可以转换为数字
      if (schema.type === 'number' && typeof value === 'string' && !isNaN(Number(value))) {
        return null;
      }
      return `Parameter "${key}" expected type "${schema.type}", got "${actualType}"`;
    }

    // 检查枚举值
    if (schema.enum && !schema.enum.includes(value)) {
      return `Parameter "${key}" must be one of: ${schema.enum.join(', ')}`;
    }

    return null;
  }

  /**
   * 获取工具列表描述（供 LLM 理解）
   */
  getToolDescriptionsForLLM(): string {
    const definitions = this.getAllDefinitions();
    
    if (definitions.length === 0) {
      return 'No tools available.';
    }

    const descriptions = definitions.map(def => {
      const params = Object.entries(def.parameters)
        .map(([name, schema]) => {
          const required = def.required?.includes(name) ? ' (required)' : '';
          return `  - ${name}${required}: ${schema.description}`;
        })
        .join('\n');
      
      return `### ${def.displayName} (${def.name})
${def.description}

Parameters:
${params}`;
    });

    return `Available Tools:\n\n${descriptions.join('\n\n')}`;
  }

  /**
   * 初始化所有工具
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 动态导入并注册工具
    try {
      // 知识图谱工具
      const { registerKnowledgeGraphTools } = await import('./knowledge-graph-tool');
      registerKnowledgeGraphTools(this);
      
      // 事件图谱工具
      const { registerEventGraphTools } = await import('./event-graph-tool');
      registerEventGraphTools(this);
      
      // 地理地图工具
      const { registerGeoMapTools } = await import('./geo-map-tool');
      registerGeoMapTools(this);

      this.initialized = true;
      console.log(`[ToolRegistry] Initialized with ${this.tools.size} tools`);
    } catch (error) {
      console.error('[ToolRegistry] Failed to initialize tools:', error);
      throw error;
    }
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let registryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}

export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建成功的工具结果
 */
export function createSuccessResult(
  data: any,
  summary: string,
  visualization?: ToolCallResult['visualization']
): ToolCallResult {
  return {
    success: true,
    data,
    summary,
    visualization,
  };
}

/**
 * 创建失败的工具结果
 */
export function createErrorResult(error: string, summary?: string): ToolCallResult {
  return {
    success: false,
    error,
    summary: summary || error,
  };
}

/**
 * 格式化工具调用为 LLM 可理解的格式
 */
export function formatToolCallForLLM(
  toolName: string,
  parameters: Record<string, any>,
  result: ToolCallResult
): string {
  const parts = [
    `Tool: ${toolName}`,
    `Parameters: ${JSON.stringify(parameters, null, 2)}`,
    `Result: ${result.success ? 'Success' : 'Failed'}`,
  ];

  if (result.summary) {
    parts.push(`Summary: ${result.summary}`);
  }

  if (result.error) {
    parts.push(`Error: ${result.error}`);
  }

  if (result.data) {
    parts.push(`Data: ${JSON.stringify(result.data, null, 2)}`);
  }

  return parts.join('\n');
}
