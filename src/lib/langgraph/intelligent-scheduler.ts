/**
 * 智能调度器 (Intelligent Scheduler)
 * 
 * 核心理念：
 * 1. 任务驱动调度 - 根据任务需求动态决定执行哪些智能体
 * 2. 依赖感知调度 - 自动识别依赖关系，并行执行无依赖的智能体
 * 3. 状态驱动调度 - 根据中间结果动态调整后续执行计划
 * 4. 资源优化调度 - 最大化并行度，减少等待时间
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { 
  AnalysisStateType, 
  AgentLayer,
  AgentNode
} from './state';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 调度决策
 */
export interface SchedulingDecision {
  // 需要执行的智能体列表
  agentsToExecute: string[];
  
  // 并行分组（每组内的智能体可并行执行）
  parallelGroups: string[][];
  
  // 跳过的智能体及原因
  skippedAgents: Array<{ agentId: string; reason: string }>;
  
  // 调度理由
  reasoning: string;
  
  // 预估执行路径
  estimatedPath: string[];
}

/**
 * 智能体依赖图
 */
export interface AgentDependencyGraph {
  nodes: Array<{
    id: string;
    layer: AgentLayer;
    capabilities: string[];
    estimatedTime: number;
    required: boolean; // 是否必须执行
  }>;
  
  edges: Array<{
    from: string;
    to: string;
    type: 'data' | 'control'; // 数据依赖 vs 控制依赖
    strength: 'strong' | 'weak'; // 强依赖必须等待，弱依赖可提前启动
  }>;
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  // 执行阶段
  stages: Array<{
    stageId: string;
    agents: string[];
    parallel: boolean;
    condition?: string; // 执行条件
  }>;
  
  // 备选路径
  alternativePaths?: Array<{
    condition: string;
    path: string[];
  }>;
  
  // 检查点
  checkpoints: string[]; // 在哪些智能体执行后检查是否需要调整
}

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  llmClient: LLMClient;
  maxParallelism: number;
  enableDynamicScheduling: boolean;
  enableEarlyTermination: boolean;
}

// ============================================================================
// 智能调度器核心
// ============================================================================

export class IntelligentScheduler {
  private llmClient: LLMClient;
  private maxParallelism: number;
  private enableDynamicScheduling: boolean;
  private nodeFunctions: Map<string, Function> = new Map();
  
  constructor(config: SchedulerConfig) {
    this.llmClient = config.llmClient;
    this.maxParallelism = config.maxParallelism || 5;
    this.enableDynamicScheduling = config.enableDynamicScheduling ?? true;
  }

  // ==========================================================================
  // 第一阶段：任务分析 - 决定需要哪些能力
  // ==========================================================================
  
