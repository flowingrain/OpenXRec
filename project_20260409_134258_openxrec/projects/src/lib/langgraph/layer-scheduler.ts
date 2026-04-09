/**
 * 分层调度器 (Layer Scheduler)
 * 
 * 核心功能：
 * 1. 层级顺序执行 - 感知→认知→决策→行动→进化
 * 2. 层内并行执行 - 同一层级的智能体可并行
 * 3. 动态跳过机制 - 根据任务复杂度跳过不需要的智能体
 * 4. 循环修正机制 - 质量不达标时返回修正
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { 
  AnalysisStateType, 
  AgentLayer, 
  TaskComplexity,
  AgentSchedule,
  AgentError,
  isAgentRequired
} from './state';
import { IntelligentBase, AgentCapability } from './intelligent-base';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 执行策略
 */
export interface ExecutionStrategy {
  layers: AgentLayer[];
  skipAgents: string[];
  parallelWithinLayer: boolean;
  maxIterations: number;
}

/**
 * 智能体节点函数类型
 */
export type AgentNodeFunction = (
  state: AnalysisStateType,
  llmClient: LLMClient
) => Promise<Partial<AnalysisStateType>>;

/**
 * 调度器回调
 */
export interface SchedulerCallbacks {
  onLayerStart?: (layer: AgentLayer, agents: string[]) => void;
  onLayerComplete?: (layer: AgentLayer, results: any) => void;
  onAgentStart?: (agentId: string, agentName: string) => void;
  onAgentThinking?: (agentId: string, message: string) => void;
  onAgentComplete?: (agentId: string, result: any) => void;
  onAgentSkip?: (agentId: string, reason: string) => void;
  onAgentError?: (agentId: string, error: Error) => void;
  onRevisionRequired?: (targetAgent: string, reason: string) => void;
  onMaxIterationsReached?: () => void;
}

/**
 * 层级执行结果
 */
