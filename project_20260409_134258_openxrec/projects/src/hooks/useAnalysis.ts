'use client';

import { useState, useCallback, useMemo } from 'react';
import { AnalysisState } from '@/types';

// 跳过决策类型
export interface SkipDecision {
  skipSearch: boolean;
  skipSourceEvaluator: boolean;
  skipTimeline: boolean;
  skipCausalInference: boolean;
  skipScenario: boolean;
  skipKeyFactor: boolean;
  reason: string;
}

// 智能体调度信息
export interface AgentSchedule {
  requiredAgents: string[];
  coreObjective: string;
  keyQuestions: string[];
  analysisPlan: string[];
}

// 相似案例类型
export interface SimilarCase {
  id: string;
  topic: string;
  similarity: number;
  conclusion?: string | Record<string, unknown>;
  confidence?: string;
  createdAt?: string;
  analyzedAt?: string;
}

// 分析结果扩展
export interface ExtendedAnalysisState extends AnalysisState {
  taskComplexity?: 'simple' | 'moderate' | 'complex';
  skipDecision?: SkipDecision;
  skippedAgents?: string[];
  agentSchedule?: AgentSchedule;
}

// 相似案例检测配置
const SIMILAR_CASE_THRESHOLD = 0.75; // 相似度阈值
const SIMILAR_CASE_LIMIT = 5; // 最多返回5个相似案例