  /**
   * 分析任务需求，生成调度决策
   */
  async analyzeTaskRequirements(
    query: string,
    state: AnalysisStateType
  ): Promise<SchedulingDecision> {
    const systemPrompt = `你是智能调度专家，负责分析任务需求并决定执行哪些智能体。

## 可用智能体及其能力

### 感知体层
- intent_parser: 快速理解意图、确定信息需求
- scout_cluster: 多源信息采集、实时数据抓取
- alert_sentinel: 信息质量评估、虚假信息预警
- geo_extractor: 地理位置抽取、空间分布分析

### 认知体层
- analyst: 因果推理、风险传导分析、时间线构建
- validator: 结果验证、一致性检查
- arbitrator: 冲突消解、结论仲裁
- cik_expert: 关键因素识别、领域知识提取

### 决策体层
- strategy_planner: 目标分解、分析规划
- simulation: 多场景推演、概率预测
- sensitivity_analysis: 敏感性分析、脆弱点识别
- action_advisor: 行动建议、策略推荐

### 行动体层
- instruction_parser: 报告生成、结果结构化
- execution_monitor: 质量审核、完整性检查

### 进化体层
- memory_agent: 案例存储、相似检索
- review_agent: 复盘分析、经验提取

## 调度原则

1. **必要性原则**：只调度对任务有贡献的智能体
2. **效率原则**：最大化并行度，减少串行等待
3. **依赖原则**：尊重数据依赖，控制依赖可灵活处理
4. **质量原则**：高风险任务增加验证环节

## 输出格式

请严格按照以下JSON格式输出：
{
  "agentsToExecute": ["智能体ID列表"],
  "parallelGroups": [["可并行的组1"], ["可并行的组2"]],
  "skippedAgents": [{"agentId": "ID", "reason": "跳过原因"}],
  "reasoning": "调度决策的理由",
  "estimatedPath": "预估执行路径描述"
}`;

    const userPrompt = `请分析以下任务，决定需要执行哪些智能体：

## 任务
${query}

## 当前状态
- 已完成的智能体: ${state.completedAgents?.join(', ') || '无'}
- 已有信息: ${state.searchResults ? '有搜索结果' : '无搜索结果'}
- 已有关键因素: ${state.keyFactors?.length || 0} 个

请输出调度决策。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { model: 'doubao-seed-2-0-pro-260215', temperature: 0.3 });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[IntelligentScheduler] analyzeTaskRequirements error:', error);
    }
    
    // 默认返回完整流程
    return this.getDefaultSchedulingDecision();
  }

  // ==========================================================================
  // 第二阶段：依赖分析 - 构建依赖图
  // ==========================================================================
  
  /**
   * 构建智能体依赖图
   */
  buildDependencyGraph(
    agentsToExecute: string[],
    state: AnalysisStateType
  ): AgentDependencyGraph {
    // 定义智能体能力与依赖关系
    const agentCapabilities: Record<string, {
      layer: AgentLayer;
      capabilities: string[];
      dependencies: string[];
      provides: string[];
      required: boolean;
    }> = {
      'intent_parser': {
        layer: 'perception',
        capabilities: ['intent_understanding', 'complexity_assessment'],
        dependencies: [],
        provides: ['task_plan', 'complexity'],
        required: true
      },
      'scout_cluster': {
        layer: 'perception',
        capabilities: ['search', 'data_collection'],
        dependencies: ['intent_parser'],
        provides: ['search_results'],
        required: true
      },
      'alert_sentinel': {
        layer: 'perception',
        capabilities: ['quality_assessment'],
        dependencies: ['scout_cluster'],
        provides: ['quality_score', 'source_credibility'],
        required: false
      },
      'geo_extractor': {
        layer: 'perception',
        capabilities: ['geo_extraction'],
        dependencies: ['scout_cluster'],
        provides: ['geo_locations'],
        required: false
      },
      'analyst': {
        layer: 'cognition',
        capabilities: ['causal_analysis', 'timeline_construction'],
        dependencies: ['scout_cluster'],
        provides: ['causal_chain', 'timeline'],
        required: true
      },
      'validator': {
        layer: 'cognition',
        capabilities: ['fact_check', 'validation'],
        dependencies: ['analyst'],
        provides: ['validation_result'],
        required: false
      },
      'arbitrator': {
        layer: 'cognition',
        capabilities: ['conflict_resolution'],
        dependencies: ['validator'],
        provides: ['arbitration_decision'],
        required: false
      },
      'cik_expert': {
        layer: 'cognition',
        capabilities: ['key_factors_analysis'],
        dependencies: ['analyst'],
        provides: ['key_factors'],
        required: true
      },
      'strategy_planner': {
        layer: 'decision',
        capabilities: ['goal_decomposition', 'strategy_planning'],
        dependencies: ['analyst', 'cik_expert'],
        provides: ['strategy_plan'],
        required: false
      },
      'simulation': {
        layer: 'decision',
        capabilities: ['scenario_simulation'],
        dependencies: ['analyst', 'cik_expert'],
        provides: ['scenarios'],
        required: true
      },
      'sensitivity_analysis': {
        layer: 'decision',
        capabilities: ['sensitivity_analysis'],
        dependencies: ['simulation'],
        provides: ['sensitivity_result'],
        required: false
      },
      'action_advisor': {
        layer: 'decision',
        capabilities: ['action_recommendation'],
        dependencies: ['simulation'],
        provides: ['action_advice'],
        required: false
      },
      'instruction_parser': {
        layer: 'action',
        capabilities: ['report_generation'],
        dependencies: ['simulation', 'cik_expert'],
        provides: ['final_report'],
        required: true
      },
      'execution_monitor': {
        layer: 'action',
        capabilities: ['quality_audit'],
        dependencies: ['instruction_parser'],
        provides: ['quality_check'],
        required: true
      },
      'memory_agent': {
        layer: 'evolution',
        capabilities: ['memory_storage'],
        dependencies: ['execution_monitor'],
        provides: ['case_stored'],
        required: false
      },
      'review_agent': {
        layer: 'evolution',
        capabilities: ['result_reflection'],
        dependencies: ['memory_agent'],
        provides: ['review_result'],
        required: false
      }
    };
    
    const nodes: AgentDependencyGraph['nodes'] = [];
    const edges: AgentDependencyGraph['edges'] = [];
    
    // 只包含需要执行的智能体
    for (const agentId of agentsToExecute) {
      const info = agentCapabilities[agentId];
      if (!info) continue;
      
      nodes.push({
        id: agentId,
        layer: info.layer,
        capabilities: info.capabilities,
        estimatedTime: this.estimateExecutionTime(agentId),
        required: info.required
      });
      
      // 添加依赖边
      for (const dep of info.dependencies) {
        if (agentsToExecute.includes(dep)) {
          edges.push({
            from: dep,
            to: agentId,
            type: 'data',
            strength: 'strong'
          });
        }
      }
    }
    
    return { nodes, edges };
  }

  /**
   * 估算智能体执行时间
   */
  private estimateExecutionTime(agentId: string): number {
    const times: Record<string, number> = {
      'intent_parser': 2,
      'scout_cluster': 8,
      'alert_sentinel': 3,
      'geo_extractor': 2,
      'analyst': 10,
      'validator': 5,
      'arbitrator': 3,
      'cik_expert': 5,
      'strategy_planner': 4,
      'simulation': 8,
      'sensitivity_analysis': 5,
      'action_advisor': 3,
      'instruction_parser': 5,
      'execution_monitor': 3,
      'memory_agent': 2,
      'review_agent': 5
    };
    return times[agentId] || 5;
  }

  // ==========================================================================
  // 第三阶段：执行计划生成 - 拓扑排序 + 并行分组
  // ==========================================================================
  
  /**
   * 生成执行计划
   */
  generateExecutionPlan(
    dependencyGraph: AgentDependencyGraph,
    schedulingDecision: SchedulingDecision
  ): ExecutionPlan {
    const { nodes, edges } = dependencyGraph;
    const stages: ExecutionPlan['stages'] = [];
    
    // 计算每个节点的入度
    const inDegree: Map<string, number> = new Map();
    const dependents: Map<string, string[]> = new Map();
    
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      dependents.set(node.id, []);
    }
    
    for (const edge of edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      dependents.get(edge.from)?.push(edge.to);
    }
    
    // 拓扑排序，同时分组并行
    const executed = new Set<string>();
    const remaining = new Set(nodes.map(n => n.id));
    
    while (remaining.size > 0) {
      // 找出所有入度为0的节点
      const ready: string[] = [];
      for (const nodeId of remaining) {
        if (inDegree.get(nodeId) === 0) {
          ready.push(nodeId);
        }
      }
      
      if (ready.length === 0) {
        console.warn('[IntelligentScheduler] Circular dependency detected');
        break;
      }
      
      // 限制并行度
      const parallelGroup = ready.slice(0, this.maxParallelism);
      
      stages.push({
        stageId: `stage_${stages.length}`,
        agents: parallelGroup,
        parallel: parallelGroup.length > 1
      });
      
      // 更新状态
      for (const agentId of parallelGroup) {
        executed.add(agentId);
        remaining.delete(agentId);
        
        // 更新依赖此节点的入度
        for (const dep of dependents.get(agentId) || []) {
          inDegree.set(dep, (inDegree.get(dep) || 1) - 1);
        }
      }
    }
    
    return {
      stages,
      checkpoints: this.determineCheckpoints(stages)
    };
  }

  /**
   * 确定检查点
   */
  private determineCheckpoints(stages: ExecutionPlan['stages']): string[] {
    const checkpoints: string[] = [];
    
    // 在层级边界设置检查点
    const layerBoundaries = ['scout_cluster', 'analyst', 'simulation', 'instruction_parser'];
    
    for (const stage of stages) {
      for (const agentId of stage.agents) {
        if (layerBoundaries.includes(agentId)) {
          checkpoints.push(agentId);
        }
      }
    }
    
    return checkpoints;
  }

  // ==========================================================================
  // 第四阶段：动态调整 - 运行时调整执行计划
  // ==========================================================================
  
  /**
   * 动态调整执行计划
   */
  async adjustPlanDynamically(
    currentPlan: ExecutionPlan,
    completedAgent: string,
    result: Partial<AnalysisStateType>,
    state: AnalysisStateType
  ): Promise<{ adjusted: boolean; newPlan?: ExecutionPlan; reason?: string }> {
    
    // 检查是否在检查点
    if (!currentPlan.checkpoints.includes(completedAgent)) {
      return { adjusted: false };
    }
    
    const systemPrompt = `你是动态调度专家，负责根据执行结果调整后续执行计划。

## 可调整的情况

1. **增加智能体**：发现需要额外分析
2. **跳过智能体**：发现某些分析不需要
3. **调整优先级**：改变执行顺序
4. **提前终止**：已获得足够结果

## 输出格式
{
  "adjusted": true或false,
  "actions": ["增加xxx", "跳过xxx"],
  "reason": "调整原因"
}`;

    const userPrompt = `刚完成智能体 ${completedAgent} 的执行，请判断是否需要调整后续计划：

## 执行结果摘要
${JSON.stringify(result).substring(0, 500)}

## 当前状态
- 完成的智能体: ${state.completedAgents?.join(', ')}
- 剩余计划: ${currentPlan.stages.filter(s => !s.agents.every(a => state.completedAgents?.includes(a))).map(s => s.agents.join(',')).join(' → ')}

是否需要调整？`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { model: 'doubao-seed-2-0-pro-260215', temperature: 0.3 });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        if (decision.adjusted) {
          // 根据决策生成新计划
          return { 
            adjusted: true, 
            reason: decision.reason,
            newPlan: currentPlan // 实际应用中需要修改
          };
        }
      }
    } catch (error) {
      console.error('[IntelligentScheduler] adjustPlanDynamically error:', error);
    }
    
    return { adjusted: false };
  }

  // ==========================================================================
  // 主执行方法
  // ==========================================================================
  
  /**
   * 执行智能调度
   */
  async execute(
    initialState: AnalysisStateType,
    callbacks: {
      onStageStart?: (stage: ExecutionPlan['stages'][0]) => void;
      onAgentStart?: (agentId: string) => void;
      onAgentComplete?: (agentId: string, result: any) => void;
      onPlanAdjust?: (reason: string) => void;
    }
  ): Promise<AnalysisStateType> {
    let state = initialState;
    
    // 第一阶段：分析任务需求
    console.log('[IntelligentScheduler] Phase 1: Analyzing task requirements...');
    const schedulingDecision = await this.analyzeTaskRequirements(
      state.query,
      state
    );
    
    console.log('[IntelligentScheduler] Scheduling decision:', {
      agents: schedulingDecision.agentsToExecute,
      groups: schedulingDecision.parallelGroups,
      reasoning: schedulingDecision.reasoning
    });
    
    // 第二阶段：构建依赖图
    console.log('[IntelligentScheduler] Phase 2: Building dependency graph...');
    const dependencyGraph = this.buildDependencyGraph(
      schedulingDecision.agentsToExecute,
      state
    );
    
    // 第三阶段：生成执行计划
    console.log('[IntelligentScheduler] Phase 3: Generating execution plan...');
    let executionPlan = this.generateExecutionPlan(
      dependencyGraph,
      schedulingDecision
    );
    
    console.log('[IntelligentScheduler] Execution plan:', {
      stages: executionPlan.stages.map(s => s.agents).join(' → '),
      checkpoints: executionPlan.checkpoints
    });
    
    // 第四阶段：执行并动态调整
    console.log('[IntelligentScheduler] Phase 4: Executing with dynamic adjustment...');
    
    for (const stage of executionPlan.stages) {
      callbacks.onStageStart?.(stage);
      
      // 跳过已完成的智能体
      const agentsToRun = stage.agents.filter(
        a => !state.completedAgents?.includes(a)
      );
      
      if (agentsToRun.length === 0) continue;
      
      if (stage.parallel && agentsToRun.length > 1) {
        // 并行执行
        const results = await Promise.all(
          agentsToRun.map(async (agentId) => {
            callbacks.onAgentStart?.(agentId);
            const result = await this.executeAgent(agentId, state);
            callbacks.onAgentComplete?.(agentId, result);
            return { agentId, result };
          })
        );
        
        // 合并结果
        for (const { result } of results) {
          state = { ...state, ...result } as AnalysisStateType;
          
          // 检查是否需要动态调整
          if (this.enableDynamicScheduling) {
            const adjustment = await this.adjustPlanDynamically(
              executionPlan,
              results[results.indexOf({ agentId: '', result })].agentId,
              result,
              state
            );
            
            if (adjustment.adjusted && adjustment.newPlan) {
              executionPlan = adjustment.newPlan;
              callbacks.onPlanAdjust?.(adjustment.reason || '');
            }
          }
        }
      } else {
        // 串行执行
        for (const agentId of agentsToRun) {
          callbacks.onAgentStart?.(agentId);
          const result = await this.executeAgent(agentId, state);
          callbacks.onAgentComplete?.(agentId, result);
          state = { ...state, ...result } as AnalysisStateType;
        }
      }
    }
    
    return state;
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
      console.warn(`[IntelligentScheduler] No function for ${agentId}`);
      return { currentAgent: agentId, completedAgents: [agentId] };
    }
    
    try {
      const result = await nodeFn(state, this.llmClient);
      return {
        ...result,
        currentAgent: agentId,
        completedAgents: [...(state.completedAgents || []), agentId]
      };
    } catch (error) {
      console.error(`[IntelligentScheduler] Error executing ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 注册节点函数
   */
  registerNodeFunction(agentId: string, fn: Function): void {
    this.nodeFunctions.set(agentId, fn);
  }

  /**
   * 获取默认调度决策
   */
  private getDefaultSchedulingDecision(): SchedulingDecision {
    return {
      agentsToExecute: [
        'intent_parser', 'scout_cluster', 'analyst', 'cik_expert',
        'simulation', 'instruction_parser', 'execution_monitor'
      ],
      parallelGroups: [
        ['intent_parser'],
        ['scout_cluster'],
        ['analyst', 'cik_expert'],
        ['simulation'],
        ['instruction_parser'],
        ['execution_monitor']
      ],
      skippedAgents: [],
      reasoning: '使用默认标准流程',
      estimatedPath: ['感知', '认知', '决策', '行动']
    };
  }
}
