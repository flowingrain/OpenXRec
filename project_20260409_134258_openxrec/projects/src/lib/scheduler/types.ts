/**
 * 智能体调度器 - 类型定义
 * 
 * 定义调度器核心接口和类型
 */

import { LLMClient } from 'coze-coding-dev-sdk';

// ==================== 任务定义 ====================

/** 任务优先级 */
export enum TaskPriority {
  CRITICAL = 0,  // 关键任务（如因果推理）
  HIGH = 1,      // 高优先级（如排序决策）
  MEDIUM = 2,    // 中优先级（如特征提取）
  LOW = 3,       // 低优先级（如知识更新）
}

/** 任务状态 */
export enum TaskStatus {
  PENDING = 'pending',      // 等待中
  QUEUED = 'queued',        // 已入队
  ASSIGNED = 'assigned',    // 已分配
  RUNNING = 'running',      // 执行中
  COMPLETED = 'completed',  // 已完成
  FAILED = 'failed',        // 失败
  CANCELLED = 'cancelled',  // 已取消
}

/** 任务类型 */
export type TaskType = 
  | 'intent_analysis'      // 意图分析
  | 'candidate_generation' // 候选生成
  | 'feature_extraction'   // 特征提取
  | 'similarity_calculation'// 相似度计算
  | 'causal_reasoning'     // 因果推理
  | 'kg_reasoning'         // 知识图谱推理
  | 'ranking'              // 排序决策
  | 'explanation'          // 解释生成
  | 'diversity_optimize'   // 多样性优化
  | 'feedback_collect'      // 反馈收集
  | 'config_optimize';      // 配置优化

/** 任务接口 */
export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  payload: any;
  dependencies?: string[];      // 依赖的任务ID
  requiredCapabilities?: string[]; // 需要的智能体能力
  timeout?: number;              // 超时时间(ms)
  retryCount?: number;           // 重试次数
  maxRetries?: number;           // 最大重试次数
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  assignedAgentId?: string;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/** 任务创建选项 */
export interface TaskOptions {
  type: TaskType;
  priority?: TaskPriority;
  payload: any;
  dependencies?: string[];
  requiredCapabilities?: string[];
  timeout?: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

// ==================== 智能体定义 ====================

/** 智能体状态 */
export enum AgentStatus {
  IDLE = 'idle',        // 空闲
  BUSY = 'busy',        // 忙碌
  OFFLINE = 'offline',  // 离线
  ERROR = 'error',      // 错误
}

/** 智能体能力 */
export type AgentCapability = 
  | 'nlp'                // 自然语言处理
  | 'causal_inference'   // 因果推理
  | 'knowledge_graph'    // 知识图谱
  | 'search'             // 搜索
  | 'ranking'            // 排序
  | 'optimization'       // 优化
  | 'explanation'        // 解释生成
  | 'learning';          // 学习

/** 智能体接口 */
export interface Agent {
  id: string;
  name: string;
  type: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
  currentTaskId?: string;
  currentTaskStartedAt?: number;
  maxConcurrentTasks: number;
  activeTaskCount: number;
  performanceMetrics: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    avgExecutionTime: number;
    lastExecutionTime?: number;
  };
  metadata?: Record<string, any>;
}

// ==================== 调度策略 ====================

/** 调度策略类型 */
export type SchedulingStrategy = 
  | 'priority'           // 优先级调度
  | 'capability_match'  // 能力匹配
  | 'load_balance'       // 负载均衡
  | 'dependency_based'   // 依赖驱动
  | 'hybrid';           // 混合策略

/** 调度决策 */
export interface SchedulingDecision {
  taskId: string;
  assignedAgentId: string;
  strategy: SchedulingStrategy;
  reasoning: string;
  estimatedTime: number;
  confidence: number;
}

// ==================== 执行上下文 ====================

/** 执行上下文 */
export interface ExecutionContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  startTime: number;
  tasks: Map<string, Task>;
  agents: Map<string, Agent>;
  completedTasks: string[];
  failedTasks: string[];
  metadata?: Record<string, any>;
}

// ==================== 事件定义 ====================

/** 调度器事件类型 */
export type SchedulerEventType = 
  | 'task:enqueued'
  | 'task:dispatched'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:cancelled'
  | 'agent:registered'
  | 'agent:unregistered'
  | 'agent:busy'
  | 'agent:idle'
  | 'scheduler:error'
  | 'scheduler:warning';

/** 调度器事件 */
export interface SchedulerEvent {
  type: SchedulerEventType;
  timestamp: number;
  taskId?: string;
  agentId?: string;
  data?: any;
  message?: string;
}

// ==================== 调度器配置 ====================

/** 调度器配置 */
export interface SchedulerConfig {
  // 任务队列配置
  maxQueueSize: number;
  taskTimeout: number;
  defaultMaxRetries: number;
  
  // 智能体池配置
  minAgents: number;
  maxAgents: number;
  agentIdleTimeout: number;
  
  // 调度配置
  defaultStrategy: SchedulingStrategy;
  enableDependencyScheduling: boolean;
  enableLoadBalancing: boolean;
  
  // 监控配置
  enableMetrics: boolean;
  metricsInterval: number;
  
  // LLM配置（用于智能调度）
  llmClient?: LLMClient;
}

// ==================== 指标定义 ====================

/** 调度指标 */
export interface SchedulerMetrics {
  totalTasksProcessed: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByType: Record<TaskType, number>;
  avgQueueWaitTime: number;
  avgExecutionTime: number;
  agentUtilization: number;
  successRate: number;
  throughput: number; // 每秒处理任务数
  timestamp: number;
}

// ==================== 工具函数 ====================

/** 生成唯一ID */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** 生成智能体ID */
export function generateAgentId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** 任务优先级比较 */
export function compareTaskPriority(a: Task, b: Task): number {
  if (a.priority !== b.priority) {
    return a.priority - b.priority; // 数值小的优先级高
  }
  return a.createdAt - b.createdAt; // 先创建的先执行
}

/** 获取任务类型的默认超时时间 */
export function getDefaultTimeout(taskType: TaskType): number {
  const timeouts: Record<TaskType, number> = {
    intent_analysis: 5000,
    candidate_generation: 10000,
    feature_extraction: 8000,
    similarity_calculation: 5000,
    causal_reasoning: 15000,
    kg_reasoning: 10000,
    ranking: 5000,
    explanation: 8000,
    diversity_optimize: 5000,
    feedback_collect: 3000,
    config_optimize: 20000,
  };
  return timeouts[taskType] || 10000;
}

/** 获取任务类型需要的智能体能力 */
export function getRequiredCapabilities(taskType: TaskType): AgentCapability[] {
  const capabilities: Record<TaskType, AgentCapability[]> = {
    intent_analysis: ['nlp'],
    candidate_generation: ['nlp', 'search'],
    feature_extraction: ['nlp'],
    similarity_calculation: ['nlp'],
    causal_reasoning: ['causal_inference', 'nlp'],
    kg_reasoning: ['knowledge_graph', 'nlp'],
    ranking: ['ranking', 'optimization'],
    explanation: ['explanation', 'nlp'],
    diversity_optimize: ['optimization'],
    feedback_collect: ['learning'],
    config_optimize: ['optimization', 'learning'],
  };
  return capabilities[taskType] || ['nlp'];
}
