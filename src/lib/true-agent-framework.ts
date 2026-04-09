/**
 * True Agent Framework - 真正的多智能体框架
 * 
 * 五层智能体架构：
 * 1. 感知层（Perception）- 环境感知、信息采集
 * 2. 认知层（Cognition）- 知识构建、模式识别
 * 3. 决策层（Decision）- 策略制定、方案选择
 * 4. 行动层（Action）- 任务执行、结果输出
 * 5. 进化层（Evolution）- 学习反思、持续优化
 */

import { LLMClient, SearchClient } from 'coze-coding-dev-sdk';

// ==================== 核心类型定义 ====================

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

export interface Message {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: 'observe' | 'perceive' | 'understand' | 'decide' | 'act' | 'reflect' | 'result';
  content: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
}

export interface Memory {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural'; // 情景记忆、语义记忆、程序记忆
  content: string;
  importance: number;
  timestamp: number;
  tags: string[];
}

export interface Belief {
  id: string;
  content: string;
  confidence: number; // 0-1
  source: string;
  timestamp: number;
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  subGoals: Goal[];
}

export interface AgentState {
  status: 'idle' | 'observing' | 'thinking' | 'acting' | 'reflecting' | 'waiting' | 'completed';
  energy: number; // 0-100, 模拟精力
  currentTask: string | null;
  beliefs: Belief[];
  goals: Goal[];
  pendingMessages: Message[];
}

// ==================== True Agent 基类 ====================

export abstract class TrueAgent {
  // 身份
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly layer: 'perception' | 'cognition' | 'decision' | 'action' | 'evolution';
  
  // 能力
  protected tools: Map<string, Tool> = new Map();
  protected memory: Memory[] = [];
  protected state: AgentState;
  
  // 通信
  protected inbox: Message[] = [];
  protected messageBus?: MessageBus;
  
  // LLM
  protected llmClient: LLMClient;
  protected modelConfig: {
    model: string;
    temperature: number;
  };
  
  // 可观测性
  public lastAction: {
    type: string;
    input: any;
    output: any;
    duration: number;
    timestamp: number;
  } | null = null;

  constructor(config: {
    id: string;
    name: string;
    description: string;
    layer: TrueAgent['layer'];
    llmClient: LLMClient;
    model?: string;
    temperature?: number;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.layer = config.layer;
    this.llmClient = config.llmClient;
    this.modelConfig = {
      model: config.model || 'doubao-seed-2-0-pro-260215',
      temperature: config.temperature || 0.7
    };
    this.state = {
      status: 'idle',
      energy: 100,
      currentTask: null,
      beliefs: [],
      goals: [],
      pendingMessages: []
    };
  }
  
  // ==================== 核心能力 ====================
  
  /**
   * 思考 - Agent的核心认知过程
   */
  async think(prompt: string): Promise<string> {
    const messages = [
      { role: 'system' as const, content: this.getSystemPrompt() },
      { role: 'user' as const, content: prompt }
    ];
    
    let result = '';
    const stream = this.llmClient.stream(messages, {
      model: this.modelConfig.model,
      temperature: this.modelConfig.temperature
    });
    
    for await (const chunk of stream) {
      if (chunk.content) {
        result += chunk.content.toString();
      }
    }
    
    return result;
  }
  
  /**
   * 自主决策 - 根据当前状态决定下一步行动
   */
  async decide(observation: any): Promise<{
    thought: string;
    action: string;
    actionInput: any;
    reasoning: string;
    confidence: number;
  }> {
    const prompt = `
## 当前状态
- 角色: ${this.name} (${this.layer}层)
- 任务: ${this.state.currentTask || '无'}
- 能量: ${this.state.energy}%
- 信念数: ${this.state.beliefs.length}
- 目标数: ${this.state.goals.length}

## 观察
${JSON.stringify(observation, null, 2).substring(0, 1000)}

## 可用工具
${this.listTools()}

## 相关记忆
${this.getRelevantMemory(5)}

## 决策要求
基于以上信息，决定你的下一步行动。
可选行动: ${this.getAvailableActions().join(', ')}

请以JSON格式输出：
{
  "thought": "你的思考过程",
  "action": "选择的行动",
  "actionInput": { "参数": "值" },
  "reasoning": "选择理由",
  "confidence": 0.0-1.0
}
`;
    
    const result = await this.think(prompt);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      thought: result,
      action: 'wait',
      actionInput: {},
      reasoning: '无法解析决策结果',
      confidence: 0.5
    };
  }
  
