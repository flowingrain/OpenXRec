'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import KnowledgeGraph from '@/components/knowledge/KnowledgeGraph';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import type { KGEntity, KGRelation } from '@/lib/knowledge-graph/types';
import {
  Sparkles,
  Brain,
  Send,
  User,
  Bot,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  BookOpen,
  Target,
  TrendingUp,
  Star,
  Award,
  Layers,
  ChevronRight,
  Network,
  BarChart3,
  Info,
  GitBranch,
  Settings,
  Heart,
  Plus,
  X,
  RotateCcw,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

/**
 * 推荐项目接口
 */
interface RecommendationItem {
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
 * 推荐消息接口
 */
interface RecommendationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  recommendations?: RecommendationItem[];
  metadata?: {
    strategy?: string;
    confidence?: number;
  };
}

/**
 * 推荐结果接口
 */
interface RecommendationResult {
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

export default function RecommendationPage() {
  const [messages, setMessages] = useState<RecommendationMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<RecommendationItem | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'preferences' | 'graph'>('chat');
  const [interests, setInterests] = useState<string[]>(['科技', '阅读', '产品']);
  const [newInterest, setNewInterest] = useState('');
  const [knowledgeGraphEntities, setKnowledgeGraphEntities] = useState<KGEntity[]>([]);
  const [knowledgeGraphRelations, setKnowledgeGraphRelations] = useState<KGRelation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId] = useState('default_user');

  // 加载用户画像
  useEffect(() => {
    loadUserProfile();
  }, []);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    return;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 加载用户画像
  const loadUserProfile = async () => {
    try {
      const response = await fetch(`/api/user-profile?userId=${userId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setInterests(result.data.interests || ['科技', '阅读', '产品']);
      }
    } catch (error) {
      console.error('[Recommendation Page] Failed to load user profile:', error);
    }
  };

  // 保存用户画像
  const saveUserProfile = async () => {
    try {
      const response = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          userId,
          interests,
          preferences: {
            strategy: 'knowledge_enhanced',
            diversityLevel: 'medium'
          }
        })
      });

      const result = await response.json();

      if (!result.success) {
        console.error('[Recommendation Page] Failed to save user profile:', result.error);
      }
    } catch (error) {
      console.error('[Recommendation Page] Failed to save user profile:', error);
    }
  };

  useEffect(() => {
    // 初始化欢迎消息
    if (messages.length === 0) {
      const welcomeMessage: RecommendationMessage = {
        id: 'welcome',
        role: 'assistant',
        content: generateWelcomeMessage(),
        timestamp: Date.now()
      };
      setMessages([welcomeMessage]);
    }
  }, []);

  // 生成欢迎消息
  const generateWelcomeMessage = (): string => {
    const interestsText = interests.slice(0, 3).join('、');
    return `您好！我是您的智能推荐助手。\n\n基于您的兴趣（${interestsText}），我可以为您提供个性化的推荐。\n\n我采用了以下推荐策略：\n- **基于内容的推荐**：分析物品特征与您兴趣的匹配度\n- **协同过滤**：基于相似用户的行为模式\n- **知识增强**：利用知识图谱提供可解释的推荐\n\n请告诉我您想了解什么，我会为您推荐！`;
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
          query: userMessage.content,
          userId: 'default_user',
          scenario: 'general',
          sessionContext: {
            interests: interests,
            preferences: { strategy: 'knowledge_enhanced' }
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
          content: result.data.explanation || '推荐生成成功',
          timestamp: Date.now(),
          recommendations: result.data.recommendations.items,
          metadata: {
            strategy: result.data.recommendations.strategy,
            confidence: result.data.recommendations.metadata.confidence
          }
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        if (result.data.recommendations.items.length > 0) {
          setSelectedRecommendation(result.data.recommendations.items[0]);
          
          // 生成知识图谱数据
          generateKnowledgeGraph(result.data.recommendations.items, userMessage.content);
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

  // 生成知识图谱数据
  const generateKnowledgeGraph = (recommendations: RecommendationItem[], query: string) => {
    const entities: KGEntity[] = [];
    const relations: KGRelation[] = [];
    let entityIdCounter = 1;
    let relationIdCounter = 1;

    // 添加查询节点（核心实体）
    const queryId = `entity_${entityIdCounter++}`;
    const now = new Date().toISOString();
    entities.push({
      id: queryId,
      name: query,
      type: '事件' as any,
      aliases: [],
      importance: 1.0,
      description: '用户查询',
      source_type: 'llm' as const,
      verified: true,
      created_at: now,
      updated_at: now
    });

    // 为每个推荐项添加实体和关系
    recommendations.slice(0, 3).forEach((item, index) => {
      const itemId = `entity_${entityIdCounter++}`;
      
      entities.push({
        id: itemId,
        name: item.title,
        type: getEntityType(item.type),
        aliases: [],
        importance: 0.9 - index * 0.1,
        description: item.description,
        source_type: 'llm' as const,
        verified: true,
        created_at: now,
        updated_at: now
      });

      // 添加查询-推荐关系
      relations.push({
        id: `relation_${relationIdCounter++}`,
        source_entity_id: queryId,
        target_entity_id: itemId,
        type: '影响' as any,
        confidence: item.confidence,
        evidence: item.explanation,
        source_type: 'llm' as const,
        verified: true,
        created_at: now,
        updated_at: now
      });

      // 为知识来源添加实体和关系
      item.knowledgeSources.slice(0, 2).forEach((source) => {
        const sourceId = `entity_${entityIdCounter++}`;
        
        // 检查是否已存在相同实体
        const existingSource = entities.find(e => e.name === source.title);
        const targetSourceId = existingSource ? existingSource.id : sourceId;

        if (!existingSource) {
          entities.push({
            id: targetSourceId,
            name: source.title,
            type: '政策' as any,
            aliases: [],
            importance: 0.6,
            description: '知识来源',
            source_type: 'llm' as const,
            verified: true,
            created_at: now,
            updated_at: now
          });
        }

        // 添加来源-推荐关系
        relations.push({
          id: `relation_${relationIdCounter++}`,
          source_entity_id: targetSourceId,
          target_entity_id: itemId,
          type: '关联' as any,
          confidence: source.relevance,
          evidence: '基于知识库检索',
          source_type: 'llm' as const,
          verified: true,
          created_at: now,
          updated_at: now
        });
      });

      // 为特征标签添加实体和关系
      if (item.features?.tags) {
        item.features.tags.slice(0, 2).forEach((tag) => {
          const tagId = `entity_${entityIdCounter++}`;
          
          const existingTag = entities.find(e => e.name === tag && e.type === '行业');
          const targetTagId = existingTag ? existingTag.id : tagId;

          if (!existingTag) {
            entities.push({
              id: targetTagId,
              name: tag,
              type: '行业' as any,
              aliases: [],
              importance: 0.5,
              description: '特征标签',
              source_type: 'llm' as const,
              verified: true,
              created_at: now,
              updated_at: now
            });
          }

          // 添加标签-推荐关系
          relations.push({
            id: `relation_${relationIdCounter++}`,
            source_entity_id: itemId,
            target_entity_id: targetTagId,
            type: '关联' as any,
            confidence: 0.8,
            evidence: '基于特征匹配',
            source_type: 'llm' as const,
            verified: true,
            created_at: now,
            updated_at: now
          });
        });
      }
    });

    setKnowledgeGraphEntities(entities);
    setKnowledgeGraphRelations(relations);
  };

  // 获取实体类型
  const getEntityType = (itemType: string): any => {
    const typeMap: Record<string, any> = {
      'product': '产品',
      'article': '政策',
      'course': '行业',
      'book': '政策',
      'default': '其他'
    };
    return typeMap[itemType] || typeMap.default;
  };

  // 处理反馈
  const handleFeedback = async (itemId: string, feedback: 'like' | 'dislike') => {
    const feedbackText = feedback === 'like' 
      ? '👍 感谢您的反馈！我会记住您的喜好，优化后续推荐。'
      : '👎 已记录您的反馈。我会调整推荐策略，提供更符合您兴趣的内容。';

    const feedbackMessage: RecommendationMessage = {
      id: `feedback_${Date.now()}`,
      role: 'assistant',
      content: feedbackText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, feedbackMessage]);

    // 记录反馈到数据库
    try {
      await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_feedback',
          userId,
          feedback: {
            itemId,
            type: feedback === 'like' ? 'positive' : 'negative',
            rating: feedback === 'like' ? 5 : 1,
            context: {
              timestamp: new Date().toISOString()
            }
          }
        })
      });
    } catch (error) {
      console.error('[Recommendation Page] Failed to record feedback:', error);
    }
  };

  // 添加兴趣
  const handleAddInterest = async () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      const updatedInterests = [...interests, newInterest.trim()];
      setInterests(updatedInterests);
      setNewInterest('');
      
      // 自动保存用户画像
      try {
        await fetch('/api/user-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_profile',
            userId,
            interests: updatedInterests
          })
        });
      } catch (error) {
        console.error('[Recommendation Page] Failed to save interest:', error);
      }
    }
  };

  // 移除兴趣
  const handleRemoveInterest = async (interest: string) => {
    const updatedInterests = interests.filter(i => i !== interest);
    setInterests(updatedInterests);
    
    // 自动保存用户画像
    try {
      await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          userId,
          interests: updatedInterests
        })
      });
    } catch (error) {
      console.error('[Recommendation Page] Failed to save interest:', error);
    }
  };

  // 重置偏好
  const handleResetPreferences = () => {
    setInterests(['科技', '阅读', '产品']);
  };

  // 快捷问题
  const quickQuestions = [
    '推荐一些科技产品',
    '基于我的兴趣推荐文章',
    '推荐在线课程',
    '推荐热门书籍'
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            可解释推荐系统
          </h1>
          <p className="text-muted-foreground mt-1">
            基于知识图谱的个性化推荐，提供完整的推荐解释和路径追踪
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleResetPreferences}>
            <RotateCcw className="h-4 w-4 mr-2" />
            重置偏好
          </Button>
          <Button size="sm">
            <Settings className="h-4 w-4 mr-2" />
            设置
          </Button>
        </div>
      </div>

      {/* 视图切换 */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            推荐对话
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            兴趣偏好
          </TabsTrigger>
          <TabsTrigger value="graph" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            知识图谱
          </TabsTrigger>
        </TabsList>

        {/* 推荐对话视图 */}
        <TabsContent value="chat" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧：推荐对话 */}
            <div className="lg:col-span-2">
              <Card className="h-[700px] flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-5 w-5 text-primary" />
                    智能推荐
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  {/* 消息列表 */}
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4 pb-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {message.role === 'assistant' && (
                            <div className="flex-shrink-0">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-5 w-5 text-primary" />
                              </div>
                            </div>
                          )}
                          <div
                            className={`rounded-lg px-4 py-3 max-w-[80%] ${
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <MarkdownRenderer content={message.content} />
                            
                            {/* 显示推荐列表 */}
                            {message.recommendations && message.recommendations.length > 0 && (
                              <div className="mt-4 space-y-3">
                                <Separator />
                                <div className="space-y-3">
                                  {message.recommendations.slice(0, 3).map((item, index) => (
                                    <RecommendationCard
                                      key={item.id}
                                      item={item}
                                      rank={index + 1}
                                      onClick={() => setSelectedRecommendation(item)}
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
              </Card>
            </div>

            {/* 右侧：推荐解释 */}
            <div className="lg:col-span-1">
              <Card className="sticky top-6 h-[700px] flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-primary" />
                    推荐解释
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {selectedRecommendation ? selectedRecommendation.title : '选择推荐项查看详情'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  {selectedRecommendation ? (
                    <div className="space-y-4">
                      {/* 推荐理由 */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          推荐理由
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedRecommendation.explanation}
                        </p>
                      </div>

                      <Separator />

                      {/* 指标 */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          推荐指标
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 dark:text-blue-400">
                            <p className="text-xs text-muted-foreground mb-1">置信度</p>
                            <p className="text-xl font-bold">{(selectedRecommendation.confidence * 100).toFixed(0)}%</p>
                          </div>
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-600 dark:text-yellow-400">
                            <p className="text-xs text-muted-foreground mb-1">评分</p>
                            <p className="text-xl font-bold">{(selectedRecommendation.score * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* 特征 */}
                      {selectedRecommendation.features && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-purple-500" />
                            特征
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">类别</span>
                              <span className="font-medium">{selectedRecommendation.features.category}</span>
                            </div>
                            {selectedRecommendation.features.tags && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-muted-foreground">标签:</span>
                                {selectedRecommendation.features.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* 知识来源 */}
                      {selectedRecommendation.knowledgeSources && selectedRecommendation.knowledgeSources.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            知识来源
                          </h4>
                          <div className="space-y-2">
                            {selectedRecommendation.knowledgeSources.map((source, index) => (
                              <div key={index} className="p-3 bg-muted rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">{source.title}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {(source.relevance * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>已验证来源</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Info className="h-16 w-16 mb-3 opacity-30" />
                      <p className="text-sm">点击推荐卡片查看详细解释</p>
                      <p className="text-xs mt-1 opacity-60">支持多维度推荐分析和知识溯源</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 兴趣偏好视图 */}
        <TabsContent value="preferences" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                兴趣偏好
              </CardTitle>
              <CardDescription>
                管理您的兴趣标签，用于个性化推荐
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="text-sm font-medium mb-2 block">我的兴趣</label>
                  <p className="text-xs text-muted-foreground mb-3">
                    添加您的兴趣标签，系统会基于这些标签为您提供个性化推荐
                  </p>
                  <div className="flex gap-2 mb-4">
                    <Input
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddInterest()}
                      placeholder="添加兴趣标签（如：科技、阅读、产品）..."
                      className="flex-1"
                    />
                    <Button onClick={handleAddInterest}>
                      <Plus className="h-4 w-4 mr-1" />
                      添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <Badge key={interest} variant="secondary" className="gap-1 text-sm py-1.5">
                        {interest}
                        <X
                          className="h-3 w-3 cursor-pointer hover:bg-muted-foreground/20 rounded"
                          onClick={() => handleRemoveInterest(interest)}
                        />
                      </Badge>
                    ))}
                    {interests.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        暂无兴趣标签，请添加您的兴趣
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-3">推荐设置</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">启用知识图谱</p>
                        <p className="text-xs text-muted-foreground">在推荐时展示知识关联路径</p>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        已启用
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">推荐多样性</p>
                        <p className="text-xs text-muted-foreground">平衡相似度和新颖性</p>
                      </div>
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        中等
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 知识图谱视图 */}
        <TabsContent value="graph" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-primary" />
                    知识图谱可视化
                  </CardTitle>
                  <CardDescription>
                    可视化推荐决策过程和知识关联
                  </CardDescription>
                </div>
                {knowledgeGraphEntities.length > 0 && (
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      <span>{knowledgeGraphEntities.length} 实体</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-4 w-4" />
                      <span>{knowledgeGraphRelations.length} 关系</span>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <KnowledgeGraph
                  entities={knowledgeGraphEntities}
                  relations={knowledgeGraphRelations}
                  height={600}
                  onNodeClick={(entity) => {
                    console.log('Node clicked:', entity);
                  }}
                  onEdgeClick={(relation) => {
                    console.log('Edge clicked:', relation);
                  }}
                />
              </div>
              
              {knowledgeGraphEntities.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[500px] bg-muted/30 rounded-lg">
                  <GitBranch className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">暂无知识图谱数据</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    请先在"推荐对话"中发起推荐请求
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * 推荐卡片组件
 */
interface RecommendationCardProps {
  item: RecommendationItem;
  rank: number;
  onClick: () => void;
  onFeedback: (feedback: 'like' | 'dislike') => void;
}

function RecommendationCard({ item, rank, onClick, onFeedback }: RecommendationCardProps) {
  return (
    <Card className="p-3 border hover:border-primary/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1" onClick={onClick}>
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
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Lightbulb className="h-3 w-3" />
            <span className="line-clamp-1">{item.explanation}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t mt-2">
        <div className="flex gap-1">
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
          onClick={onClick}
          className="h-7 px-2 text-xs"
        >
          <Info className="h-3 w-3 mr-1" />
          详情
        </Button>
      </div>
    </Card>
  );
}
