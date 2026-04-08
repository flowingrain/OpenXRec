/**
 * 聊天API
 * 
 * 功能：
 * - 处理用户反馈和问题
 * - 管理会话记忆
 * - 提供上下文感知的回复
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  MemoryManager,
  InMemoryStore,
  type ConversationMemory 
} from '@/lib/memory';
import { getKnowledgeManager } from '@/lib/knowledge';
import { createLLMClient } from '@/lib/langgraph/nodes';

// 内存存储单例
const memoryStore = new InMemoryStore();
const memoryManager = new MemoryManager(memoryStore);

/**
 * 聊天请求
 */
interface ChatRequest {
  message: string;
  sessionId?: string;
  analysisContext?: {
    query?: string;
    report?: string;
    timeline?: any[];
    keyFactors?: any[];
    scenarios?: any[];
  };
}

/**
 * 聊天响应
 */
interface ChatResponse {
  success: boolean;
  data?: {
    reply: string;
    sessionId: string;
    suggestions?: string[];
    relatedKnowledge?: string[];
  };
  error?: string;
}

/**
 * POST /api/chat
 * 处理聊天消息
 */
export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const body: ChatRequest = await request.json();
    const { message, sessionId, analysisContext } = body;
    
    if (!message) {
      return NextResponse.json({
        success: false,
        error: '消息不能为空'
      }, { status: 400 });
    }
    
    // 创建或加载会话
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = await memoryManager.createSession();
    } else {
      await memoryManager.loadSession(currentSessionId);
    }
    
    // 添加用户消息到记忆
    await memoryManager.addMessage('user', message);
    
    // 获取上下文增强的提示
    const contextualPrompt = memoryManager.getContextualPrompt(message);
    
    // 搜索相关知识
    const knowledgeManager = getKnowledgeManager();
    const knowledgeContext = await knowledgeManager.getKnowledgeContext(message, {
      maxEntries: 3
    });
    
    // 构建系统提示
    let systemPrompt = `你是智弈全域风险态势感知平台的AI助手。你负责：
1. 解答用户关于分析结果的问题
2. 接收用户的反馈和修正建议
3. 提供额外的背景知识和解释
4. 帮助用户理解复杂的经济和政治事件

回复要求：
- 专业但易懂
- 基于事实，避免主观臆断
- 如果不确定，明确说明
- 提供可操作的建议`;

    // 添加分析上下文
    if (analysisContext) {
      systemPrompt += `\n\n当前分析上下文：
原始查询：${analysisContext.query || '未知'}
${analysisContext.report ? `\n分析报告摘要：\n${analysisContext.report.substring(0, 1000)}...` : ''}`;
    }
    
    // 添加知识上下文
    if (knowledgeContext.entries.length > 0) {
      systemPrompt += `\n\n相关领域知识：\n${knowledgeContext.summary}`;
    }
    
    // 添加对话历史
    const historySummary = memoryManager.getHistorySummary(5);
    if (historySummary) {
      systemPrompt += `\n\n对话历史：\n${historySummary}`;
    }
    
    // 创建LLM客户端
    const llmClient = createLLMClient({
      'x-user-id': 'chat-user'
    });
    
    // 调用LLM生成回复
    const response = await llmClient.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ], {
      model: process.env.LLM_MODEL || 'doubao-seed-2-0-pro-260215',
      temperature: 0.7
    });
    
    const reply = response.content || '抱歉，我无法生成回复。请稍后再试。';
    
    // 添加助手回复到记忆
    await memoryManager.addMessage('assistant', reply);
    
    // 生成建议问题
    const suggestions = generateSuggestions(message, analysisContext);
    
    // 提取相关知识标题
    const relatedKnowledge = knowledgeContext.entries
      .slice(0, 3)
      .map(e => e.entry.title);
    
    return NextResponse.json({
      success: true,
      data: {
        reply,
        sessionId: currentSessionId || '',
        suggestions,
        relatedKnowledge
      }
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '处理聊天消息时发生错误'
    }, { status: 500 });
  }
}

/**
 * GET /api/chat
 * 获取会话历史
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (sessionId) {
      // 获取特定会话
      const session = await memoryManager.loadSession(sessionId);
      return NextResponse.json({
        success: true,
        data: session
      });
    } else {
      // 获取所有会话 - 通过store访问
      const sessions = await memoryStore.listConversations();
      return NextResponse.json({
        success: true,
        data: sessions
      });
    }
    
  } catch (error) {
    console.error('Get chat history error:', error);
    return NextResponse.json({
      success: false,
      error: '获取聊天历史失败'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/chat
 * 删除会话
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: '会话ID不能为空'
      }, { status: 400 });
    }
    
    // 通过store访问删除方法
    await memoryStore.deleteConversation(sessionId);
    
    return NextResponse.json({
      success: true,
      message: '会话已删除'
    });
    
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json({
      success: false,
      error: '删除会话失败'
    }, { status: 500 });
  }
}

/**
 * 生成建议问题
 */
function generateSuggestions(
  message: string,
  context?: ChatRequest['analysisContext']
): string[] {
  const suggestions: string[] = [];
  
  // 基于消息内容生成建议
  if (message.includes('场景')) {
    suggestions.push('这些场景的概率是如何计算的？');
    suggestions.push('哪种场景最可能发生？');
  }
  
  if (message.includes('因素')) {
    suggestions.push('还有其他影响因素吗？');
    suggestions.push('这些因素的权重是如何确定的？');
  }
  
  if (message.includes('影响')) {
    suggestions.push('对中国市场有什么具体影响？');
    suggestions.push('对投资者有什么建议？');
  }
  
  // 通用建议
  if (suggestions.length === 0) {
    suggestions.push('可以详细解释一下吗？');
    suggestions.push('这对中国市场意味着什么？');
    suggestions.push('有哪些不确定性因素？');
  }
  
  return suggestions.slice(0, 3);
}
