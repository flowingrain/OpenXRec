/**
 * 智能体调度器 - 主执行器
 * 
 * 整合任务队列、智能体池、调度策略，实现完整的任务调度
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskOptions,
  TaskPriority,
  SchedulerConfig,
  SchedulerMetrics,
  SchedulerEvent,
  SchedulerEventType,
  ExecutionContext,
  SchedulingDecision,
  AgentCapability,
  getRequiredCapabilities,
} from './types';
import { TaskQueue, createTaskQueue } from './task-queue';
import { AgentPool, createAgentPool } from './agent-pool';
import { SchedulerDecisionMaker, createSchedulerDecisionMaker } from './strategy';

/**
 * 事件监听器类型
 */
type EventListener = (event: SchedulerEvent) => void;

/**
 * 任务执行器类型
 */
type TaskExecutor = (task: Task, agentId: string) => Promise<any>;

/**
 * 智能体调度器接口
 */
export interface IScheduler {
  // 生命周期
  start(): void;
  stop(): void;
  
  // 任务管理
  enqueue(options: TaskOptions): Task;
  enqueueBatch(options: TaskOptions[]): Task[];
  cancel(taskId: string): boolean;
  
  // 查询
  getTask(taskId: string): Task | undefined;
  getAgent(agentId: string): any;
  getMetrics(): SchedulerMetrics;
  getContext(): ExecutionContext;
  
  // 事件
  on(event: SchedulerEventType, listener: EventListener): void;
  off(event: SchedulerEventType, listener: EventListener): void;
  
  // 策略
  setStrategy(strategy: any): void;
}

/**
 * 智能体调度器实现
 */
export class AgentScheduler implements IScheduler {
  private config: SchedulerConfig;
  private taskQueue: TaskQueue;
  private agentPool: AgentPool;
  private decisionMaker: SchedulerDecisionMaker;
  
  private isRunning: boolean = false;
  private dispatchInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  private eventListeners: Map<SchedulerEventType, Set<EventListener>> = new Map();
  private taskExecutor?: TaskExecutor;
  private llmClient?: LLMClient;
  
  private requestIdCounter: number = 0;
  private currentRequestId?: string;

  // 指标
  private metrics: SchedulerMetrics = {
    totalTasksProcessed: 0,
    tasksByStatus: {
      [TaskStatus.PENDING]: 0,
      [TaskStatus.QUEUED]: 0,
      [TaskStatus.ASSIGNED]: 0,
      [TaskStatus.RUNNING]: 0,
      [TaskStatus.COMPLETED]: 0,
      [TaskStatus.FAILED]: 0,
      [TaskStatus.CANCELLED]: 0,
    },
    tasksByType: {} as any,
    avgQueueWaitTime: 0,
    avgExecutionTime: 0,
    agentUtilization: 0,
    successRate: 0,
    throughput: 0,
    timestamp: Date.now(),
  };

  private executionTimes: number[] = [];
  private queueWaitTimes: Map<string, number> = new Map();

  constructor(
    config: Partial<SchedulerConfig> = {},
    taskExecutor?: TaskExecutor
  ) {
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      taskTimeout: config.taskTimeout || 30000,
      defaultMaxRetries: config.defaultMaxRetries || 3,
      minAgents: config.minAgents || 1,
      maxAgents: config.maxAgents || 10,
      agentIdleTimeout: config.agentIdleTimeout || 60000,
      defaultStrategy: config.defaultStrategy || 'hybrid',
      enableDependencyScheduling: config.enableDependencyScheduling ?? true,
      enableLoadBalancing: config.enableLoadBalancing ?? true,
      enableMetrics: config.enableMetrics ?? true,
      metricsInterval: config.metricsInterval || 10000,
      llmClient: config.llmClient,
    };

    this.taskQueue = createTaskQueue({
      maxQueueSize: this.config.maxQueueSize,
      taskTimeout: this.config.taskTimeout,
      defaultMaxRetries: this.config.defaultMaxRetries,
    });

