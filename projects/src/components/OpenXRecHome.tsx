'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Loader2,
  Lightbulb,
  Brain,
  Network,
  Layers,
  GitBranch,
  BookOpen,
  Database,
  ArrowRight,
  Upload,
  FileText,
  X,
  ThumbsUp,
  ThumbsDown,
  Info,
  Settings,
  ChevronRight,
  Activity,
  Zap,
  Target,
  TrendingUp,
  MessageSquare,
  Eye,
  Code,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthButton, useAuth } from '@/components/auth/LoginDialog';
import KnowledgeBasePanel from '@/components/knowledge/KnowledgeBasePanel';
import CasesPanel from '@/components/cases/CasesPanel';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import type { KGEntity, KGRelation } from '@/lib/knowledge-graph/types';

// 动态导入图谱组件
const KnowledgeGraph = dynamic(() => import('@/components/knowledge/KnowledgeGraph'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-muted/30 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

// 类型定义
interface RecommendationItem {
  id: string;
  title: string;
  type: string;
  description: string;
  score: number;
  confidence: number;
  explanation: string;
  factors: Array<{
    name: string;
    value: string;
    importance: number;
  }>;
  // 新增：元数据（用于对比分析）
  metadata?: {
    isComparisonAnalysis?: boolean;
    entities?: Array<{
      name: string;
      pros: string[];
      cons: string[];
    }>;
    conclusion?: {
      summary?: string;
      recommendation?: string;
    };
    sources?: Array<{
      title: string;
      url?: string;
      snippet?: string;
    }>;
  };
  source?: string;
  sourceUrl?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  recommendations?: RecommendationItem[];
  explanation?: string;
  // 新增：追问类型
  clarification?: {
    needsClarification: boolean;
    questions: ClarificationQuestion[];
    missingFields: string[];
    progress: number;
  };
  // 新增：推荐类型
  recommendationType?: 'comparison' | 'ranking' | 'single' | 'clarification' | 'comparison_analysis';
}

// 新增：追问问题类型
interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'text' | 'range';
  options?: string[];
  placeholder?: string;
  required: boolean;
  priority: 'high' | 'medium' | 'low';
  fieldId?: string;
}

// 新增：排序型推荐结果
interface RankingItem extends RecommendationItem {
  rank?: number;
  overallScore?: number;
  scores?: {
    name: string;
    score: number;
    weight: number;
    description?: string;
  }[];
  advantages?: string[];
  disadvantages?: string[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
}

// 会话ID生成
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// 快速示例
const quickExamples = [
  '我想找一些关于推荐系统的学习资料',
  '帮我推荐一些数据可视化工具',
  '最近对机器学习很感兴趣，有什么好的入门资源？',
  '我们公司需要选择一个合适的数据分析平台',
];

export default function OpenXRecHome() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(generateSessionId());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activeTab, setActiveTab] = useState('chat');
  const [ppoStats, setPpoStats] = useState({
    totalSteps: 0,
    avgReward: 0,
    bufferSize: 0,
  });
  // 追问上下文：保存触发追问的原始查询
  const [clarificationContext, setClarificationContext] = useState<string | null>(null);
  // 追问问题的选择答案：{ questionId: answer }
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  // 当前正在处理的追问消息ID
  const [activeClarificationId, setActiveClarificationId] = useState<string | null>(null);
  // 知识库面板状态
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  // 案例库面板状态
  const [isCasesOpen, setIsCasesOpen] = useState(false);
  // 知识图谱数据（从对话中抽取）
  const [kgEntities, setKgEntities] = useState<KGEntity[]>([]);
  const [kgRelations, setKgRelations] = useState<KGRelation[]>([]);
  // 展开的推荐项ID
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  // 推荐反馈状态（用于按钮高亮与防重复点击）
  const [feedbackByItem, setFeedbackByItem] = useState<Record<string, 'like' | 'dislike'>>({});
  const [feedbackPending, setFeedbackPending] = useState<Record<string, boolean>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 获取PPO状态
  useEffect(() => {
    const fetchPPOStats = async () => {
      try {
        const res = await fetch('/api/recommendation/ppo');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setPpoStats({
              totalSteps: data.data.modelState.totalSteps,
              avgReward: data.data.modelState.avgReward,
              bufferSize: data.data.bufferSize,
            });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch PPO stats:', e);
      }
    };
    fetchPPOStats();
    const interval = setInterval(fetchPPOStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // 文件上传处理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      
      // 读取文件内容
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const uploadedFile: UploadedFile = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          content,
        };
        setUploadedFiles(prev => [...prev, uploadedFile]);
        
        // 添加系统消息
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: `上传了文件: ${file.name}`,
          timestamp: Date.now(),
        }]);
      };
      reader.readAsText(file);
    }
    
    // 清空input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 移除文件
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 构建请求
      const requestContext = {
        uploadedFiles: uploadedFiles.map(f => ({
          name: f.name,
          type: f.type,
          content: f.content?.substring(0, 2000), // 限制内容长度
        })),
        sessionId,
      };

      // 调用推荐API
      const response = await fetch('/api/recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: sessionId,
          scenario: 'general',
          context: {
            query: input,
            ...requestContext,
          },
          options: {
            topK: 5,
            withExplanation: true,
            enableDiversity: true,
          },
        }),
      });

      const data = await response.json();
      
      // 检查是否是追问类型
      if (data.success && data.data.metadata?.clarification?.needsClarification) {
        const assistantMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: data.data.explanation || '需要更多信息才能给出精准推荐。',
          timestamp: Date.now(),
          recommendationType: 'clarification',
          clarification: data.data.metadata.clarification,
        };
        setMessages(prev => [...prev, assistantMessage]);
        // 保存原始查询，用于追问回答时恢复上下文
        setClarificationContext(input);
      } else if (data.success && data.data.items.length > 0) {
        // 获取推荐类型（Agent 返回 queryType=recommendation/single 时与 UI 分支 comparison 对齐，否则气泡内不渲染列表）
        const rawRecType =
          data.data.metadata?.queryType || data.data.metadata?.recommendationType || 'comparison';
        const recommendationType: Message['recommendationType'] =
          rawRecType === 'recommendation' || rawRecType === 'single'
            ? 'comparison'
            : (rawRecType as Message['recommendationType']);
        const isRanking = recommendationType === 'ranking';
        const isComparisonAnalysis = recommendationType === 'comparison_analysis';
        
        const assistantMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: isComparisonAnalysis 
            ? `为您生成对比分析：`
            : isRanking 
              ? `为您综合分析出 ${data.data.items.length} 个推荐选项：`
              : `为您找到 ${data.data.items.length} 个推荐结果：`,
          timestamp: Date.now(),
          recommendationType,
          recommendations: data.data.items.map((item: any) => ({
            id: item.id || `item_${Math.random().toString(36).substr(2, 9)}`,
            title: String(item.title || '未知推荐项'),
            type: String(item.type || 'other'),
            description: String(item.description || ''),
            score: Number(item.score ?? item.confidence ?? 0),
            confidence: Number(item.confidence ?? 0),
            explanation: String(
              item.explanation ||
                item.explanations?.[0]?.reason ||
                item.reason ||
                '基于综合分析推荐'
            ),
            factors: Array.isArray(item.explanations?.[0]?.factors) ? item.explanations[0].factors : [],
            // 元数据（对比分析用）
            metadata: item.metadata,
            source: String(item.source || ''),
            sourceUrl: String(item.sourceUrl || ''),
            // 排序型特有字段
            rank: item.rank,
            overallScore: item.overallScore,
            scores: item.scores,
            advantages: item.advantages,
            disadvantages: item.disadvantages,
          })),
          explanation: String(data.data.overallExplanation || data.data.explanation || ''),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // 从对话中提取知识图谱数据
        extractKnowledgeGraphData(input, data.data);
      } else {
        // 没有找到推荐结果
        const assistantMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: '抱歉，暂时没有找到符合您需求的推荐。您可以：\n\n1. 提供更详细的需求描述\n2. 上传相关文档帮助我理解您的需求\n3. 尝试其他关键词搜索',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        // 返回推荐结果，清除追问上下文
        setClarificationContext(null);
      }
      
      // 清空已上传的文件
      setUploadedFiles([]);
      
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '抱歉，推荐服务暂时不可用。请稍后重试。',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 发送反馈（专用 /api/recommendation/feedback，勿用 /api/chat-feedback：后者是分析对话上下文用的）
  const sendFeedback = async (itemId: string, feedbackType: 'like' | 'dislike') => {
    if (!itemId) return;
    const prev = feedbackByItem[itemId];
    // 乐观更新：先让按钮有状态反馈
    setFeedbackByItem((s) => ({ ...s, [itemId]: feedbackType }));
    setFeedbackPending((s) => ({ ...s, [itemId]: true }));
    try {
      const res = await fetch('/api/recommendation/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: sessionId,
          itemId,
          feedbackType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[sendFeedback]', res.status, err);
        // 回滚到之前状态
        setFeedbackByItem((s) => {
          const next = { ...s };
          if (prev) next[itemId] = prev;
          else delete next[itemId];
          return next;
        });
      }
    } catch (e) {
      console.warn('Failed to send feedback:', e);
      // 回滚到之前状态
      setFeedbackByItem((s) => {
        const next = { ...s };
        if (prev) next[itemId] = prev;
        else delete next[itemId];
        return next;
      });
    } finally {
      setFeedbackPending((s) => ({ ...s, [itemId]: false }));
    }
  };

  // 从对话中提取知识图谱数据
  const extractKnowledgeGraphData = async (query: string, responseData: any) => {
    try {
      // 调用知识图谱提取API
      const response = await fetch('/api/knowledge-graph/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          items: responseData.items,
          explanation: responseData.explanation,
          existingEntities: kgEntities,
          existingRelations: kgRelations,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const incomingEntities: KGEntity[] = data.data.entities || [];
          const incomingRelations: KGRelation[] = data.data.relations || [];

          // 先构建「名称 -> 稳定ID」映射：优先使用已有实体ID，避免关系引用临时ID导致悬挂
          const nameToStableId = new Map<string, string>();
          kgEntities.forEach((e) => nameToStableId.set(e.name, e.id));
          incomingEntities.forEach((e) => {
            if (!nameToStableId.has(e.name)) {
              nameToStableId.set(e.name, e.id);
            }
          });

          // 本轮抽取的临时ID -> 名称（用于关系端点重映射）
          const tempIdToName = new Map<string, string>();
          incomingEntities.forEach((e) => tempIdToName.set(e.id, e.name));

          // 合并新的实体和关系
          setKgEntities(prev => {
            const newEntities = [...prev];
            for (const entity of incomingEntities) {
              if (!newEntities.find(e => e.name === entity.name)) {
                newEntities.push(entity);
              }
            }
            return newEntities;
          });

          setKgRelations(prev => {
            const newRelations = [...prev];
            for (const relation of incomingRelations) {
              const sourceName = tempIdToName.get(relation.source_entity_id);
              const targetName = tempIdToName.get(relation.target_entity_id);
              const resolvedSourceId = sourceName
                ? nameToStableId.get(sourceName) || relation.source_entity_id
                : relation.source_entity_id;
              const resolvedTargetId = targetName
                ? nameToStableId.get(targetName) || relation.target_entity_id
                : relation.target_entity_id;

              // 若仍缺端点，跳过该关系，避免图布局异常
              if (!resolvedSourceId || !resolvedTargetId) continue;

              const normalizedRelation: KGRelation = {
                ...relation,
                source_entity_id: resolvedSourceId,
                target_entity_id: resolvedTargetId,
              };

              if (!newRelations.find(r => 
                r.source_entity_id === normalizedRelation.source_entity_id && 
                r.target_entity_id === normalizedRelation.target_entity_id &&
                r.type === normalizedRelation.type
              )) {
                newRelations.push(normalizedRelation);
              }
            }
            return newRelations;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to extract knowledge graph data:', e);
    }
  };

  // 选择追问问题的答案（不立即发送）
  const handleSelectAnswer = (questionId: string, answer: string) => {
    setQuestionAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  // 提交所有追问答案
  const handleSubmitAnswers = () => {
    // 将所有答案合并成一个字符串发送
    const answers = Object.entries(questionAnswers)
      .map(([_, answer]) => answer)
      .filter(Boolean);
    
    if (answers.length === 0) return;
    
    const answerText = answers.join('，');
    setInput(answerText);
    setQuestionAnswers({}); // 清空选择
    setClarificationContext(null);
    
    // 自动发送
    setTimeout(() => {
      const sendButton = document.querySelector('[data-send-button]') as HTMLButtonElement;
      sendButton?.click();
    }, 100);
  };

  // 快速回答追问（单问题快速模式）
  const handleQuickAnswer = (questionId: string, answer: string) => {
    // 只发送当前回答，服务端会记住历史
    setInput(answer);
    // 清除追问上下文
    setClarificationContext(null);
    setQuestionAnswers({});
    // 聚焦输入框
    inputRef.current?.focus();
  };

  // 快速示例点击
  const handleExampleClick = (example: string) => {
    setInput(example);
  };

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
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1.5"
                onClick={() => setIsKnowledgeBaseOpen(true)}
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden md:inline">知识库</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1.5"
                onClick={() => setIsCasesOpen(true)}
              >
                <Database className="h-4 w-4" />
                <span className="hidden md:inline">案例库</span>
              </Button>
              <Link href="/api-docs">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Code className="h-4 w-4" />
                  <span className="hidden md:inline">API</span>
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 container mx-auto px-4 py-6 overflow-hidden">
        <div className="h-full flex flex-col min-h-0">
          <div className="grid w-full grid-cols-3 max-w-md mx-auto mb-4">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                activeTab === 'chat'
                  ? 'bg-background text-foreground border-input'
                  : 'bg-muted/50 text-muted-foreground border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5 justify-center">
                <MessageSquare className="w-4 h-4" />
                对话推荐
              </div>
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`px-4 py-2 text-sm font-medium border-y border-r border-l-0 ${
                activeTab === 'knowledge'
                  ? 'bg-background text-foreground border-input'
                  : 'bg-muted/50 text-muted-foreground border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5 justify-center">
                <Network className="w-4 h-4" />
                知识图谱
              </div>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
                activeTab === 'stats'
                  ? 'bg-background text-foreground border-input'
                  : 'bg-muted/50 text-muted-foreground border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5 justify-center">
                <Activity className="w-4 h-4" />
                系统状态
              </div>
            </button>
          </div>

          {/* 对话推荐 */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-600" />
                    智能推荐助手
                  </CardTitle>
                  <CardDescription>
                    描述您的需求或上传文档，获取可解释的个性化推荐
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
                  {/* 消息列表 */}
                  <div className="flex-1 pr-4 overflow-y-auto">
                    <div className="space-y-4 pb-4">
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
                              <p className="text-sm whitespace-pre-wrap">{String(message.content || '')}</p>
                              
                              {/* 追问类型 */}
                              {message.recommendationType === 'clarification' && message.clarification && (
                                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                                    <Lightbulb className="w-4 h-4" />
                                    需要更多信息
                                  </div>
                                  <div className="mb-3">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                      <span>信息收集进度</span>
                                      <span>{message.clarification.progress.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-amber-500 rounded-full transition-all"
                                        style={{ width: `${message.clarification.progress}%` }}
                                      />
                                    </div>
                                  </div>
                                  {message.clarification.questions && message.clarification.questions.length > 0 ? (
                                    <div className="space-y-3">
                                      {message.clarification.questions.map((q, i) => {
                                        // 获取当前问题的选中答案
                                        const selectedAnswer = questionAnswers[q.id];
                                        return (
                                          <div key={q.id || i} className="bg-white p-2 rounded border border-amber-100">
                                            <div className="flex items-center gap-1 mb-2">
                                              <span className="text-amber-600 font-medium">{i + 1}.</span>
                                              <span className="font-medium">{String(q.question || '')}</span>
                                              {q.required && (
                                                <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1">
                                                  必填
                                                </Badge>
                                              )}
                                              {selectedAnswer && (
                                                <Badge variant="default" className="text-[10px] px-1 py-0 ml-auto bg-green-500">
                                                  已选
                                                </Badge>
                                              )}
                                            </div>
                                            {q.type === 'text' && (
                                              <Input
                                                placeholder={q.placeholder || '请输入...'}
                                                className="h-8 text-sm"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleQuickAnswer(q.id, (e.target as HTMLInputElement).value);
                                                  }
                                                }}
                                                onChange={(e) => {
                                                  handleSelectAnswer(q.id, (e.target as HTMLInputElement).value);
                                                }}
                                              />
                                            )}
                                            {q.options && q.options.length > 0 && (
                                              <div className="flex flex-wrap gap-1.5">
                                                {q.options.map((opt, j) => {
                                                  const isSelected = selectedAnswer === opt;
                                                  return (
                                                    <Button
                                                      key={j}
                                                      variant={isSelected ? "default" : "outline"}
                                                      size="sm"
                                                      className={cn(
                                                        "h-7 text-xs transition-all",
                                                        isSelected 
                                                          ? "bg-amber-500 hover:bg-amber-600 border-amber-500" 
                                                          : "hover:bg-amber-100 hover:border-amber-300"
                                                      )}
                                                      onClick={() => handleSelectAnswer(q.id, opt)}
                                                    >
                                                      {String(opt)}
                                                    </Button>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {/* 提交按钮 */}
                                      {Object.keys(questionAnswers).length > 0 && (
                                        <Button
                                          onClick={handleSubmitAnswers}
                                          className="w-full bg-amber-500 hover:bg-amber-600"
                                        >
                                          提交答案 ({Object.keys(questionAnswers).length}项)
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">
                                      请提供更多信息以便给您精准推荐
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* 消息气泡内不再重复渲染推荐列表，统一在下方“推荐结果”区域展示 */}
                            </div>
                            {message.role === 'user' && (
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-slate-600" />
                              </div>
                            )}
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
                    </div>

                    {/* 推荐结果列表 */}
                    {(() => {
                      // 获取最近一条包含推荐的消息
                      const lastRecMessage = [...messages].reverse().find(m => m.recommendations && m.recommendations.length > 0);
                      if (!lastRecMessage || !lastRecMessage.recommendations) return null;
                      
                      return (
                        <div className="border rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/50 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold mb-4">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                            推荐结果
                            <Badge variant="secondary" className="text-xs ml-auto bg-blue-100 text-blue-700 hover:bg-blue-100">
                              {lastRecMessage.recommendations.length} 项
                            </Badge>
                          </div>
                          <div className="space-y-3">
                            {lastRecMessage.recommendations.slice(0, 5).map((rec, index) => {
                              const rankingRec = rec as RankingItem;
                              const score = rankingRec?.overallScore ?? (rec.score ?? 0) * 100;
                              const isExpanded = expandedRecId === rec.id;

                              return (
                                <Card key={rec.id || index} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                  {/* 可点击的头部 */}
                                  <div
                                    className={cn(
                                      "cursor-pointer transition-colors",
                                      isExpanded ? "bg-gradient-to-r from-blue-50 to-white" : "hover:bg-slate-50"
                                    )}
                                    onClick={() => setExpandedRecId(isExpanded ? null : (rec.id || String(index)))}
                                  >
                                    <div className="p-4">
                                      <div className="flex items-start gap-3">
                                        {/* 排序标识 */}
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                          {index + 1}
                                        </div>

                                        {/* 标题和描述 */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-slate-900 truncate">{String(rec.title || '')}</h3>
                                            <Badge variant={score >= 90 ? "default" : "secondary"} className="text-xs bg-green-100 text-green-700 hover:bg-green-100">
                                              {score.toFixed(0)}% 匹配
                                            </Badge>
                                          </div>
                                          {rec.description && (
                                            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                              {String(rec.description || '')}
                                            </p>
                                          )}
                                        </div>

                                        {/* 展开指示器 */}
                                        <ChevronRight className={cn(
                                          "w-5 h-5 text-slate-400 flex-shrink-0 mt-1 transition-transform",
                                              isExpanded && "rotate-90 text-blue-600"
                                            )} />
                                      </div>
                                    </div>
                                  </div>
                                
                                  {/* 展开的详细内容 */}
                                  {isExpanded && (
                                    <div className="border-t bg-gradient-to-b from-slate-50 to-white">
                                      <CardContent className="pt-4 pb-4">
                                        {/* 推荐理由 */}
                                        {rec.explanation && (
                                          <div className="mb-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-2">
                                              <Info className="w-4 h-4" />
                                              推荐理由
                                            </div>
                                            <p className="text-sm text-slate-700 leading-relaxed">{String(rec.explanation || '')}</p>
                                          </div>
                                        )}

                                        {/* 匹配因素 */}
                                        {rec.factors && rec.factors.length > 0 && (
                                          <div className="mb-4 p-3 bg-slate-50/50 border border-slate-100 rounded-lg">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                                              <Activity className="w-4 h-4" />
                                              匹配因素分析
                                            </div>
                                            <div className="space-y-3">
                                              {rec.factors.map((factor, i) => (
                                                <div key={i}>
                                                  <div className="flex items-center justify-between text-xs mb-1.5">
                                                    <span className="text-slate-600 font-medium">{factor.name}</span>
                                                    <span className="text-slate-500 font-semibold">{(factor.importance * 100).toFixed(0)}%</span>
                                                  </div>
                                                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                                                      style={{ width: `${factor.importance * 100}%` }}
                                                    />
                                                  </div>
                                                  <div className="mt-1 text-xs text-slate-500">{String(factor.value ?? '')}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* 操作按钮 */}
                                        <div className="flex items-center justify-between pt-2 border-t">
                                          {rec.sourceUrl && (
                                            <a
                                              href={rec.sourceUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <ExternalLink className="w-4 h-4" />
                                              查看详情
                                            </a>
                                          )}
                                          <div className="flex items-center gap-1 ml-auto">
                                            {(() => {
                                              const itemId = rec.id || String(index);
                                              const liked = feedbackByItem[itemId] === 'like';
                                              const disliked = feedbackByItem[itemId] === 'dislike';
                                              const pending = !!feedbackPending[itemId];
                                              return (
                                                <>
                                            <Button
                                              variant={liked ? 'secondary' : 'ghost'}
                                              size="sm"
                                              className={cn(
                                                'h-8 px-2 text-xs hover:bg-green-50 hover:text-green-700 gap-1',
                                                liked && 'bg-green-100 text-green-700'
                                              )}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                sendFeedback(itemId, 'like');
                                              }}
                                              disabled={pending}
                                            >
                                              <ThumbsUp className="w-3.5 h-3.5" />
                                              有帮助
                                            </Button>
                                            <Button
                                              variant={disliked ? 'secondary' : 'ghost'}
                                              size="sm"
                                              className={cn(
                                                'h-8 px-2 text-xs hover:bg-red-50 hover:text-red-700 gap-1',
                                                disliked && 'bg-red-100 text-red-700'
                                              )}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                sendFeedback(itemId, 'dislike');
                                              }}
                                              disabled={pending}
                                            >
                                              <ThumbsDown className="w-3.5 h-3.5" />
                                              不相关
                                            </Button>
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </div>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 上传文件预览 */}
                    {uploadedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full text-sm"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span className="max-w-[150px] truncate">{file.name}</span>
                            <button
                              onClick={() => removeFile(file.id)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 输入区域 */}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.md,.pdf,.doc,.docx"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        title="上传文档"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Input
                        ref={inputRef}
                        placeholder="描述您的需求..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        className="flex-1"
                      />
                      <Button onClick={sendMessage} disabled={isLoading} data-send-button>
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
          )}

          {/* 知识图谱 */}
          {activeTab === 'knowledge' && (
            <div className="flex-1 mt-0">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-blue-600" />
                  推荐知识图谱
                </CardTitle>
                <CardDescription>
                  展示推荐系统的知识关联和推理路径
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                {/* 知识图谱区域 */}
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
          </div>
          )}

          {/* 系统状态 */}
          {activeTab === 'stats' && (
            <div className="flex-1 mt-0">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 推荐统计 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    推荐统计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">本次会话推荐</span>
                      <span className="font-medium">{messages.filter(m => m.recommendations).reduce((sum, m) => sum + (m.recommendations?.length || 0), 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">对话轮次</span>
                      <span className="font-medium">{messages.filter(m => m.role === 'user').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">上传文档</span>
                      <span className="font-medium">{uploadedFiles.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PPO详情 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-600" />
                    PPO 策略优化
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">训练步数</span>
                      <span className="font-medium">{ppoStats.totalSteps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">平均奖励</span>
                      <span className="font-medium">{ppoStats.avgReward.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">经验缓冲区</span>
                      <span className="font-medium">{ppoStats.bufferSize} / 256</span>
                    </div>
                    <div className="mt-2">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                          style={{ width: `${Math.min(100, (ppoStats.bufferSize / 256) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ppoStats.bufferSize >= 256 ? '已就绪，可进行训练' : '收集更多经验以启动训练'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 系统健康 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-600" />
                    系统健康
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: '数据库', status: 'up' },
                      { name: '向量存储', status: 'up' },
                      { name: 'LLM服务', status: 'up' },
                      { name: 'PPO模块', status: 'up' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm">{item.name}</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          正常
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 当前配置 */}
              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-600" />
                    当前推荐配置
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-5 gap-4">
                    {[
                      { name: '内容匹配', value: 30, color: 'bg-blue-500' },
                      { name: '协同过滤', value: 30, color: 'bg-purple-500' },
                      { name: '知识图谱', value: 20, color: 'bg-green-500' },
                      { name: '智能体', value: 10, color: 'bg-orange-500' },
                      { name: '因果推断', value: 10, color: 'bg-pink-500' },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.name}</span>
                          <span className="font-medium">{item.value}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* 页脚 */}
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            OpenXRec - 开放可解释多智能体推荐框架
          </p>
        </div>
      </footer>

      {/* 知识库浮动面板 */}
      <KnowledgeBasePanel 
        isOpen={isKnowledgeBaseOpen} 
        onClose={() => setIsKnowledgeBaseOpen(false)} 
      />

      {/* 案例库浮动面板 */}
      <CasesPanel 
        isOpen={isCasesOpen} 
        onClose={() => setIsCasesOpen(false)}
        onSelectTemplate={(query) => {
          setInput(query);
          setTimeout(() => {
            const sendButton = document.querySelector('[data-send-button]') as HTMLButtonElement;
            sendButton?.click();
          }, 100);
        }}
      />
    </div>
  );
}
