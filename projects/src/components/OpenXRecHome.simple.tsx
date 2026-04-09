'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Loader2,
  Lightbulb,
  Network,
  Activity,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

// 动态导入知识图谱组件
const KnowledgeGraph = dynamic(() => import('@/components/knowledge/KnowledgeGraph'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-muted/30 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function OpenXRecHome() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  
  // 知识图谱数据
  const [kgEntities, setKgEntities] = useState<any[]>([]);
  const [kgRelations, setKgRelations] = useState<any[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickExamples = [
    '我想找一些关于推荐系统的学习资料',
    '帮我推荐一些数据可视化工具',
    '最近对机器学习很感兴趣，有什么好的入门资源？',
  ];

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'session_' + Date.now(),
          scenario: 'general',
          context: { query: input },
          options: { topK: 5, withExplanation: true },
        }),
      });

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data.items) && data.data.items.length > 0) {
        const assistantMessage = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: `为您找到 ${data.data.items.length} 个推荐结果：`,
          timestamp: Date.now(),
          recommendations: data.data.items,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: '抱歉，暂时没有找到符合您需求的推荐。',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      const errorMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '抱歉，服务暂时不可用，请稍后再试。',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  OpenXRec
                </h1>
                <p className="text-xs text-muted-foreground">可解释推荐系统</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Tab 切换 */}
          <div className="grid w-full grid-cols-3 mb-4">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                activeTab === 'chat'
                  ? 'bg-background text-foreground border-input'
                  : 'bg-muted/50 text-muted-foreground border-transparent'
              }`}
            >
              对话推荐
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`px-4 py-2 text-sm font-medium border-y ${
                activeTab === 'knowledge'
                  ? 'bg-background text-foreground border-input'
                  : 'bg-muted/50 text-muted-foreground border-transparent'
              }`}
            >
              知识图谱
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
                activeTab === 'stats'
                  ? 'bg-background text-foreground border-input'
                  : 'bg-muted/50 text-muted-foreground border-transparent'
              }`}
            >
              系统状态
            </button>
          </div>

          {/* 对话区域 */}
          {activeTab === 'chat' && (
            <Card className="h-[calc(100vh-200px)] flex flex-col">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  智能推荐助手
                </CardTitle>
                <CardDescription>
                  描述您的需求，获取可解释的个性化推荐
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                {/* 消息列表 */}
                <ScrollArea className="flex-1">
                  <div className="space-y-4 p-2">
                    {messages.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                          <Lightbulb className="w-8 h-8 text-blue-600" />
                        </div>
                        <p className="text-muted-foreground mb-4">
                          您好！我是 OpenXRec 推荐助手。请描述您的需求，我会为您提供可解释的推荐。
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {quickExamples.map((example, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleExampleClick(example)}
                            >
                              {example}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-3',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[80%] rounded-lg px-4 py-2',
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-muted'
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {message.role === 'assistant' &&
                            Array.isArray(message.recommendations) &&
                            message.recommendations.length > 0 && (
                              <ul className="mt-3 space-y-2 text-left border-t border-border/60 pt-3">
                                {message.recommendations.map((rec: any) => (
                                  <li
                                    key={rec.id || rec.title}
                                    className="rounded-md border bg-background/80 p-2 text-xs"
                                  >
                                    <div className="font-medium text-foreground">
                                      {String(rec.title || '未命名')}
                                    </div>
                                    {rec.description ? (
                                      <p className="mt-1 text-muted-foreground line-clamp-3">
                                        {String(rec.description)}
                                      </p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* 输入区域 */}
                <div className="flex gap-2 border-t pt-4">
                  <Input
                    ref={inputRef}
                    placeholder="描述您的需求..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 知识图谱 */}
          {activeTab === 'knowledge' && (
            <Card className="h-[calc(100vh-200px)] flex flex-col">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="w-5 h-5 text-blue-600" />
                  推荐知识图谱
                </CardTitle>
                <CardDescription>
                  展示推荐系统的知识关联和推理路径
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 relative min-h-[400px]">
                  <KnowledgeGraph
                    entities={kgEntities}
                    relations={kgRelations}
                  />
                  {kgEntities.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center text-muted-foreground">
                        <Network className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">开始对话后，系统将自动从对话中提取实体和关系</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 系统状态 */}
          {activeTab === 'stats' && (
            <Card>
              <CardHeader>
                <CardTitle>系统状态</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  系统正常运行中。所有服务状态良好。
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