export function useAnalysis() {
  const [analysis, setAnalysis] = useState<ExtendedAnalysisState>({
    stage: 'idle',
    message: '',
    progress: 0,
    layers: [],
    completeData: null,
    eventGraph: null
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string>('');
  const [agentOutputs, setAgentOutputs] = useState<Record<string, string>>({});
  const [skippedAgents, setSkippedAgents] = useState<string[]>([]);
  const [taskComplexity, setTaskComplexity] = useState<'simple' | 'moderate' | 'complex'>('moderate');
  const [skipDecision, setSkipDecision] = useState<SkipDecision | null>(null);
  const [agentSchedule, setAgentSchedule] = useState<AgentSchedule | null>(null);
  
  // 相似案例状态
  const [similarCases, setSimilarCases] = useState<SimilarCase[]>([]);
  const [pendingTopic, setPendingTopic] = useState<string>(''); // 待确认的分析主题

  // 计算需要执行的智能体总数（用于进度计算）
  // 优先使用 agentSchedule 中的数量，否则使用全部智能体数量（18个）
  const totalRequiredAgents = useMemo(() => {
    // 如果已有调度计划，使用实际需要执行的智能体数量
    if (agentSchedule?.requiredAgents?.length) {
      return agentSchedule.requiredAgents.length;
    }
    // 默认使用全部智能体数量（五层架构共18个智能体）
    return 18;
  }, [agentSchedule]);

  // 计算已完成的智能体数量
  const completedAgentCount = useMemo(() => {
    return Object.keys(agentOutputs).filter(
      key => agentOutputs[key]?.includes('完成') && key !== 'system'
    ).length;
  }, [agentOutputs]);

  // 动态计算进度（基于已完成/需要执行的智能体比例）
  const calculateProgress = useCallback((completed: number, total: number, isComplete: boolean = false) => {
    if (isComplete) return 100;
    if (total <= 0) return 5;
    // 进度范围：5% - 95%，留 5% 给最终完成
    const baseProgress = 5;
    const maxProgress = 95;
    const progressPerAgent = (maxProgress - baseProgress) / total;
    return Math.min(Math.round(baseProgress + completed * progressPerAgent), maxProgress);
  }, []);

  /**
   * 搜索相似案例
   * 返回相似度超过阈值的案例列表
   */
  const searchSimilarCases = useCallback(async (topic: string): Promise<SimilarCase[]> => {
    try {
      const response = await fetch('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: topic,
          type: 'cases',
          limit: SIMILAR_CASE_LIMIT,
          threshold: SIMILAR_CASE_THRESHOLD,
        }),
      });

      if (!response.ok) {
        console.warn('[SimilarCases] Search failed');
        return [];
      }

      const data = await response.json();
      const cases = data.data?.results?.cases || [];
      
      return cases.map((c: any) => ({
        id: c.id,
        topic: c.topic || c.query,
        similarity: c.similarity,
        conclusion: c.conclusion,
        confidence: c.confidence,
        createdAt: c.createdAt || c.analyzed_at,
        analyzedAt: c.analyzed_at,
      }));
    } catch (error) {
      console.error('[SimilarCases] Search error:', error);
      return [];
    }
  }, []);

  /**
   * 检查相似案例（分析前调用）
   * 如果发现相似案例，返回true并设置similarCases状态
   */
  const checkSimilarCases = useCallback(async (topic: string): Promise<boolean> => {
    const cases = await searchSimilarCases(topic);
    
    if (cases.length > 0) {
      setSimilarCases(cases);
      setPendingTopic(topic);
      return true; // 发现相似案例，需要用户确认
    }
    
    return false; // 无相似案例，可以直接分析
  }, [searchSimilarCases]);

  /**
   * 清除相似案例状态（用户选择重新分析后调用）
   */
  const clearSimilarCases = useCallback(() => {
    setSimilarCases([]);
    setPendingTopic('');
  }, []);

  /**
   * 执行分析（跳过相似案例检查，直接开始分析）
   */
  const executeAnalysis = useCallback(async (topic: string) => {
    if (!topic.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysis({
      stage: 'coordinator',
      message: '正在初始化 LangGraph 智能体系统...',
      progress: 5,
      layers: [],
      completeData: null
    });
    
    // 重置Agent状态
    setCurrentAgent('');
    setSkippedAgents([]);
    setTaskComplexity('moderate');
    setSkipDecision(null);
    setAgentSchedule(null);
    setAgentOutputs({
      system: '',
      coordinator: '',
      search: '',
      source_evaluator: '',
      timeline: '',
      causal_inference: '',
      scenario: '',
      key_factor: '',
      report: '',
      quality_check: ''
    });

    try {
      // 使用 LangGraph API
      const apiEndpoint = '/api/analyze-langgraph';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic: topic.trim(),
          timeRange: '3m'
        })
      });

      if (!response.ok) {
        throw new Error('分析请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            
            try {
              const data = JSON.parse(jsonStr);
              
              switch (data.type) {
                case 'start':
                  setAgentOutputs(prev => ({
                    ...prev,
                    system: '🚀 LangGraph 智能体系统已启动'
                  }));
                  break;
                  
                case 'system':
                  setAgentOutputs(prev => ({
                    ...prev,
                    system: prev.system ? `${prev.system}\n${data.message}` : data.message
                  }));
                  break;
                  
                case 'agent_start':
                  const agentId = data.agent;
                  if (agentId) {
                    setCurrentAgent(agentId);
                    setAgentOutputs(prev => ({
                      ...prev,
                      [agentId]: `🚀 ${data.name || agentId} 开始工作...`
                    }));
                  }
                  break;
                
                case 'agent_thinking':
                  if (data.agent && data.message) {
                    setAgentOutputs(prev => ({
                      ...prev,
                      [data.agent]: prev[data.agent] 
                        ? `${prev[data.agent]}\n\n💭 ${data.message}`
                        : `💭 ${data.message}`
                    }));
                  }
                  break;
                
                case 'agent_complete':
                  if (data.agent) {
                    setAgentOutputs(prev => {
                      const agentKey = data.agent as keyof typeof prev;
                      const updated: Record<string, string> = {
                        ...prev,
                        [agentKey]: prev[agentKey] 
                          ? `${prev[agentKey]}\n\n✅ 完成\n\n${data.result || ''}`
                          : `✅ 完成\n\n${data.result || ''}`
                      };
                      
                      // 动态计算进度：基于已完成数量和总需求数量
                      const completedCount = Object.keys(updated).filter(
                        key => updated[key]?.includes('完成') && key !== 'system'
                      ).length;
                      
                      setAnalysis(prev => ({
                        ...prev,
                        progress: calculateProgress(completedCount, totalRequiredAgents)
                      }));
                      
                      return updated;
                    });
                  }
                  break;
                
                case 'agent_skip':
                  if (data.agent) {
                    setSkippedAgents(prev => [...prev, data.agent]);
                    setAgentOutputs(prev => ({
                      ...prev,
                      [data.agent]: `⏭️ 跳过\n原因: ${data.reason || '根据任务复杂度自动跳过'}`
                    }));
                  }
                  break;
                
                case 'complexity_analysis':
                  if (data.complexity) {
                    setTaskComplexity(data.complexity);
                    setSkipDecision(data.skipDecision);
                    // 保存智能体调度信息
                    if (data.agentSchedule) {
                      setAgentSchedule(data.agentSchedule);
                    }
                    setAgentOutputs(prev => ({
                      ...prev,
                      coordinator: prev.coordinator 
                        ? `${prev.coordinator}\n\n📊 任务复杂度: ${data.complexity}\n需要执行 ${data.agentSchedule?.requiredAgents?.length || 0} 个智能体\n${data.skipDecision?.reason || ''}`
                        : `📊 任务复杂度: ${data.complexity}\n需要执行 ${data.agentSchedule?.requiredAgents?.length || 0} 个智能体\n${data.skipDecision?.reason || ''}`
                    }));
                  }
                  break;

                case 'agent_schedule':
                  // 接收智能体调度信息
                  if (data.schedule) {
                    const newSchedule = data.schedule;
                    setAgentSchedule(newSchedule);
                    const newTotalAgents = newSchedule.requiredAgents?.length || 18;
                    
                    setAgentOutputs(prev => {
                      const updated: Record<string, string> = {
                        ...prev,
                        system: prev.system ? `${prev.system}\n📋 需要执行 ${newTotalAgents} 个智能体` : `📋 需要执行 ${newTotalAgents} 个智能体`
                      };
                      
                      // 更新进度：重新计算基于新的智能体调度
                      const completedCount = Object.keys(updated).filter(
                        key => updated[key]?.includes('完成') && key !== 'system'
                      ).length;
                      
                      setAnalysis(prevAnalysis => ({
                        ...prevAnalysis,
                        progress: calculateProgress(completedCount, newTotalAgents)
                      }));
                      
                      return updated;
                    });
                  }
                  break;

                case 'event_graph':
                  if (data.graph) {
                    setAnalysis(prev => ({
                      ...prev,
                      eventGraph: data.graph
                    }));
                  }
                  break;

                case 'incremental_graph':
                  // 增量图谱更新：合并新增的节点和边，并更新已存在节点的状态
                  if (data.update && (data.update.nodes || data.update.edges)) {
                    console.log('[IncrementalGraph] Received update:', {
                      type: data.update.type,
                      agentId: data.update.agentId,
                      agentStatus: data.update.agentStatus,
                      nodesCount: data.update.nodes?.length || 0,
                      edgesCount: data.update.edges?.length || 0,
                      message: data.update.message
                    });
                    
                    setAnalysis(prev => {
                      const prevGraph = prev.eventGraph || { nodes: [], edges: [] };
                      
                      // 过滤掉 null/undefined 元素，确保安全
                      const validNodes = (data.update.nodes || []).filter((n: any) => n && n.id);
                      const validEdges = (data.update.edges || []).filter((e: any) => e && e.id);
                      
                      // 更新或添加节点（重要：需要更新已存在节点的状态，如 running -> completed）
                      const newNodeIds = new Set(validNodes.map((n: any) => n.id));
                      const existingNodesNotUpdated = (prevGraph.nodes || []).filter(
                        (n: any) => n && n.id && !newNodeIds.has(n.id)
                      );
                      const updatedNodes = [...existingNodesNotUpdated, ...validNodes];
                      
                      // 更新或添加边
                      const newEdgeIds = new Set(validEdges.map((e: any) => e.id));
                      const existingEdgesNotUpdated = (prevGraph.edges || []).filter(
                        (e: any) => e && e.id && !newEdgeIds.has(e.id)
                      );
                      const updatedEdges = [...existingEdgesNotUpdated, ...validEdges];
                      
                      const resultGraph = {
                        nodes: updatedNodes,
                        edges: updatedEdges,
                        searchResults: prevGraph.searchResults
                      };
                      
                      console.log('[IncrementalGraph] Updated graph stats:', {
                        totalNodes: resultGraph.nodes.length,
                        totalEdges: resultGraph.edges.length,
                        updatedNodes: data.update.nodes?.length || 0,
                        updatedEdges: data.update.edges?.length || 0
                      });
                      
                      return {
                        ...prev,
                        eventGraph: resultGraph
                      };
                    });
                  }
                  break;

                case 'complete':
                  setCurrentAgent('');
                  setAnalysis(prev => ({
                    ...prev,
                    stage: 'complete',
                    message: '分析完成',
                    progress: 100,
                    completeData: data.data,
                    eventGraph: data.data?.eventGraph || prev.eventGraph
                  }));
                  break;

                case 'error':
                  let errMessage: string;
                  try {
                    if (typeof data.error === 'string') {
                      errMessage = data.error;
                    } else if (data.error && typeof data.error === 'object') {
                      errMessage = data.error.message || data.error.error || 
                                   data.error.msg || data.error.detail ||
                                   '服务器返回错误';
                    } else if (data.message) {
                      errMessage = data.message;
                    } else {
                      errMessage = '未知错误';
                    }
                  } catch {
                    errMessage = '服务器返回错误';
                  }
                  throw new Error(errMessage);
                  
                default:
                  break;
              }
            } catch (e) {
              if (jsonStr.length > 0 && !jsonStr.startsWith('{')) {
                console.warn('Skip non-JSON line:', jsonStr.substring(0, 50));
              } else if (e instanceof Error) {
                throw e;
              }
            }
          }
        }
      }
    } catch (error) {
      let errorMessage = '分析失败';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        const errObj = error as any;
        errorMessage = errObj.message || errObj.error || errObj.detail || 
                       errObj.msg || JSON.stringify(error);
      }
      
      console.error('Analysis error:', errorMessage, error);
      
      setAnalysis(prev => ({
        ...prev,
        stage: 'error',
        message: errorMessage,
        error: errorMessage
      }));
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  /**
   * 处理分析请求（带相似案例检查）
   * 1. 先搜索相似案例
   * 2. 如果发现相似案例，设置状态等待用户确认
   * 3. 如果无相似案例，直接执行分析
   */
  const handleAnalyze = useCallback(async (topic: string) => {
    if (!topic.trim() || isAnalyzing) return;
    
    // 检查相似案例
    const hasSimilarCases = await checkSimilarCases(topic.trim());
    
    if (hasSimilarCases) {
      // 发现相似案例，等待用户确认
      return;
    }
    
    // 无相似案例，直接执行分析
    await executeAnalysis(topic.trim());
  }, [isAnalyzing, checkSimilarCases, executeAnalysis]);

  /**
   * 强制执行分析（跳过相似案例检查）
   * 用户选择"重新分析"时调用
   */
  const forceAnalyze = useCallback(async (topic: string) => {
    clearSimilarCases();
    await executeAnalysis(topic.trim());
  }, [clearSimilarCases, executeAnalysis]);

  return {
    analysis,
    setAnalysis,
    isAnalyzing,
    setIsAnalyzing,
    currentAgent,
    agentOutputs,
    skippedAgents,
    taskComplexity,
    skipDecision,
    handleAnalyze,
    forceAnalyze,
    // 相似案例相关
    similarCases,
    pendingTopic,
    clearSimilarCases,
  };
}
