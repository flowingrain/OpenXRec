/**
 * 智能体调度器模块
 * 
 * 导出所有调度器相关的接口和实现
 */

// 类型导出 - 使用 export type 处理接口和类型别名
export type {
  Task,
  TaskOptions,
  TaskType,
  ExecutionContext,
  SchedulerEvent,
  SchedulerEventType,
  SchedulerConfig,
  SchedulerMetrics,
  Agent,
  AgentCapability,
  SchedulingStrategy,
  SchedulingDecision,
} from './types';

// 枚举导出 - enum 可以直接导出
export { TaskPriority, TaskStatus, AgentStatus } from './types';

// 函数导出 - 普通函数直接导出
export { 
  generateTaskId, 
  generateAgentId, 
  compareTaskPriority, 
  getDefaultTimeout, 
  getRequiredCapabilities, 
} from './types';

// 任务队列
export { TaskQueue, createTaskQueue } from './task-queue';
export type { ITaskQueue } from './task-queue';

// 智能体池
export { AgentPool, createAgentPool, PREDEFINED_AGENTS } from './agent-pool';
export type { IAgentPool } from './agent-pool';

// 调度策略
export {
  PriorityStrategy,
  CapabilityMatchStrategy,
  LoadBalanceStrategy,
  DependencyBasedStrategy,
  HybridStrategy,
  SchedulerDecisionMaker,
  createSchedulerDecisionMaker,
} from './strategy';
export type { ISchedulingStrategy } from './strategy';

// 调度器
export { AgentScheduler, createScheduler, getScheduler, resetScheduler } from './scheduler';
export type { IScheduler } from './scheduler';

// 推荐系统集成
export {
  createRecommendationTaskExecutor,
  createRecommendationScheduler,
  createSchedulerEventListeners,
  runRecommendationWorkflow,
} from './recommendation-integration';
