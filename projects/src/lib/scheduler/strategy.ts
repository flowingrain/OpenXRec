/**
 * 调度策略引擎
 * 
 * 实现多种调度策略：优先级调度、能力匹配、负载均衡、依赖驱动、混合策略
 */

import {
  Task,
  Agent,
  SchedulingStrategy,
  SchedulingDecision,
  AgentCapability,
  TaskStatus,
} from './types';
import { AgentPool } from './agent-pool';

/**
 * 策略引擎接口
 */
export interface ISchedulingStrategy {
  /** 选择最佳智能体 */
  selectAgent(task: Task, availableAgents: Agent[]): Agent | null;
  
  /** 获取策略名称 */
  getStrategy(): SchedulingStrategy;
  
  /** 获取策略描述 */
  getDescription(): string;
}

/**
 * 优先级调度策略
 * 简单地按优先级和创建时间分配任务
 */
export class PriorityStrategy implements ISchedulingStrategy {
  getStrategy(): SchedulingStrategy {
    return 'priority';
  }

  getDescription(): string {
    return '基于任务优先级分配智能体';
  }

  selectAgent(task: Task, availableAgents: Agent[]): Agent | null {
    if (availableAgents.length === 0) return null;
    
    // 简单地返回第一个可用智能体
    // 优先级已经在队列中处理
    return availableAgents[0];
  }
}

/**
 * 能力匹配策略
 * 选择具有最匹配能力的智能体
 */
export class CapabilityMatchStrategy implements ISchedulingStrategy {
  getStrategy(): SchedulingStrategy {
    return 'capability_match';
  }

  getDescription(): string {
    return '基于能力匹配度分配智能体';
  }

  selectAgent(task: Task, availableAgents: Agent[]): Agent | null {
    if (availableAgents.length === 0) return null;
    if (!task.requiredCapabilities || task.requiredCapabilities.length === 0) {
      return availableAgents[0];
    }

    // 计算每个智能体的能力匹配度
    const scoredAgents = availableAgents.map(agent => {
      const matchedCapabilities = task.requiredCapabilities!.filter(
        cap => agent.capabilities.includes(cap)
      );
      const matchScore = matchedCapabilities.length / task.requiredCapabilities!.length;
      const extraCapabilities = agent.capabilities.filter(
        cap => !task.requiredCapabilities!.includes(cap)
      );
      // 偏好匹配度高但不多余的智能体
      const bonusScore = 1 / (1 + extraCapabilities.length * 0.1);
      
      return {
        agent,
        score: matchScore * 0.7 + bonusScore * 0.3,
      };
    });

    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0].agent;
  }
}

/**
 * 负载均衡策略
 * 选择当前负载最低的智能体
 */
export class LoadBalanceStrategy implements ISchedulingStrategy {
  getStrategy(): SchedulingStrategy {
    return 'load_balance';
  }

  getDescription(): string {
    return '基于负载均衡分配任务';
  }

  selectAgent(task: Task, availableAgents: Agent[]): Agent | null {
    if (availableAgents.length === 0) return null;

    // 计算每个智能体的负载分数
    const scoredAgents = availableAgents.map(agent => {
      const loadScore = agent.activeTaskCount / agent.maxConcurrentTasks;
      const avgExecTime = agent.performanceMetrics.avgExecutionTime || 1;
      const recentLoad = agent.currentTaskStartedAt 
        ? (Date.now() - agent.currentTaskStartedAt) / avgExecTime 
        : 0;
      
      // 综合负载分数
      const totalLoad = (loadScore * 0.6 + Math.min(recentLoad, 1) * 0.4);
      
      return {
        agent,
        loadScore: totalLoad,
      };
    });

    // 选择负载最低的
    scoredAgents.sort((a, b) => a.loadScore - b.loadScore);
    return scoredAgents[0].agent;
  }
}

/**
 * 依赖驱动策略
 * 优先选择执行过相关任务的智能体
 */
export class DependencyBasedStrategy implements ISchedulingStrategy {
  private taskHistory: Map<string, string[]> = new Map(); // taskType -> agentIds

  getStrategy(): SchedulingStrategy {
    return 'dependency_based';
  }

  getDescription(): string {
    return '基于任务历史和依赖关系分配智能体';
  }

  selectAgent(task: Task, availableAgents: Agent[]): Agent | null {
    if (availableAgents.length === 0) return null;

    // 获取相同类型任务的执行历史
    const history = this.taskHistory.get(task.type) || [];
    
    const scoredAgents = availableAgents.map(agent => {
      const executedCount = history.filter(id => id === agent.id).length;
      const avgExecTime = agent.performanceMetrics.avgExecutionTime || 10000;
      const successRate = agent.performanceMetrics.totalTasks > 0
        ? agent.performanceMetrics.successfulTasks / agent.performanceMetrics.totalTasks
        : 1;
      
      // 综合分数：历史经验 * 成功率 / 执行时间
      const experienceScore = Math.log(1 + executedCount);
      const performanceScore = successRate * 1000 / avgExecTime;
      
      return {
        agent,
        score: experienceScore * 0.4 + performanceScore * 0.6,
      };
    });

    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0].agent;
  }

  /**
   * 记录任务执行历史
   */
  recordExecution(taskType: string, agentId: string, success: boolean): void {
    if (!this.taskHistory.has(taskType)) {
      this.taskHistory.set(taskType, []);
    }
    const history = this.taskHistory.get(taskType)!;
    
    if (success) {
      // 成功执行只保留最近的20条记录
      history.push(agentId);
      if (history.length > 20) {
        history.shift();
      }
    } else {
      // 失败则清空该类型的历史（重新学习）
      this.taskHistory.set(taskType, []);
    }
  }
}

