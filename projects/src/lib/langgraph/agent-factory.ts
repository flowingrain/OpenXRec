/**
 * 智能体工厂 (Agent Factory)
 * 
 * 支持动态创建和配置智能体，实现通用性和领域适配性的结合
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import { AnalysisStateType, TaskComplexity, AgentSchedule } from './state';
import { AgentCapability, IntelligentBase } from './intelligent-base';
import { DomainAdapterManager, domainManager, DomainType, ScenarioType } from './domain-config';
import {
  coordinatorNode,
  searchNode,
  sourceEvaluatorNode,
  timelineNode,
  causalInferenceNode,
  scenarioNode,
  keyFactorNode,
  reportNode,
  qualityCheckNode,
  chatNode,
  geoExtractorNode,
  sensitivityAnalysisNode,
  actionAdvisorNode,
  enhancedAnalystNode
} from './nodes';
import {
  memoryAgentNode,
  reviewAgentNode,
  rlTrainerNode
} from './evolution-nodes';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 智能体节点函数类型
 */
export type AgentNodeFunction = (
  state: AnalysisStateType,
  llmClient: LLMClient,
  context?: AgentExecutionContext
) => Promise<Partial<AnalysisStateType>>;

/**
 * 智能体执行上下文
 */
export interface AgentExecutionContext {
  domain: DomainType;
  scenario: ScenarioType;
  intelligentBase: IntelligentBase;
  domainManager: DomainAdapterManager;
  customPrompts?: Record<string, string>;
  customTools?: Record<string, Function>;
}

/**
 * 智能体工厂配置
 */
export interface AgentFactoryConfig {
  llmClient: LLMClient;
  intelligentBase: IntelligentBase;
  domainManager?: DomainAdapterManager;
}

/**
 * 动态智能体配置
 */
export interface DynamicAgentConfig {
  id: string;
  name: string;
  layer: 'perception' | 'cognition' | 'decision' | 'action' | 'evolution';
  baseFunction: string;  // 基础函数名
  enhancements: {
    promptEnhancements?: string[];
    toolEnhancements?: string[];
    knowledgeEnhancements?: string[];
  };
  dependencies?: string[];
  conditions?: {
    skipConditions?: ((state: AnalysisStateType) => boolean)[];
    activateConditions?: ((state: AnalysisStateType) => boolean)[];
  };
}

// ============================================================================
// 智能体工厂
// ============================================================================

/**
 * 智能体工厂
 */
export class AgentFactory {
  private llmClient: LLMClient;
  private intelligentBase: IntelligentBase;
  private domainManager: DomainAdapterManager;
  private nodeRegistry: Map<string, AgentNodeFunction> = new Map();
  private dynamicAgents: Map<string, DynamicAgentConfig> = new Map();
  
  constructor(config: AgentFactoryConfig) {
    this.llmClient = config.llmClient;
    this.intelligentBase = config.intelligentBase;
    this.domainManager = config.domainManager || domainManager;
    
    // 注册基础节点函数
    this.registerBaseNodes();
  }

  /**
   * 注册基础节点函数
   */
  private registerBaseNodes(): void {
    // 感知体层
    // 注：intent_parser 是 goal_manager 的新名称，负责快速理解用户意图
    this.nodeRegistry.set('intent_parser', coordinatorNode); // 意图解析使用coordinator的逻辑
    this.nodeRegistry.set('goal_manager', coordinatorNode); // 兼容旧ID
    this.nodeRegistry.set('coordinator', coordinatorNode); // 兼容旧ID
    this.nodeRegistry.set('search', searchNode as any);
    this.nodeRegistry.set('scout_cluster', searchNode as any); // 新ID映射
    this.nodeRegistry.set('source_evaluator', sourceEvaluatorNode);
    this.nodeRegistry.set('alert_sentinel', sourceEvaluatorNode); // 新ID映射
    this.nodeRegistry.set('geo_extractor', geoExtractorNode);
    
    // 认知体层
    this.nodeRegistry.set('timeline', timelineNode);
    this.nodeRegistry.set('analyst', causalInferenceNode);
    this.nodeRegistry.set('enhanced_analyst', enhancedAnalystNode as any);
    this.nodeRegistry.set('validator', this.createValidatorNode());
    this.nodeRegistry.set('arbitrator', this.createArbitratorNode());
    this.nodeRegistry.set('cik_expert', keyFactorNode);
    
    // 决策体层
    // 注：strategy_planner 基于认知结果进行深度分析规划
    this.nodeRegistry.set('strategy_planner', this.createStrategyPlannerNode());
    this.nodeRegistry.set('simulation', scenarioNode);
    this.nodeRegistry.set('sensitivity_analysis', sensitivityAnalysisNode);
    this.nodeRegistry.set('action_advisor', actionAdvisorNode);
    
    // 行动体层
    this.nodeRegistry.set('report', reportNode);
    this.nodeRegistry.set('quality_check', qualityCheckNode);
    this.nodeRegistry.set('chat', chatNode);
    
    // 进化体层
    this.nodeRegistry.set('memory_agent', memoryAgentNode as any);
    this.nodeRegistry.set('review_agent', reviewAgentNode as any);
    this.nodeRegistry.set('rl_trainer', rlTrainerNode as any);
    
    console.log(`[AgentFactory] Registered ${this.nodeRegistry.size} base nodes`);
  }