export interface LayerExecutionResult {
  layer: AgentLayer;
  executedAgents: string[];
  skippedAgents: string[];
  errors: AgentError[];
  state: Partial<AnalysisStateType>;
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 任务复杂度 → 执行策略映射
 */
export const EXECUTION_STRATEGIES: Record<TaskComplexity, ExecutionStrategy> = {
  // 简单任务：跳过深度分析（但保留地理抽取器，因为调度器会根据关键词决定）
  simple: {
    layers: ['scheduler', 'perception', 'action'],
    skipAgents: ['sensitivity_analyst', 'result_validator'],
    parallelWithinLayer: true,
    maxIterations: 1
  },
  
  // 中等任务：标准流程（geo_extractor 由调度器根据关键词决定）
  moderate: {
    layers: ['scheduler', 'perception', 'cognition', 'decision', 'action'],
    skipAgents: [],
    parallelWithinLayer: true,
    maxIterations: 2
  },
  
  // 复杂任务：完整流程 + 进化
  complex: {
    layers: ['scheduler', 'perception', 'cognition', 'decision', 'action', 'evolution'],
    skipAgents: [],
    parallelWithinLayer: true,
    maxIterations: 3
  }
};

/**
 * 五层架构智能体配置 + 独立调度层
 * 
 * 架构调整说明：
 * - 调度层：独立的协调器，负责理解意图、判断复杂度、调度智能体
 * - 感知体：完整链路 采集 → 抽取 → 评估
 * - 认知体：完整链路 时序 → 因果 → 知识 → 验证
 * - 决策体：完整链路 推演 → 分析 → 建议
 * - 行动体：完整链路 生成 → 执行 → 控制 → 监控
 * - 进化体：完整链路 存储 → 检索 → 复盘
 */
export const LAYER_AGENTS: Record<AgentLayer, AgentCapability[]> = {
  // ========== 调度层 - 独立协调器 ==========
  scheduler: [
    {
      id: 'intent_parser',
      layer: 'scheduler',
      capabilities: ['intent_understanding', 'complexity_judgment', 'scheduling'],
      dependencies: [],
      inputSchema: { query: 'string' },
      outputSchema: { taskComplexity: 'TaskComplexity', agentSchedule: 'AgentSchedule' }
    }
  ],
  
  // ========== 感知体 - 信息采集层 ==========
  // 完整链路：采集 → 抽取 → 评估
  perception: [
    {
      id: 'scout_cluster',
      layer: 'perception',
      capabilities: ['search', 'data_collection'],
      dependencies: [],
      inputSchema: { query: 'string' },
      outputSchema: { searchResults: 'SearchItem[]' }
    },
    {
      id: 'event_extractor',
      layer: 'perception',
      capabilities: ['event_extraction', 'structuration'],
      dependencies: ['scout_cluster'],
      inputSchema: { searchResults: 'SearchItem[]' },
      outputSchema: { extractedEvents: 'ExtractedEvent[]' }
    },
    {
      id: 'quality_evaluator',
      layer: 'perception',
      capabilities: ['quality_assessment', 'source_evaluation'],
      dependencies: ['scout_cluster'],
      inputSchema: { searchResults: 'SearchItem[]' },
      outputSchema: { qualityScore: 'number', reliabilityAnalysis: 'string' }
    },
    {
      id: 'geo_extractor',
      layer: 'perception',
      capabilities: ['geo_extraction', 'spatial_analysis'],
      dependencies: ['scout_cluster'],
      inputSchema: { searchResults: 'SearchItem[]' },
      outputSchema: { geoLocations: 'GeoLocation[]' }
    }
  ],
  
  // ========== 认知体 - 分析推理层 ==========
  // 完整链路：时序 → 因果 → 知识 → 验证
  cognition: [
    {
      id: 'timeline_analyst',
      layer: 'cognition',
      capabilities: ['timeline_construction', 'event_sequence'],
      dependencies: ['scout_cluster'],
      inputSchema: { searchResults: 'SearchItem[]' },
      outputSchema: { timeline: 'TimelineEvent[]' }
    },
    {
      id: 'causal_analyst',
      layer: 'cognition',
      capabilities: ['causal_analysis', 'risk_propagation'],
      dependencies: ['timeline_analyst'],
      inputSchema: { timeline: 'TimelineEvent[]' },
      outputSchema: { causalChain: 'CausalChainNode[]' }
    },
    {
      id: 'knowledge_extractor',
      layer: 'cognition',
      capabilities: ['domain_knowledge', 'key_factors_analysis'],
      dependencies: ['causal_analyst'],
      inputSchema: { causalChain: 'CausalChainNode[]' },
      outputSchema: { keyFactors: 'KeyFactor[]' }
    },
    {
      id: 'result_validator',
      layer: 'cognition',
      capabilities: ['fact_check', 'logic_validation', 'conflict_resolution'],
      dependencies: ['causal_analyst', 'knowledge_extractor'],
      inputSchema: { causalChain: 'CausalChainNode[]', keyFactors: 'KeyFactor[]' },
      outputSchema: { validationResults: 'any' }
    }
  ],
  
  // ========== 决策体 - 决策支持层 ==========
  // 完整链路：推演 → 分析 → 建议
  decision: [
    {
      id: 'scenario_simulator',
      layer: 'decision',
      capabilities: ['scenario_simulation', 'probability_prediction', 'china_market_impact'],
      dependencies: ['result_validator'],
      inputSchema: { validationResults: 'any' },
      outputSchema: { scenarios: 'ScenarioNode[]' }
    },
    {
      id: 'sensitivity_analyst',
      layer: 'decision',
      capabilities: ['sensitivity_analysis', 'vulnerability_identification'],
      dependencies: ['scenario_simulator'],
      inputSchema: { scenarios: 'ScenarioNode[]' },
      outputSchema: { sensitivityAnalysis: 'SensitivityAnalysis' }
    },
    {
      id: 'action_advisor',
      layer: 'decision',
      capabilities: ['action_recommendation', 'decision_support'],
      dependencies: ['scenario_simulator', 'sensitivity_analyst'],
      inputSchema: { scenarios: 'ScenarioNode[]', sensitivityAnalysis: 'SensitivityAnalysis' },
      outputSchema: { actionAdvice: 'ActionAdvice' }
    }
  ],
  
  // ========== 行动体 - 执行输出层 ==========
  // 完整链路：生成 → 执行 → 控制 → 监控
  action: [
    {
      id: 'report_generator',
      layer: 'action',
      capabilities: ['report_generation', 'result_structuring'],
      dependencies: ['action_advisor'],
      inputSchema: { actionAdvice: 'ActionAdvice' },
      outputSchema: { finalReport: 'string' }
    },
    {
      id: 'document_executor',
      layer: 'action',
      capabilities: ['document_storage', 'persistence'],
      dependencies: ['report_generator'],
      inputSchema: { finalReport: 'string' },
      outputSchema: { documentStored: 'boolean', storagePath: 'string' }
    },
    {
      id: 'quality_controller',
      layer: 'action',
      capabilities: ['risk_boundary_control', 'compliance_check', 'exception_interception'],
      dependencies: [],
      inputSchema: {},
      outputSchema: { riskControl: 'any' }
    },
    {
      id: 'execution_monitor',
      layer: 'action',
      capabilities: ['quality_audit', 'completeness_check'],
      dependencies: ['document_executor'],
      inputSchema: { documentStored: 'boolean' },
      outputSchema: { qualityCheck: 'any' }
    }
  ],
  
  // ========== 进化体 - 持续优化层 ==========
  // 完整链路：存储 → 检索 → 复盘
  evolution: [
    {
      id: 'knowledge_manager',
      layer: 'evolution',
      capabilities: ['knowledge_storage', 'case_retrieval', 'context_recall'],
      dependencies: ['execution_monitor'],
      inputSchema: {},
      outputSchema: { knowledgeStored: 'boolean' }
    },
    {
      id: 'review_analyst',
      layer: 'evolution',
      capabilities: ['result_reflection', 'experience_summary'],
      dependencies: ['knowledge_manager'],
      inputSchema: {},
      outputSchema: { reviewResults: 'any' }
    }
  ]
};

// ============================================================================
// 分层调度器主类
// ============================================================================

/**
 * 分层调度器
 */
export class LayerScheduler {
  private llmClient: LLMClient;
  private intelligentBase: IntelligentBase;
  private nodeFunctions: Map<string, AgentNodeFunction> = new Map();
  private callbacks: SchedulerCallbacks;
  