  /**
   * 反思 - 评估行动结果并学习
   */
  async reflect(result: any): Promise<{
    assessment: string;
    lessons: string[];
    adjustments: string[];
    newBeliefs: Belief[];
  }> {
    this.state.status = 'reflecting';
    
    const prompt = `
## 反思任务
作为${this.name}，请反思最近的行动。

## 行动结果
${JSON.stringify(result, null, 2).substring(0, 500)}

## 当前信念
${this.state.beliefs.map(b => `[${b.confidence.toFixed(2)}] ${b.content}`).join('\n')}

## 请回答
1. 这次行动效果如何？
2. 有什么经验教训？
3. 如何调整后续策略？
4. 有什么新的信念需要更新？

以JSON格式输出：
{
  "assessment": "整体评估",
  "lessons": ["教训1", "教训2"],
  "adjustments": ["调整1", "调整2"],
  "newBeliefs": [{"content": "信念内容", "confidence": 0.8, "source": "reflection"}]
}
`;
    
    const reflection = await this.think(prompt);
    const jsonMatch = reflection.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // 更新信念
      if (parsed.newBeliefs) {
        for (const belief of parsed.newBeliefs) {
          this.addBelief(belief.content, belief.confidence, belief.source);
        }
      }
      
      // 保存反思记忆
      this.addMemory('episodic', parsed.assessment, 0.8, ['reflection']);
      
      return parsed;
    }
    
