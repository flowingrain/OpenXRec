/**
 * 创建自定义智能体示例
 * 
 * 本文件展示如何创建新的智能体
 */

import { LLMClient, SearchClient } from 'coze-coding-dev-sdk';
import { BaseAgent, AgentResult } from './core-agents';

// ==================== 示例1：情感分析智能体 ====================

/**
 * 情感分析Agent - 分析文本情感倾向
 */
export class SentimentAnalysisAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'sentiment_analysis',
      name: '情感分析 Agent',
      layer: 'cognition',  // 属于认知层
      description: '分析文本情感倾向，识别正面/负面/中性情绪',
      llmClient
    });
    
    // 注册工具（可选）
    this.registerTool({
      name: 'analyze_sentiment',
      description: '分析文本情感',
      execute: async (text: string) => {
        return this.performSentimentAnalysis(text);
      }
    });
  }
  
  /**
   * 执行入口 - 必须实现
   */
  async execute(input: { text: string }, callback?: (event: any) => void): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      // 发送思考事件
      callback?.({ 
        type: 'agent_thinking', 
        agent: this.id, 
        message: '正在分析文本情感...' 
      });
      
      // 调用LLM进行情感分析
      const result = await this.performSentimentAnalysis(input.text);
      
      // 发送动作事件
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `情感分析完成：${result.sentiment} (${result.confidence.toFixed(2)})` 
      });
      
      return this.createSuccessResult(result, startTime);
      
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : '情感分析失败',
        startTime
      );
    }
  }
  
  /**
   * 具体业务逻辑
   */
  private async performSentimentAnalysis(text: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    keywords: string[];
  }> {
    const prompt = `分析以下文本的情感倾向：

"${text}"

请以JSON格式返回：
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.0-1.0,
  "keywords": ["关键词1", "关键词2"]
}

只返回JSON，不要其他内容。`;

    const response = await this.callLLM(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse sentiment:', e);
    }
    
    return {
      sentiment: 'neutral',
      confidence: 0.5,
      keywords: []
    };
  }
}

// ==================== 示例2：实体识别智能体 ====================

/**
 * 实体识别Agent - 从文本中提取命名实体
 */
export class EntityRecognitionAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'entity_recognition',
      name: '实体识别 Agent',
      layer: 'perception',  // 属于感知层
      description: '识别文本中的人物、组织、地点、时间等命名实体',
      llmClient
    });
  }
  
  async execute(input: { text: string }, callback?: (event: any) => void): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      callback?.({ 
        type: 'agent_thinking', 
        agent: this.id, 
        message: '正在识别命名实体...' 
      });
      
      const entities = await this.extractEntities(input.text);
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `识别到 ${entities.length} 个实体` 
      });
      
      return this.createSuccessResult({ entities }, startTime);
      
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : '实体识别失败',
        startTime
      );
    }
  }
  
  private async extractEntities(text: string): Promise<Array<{
    type: string;
    name: string;
    context?: string;
  }>> {
    const prompt = `从以下文本中提取命名实体：

"${text}"

请以JSON数组格式返回：
[
  {"type": "person|organization|location|date|event", "name": "实体名称", "context": "上下文"}
]

只返回JSON数组，不要其他内容。`;

    const response = await this.callLLM(prompt);
    
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse entities:', e);
    }
    
    return [];
  }
}

// ==================== 示例3：数据可视化智能体 ====================

/**
 * 数据可视化Agent - 生成可视化配置
 */
export class DataVisualizationAgent extends BaseAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'data_visualization',
      name: '数据可视化 Agent',
      layer: 'action',  // 属于行动层
      description: '根据数据生成可视化图表配置',
      llmClient
    });
    
    // 注册图表生成工具
    this.registerTool({
      name: 'generate_chart',
      description: '生成图表配置',
      execute: async (params: { data: any; type: string }) => {
        return this.generateChartConfig(params.data, params.type);
      }
    });
  }
  
  async execute(input: { 
    data: any[]; 
    title?: string;
    chartType?: 'line' | 'bar' | 'pie' | 'scatter';
  }, callback?: (event: any) => void): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      callback?.({ 
        type: 'agent_thinking', 
        agent: this.id, 
        message: '正在分析数据特征...' 
      });
      
      // 自动判断最佳图表类型
      const chartType = input.chartType || await this.recommendChartType(input.data);
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: `选择 ${chartType} 图表类型` 
      });
      
      // 生成图表配置
      const config = await this.generateChartConfig(input.data, chartType);
      
      return this.createSuccessResult({
        chartType,
        config,
        title: input.title || '数据分析图表'
      }, startTime);
      
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : '可视化生成失败',
        startTime
      );
    }
  }
  
  private async recommendChartType(data: any[]): Promise<string> {
    const prompt = `根据以下数据特征，推荐最适合的图表类型：

数据样本：${JSON.stringify(data.slice(0, 5))}

可选类型：line, bar, pie, scatter

只返回图表类型名称，不要其他内容。`;

    const response = await this.callLLM(prompt);
    
    if (response.includes('line')) return 'line';
    if (response.includes('bar')) return 'bar';
    if (response.includes('pie')) return 'pie';
    if (response.includes('scatter')) return 'scatter';
    
    return 'bar'; // 默认
  }
  
  private async generateChartConfig(data: any[], type: string): Promise<any> {
    // 这里可以生成ECharts/Chart.js等图表配置
    // 简化示例，实际应该更复杂
    return {
      type,
      data,
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true }
        }
      }
    };
  }
}