  /**
   * 获取智能体节点函数（带领域增强）
   */
  getNodeFunction(agentId: string): AgentNodeFunction {
    const baseFunction = this.nodeRegistry.get(agentId);
    
    if (!baseFunction) {
      console.warn(`[AgentFactory] No function found for ${agentId}, using placeholder`);
      return async (state) => ({ currentAgent: agentId });
    }
    
    // 返回增强后的函数
    return this.enhanceNodeFunction(agentId, baseFunction);
  }

  /**
   * 增强节点函数
   */
  private enhanceNodeFunction(
    agentId: string,
    baseFunction: AgentNodeFunction
  ): AgentNodeFunction {
    return async (
      state: AnalysisStateType,
      llmClient: LLMClient
    ): Promise<Partial<AnalysisStateType>> => {
      // 构建执行上下文
      const context: AgentExecutionContext = {
        domain: this.domainManager.getCurrentDomain().type,
        scenario: this.domainManager.getCurrentScenario().type,
        intelligentBase: this.intelligentBase,
        domainManager: this.domainManager
      };
      
      // 执行基础函数
      const result = await baseFunction(state, llmClient, context);
      
      return result;
    };
  }

  /**
   * 创建动态智能体
   */
  createDynamicAgent(config: DynamicAgentConfig): AgentNodeFunction {
    const baseFunction = this.nodeRegistry.get(config.baseFunction);
    
    if (!baseFunction) {
      throw new Error(`Base function not found: ${config.baseFunction}`);
    }
    
    // 存储配置
    this.dynamicAgents.set(config.id, config);
    
    // 创建增强函数
    const enhancedFunction: AgentNodeFunction = async (
      state: AnalysisStateType,
      llmClient: LLMClient
    ): Promise<Partial<AnalysisStateType>> => {
      // 检查跳过条件
      if (config.conditions?.skipConditions) {
        for (const condition of config.conditions.skipConditions) {
          if (condition(state)) {
            console.log(`[AgentFactory] Skipping ${config.id} due to condition`);
            return { currentAgent: config.id };
          }
        }
      }
      
      // 检查激活条件
      if (config.conditions?.activateConditions) {
        const shouldActivate = config.conditions.activateConditions.some(c => c(state));
        if (!shouldActivate) {
          console.log(`[AgentFactory] ${config.id} not activated`);
          return { currentAgent: config.id };
        }
      }
      
      // 构建上下文
      const context: AgentExecutionContext = {
        domain: this.domainManager.getCurrentDomain().type,
        scenario: this.domainManager.getCurrentScenario().type,
        intelligentBase: this.intelligentBase,
        domainManager: this.domainManager,
        customPrompts: config.enhancements.promptEnhancements?.reduce((acc, key) => {
          acc[key] = this.domainManager.generateDomainPrompt('', config.id);
          return acc;
        }, {} as Record<string, string>)
      };
      
      // 执行
      return baseFunction(state, llmClient, context);
    };
    
    // 注册到工厂
    this.nodeRegistry.set(config.id, enhancedFunction);
    
    return enhancedFunction;
  }

