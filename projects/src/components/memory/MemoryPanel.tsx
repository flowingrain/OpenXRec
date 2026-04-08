'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  History, 
  MessageSquare, 
  Lightbulb,
  Clock,
  User,
  Bot
} from 'lucide-react';

interface Memory {
  id: string;
  type: 'conversation' | 'fact' | 'preference' | 'context' | 'result';
  content: string;
  timestamp: number;
  importance: number;
  tags?: string[];
}

interface Conversation {
  sessionId: string;
  topic?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

interface MemoryPanelProps {
  sessionId?: string;
  currentTopic?: string;
  memories?: Memory[];
  conversations?: Conversation[];
  preferences?: Record<string, any>;
}

export function MemoryPanel({
  sessionId,
  currentTopic,
  memories = [],
  conversations = [],
  preferences = {}
}: MemoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'memory' | 'history' | 'preferences'>('memory');
  
  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString();
  };
  
  // 获取记忆类型标签
  const getMemoryTypeLabel = (type: Memory['type']) => {
    const labels = {
      conversation: '对话',
      fact: '事实',
      preference: '偏好',
      context: '上下文',
      result: '结果'
    };
    return labels[type] || type;
  };
  
  // 获取记忆类型颜色
  const getMemoryTypeColor = (type: Memory['type']) => {
    const colors = {
      conversation: 'bg-blue-500',
      fact: 'bg-green-500',
      preference: 'bg-purple-500',
      context: 'bg-yellow-500',
      result: 'bg-cyan-500'
    };
    return colors[type] || 'bg-gray-500';
  };
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5" />
            记忆系统
          </CardTitle>
          {sessionId && (
            <Badge variant="outline" className="text-xs">
              会话: {sessionId.slice(-8)}
            </Badge>
          )}
        </div>
        <CardDescription>
          {currentTopic ? `当前主题: ${currentTopic}` : '智能记忆与上下文管理'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* 标签页选择 */}
        <div className="flex gap-1 mb-4 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveTab('memory')}
            className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'memory' ? 'bg-background shadow' : 'hover:bg-background/50'
            }`}
          >
            <History className="w-3.5 h-3.5 inline mr-1" />
            记忆
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'history' ? 'bg-background shadow' : 'hover:bg-background/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
            对话
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'preferences' ? 'bg-background shadow' : 'hover:bg-background/50'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 inline mr-1" />
            偏好
          </button>
        </div>
        
        <ScrollArea className="h-[400px]">
          {/* 记忆列表 */}
          {activeTab === 'memory' && (
            <div className="space-y-3">
              {memories.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Brain className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无记忆</p>
                  <p className="text-xs mt-1">进行分析后会自动保存记忆</p>
                </div>
              ) : (
                memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge 
                        variant="secondary" 
                        className={`${getMemoryTypeColor(memory.type)} text-white text-xs`}
                      >
                        {getMemoryTypeLabel(memory.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(memory.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">
                      {memory.content.length > 150 
                        ? `${memory.content.substring(0, 150)}...` 
                        : memory.content}
                    </p>
                    {memory.tags && memory.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {memory.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* 重要性指示器 */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">重要性</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${memory.importance * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {/* 对话历史 */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {conversations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无对话历史</p>
                  <p className="text-xs mt-1">开始新对话后将显示在这里</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.sessionId}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {conv.topic || '未命名主题'}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {conv.messageCount} 条消息
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatTime(conv.updatedAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {/* 用户偏好 */}
          {activeTab === 'preferences' && (
            <div className="space-y-3">
              {Object.keys(preferences).length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无偏好记录</p>
                  <p className="text-xs mt-1">系统会自动学习您的偏好</p>
                </div>
              ) : (
                Object.entries(preferences).map(([key, value]) => (
                  <div
                    key={key}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="font-medium text-sm mb-1">{key}</div>
                    <div className="text-sm text-muted-foreground">
                      {typeof value === 'object' 
                        ? JSON.stringify(value) 
                        : String(value)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// 记忆上下文提示组件
export function MemoryContextBanner({ 
  memoryCount, 
  relevantCount 
}: { 
  memoryCount: number;
  relevantCount: number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
      <Brain className="w-4 h-4 text-blue-600" />
      <span className="text-blue-700 dark:text-blue-300">
        已从 <strong>{memoryCount}</strong> 条记忆中检索到 <strong>{relevantCount}</strong> 条相关内容
      </span>
    </div>
  );
}

// Agent思考状态组件
export function AgentThinkingIndicator({ agent, thought }: { agent: string; thought?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg animate-pulse">
      <Bot className="w-5 h-5 text-primary mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{agent}</span>
          <Badge variant="outline" className="text-xs">思考中...</Badge>
        </div>
        {thought && (
          <p className="text-sm text-muted-foreground">{thought}</p>
        )}
      </div>
    </div>
  );
}

export default MemoryPanel;
