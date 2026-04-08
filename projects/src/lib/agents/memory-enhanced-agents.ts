/**
 * 记忆增强Agent框架
 * 
 * 架构设计：感知(Perception) -> 认知(Cognition) -> 决策(Decision) -> 行动(Action)
 * 
 * 特点：
 * - 具备长期记忆和短期记忆
 * - 支持状态持久化和恢复
 * - 具备学习和推理能力
 */

import { 
  MemoryManager, 
  AgentStateManager,
  MemoryEntry,
  ConversationMemory 
} from '../memory/index';

// ==================== Agent类型定义 ====================

export interface AgentCapability {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any, context: AgentContext) => Promise<any>;
}

export interface AgentContext {
  sessionId: string;
  memoryManager: MemoryManager;
  agentStateManager: AgentStateManager;
  llmClient: LLMClient;
  metadata: Record<string, any>;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  personality?: string;
  memoryImportance?: number; // 记忆重要性阈值
  maxHistoryLength?: number; // 最大历史长度
}

export interface AgentThought {
  type: 'perception' | 'cognition' | 'decision' | 'action';
  content: string;
  reasoning?: string;
  confidence: number;
  timestamp: number;
}

// ==================== LLM客户端接口 ====================

export interface LLMClient {
  chat(messages: Array<{role: string; content: string}>): Promise<string>;
  streamChat(messages: Array<{role: string; content: string}>): AsyncIterable<string>;
}

// ==================== 基础Agent类 ====================

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected context: AgentContext;
  
  constructor(config: AgentConfig, context: AgentContext) {
    this.config = config;
    this.context = context;
  }
  
  // 四层架构：感知 -> 认知 -> 决策 -> 行动
  
  async process(input: string): Promise<string> {
    const thoughts: AgentThought[] = [];
    
    try {
      // 1. 感知层：理解输入和上下文
      const perception = await this.perceive(input);
      thoughts.push(perception);
      
      // 2. 认知层：分析和推理
      const cognition = await this.cognize(input, perception);
      thoughts.push(cognition);
      
      // 3. 决策层：选择行动
      const decision = await this.decide(cognition);
      thoughts.push(decision);
      
      // 4. 行动层：执行并生成响应
      const action = await this.act(decision);
      thoughts.push(action);
      
      // 保存思考过程到记忆
      await this.saveThoughts(thoughts);
      
      return action.content;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.handleError(errorMessage);
      throw error;
    }
  }
  
  // 感知层：理解输入
  protected async perceive(input: string): Promise<AgentThought> {
    // 从记忆中检索相关信息
    const relevantMemories = await this.context.memoryManager.recall(input, 3);
    
    // 构建感知提示
    const memoryContext = relevantMemories
      .map(m => m.entry.content)
      .join('\n');
    
    const prompt = `你是一个${this.config.name}。${this.config.personality || ''}
    
用户输入：${input}

相关记忆：
${memoryContext || '无'}

请理解用户的意图和当前上下文。`;

    const response = await this.context.llmClient.chat([
      { role: 'system', content: prompt },
      { role: 'user', content: '分析用户意图和上下文' }
    ]);
    
    return {
      type: 'perception',
      content: response,
      confidence: 0.8,
      timestamp: Date.now()
    };
  }
  
  // 认知层：分析和推理
  protected async cognize(input: string, perception: AgentThought): Promise<AgentThought> {
    const prompt = `基于感知结果：${perception.content}

请进行深入分析：
1. 识别关键要素
2. 建立关联关系
3. 推断潜在意图`;

    const response = await this.context.llmClient.chat([
      { role: 'user', content: prompt }
    ]);
    
    return {
      type: 'cognition',
      content: response,
      reasoning: perception.content,
      confidence: 0.75,
      timestamp: Date.now()
    };
  }
  
  // 决策层：选择行动
  protected async decide(cognition: AgentThought): Promise<AgentThought> {
    const availableActions = this.config.capabilities
      .map(c => `- ${c.name}: ${c.description}`)
      .join('\n');
    
    const prompt = `基于分析：${cognition.content}

可用能力：
${availableActions}

请决定采取的行动和理由。`;

    const response = await this.context.llmClient.chat([
      { role: 'user', content: prompt }
    ]);
    
    return {
      type: 'decision',
      content: response,
      reasoning: cognition.content,
      confidence: 0.7,
      timestamp: Date.now()
    };
  }
  
  // 行动层：执行并生成响应
  protected async act(decision: AgentThought): Promise<AgentThought> {
    const prompt = `基于决策：${decision.content}

请生成最终响应。`;

    const response = await this.context.llmClient.chat([
      { role: 'user', content: prompt }
    ]);
    
    return {
      type: 'action',
      content: response,
      reasoning: decision.content,
      confidence: 0.85,
      timestamp: Date.now()
    };
  }
  
  // 保存思考过程
  protected async saveThoughts(thoughts: AgentThought[]): Promise<void> {
    const content = thoughts
      .map(t => `[${t.type}] ${t.content}`)
      .join('\n\n');
    
    await this.context.memoryManager.addMemory({
      type: 'context',
      content,
      metadata: {
        agentId: this.config.id,
        timestamp: Date.now(),
        importance: this.config.memoryImportance || 0.7,
        accessCount: 1,
        lastAccessed: Date.now()
      }
    });
  }
  
  // 错误处理
  protected async handleError(error: string): Promise<void> {
    await this.context.agentStateManager.saveState({
      agentId: this.config.id,
      sessionId: this.context.sessionId,
      status: 'error',
      intermediateResults: {},
      lastError: error
    });
  }
}

