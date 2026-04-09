/**
 * 智能体池管理器
 * 
 * 负责管理智能体的注册、注销、状态监控、负载均衡
 */

import {
  Agent,
  AgentStatus,
  AgentCapability,
  generateAgentId,
} from './types';

/**
 * 预定义的智能体类型
 */
export const PREDEFINED_AGENTS: Omit<Agent, 'id' | 'status' | 'currentTaskId' | 'currentTaskStartedAt'>[] = [
  // 意图分析智能体
  {
    name: 'Intent Analyzer Agent',
    type: 'intent_analyzer',
    capabilities: ['nlp'],
    maxConcurrentTasks: 2,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 候选生成智能体
  {
    name: 'Candidate Generator Agent',
    type: 'candidate_generator',
    capabilities: ['nlp', 'search'],
    maxConcurrentTasks: 3,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 特征提取智能体
  {
    name: 'Feature Extractor Agent',
    type: 'feature_extractor',
    capabilities: ['nlp'],
    maxConcurrentTasks: 2,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 相似度计算智能体
  {
    name: 'Similarity Calculator Agent',
    type: 'similarity_calculator',
    capabilities: ['nlp'],
    maxConcurrentTasks: 2,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 因果推理智能体
  {
    name: 'Causal Reasoning Agent',
    type: 'causal_reasoner',
    capabilities: ['causal_inference', 'nlp'],
    maxConcurrentTasks: 1,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 知识图谱推理智能体
  {
    name: 'Knowledge Graph Agent',
    type: 'kg_reasoner',
    capabilities: ['knowledge_graph', 'nlp'],
    maxConcurrentTasks: 1,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 排序智能体
  {
    name: 'Ranking Agent',
    type: 'ranking_agent',
    capabilities: ['ranking', 'optimization'],
    maxConcurrentTasks: 1,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 解释生成智能体
  {
    name: 'Explanation Agent',
    type: 'explanation_agent',
    capabilities: ['explanation', 'nlp'],
    maxConcurrentTasks: 2,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 多样性优化智能体
  {
    name: 'Diversity Optimizer Agent',
    type: 'diversity_optimizer',
    capabilities: ['optimization'],
    maxConcurrentTasks: 1,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
  // 配置优化智能体
  {
    name: 'Config Optimizer Agent',
    type: 'config_optimizer',
    capabilities: ['optimization', 'learning'],
    maxConcurrentTasks: 1,
    activeTaskCount: 0,
    performanceMetrics: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      avgExecutionTime: 0,
    },
  },
];

/**
 * 智能体池接口
 */
export interface IAgentPool {
  /** 注册智能体 */
  register(agent: Omit<Agent, 'id' | 'status'>): Agent;
  
  /** 注销智能体 */
  unregister(agentId: string): boolean;
  
  /** 获取智能体 */
  get(agentId: string): Agent | undefined;
  
  /** 获取所有智能体 */
  getAll(): Agent[];
  
  /** 获取特定类型的智能体 */
  getByType(type: string): Agent[];
  
  /** 获取具有特定能力的智能体 */
  getByCapabilities(capabilities: AgentCapability[]): Agent[];
  
  /** 获取空闲的智能体 */
  getIdleAgents(): Agent[];
  
  /** 获取可执行任务的智能体 */
  getAvailableAgents(requiredCapabilities: AgentCapability[]): Agent[];
  
  /** 分配任务给智能体 */
  assignTask(agentId: string, taskId: string): void;
  
  /** 完成任务 */
  completeTask(agentId: string, success: boolean, executionTime: number): void;
  
  /** 更新智能体状态 */
  updateStatus(agentId: string, status: AgentStatus): void;
  
  /** 获取最佳智能体（负载均衡） */
  getBestAgent(requiredCapabilities: AgentCapability[]): Agent | null;
}

/**
 * 智能体池实现
 */
export class AgentPool implements IAgentPool {
  private agents: Map<string, Agent> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private capabilityIndex: Map<AgentCapability, Set<string>> = new Map();

  constructor(initialAgents?: Agent[]) {
    // 初始化预定义智能体
    if (initialAgents) {
      for (const agent of initialAgents) {
        this.register(agent);
      }
    } else {
      // 使用预定义智能体
      for (const agentConfig of PREDEFINED_AGENTS) {
        this.register(agentConfig);
      }
    }
  }

  /**
   * 注册智能体
   */
  register(agentConfig: Omit<Agent, 'id' | 'status'>): Agent {
    const agent: Agent = {
      ...agentConfig,
      id: generateAgentId(),
      status: AgentStatus.IDLE,
    };

    this.agents.set(agent.id, agent);

    // 更新类型索引
    if (!this.typeIndex.has(agent.type)) {
      this.typeIndex.set(agent.type, new Set());
    }
    this.typeIndex.get(agent.type)!.add(agent.id);

    // 更新能力索引
    for (const capability of agent.capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(agent.id);
    }

    return agent;
  }

  /**
   * 注销智能体
   */
  unregister(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // 从索引中移除
    this.typeIndex.get(agent.type)?.delete(agentId);
    for (const capability of agent.capabilities) {
      this.capabilityIndex.get(capability)?.delete(agentId);
    }

    // 移除智能体
    this.agents.delete(agentId);
    return true;
  }

  /**
   * 获取智能体
   */
  get(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 获取所有智能体
   */
  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取特定类型的智能体
   */
  getByType(type: string): Agent[] {
    const agentIds = this.typeIndex.get(type);
    if (!agentIds) return [];
    return Array.from(agentIds).map(id => this.agents.get(id)!).filter(Boolean);
  }

  /**
   * 获取具有特定能力的智能体
   */
  getByCapabilities(capabilities: AgentCapability[]): Agent[] {
    if (capabilities.length === 0) return this.getIdleAgents();

    // 找到拥有所有必需能力的智能体
    const matchingAgents: Agent[] = [];
    for (const agent of this.agents.values()) {
      if (capabilities.every(cap => agent.capabilities.includes(cap))) {
        matchingAgents.push(agent);
      }
    }
    return matchingAgents;
  }

  /**
   * 获取空闲的智能体
   */
  getIdleAgents(): Agent[] {
    return Array.from(this.agents.values())
      .filter(a => a.status === AgentStatus.IDLE);
  }

  /**
   * 获取可执行任务的智能体
   */
  getAvailableAgents(requiredCapabilities: AgentCapability[]): Agent[] {
    return this.getByCapabilities(requiredCapabilities)
      .filter(a => 
        a.status === AgentStatus.IDLE && 
        a.activeTaskCount < a.maxConcurrentTasks
      );
  }

  /**
   * 分配任务给智能体
   */
  assignTask(agentId: string, taskId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.currentTaskId = taskId;
    agent.currentTaskStartedAt = Date.now();
    agent.activeTaskCount++;
    agent.status = AgentStatus.BUSY;
  }

  /**
   * 完成任务
   */
  completeTask(agentId: string, success: boolean, executionTime: number): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // 更新性能指标
    agent.performanceMetrics.totalTasks++;
    if (success) {
      agent.performanceMetrics.successfulTasks++;
    } else {
      agent.performanceMetrics.failedTasks++;
    }
    
    // 更新平均执行时间（滑动平均）
    const currentAvg = agent.performanceMetrics.avgExecutionTime;
    const totalTasks = agent.performanceMetrics.totalTasks;
    agent.performanceMetrics.avgExecutionTime = 
      (currentAvg * (totalTasks - 1) + executionTime) / totalTasks;
    agent.performanceMetrics.lastExecutionTime = Date.now();

    // 重置状态
    agent.currentTaskId = undefined;
    agent.currentTaskStartedAt = undefined;
    agent.activeTaskCount = Math.max(0, agent.activeTaskCount - 1);
    
    if (agent.activeTaskCount === 0) {
      agent.status = AgentStatus.IDLE;
    }
  }

  /**
   * 更新智能体状态
   */
  updateStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    agent.status = status;
  }

  /**
   * 获取最佳智能体（基于负载均衡和能力匹配）
   */
  getBestAgent(requiredCapabilities: AgentCapability[]): Agent | null {
    const availableAgents = this.getAvailableAgents(requiredCapabilities);
    if (availableAgents.length === 0) return null;

    // 按负载和性能排序
    return availableAgents.sort((a, b) => {
      // 首先按活跃任务数（负载均衡）
      if (a.activeTaskCount !== b.activeTaskCount) {
        return a.activeTaskCount - b.activeTaskCount;
      }
      // 然后按平均执行时间（性能好的优先）
      if (a.performanceMetrics.avgExecutionTime !== b.performanceMetrics.avgExecutionTime) {
        return a.performanceMetrics.avgExecutionTime - b.performanceMetrics.avgExecutionTime;
      }
      // 最后按成功率
      const aSuccessRate = a.performanceMetrics.totalTasks > 0
        ? a.performanceMetrics.successfulTasks / a.performanceMetrics.totalTasks
        : 1;
      const bSuccessRate = b.performanceMetrics.totalTasks > 0
        ? b.performanceMetrics.successfulTasks / b.performanceMetrics.totalTasks
        : 1;
      return bSuccessRate - aSuccessRate;
    })[0];
  }

  /**
   * 获取智能体池统计
   */
  getStats(): {
    totalAgents: number;
    idleAgents: number;
    busyAgents: number;
    offlineAgents: number;
    totalTasksProcessed: number;
    overallSuccessRate: number;
    avgUtilization: number;
  } {
    const agents = this.getAll();
    let totalTasks = 0;
    let totalSuccess = 0;
    let totalCapacity = 0;
    let totalUsed = 0;

    for (const agent of agents) {
      totalTasks += agent.performanceMetrics.totalTasks;
      totalSuccess += agent.performanceMetrics.successfulTasks;
      totalCapacity += agent.maxConcurrentTasks;
      totalUsed += agent.activeTaskCount;
    }

    return {
      totalAgents: agents.length,
      idleAgents: agents.filter(a => a.status === AgentStatus.IDLE).length,
      busyAgents: agents.filter(a => a.status === AgentStatus.BUSY).length,
      offlineAgents: agents.filter(a => a.status === AgentStatus.OFFLINE).length,
      totalTasksProcessed: totalTasks,
      overallSuccessRate: totalTasks > 0 ? totalSuccess / totalTasks : 0,
      avgUtilization: totalCapacity > 0 ? totalUsed / totalCapacity : 0,
    };
  }
}

/**
 * 创建智能体池
 */
export function createAgentPool(initialAgents?: Agent[]): AgentPool {
  return new AgentPool(initialAgents);
}
