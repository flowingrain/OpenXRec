/**
 * 统一分析API入口
 * 
 * 支持：
 * 1. 记忆系统集成
 * 2. 会话上下文管理
 * 3. 多后端切换（TypeScript/Python）
 * 4. SSE流式输出
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query, 
      sessionId,
      backend = 'typescript',
      enableMemory = true,
      userId
    } = body;
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: '请输入分析主题' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // 根据backend参数选择不同的实现
    if (backend === 'python') {
      // 转发到Python后端
      return forwardToPython(query, sessionId, request);
    } else if (enableMemory) {
      // 使用带记忆的TypeScript实现
      return forwardToMemoryEnhanced(query, sessionId, userId);
    } else {
      // 使用标准TypeScript实现
      return forwardToCore(query);
    }
    
  } catch (error) {
    console.error('分析API错误:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * 转发到Python后端
 */
async function forwardToPython(query: string, sessionId?: string, request?: NextRequest) {
  const pythonBackend = process.env.PYTHON_BACKEND_URL || 'http://localhost:8001';
  
  try {
    const response = await fetch(`${pythonBackend}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request?.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        })
      },
      body: JSON.stringify({ 
        topic: query,
        session_id: sessionId 
      })
    });
    
    if (!response.ok) {
      throw new Error(`Python backend error: ${response.status}`);
    }
    
    // 直接流式转发
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
    
  } catch (error) {
    console.error('Python后端连接失败:', error);
    
    // 降级到TypeScript实现
    return forwardToCore(query);
  }
}

/**
 * 转发到记忆增强的TypeScript实现
 */
async function forwardToMemoryEnhanced(query: string, sessionId?: string, userId?: string) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };
      
      try {
        // 动态导入记忆系统
        const { MemoryManager } = await import('@/lib/memory/index');
        const { FileSystemStore } = await import('@/lib/memory/persistent-store');
        const { LLMClient, SearchClient, Config, HeaderUtils } = await import('coze-coding-dev-sdk');
        
        // 初始化记忆系统
        const store = new FileSystemStore();
        const memoryManager = new MemoryManager(store);
        
        // 创建或恢复会话
        const actualSessionId = sessionId || await memoryManager.createSession(userId);
        if (sessionId) {
          await memoryManager.loadSession(sessionId);
        }
        
        // 发送会话信息
        sendEvent('session', {
          sessionId: actualSessionId,
          isNew: !sessionId
        });
        
        // 检索相关记忆
        sendEvent('memory', { action: 'recall', status: 'searching' });
        const relevantMemories = await memoryManager.recall(query, 5);
        
        sendEvent('memory', {
          action: 'recall',
          status: 'found',
          count: relevantMemories.length,
          memories: relevantMemories.map(m => ({
            type: m.entry.type,
            preview: m.entry.content.substring(0, 100),
            relevance: m.relevance.toFixed(2)
          }))
        });
        
        // 获取对话历史
        const history = memoryManager.getHistorySummary(5);
        
        // 初始化LLM客户端
        const config = new Config();
        const llmClient = new LLMClient(config);
        const searchClient = new SearchClient(config);
        
        // 记录用户消息
        await memoryManager.addMessage('user', query);
        
        // 执行搜索
        sendEvent('agent', { agent: 'perception', status: 'running', message: '正在搜索信息...' });
        
        const searchResults = await searchClient.advancedSearch(query, {
          searchType: 'web',
          count: 8,
          needSummary: true
        });
        
        const sources = searchResults.web_items || [];
        sendEvent('agent', { agent: 'perception', status: 'completed', count: sources.length });
        
        // 构建带记忆的提示
        const contextPrompt = buildContextPrompt(query, sources, relevantMemories, history);
        
        // 执行分析
        sendEvent('agent', { agent: 'cognition', status: 'running', message: '正在分析...' });
        
        let analysisResult = '';
        const analysisStream = llmClient.stream([
          { role: 'system', content: getAnalysisSystemPrompt() },
          { role: 'user', content: contextPrompt }
        ], {
          model: 'doubao-pro-32k',
          temperature: 0.6
        });
        
        for await (const chunk of analysisStream) {
          if (chunk.content) {
            analysisResult += chunk.content.toString();
          }
        }
        
        sendEvent('agent', { agent: 'cognition', status: 'completed' });
        
        // 解析结果
        const result = parseAnalysisResult(analysisResult);
        
        // 保存记忆
        await memoryManager.addMemory({
          type: 'fact',
          content: `关于"${query}"的分析结论：${result.core_conclusion || ''}`,
          metadata: {
            timestamp: Date.now(),
            importance: 0.9,
            accessCount: 1,
            lastAccessed: Date.now()
          }
        });
        
        // 更新上下文
        await memoryManager.updateContext({
          topic: query,
          entities: result.entities || []
        });
        
        // 记录助手消息
        await memoryManager.addMessage('assistant', JSON.stringify(result).substring(0, 500));
        
        // 发送最终结果
        sendEvent('result', {
          sessionId: actualSessionId,
          ...result,
          sources: sources.slice(0, 5),
          memoryContext: {
            relevantCount: relevantMemories.length,
            historyLength: history.length
          }
        });
        
        sendEvent('done', { message: '分析完成' });
        
      } catch (error) {
        console.error('分析错误:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : '分析失败'
        });
      } finally {
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

/**
 * 转发到标准TypeScript实现
 */
async function forwardToCore(query: string) {
  // 调用已有的analyze-core实现
  const { POST } = await import('../analyze-core/route');
  
  const mockRequest = new NextRequest('http://localhost/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ topic: query, timeRange: '3m' })
  });
  
  return POST(mockRequest);
}

/**
 * 构建带记忆上下文的提示
 */
function buildContextPrompt(
  query: string,
  sources: any[],
  memories: any[],
  history: string
): string {
  let prompt = `分析主题：${query}\n\n`;
  
  // 添加信息源
  prompt += `信息来源：\n${sources.map((s, i) => 
    `${i + 1}. ${s.title || s.site_name}\n   摘要：${s.summary || s.snippet || '无'}\n   来源：${s.site_name}`
  ).join('\n\n')}\n\n`;
  
  // 添加相关记忆
  if (memories.length > 0) {
    prompt += `相关历史记忆：\n${memories.map(m => 
      `- [${m.entry.type}] ${m.entry.content.substring(0, 150)}`
    ).join('\n')}\n\n`;
  }
  
  // 添加对话历史
  if (history) {
    prompt += `对话历史：\n${history}\n\n`;
  }
  
  prompt += `请进行深度分析，输出JSON格式结果：
{
  "core_conclusion": "核心结论",
  "key_findings": ["发现1", "发现2"],
  "causal_chain": {
    "root_causes": ["根本原因"],
    "direct_causes": ["直接原因"],
    "results": ["结果"]
  },
  "scenarios": [{"name": "场景", "description": "描述", "probability": 0.5}],
  "risk_alerts": [{"risk": "风险", "level": "高/中/低"}],
  "recommendations": {
    "short_term": ["短期建议"],
    "mid_term": ["中期建议"],
    "long_term": ["长期建议"]
  },
  "entities": ["关键实体"]
}`;
  
  return prompt;
}

/**
 * 获取分析系统提示
 */
function getAnalysisSystemPrompt(): string {
  return `你是专业的宏观态势分析专家，擅长：
1. 从多源信息中提取关键洞察
2. 构建因果关系链
3. 场景推演和风险评估
4. 制定决策建议

请基于提供的信息进行深度分析，输出结构化的JSON结果。`;
}

/**
 * 解析分析结果
 */
function parseAnalysisResult(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      return { raw: text };
    }
  }
  return { raw: text };
}