// ==================== 具体Agent实现 ====================

// 态势感知Agent
export class SituationAwarenessAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super({
      id: 'situation-awareness',
      name: '态势感知专家',
      description: '分析宏观态势，识别关键事件和趋势',
      capabilities: [
        {
          name: 'analyze_trend',
          description: '分析趋势发展',
          parameters: { topic: 'string' },
          execute: async (params) => {
            return `分析主题 ${params.topic} 的趋势...`;
          }
        },
        {
          name: 'identify_patterns',
          description: '识别模式和规律',
          parameters: { data: 'any' },
          execute: async (params) => {
            return `识别数据中的模式...`;
          }
        }
      ],
      personality: '你是一个专业、客观的态势分析专家，善于从复杂信息中提炼关键洞察。'
    }, context);
  }
  
  protected async cognize(input: string, perception: AgentThought): Promise<AgentThought> {
    const prompt = `基于感知结果：${perception.content}

作为态势感知专家，请进行：
1. 关键事件识别
2. 影响范围评估
3. 发展趋势预测
4. 风险等级判断`;

    const response = await this.context.llmClient.chat([
      { role: 'user', content: prompt }
    ]);
    
    return {
      type: 'cognition',
      content: response,
      confidence: 0.8,
      timestamp: Date.now()
    };
  }
}

// 情报分析Agent
export class IntelligenceAnalystAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super({
      id: 'intelligence-analyst',
      name: '情报分析专家',
      description: '深度分析情报信息，评估可信度',
      capabilities: [
        {
          name: 'verify_source',
          description: '验证信息来源',
          parameters: { source: 'string' },
          execute: async (params) => {
            return `验证来源 ${params.source}...`;
          }
        },
        {
          name: 'cross_reference',
          description: '交叉验证',
          parameters: { info: 'any' },
          execute: async (params) => {
            return `交叉验证信息...`;
          }
        }
      ],
      personality: '你是一个严谨、细致的情报分析师，擅长发现信息中的矛盾点和关键线索。'
    }, context);
  }
}

// 预测Agent
export class ForecastAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super({
      id: 'forecast',
      name: '趋势预测专家',
      description: '基于历史数据和当前态势进行预测',
      capabilities: [
        {
          name: 'time_series_forecast',
          description: '时间序列预测',
          parameters: { data: 'any', horizon: 'number' },
          execute: async (params) => {
            return `预测未来 ${params.horizon} 期的趋势...`;
          }
        }
      ],
      personality: '你是一个基于数据和逻辑的预测专家，善于在不确定性中寻找规律。'
    }, context);
  }
}

// 决策支持Agent
export class DecisionSupportAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super({
      id: 'decision-support',
      name: '决策支持专家',
      description: '提供决策建议和方案评估',
      capabilities: [
        {
          name: 'evaluate_options',
          description: '评估可选方案',
          parameters: { options: 'any[]' },
          execute: async (params) => {
            return `评估 ${params.options.length} 个方案...`;
          }
        },
        {
          name: 'risk_assessment',
          description: '风险评估',
          parameters: { scenario: 'any' },
          execute: async (params) => {
            return `评估场景风险...`;
          }
        }
      ],
      personality: '你是一个理性、全面的决策顾问，善于权衡利弊和不确定性。'
    }, context);
  }
}

// ==================== Agent工厂 ====================

export class AgentFactory {
  private context: AgentContext;
  
  constructor(context: AgentContext) {
    this.context = context;
  }
  
  createAgent(type: string): BaseAgent {
    switch (type) {
      case 'situation-awareness':
        return new SituationAwarenessAgent(this.context);
      case 'intelligence-analyst':
        return new IntelligenceAnalystAgent(this.context);
      case 'forecast':
        return new ForecastAgent(this.context);
      case 'decision-support':
        return new DecisionSupportAgent(this.context);
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }
  
  listAvailableAgents(): Array<{id: string; name: string; description: string}> {
    return [
      {
        id: 'situation-awareness',
        name: '态势感知专家',
        description: '分析宏观态势，识别关键事件和趋势'
      },
      {
        id: 'intelligence-analyst',
        name: '情报分析专家',
        description: '深度分析情报信息，评估可信度'
      },
      {
        id: 'forecast',
        name: '趋势预测专家',
        description: '基于历史数据和当前态势进行预测'
      },
      {
        id: 'decision-support',
        name: '决策支持专家',
        description: '提供决策建议和方案评估'
      }
    ];
  }
}

// 导出
export { MemoryManager, AgentStateManager };
