/**
 * 工具基础类型定义
 * 
 * 定义可被 LLM 调用的工具接口
 */

// ============================================================================
// 核心类型
// ============================================================================

/**
 * 工具参数定义（JSON Schema 格式）
 */
export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  items?: ToolParameterSchema;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
  default?: any;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具唯一标识 */
  name: string;
  /** 工具显示名称 */
  displayName: string;
  /** 工具描述（LLM 用于判断是否调用） */
  description: string;
  /** 参数定义 */
  parameters: Record<string, ToolParameterSchema>;
  /** 必需参数 */
  required?: string[];
  /** 工具类别 */
  category: 'knowledge' | 'event' | 'geo' | 'analysis' | 'search' | 'other';
  /** 是否需要 LLM 后处理 */
  needsPostProcess?: boolean;
  /** 示例用法 */
  examples?: {
    scenario: string;
    parameters: Record<string, any>;
    expectedOutput: string;
  }[];
}

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  /** 工具名称 */
  name: string;
  /** 调用参数 */
  parameters: Record<string, any>;
  /** 调用ID（用于追踪） */
  callId: string;
  /** 上下文信息 */
  context?: {
    userId?: string;
    sessionId?: string;
    query?: string;
  };
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
  /** 结果描述（用于 LLM 理解） */
  summary?: string;
  /** 可视化数据 */
  visualization?: {
    type: 'knowledge_graph' | 'event_graph' | 'map' | 'chart' | 'table' | 'text';
    data: any;
  };
  /** 调用耗时（毫秒） */
  duration?: number;
}

/**
 * 工具执行器函数类型
 */
export type ToolExecutor = (request: ToolCallRequest) => Promise<ToolCallResult>;

/**
 * 注册的工具
 */
export interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
}

// ============================================================================
// 工具装饰器
// ============================================================================

/**
 * 工具结果装饰器
 */
export interface ToolResultDecorator {
  /** 格式化为自然语言 */
  toNaturalLanguage: (result: ToolCallResult) => string;
  /** 格式化为 Markdown */
  toMarkdown: (result: ToolCallResult) => string;
}

// ============================================================================
// 工具上下文
// ============================================================================

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  /** 当前用户ID */
  userId?: string;
  /** 会话ID */
  sessionId?: string;
  /** 原始查询 */
  originalQuery: string;
  /** 之前的工具调用结果 */
  previousResults?: Map<string, ToolCallResult>;
  /** 额外配置 */
  config?: Record<string, any>;
}

// ============================================================================
// 预定义的工具类别
// ============================================================================

export const TOOL_CATEGORIES = {
  knowledge: {
    name: '知识图谱',
    description: '知识图谱相关的查询和操作',
    icon: 'Network',
  },
  event: {
    name: '事件图谱',
    description: '事件因果链分析和可视化',
    icon: 'GitBranch',
  },
  geo: {
    name: '地理位置',
    description: '地理位置和地图相关操作',
    icon: 'MapPin',
  },
  analysis: {
    name: '分析工具',
    description: '数据分析和推理工具',
    icon: 'BarChart3',
  },
  search: {
    name: '搜索工具',
    description: '信息检索和搜索工具',
    icon: 'Search',
  },
  other: {
    name: '其他工具',
    description: '其他辅助工具',
    icon: 'Wrench',
  },
} as const;
