/**
 * 推荐对话组件
 * 
 * 功能：
 * - 基于聊天窗口的推荐交互
 * - 显示推荐结果和解释
 * - 收集用户反馈
 * - 显示推荐路径和理由
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle,
  Send,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lightbulb,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Target,
  GitBranch,
  BookOpen,
  ArrowRight,
  Info,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

/**
 * 推荐项目
 */
export interface RecommendationItem {
  id: string;
  title: string;
  type: string;
  description: string;
  score: number;
  confidence: number;
  explanation: string;
  knowledgeSources: Array<{
    title: string;
    relevance: number;
  }>;
  features?: {
    category: string;
    tags: string[];
    attributes: Record<string, any>;
  };
}

/**
 * 用户画像
 */
export interface UserProfile {
  userId: string;
  interests: string[];
  history: Array<{
    itemId: string;
    feedback: string;
    rating: number;
    timestamp: number;
  }>;
  preferences: Record<string, any>;
}

/**
 * 推荐结果
 */
export interface RecommendationResult {
  items: RecommendationItem[];
  strategy: string;
  metadata: {
    totalCandidates: number;
    selectedCount: number;
    diversityScore: number;
    noveltyScore: number;
    confidence: number;
  };
}

/**
 * 推荐对话消息
 */
export interface RecommendationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  recommendations?: RecommendationResult;
  userProfile?: UserProfile;
  metadata?: {
    strategy?: string;
    confidence?: number;
  };
}

/**
 * 推荐对话面板属性
 */