  constructor(
    llmClient: LLMClient,
    intelligentBase: IntelligentBase,
    callbacks: SchedulerCallbacks = {}
  ) {
    this.llmClient = llmClient;
    this.intelligentBase = intelligentBase;
    this.callbacks = callbacks;
    
    // 注册智能体能力到智能底座
    this.registerAgentCapabilities();
  }

  /**
   * 注册智能体能力到智能底座
   */
  private registerAgentCapabilities(): void {
    Object.values(LAYER_AGENTS).flat().forEach(capability => {
      this.intelligentBase.registerAgent(capability);
    });
  }

  /**
   * 注册节点函数
   */
  registerNodeFunction(agentId: string, nodeFn: AgentNodeFunction): void {
    this.nodeFunctions.set(agentId, nodeFn);
    console.log(`[LayerScheduler] Registered node function: ${agentId}`);
  }

  /**
   * 获取执行策略
   */
  getExecutionStrategy(complexity: TaskComplexity): ExecutionStrategy {
    return EXECUTION_STRATEGIES[complexity];
  }

  /**
   * 执行分析任务
   */
  async execute(
    initialState: AnalysisStateType,
    strategy?: ExecutionStrategy
  ): Promise<AnalysisStateType> {
    let state = initialState;
    const complexity = state.taskComplexity || 'moderate';
    const execStrategy = strategy || EXECUTION_STRATEGIES[complexity];
    
    console.log(`[LayerScheduler] Starting execution with complexity: ${complexity}`);
    console.log(`[LayerScheduler] Strategy layers: ${execStrategy.layers.join(' → ')}`);
    
    // 按层级顺序执行
    for (const layer of execStrategy.layers) {
      const result = await this.executeLayer(layer, state, execStrategy);
      state = { ...state, ...result.state } as AnalysisStateType;
      
      // 检查是否需要修正
      if (state.needsRevision && state.iterationCount < execStrategy.maxIterations) {
        // 循环修正
        const revisionResult = await this.handleRevision(state, execStrategy);
        state = { ...state, ...revisionResult } as AnalysisStateType;
      }
    }
    
    return state;
  }

