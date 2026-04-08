/**
 * 记忆增强的态势分析API
 * 
 * 功能：
 * - SSE流式响应
 * - 真实的Web Search信息检索
 * - 所有数据由智能体分析生成，无硬编码
 */

import { NextRequest } from 'next/server';
import { 
  MemoryManager, 
  AgentStateManager,
  InMemoryStore 
} from '@/lib/memory';
import { LLMClient } from '@/lib/agents/memory-enhanced-agents';
import { SearchClient, Config, HeaderUtils, LLMClient as SDKLLMClient } from 'coze-coding-dev-sdk';
import { buildBasicGraph, GraphGenerationAgent } from '@/lib/graph';

// LLM客户端实现
class SimpleLLMClient implements LLMClient {
  private client: SDKLLMClient;
  
  constructor(customHeaders?: Record<string, string>) {
    const config = new Config();
    this.client = new SDKLLMClient(config, customHeaders);
  }
  
  async chat(messages: Array<{role: string; content: string}>): Promise<string> {
    try {
      const sdkMessages = messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      }));
      
      const response = await this.client.invoke(sdkMessages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7
      });
      
      return response.content || '';
    } catch (error) {
      console.error('LLM chat error:', error);
      throw error;
    }
  }
  
  async *streamChat(messages: Array<{role: string; content: string}>): AsyncIterable<string> {
    const sdkMessages = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content
    }));
    
    try {
      const stream = this.client.stream(sdkMessages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7
      });
      
      for await (const chunk of stream) {
        if (chunk.content) {
          yield chunk.content.toString();
        }
      }
    } catch (error) {
      console.error('LLM stream error:', error);
      throw error;
    }
  }
}

// 创建记忆管理器实例
const memoryStore = new InMemoryStore();
const memoryManager = new MemoryManager(memoryStore);
const agentStateManager = new AgentStateManager(memoryStore);

// Agent流程定义 - 与前端完全一致
const AGENT_WORKFLOW = [
  // 协调层
  { id: 'coordinator', name: '协调器', layer: '协调层', prompt: '任务规划和分解' },
  // 感知层
  { id: 'search', name: '搜索', layer: '感知层', prompt: '多源信息采集' },
  { id: 'source_evaluator', name: '信源评估', layer: '感知层', prompt: '评估信息可信度' },
  { id: 'timeline', name: '时间线', layer: '感知层', prompt: '构建事件时间脉络' },
  // 认知层
  { id: 'causal_inference', name: '因果推理', layer: '认知层', prompt: '构建因果链' },
  { id: 'scenario', name: '场景推演', layer: '认知层', prompt: '多场景模拟' },
  { id: 'key_factor', name: '关键因素', layer: '认知层', prompt: '识别驱动因素' },
  // 行动层
  { id: 'report', name: '报告生成', layer: '行动层', prompt: '生成分析报告' },
  { id: 'quality_check', name: '质量检查', layer: '行动层', prompt: '审核分析质量' }
];

// 执行Web Search获取实时信息
async function performWebSearch(query: string, customHeaders?: Record<string, string>) {
  try {
    const config = new Config();
    const client = new SearchClient(config, customHeaders);
    
    const response = await client.advancedSearch(query, {
      count: 10,
      needSummary: true,
      needContent: true,
      timeRange: '1m',
    });
    
    return {
      summary: response.summary || '',
      items: response.web_items?.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        content: item.content,
        siteName: item.site_name,
        publishTime: item.publish_time,
        authorityLevel: item.auth_info_level,
        authorityDesc: item.auth_info_des,
      })) || [],
    };
  } catch (error) {
    console.error('Web search error:', error);
    return { summary: '', items: [] };
  }
}

// 智能提取JSON的工具函数
function extractJSON(text: string): any {
  if (!text) return null;
  
  try {
    // 尝试直接解析
    return JSON.parse(text);
  } catch {
    // 尝试从markdown代码块提取
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {}
    }
    
    // 尝试找到JSON对象或数组
    const objectMatch = text.match(/\{[\s\S]*\}/);
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {}
    }
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {}
    }
  }
  
  return null;
}