export interface RecommendationChatPanelProps {
  userProfile?: UserProfile;
  onRecommendationUpdate?: (items: RecommendationItem[]) => void;
  onFeedback?: (itemId: string, feedback: 'like' | 'dislike' | 'neutral') => void;
  onPreferenceUpdate?: (preferences: Record<string, any>) => void;
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * 推荐对话组件
 */
export function RecommendationChatPanel({
  userProfile,
  onRecommendationUpdate,
  onFeedback,
  onPreferenceUpdate,
  className,
  defaultExpanded = true
}: RecommendationChatPanelProps) {
  const [messages, setMessages] = useState<RecommendationMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [currentRecommendations, setCurrentRecommendations] = useState<RecommendationResult | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化欢迎消息
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: RecommendationMessage = {
        id: 'welcome',
        role: 'assistant',
        content: generateWelcomeMessage(userProfile),
        timestamp: Date.now()
      };
      setMessages([welcomeMessage]);
    }
  }, [userProfile]);

  // 生成欢迎消息
  const generateWelcomeMessage = (profile?: UserProfile): string => {
    if (!profile || !profile.interests || profile.interests.length === 0) {
      return `您好！我是您的智能推荐助手。\n\n我可以为您推荐个性化的内容、产品或服务。请告诉我您的兴趣和需求，我会基于您的偏好和知识库为您提供精准推荐。\n\n您可以问我：\n- "推荐一些科技相关的产品"\n- "基于我的历史行为，我可能喜欢什么？"\n- "给我推荐一些热门的书籍"`;
    }

    const interests = profile.interests.slice(0, 3).join('、');
    return `您好！我是您的智能推荐助手。\n\n基于您的兴趣（${interests}），我可以为您提供个性化的推荐。\n\n我采用了以下推荐策略：\n- **基于内容的推荐**：分析物品特征与您兴趣的匹配度\n- **协同过滤**：基于相似用户的行为模式\n- **知识增强**：利用知识图谱提供可解释的推荐\n\n请告诉我您想了解什么，我会为您推荐！`;
  };

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: RecommendationMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 调用推荐API
      const response = await fetch('/api/recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          userId: userProfile?.userId || 'anonymous',
          scenario: 'general',
          sessionContext: {
            history: messages.slice(-5),
            currentRecommendations
          },
          options: {
            enableCalibration: true,
            enableReflection: true,
            enableFeedbackLoop: true,
            enableAdaptiveOptimization: true,
          },
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        const assistantMessage: RecommendationMessage = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: result.data.explanation || generateRecommendationSummary(result.data.recommendations),
          timestamp: Date.now(),
          recommendations: result.data.recommendations,
          metadata: {
            strategy: result.data.strategy,
            confidence: result.data.metadata?.confidence
          }
        };

        setMessages(prev => [...prev, assistantMessage]);
        setCurrentRecommendations(result.data.recommendations);
        
        if (onRecommendationUpdate) {
          onRecommendationUpdate(result.data.recommendations.items);
        }
      } else {
        throw new Error(result.error || '推荐失败');
      }
    } catch (error: any) {
      const errorMessage: RecommendationMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `抱歉，推荐过程中出现错误：${error.message}\n\n请稍后重试，或调整您的查询内容。`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 生成推荐摘要
  const generateRecommendationSummary = (result?: RecommendationResult): string => {
    if (!result || !result.items || result.items.length === 0) {
      return '暂时没有找到合适的推荐。请提供更多详细信息或调整您的需求。';
    }

    const topItem = result.items[0];
    const strategy = result.strategy || '混合推荐';
    const confidence = (result.metadata?.confidence * 100).toFixed(0);

    return `根据您的需求，我为您找到了 **${result.items.length}** 个推荐项。\n\n## 🎯 推荐策略\n采用 **${strategy}** 策略，推荐置信度 **${confidence}%**。\n\n## ⭐ 最佳推荐\n**${topItem.title}**\n${topItem.description}\n\n**推荐理由**：${topItem.explanation}\n\n## 📊 推荐指标\n- 多样性得分：${(result.metadata?.diversityScore * 100).toFixed(0) || 'N/A'}%\n- 新颖性得分：${(result.metadata?.noveltyScore * 100).toFixed(0) || 'N/A'}%`;
  };

  // 处理反馈
  const handleFeedback = (itemId: string, feedback: 'like' | 'dislike' | 'neutral') => {
    if (onFeedback) {
      onFeedback(itemId, feedback);
    }

    // 添加反馈确认消息
    const feedbackMessage: RecommendationMessage = {
      id: `feedback_${Date.now()}`,
      role: 'assistant',
      content: generateFeedbackMessage(itemId, feedback),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, feedbackMessage]);
  };

  // 生成反馈消息
  const generateFeedbackMessage = (itemId: string, feedback: string): string => {
    const feedbackText = {
      like: '👍 感谢您的反馈！我会记住您的喜好，优化后续推荐。',
      dislike: '👎 已记录您的反馈。我会调整推荐策略，提供更符合您兴趣的内容。',
      neutral: '📝 已记录。如果您有更多需求，请随时告诉我。'
    };
    return feedbackText[feedback as keyof typeof feedbackText] || feedbackText.neutral;
  };

  // 快捷问题
  const quickQuestions = [
    '推荐一些热门产品',
    '基于我的历史兴趣推荐',
    '显示推荐策略说明',
    '帮我优化推荐结果'
  ];

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            智能推荐
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="flex flex-col gap-4 flex-1 min-h-[600px]">
          {/* 消息列表 */}
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-lg px-4 py-3 max-w-[80%]',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <MarkdownRenderer content={message.content} />
                    
                    {/* 显示推荐列表 */}
                    {message.recommendations && (
                      <div className="mt-4 space-y-3">
                        <Separator />
                        <div className="space-y-3">
                          {message.recommendations.items.slice(0, 3).map((item, index) => (
                            <RecommendationCard
                              key={item.id}
                              item={item}
                              rank={index + 1}
                              onFeedback={(feedback) => handleFeedback(item.id, feedback)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 显示元数据 */}
                    {message.metadata && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {message.metadata.strategy && (
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {message.metadata.strategy}
                            </span>
                          )}
                          {message.metadata.confidence && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              置信度 {(message.metadata.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-5 w-5 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* 加载中指示器 */}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <span className="text-sm text-muted-foreground">正在分析并生成推荐...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* 快捷问题 */}
          {messages.length <= 2 && (
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((question) => (
                <Button
                  key={question}
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(question)}
                  className="text-xs"
                >
                  {question}
                </Button>
              ))}
            </div>
          )}

          {/* 输入区域 */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="告诉我您的需求，获取个性化推荐..."
              disabled={isLoading}
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

/**
 * 推荐卡片组件
 */
interface RecommendationCardProps {
  item: RecommendationItem;
  rank: number;
  onFeedback: (feedback: 'like' | 'dislike' | 'neutral') => void;
}

function RecommendationCard({ item, rank, onFeedback }: RecommendationCardProps) {
  return (
    <div className="p-3 bg-background border rounded-lg space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              #{rank}
            </Badge>
            <h4 className="font-semibold text-sm">{item.title}</h4>
            <Badge variant="outline" className="text-xs">
              {(item.confidence * 100).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        </div>
      </div>

      {/* 推荐解释 */}
      <div className="text-xs space-y-1">
        <div className="flex items-start gap-1 text-muted-foreground">
          <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{item.explanation}</span>
        </div>
        
        {/* 知识来源 */}
        {item.knowledgeSources && item.knowledgeSources.length > 0 && (
          <div className="flex items-start gap-1 text-muted-foreground">
            <BookOpen className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              基于: {item.knowledgeSources.slice(0, 2).map(s => s.title).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* 反馈按钮 */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFeedback('like')}
            className="h-7 px-2"
          >
            <ThumbsUp className="h-3 w-3 mr-1" />
            喜欢
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFeedback('dislike')}
            className="h-7 px-2"
          >
            <ThumbsDown className="h-3 w-3 mr-1" />
            不喜欢
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
        >
          <Info className="h-3 w-3 mr-1" />
          详情
        </Button>
      </div>
    </div>
  );
}
