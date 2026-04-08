/**
 * 任务队列管理器
 * 
 * 负责管理任务的入队、出队、优先级排序、依赖管理
 */

import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskOptions,
  TaskType,
  generateTaskId,
  compareTaskPriority,
  getDefaultTimeout,
  getRequiredCapabilities,
} from './types';

/**
 * 任务队列接口
 */
export interface ITaskQueue {
  /** 入队 */
  enqueue(options: TaskOptions): Task;
  
  /** 出队（获取最高优先级任务） */
  dequeue(): Task | null;
  
  /** 获取任务 */
  get(taskId: string): Task | undefined;
  
  /** 更新任务状态 */
  updateStatus(taskId: string, status: TaskStatus, result?: any, error?: string): void;
  
  /** 获取可执行任务（依赖已满足） */
  getExecutableTasks(): Task[];
  
  /** 获取队列大小 */
  size(): number;
  
  /** 清空队列 */
  clear(): void;
  
  /** 取消任务 */
  cancel(taskId: string): boolean;
  
  /** 获取等待中的任务 */
  getPendingTasks(): Task[];
  
  /** 获取运行中的任务 */
  getRunningTasks(): Task[];
  
  /** 获取已完成的任务 */
  getCompletedTasks(): Task[];
}

/**
 * 任务队列实现
 */
export class TaskQueue implements ITaskQueue {
  private tasks: Map<string, Task> = new Map();
  private priorityQueue: string[] = []; // 按优先级排序的任务ID
  private maxQueueSize: number;
  private defaultTimeout: number;
  private defaultMaxRetries: number;
  private completedTasks: Map<string, Task> = new Map(); // 保留已完成任务记录

  constructor(config: {
    maxQueueSize?: number;
    taskTimeout?: number;
    defaultMaxRetries?: number;
  } = {}) {
    this.maxQueueSize = config.maxQueueSize || 1000;
    this.defaultTimeout = config.taskTimeout || 30000;
    this.defaultMaxRetries = config.defaultMaxRetries || 3;
  }

  /**
   * 入队
   */
  enqueue(options: TaskOptions): Task {
    // 检查队列大小
    if (this.tasks.size >= this.maxQueueSize) {
      throw new Error(`Task queue is full (max: ${this.maxQueueSize})`);
    }

    const task: Task = {
      id: generateTaskId(),
      type: options.type,
      priority: options.priority ?? TaskPriority.MEDIUM,
      payload: options.payload,
      dependencies: options.dependencies || [],
      requiredCapabilities: options.requiredCapabilities || getRequiredCapabilities(options.type),
      timeout: options.timeout || getDefaultTimeout(options.type),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.defaultMaxRetries,
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
      metadata: options.metadata,
    };

    this.tasks.set(task.id, task);
    this.rebuildPriorityQueue();
    
    return task;
  }

  /**
   * 出队
   */
  dequeue(): Task | null {
    // 找到第一个可执行的任务
    for (const taskId of this.priorityQueue) {
      const task = this.tasks.get(taskId);
      if (task && task.status === TaskStatus.QUEUED && this.areDependenciesMet(task)) {
        task.status = TaskStatus.ASSIGNED;
        task.assignedAgentId = undefined; // 由调度器分配
        this.rebuildPriorityQueue();
        return task;
      }
    }
    return null;
  }

  /**
   * 获取任务
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 更新任务状态
   */
  updateStatus(taskId: string, status: TaskStatus, result?: any, error?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = status;
    
    switch (status) {
      case TaskStatus.RUNNING:
        task.startedAt = Date.now();
        break;
      case TaskStatus.COMPLETED:
        task.completedAt = Date.now();
        task.result = result;
        this.completedTasks.set(taskId, task);
        break;
      case TaskStatus.FAILED:
        task.completedAt = Date.now();
        task.error = error;
        task.retryCount = (task.retryCount || 0) + 1;
        break;
      case TaskStatus.QUEUED:
        // 任务重新入队（重试）
        this.rebuildPriorityQueue();
        break;
    }
  }

  /**
   * 获取可执行任务
   */
  getExecutableTasks(): Task[] {
    const executable: Task[] = [];
    for (const task of this.tasks.values()) {
      if (task.status === TaskStatus.QUEUED && this.areDependenciesMet(task)) {
        executable.push(task);
      }
    }
    return executable.sort(compareTaskPriority);
  }

  /**
   * 获取队列大小
   */
  size(): number {
    return this.tasks.size;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.tasks.clear();
    this.priorityQueue = [];
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.status === TaskStatus.RUNNING) {
      // 运行中的任务不能直接取消
      return false;
    }
    
    task.status = TaskStatus.CANCELLED;
    task.completedAt = Date.now();
    this.rebuildPriorityQueue();
    return true;
  }

  /**
   * 获取等待中的任务
   */
  getPendingTasks(): Task[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.QUEUED);
  }

  /**
   * 获取运行中的任务
   */
  getRunningTasks(): Task[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === TaskStatus.RUNNING || t.status === TaskStatus.ASSIGNED);
  }

  /**
   * 获取已完成的任务
   */
  getCompletedTasks(): Task[] {
    return Array.from(this.completedTasks.values());
  }

  /**
   * 检查依赖是否满足
   */
  private areDependenciesMet(task: Task): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (!depTask) {
        console.warn(`[TaskQueue] Dependency task not found: ${depId}`);
        return false;
      }
      if (depTask.status !== TaskStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }

  /**
   * 重建优先级队列
   */
  private rebuildPriorityQueue(): void {
    this.priorityQueue = Array.from(this.tasks.values())
      .filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.QUEUED)
      .sort(compareTaskPriority)
      .map(t => t.id);
  }

  /**
   * 获取任务统计
   */
  getStats(): {
    total: number;
    pending: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case TaskStatus.PENDING:
          stats.pending++;
          break;
        case TaskStatus.QUEUED:
          stats.queued++;
          break;
        case TaskStatus.RUNNING:
        case TaskStatus.ASSIGNED:
          stats.running++;
          break;
        case TaskStatus.COMPLETED:
          stats.completed++;
          break;
        case TaskStatus.FAILED:
          stats.failed++;
          break;
      }
    }

    return stats;
  }
}

/**
 * 创建任务队列
 */
export function createTaskQueue(config?: {
  maxQueueSize?: number;
  taskTimeout?: number;
  defaultMaxRetries?: number;
}): TaskQueue {
  return new TaskQueue(config);
}