// 执行单个Agent的分析任务
async function executeAgent(
  llmClient: LLMClient,
  agentId: string,
  agentName: string,
  query: string,
  searchResults: any,
  previousResults: Record<string, string>
): Promise<string> {
  const searchInfo = searchResults.items?.slice(0, 10).map((item: any, i: number) => 
    `【${i + 1}】${item.title}\n来源: ${item.siteName || '未知'}\n时间: ${item.publishTime || '未知'}\n摘要: ${item.snippet?.substring(0, 150) || '无'}`
  ).join('\n\n') || '暂无搜索结果';
  
  // 所有Agent的结构化提示词
  const agentPrompts: Record<string, string> = {
    'coordinator': `作为协调器，请分析任务 "${query}"。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "coreObjective": "核心分析目标",
  "keyQuestions": ["问题1", "问题2", "问题3"],
  "analysisPlan": ["步骤1", "步骤2", "步骤3"],
  "expectedOutput": "预期输出描述"
}`,

    'search': `作为搜索Agent，请分析已获取的${searchResults.items?.length || 0}条信息。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "keyFindings": ["发现1", "发现2", "发现3"],
  "mainEvents": ["事件1", "事件2"],
  "mainActors": ["参与者1", "参与者2"],
  "keyTimePoints": ["时间点1", "时间点2"],
  "summary": "信息综合摘要"
}`,

    'source_evaluator': `作为信源评估Agent，请评估信息质量。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "overallCredibility": 0.85,
  "sourceEvaluations": [
    {"source": "来源名称", "authority": 0.9, "timeliness": 0.8, "reliability": "高/中/低"}
  ],
  "informationConsistency": 0.8,
  "recommendation": "可信度评估结论"
}`,

    'timeline': `作为时间线Agent，请构建事件发展脉络。基于搜索结果梳理关键事件。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "events": [
    {
      "timestamp": "2024-01-15",
      "event": "事件名称",
      "description": "事件详细描述",
      "significance": "事件意义",
      "trendChange": "up/down/stable",
      "heatIndex": 85
    }
  ],
  "evolutionSummary": "演化趋势总结",
  "keyTurningPoints": ["转折点1", "转折点2"]
}

注意：
- trendChange: up(上升趋势), down(下降趋势), stable(平稳)
- heatIndex: 0-100的整数，表示事件热度`,

    'causal_inference': `作为因果推理Agent，请分析事件间的因果关系。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "chains": [
    {
      "type": "cause",
      "factor": "根本原因名称",
      "description": "详细描述这个原因如何影响态势",
      "strength": 0.85
    },
    {
      "type": "intermediary",
      "factor": "传导机制名称",
      "description": "详细描述因素间如何传递",
      "strength": 0.65
    },
    {
      "type": "conductor",
      "factor": "放大/削弱因素",
      "description": "详细描述如何强化或削弱影响",
      "strength": 0.50
    },
    {
      "type": "result",
      "factor": "最终影响",
      "description": "详细描述最终产生的影响",
      "strength": 0.75
    }
  ],
  "causalSummary": "因果关系总结"
}

注意：
- type: cause(原因), intermediary(中介), conductor(传导), result(结果)
- strength: 0-1之间的数值，表示因果关系的强度`,

    'scenario': `作为场景推演Agent，请进行多场景分析。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "scenarios": [
    {
      "name": "乐观情景",
      "type": "optimistic",
      "probability": 0.35,
      "description": "详细描述该情景",
      "triggers": ["触发条件1", "触发条件2"],
      "predictions": [
        {"timeframe": "短期(1-3月)", "result": "预测结果"},
        {"timeframe": "中期(3-6月)", "result": "预测结果"}
      ],
      "impacts": [
        {"market": "影响领域", "direction": "up/down/stable", "magnitude": "+10%"}
      ]
    },
    {
      "name": "基准情景",
      "type": "neutral",
      "probability": 0.45,
      "description": "详细描述该情景",
      "triggers": ["触发条件1"],
      "predictions": [{"timeframe": "中期", "result": "预测结果"}],
      "impacts": [{"market": "影响领域", "direction": "stable", "magnitude": "±3%"}]
    },
    {
      "name": "悲观情景",
      "type": "pessimistic",
      "probability": 0.20,
      "description": "详细描述该情景",
      "triggers": ["触发条件1"],
      "predictions": [{"timeframe": "长期", "result": "预测结果"}],
      "impacts": [{"market": "影响领域", "direction": "down", "magnitude": "-15%"}]
    }
  ],
  "sensitivityAnalysis": [
    {"factor": "敏感因素", "change": "变化描述", "probabilityChange": "概率如何变化"}
  ]
}`,

    'key_factor': `作为关键因素Agent，请识别影响态势的关键因素。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "factors": [
    {
      "factor": "因素名称",
      "description": "详细描述该因素的影响机制",
      "dimension": "政治/经济/社会/技术/环境/法律",
      "impact": "positive/negative/neutral",
      "weight": 0.25,
      "trend": "增强/减弱/稳定"
    }
  ],
  "factorInteractions": [
    {"factor1": "因素A", "factor2": "因素B", "interaction": "相互作用描述"}
  ],
  "summary": "关键因素综合分析"
}

注意：
- weight: 0-1之间的数值，表示该因素的重要程度
- impact: positive(正面), negative(负面), neutral(中性)`,

    'report': `作为报告生成Agent，请综合前面的分析生成结构化报告。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "title": "报告标题",
  "executiveSummary": "执行摘要",
  "coreFindings": ["核心发现1", "核心发现2", "核心发现3"],
  "trendJudgment": "趋势判断",
  "riskAssessment": {
    "mainRisks": ["风险1", "风险2"],
    "riskLevel": "高/中/低",
    "mitigationSuggestions": ["建议1", "建议2"]
  },
  "recommendations": ["建议1", "建议2", "建议3"],
  "conclusion": "结论"
}`,

    'quality_check': `作为质量检查Agent，请审核分析的完整性和一致性。

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "completeness": 0.85,
  "consistency": 0.90,
  "logicCoherence": 0.88,
  "evidenceSufficiency": 0.82,
  "issues": [
    {"type": "问题类型", "description": "问题描述", "severity": "高/中/低"}
  ],
  "suggestions": ["改进建议1", "改进建议2"],
  "overallScore": 0.85,
  "approved": true
}`
  };
  
  const systemPrompt = `你是${agentName}专家。请基于实时搜索信息进行专业分析，严格按照JSON格式输出结果，不要包含任何markdown代码块标记。`;
  const userPrompt = agentPrompts[agentId] || `请对 "${query}" 进行分析。`;
  
  const fullPrompt = `${userPrompt}\n\n搜索信息：\n${searchInfo}`;
  
  try {
    const result = await llmClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: fullPrompt }
    ]);
    return result || '{}';
  } catch (error) {
    console.error(`Agent ${agentId} error:`, error);
    return '{}';
  }
}

