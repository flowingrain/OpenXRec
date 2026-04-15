/**
 * 聊天面板组件
 * 
 * 功能：
 * - 显示聊天消息历史
 * - 支持用户输入和发送消息
 * - 显示建议问题
 * - 支持展开/收起
 * - Markdown 渲染支持
 * - 通过 Chat 智能体处理反馈
 * - 支持反馈循环（触发重新分析）
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageCircle, 
  Send, 
  Bot, 
  User, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Lightbulb,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    agentId?: string;
    feedbackType?: string;
    targetNode?: string;
  };
}

/**
 * 反馈类型
 */
type FeedbackType = 'question' | 'correction' | 'supplement' | 'deep_dive' | 'rerun';

type RecommendationFeedbackContext = {
  userId: string;
  itemId: string;
  strategy?: string;
  position?: number;
  explanationType?: string;
};

/**
 * 聊天面板属性
 */
export interface ChatPanelProps {
  analysisContext?: {
    query?: string;
    searchResults?: any[];
    timeline?: any[];
    causalChain?: any[];
    keyFactors?: any[];
    scenarios?: any[];
    finalReport?: string;
    userId?: string;
    itemId?: string;
    strategy?: string;
    position?: number;
    explanationType?: string;
  };
  caseId?: string | null;  // 案例ID，用于存储反馈
  /** 推荐多轮会话时传入：将随 /api/chat-feedback 一并上送 */
  recommendationContext?: RecommendationFeedbackContext;
  onReanalysis?: (targetNode: string) => void;
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * 聊天面板组件
 */
export function ChatPanel({
  analysisContext,
  caseId,
  recommendationContext,
  onReanalysis,
  className,
  defaultExpanded = true
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [feedbackInfo, setFeedbackInfo] = useState<{
    type: FeedbackType;
    needsReanalysis: boolean;
    targetNode: string;
  } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const inferRecommendationPolarity = (
    text: string
  ): 'like' | 'dislike' | undefined => {
    const t = text.trim();
    if (!t) return undefined;
    if (/(同意|认可|没问题|正确|有帮助|赞同|靠谱|满意|喜欢)/.test(t)) return 'like';
    if (/(不同意|反对|不认可|不相关|没帮助|离题|不满意|差评|不喜欢)/.test(t)) return 'dislike';
    return undefined;
  };

  const resolveRecommendationContext = (): RecommendationFeedbackContext | undefined => {
    if (recommendationContext?.userId && recommendationContext?.itemId) {
      return recommendationContext;
    }

    if (analysisContext?.userId && analysisContext?.itemId) {
      return {
        userId: String(analysisContext.userId),
        itemId: String(analysisContext.itemId),
        strategy: analysisContext.strategy ? String(analysisContext.strategy) : undefined,
        position:
          typeof analysisContext.position === 'number'
            ? analysisContext.position
            : undefined,
        explanationType: analysisContext.explanationType
          ? String(analysisContext.explanationType)
          : undefined,
      };
    }

    return undefined;
  };
  
  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setFeedbackInfo(null);
    
    try {
      const recContext = resolveRecommendationContext();
      const inferredPolarity = inferRecommendationPolarity(userMessage.content);

      // 调用 Chat 智能体 API
      const response = await fetch('/api/chat-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          caseId,  // 传递案例ID用于存储反馈
          analysisContext,
          chatHistory: messages,
          ...(recContext ? { recommendationContext: recContext } : {}),
          ...(recContext && inferredPolarity
            ? { recommendationPolarity: inferredPolarity }
            : {}),
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: data.data.reply,
          timestamp: Date.now(),
          metadata: {
            agentId: 'chat',
            feedbackType: data.data.feedbackType,
            targetNode: data.data.feedbackTarget
          }
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // 设置反馈信息
        if (data.data.feedbackType && data.data.needsReanalysis) {
          setFeedbackInfo({
            type: data.data.feedbackType,
            needsReanalysis: data.data.needsReanalysis,
            targetNode: data.data.feedbackTarget
          });
        }
      } else {
        throw new Error(data.error || '发送消息失败');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: '抱歉，处理您的消息时出现错误。请稍后再试。',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 处理建议点击
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };
  
  // 处理重新分析
  const handleReanalysis = () => {
    if (feedbackInfo?.targetNode && onReanalysis) {
      onReanalysis(feedbackInfo.targetNode);
      setFeedbackInfo(null);
    }
  };
  
  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // 反馈类型标签
  const getFeedbackTypeBadge = (type: FeedbackType) => {
    const config = {
      question: { label: '问询', color: 'bg-blue-500' },
      correction: { label: '纠正', color: 'bg-red-500' },
      supplement: { label: '补充', color: 'bg-green-500' },
      deep_dive: { label: '深入', color: 'bg-purple-500' },
      rerun: { label: '重分析', color: 'bg-orange-500' }
    };
    return config[type] || config.question;
  };
  
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader 
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4" />
            反馈与问答
            <Badge variant="outline" className="text-xs ml-2">
              Chat 智能体
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="flex-1 flex flex-col gap-4 p-4 pt-0">
          {/* 消息列表 */}
          <ScrollArea className="flex-1 pr-4" style={{ height: '300px' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                <Bot className="h-12 w-12 mb-2 opacity-20" />
                <p>有问题或建议？在这里开始对话</p>
                <p className="text-xs mt-1 opacity-70">
                  Chat 智能体会根据分析结果回答您的问题
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' && 'flex-row-reverse'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    )}>
                      {message.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    
                    <div className={cn(
                      'flex-1 space-y-2',
                      message.role === 'user' && 'flex flex-col items-end'
                    )}>
                      {/* 反馈类型标签 */}
                      {message.metadata?.feedbackType && (
                        <div className="flex items-center gap-2">
                          <Badge className={cn(
                            'text-xs text-white',
                            getFeedbackTypeBadge(message.metadata.feedbackType as FeedbackType).color
                          )}>
                            {getFeedbackTypeBadge(message.metadata.feedbackType as FeedbackType).label}
                          </Badge>
                        </div>
                      )}
                      
                      <div className={cn(
                        'rounded-lg px-3 py-2 text-sm max-w-full',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}>
                        {message.role === 'assistant' ? (
                          <MarkdownRenderer content={message.content} />
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Chat 智能体正在思考...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
          
          {/* 重新分析提示 */}
          {feedbackInfo?.needsReanalysis && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-orange-800 mb-1">
                    需要重新分析
                  </div>
                  <div className="text-sm text-orange-700 mb-2">
                    Chat 智能体建议重新执行 <strong>{feedbackInfo.targetNode || '全部分析'}</strong> 以改进结果。
                  </div>
                  <Button
                    size="sm"
                    onClick={handleReanalysis}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    触发重新分析
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* 快捷建议 */}
          {messages.length === 0 && (
            <div className="space-y-2">
              <Separator />
              <div className="text-xs text-muted-foreground mb-2">快捷问题：</div>
              <div className="flex flex-wrap gap-2">
                {[
                  '这个分析的可信度如何？',
                  '对中国市场有什么影响？',
                  '有哪些不确定性因素？'
                ].map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleSuggestionClick(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          <Separator />
          
          {/* 输入区域 */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的问题或反馈..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default ChatPanel;