  /**
   * 执行单个层级
   */
  private async executeLayer(
    layer: AgentLayer,
    state: AnalysisStateType,
    strategy: ExecutionStrategy
  ): Promise<LayerExecutionResult> {
    const agents = LAYER_AGENTS[layer] || [];
    const executedAgents: string[] = [];
    const skippedAgents: string[] = [];
    const errors: AgentError[] = [];
    let layerState: Partial<AnalysisStateType> = {};
    
    // 发布层级开始事件
    this.callbacks.onLayerStart?.(layer, agents.map(a => a.id));
    this.intelligentBase.emitEvent('layer_start', 'scheduler', { layer });
    
    // 过滤需要跳过的智能体
    const activeAgents = agents.filter(a => !strategy.skipAgents.includes(a.id));
    
    // 检查依赖是否满足
    const readyAgents = activeAgents.filter(agent => {
      const depsSatisfied = agent.dependencies.every(dep => 
        state.completedAgents?.includes(dep) || executedAgents.includes(dep)
      );
      
      if (!depsSatisfied) {
        skippedAgents.push(agent.id);
        this.callbacks.onAgentSkip?.(agent.id, 'Dependencies not satisfied');
      }
      
      return depsSatisfied;
    });
    
    // 执行智能体
    if (strategy.parallelWithinLayer && readyAgents.length > 1) {
      // 并行执行
      const results = await Promise.allSettled(
        readyAgents.map(agent => this.executeAgent(agent.id, state))
      );
      
      results.forEach((result, i) => {
        const agent = readyAgents[i];
        if (result.status === 'fulfilled') {
          executedAgents.push(agent.id);
          layerState = { ...layerState, ...result.value };
        } else {
          errors.push({
            agentId: agent.id,
            agentName: agent.id,
            error: (result.reason as Error)?.message || 'Unknown error',
            timestamp: new Date().toISOString(),
            retryCount: 0,
            recovered: false
          });
          this.callbacks.onAgentError?.(agent.id, result.reason as Error);
        }
      });
    } else {
      // 串行执行
      for (const agent of readyAgents) {
        try {
          const result = await this.executeAgent(agent.id, state);
          executedAgents.push(agent.id);
          layerState = { ...layerState, ...result };
          state = { ...state, ...result } as AnalysisStateType;
        } catch (error) {
          errors.push({
            agentId: agent.id,
            agentName: agent.id,
            error: (error as Error)?.message || 'Unknown error',
            timestamp: new Date().toISOString(),
            retryCount: 0,
            recovered: false
          });
          this.callbacks.onAgentError?.(agent.id, error as Error);
        }
      }
    }
    
    // 发布层级完成事件
    this.callbacks.onLayerComplete?.(layer, { executedAgents, skippedAgents });
    this.intelligentBase.emitEvent('layer_complete', 'scheduler', { layer, executedAgents });
    
    // 更新黑板
    this.intelligentBase.writeToBlackboard(
      `layer_${layer}_result`,
      { executedAgents, skippedAgents, errors },
      'scheduler'
    );
    
    return {
      layer,
      executedAgents,
      skippedAgents,
      errors,
      state: {
        ...layerState,
        completedAgents: [...(state.completedAgents || []), ...executedAgents]
      }
    };
  }

  /**
   * 执行单个智能体
   */
  private async executeAgent(
    agentId: string,
    state: AnalysisStateType
  ): Promise<Partial<AnalysisStateType>> {
    const nodeFn = this.nodeFunctions.get(agentId);
    
    if (!nodeFn) {
      console.warn(`[LayerScheduler] No node function for ${agentId}, using placeholder`);
      return { currentAgent: agentId };
    }
    
    // 发布智能体开始事件
    this.callbacks.onAgentStart?.(agentId, agentId);
    this.intelligentBase.emitEvent('agent_start', 'scheduler', { agentId });
    
    try {
      this.callbacks.onAgentThinking?.(agentId, 'Processing...');
      
      const result = await nodeFn(state, this.llmClient);
      
      // 发布智能体完成事件
      this.callbacks.onAgentComplete?.(agentId, result);
      this.intelligentBase.emitEvent('agent_complete', agentId, result);
      
      return result;
    } catch (error) {
      this.intelligentBase.emitEvent('agent_error', agentId, { error });
      throw error;
    }
  }

  /**
   * 处理修正
   */
  private async handleRevision(
    state: AnalysisStateType,
    strategy: ExecutionStrategy
  ): Promise<Partial<AnalysisStateType>> {
    const targetAgent = state.revisionTarget;
    const reason = state.revisionReason;
    
    console.log(`[LayerScheduler] Revision required: ${targetAgent} - ${reason}`);
    
    this.callbacks.onRevisionRequired?.(targetAgent, reason);
    this.intelligentBase.emitEvent('revision_required', 'scheduler', { targetAgent, reason });
    
    // 找到目标智能体所在的层级
    let targetLayer: AgentLayer | null = null;
    for (const [layer, agents] of Object.entries(LAYER_AGENTS)) {
      if (agents.some(a => a.id === targetAgent)) {
        targetLayer = layer as AgentLayer;
        break;
      }
    }
    
    if (!targetLayer) {
      console.warn(`[LayerScheduler] Unknown target agent: ${targetAgent}`);
      return {};
    }
    
    // 增加迭代计数
    const newIterationCount = (state.iterationCount || 0) + 1;
    
    // 检查是否达到最大迭代次数
    if (newIterationCount >= strategy.maxIterations) {
      console.log(`[LayerScheduler] Max iterations reached (${strategy.maxIterations})`);
      this.callbacks.onMaxIterationsReached?.();
      return {
        needsRevision: false,
        iterationCount: newIterationCount
      };
    }
    
    // 重新执行从目标层级开始的所有层级
    const layerOrder = ['perception', 'cognition', 'decision', 'action', 'evolution'];
    const targetLayerIndex = layerOrder.indexOf(targetLayer);
    const layersToReExecute = layerOrder.slice(targetLayerIndex).filter(l => 
      strategy.layers.includes(l as AgentLayer)
    );
    
    let revisionState: Partial<AnalysisStateType> = { 
      iterationCount: newIterationCount,
      needsRevision: false,
      revisionTarget: '',
      revisionReason: ''
    };
    
    for (const layer of layersToReExecute) {
      const result = await this.executeLayer(layer as AgentLayer, state, strategy);
      revisionState = { ...revisionState, ...result.state };
    }
    
    this.intelligentBase.emitEvent('revision_complete', 'scheduler', { targetAgent, newIterationCount });
    
    return revisionState;
  }