    return {
      assessment: reflection,
      lessons: [],
      adjustments: [],
      newBeliefs: []
    };
  }
  
  // ==================== 工具系统 ====================
  
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
  
  listTools(): string {
    if (this.tools.size === 0) return '无可用工具';
    return Array.from(this.tools.entries())
      .map(([name, tool]) => `- ${name}: ${tool.description}`)
      .join('\n');
  }
  
  async useTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in agent '${this.name}'`);
    }
    
    // 消耗能量
    this.state.energy = Math.max(0, this.state.energy - 5);
    
    const startTime = Date.now();
    const result = await tool.execute(params);
    
    // 记录行动
    this.lastAction = {
      type: 'tool_use',
      input: { toolName, params },
      output: result,
      duration: Date.now() - startTime,
      timestamp: startTime
    };
    
    // 添加观察记忆
    this.addMemory('episodic', `使用工具 ${toolName}: ${JSON.stringify(result).substring(0, 100)}`, 0.6, ['tool', toolName]);
    
    return result;
  }
  
  // ==================== 记忆系统 ====================
  
  addMemory(type: Memory['type'], content: string, importance: number, tags: string[] = []): void {
    this.memory.push({
      id: `${this.id}-mem-${Date.now()}`,
      type,
      content,
      importance,
      timestamp: Date.now(),
      tags
    });
    
    // 记忆管理：保留最近100条 + 高重要性的记忆
    if (this.memory.length > 100) {
      this.memory = this.memory
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 100);
    }
  }
  
  getRelevantMemory(limit: number = 10): string {
    return this.memory
      .sort((a, b) => b.importance * (1 + (Date.now() - b.timestamp) / 86400000) - a.importance * (1 + (Date.now() - a.timestamp) / 86400000))
      .slice(0, limit)
      .map(m => `[${m.type}] ${m.content}`)
      .join('\n');
  }
  
  // ==================== 信念系统 ====================
  
  addBelief(content: string, confidence: number, source: string): void {
    // 检查是否已有相似信念
    const existing = this.state.beliefs.find(b => 
      b.content.toLowerCase().includes(content.toLowerCase()) ||
      content.toLowerCase().includes(b.content.toLowerCase())
    );
    
    if (existing) {
      // 更新置信度
      existing.confidence = (existing.confidence + confidence) / 2;
      existing.timestamp = Date.now();
    } else {
      this.state.beliefs.push({
        id: `${this.id}-belief-${Date.now()}`,
        content,
        confidence,
        source,
        timestamp: Date.now()
      });
    }
  }
  
  // ==================== 目标系统 ====================
  
  addGoal(description: string, priority: number = 1): Goal {
    const goal: Goal = {
      id: `${this.id}-goal-${Date.now()}`,
      description,
      priority,
      status: 'pending',
      subGoals: []
    };
    this.state.goals.push(goal);
    return goal;
  }
  
  // ==================== 通信系统 ====================
  
  setMessageBus(bus: MessageBus): void {
    this.messageBus = bus;
  }
  
  send(to: string | 'broadcast', type: Message['type'], content: any, priority: Message['priority'] = 'medium'): Message {
    const message: Message = {
      id: `${this.id}-msg-${Date.now()}`,
      from: this.id,
      to,
      type,
      content,
      timestamp: Date.now(),
      priority
    };
    
    if (this.messageBus) {
      this.messageBus.send(message);
    }
    
    return message;
  }
  
  receive(message: Message): void {
    this.inbox.push(message);
    this.state.pendingMessages.push(message);
  }
  
  // ==================== 抽象方法 ====================
  
  abstract getSystemPrompt(): string;
  abstract getAvailableActions(): string[];
  abstract handleMessage(message: Message): Promise<void>;
  
  /**
   * 主循环 - Agent的核心执行逻辑
   */
  async run(goal: string, context?: any): Promise<any> {
    this.state.status = 'observing';
    this.state.currentTask = goal;
    this.addGoal(goal, 1);
    
    const maxIterations = 15;
    let iteration = 0;
    let finalResult: any = null;
    
    while (iteration < maxIterations && this.state.energy > 10) {
      // 1. 观察
      const observation = {
        goal,
        context,
        memory: this.getRelevantMemory(5),
        messages: this.state.pendingMessages.slice(-3),
        beliefs: this.state.beliefs.slice(-5),
        energy: this.state.energy
      };
      
      // 2. 决策
      this.state.status = 'thinking';
      const decision = await this.decide(observation);
      
      // 3. 执行行动
      this.state.status = 'acting';
      let actionResult: any;
      
      try {
        if (decision.action === 'use_tool') {
          actionResult = await this.useTool(decision.actionInput.tool, decision.actionInput.params);
        } else if (decision.action === 'send_message') {
          actionResult = this.send(
            decision.actionInput.to,
            decision.actionInput.type,
            decision.actionInput.content
          );
        } else if (decision.action === 'complete') {
          this.state.status = 'completed';
          finalResult = decision.actionInput;
          break;
        } else if (decision.action === 'wait') {
          await new Promise(r => setTimeout(r, 100));
          this.state.energy = Math.min(100, this.state.energy + 5);
        } else {
          // 自定义行动
          actionResult = await this.executeCustomAction(decision.action, decision.actionInput);
        }
      } catch (error) {
        actionResult = { error: error instanceof Error ? error.message : 'Unknown error' };
        this.addBelief(`行动失败: ${decision.action}`, 0.3, 'error');
      }
      
      // 4. 反思（每隔几次迭代）
      if (iteration % 3 === 0 && actionResult) {
        this.state.status = 'reflecting';
        await this.reflect(actionResult);
      }
      
      // 5. 处理消息
      await this.processMessages();
      
      iteration++;
      this.state.energy = Math.max(0, this.state.energy - 3);
    }
    
    return {
      agent: this.id,
      status: this.state.status,
      result: finalResult,
      beliefs: this.state.beliefs,
      lastAction: this.lastAction
    };
  }
  
  async processMessages(): Promise<void> {
    while (this.state.pendingMessages.length > 0) {
      const message = this.state.pendingMessages.shift()!;
      await this.handleMessage(message);
    }
  }
  
  protected async executeCustomAction(action: string, params: any): Promise<any> {
    // 默认实现：记录并返回
    this.addMemory('procedural', `执行行动: ${action}`, 0.5, ['action', action]);
    return { action, params, executed: true };
  }
}

// ==================== 消息总线 ====================

export class MessageBus {
  private agents: Map<string, TrueAgent> = new Map();
  private messageHistory: Message[] = [];
  
  register(agent: TrueAgent): void {
    this.agents.set(agent.id, agent);
    agent.setMessageBus(this);
  }
  
  send(message: Message): void {
    this.messageHistory.push(message);
    
    if (message.to === 'broadcast') {
      // 广播给所有Agent（除了发送者）
      this.agents.forEach((agent, id) => {
        if (id !== message.from) {
          agent.receive(message);
        }
      });
    } else {
      // 发送给特定Agent
      const target = this.agents.get(message.to);
      if (target) {
        target.receive(message);
      }
    }
  }
  
  getHistory(): Message[] {
    return this.messageHistory;
  }
}

// ==================== 感知层 Agent ====================

export class PerceptionAgent extends TrueAgent {
  private searchClient: SearchClient;
  private observations: any[] = [];
  
  constructor(llmClient: LLMClient, searchClient: SearchClient) {
    super({
      id: 'perception-agent',
      name: '感知 Agent',
      description: '负责环境感知和信息采集',
      layer: 'perception',
      llmClient,
      temperature: 0.5
    });
    
    this.searchClient = searchClient;
    this.registerTools();
  }
  
  private registerTools(): void {
    this.registerTool({
      name: 'web_search',
      description: '搜索网络获取信息',
      parameters: {
        query: { type: 'string', description: '搜索关键词' },
        count: { type: 'number', description: '结果数量' }
      },
      execute: async (params) => {
        const result = await this.searchClient.advancedSearch(params.query, {
          searchType: 'web',
          count: params.count || 5,
          needSummary: true
        });
        return result.web_items || [];
      }
    });
    
    this.registerTool({
      name: 'extract_entities',
      description: '从文本中提取实体',
      parameters: {
        text: { type: 'string', description: '待提取文本' }
      },
      execute: async (params) => {
        const prompt = `从以下文本中提取关键实体（人物、组织、地点、时间、事件）：\n\n${params.text}`;
        const result = await this.think(prompt);
        return result;
      }
    });
  }
  
  getSystemPrompt(): string {
    return `你是感知Agent，负责宏观态势分析的第一道关卡。

