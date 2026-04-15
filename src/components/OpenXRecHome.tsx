'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Bot,
  Loader2,
  Brain,
  Network,
  Layers,
  GitBranch,
  ArrowRight,
  Settings,
  Activity,
  Zap,
  Target,
  TrendingUp,
  MessageSquare,
  Eye,
  Shield,
} from 'lucide-react';
import KnowledgeBasePanel from '@/components/knowledge/KnowledgeBasePanel';
import CasesPanel from '@/components/cases/CasesPanel';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ChatPanel } from '@/components/chat/ChatPanel';
import type { KGEntity, KGRelation } from '@/lib/knowledge-graph/types';
import { OpenXRecHeader } from '@/components/openxrec/OpenXRecHeader';
import { OpenXRecSessionSidebar } from '@/components/openxrec/OpenXRecSessionSidebar';
import { OpenXRecMessageList } from '@/components/openxrec/OpenXRecMessageList';
import { OpenXRecRecommendationPanel } from '@/components/openxrec/OpenXRecRecommendationPanel';
import { OpenXRecComposer } from '@/components/openxrec/OpenXRecComposer';
import { OpenXRecEventTraceTab } from '@/components/openxrec/OpenXRecEventTraceTab';
import {
  type Message,
  type UploadedFile,
  generateSessionId,
  quickExamples,
} from '@/components/openxrec/types';

