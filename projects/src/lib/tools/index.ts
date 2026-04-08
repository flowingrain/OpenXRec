/**
 * 工具系统入口
 * 
 * 导出所有工具相关的类型、函数和工具
 */

// 类型定义
export type {
  ToolDefinition,
  ToolParameterSchema,
  ToolCallRequest,
  ToolCallResult,
  RegisteredTool,
  ToolExecutor,
  ToolExecutionContext,
  ToolResultDecorator,
} from './types';

export { TOOL_CATEGORIES } from './types';

// 注册表
export {
  getToolRegistry,
  createToolRegistry,
  createSuccessResult,
  createErrorResult,
  formatToolCallForLLM,
} from './registry';

// 工具注册函数
export { registerKnowledgeGraphTools } from './knowledge-graph-tool';
export { registerEventGraphTools } from './event-graph-tool';
export { registerGeoMapTools } from './geo-map-tool';

// 导入需要的函数用于内部使用
import { getToolRegistry as getRegistry } from './registry';
import type { ToolDefinition, ToolCallResult } from './types';

// 工具初始化
export async function initializeTools(): Promise<void> {
  const registry = getRegistry();
  await registry.initialize();
}

// 获取工具列表（供 LLM 使用）
export function getAvailableTools(): ToolDefinition[] {
  const registry = getRegistry();
  return registry.getAllDefinitions();
}

// 执行工具
export async function executeTool(
  name: string,
  parameters: Record<string, unknown>,
  context?: { userId?: string; sessionId?: string; query?: string }
): Promise<ToolCallResult> {
  const registry = getRegistry();
  
  // 确保工具已初始化
  await registry.initialize();
  
  return registry.execute({
    name,
    parameters,
    callId: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    context,
  });
}
