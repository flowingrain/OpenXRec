/**
 * 真正的多智能体框架设计
 * 
 * 核心特点：
 * 1. Agent是长期存在的实体，有独立状态
 * 2. Agent能自主决策下一步行动
 * 3. Agent有工具调用能力
 * 4. Agent间通过消息通信
 * 5. 支持持久化记忆
 */

// ==================== 工具系统 ====================
interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

// ==================== 消息系统 ====================
interface Message {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: 'task' | 'result' | 'query' | 'feedback' | 'decision';
  content: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
}

// ==================== 记忆系统 ====================
interface MemoryEntry {
  id: string;
  type: 'conversation' | 'observation' | 'reflection' | 'knowledge';
  content: string;
  embedding?: number[];
  metadata: {
    timestamp: number;
    importance: number;
    source: string;
  };
}

// ==================== Agent状态 ====================
interface AgentState {
  status: 'idle' | 'thinking' | 'acting' | 'waiting' | 'completed';
  currentTask: string | null;
  lastAction: string | null;
  pendingMessages: Message[];
}

// ==================== 真正的Agent基类 ====================
abstract class TrueAgent {
  // 身份
  readonly id: string;
  readonly name: string;
  readonly description: string;
  
  // 能力
  protected tools: Map<string, Tool> = new Map();
  protected memory: MemoryEntry[] = [];
  protected state: AgentState;
  
  // 通信
  protected inbox: Message[] = [];
  protected outbox: Message[] = [];
  
  // LLM配置（独立配置）
  protected modelConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
  
  constructor(config: {
    id: string;
    name: string;
    description: string;
    model?: string;
    temperature?: number;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.modelConfig = {
      model: config.model || 'doubao-seed-2-0-pro-260215',
      temperature: config.temperature || 0.7,
      maxTokens: 4096
    };
    this.state = {
      status: 'idle',
      currentTask: null,
      lastAction: null,
      pendingMessages: []
    };
  }
  
  // ==================== 核心能力 ====================
  
  /**
   * 自主决策下一步行动
   * 这是Agent的核心：根据当前状态和目标，自己决定做什么
   */
  async decide(observation: any): Promise<{
    thought: string;
    action: string;
    actionInput: any;
    reasoning: string;
  }> {
    // 构建决策prompt
    const decisionPrompt = this.buildDecisionPrompt(observation);
    
    // 调用LLM思考
    const thought = await this.think(decisionPrompt);
    
    // 解析决策结果
    return this.parseDecision(thought);
  }
  
  /**
   * 反思：评估自己的行动结果
   */
  async reflect(result: any): Promise<{
    assessment: string;
    lessons: string[];
    adjustments: string[];
  }> {
    const reflectionPrompt = `
作为${this.name}，请反思最近的行动：

当前任务：${this.state.currentTask}
行动结果：${JSON.stringify(result).substring(0, 500)}
历史记忆：${this.getRelevantMemory()}

请回答：
1. 这次行动的效果如何？
2. 有什么经验教训？
3. 接下来应该如何调整？
`;
    
    const reflection = await this.think(reflectionPrompt);
    
    // 保存反思结果到记忆
    this.addToMemory({
      type: 'reflection',
      content: reflection,
      metadata: {
        timestamp: Date.now(),
        importance: 0.8,
        source: 'self'
      }
    });
    
    return {
      assessment: reflection,
      lessons: [],
      adjustments: []
    };
  }
  
  // ==================== 工具系统 ====================
  
  /**
   * 注册工具
   */
  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }
  
  /**
   * 列出可用工具
   */
  listTools(): string {
    return Array.from(this.tools.entries())
      .map(([name, tool]) => `- ${name}: ${tool.description}`)
      .join('\n');
  }
  
  /**
   * 执行工具
   */
  async useTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    
    const result = await tool.execute(params);
    
    // 记录工具使用
    this.addToMemory({
      type: 'observation',
      content: `Used tool ${toolName}: ${JSON.stringify(result).substring(0, 200)}`,
      metadata: {
        timestamp: Date.now(),
        importance: 0.6,
        source: toolName
      }
    });
    