    this.agentPool = createAgentPool();
    this.decisionMaker = createSchedulerDecisionMaker(this.config.defaultStrategy);
    this.taskExecutor = taskExecutor;
    this.llmClient = config.llmClient;
  }

  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[AgentScheduler] Started');
    
    // 启动调度循环
    this.dispatchInterval = setInterval(() => {
      this.dispatch();
    }, 100); // 每100ms检查一次

    // 启动指标收集
    if (this.config.enableMetrics) {
      this.metricsInterval = setInterval(() => {
        this.collectMetrics();
      }, this.config.metricsInterval);
    }

    // 启动超时检查
    setInterval(() => {
      this.checkTimeouts();
    }, 5000);
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.dispatchInterval) {
      clearInterval(this.dispatchInterval);
      this.dispatchInterval = null;
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    console.log('[AgentScheduler] Stopped');
  }

  /**
   * 入队任务
   */
  enqueue(options: TaskOptions): Task {
    const task = this.taskQueue.enqueue(options);
    
    // 记录入队时间
    this.queueWaitTimes.set(task.id, Date.now());
    
    // 触发事件
    this.emit('task:enqueued', {
      type: 'task:enqueued',
      timestamp: Date.now(),
      taskId: task.id,
      data: { task },
    });
    
    return task;
  }

  /**
   * 批量入队
   */
  enqueueBatch(options: TaskOptions[]): Task[] {
    return options.map(opt => this.enqueue(opt));
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    const result = this.taskQueue.cancel(taskId);
    if (result) {
      this.emit('task:cancelled', {
        type: 'task:cancelled',
        timestamp: Date.now(),
        taskId,
      });
    }
    return result;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    return this.taskQueue.get(taskId);
  }

  /**
   * 获取智能体
   */
  getAgent(agentId: string): any {
    return this.agentPool.get(agentId);
  }

  /**
   * 获取指标
   */
  getMetrics(): SchedulerMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取执行上下文
   */
  getContext(): ExecutionContext {
    return {
      requestId: this.currentRequestId || '',
      startTime: Date.now(),
      tasks: new Map(this.taskQueue['tasks']),
      agents: new Map(this.agentPool['agents']),
      completedTasks: this.taskQueue.getCompletedTasks().map(t => t.id),
      failedTasks: Array.from(this.taskQueue['tasks'].values())
        .filter(t => t.status === TaskStatus.FAILED)
        .map(t => t.id),
    };
  }

  /**
   * 监听事件
   */
  on(event: SchedulerEventType, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * 取消监听
   */
  off(event: SchedulerEventType, listener: EventListener): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * 设置调度策略
   */
  setStrategy(strategy: any): void {
    this.decisionMaker.setStrategy(strategy);
  }

  /**
   * 设置任务执行器
   */
  setTaskExecutor(executor: TaskExecutor): void {
    this.taskExecutor = executor;
  }

  /**
   * 创建推荐工作流
   */
  createRecommendationWorkflow(userId: string, query: string): string {
    const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;
    this.currentRequestId = requestId;

    // 1. 创建意图分析任务
    const intentTask = this.enqueue({
      type: 'intent_analysis',
      priority: TaskPriority.HIGH,
      payload: { userId, query },
      metadata: { requestId },
    });

    // 2. 创建候选生成任务（依赖意图分析）
    const candidateTask = this.enqueue({
      type: 'candidate_generation',
      priority: TaskPriority.MEDIUM,
      payload: { userId, query },
      dependencies: [intentTask.id],
      metadata: { requestId },
    });

    // 3. 创建特征提取任务（依赖候选生成）
    const featureTask = this.enqueue({
      type: 'feature_extraction',
      priority: TaskPriority.MEDIUM,
      payload: { userId },
      dependencies: [candidateTask.id],
      metadata: { requestId },
    });

    // 4. 创建相似度计算任务
    const similarityTask = this.enqueue({
      type: 'similarity_calculation',
      priority: TaskPriority.MEDIUM,
      payload: { userId },
      dependencies: [featureTask.id],
      metadata: { requestId },
    });

    // 5. 创建因果推理任务
    const causalTask = this.enqueue({
      type: 'causal_reasoning',
      priority: TaskPriority.HIGH,
      payload: { query },
      dependencies: [candidateTask.id],
      metadata: { requestId },
    });

    // 6. 创建排序任务
    const rankingTask = this.enqueue({
      type: 'ranking',
      priority: TaskPriority.HIGH,
      payload: { userId },
      dependencies: [similarityTask.id, causalTask.id],
      metadata: { requestId },
    });

    // 7. 创建解释生成任务
    const explanationTask = this.enqueue({
      type: 'explanation',
      priority: TaskPriority.MEDIUM,
      payload: { query },
      dependencies: [rankingTask.id],
      metadata: { requestId },
    });

    // 8. 创建多样性优化任务
    const diversityTask = this.enqueue({
      type: 'diversity_optimize',
      priority: TaskPriority.LOW,
      payload: {},
      dependencies: [explanationTask.id],
      metadata: { requestId },
    });

    return requestId;
  }

  // ==================== 私有方法 ====================

  /**
   * 调度任务
   */
  private dispatch(): void {
    if (!this.isRunning) return;

    const executableTasks = this.taskQueue.getExecutableTasks();
    
    for (const task of executableTasks) {
      // 获取可执行任务的智能体
      const requiredCaps = task.requiredCapabilities || getRequiredCapabilities(task.type);
      const availableAgents = this.agentPool.getAvailableAgents(
        requiredCaps as AgentCapability[]
      );

      if (availableAgents.length === 0) {
        // 没有可用智能体，跳过
        continue;
      }

      // 做出调度决策
      const decision = this.decisionMaker.makeDecision(task, availableAgents, this.agentPool);
      
      if (!decision) {
        continue;
      }

      // 分配任务
      this.assignTask(task, decision);
    }
  }

  /**
   * 分配任务给智能体
   */
  private async assignTask(task: Task, decision: SchedulingDecision): Promise<void> {
    const agent = this.agentPool.get(decision.assignedAgentId);
    if (!agent) return;

    // 更新任务状态
    this.taskQueue.updateStatus(task.id, TaskStatus.ASSIGNED, undefined, undefined);
    task.assignedAgentId = decision.assignedAgentId;
    
    // 分配给智能体
    this.agentPool.assignTask(decision.assignedAgentId, task.id);

    // 更新队列等待时间
    const waitTime = Date.now() - (this.queueWaitTimes.get(task.id) || task.createdAt);
    this.executionTimes.push(waitTime);
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }

    // 触发事件
    this.emit('task:dispatched', {
      type: 'task:dispatched',
      timestamp: Date.now(),
      taskId: task.id,
      agentId: decision.assignedAgentId,
      data: { decision },
    });

    // 更新任务状态为运行中
    this.taskQueue.updateStatus(task.id, TaskStatus.RUNNING);
    
    this.emit('task:started', {
      type: 'task:started',
      timestamp: Date.now(),
      taskId: task.id,
      agentId: decision.assignedAgentId,
    });

    // 执行任务
    this.executeTask(task, decision.assignedAgentId);
  }

  /**
   * 执行任务
   */
  private async executeTask(task: Task, agentId: string): Promise<void> {
    const startTime = Date.now();

    try {
      let result: any;

      if (this.taskExecutor) {
        // 使用自定义执行器
        result = await this.taskExecutor(task, agentId);
      } else {
        // 使用默认执行逻辑（这里可以集成实际的智能体执行）
        result = await this.defaultTaskExecutor(task);
      }

      // 任务成功
      const executionTime = Date.now() - startTime;
      this.taskQueue.updateStatus(task.id, TaskStatus.COMPLETED, result);
      this.agentPool.completeTask(agentId, true, executionTime);
      
      this.metrics.totalTasksProcessed++;
      this.metrics.tasksByStatus[TaskStatus.COMPLETED]++;
      this.metrics.tasksByType[task.type] = (this.metrics.tasksByType[task.type] || 0) + 1;

      this.emit('task:completed', {
        type: 'task:completed',
        timestamp: Date.now(),
        taskId: task.id,
        agentId,
        data: { result, executionTime },
      });

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      // 检查是否需要重试
      const shouldRetry = (task.retryCount || 0) < (task.maxRetries || 3);
      
      if (shouldRetry) {
        // 重新入队
        this.taskQueue.updateStatus(task.id, TaskStatus.QUEUED);
        this.agentPool.completeTask(agentId, false, executionTime);
        
        console.log(`[AgentScheduler] Task ${task.id} failed, retrying...`);
      } else {
        // 标记失败
        this.taskQueue.updateStatus(task.id, TaskStatus.FAILED, undefined, error.message);
        this.agentPool.completeTask(agentId, false, executionTime);
        
        this.metrics.tasksByStatus[TaskStatus.FAILED]++;
        
        this.emit('task:failed', {
          type: 'task:failed',
          timestamp: Date.now(),
          taskId: task.id,
          agentId,
          data: { error: error.message },
        });
      }
    }
  }

  /**
   * 默认任务执行器
   */
  private async defaultTaskExecutor(task: Task): Promise<any> {
    // 这里可以调用实际的智能体逻辑
    // 暂时返回模拟结果
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      taskId: task.id,
      type: task.type,
      status: 'completed',
      timestamp: Date.now(),
    };
  }

  /**
   * 检查超时任务
   */
  private checkTimeouts(): void {
    const now = Date.now();
    
    for (const task of this.taskQueue.getRunningTasks()) {
      if (task.startedAt && task.timeout) {
        const elapsed = now - task.startedAt;
        if (elapsed > task.timeout) {
          console.warn(`[AgentScheduler] Task ${task.id} timed out`);
          
          // 取消任务
          this.taskQueue.updateStatus(
            task.id, 
            TaskStatus.FAILED, 
            undefined, 
            `Task timeout after ${task.timeout}ms`
          );
          
          if (task.assignedAgentId) {
            this.agentPool.completeTask(task.assignedAgentId, false, elapsed);
          }
          
          this.emit('task:failed', {
            type: 'task:failed',
            timestamp: now,
            taskId: task.id,
            agentId: task.assignedAgentId,
            data: { error: 'Task timeout' },
          });
        }
      }
    }
  }

  /**
   * 收集指标
   */
  private collectMetrics(): void {
    const agentStats = this.agentPool.getStats();
    const queueStats = this.taskQueue.getStats();

    // 计算平均等待时间
    if (this.executionTimes.length > 0) {
      this.metrics.avgQueueWaitTime = 
        this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length;
    }

    // 计算成功率
    const total = this.metrics.tasksByStatus[TaskStatus.COMPLETED] + 
                  this.metrics.tasksByStatus[TaskStatus.FAILED];
    this.metrics.successRate = total > 0 
      ? this.metrics.tasksByStatus[TaskStatus.COMPLETED] / total 
      : 0;

    // 智能体利用率
    this.metrics.agentUtilization = agentStats.avgUtilization;

    // 吞吐量（每秒任务数）
    const elapsed = (Date.now() - this.metrics.timestamp) / 1000;
    this.metrics.throughput = elapsed > 0 
      ? this.metrics.totalTasksProcessed / elapsed 
      : 0;

    this.metrics.timestamp = Date.now();
  }

  /**
   * 触发事件
   */
  private emit(type: SchedulerEventType, event: SchedulerEvent): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('[AgentScheduler] Event listener error:', error);
        }
      }
    }
  }
}

/**
 * 创建智能体调度器
 */
export function createScheduler(
  config?: Partial<SchedulerConfig>,
  taskExecutor?: TaskExecutor
): AgentScheduler {
  return new AgentScheduler(config, taskExecutor);
}

/**
 * 单例调度器
 */
let schedulerInstance: AgentScheduler | null = null;

export function getScheduler(): AgentScheduler {
  if (!schedulerInstance) {
    schedulerInstance = createScheduler();
    schedulerInstance.start();
  }
  return schedulerInstance;
}

export function resetScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance = null;
  }
}