## 职责
1. 环境感知：监测外部信息源
2. 信息采集：多渠道收集数据
3. 信号识别：发现关键事件和趋势
4. 初步过滤：去除噪声和低价值信息

## 工作原则
- 广泛收集，不遗漏重要信息
- 区分事实与观点
- 标注信息可信度
- 及时发现异常信号

## 输出要求
将感知结果以结构化格式发送给认知Agent。`;
  }
  
  getAvailableActions(): string[] {
    return ['use_tool', 'send_message', 'observe', 'complete', 'wait'];
  }
  
  async handleMessage(message: Message): Promise<void> {
    if (message.type === 'observe') {
      // 收到观察请求，开始采集
      this.state.currentTask = message.content.topic;
    }
  }
  
  async perceive(topic: string, timeRange: string = '3m'): Promise<any> {
    this.state.status = 'observing';
    
    // 执行多维度搜索
    const queries = [topic, `${topic} 最新`, `${topic} 分析`, `${topic} 官方`];
    const allSources: any[] = [];
    
    for (const query of queries) {
      const sources = await this.useTool('web_search', { query, count: 5 });
      allSources.push(...sources);
    }
    
    // 去重和分类
    const uniqueSources = this.deduplicateSources(allSources);
    const classifiedSources = this.classifySources(uniqueSources);
    
    // 提取关键事件
    const keyEvents = await this.extractKeyEvents(uniqueSources);
    
    // 形成感知结果
    const perception = {
      topic,
      timestamp: Date.now(),
      sources: classifiedSources,
      events: keyEvents,
      signals: await this.identifySignals(keyEvents),
      coverage: {
        total: uniqueSources.length,
        byType: this.countByType(classifiedSources)
      }
    };
    
    // 保存到记忆
    this.addMemory('episodic', `感知主题: ${topic}, 采集${uniqueSources.length}个信息源`, 0.9, ['perception', topic]);
    
    // 发送给认知Agent
    this.send('cognition-agent', 'perceive', perception, 'high');
    
    return perception;
  }
  
  private deduplicateSources(sources: any[]): any[] {
    const seen = new Set<string>();
    return sources.filter(s => {
      const key = s.title?.toLowerCase() || s.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  private classifySources(sources: any[]): any[] {
    return sources.map(s => {
      const domain = s.site_name?.toLowerCase() || '';
      let type = 'media';
      let credibility = 3;
      
      if (domain.includes('gov') || domain.includes('央行') || domain.includes('fed')) {
        type = 'official';
        credibility = 5;
      } else if (domain.includes('智库') || domain.includes('institute') || domain.includes('research')) {
        type = 'thinktank';
        credibility = 4;
      } else if (domain.includes('twitter') || domain.includes('微博')) {
        type = 'social';
        credibility = 2;
      }
      
      return { ...s, type, credibility };
    });
  }
  
  private async extractKeyEvents(sources: any[]): Promise<any[]> {
    const events: any[] = [];
    
    for (const source of sources.slice(0, 20)) {
      if (source.publish_time && source.title) {
        events.push({
          timestamp: source.publish_time,
          title: source.title,
          source: source.site_name,
          importance: source.credibility || 3,
          summary: source.summary || source.snippet
        });
      }
    }
    
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  private async identifySignals(events: any[]): Promise<any[]> {
    // 识别异常信号和关键转折点
    const signals: any[] = [];
    
    const prompt = `分析以下事件，识别关键信号和转折点：
    
${JSON.stringify(events.slice(0, 10), null, 2)}

请输出：
{
  "signals": [
    {"type": "信号类型", "description": "描述", "significance": "重要性"}
  ]
}`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed.signals || [];
    }
    
    return signals;
  }
  
  private countByType(sources: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    sources.forEach(s => {
      counts[s.type] = (counts[s.type] || 0) + 1;
    });
    return counts;
  }
}

// ==================== 认知层 Agent ====================

export class CognitionAgent extends TrueAgent {
  private knowledge: Map<string, any> = new Map();
  
  constructor(llmClient: LLMClient) {
    super({
      id: 'cognition-agent',
      name: '认知 Agent',
      description: '负责知识构建和模式识别',
      layer: 'cognition',
      llmClient,
      temperature: 0.6
    });
  }
  
  getSystemPrompt(): string {
    return `你是认知Agent，负责将感知信息转化为结构化知识。