// ==================== 示例4：记忆增强智能体 ====================

/**
 * 记忆增强Agent - 带持久化记忆的智能体
 */
import { MemoryManager } from './memory/index';

export class MemoryEnhancedCustomAgent extends BaseAgent {
  private memoryManager: MemoryManager;
  
  constructor(llmClient: LLMClient, memoryManager: MemoryManager) {
    super({
      id: 'memory_custom',
      name: '记忆增强 Agent',
      layer: 'cognition',
      description: '具有记忆能力的智能体，可以记住历史对话和上下文',
      llmClient
    });
    
    this.memoryManager = memoryManager;
  }
  
  async execute(input: { query: string }, callback?: (event: any) => void): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      // 1. 检索相关记忆
      callback?.({ 
        type: 'agent_thinking', 
        agent: this.id, 
        message: '正在检索历史记忆...' 
      });
      
      const memories = await this.memoryManager.recall(input.query, 5);
      
      // 2. 构建带记忆的提示
      const memoryContext = memories.length > 0
        ? `\n\n相关历史记忆：\n${memories.map(m => `- ${m.entry.content}`).join('\n')}`
        : '';
      
      // 3. 调用LLM
      const prompt = `基于以下信息回答问题：

${memoryContext}

当前问题：${input.query}`;

      const response = await this.callLLM(prompt);
      
      // 4. 保存新的记忆
      await this.memoryManager.addMemory({
        type: 'conversation',
        content: `Q: ${input.query} A: ${response.substring(0, 200)}`,
        metadata: {
          timestamp: Date.now(),
          importance: 0.7,
          accessCount: 1,
          lastAccessed: Date.now()
        }
      });
      
      callback?.({ 
        type: 'agent_action', 
        agent: this.id, 
        action: '已保存对话到记忆' 
      });
      
      return this.createSuccessResult({
        response,
        memoriesUsed: memories.length
      }, startTime);
      
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : '处理失败',
        startTime
      );
    }
  }
}

// ==================== 使用示例 ====================

/**
 * 如何使用自定义Agent
 */
export async function exampleUsage() {
  // 1. 初始化LLM客户端
  const { Config } = require('coze-coding-dev-sdk');
  const config = new Config();
  const llmClient = new LLMClient(config);
  
  // 2. 创建Agent实例
  const sentimentAgent = new SentimentAnalysisAgent(llmClient);
  const entityAgent = new EntityRecognitionAgent(llmClient);
  const vizAgent = new DataVisualizationAgent(llmClient);
  
  // 3. 执行Agent（独立执行）
  const sentimentResult = await sentimentAgent.execute({
    text: '今天天气真好，心情很愉快！'
  }, (event) => {
    console.log(`[${event.type}] ${event.message || event.action || ''}`);
  });
  
  console.log('情感分析结果:', sentimentResult.data);
  
  // 4. 链式执行多个Agent
  const text = '苹果公司CEO蒂姆·库克宣布新产品将于2024年发布';
  
  // 先识别实体
  const entityResult = await entityAgent.execute({ text });
  console.log('识别的实体:', entityResult.data?.entities);
  
  // 再分析情感
  const textSentiment = await sentimentAgent.execute({ text });
  console.log('文本情感:', textSentiment.data?.sentiment);
  
  // 5. 注册到协调器
  const { CoordinatorAgent, SearchAgent } = require('./core-agents');
  const searchClient = new SearchClient(config);
  
  const coordinator = new CoordinatorAgent(llmClient, searchClient);
  coordinator.registerAgent(sentimentAgent);
  coordinator.registerAgent(entityAgent);
  coordinator.registerAgent(vizAgent);
  
  // 现在这些Agent可以参与完整的分析流程了！
}

// 导出所有自定义Agent
export default {
  SentimentAnalysisAgent,
  EntityRecognitionAgent,
  DataVisualizationAgent,
  MemoryEnhancedCustomAgent
};
