/**
 * 智能体调度器模块
 * 
 * 导出所有调度器相关的接口和实现
 */

// 类型导出
export {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskOptions,
  Agent,
  AgentStatus,
  AgentCapability,
  SchedulingStrategy,
  SchedulingDecision,
  ExecutionContext,
  SchedulerEvent,
  SchedulerEventType,
  SchedulerConfig,
  SchedulerMetrics,
  generateTaskId,
  generateAgentId,
  compareTaskPriority,
  getDefaultTimeout,
  getRequiredCapabilities,
} from './types';

// 任务队列
export { TaskQueue, createTaskQueue, ITaskQueue } from './task-queue';

// 智能体池
export { AgentPool, createAgentPool, IAgentPool, PREDEFINED_AGENTS } from './agent-pool';

// 调度策略
export {
  ISchedulingStrategy,
  PriorityStrategy,
  CapabilityMatchStrategy,
  LoadBalanceStrategy,
  DependencyBasedStrategy,
  HybridStrategy,
  SchedulerDecisionMaker,
  createSchedulerDecisionMaker,
} from './strategy';

// 调度器
export { AgentScheduler, createScheduler, getScheduler, resetScheduler, IScheduler } from './scheduler';

// 推荐系统集成
export {
  createRecommendationTaskExecutor,
  createRecommendationScheduler,
  createSchedulerEventListeners,
  runRecommendationWorkflow,
} from './recommendation-integration';