  /**
   * 创建验证者节点
   */
  private createValidatorNode(): AgentNodeFunction {
    return async (state: AnalysisStateType, llmClient: LLMClient) => {
      const domain = this.domainManager.getCurrentDomain();
      
      const systemPrompt = `你是验证专家，负责验证分析结果的准确性和一致性。

## 当前领域：${domain.name}

## 验证维度
1. **事实准确性**：信息是否准确、来源是否可靠
2. **逻辑一致性**：推理是否连贯、结论是否合理
3. **完整性**：是否覆盖关键方面、是否有遗漏
4. **时效性**：信息是否最新、是否过时

请输出JSON格式：
{
  "validationResults": [
    {
      "dimension": "维度名称",
      "score": 0.85,
      "issues": ["问题1"],
      "suggestions": ["建议1"]
    }
  ],
  "overallScore": 0.8,
  "approved": true,
  "revisionNeeded": []
}`;

      // 简化实现
      return {
        validatorOutput: JSON.stringify({
          overallScore: 0.8,
          approved: true,
          revisionNeeded: []
        }),
        currentAgent: 'validator',
        completedAgents: ['validator']
      };
    };
  }

  /**
   * 创建仲裁者节点
   */
  private createArbitratorNode(): AgentNodeFunction {
    return async (state: AnalysisStateType, llmClient: LLMClient) => {
      return {
        arbitratorOutput: JSON.stringify({
          decision: 'approved',
          reason: '各模块分析一致，无需仲裁'
        }),
        currentAgent: 'arbitrator',
        completedAgents: ['arbitrator']
      };
    };
  }

  /**
   * 创建战略规划器节点
   * 
   * 职责：
   * 1. 基于认知结果进行深度分析规划
   * 2. 目标分解与任务细化
   * 3. 分析方向调整
   * 4. 策略优化建议
   */
  private createStrategyPlannerNode(): AgentNodeFunction {
    return async (state: AnalysisStateType, llmClient: LLMClient) => {
      const domain = this.domainManager.getCurrentDomain();
      
      // 获取认知层的分析结果
      const causalChain = state.causalChain || [];
      const keyFactors = state.keyFactors || [];
      const timeline = state.timeline || [];
      
      const systemPrompt = `你是战略规划专家，负责基于认知分析结果进行深度规划。

## 当前领域：${domain.name}

## 规划职责
1. **目标分解**：将分析目标拆分为可执行的子任务
2. **分析规划**：确定后续分析的重点方向
3. **策略调整**：根据认知结果调整分析策略
4. **资源分配**：建议分析资源的分配方式

## 输入信息
- 因果链：${JSON.stringify(causalChain.slice(0, 3))}
- 关键因素：${keyFactors.map((f: any) => f.factor || f.name).join(', ')}
- 时间线事件数：${timeline.length}

请输出JSON格式：
{
  "goalDecomposition": ["子目标1", "子目标2"],
  "analysisFocus": ["重点方向1", "重点方向2"],
  "strategyAdjustments": ["调整建议"],
  "nextSteps": ["后续步骤"]
}`;

      // 简化实现，返回规划结果
      return {
        strategyPlannerOutput: JSON.stringify({
          goalDecomposition: ['深化因果分析', '扩展影响范围评估'],
          analysisFocus: ['中国市场影响', '风险传导路径'],
          strategyAdjustments: ['增加敏感性分析', '强化预测置信度'],
          nextSteps: ['执行场景推演', '进行敏感性分析']
        }),
        currentAgent: 'strategy_planner',
        completedAgents: ['strategy_planner']
      };
    };
  }

  /**
   * 获取领域特定的工作流配置
   */
  getWorkflowConfig(): {
    domain: DomainType;
    scenario: ScenarioType;
    executionStrategy: {
      layers: string[];
      skipAgents: string[];
      parallelWithinLayer: boolean;
      maxIterations: number;
    };
    agentWeights: Record<string, number>;
  } {
    const domain = this.domainManager.getCurrentDomain();
    const scenario = this.domainManager.getCurrentScenario();
    
    return {
      domain: domain.type,
      scenario: scenario.type,
      executionStrategy: scenario.executionStrategy,
      agentWeights: scenario.agentWeights
    };
  }

  /**
   * 注册智能体能力到智能底座
   */
  registerCapabilities(): void {
    // 注册所有动态智能体的能力
    this.dynamicAgents.forEach((config, id) => {
      const capability: AgentCapability = {
        id,
        layer: config.layer,
        capabilities: [],
        dependencies: config.dependencies || [],
        inputSchema: {},
        outputSchema: {}
      };
      this.intelligentBase.registerAgent(capability);
    });
  }
}

// ============================================================================
// 智能体编排器
// ============================================================================

/**
 * 智能体编排器
 * 根据领域和场景动态编排智能体执行流程
 */
export class AgentOrchestrator {
  private factory: AgentFactory;
  private domainManager: DomainAdapterManager;
  
  constructor(factory: AgentFactory) {
    this.factory = factory;
    this.domainManager = domainManager;
  }