// 动态导入图谱组件
const KnowledgeGraph = dynamic(() => import('@/components/knowledge/KnowledgeGraph'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-muted/30 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function OpenXRecHome() {
  const initialSessionIdRef = useRef(generateSessionId());
  const initialSessionId = initialSessionIdRef.current;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [sessionList, setSessionList] = useState<
    Array<{ id: string; title: string; createdAt: number; updatedAt: number }>
  >([
    {
      id: initialSessionId,
      title: '新会话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]);
  const [sessionMessages, setSessionMessages] = useState<Record<string, Message[]>>({
    [initialSessionId]: [],
  });
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
  const [liveTrace, setLiveTrace] = useState<{
    currentPhase: string | null;
    phases: string[];
    phaseTimings: Record<string, number>;
  }>({
    currentPhase: null,
    phases: [],
    phaseTimings: {},
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  /** 最近一条含推荐结果的助手消息（主输入仍走 /api/recommendation） */
  const lastRecMessage = useMemo(
    () => [...messages].reverse().find((m) => m.recommendations && m.recommendations.length > 0),
    [messages]
  );
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'user'),
    [messages]
  );
  /** 与卡片展开一致：优先当前展开项，否则默认绑定列表首项，供 ChatPanel → /api/chat-feedback */
  const chatFeedbackItemId = useMemo(() => {
    if (!lastRecMessage?.recommendations?.length) return undefined;
    const recs = lastRecMessage.recommendations;
    if (expandedRecId) {
      const match = recs.find((r, i) => (r.id || String(i)) === expandedRecId);
      if (match) return match.id || expandedRecId;
    }
    const first = recs[0];
    return first ? first.id || '0' : undefined;
  }, [lastRecMessage, expandedRecId]);

  const deriveSessionTitle = useCallback((sessionMsgs: Message[]) => {
    const firstUser = sessionMsgs.find((m) => m.role === 'user' && m.content.trim());
    if (!firstUser) return '新会话';
    const plain = firstUser.content.trim().replace(/\s+/g, ' ');
    return plain.length > 16 ? `${plain.slice(0, 16)}...` : plain;
  }, []);

  useEffect(() => {
    setSessionMessages((prev) => ({ ...prev, [sessionId]: messages }));
    setSessionList((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: deriveSessionTitle(messages),
              updatedAt: Date.now(),
            }
          : session
      )
    );
  }, [messages, sessionId, deriveSessionTitle]);

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
    
  };

  // 移除文件
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const requestRecommendations = async (queryText: string, forceRefresh: boolean = false) => {
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLiveTrace({ currentPhase: null, phases: [], phaseTimings: {} });
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

      const requestPayload = {
        userId: sessionId,
        sessionId,
        scenario: 'general',
        context: {
          query: queryText,
          ...requestContext,
        },
        forceRefresh,
        options: {
          topK: 5,
          withExplanation: true,
          enableDiversity: true,
        },
      };

      let data: any = null;
      try {
        // 默认走流式：实时展示智能体执行链路
        const response = await fetch('/api/recommendation/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            ...requestPayload,
            stream: true,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`stream_request_failed_${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handleSseBlock = (block: string) => {
          const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
          if (lines.length === 0) return;
          const eventLine = lines.find((line) => line.startsWith('event:'));
          const dataLine = lines.find((line) => line.startsWith('data:'));
          if (!dataLine) return;
          const eventName = eventLine ? eventLine.replace('event:', '').trim() : 'message';
          const payloadRaw = dataLine.replace('data:', '').trim();
          if (!payloadRaw) return;

          let payload: any;
          try {
            payload = JSON.parse(payloadRaw);
          } catch {
            return;
          }

          if (eventName === 'progress') {
            const phase = typeof payload.phase === 'string' ? payload.phase : '';
            const status = typeof payload.status === 'string' ? payload.status : '';
            setLiveTrace((prev) => {
              const nextPhases = phase && !prev.phases.includes(phase) ? [...prev.phases, phase] : prev.phases;
              return {
                currentPhase: status === 'start' ? phase : prev.currentPhase === phase ? null : prev.currentPhase,
                phases: nextPhases,
                phaseTimings:
                  payload.phaseTimings && typeof payload.phaseTimings === 'object'
                    ? { ...prev.phaseTimings, ...payload.phaseTimings }
                    : prev.phaseTimings,
              };
            });
            return;
          }

          if (eventName === 'final') {
            data = payload;
            return;
          }

          if (eventName === 'error') {
            throw new Error(payload?.message || 'stream_error');
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            handleSseBlock(chunk);
          }
        }
        if (buffer.trim()) {
          handleSseBlock(buffer);
        }
        if (!data) {
          throw new Error('stream_missing_final_payload');
        }
      } catch (streamError) {
        if (streamError instanceof DOMException && streamError.name === 'AbortError') {
          throw streamError;
        }
        console.warn('[OpenXRecHome] SSE unavailable, fallback to JSON:', streamError);
        setLiveTrace((prev) => ({ ...prev, currentPhase: null }));

        // 仅在流式不可用时兜底到非流式
        const fallbackResponse = await fetch('/api/recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            ...requestPayload,
            stream: false,
          }),
        });
        if (!fallbackResponse.ok) {
          throw new Error(`fallback_request_failed_${fallbackResponse.status}`);
        }
        data = await fallbackResponse.json();
      }
      
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
        setClarificationContext(queryText);
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
          responseMeta: data.data.metadata || {},
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
      if (error instanceof DOMException && error.name === 'AbortError') {
        const stoppedMessage: Message = {
          id: `msg_${Date.now()}_stopped`,
          role: 'assistant',
          content: '已停止当前推荐任务。您可以继续提问，或点击“新会话”开始新的推荐。',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, stoppedMessage]);
        return;
      }
      console.error('Failed to get recommendations:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '抱歉，推荐服务暂时不可用。请稍后重试。',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      setLiveTrace((prev) => ({ ...prev, currentPhase: null }));
      setIsLoading(false);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() && uploadedFiles.length === 0) return;

    const queryText = input;
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    await requestRecommendations(queryText, false);
  };

  const rerunFullRecommendation = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user' && m.content.trim());
    const queryText = lastUser?.content?.trim();
    if (!queryText || isLoading) return;
    setIsLoading(true);
    await requestRecommendations(queryText, true);
  };

  const handleStopGeneration = () => {
    if (!isLoading) return;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setLiveTrace({ currentPhase: null, phases: [], phaseTimings: {} });
    setIsLoading(false);
  };

  const resetSessionScopedViewState = () => {
    setInput('');
    setUploadedFiles([]);
    setClarificationContext(null);
    setQuestionAnswers({});
    setActiveClarificationId(null);
    setKgEntities([]);
    setKgRelations([]);
    setExpandedRecId(null);
    setFeedbackByItem({});
    setFeedbackPending({});
    setLiveTrace({ currentPhase: null, phases: [], phaseTimings: {} });
  };

  const handleSwitchSession = (targetSessionId: string) => {
    if (targetSessionId === sessionId) return;
    if (isLoading) handleStopGeneration();
    setSessionId(targetSessionId);
    setMessages(sessionMessages[targetSessionId] || []);
    resetSessionScopedViewState();
  };

  const handleNewSession = () => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setIsLoading(false);
    const now = Date.now();
    const newSessionId = generateSessionId();
    setSessionMessages((prev) => ({
      ...prev,
      [sessionId]: messages,
      [newSessionId]: [],
    }));
    setSessionList((prev) => [
      {
        id: newSessionId,
        title: '新会话',
        createdAt: now,
        updatedAt: now,
      },
      ...prev.map((item) =>
        item.id === sessionId
          ? { ...item, title: deriveSessionTitle(messages), updatedAt: now }
          : item
      ),
    ]);
    setSessionId(newSessionId);
    setMessages([]);
    resetSessionScopedViewState();
    setActiveTab('chat');
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
      <OpenXRecHeader
        onOpenKnowledgeBase={() => setIsKnowledgeBaseOpen(true)}
        onOpenCases={() => setIsCasesOpen(true)}
      />

      {/* 主内容区 */}
      <div className="flex-1 container mx-auto px-4 py-6 overflow-hidden">
        <div className="h-full flex flex-col min-h-0">
          <div className="grid w-full grid-cols-4 max-w-2xl mx-auto mb-4">
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
              onClick={() => setActiveTab('event')}
              className={`px-4 py-2 text-sm font-medium border-y border-r border-l-0 ${
                activeTab === 'event'
                  ? 'bg-background text-foreground border-input'
                  : 'bg-muted/50 text-muted-foreground border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5 justify-center">
                <GitBranch className="w-4 h-4" />
                事件图谱
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
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 min-h-0">
              <OpenXRecSessionSidebar
                sessionList={sessionList}
                sessionId={sessionId}
                sessionMessages={sessionMessages}
                isLoading={isLoading}
                onNewSession={handleNewSession}
                onSwitchSession={handleSwitchSession}
              />

              <div className="min-h-0 flex flex-col">
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
                  <OpenXRecMessageList
                    messages={messages}
                    isLoading={isLoading}
                    quickExamples={quickExamples}
                    questionAnswers={questionAnswers}
                    onExampleClick={handleExampleClick}
                    onSelectAnswer={handleSelectAnswer}
                    onQuickAnswer={handleQuickAnswer}
                    onSubmitAnswers={handleSubmitAnswers}
                    messagesEndRef={messagesEndRef}
                  />

                    <OpenXRecRecommendationPanel
                      lastRecMessage={lastRecMessage}
                      isLoading={isLoading}
                      expandedRecId={expandedRecId}
                      feedbackByItem={feedbackByItem}
                      feedbackPending={feedbackPending}
                      onExpandedRecChange={setExpandedRecId}
                      onRerunFullRecommendation={rerunFullRecommendation}
                      onSendFeedback={sendFeedback}
                    />

                    {/* 与研判页一致的 Chat 反馈入口：自然语言走 /api/chat-feedback，并带 recommendationContext 写入统一反馈桥 */}
                    {lastRecMessage && chatFeedbackItemId && (
                      <ChatPanel
                        key={`${lastRecMessage.id}-${chatFeedbackItemId}`}
                        className="mt-4 border-blue-100/80 bg-slate-50/50"
                        defaultExpanded={false}
                        analysisContext={{
                          query: lastUserMessage?.content,
                          finalReport:
                            lastRecMessage.explanation ||
                            lastRecMessage.content ||
                            undefined,
                        }}
                        recommendationContext={{
                          userId: sessionId,
                          itemId: chatFeedbackItemId,
                        }}
                      />
                    )}

                    <OpenXRecComposer
                      uploadedFiles={uploadedFiles}
                      input={input}
                      isLoading={isLoading}
                      inputRef={inputRef}
                      onInputChange={setInput}
                      onFileUpload={handleFileUpload}
                      onRemoveFile={removeFile}
                      onSend={sendMessage}
                      onStop={handleStopGeneration}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'event' && (
            <OpenXRecEventTraceTab
              topic={lastUserMessage?.content || '推荐任务'}
              isLoading={isLoading}
              lastRecMessage={lastRecMessage}
              kgEntities={kgEntities}
              kgRelations={kgRelations}
              liveTrace={liveTrace}
            />
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