    return result;
  }
  
  // ==================== 记忆系统 ====================
  
  /**
   * 添加记忆
   */
  addToMemory(entry: Omit<MemoryEntry, 'id'>) {
    this.memory.push({
      ...entry,
      id: `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    
    // 简单的记忆管理：保留最近100条
    if (this.memory.length > 100) {
      this.memory = this.memory.slice(-100);
    }
  }
  
  /**
   * 获取相关记忆
   */
  getRelevantMemory(limit: number = 10): string {
    // 按重要性排序，返回最近的记忆
    return this.memory
      .sort((a, b) => b.metadata.importance - a.metadata.importance)
      .slice(0, limit)
      .map(m => `[${m.type}] ${m.content}`)
      .join('\n');
  }
  
  // ==================== 通信系统 ====================
  
  /**
   * 发送消息
   */
  send(to: string | 'broadcast', type: Message['type'], content: any, priority: Message['priority'] = 'medium') {
    const message: Message = {
      id: `${this.id}-${Date.now()}`,
      from: this.id,
      to,
      type,
      content,
      timestamp: Date.now(),
      priority
    };
    this.outbox.push(message);
    return message;
  }
  
  /**
   * 接收消息
   */
  receive(message: Message) {
    this.inbox.push(message);
    this.state.pendingMessages.push(message);
  }
  
  /**
   * 处理待处理消息
   */
  async processMessages(): Promise<void> {
    while (this.state.pendingMessages.length > 0) {
      const message = this.state.pendingMessages.shift()!;
      await this.handleMessage(message);
    }
  }
  
  // ==================== 抽象方法 ====================
  
  /**
   * 获取系统提示词
   */
  abstract getSystemPrompt(): string;
  
  /**
   * 处理消息
   */
  abstract handleMessage(message: Message): Promise<void>;
  
  /**
   * 主循环：Agent的核心执行逻辑
   */
  async run(goal: string): Promise<any> {
    this.state.status = 'thinking';
    this.state.currentTask = goal;
    
    let iteration = 0;
    const maxIterations = 10;
    
    while (iteration < maxIterations && this.state.status !== 'completed') {
      // 1. 观察当前状态
      const observation = {
        goal,
        memory: this.getRelevantMemory(),
        messages: this.inbox.slice(-5),
        state: this.state
      };
      
      // 2. 决策
      const decision = await this.decide(observation);
      
      // 3. 执行
      this.state.status = 'acting';
      let result: any;
      
      if (decision.action === 'use_tool') {
        result = await this.useTool(decision.actionInput.tool, decision.actionInput.params);
      } else if (decision.action === 'send_message') {
        result = this.send(
          decision.actionInput.to,
          decision.actionInput.type,
          decision.actionInput.content
        );
      } else if (decision.action === 'complete') {
        this.state.status = 'completed';
        result = decision.actionInput;
      } else {
        // 默认：记录思考
        result = { thought: decision.thought };
      }
      
      // 4. 反思
      await this.reflect(result);
      
      // 5. 处理消息
      await this.processMessages();
      
      iteration++;
    }
    
    return {
      status: this.state.status,
      result: this.memory.filter(m => m.type === 'knowledge').slice(-1)[0]?.content
    };
  }
  
  // ==================== 私有方法 ====================
  
  private buildDecisionPrompt(observation: any): string {
    return `
${this.getSystemPrompt()}

## 当前状态
- 目标: ${observation.goal}
- 状态: ${this.state.status}
- 最近行动: ${this.state.lastAction}

## 可用工具
${this.listTools()}

## 相关记忆
${observation.memory}

## 待处理消息
${observation.messages.map((m: Message) => `[${m.from}] ${m.content}`).join('\n')}

## 请决策
你下一步应该做什么？可选行动：
1. use_tool: 使用工具（需要指定工具名和参数）
2. send_message: 发送消息给其他Agent
3. complete: 完成任务

请以JSON格式输出：
{
  "thought": "你的思考过程",
  "action": "行动类型",
  "actionInput": { /* 行动参数 */ },
  "reasoning": "为什么选择这个行动"
}
`;
  }
  
  private parseDecision(thought: string): any {
    const jsonMatch = thought.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      thought,
      action: 'unknown',
      actionInput: {},
      reasoning: ''
    };
  }
  
  protected abstract think(prompt: string): Promise<string>;
}

// ==================== 示例：信息采集Agent ====================
class TrueInformationAgent extends TrueAgent {
  private llmClient: any; // LLMClient
  private searchClient: any; // SearchClient
  
  constructor(llmClient: any, searchClient: any) {
    super({
      id: 'information-agent',
      name: '信息采集Agent',
      description: '负责多源信息搜索和评估',
      temperature: 0.5
    });
    
    this.llmClient = llmClient;
    this.searchClient = searchClient;
    
    // 注册工具
    this.registerTool({
      name: 'web_search',
      description: '搜索网络获取信息',
      parameters: {
        query: { type: 'string', description: '搜索关键词' },
        count: { type: 'number', description: '结果数量' }
      },
      execute: async (params) => {
        return await this.searchClient.advancedSearch(params.query, {
          searchType: 'web',
          count: params.count || 5
        });
      }
    });
    
    this.registerTool({
      name: 'evaluate_source',
      description: '评估信息源可信度',
      parameters: {
        source: { type: 'object', description: '信息源信息' }
      },
      execute: async (params) => {
        // 基于规则评估
        const domain = params.source.site_name?.toLowerCase() || '';
        let credibility = 3;
        if (domain.includes('gov') || domain.includes('央行')) {
          credibility = 5;
        } else if (domain.includes('智库') || domain.includes('institute')) {
          credibility = 4;
        }
        return { ...params.source, credibility };
      }
    });
  }
  
  getSystemPrompt(): string {
    return `你是信息采集Agent，专业的信息收集和评估专家。

你的职责：
- 使用 web_search 工具搜索相关信息
- 使用 evaluate_source 工具评估信息源可信度
- 整理关键事件和信息
- 发送结果给其他Agent

决策原则：
1. 优先搜索官方和权威来源
2. 交叉验证重要信息
3. 标记信息空白点
4. 按重要性排序结果`;
  }
  
  async handleMessage(message: Message): Promise<void> {
    if (message.type === 'task') {
      // 收到任务，开始工作
      this.state.currentTask = message.content.topic;
      this.addToMemory({
        type: 'conversation',
        content: `收到任务: ${message.content.topic}`,
        metadata: {
          timestamp: Date.now(),
          importance: 0.9,
          source: message.from
        }
      });
    }
  }
  
  protected async think(prompt: string): Promise<string> {
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
}

export { TrueAgent, TrueInformationAgent };
export type { Tool, Message, MemoryEntry };