  /**
   * 检查是否应该跳过某个智能体
   * 使用 agentSchedule（编排思维）替代 skipDecision
   */
  shouldSkipAgent(agentId: string, state: AnalysisStateType): boolean {
    // 使用 isAgentRequired 检查智能体是否需要执行
    // 如果不需要执行，则跳过
    return !isAgentRequired(state.agentSchedule, agentId);
  }

  /**
   * 获取层级执行顺序
   */
  getLayerOrder(): AgentLayer[] {
    return ['perception', 'cognition', 'decision', 'action', 'evolution'];
  }

  /**
   * 获取层级内的智能体
   */
  getLayerAgents(layer: AgentLayer): AgentCapability[] {
    return LAYER_AGENTS[layer] || [];
  }
  
  /**
   * 执行智能体协作发现传导路径
   * 
   * 核心流程：
   * 1. 分析师提出传导假设
   * 2. 验证者验证传导机制
   * 3. 领域专家补充知识
   * 4. 仲裁者融合共识
   */
  async executeCollaborativeDiscovery(
    state: AnalysisStateType,
    context: {
      query: string;
      causalChain: any[];
      keyFactors: any[];
      timeline: any[];
      searchResults: any[];
    }
  ): Promise<{
    propagationNetwork: any;
    consensusLevel: number;
    collaborationRounds: number;
  }> {
    console.log('[LayerScheduler] Starting collaborative discovery...');
    
    // 发布协作开始事件
    this.intelligentBase.emitEvent('agent_start', 'scheduler', { 
      agentId: 'collaborative_discovery',
      type: 'propagation_discovery'
    });
    
    // 调用智能底座的动态传导发现
    const result = await this.intelligentBase.analyzeRiskPropagation(
      context.causalChain,
      context.keyFactors,
      {
        query: context.query,
        timeline: context.timeline,
        searchResults: context.searchResults
      }
    );
    
    // 发布协作完成事件
    this.intelligentBase.emitEvent('propagation_discovered', 'scheduler', {
      networkId: result.propagationNetwork?.id,
      consensusLevel: result.discoveryProcess?.consensusLevel || 0.8
    });
    
    return {
      propagationNetwork: result.propagationNetwork,
      consensusLevel: result.discoveryProcess?.consensusLevel || 0.8,
      collaborationRounds: result.discoveryProcess?.collaborationRounds || 1
    };
  }
  
  /**
   * 智能体间协作通信
   * 通过黑板系统实现智能体间的信息共享
   */
  async agentCollaboration(
    fromAgent: string,
    toAgent: string,
    message: {
      type: 'request' | 'response' | 'notification';
      topic: string;
      data: any;
    }
  ): Promise<void> {
    const key = `collaboration_${fromAgent}_${toAgent}_${message.topic}`;
    
    // 写入黑板
    this.intelligentBase.writeToBlackboard(key, message.data, fromAgent);
    
    // 发布协作事件
    this.intelligentBase.emitEvent('agent_start', fromAgent, {
      collaborationWith: toAgent,
      topic: message.topic,
      type: message.type
    });
    
    console.log(`[LayerScheduler] Collaboration: ${fromAgent} → ${toAgent} (${message.topic})`);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建分层调度器
 */
export function createLayerScheduler(
  customHeaders?: Record<string, string>,
  callbacks?: SchedulerCallbacks
): LayerScheduler {
  const config = new Config();
  const llmClient = new LLMClient(config, customHeaders);
  const intelligentBase = new IntelligentBase(llmClient);
  
  return new LayerScheduler(llmClient, intelligentBase, callbacks);
}
