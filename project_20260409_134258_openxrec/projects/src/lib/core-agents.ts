/**
 * 核心Agent框架 - 三层混合架构
 * 
 * 架构设计：
 * - 协调层：协调器Agent（任务理解、工作流规划、动态调度）
 * - 感知层：搜索Agent、信源评估Agent、时间线Agent
 * - 认知层：因果推理Agent、场景推演Agent、关键因素Agent
 * - 行动层：报告生成Agent、质量检查Agent、可视化Agent
 */

import { LLMClient, SearchClient } from 'coze-coding-dev-sdk';

// ==================== 核心类型定义 ====================

export type AgentLayer = 'coordinator' | 'perception' | 'cognition' | 'action';

export interface AgentTool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
}

export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    agentId: string;
    duration: number;
    tokens?: number;
    timestamp: number;
  };
}

export interface TaskAnalysis {
  intent: string;
  complexity: 'simple' | 'medium' | 'complex';
  domains: string[];
  keyEntities: string[];
  timeScope: string;
}

export interface WorkflowStage {
  agents: string[];
  parallel: boolean;
  description: string;
}

export interface Workflow {
  stages: WorkflowStage[];
  estimatedTime: number;
}

// ==================== 感知层类型 ====================

export interface SearchResult {
  items: Array<{
    title: string;
    content: string;
    source: string;
    url: string;
    timestamp: number;
    type: 'news' | 'official' | 'research' | 'social';
    credibility?: number;
  }>;
  metadata: {
    totalResults: number;
    searchTime: number;
    sourcesUsed: string[];
  };
}

export interface Timeline {
  events: Array<{
    id: string;
    name: string;
    timestamp: number;
    participants: string[];
    impact: string;
    type: string;
    sources: string[];
  }>;
  clusters: any[];
  keyMoments: any[];
}

// ==================== 认知层类型 ====================

export interface CausalNode {
  id: string;
  name: string;
  type: 'root_cause' | 'intermediate' | 'outcome';
  influence: number;
  event?: any;
}

export interface CausalEdge {
  source: string;
  target: string;
  strength: number;
  mechanism: string;
  lag: number;
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  keyDrivers: CausalNode[];
  transmissionPaths: Array<{
    path: string[];
    strength: number;
  }>;
}

export interface Scenario {
  id: string;
  name: string;
  probability: number;
  timeline: any[];
  impacts: any[];
}

// ==================== 行动层类型 ====================

export interface AnalysisReport {
  id: string;
  title: string;
  timestamp: number;
  executiveSummary: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    keyPoints: string[];
  }>;
  conclusions: string[];
  recommendations: string[];
  confidence: number;
}

// ==================== Agent 基类 ====================