## 职责
1. 知识提取：从原始信息中提取关键知识
2. 模式识别：发现事件间的关联和规律
3. 因果推理：构建因果关系链
4. 知识整合：形成连贯的知识图谱

## 思维框架
- 时间维度：过去→现在→未来
- 逻辑维度：原因→过程→结果
- 空间维度：局部→全局

## 输出要求
构建完整的因果链和知识图谱。`;
  }
  
  getAvailableActions(): string[] {
    return ['analyze', 'reason', 'build_graph', 'send_message', 'complete', 'wait'];
  }
  
  async handleMessage(message: Message): Promise<void> {
    if (message.type === 'perceive') {
      // 收到感知结果，开始认知处理
      await this.cognize(message.content);
    }
  }
  
  async cognize(perception: any): Promise<any> {
    this.state.status = 'thinking';
    
    // 1. 提取知识
    const knowledge = await this.extractKnowledge(perception);
    
    // 2. 识别模式
    const patterns = await this.identifyPatterns(perception.events);
    
    // 3. 构建因果链
    const causalChain = await this.buildCausalChain(perception.topic, perception.events);
    
    // 4. 形成认知
    const cognition = {
      topic: perception.topic,
      timestamp: Date.now(),
      knowledge,
      patterns,
      causalChain,
      insights: await this.generateInsights(knowledge, patterns)
    };
    
    // 保存认知结果
    this.knowledge.set(perception.topic, cognition);
    this.addMemory('semantic', `构建认知: ${perception.topic}`, 0.9, ['cognition', perception.topic]);
    
    // 发送给决策Agent
    this.send('decision-agent', 'understand', cognition, 'high');
    
    return cognition;
  }
  
  private async extractKnowledge(perception: any): Promise<any> {
    const prompt = `从以下感知信息中提取结构化知识：

${JSON.stringify(perception.sources.slice(0, 10), null, 2)}

请提取：
1. 核心概念和定义
2. 关键关系（实体间关系）
3. 重要属性
4. 时间序列信息

以JSON格式输出。`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
  
  private async identifyPatterns(events: any[]): Promise<any[]> {
    const prompt = `分析以下事件序列，识别模式：

${JSON.stringify(events.slice(0, 15), null, 2)}

请识别：
1. 周期性模式
2. 趋势模式
3. 异常模式
4. 关联模式

以JSON格式输出：
{
  "patterns": [
    {"type": "模式类型", "description": "描述", "confidence": 0.8}
  ]
}`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]).patterns || [] : [];
  }
  
  private async buildCausalChain(topic: string, events: any[]): Promise<any> {
    const prompt = `基于以下事件，构建因果链：

主题：${topic}

事件：
${JSON.stringify(events.slice(0, 10), null, 2)}

请构建完整的因果链，包含：
1. 根本原因
2. 直接原因
3. 中介因素
4. 结果
5. 反馈循环

以JSON格式输出：
{
  "causalChain": [
    {
      "id": "节点ID",
      "type": "root_cause|direct_cause|intermediary|result|feedback",
      "factor": "因素",
      "description": "描述",
      "strength": 0.0-1.0,
      "nextNodes": ["下游节点ID"]
    }
  ]
}`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]).causalChain || [] : [];
  }
  
  private async generateInsights(knowledge: any, patterns: any[]): Promise<string[]> {
    const prompt = `基于以下知识和模式，生成洞察：

知识：${JSON.stringify(knowledge).substring(0, 500)}
模式：${JSON.stringify(patterns).substring(0, 500)}

请生成3-5个关键洞察。`;
    
    const result = await this.think(prompt);
    // 简单解析：按行分割，提取洞察
    return result.split('\n').filter(line => line.trim().length > 10).slice(0, 5);
  }
}

// ==================== 决策层 Agent ====================

export class DecisionAgent extends TrueAgent {
  private strategies: Map<string, any> = new Map();
  
  constructor(llmClient: LLMClient) {
    super({
      id: 'decision-agent',
      name: '决策 Agent',
      description: '负责策略制定和方案选择',
      layer: 'decision',
      llmClient,
      temperature: 0.7
    });
  }
  
  getSystemPrompt(): string {
    return `你是决策Agent，负责制定分析策略和选择最优方案。

## 职责
1. 策略制定：生成多个可行方案
2. 风险评估：评估各方案风险
3. 方案选择：综合考虑选择最优方案
4. 资源分配：决定资源投入方向

## 决策原则
- 系统性：考虑全局影响
- 前瞻性：预判未来变化
- 灵活性：保留调整空间
- 稳健性：控制下行风险