export async function POST(request: NextRequest) {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  
  const body = await request.json();
  const { query, topic, sessionId } = body;
  
  const actualQuery = query || topic;
  
  if (!actualQuery) {
    return new Response(
      JSON.stringify({ error: '缺少query或topic参数' }),
      { status: 400 }
    );
  }
  
  let currentSessionId = sessionId;
  if (!currentSessionId) {
    currentSessionId = await memoryManager.createSession();
  } else {
    await memoryManager.loadSession(currentSessionId);
  }
  
  await memoryManager.addMessage('user', actualQuery);
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = async (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      try {
        await send({ type: 'start', sessionId: currentSessionId, timestamp: Date.now() });
        
        // Step 1: 搜索
        await send({ type: 'system', message: '🔍 正在进行实时信息检索...', timestamp: Date.now() });
        const searchResults = await performWebSearch(actualQuery, customHeaders);
        await send({ type: 'system', message: `✅ 已获取 ${searchResults.items.length} 条实时信息`, timestamp: Date.now() });
        
        await memoryManager.addMemory({
          type: 'context',
          content: `搜索摘要: ${searchResults.summary}`,
          metadata: { timestamp: Date.now(), importance: 0.9, accessCount: 1, lastAccessed: Date.now() }
        });
        
        const llmClient = new SimpleLLMClient(customHeaders);
        const results: Record<string, string> = {};
        
        // Step 2: 按流程执行每个Agent
        for (let i = 0; i < AGENT_WORKFLOW.length; i++) {
          const agent = AGENT_WORKFLOW[i];
          
          await send({ 
            type: 'agent_start', 
            agent: agent.id, 
            name: agent.name,
            timestamp: Date.now() 
          });
          
          await send({ 
            type: 'agent_thinking', 
            agent: agent.id, 
            message: `正在执行${agent.prompt}...`,
            timestamp: Date.now() 
          });
          
          const result = await executeAgent(llmClient, agent.id, agent.name, actualQuery, searchResults, results);
          results[agent.id] = result;
          
          await send({ 
            type: 'agent_complete', 
            agent: agent.id, 
            result: result.substring(0, 150) + (result.length > 150 ? '...' : ''),
            timestamp: Date.now() 
          });
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Step 3: 构建事件图谱
        let eventGraph;
        try {
          const graphAgent = new GraphGenerationAgent(llmClient);
          eventGraph = await graphAgent.generateGraph(actualQuery, searchResults, results);
        } catch (error) {
          console.error('[Route] Graph generation failed, using basic graph:', error);
          eventGraph = buildBasicGraph(actualQuery, searchResults);
        }
        
        await send({ type: 'event_graph', graph: eventGraph, timestamp: Date.now() });
        
        // Step 4: 从Agent结果中提取结构化数据
        const timeline = buildTimelineFromResults(results, searchResults);
        const keyFactors = buildKeyFactorsFromResults(results);
        const scenarios = buildScenariosFromResults(results);
        const causalChain = buildCausalChainFromResults(results);
        
        // Step 5: 生成最终报告
        const finalReport = generateFinalReport(actualQuery, results, eventGraph);
        await memoryManager.addMessage('assistant', finalReport);
        
        console.log('[Route] Sending complete event');
        console.log('[Route] - timeline:', timeline?.length, 'items');
        console.log('[Route] - keyFactors:', keyFactors?.length, 'items');
        console.log('[Route] - scenarios:', scenarios?.length, 'items');
        console.log('[Route] - causalChain:', causalChain?.length, 'items');
        
        await send({ 
          type: 'complete', 
          data: { 
            report: finalReport, 
            eventGraph, 
            sessionId: currentSessionId,
            timeline: { timeline },
            keyFactors: { keyFactors },
            scenarios: { scenarios },
            causalChain: { causalChain }
          }, 
          timestamp: Date.now() 
        });
        controller.close();
        
      } catch (error) {
        console.error('Analysis error:', error);
        await send({ type: 'error', error: error instanceof Error ? error.message : '分析失败', timestamp: Date.now() });
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
  });
}

// 从时间线Agent结果构建时间线数据
function buildTimelineFromResults(results: Record<string, string>, searchResults: any): any[] {
  const timelineOutput = results['timeline'];
  
  if (timelineOutput) {
    const parsed = extractJSON(timelineOutput);
    
    if (parsed?.events && Array.isArray(parsed.events) && parsed.events.length > 0) {
      console.log('[buildTimelineFromResults] Successfully parsed', parsed.events.length, 'events from LLM');
      return parsed.events.map((event: any) => ({
        timestamp: event.timestamp || event.date || new Date().toISOString(),
        event: event.event || event.name || '',
        situation: event.description || event.situation || '',
        trendChange: event.trendChange || 'stable',
        heatIndex: event.heatIndex || 50,
        significance: event.significance || ''
      }));
    }
  }
  
  // 如果解析失败，返回空数组（不使用硬编码数据）
  console.log('[buildTimelineFromResults] No valid timeline data from LLM');
  return [];
}

// 从关键因素Agent结果构建关键因素数据
function buildKeyFactorsFromResults(results: Record<string, string>): any[] {
  const factorOutput = results['key_factor'];
  
  if (factorOutput) {
    const parsed = extractJSON(factorOutput);
    
    if (parsed?.factors && Array.isArray(parsed.factors) && parsed.factors.length > 0) {
      console.log('[buildKeyFactorsFromResults] Successfully parsed', parsed.factors.length, 'factors from LLM');
      return parsed.factors.map((factor: any) => ({
        factor: factor.factor || factor.name || '',
        description: factor.description || '',
        dimension: factor.dimension || '综合',
        impact: factor.impact || 'neutral',
        weight: typeof factor.weight === 'number' ? factor.weight : 0.5,
        trend: factor.trend || '稳定'
      }));
    }
  }
  
  console.log('[buildKeyFactorsFromResults] No valid key factors data from LLM');
  return [];
}

// 从场景Agent结果构建场景数据
function buildScenariosFromResults(results: Record<string, string>): any[] {
  const scenarioOutput = results['scenario'];
  
  if (scenarioOutput) {
    const parsed = extractJSON(scenarioOutput);
    
    if (parsed?.scenarios && Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0) {
      console.log('[buildScenariosFromResults] Successfully parsed', parsed.scenarios.length, 'scenarios from LLM');
      return parsed.scenarios.map((scenario: any) => ({
        name: scenario.name || '',
        type: scenario.type || 'neutral',
        probability: typeof scenario.probability === 'number' ? scenario.probability : 0.33,
        description: scenario.description || '',
        triggers: scenario.triggers || [],
        predictions: scenario.predictions || [],
        impacts: scenario.impacts || []
      }));
    }
  }
  
  console.log('[buildScenariosFromResults] No valid scenarios data from LLM');
  return [];
}

// 从因果推理Agent结果构建因果链数据
function buildCausalChainFromResults(results: Record<string, string>): any[] {
  const causalOutput = results['causal_inference'];
  
  if (causalOutput) {
    const parsed = extractJSON(causalOutput);
    
    if (parsed?.chains && Array.isArray(parsed.chains) && parsed.chains.length > 0) {
      console.log('[buildCausalChainFromResults] Successfully parsed', parsed.chains.length, 'causal chains from LLM');
      return parsed.chains.map((chain: any) => ({
        type: chain.type || 'intermediary',
        factor: chain.factor || '',
        description: chain.description || '',
        strength: typeof chain.strength === 'number' ? chain.strength : 0.5
      }));
    }
  }
  
  console.log('[buildCausalChainFromResults] No valid causal chain data from LLM');
  return [];
}

// 生成最终报告
function generateFinalReport(query: string, results: Record<string, string>, eventGraph: any): string {
  // 尝试从报告Agent获取结构化报告
  const reportOutput = results['report'];
  const reportData = extractJSON(reportOutput);
  
  if (reportData) {
    return `# ${reportData.title || '宏观态势分析报告'}

## 分析主题
${query}

## 执行摘要
${reportData.executiveSummary || ''}

## 核心发现
${(reportData.coreFindings || []).map((f: string) => `- ${f}`).join('\n')}

## 趋势判断
${reportData.trendJudgment || ''}

## 风险评估
${reportData.riskAssessment?.mainRisks ? 
  `### 主要风险\n${reportData.riskAssessment.mainRisks.map((r: string) => `- ${r}`).join('\n')}\n\n风险等级: ${reportData.riskAssessment.riskLevel || '未知'}` : ''}

## 建议
${(reportData.recommendations || []).map((r: string) => `- ${r}`).join('\n')}

## 结论
${reportData.conclusion || ''}

---
报告时间: ${new Date().toLocaleString('zh-CN')}`;
  }
  
  // 如果解析失败，使用各个Agent的原始输出
  return `# 宏观态势分析报告

## 分析主题
${query}

## 协调器分析
${results['coordinator'] || ''}

## 搜索结果分析
${results['search'] || ''}

## 信源评估
${results['source_evaluator'] || ''}

## 时间线梳理
${results['timeline'] || ''}

## 因果推理
${results['causal_inference'] || ''}

## 场景推演
${results['scenario'] || ''}

## 关键因素
${results['key_factor'] || ''}

## 分析报告
${results['report'] || ''}

## 质量检查
${results['quality_check'] || ''}

---
报告时间: ${new Date().toLocaleString('zh-CN')}`;
}

// GET: 获取会话列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const sessionId = searchParams.get('sessionId');
  
  if (action === 'sessions') {
    const sessions = await memoryManager['store'].listConversations();
    return Response.json({ sessions });
  }
  
  if (action === 'session' && sessionId) {
    const session = await memoryManager.loadSession(sessionId);
    return Response.json({ session });
  }
  
  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
