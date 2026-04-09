/**
 * 聊天反馈API
 * 
 * 功能：
 * - 通过 LangGraph Chat 智能体处理用户问答和反馈
 * - 支持反馈循环（重新分析）
 * - 存储有效反馈到数据库用于模型进化
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createLLMClient,
  chatNode
} from '@/lib/langgraph/nodes';
import { AnalysisStateType, ChatMessage, FeedbackType } from '@/lib/langgraph/state';
import { getKnowledgeManager } from '@/lib/knowledge';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 聊天请求
 */
interface ChatRequest {
  message: string;
  caseId?: string | null;  // 案例ID，用于存储反馈
  sessionId?: string;
  analysisContext: {
    query: string;
    searchResults?: any[];
    timeline?: any[];
    causalChain?: any[];
    keyFactors?: any[];
    scenarios?: any[];
    finalReport?: string;
  };
  chatHistory?: ChatMessage[];
}

/**
 * POST /api/chat-feedback
 * 处理聊天反馈，通过 Chat 智能体执行
 */
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, caseId, analysisContext, chatHistory = [] } = body;
    
    if (!message) {
      return NextResponse.json({
        success: false,
        error: '消息不能为空'
      }, { status: 400 });
    }
    
    // 创建 LLM 客户端
    const llmClient = createLLMClient({
      'x-user-id': 'chat-feedback-user'
    });
    
    // 构建状态
    const state: Partial<AnalysisStateType> = {
      query: analysisContext.query || '',
      userFeedback: message,
      chatMessages: chatHistory,
      analysisPhase: 'feedback',
      searchResults: analysisContext.searchResults || [],
      timeline: analysisContext.timeline || [],
      causalChain: analysisContext.causalChain || [],
      keyFactors: analysisContext.keyFactors || [],
      scenarios: analysisContext.scenarios || [],
      finalReport: analysisContext.finalReport || '',
    };
    
    // 执行 Chat 智能体节点
    const result = await chatNode(state as AnalysisStateType, llmClient);
    
    // 提取结果
    const reply = result.chatOutput || '抱歉，我无法处理您的请求。';
    const feedbackType = result.feedbackType || 'question';
    const needsReanalysis = result.needsReanalysis || false;
    const feedbackTarget = result.feedbackTarget || '';
    
    // 获取最新聊天消息
    const lastMessage = result.chatMessages?.[result.chatMessages.length - 1];
    
    // 生成建议问题
    const suggestions = generateSuggestions(feedbackType, feedbackTarget);
    
    // 存储有效反馈到数据库（仅当有 caseId 且反馈类型有效时）
    const validFeedbackTypes = ['correction', 'supplement', 'deep_dive'];
    let feedbackStored = false;
    
    if (caseId && validFeedbackTypes.includes(feedbackType)) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          // 存储到 user_feedbacks 表
          const { error: insertError } = await supabase.from('user_feedbacks').insert({
            case_id: caseId,
            feedback_type: feedbackType,
            comment: message,  // 用户反馈内容
            aspects: {
              needs_reanalysis: needsReanalysis,
              target_agent: feedbackTarget,
              source: 'chat_panel'
            },
          });
          
          if (insertError) {
            console.warn('[ChatFeedback] 反馈存储失败:', insertError.message);
          } else {
            feedbackStored = true;
            console.log(`[ChatFeedback] 反馈已存储: caseId=${caseId}, type=${feedbackType}`);
          }
        }
      } catch (storageError) {
        // 存储失败不影响主流程
        console.warn('[ChatFeedback] 反馈存储异常:', storageError);
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        reply,
        feedbackType,
        needsReanalysis,
        feedbackTarget,
        chatMessage: lastMessage,
        suggestions,
        feedbackStored: !!caseId && validFeedbackTypes.includes(feedbackType)
      }
    });
    
  } catch (error) {
    console.error('Chat feedback API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '处理聊天反馈时发生错误'
    }, { status: 500 });
  }
}

/**
 * 生成建议问题
 */
function generateSuggestions(feedbackType: FeedbackType, target: string): string[] {
  const suggestions: string[] = [];
  
  switch (feedbackType) {
    case 'question':
      suggestions.push('可以详细解释一下吗？');
      suggestions.push('这对中国市场意味着什么？');
      suggestions.push('有哪些不确定性因素？');
      break;
      
    case 'correction':
      suggestions.push('重新分析这个方面');
      suggestions.push('查看原始数据来源');
      suggestions.push('修正后继续分析');
      break;
      
    case 'supplement':
      suggestions.push('补充更多信息');
      suggestions.push('结合新信息重新分析');
      suggestions.push('继续当前分析');
      break;
      
    case 'deep_dive':
      suggestions.push('深入分析原因');
      suggestions.push('查看相关事件');
      suggestions.push('分析潜在影响');
      break;
      
    case 'rerun':
      suggestions.push('确认重新分析');
      suggestions.push('调整分析参数');
      suggestions.push('取消重新分析');
      break;
      
    default:
      suggestions.push('可以详细解释一下吗？');
      suggestions.push('这对中国市场意味着什么？');
      suggestions.push('有哪些不确定性因素？');
  }
  
  return suggestions.slice(0, 3);
}