## 输出要求
输出决策方案和理由。`;
  }
  
  getAvailableActions(): string[] {
    return ['generate_options', 'evaluate', 'choose', 'send_message', 'complete', 'wait'];
  }
  
  async handleMessage(message: Message): Promise<void> {
    if (message.type === 'understand') {
      // 收到认知结果，开始决策
      await this.decide(message.content);
    }
  }
  
  async decide(cognition: any): Promise<any> {
    this.state.status = 'thinking';
    
    // 1. 生成场景方案
    const scenarios = await this.generateScenarios(cognition);
    
    // 2. 评估方案
    const evaluations = await this.evaluateScenarios(scenarios, cognition);
    
    // 3. 选择最优方案
    const decision = await this.selectOptimal(scenarios, evaluations);
    
    // 4. 制定行动建议
    const recommendations = await this.formulateRecommendations(decision, cognition);
    
    const result = {
      topic: cognition.topic,
      timestamp: Date.now(),
      scenarios,
      evaluations,
      decision,
      recommendations,
      confidence: decision.confidence
    };
    
    // 保存决策
    this.strategies.set(cognition.topic, result);
    this.addMemory('episodic', `制定决策: ${cognition.topic}`, 0.9, ['decision']);
    
    // 发送给行动Agent
    this.send('action-agent', 'decide', result, 'high');
    
    return result;
  }
  
  private async generateScenarios(cognition: any): Promise<any[]> {
    const prompt = `基于以下认知，生成多种可能场景：

${JSON.stringify(cognition, null, 2).substring(0, 1000)}

请生成3种场景（乐观/基准/悲观），包含：
- 触发条件
- 发展路径
- 可能结果
- 发生概率

以JSON格式输出。`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]).scenarios || [] : [];
  }
  
  private async evaluateScenarios(scenarios: any[], cognition: any): Promise<any[]> {
    const evaluations = [];
    
    for (const scenario of scenarios) {
      const prompt = `评估以下场景：

${JSON.stringify(scenario, null, 2)}

请评估：
1. 可能性（0-1）
2. 影响程度（-5到+5）
3. 紧迫性（1-5）
4. 可控性（0-1）

以JSON格式输出。`;
      
      const result = await this.think(prompt);
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        evaluations.push(JSON.parse(match[0]));
      }
    }
    
    return evaluations;
  }
  
  private async selectOptimal(scenarios: any[], evaluations: any[]): Promise<any> {
    // 综合评估选择最优方案
    let bestIndex = 0;
    let bestScore = -Infinity;
    
    evaluations.forEach((eval_, index) => {
      const score = eval_.可能性 * (Math.abs(eval_.影响程度) / 5) * eval_.紧迫性;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    
    return {
      selected: scenarios[bestIndex],
      evaluation: evaluations[bestIndex],
      confidence: bestScore,
      reasoning: '基于可能性、影响度和紧迫性的综合评估'
    };
  }
  
  private async formulateRecommendations(decision: any, cognition: any): Promise<any[]> {
    const prompt = `基于决策结果，制定行动建议：

决策：${JSON.stringify(decision, null, 2)}

请制定具体的行动建议，分短期（1周）、中期（1月）、长期（3月）。

以JSON格式输出。`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]).recommendations || [] : [];
  }
}

// ==================== 行动层 Agent ====================

export class ActionAgent extends TrueAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'action-agent',
      name: '行动 Agent',
      description: '负责执行任务和输出结果',
      layer: 'action',
      llmClient,
      temperature: 0.5
    });
  }
  
  getSystemPrompt(): string {
    return `你是行动Agent，负责将决策转化为具体输出。

## 职责
1. 任务执行：按决策方案执行任务
2. 结果生成：生成分析报告和结论
3. 格式化输出：确保输出清晰易懂
4. 反馈收集：记录执行过程中的发现

## 输出原则
- 准确性：确保信息准确无误
- 完整性：覆盖所有关键内容
- 可读性：结构清晰，易于理解
- 可操作性：提供具体建议