export abstract class BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly layer: AgentLayer;
  readonly description: string;
  
  protected llmClient: LLMClient;
  protected tools: Map<string, AgentTool> = new Map();
  
  constructor(config: {
    id: string;
    name: string;
    layer: AgentLayer;
    description: string;
    llmClient: LLMClient;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.layer = config.layer;
    this.description = config.description;
    this.llmClient = config.llmClient;
  }
  
  // 注册工具
  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }
  
  // 执行工具
  async executeTool(name: string, params: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found in agent '${this.id}'`);
    }
    return await tool.execute(params);
  }
  
  // 获取可用工具描述
  getToolDescriptions(): string {
    return Array.from(this.tools.entries())
      .map(([name, tool]) => `- ${name}: ${tool.description}`)
      .join('\n');
  }
  
  // 调用LLM
  protected async callLLM(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: Array<{role: 'system' | 'user' | 'assistant'; content: string}> = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    // 使用stream方法
    const stream = this.llmClient.stream(messages, {
      model: 'doubao-pro-32k',
      temperature: 0.7
    });
    
    let result = '';
    for await (const chunk of stream) {
      result += chunk;
    }
    
    return result;
  }
  
  // 抽象方法：执行任务
  abstract execute(input: any, context?: any): Promise<AgentResult>;
  
  // 创建成功结果
  protected createSuccessResult<T>(data: T, startTime: number): AgentResult<T> {
    return {
      success: true,
      data,
      metadata: {
        agentId: this.id,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    };
  }
  
  // 创建错误结果
  protected createErrorResult(error: string, startTime: number): AgentResult {
    return {
      success: false,
      error,
      metadata: {
        agentId: this.id,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    };
  }
}

// ==================== 协调器Agent ====================

export class CoordinatorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent> = new Map();
  private searchClient: SearchClient;
  
  constructor(llmClient: LLMClient, searchClient: SearchClient) {
    super({
      id: 'coordinator',
      name: '协调器 Agent',
      layer: 'coordinator',
      description: '任务理解、工作流规划、动态调度、结果整合',
      llmClient
    });
    
    this.searchClient = searchClient;
    
    // 注册协调工具
    this.registerTool({
      name: 'analyze_task',
      description: '分析任务复杂度和关键实体',
      execute: async (query: string) => this.analyzeTask(query)
    });
    
    this.registerTool({
      name: 'plan_workflow',
      description: '根据任务分析结果规划工作流',
      execute: async (analysis: TaskAnalysis) => this.planWorkflow(analysis)
    });
  }
  
  // 注册Agent
  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
  }
  
  // 分析任务
  private async analyzeTask(query: string): Promise<TaskAnalysis> {
    const prompt = `分析以下任务，提取关键信息：

任务：${query}

请分析并返回JSON格式：
{
  "intent": "用户意图描述",
  "complexity": "simple|medium|complex",
  "domains": ["涉及领域1", "涉及领域2"],
  "keyEntities": ["关键实体1", "关键实体2"],
  "timeScope": "时间范围"
}

判断复杂度标准：
- simple: 单一事件查询，只需基本信息
- medium: 趋势分析，需要时间线和因果分析
- complex: 深度态势分析，需要全流程分析`;
    
    const response = await this.callLLM(prompt);
    
    try {
      // 提取JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse task analysis:', e);
    }
    
    // 默认返回中等复杂度
    return {
      intent: query,
      complexity: 'medium',
      domains: [],
      keyEntities: [],
      timeScope: 'unknown'
    };
  }
  
  // 规划工作流
  private planWorkflow(analysis: TaskAnalysis): Workflow {
    const stages: WorkflowStage[] = [];
    
    if (analysis.complexity === 'simple') {
      // 简单任务：搜索 → 报告
      stages.push(
        { agents: ['search'], parallel: false, description: '信息搜索' },
        { agents: ['report'], parallel: false, description: '生成报告' }
      );
    } else if (analysis.complexity === 'medium') {
      // 中等任务：搜索 → 时间线 → 因果 → 报告
      stages.push(
        { agents: ['search'], parallel: false, description: '信息搜索' },
        { agents: ['timeline'], parallel: false, description: '构建时间线' },
        { agents: ['causal_inference'], parallel: false, description: '因果推理' },
        { agents: ['report'], parallel: false, description: '生成报告' }
      );
    } else {
      // 复杂任务：完整流程
      stages.push(
        { agents: ['search'], parallel: false, description: '信息搜索' },
        { agents: ['source_evaluator'], parallel: false, description: '信源评估' },
        { agents: ['timeline'], parallel: false, description: '构建时间线' },
        { agents: ['causal_inference'], parallel: false, description: '因果推理' },
        { agents: ['scenario'], parallel: true, description: '场景推演' },
        { agents: ['key_factor'], parallel: true, description: '关键因素识别' },
        { agents: ['report'], parallel: false, description: '生成报告' },
        { agents: ['quality_check'], parallel: true, description: '质量检查' }
      );
    }
    
    return {
      stages,
      estimatedTime: stages.length * 20 // 估算每阶段20秒
    };
  }
  
  // 执行协调
  async execute(input: { query: string }, callback?: (event: any) => void): Promise<AgentResult<AnalysisReport>> {
    const startTime = Date.now();
    
    try {
      callback?.({ type: 'agent_start', agent: this.id, name: this.name });
      
      // 1. 分析任务
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在分析任务...' });
      const analysis = await this.analyzeTask(input.query);
      callback?.({ type: 'task_analysis', agent: this.id, analysis });
      
      // 2. 规划工作流
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在规划工作流...' });
      const workflow = this.planWorkflow(analysis);
      callback?.({ type: 'workflow_planned', agent: this.id, workflow });
      
      // 3. 执行工作流
      const results = new Map<string, any>();
      
      for (let i = 0; i < workflow.stages.length; i++) {
        const stage = workflow.stages[i];
        callback?.({ 
          type: 'stage_start', 
          stage: i + 1, 
          total: workflow.stages.length,
          agents: stage.agents,
          description: stage.description
        });
        
        if (stage.parallel && stage.agents.length > 1) {
          // 并行执行
          const promises = stage.agents.map(async agentId => {
            const agent = this.agents.get(agentId);
            if (!agent) return null;
            
            callback?.({ type: 'agent_start', agent: agentId, name: agent.name });
            const result = await agent.execute({ query: input.query, ...results }, callback);
            callback?.({ type: 'agent_complete', agent: agentId, result });
            
            return { agentId, result };
          });
          
          const stageResults = await Promise.all(promises);
          stageResults.filter(Boolean).forEach((item) => {
            if (item && item.result?.success) {
              results.set(item.agentId, item.result.data);
            }
          });
        } else {
          // 顺序执行
          for (const agentId of stage.agents) {
            const agent = this.agents.get(agentId);
            if (!agent) continue;
            
            callback?.({ type: 'agent_start', agent: agentId, name: agent.name });
            const result = await agent.execute({ query: input.query, ...Object.fromEntries(results) }, callback);
            callback?.({ type: 'agent_complete', agent: agentId, result });
            
            if (result.success) {
              results.set(agentId, result.data);
            }
          }
        }
        
        callback?.({ type: 'stage_complete', stage: i + 1 });
      }
      
      // 4. 获取最终报告
      const report = results.get('report') as AnalysisReport;
      
      callback?.({ type: 'agent_complete', agent: this.id });
      
      return this.createSuccessResult(report, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '协调失败', startTime);
    }
  }
}

// ==================== 搜索Agent ====================

export class SearchAgent extends BaseAgent {
  private searchClient: SearchClient;
  
  constructor(llmClient: LLMClient, searchClient: SearchClient) {
    super({
      id: 'search',
      name: '搜索 Agent',
      layer: 'perception',
      description: '多源信息采集',
      llmClient
    });
    
    this.searchClient = searchClient;
    
    this.registerTool({
      name: 'web_search',
      description: '执行网络搜索',
      execute: async (query: string) => {
        return await this.searchClient.search({ query, count: 10 });
      }
    });
  }
  
  async execute(input: { query: string }, callback?: (event: any) => void): Promise<AgentResult<SearchResult>> {
    const startTime = Date.now();
    
    try {
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在提取关键词...' });
      
      // 1. 关键词提取
      const keywords = await this.extractKeywords(input.query);
      callback?.({ type: 'agent_action', agent: this.id, action: `关键词: ${keywords.join(', ')}` });
      
      // 2. 执行搜索
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在搜索信息...' });
      const searchResults = await this.executeTool('web_search', keywords.join(' '));
      
      // 3. 处理结果
      const result: SearchResult = {
        items: searchResults.results?.map((item: any, index: number) => ({
          title: item.title || `搜索结果 ${index + 1}`,
          content: item.content || item.snippet || '',
          source: item.source || 'unknown',
          url: item.url || '',
          timestamp: Date.now(),
          type: 'news' as const
        })) || [],
        metadata: {
          totalResults: searchResults.results?.length || 0,
          searchTime: Date.now() - startTime,
          sourcesUsed: ['web']
        }
      };
      
      callback?.({ type: 'agent_action', agent: this.id, action: `搜索到 ${result.items.length} 条信息` });
      
      return this.createSuccessResult(result, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '搜索失败', startTime);
    }
  }
  
  private async extractKeywords(query: string): Promise<string[]> {
    const prompt = `从以下查询中提取搜索关键词，返回JSON数组格式：

查询：${query}

返回格式：["关键词1", "关键词2", "关键词3"]

只返回JSON数组，不要其他内容。`;
    
    const response = await this.callLLM(prompt);
    
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse keywords:', e);
    }
    
    // 默认返回原始查询
    return [query];
  }
}

// ==================== 信源评估Agent ====================

export class SourceEvaluatorAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'source_evaluator',
      name: '信源评估 Agent',
      layer: 'perception',
      description: '评估信息可信度，过滤低质量信息',
      llmClient
    });
  }
  
  async execute(input: { search?: SearchResult }, callback?: (event: any) => void): Promise<AgentResult<SearchResult>> {
    const startTime = Date.now();
    
    try {
      if (!input.search?.items?.length) {
        return this.createSuccessResult({ 
          items: [], 
          metadata: {
            totalResults: 0,
            searchTime: 0,
            sourcesUsed: []
          }
        }, startTime);
      }
      
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在评估信息可信度...' });
      
      // 评估每个信息源
      const evaluatedItems = await Promise.all(
        input.search.items.map(async item => {
          const credibility = await this.evaluateCredibility(item);
          return { ...item, credibility };
        })
      );
      
      // 过滤低可信度信息（低于0.5）
      const filteredItems = evaluatedItems.filter(item => item.credibility >= 0.5);
      
      // 按可信度排序
      const sortedItems = filteredItems.sort((a, b) => (b.credibility || 0) - (a.credibility || 0));
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `评估完成，保留 ${sortedItems.length}/${evaluatedItems.length} 条高质量信息` 
      });
      
      return this.createSuccessResult({
        ...input.search,
        items: sortedItems
      }, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '评估失败', startTime);
    }
  }
  
  private async evaluateCredibility(item: any): Promise<number> {
    // 简单评估逻辑（实际应该更复杂）
    const prompt = `评估以下信息的可信度（0-1分）：

标题：${item.title}
来源：${item.source}
内容摘要：${item.content?.substring(0, 200)}

只返回一个0到1之间的数字，不要其他内容。`;
    
    const response = await this.callLLM(prompt);
    const score = parseFloat(response.match(/0\.\d+|1\.0|0|1/)?.[0] || '0.7');
    
    return Math.max(0, Math.min(1, score));
  }
}

// ==================== 时间线Agent ====================

export class TimelineAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'timeline',
      name: '时间线 Agent',
      layer: 'perception',
      description: '构建事件时间脉络',
      llmClient
    });
  }
  
  async execute(input: { search?: SearchResult }, callback?: (event: any) => void): Promise<AgentResult<Timeline>> {
    const startTime = Date.now();
    
    try {
      if (!input.search?.items?.length) {
        return this.createSuccessResult({ events: [], clusters: [], keyMoments: [] }, startTime);
      }
      
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在构建时间线...' });
      
      // 提取事件
      const events = await this.extractEvents(input.search.items);
      
      // 按时间排序
      const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
      
      // 识别关键时刻
      const keyMoments = sortedEvents.filter(e => e.impact === 'high');
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `构建了包含 ${events.length} 个事件的时间线` 
      });
      
      return this.createSuccessResult({
        events: sortedEvents,
        clusters: [],
        keyMoments
      }, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '时间线构建失败', startTime);
    }
  }
  
  private async extractEvents(items: any[]): Promise<any[]> {
    const prompt = `从以下信息中提取关键事件：

${items.map((item, i) => `${i + 1}. ${item.title}: ${item.content?.substring(0, 100)}`).join('\n')}

请提取事件，返回JSON数组格式：
[
  {
    "name": "事件名称",
    "timestamp": 时间戳,
    "participants": ["参与方"],
    "impact": "high|medium|low",
    "type": "政策|市场|冲突|合作"
  }
]

只返回JSON数组。`;
    
    const response = await this.callLLM(prompt);
    
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const events = JSON.parse(jsonMatch[0]);
        return events.map((e: any, i: number) => ({
          id: `event-${i}`,
          ...e,
          sources: [items[i]?.source || 'unknown']
        }));
      }
    } catch (e) {
      console.error('Failed to parse events:', e);
    }
    
    // 返回基础事件列表
    return items.slice(0, 5).map((item, i) => ({
      id: `event-${i}`,
      name: item.title,
      timestamp: Date.now() - i * 86400000, // 假设每天一个事件
      participants: [],
      impact: 'medium',
      type: 'other',
      sources: [item.source]
    }));
  }
}

// ==================== 因果推理Agent ====================

export class CausalInferenceAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'causal_inference',
      name: '因果推理 Agent',
      layer: 'cognition',
      description: '构建因果链，识别传导机制',
      llmClient
    });
  }
  
  async execute(input: { timeline?: Timeline }, callback?: (event: any) => void): Promise<AgentResult<CausalGraph>> {
    const startTime = Date.now();
    
    try {
      if (!input.timeline?.events?.length) {
        return this.createSuccessResult({
          nodes: [],
          edges: [],
          keyDrivers: [],
          transmissionPaths: []
        }, startTime);
      }
      
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在构建因果链...' });
      
      // 构建因果图
      const graph = await this.buildCausalGraph(input.timeline.events);
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `识别了 ${graph.nodes.length} 个节点和 ${graph.edges.length} 条因果链` 
      });
      
      return this.createSuccessResult(graph, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '因果推理失败', startTime);
    }
  }
  
  private async buildCausalGraph(events: any[]): Promise<CausalGraph> {
    const prompt = `分析以下事件之间的因果关系：

${events.map((e, i) => `${i + 1}. ${e.name}`).join('\n')}

请构建因果图，返回JSON格式：
{
  "nodes": [
    {
      "id": "node-1",
      "name": "事件名称",
      "type": "root_cause|intermediate|outcome",
      "influence": 0.8
    }
  ],
  "edges": [
    {
      "source": "node-1",
      "target": "node-2",
      "strength": 0.7,
      "mechanism": "因果机制描述"
    }
  ],
  "keyDrivers": ["node-1", "node-2"]
}

只返回JSON。`;
    
    const response = await this.callLLM(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          nodes: parsed.nodes || [],
          edges: parsed.edges || [],
          keyDrivers: (parsed.keyDrivers || []).map((id: string) => 
            parsed.nodes?.find((n: any) => n.id === id)
          ).filter(Boolean),
          transmissionPaths: []
        };
      }
    } catch (e) {
      console.error('Failed to parse causal graph:', e);
    }
    
    // 返回基础因果图
    const nodes: CausalNode[] = events.slice(0, 5).map((e, i) => ({
      id: `node-${i}`,
      name: e.name,
      type: i === 0 ? 'root_cause' : i === events.length - 1 ? 'outcome' : 'intermediate',
      influence: 1 - i * 0.1,
      event: e
    }));
    
    const edges: CausalEdge[] = nodes.slice(0, -1).map((node, i) => ({
      source: node.id,
      target: nodes[i + 1].id,
      strength: 0.7,
      mechanism: '相关关系',
      lag: 1
    }));
    
    return {
      nodes,
      edges,
      keyDrivers: nodes.slice(0, 2),
      transmissionPaths: []
    };
  }
}

// ==================== 场景推演Agent ====================

export class ScenarioAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'scenario',
      name: '场景推演 Agent',
      layer: 'cognition',
      description: '多场景模拟，概率评估',
      llmClient
    });
  }
  
  async execute(input: { causalGraph?: CausalGraph }, callback?: (event: any) => void): Promise<AgentResult<{ scenarios: Scenario[] }>> {
    const startTime = Date.now();
    
    try {
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在进行场景推演...' });
      
      const scenarios: Scenario[] = [
        { id: 'optimistic', name: '乐观场景', probability: 0.25, timeline: [], impacts: [] },
        { id: 'baseline', name: '基准场景', probability: 0.5, timeline: [], impacts: [] },
        { id: 'pessimistic', name: '悲观场景', probability: 0.25, timeline: [], impacts: [] }
      ];
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `生成了 ${scenarios.length} 个未来场景` 
      });
      
      return this.createSuccessResult({ scenarios }, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '场景推演失败', startTime);
    }
  }
}

// ==================== 关键因素Agent ====================

export class KeyFactorAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'key_factor',
      name: '关键因素 Agent',
      layer: 'cognition',
      description: '识别关键驱动因素',
      llmClient
    });
  }
  
  async execute(input: { causalGraph?: CausalGraph }, callback?: (event: any) => void): Promise<AgentResult<{ factors: any[] }>> {
    const startTime = Date.now();
    
    try {
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在识别关键因素...' });
      
      const factors = input.causalGraph?.keyDrivers || [];
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `识别了 ${factors.length} 个关键驱动因素` 
      });
      
      return this.createSuccessResult({ factors }, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '关键因素识别失败', startTime);
    }
  }
}

// ==================== 报告生成Agent ====================

export class ReportAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'report',
      name: '报告生成 Agent',
      layer: 'action',
      description: '生成结构化分析报告',
      llmClient
    });
  }
  
  async execute(
    input: { 
      query: string;
      search?: SearchResult;
      timeline?: Timeline;
      causalGraph?: CausalGraph;
      scenario?: { scenarios: Scenario[] };
      keyFactor?: { factors: any[] };
    },
    callback?: (event: any) => void
  ): Promise<AgentResult<AnalysisReport>> {
    const startTime = Date.now();
    
    try {
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在生成分析报告...' });
      
      // 生成报告
      const report = await this.generateReport(input);
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: '报告生成完成' 
      });
      
      return this.createSuccessResult(report, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '报告生成失败', startTime);
    }
  }
  
  private async generateReport(input: any): Promise<AnalysisReport> {
    const prompt = `根据以下分析结果，生成一份专业的态势分析报告：

主题：${input.query}

时间线事件：
${input.timeline?.events?.map((e: any) => `- ${e.name}`).join('\n') || '无'}

因果关系：
${input.causalGraph?.edges?.map((e: any) => `- ${e.source} → ${e.target}`).join('\n') || '无'}

请生成结构化报告，包含：
1. 执行摘要（100字以内）
2. 态势概述（200字）
3. 关键事件时间线
4. 因果分析
5. 趋势判断
6. 结论与建议

返回JSON格式：
{
  "executiveSummary": "执行摘要",
  "sections": [
    {"id": "overview", "title": "态势概述", "content": "...", "keyPoints": ["要点1", "要点2"]},
    {"id": "timeline", "title": "时间线", "content": "...", "keyPoints": []},
    {"id": "causal", "title": "因果分析", "content": "...", "keyPoints": []},
    {"id": "trend", "title": "趋势判断", "content": "...", "keyPoints": []}
  ],
  "conclusions": ["结论1", "结论2"],
  "recommendations": ["建议1", "建议2"],
  "confidence": 0.8
}`;
    
    const response = await this.callLLM(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id: `report-${Date.now()}`,
          title: `态势分析报告：${input.query}`,
          timestamp: Date.now(),
          ...parsed
        };
      }
    } catch (e) {
      console.error('Failed to parse report:', e);
    }
    
    // 返回基础报告
    return {
      id: `report-${Date.now()}`,
      title: `态势分析报告：${input.query}`,
      timestamp: Date.now(),
      executiveSummary: `关于"${input.query}"的态势分析已完成。`,
      sections: [
        {
          id: 'overview',
          title: '态势概述',
          content: '基于信息采集和分析，形成以下态势判断。',
          keyPoints: ['信息采集完成', '初步分析完成']
        }
      ],
      conclusions: ['需要进一步深入分析'],
      recommendations: ['持续关注事态发展'],
      confidence: 0.7
    };
  }
}

// ==================== 质量检查Agent ====================

export class QualityCheckAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'quality_check',
      name: '质量检查 Agent',
      layer: 'action',
      description: '审核分析质量，检测矛盾',
      llmClient
    });
  }
  
  async execute(input: { report?: AnalysisReport }, callback?: (event: any) => void): Promise<AgentResult<{ score: number; issues: string[] }>> {
    const startTime = Date.now();
    
    try {
      callback?.({ type: 'agent_thinking', agent: this.id, message: '正在进行质量检查...' });
      
      const issues: string[] = [];
      
      // 检查报告完整性
      if (!input.report?.executiveSummary) {
        issues.push('缺少执行摘要');
      }
      
      if (!input.report?.sections?.length) {
        issues.push('报告内容不完整');
      }
      
      const score = Math.max(0, 1 - issues.length * 0.2);
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `质量评分: ${(score * 100).toFixed(0)}分` 
      });
      
      return this.createSuccessResult({ score, issues }, startTime);
      
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : '质量检查失败', startTime);
    }
  }
}