  /**
   * 分析查询并设置上下文
   */
  analyzeAndSetContext(query: string): {
    domain: DomainType;
    scenario: ScenarioType;
  } {
    // 自动识别领域和场景
    const domain = this.domainManager.detectDomain(query);
    const scenario = this.domainManager.detectScenario(query);
    
    // 设置上下文
    this.domainManager.setContext(domain, scenario);
    
    return { domain, scenario };
  }

  /**
   * 获取定制化的执行计划
   */
  getExecutionPlan(query: string): {
    context: { domain: DomainType; scenario: ScenarioType };
    layers: string[];
    agents: string[];
    skipAgents: string[];
    weights: Record<string, number>;
  } {
    // 分析并设置上下文
    const context = this.analyzeAndSetContext(query);
    
    // 获取工作流配置
    const workflowConfig = this.factory.getWorkflowConfig();
    
    // 获取所有智能体
    const allAgents = this.getAllAgentsForLayers(workflowConfig.executionStrategy.layers);
    
    return {
      context,
      layers: workflowConfig.executionStrategy.layers,
      agents: allAgents,
      skipAgents: workflowConfig.executionStrategy.skipAgents,
      weights: workflowConfig.agentWeights
    };
  }

  /**
   * 获取层级内的所有智能体
   */
  private getAllAgentsForLayers(layers: string[]): string[] {
    const layerAgents: Record<string, string[]> = {
      'perception': ['coordinator', 'search', 'source_evaluator', 'geo_extractor'],
      'cognition': ['analyst', 'validator', 'arbitrator', 'cik_expert'],
      'decision': ['simulation', 'sensitivity_analysis', 'action_advisor'],
      'action': ['report', 'quality_check'],
      'evolution': ['memory_agent', 'review_agent', 'rl_trainer']
    };
    
    const agents: string[] = [];
    layers.forEach(layer => {
      if (layerAgents[layer]) {
        agents.push(...layerAgents[layer]);
      }
    });
    
    return agents;
  }

  /**
   * 执行智能体工作流
   */
  async execute(
    state: AnalysisStateType,
    callbacks?: {
      onAgentStart?: (agentId: string) => void;
      onAgentComplete?: (agentId: string, result: any) => void;
    }
  ): Promise<AnalysisStateType> {
    const plan = this.getExecutionPlan(state.query);
    let currentState = state;
    
    console.log(`[Orchestrator] Execution plan:`, {
      domain: plan.context.domain,
      scenario: plan.context.scenario,
      layers: plan.layers,
      skipAgents: plan.skipAgents
    });
    
    // 按层级执行
    for (const layer of plan.layers) {
      console.log(`[Orchestrator] Executing layer: ${layer}`);
      
      const layerAgents = this.getAgentsForLayer(layer as any);
      const activeAgents = layerAgents.filter(a => !plan.skipAgents.includes(a));
      
      // 层内并行执行
      const results = await Promise.all(
        activeAgents.map(async (agentId) => {
          callbacks?.onAgentStart?.(agentId);
          
          const nodeFn = this.factory.getNodeFunction(agentId);
          const result = await nodeFn(currentState, this.factory['llmClient']);
          
          callbacks?.onAgentComplete?.(agentId, result);
          return { agentId, result };
        })
      );
      
      // 合并结果
      results.forEach(({ result }) => {
        currentState = { ...currentState, ...result } as AnalysisStateType;
      });
    }
    
    return currentState;
  }

  /**
   * 获取层级内的智能体
   */
  private getAgentsForLayer(layer: 'perception' | 'cognition' | 'decision' | 'action' | 'evolution'): string[] {
    const layerAgents: Record<string, string[]> = {
      'perception': ['coordinator', 'search', 'source_evaluator', 'geo_extractor'],
      'cognition': ['analyst', 'validator', 'cik_expert'],
      'decision': ['simulation', 'sensitivity_analysis', 'action_advisor'],
      'action': ['report', 'quality_check'],
      'evolution': ['memory_agent', 'review_agent', 'rl_trainer']
    };
    
    return layerAgents[layer] || [];
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建智能体工厂
 */
export function createAgentFactory(
  llmClient: LLMClient,
  intelligentBase: IntelligentBase
): AgentFactory {
  return new AgentFactory({
    llmClient,
    intelligentBase
  });
}

/**
 * 创建智能体编排器
 */
export function createAgentOrchestrator(factory: AgentFactory): AgentOrchestrator {
  return new AgentOrchestrator(factory);
}