## 输出要求
生成完整的分析报告。`;
  }
  
  getAvailableActions(): string[] {
    return ['execute', 'format', 'output', 'send_message', 'complete', 'wait'];
  }
  
  async handleMessage(message: Message): Promise<void> {
    if (message.type === 'decide') {
      // 收到决策，开始执行
      await this.execute(message.content);
    }
  }
  
  async execute(decision: any): Promise<any> {
    this.state.status = 'acting';
    
    // 1. 生成核心结论
    const conclusion = await this.generateConclusion(decision);
    
    // 2. 生成预警指标
    const indicators = await this.generateIndicators(decision);
    
    // 3. 生成建议
    const recommendations = await this.generateRecommendations(decision);
    
    // 4. 生成风险提示
    const risks = await this.generateRisks(decision);
    
    // 5. 组装报告
    const report = {
      topic: decision.topic,
      timestamp: Date.now(),
      conclusion,
      indicators,
      recommendations,
      risks,
      scenarios: decision.scenarios,
      confidence: decision.confidence
    };
    
    // 保存执行结果
    this.addMemory('episodic', `生成报告: ${decision.topic}`, 0.9, ['action', 'report']);
    
    // 发送给进化Agent进行反思
    this.send('evolution-agent', 'act', report, 'high');
    
    return report;
  }
  
  private async generateConclusion(decision: any): Promise<any> {
    const prompt = `基于以下决策分析，生成核心结论：

${JSON.stringify(decision, null, 2).substring(0, 1000)}

请生成：
1. 一句话核心结论
2. 置信度（high/medium/low）
3. 主要依据

以JSON格式输出。`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { mainConclusion: '分析完成', confidence: 'medium' };
  }
  
  private async generateIndicators(decision: any): Promise<any[]> {
    const prompt = `基于以下分析，生成预警指标：

${JSON.stringify(decision, null, 2).substring(0, 800)}

请生成3-5个关键预警指标，包含：
- 指标名称
- 当前值
- 阈值
- 状态（triggered/approaching/normal）

以JSON格式输出。`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]).indicators || [] : [];
  }
  
  private async generateRecommendations(decision: any): Promise<any[]> {
    const prompt = `基于以下分析，生成行动建议：

${JSON.stringify(decision, null, 2).substring(0, 800)}

请生成具体的行动建议，分短期和中期。

以JSON格式输出。`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]).recommendations || [] : [];
  }
  
  private async generateRisks(decision: any): Promise<string[]> {
    const prompt = `基于以下分析，识别主要风险：

${JSON.stringify(decision, null, 2).substring(0, 800)}

请列出3-5个主要风险。`;
    
    const result = await this.think(prompt);
    return result.split('\n').filter(line => line.trim().length > 5).slice(0, 5);
  }
}

// ==================== 进化层 Agent ====================

export class EvolutionAgent extends TrueAgent {
  private learningHistory: any[] = [];
  
  constructor(llmClient: LLMClient) {
    super({
      id: 'evolution-agent',
      name: '进化 Agent',
      description: '负责学习反思和持续优化',
      layer: 'evolution',
      llmClient,
      temperature: 0.8
    });
  }
  
  getSystemPrompt(): string {
    return `你是进化Agent，负责系统学习和持续优化。

## 职责
1. 反思评估：评估整个分析过程的质量
2. 学习总结：提取可复用的经验
3. 知识更新：更新系统知识库
4. 能力提升：提出改进建议

## 进化方向
- 准确性提升：减少错误判断
- 效率提升：优化分析流程
- 深度提升：增强洞察深度
- 广度提升：扩展分析视野

## 输出要求
输出质量评估和改进建议。`;
  }
  
  getAvailableActions(): string[] {
    return ['reflect', 'learn', 'optimize', 'feedback', 'complete', 'wait'];
  }
  
  async handleMessage(message: Message): Promise<void> {
    if (message.type === 'act') {
      // 收到执行结果，进行反思和进化
      await this.evolve(message.content);
    }
  }
  
  async evolve(report: any): Promise<any> {
    this.state.status = 'reflecting';
    
    // 1. 质量评估
    const quality = await this.assessQuality(report);
    
    // 2. 反思总结
    const reflection = await this.reflect(report);
    
    // 3. 提取学习
    const learning = await this.extractLearning(report, quality);
    
    // 4. 提出改进
    const improvements = await this.proposeImprovements(quality, learning);
    
    const evolution = {
      topic: report.topic,
      timestamp: Date.now(),
      quality,
      reflection,
      learning,
      improvements
    };
    
    // 保存学习历史
    this.learningHistory.push(evolution);
    this.addMemory('semantic', `完成进化: ${report.topic}, 质量得分: ${quality.score}`, 0.9, ['evolution']);
    
    return evolution;
  }
  
  private async assessQuality(report: any): Promise<any> {
    const prompt = `评估以下分析报告的质量：

${JSON.stringify(report, null, 2).substring(0, 1000)}

请从以下维度评估（0-100分）：
1. 完整性：是否覆盖所有关键内容
2. 准确性：信息是否准确
3. 逻辑性：推理是否严密
4. 可操作性：建议是否具体可行
5. 创新性：是否有独特洞察