/**
 * 混合策略
 * 综合多种策略的结果
 */
export class HybridStrategy implements ISchedulingStrategy {
  private capabilityMatch = new CapabilityMatchStrategy();
  private loadBalance = new LoadBalanceStrategy();
  private dependencyBased = new DependencyBasedStrategy();

  // 权重配置
  private weights = {
    capability: 0.3,
    loadBalance: 0.3,
    dependency: 0.4,
  };

  getStrategy(): SchedulingStrategy {
    return 'hybrid';
  }

  getDescription(): string {
    return '混合调度策略，综合能力匹配、负载均衡和依赖历史';
  }

  selectAgent(task: Task, availableAgents: Agent[]): Agent | null {
    if (availableAgents.length === 0) return null;
    if (availableAgents.length === 1) return availableAgents[0];

    // 计算每个智能体的综合分数
    const scoredAgents = availableAgents.map(agent => {
      const capabilityAgent = this.capabilityMatch.selectAgent(task, [agent]);
      const loadAgent = this.loadBalance.selectAgent(task, [agent]);
      
      let capabilityScore = 0;
      let loadBalanceScore = 0;
      let dependencyScore = 0;

      // 能力匹配分数
      if (agent.capabilities.includes(...task.requiredCapabilities || [])) {
        capabilityScore = 1;
      }

      // 负载分数（越低越好）
      loadBalanceScore = 1 - (agent.activeTaskCount / agent.maxConcurrentTasks);

      // 依赖分数
      const avgExecTime = agent.performanceMetrics.avgExecutionTime || 10000;
      const successRate = agent.performanceMetrics.totalTasks > 0
        ? agent.performanceMetrics.successfulTasks / agent.performanceMetrics.totalTasks
        : 1;
      dependencyScore = successRate * 0.5 + (1 / avgExecTime) * 1000 * 0.5;

      // 综合分数
      const totalScore = 
        capabilityScore * this.weights.capability +
        loadBalanceScore * this.weights.loadBalance +
        dependencyScore * this.weights.dependency;

      return {
        agent,
        score: totalScore,
        details: {
          capabilityScore,
          loadBalanceScore,
          dependencyScore,
        },
      };
    });

    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0].agent;
  }

  /**
   * 更新权重
   */
  updateWeights(weights: Partial<typeof this.weights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * 获取当前权重
   */
  getWeights(): typeof this.weights {
    return { ...this.weights };
  }
}

/**
 * 调度决策器
 * 使用选定的策略进行调度决策
 */
export class SchedulerDecisionMaker {
  private strategies: Map<SchedulingStrategy, ISchedulingStrategy> = new Map();
  private currentStrategy: SchedulingStrategy;

  constructor(defaultStrategy: SchedulingStrategy = 'hybrid') {
    // 注册所有策略
    this.strategies.set('priority', new PriorityStrategy());
    this.strategies.set('capability_match', new CapabilityMatchStrategy());
    this.strategies.set('load_balance', new LoadBalanceStrategy());
    this.strategies.set('dependency_based', new DependencyBasedStrategy());
    this.strategies.set('hybrid', new HybridStrategy());

    this.currentStrategy = defaultStrategy;
  }

  /**
   * 设置当前策略
   */
  setStrategy(strategy: SchedulingStrategy): void {
    if (!this.strategies.has(strategy)) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
    this.currentStrategy = strategy;
  }

  /**
   * 获取当前策略
   */
  getCurrentStrategy(): SchedulingStrategy {
    return this.currentStrategy;
  }

  /**
   * 做出调度决策
   */
  makeDecision(
    task: Task,
    availableAgents: Agent[],
    agentPool: AgentPool
  ): SchedulingDecision | null {
    const strategy = this.strategies.get(this.currentStrategy);
    if (!strategy) return null;

    const selectedAgent = strategy.selectAgent(task, availableAgents);
    if (!selectedAgent) return null;

    // 估算执行时间
    const estimatedTime = selectedAgent.performanceMetrics.avgExecutionTime || 5000;
    
    // 计算置信度
    const requiredCaps = task.requiredCapabilities || [];
    const matchedCaps = requiredCaps.filter(c => selectedAgent.capabilities.includes(c));
    const capabilityMatch = requiredCaps.length > 0 
      ? matchedCaps.length / requiredCaps.length 
      : 1;
    const loadFactor = 1 - (selectedAgent.activeTaskCount / selectedAgent.maxConcurrentTasks);
    const confidence = (capabilityMatch * 0.5 + loadFactor * 0.5) * 
      (selectedAgent.performanceMetrics.totalTasks > 0 
        ? selectedAgent.performanceMetrics.successfulTasks / selectedAgent.performanceMetrics.totalTasks
        : 0.8);

    return {
      taskId: task.id,
      assignedAgentId: selectedAgent.id,
      strategy: this.currentStrategy,
      reasoning: `${strategy.getDescription()}，选择了 ${selectedAgent.name}`,
      estimatedTime,
      confidence: Math.min(1, Math.max(0, confidence)),
    };
  }

  /**
   * 获取所有可用策略
   */
  getAvailableStrategies(): SchedulingStrategy[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 获取策略描述
   */
  getStrategyDescription(strategy: SchedulingStrategy): string {
    return this.strategies.get(strategy)?.getDescription() || '';
  }
}

/**
 * 创建调度决策器
 */
export function createSchedulerDecisionMaker(
  defaultStrategy?: SchedulingStrategy
): SchedulerDecisionMaker {
  return new SchedulerDecisionMaker(defaultStrategy);
}