以JSON格式输出：
{
  "score": 总分,
  "dimensions": {"完整性": 分数, ...},
  "strengths": ["优点"],
  "weaknesses": ["不足"]
}`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { score: 70, dimensions: {}, strengths: [], weaknesses: [] };
  }
  
  private async extractLearning(report: any, quality: any): Promise<any> {
    const prompt = `从以下分析中提取可复用的学习：

报告：${JSON.stringify(report).substring(0, 500)}
质量评估：${JSON.stringify(quality)}

请提取：
1. 成功经验
2. 失败教训
3. 最佳实践
4. 新知识点

以JSON格式输出。`;
    
    const result = await this.think(prompt);
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
  
  private async proposeImprovements(quality: any, learning: any): Promise<string[]> {
    const prompt = `基于质量评估和学习总结，提出改进建议：

质量：${JSON.stringify(quality)}
学习：${JSON.stringify(learning)}

请提出3-5条具体改进建议。`;
    
    const result = await this.think(prompt);
    return result.split('\n').filter(line => line.trim().length > 10).slice(0, 5);
  }
}

// ==================== Agent 编排器 ====================

export class AgentOrchestrator {
  private agents: Map<string, TrueAgent> = new Map();
  private messageBus: MessageBus;
  private llmClient: LLMClient;
  private searchClient: SearchClient;
  
  constructor(llmClient: LLMClient, searchClient: SearchClient) {
    this.llmClient = llmClient;
    this.searchClient = searchClient;
    this.messageBus = new MessageBus();
    
    // 初始化五层Agent
    this.initializeAgents();
  }
  
  private initializeAgents(): void {
    // 感知层
    const perception = new PerceptionAgent(this.llmClient, this.searchClient);
    // 认知层
    const cognition = new CognitionAgent(this.llmClient);
    // 决策层
    const decision = new DecisionAgent(this.llmClient);
    // 行动层
    const action = new ActionAgent(this.llmClient);
    // 进化层
    const evolution = new EvolutionAgent(this.llmClient);
    
    // 注册到消息总线
    this.messageBus.register(perception);
    this.messageBus.register(cognition);
    this.messageBus.register(decision);
    this.messageBus.register(action);
    this.messageBus.register(evolution);
    
    // 保存引用
    this.agents.set('perception', perception);
    this.agents.set('cognition', cognition);
    this.agents.set('decision', decision);
    this.agents.set('action', action);
    this.agents.set('evolution', evolution);
  }
  
  async analyze(topic: string, timeRange: string = '3m', callback?: (event: any) => void): Promise<any> {
    const results: any = {};
    
    try {
      // 1. 感知
      callback?.({ type: 'agent_status', agent: 'perception', status: 'working', message: '感知Agent正在采集信息...' });
      const perception = await (this.agents.get('perception') as PerceptionAgent).perceive(topic, timeRange);
      results.perception = perception;
      callback?.({ type: 'agent_status', agent: 'perception', status: 'completed', result: perception });
      
      // 2. 认知
      callback?.({ type: 'agent_status', agent: 'cognition', status: 'working', message: '认知Agent正在构建知识...' });
      const cognition = await (this.agents.get('cognition') as CognitionAgent).cognize(perception);
      results.cognition = cognition;
      callback?.({ type: 'agent_status', agent: 'cognition', status: 'completed', result: cognition });
      
      // 3. 决策
      callback?.({ type: 'agent_status', agent: 'decision', status: 'working', message: '决策Agent正在制定方案...' });
      const decision = await (this.agents.get('decision') as DecisionAgent).decide(cognition);
      results.decision = decision;
      callback?.({ type: 'agent_status', agent: 'decision', status: 'completed', result: decision });
      
      // 4. 行动
      callback?.({ type: 'agent_status', agent: 'action', status: 'working', message: '行动Agent正在生成报告...' });
      const action = await (this.agents.get('action') as ActionAgent).execute(decision);
      results.action = action;
      callback?.({ type: 'agent_status', agent: 'action', status: 'completed', result: action });
      
      // 5. 进化
      callback?.({ type: 'agent_status', agent: 'evolution', status: 'working', message: '进化Agent正在反思优化...' });
      const evolution = await (this.agents.get('evolution') as EvolutionAgent).evolve(action);
      results.evolution = evolution;
      callback?.({ type: 'agent_status', agent: 'evolution', status: 'completed', result: evolution });
      
      // 最终结果
      const finalResult = {
        topic,
        timestamp: Date.now(),
        ...results,
        conclusion: results.action.conclusion,
        quality: results.evolution.quality
      };
      
      callback?.({ type: 'complete', result: finalResult });
      
      return finalResult;
      
    } catch (error) {
      callback?.({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
  
  getAgent(id: string): TrueAgent | undefined {
    return this.agents.get(id);
  }
  
  getMessageHistory(): Message[] {
    return this.messageBus.getHistory();
  }
}
