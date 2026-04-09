/**
 * LangGraph 工作流图定义
 * 定义多智能体协作的分析流程，支持条件跳过和回退机制
 */

import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { AnalysisState, AnalysisStateType, AGENT_NODES, SearchItem, AgentSchedule, TaskComplexity, AgentError, isAgentRequired } from './state';
import { 
  createLLMClient,
  coordinatorNode,
  searchNode,
  sourceEvaluatorNode,
  timelineNode,
  causalInferenceNode,
  scenarioNode,
  keyFactorNode,
  reportNode,
  qualityCheckNode,
  geoExtractorNode,
  eventExtractorNode,
  sensitivityAnalysisNode,
  actionAdvisorNode,
  resultValidatorNode,
  documentExecutorNode,
  executionMonitorNode,
  knowledgeManagerNode,
  reviewAnalystNode,
  executeAgentWithFallback
} from './nodes';
import { LLMClient, HeaderUtils } from 'coze-coding-dev-sdk';
import { advancedWebSearch } from '@/lib/search/advanced-web-search';
import {
  getAnalysisForwardHeaders,
  setAnalysisForwardHeaders,
  clearAnalysisForwardHeaders,
} from './analysis-graph-context';
import { mergeSchedulingIntoAgentSchedule } from './schedule-merge';
import { IntelligentScheduler } from './intelligent-scheduler';
import { getCanonicalAgentId, getAgentDisplayConfig, AGENT_LAYERS } from './agent-config';

/**
 * 回调函数类型
 */
export interface GraphCallbacks {
  onAgentStart?: (agentId: string, agentName: string) => void;
  onAgentThinking?: (agentId: string, message: string) => void;
  onAgentComplete?: (agentId: string, result: string) => void;
  onAgentSkip?: (agentId: string, agentName: string, reason: string) => void;
  onAgentError?: (agentId: string, agentName: string, error: string, fallback?: string) => void;
  onSystem?: (message: string) => void;
  onEventGraph?: (graph: any) => void;
  onIncrementalGraph?: (update: IncrementalGraphUpdate) => void;  // 新增：增量图谱更新
  onAgentSchedule?: (schedule: AgentSchedule) => void;  // 智能体编排回调
}

/**
 * 增量图谱更新类型
 */
export interface IncrementalGraphUpdate {
  type: 'agent_start' | 'agent_complete' | 'data_node_add' | 'edge_add';
  agentId?: string;
  agentStatus?: 'running' | 'completed' | 'skipped' | 'error';
  nodes?: any[];      // 新增的节点
  edges?: any[];      // 新增的边
  state?: Partial<AnalysisStateType>;  // 当前状态快照
  message?: string;   // 进度消息
}

/**
 * 节点执行选项
 */
interface NodeExecutionOptions {
  agentId: string;
  agentName: string;
  nodeFn: (state: AnalysisStateType, llmClient: LLMClient) => Promise<Partial<AnalysisStateType>>;
  skipCondition?: boolean;
  skipReason?: string;
}

/**
 * 安全执行节点（带回退和错误收集）
 */
async function safeExecuteNode(
  state: Partial<AnalysisStateType>,
  llmClient: LLMClient,
  options: NodeExecutionOptions,
  callbacks: GraphCallbacks,
  errors: AgentError[]
): Promise<{ state: Partial<AnalysisStateType>; skipped: boolean }> {
  const { agentId, agentName, nodeFn, skipCondition, skipReason } = options;
  
  // 检查是否跳过
  if (skipCondition) {
    callbacks.onAgentSkip?.(agentId, agentName, skipReason || '条件跳过');
    return { state, skipped: true };
  }
  
  // 执行节点（带重试和回退）
  callbacks.onAgentStart?.(agentId, agentName);
  callbacks.onAgentThinking?.(agentId, '正在处理...');
  
  try {
    const { result, error } = await executeAgentWithFallback<Partial<AnalysisStateType>>(
      agentId,
      agentName,
      state as AnalysisStateType,
      llmClient,
      nodeFn,
      {
        onRetry: (attempt, err) => {
          callbacks.onAgentThinking?.(agentId, `重试第 ${attempt} 次...`);
        },
        onFallback: (strategy) => {
          callbacks.onAgentError?.(agentId, agentName, '执行失败，已启用回退策略', strategy);
        }
      }
    );
    
    if (error) {
      errors.push(error);
      callbacks.onAgentError?.(agentId, agentName, error.error, error.fallbackUsed);
    }
    
    const newState = { ...state, ...result };
    callbacks.onAgentComplete?.(agentId, Object.values(result).slice(0, 1)[0]?.toString?.().substring(0, 200) || '');
    
    return { state: newState, skipped: false };
  } catch (error) {
    const agentError: AgentError = {
      agentId,
      agentName,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      recovered: false
    };
    errors.push(agentError);
    callbacks.onAgentError?.(agentId, agentName, agentError.error);
    return { state, skipped: false };
  }
}

/**
 * 智能体配置（用于图谱展示）- 统一颜色
 */
const AGENT_COLOR = 'bg-[#4a5568]';  // 深灰色

/**
 * 五层架构智能体显示配置
 * 包含每层的智能体节点及其显示属性
 */
const AGENT_DISPLAY_CONFIG: Record<string, { name: string; icon: string; layer: string }> = {
  // ========== 调度层 (Scheduler) - 独立协调器 ==========
  // 特点：独立于五类智能体，是"指挥官"角色
  intent_parser: { name: '意图解析器', icon: 'Target', layer: 'scheduler' },
  
  // ========== 感知体层 (Perception) ==========
  // 完整链路：采集 → 抽取 → 评估
  scout_cluster: { name: '侦察兵集群', icon: 'Globe', layer: 'perception' },
  event_extractor: { name: '事件抽取器', icon: 'Filter', layer: 'perception' },
  quality_evaluator: { name: '质量评估器', icon: 'ShieldCheck', layer: 'perception' },
  geo_extractor: { name: '地理抽取器', icon: 'MapPin', layer: 'perception' },
  
  // ========== 认知体层 (Cognition) ==========
  // 完整链路：时序 → 因果 → 知识 → 验证
  timeline_analyst: { name: '时序分析师', icon: 'Clock', layer: 'cognition' },
  causal_analyst: { name: '因果分析师', icon: 'GitBranch', layer: 'cognition' },
  knowledge_extractor: { name: '知识抽取器', icon: 'Lightbulb', layer: 'cognition' },
  result_validator: { name: '结果验证器', icon: 'CheckCircle2', layer: 'cognition' },
  
  // ========== 决策体层 (Decision) ==========
  // 完整链路：推演 → 分析 → 建议
  scenario_simulator: { name: '场景推演器', icon: 'TrendingUp', layer: 'decision' },
  sensitivity_analyst: { name: '敏感性分析师', icon: 'Activity', layer: 'decision' },
  action_advisor: { name: '行动建议器', icon: 'Compass', layer: 'decision' },
  
  // ========== 行动体层 (Action) ==========
  // 完整链路：生成 → 执行 → 控制 → 监控
  report_generator: { name: '报告生成器', icon: 'FileText', layer: 'action' },
  document_executor: { name: '文档执行器', icon: 'Save', layer: 'action' },
  quality_controller: { name: '质量控制器', icon: 'AlertOctagon', layer: 'action' },
  execution_monitor: { name: '执行监控器', icon: 'Monitor', layer: 'action' },
  
  // ========== 进化体层 (Evolution) ==========
  // 完整链路：存储 → 检索 → 复盘
  knowledge_manager: { name: '知识管理器', icon: 'Database', layer: 'evolution' },
  review_analyst: { name: '复盘分析师', icon: 'RefreshCw', layer: 'evolution' }
};

/**
 * 五层架构布局配置
 * 
 * 设计原则：
 * - 智能体节点和数据节点水平分布
 * - 智能体层在最左侧，数据层紧随其后
 * - 层间距合理，便于观察数据流转
 */
const INCREMENTAL_LAYOUT = {
  // 智能体层布局（左侧）
  AGENT_X: 20,              // 智能体层起始X坐标
  AGENT_GAP_Y: 80,          // 智能体垂直间距
  AGENT_WIDTH: 180,         // 智能体节点宽度
  
  // 数据层布局（紧跟智能体层）
  DATA_START_X: 250,        // 数据层起始X坐标（智能体层右侧）
  DATA_GAP_X: 220,          // 数据层水平间距
  DATA_GAP_Y: 75,           // 数据节点垂直间距
  
  // 五层水平布局（用于增量图谱）
  LAYER_START_X: 20,        // 第一层起始X坐标
  LAYER_GAP_X: 180,         // 层间水平间距
  
  // 其他
  START_Y: 50,              // 起始Y坐标
};

/**
 * 获取智能体所在层的X坐标
 */
function getAgentLayerX(layer: string): number {
  const layerXMap: Record<string, number> = {
    'scheduler': INCREMENTAL_LAYOUT.LAYER_START_X - INCREMENTAL_LAYOUT.LAYER_GAP_X,  // 调度层在最左边
    'perception': INCREMENTAL_LAYOUT.LAYER_START_X,
    'cognition': INCREMENTAL_LAYOUT.LAYER_START_X + INCREMENTAL_LAYOUT.LAYER_GAP_X,
    'decision': INCREMENTAL_LAYOUT.LAYER_START_X + INCREMENTAL_LAYOUT.LAYER_GAP_X * 2,
    'action': INCREMENTAL_LAYOUT.LAYER_START_X + INCREMENTAL_LAYOUT.LAYER_GAP_X * 3,
    'evolution': INCREMENTAL_LAYOUT.LAYER_START_X + INCREMENTAL_LAYOUT.LAYER_GAP_X * 4
  };
  return layerXMap[layer] || INCREMENTAL_LAYOUT.LAYER_START_X;
}

/**
 * 生成智能体节点（五层架构布局）
 * 只显示真正的智能体，过滤掉兼容ID
 */
function createAgentNode(agentId: string, index: number, status: string): any {
  // 先转换为标准ID
  const canonicalId = getCanonicalAgentId(agentId);
  
  // 获取显示配置
  const config = getAgentDisplayConfig(canonicalId);
  const layer = config.layer || 'perception';
  const x = getAgentLayerX(layer);
  
  // 每层应该显示的智能体（v2.0新架构）
  // 包含独立调度层（scheduler）
  const layerIndexMap: Record<string, string[]> = {
    'scheduler': ['intent_parser'],
    'perception': ['scout_cluster', 'event_extractor', 'quality_evaluator', 'geo_extractor'],
    'cognition': ['timeline_analyst', 'causal_analyst', 'knowledge_extractor', 'result_validator'],
    'decision': ['scenario_simulator', 'sensitivity_analyst', 'action_advisor'],
    'action': ['report_generator', 'document_executor', 'quality_controller', 'execution_monitor'],
    'evolution': ['knowledge_manager', 'review_analyst']
  };
  
  const layerAgents = layerIndexMap[layer] || [];
  const layerIndex = layerAgents.indexOf(canonicalId);
  
  // 如果不在列表中，不创建节点（过滤兼容ID）
  if (layerIndex < 0) {
    return null;
  }
  
  const y = INCREMENTAL_LAYOUT.START_Y + layerIndex * INCREMENTAL_LAYOUT.AGENT_GAP_Y;
  
  return {
    id: `agent-${canonicalId}`,
    type: 'agent',
    position: { x, y },
    data: {
      label: config.name,
      agentId: canonicalId,
      status,
      layer
    }
  };
}

/**
 * 生成增量图谱更新
 * 根据当前执行的智能体和状态，生成需要添加的节点和边
 */
function generateIncrementalUpdate(
  agentId: string,
  agentIndex: number,
  status: 'running' | 'completed' | 'skipped' | 'error',
  state: Partial<AnalysisStateType>,
  previousNodes: any[],
  previousEdges: any[]
): IncrementalGraphUpdate {
  console.log(`[generateIncrementalUpdate] agentId=${agentId}, status=${status}, state keys:`, Object.keys(state));
  console.log(`[generateIncrementalUpdate] state.timeline length: ${state.timeline?.length}, state.searchResults length: ${state.searchResults?.length}`);
  
  const nodes: any[] = [];
  const edges: any[] = [];
  
  // 1. 添加/更新智能体节点
  const agentNode = createAgentNode(agentId, agentIndex, status);
  if (agentNode) {
    nodes.push(agentNode);
  }
  
  // 2. 如果智能体完成，添加对应的数据节点
  if (status === 'completed') {
    const dataNodes = createDataNodesForAgent(agentId, state, previousNodes);
    nodes.push(...dataNodes.nodes);
    edges.push(...dataNodes.edges);
    
    // 3. 添加智能体到数据节点的连接（使用标准ID）
    if (dataNodes.nodes.length > 0) {
      const canonicalId = getCanonicalAgentId(agentId);
      edges.push({
        id: `e-agent-${canonicalId}-to-data`,
        source: `agent-${canonicalId}`,
        target: dataNodes.nodes[0].id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#a855f7', strokeDasharray: '4,4' }
      });
    }
  }
  
  // 4. 添加智能体间的连接（执行顺序）- 使用标准ID
  const agentSequence = ['coordinator', 'search', 'geo_extractor', 'source_evaluator', 'timeline', 'causal_inference', 'key_factor', 'scenario', 'report'];
  const agentLabels: Record<string, string> = {
    'coordinator-search': '任务分发',
    'search-geo_extractor': '搜索结果',
    'geo_extractor-source_evaluator': '地理信息',
    'source_evaluator-timeline': '评估结果',
    'timeline-causal_inference': '事件分析',
    'causal_inference-key_factor': '因果推理',
    'key_factor-scenario': '因素识别',
    'scenario-report': '场景预测'
  };
  
  if (agentIndex > 0) {
    const prevAgentId = agentSequence[agentIndex - 1];
    const labelKey = `${prevAgentId}-${agentId}`;
    // 转换为标准ID用于边的连接
    const prevCanonicalId = getCanonicalAgentId(prevAgentId);
    const canonicalId = getCanonicalAgentId(agentId);
    edges.push({
      id: `e-agent-${prevCanonicalId}-${canonicalId}`,
      source: `agent-${prevCanonicalId}`,
      target: `agent-${canonicalId}`,
      type: 'smoothstep',
      animated: false,
      label: agentLabels[labelKey] || '',
      labelStyle: { fill: '#64748b', fontWeight: 400, fontSize: 9 },
      labelBgStyle: { fill: '#f1f5f9', fillOpacity: 0.95 },
      labelBgPadding: [3, 2] as [number, number],
      labelBgBorderRadius: 3,
      style: { stroke: '#94a3b8', strokeDasharray: '3,3', strokeWidth: 1 }
    });
  }
  
  // 获取智能体显示名称
  const displayConfig = getAgentDisplayConfig(agentId);
  
  return {
    type: status === 'completed' ? 'agent_complete' : 'agent_start',
    agentId,
    agentStatus: status,
    nodes,
    edges,
    state,
    message: status === 'completed' 
      ? `${displayConfig.name} 完成` 
      : `正在执行 ${displayConfig.name}`
  };
}

/**
 * 根据智能体类型创建对应的数据节点
 */
function createDataNodesForAgent(
  agentId: string, 
  state: Partial<AnalysisStateType>,
  existingNodes: any[]
): { nodes: any[]; edges: any[] } {
  const nodes: any[] = [];
  const edges: any[] = [];
  const { DATA_START_X, DATA_GAP_X, DATA_GAP_Y, START_Y } = INCREMENTAL_LAYOUT;
  
  // 计算当前层的X坐标（使用新架构ID）
  const layerXMap: Record<string, number> = {
    // 调度层
    'intent_parser': DATA_START_X - DATA_GAP_X, // 最左侧
    // 感知体层
    'scout_cluster': DATA_START_X,
    'event_extractor': DATA_START_X,
    'quality_evaluator': DATA_START_X,
    'geo_extractor': DATA_START_X,
    // 认知体层
    'timeline_analyst': DATA_START_X + DATA_GAP_X,
    'causal_analyst': DATA_START_X + DATA_GAP_X * 2,
    'knowledge_extractor': DATA_START_X + DATA_GAP_X * 3,
    'result_validator': DATA_START_X + DATA_GAP_X * 3,
    // 决策体层
    'scenario_simulator': DATA_START_X + DATA_GAP_X * 4,
    'sensitivity_analyst': DATA_START_X + DATA_GAP_X * 4,
    'action_advisor': DATA_START_X + DATA_GAP_X * 4,
    // 行动体层
    'report_generator': DATA_START_X + DATA_GAP_X * 5,
    'document_executor': DATA_START_X + DATA_GAP_X * 5,
    'quality_controller': DATA_START_X + DATA_GAP_X * 5,
    'execution_monitor': DATA_START_X + DATA_GAP_X * 5,
    // 进化体层
    'knowledge_manager': DATA_START_X + DATA_GAP_X * 6,
    'review_analyst': DATA_START_X + DATA_GAP_X * 6,
    
    // 兼容旧ID（内部映射）
    'search': DATA_START_X,
    'timeline': DATA_START_X + DATA_GAP_X,
    'causal_inference': DATA_START_X + DATA_GAP_X * 2,
    'key_factor': DATA_START_X + DATA_GAP_X * 3,
    'scenario': DATA_START_X + DATA_GAP_X * 4,
    'source_evaluator': DATA_START_X
  };
  
  const currentX = layerXMap[agentId] || DATA_START_X;
  
  // 标准化智能体ID（处理兼容映射）
  const canonicalId = getCanonicalAgentId(agentId);
  
  switch (canonicalId) {
    case 'scout_cluster': // 侦察兵集群（原search）
      // 信息源节点 - 使用靛蓝色，与搜索智能体（深蓝）区分
      const searchResults = state.searchResults || [];
      console.log(`[createDataNodesForAgent] scout_cluster agent, state.searchResults length: ${searchResults.length}`);
      if (searchResults.length === 0) {
        console.log('[createDataNodesForAgent] WARNING: searchResults is empty, no source nodes will be created');
      }
      searchResults.slice(0, 10).forEach((item: any, i: number) => {
        nodes.push({
          id: `source-${i}`,
          type: 'source',
          position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
          data: {
            label: item.title?.substring(0, 25) || `信息源 ${i + 1}`,
            title: item.title,
            snippet: item.snippet,
            url: item.url,
            siteName: item.siteName,
            publishTime: item.publishTime,
            credibility: item.authorityLevel || 3
          }
        });
      });
      console.log(`[createDataNodesForAgent] scout_cluster agent created ${nodes.length} source nodes`);
      break;
      
    case 'geo_extractor':
      // 地理位置节点
      const geoLocations = state.geoLocations || [];
      console.log(`[createDataNodesForAgent] geo_extractor agent, state.geoLocations length: ${geoLocations.length}`);
      if (geoLocations.length === 0) {
        console.log('[createDataNodesForAgent] No geo locations extracted');
      }
      geoLocations.slice(0, 10).forEach((location: any, i: number) => {
        nodes.push({
          id: `geo-${i}`,
          type: 'geo',
          position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
          data: {
            label: location.name || `地点 ${i + 1}`,
            name: location.name,
            country: location.country,
            region: location.region,
            latitude: location.latitude,
            longitude: location.longitude,
            significance: location.significance
          }
        });
        
        // 连接到信息源
        const sourceNodes = existingNodes.filter(n => n.id.startsWith('source-'));
        if (sourceNodes.length > 0 && location.sourceIndex !== undefined) {
          edges.push({
            id: `e-source-${location.sourceIndex}-geo-${i}`,
            source: `source-${location.sourceIndex}`,
            target: `geo-${i}`,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#10b981', strokeWidth: 1 }
          });
        }
      });
      break;
      
    case 'timeline_analyst': // 时序分析师（原timeline）
      // 时间线节点
      const timeline = state.timeline || [];
      console.log(`[createDataNodesForAgent] timeline_analyst agent, state.timeline length: ${timeline.length}`);
      if (timeline.length === 0) {
        console.log('[createDataNodesForAgent] WARNING: timeline is empty, no nodes will be created');
      }
      timeline.slice(0, 8).forEach((event: any, i: number) => {
        const weight = event.weight || 0.5;
        nodes.push({
          id: `timeline-${i}`,
          type: 'timeline',
          position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
          data: {
            label: event.event?.substring(0, 20) || `事件${i + 1}`,
            timestamp: event.timestamp?.substring(0, 10),
            event: event.event,
            description: event.description,
            weight
          }
        });
        
        // 连接到信息源（使用权重控制样式）
        const sourceNodes = existingNodes.filter(n => n.id.startsWith('source-'));
        if (sourceNodes.length > 0) {
          const sourceIdx = i % sourceNodes.length;
          // 使用权重控制边的样式，不再判断阈值
          edges.push(createWeightedEdge(
            `e-source-${sourceIdx}-timeline-${i}`,
            `source-${sourceIdx}`,
            `timeline-${i}`,
            weight,
            '事件'
          ));
        }
      });
      break;
      
    case 'causal_analyst': // 因果分析师（原causal_inference）
      // 因果链节点
      const causalChain = state.causalChain || [];
      causalChain.slice(0, 6).forEach((chain: any, i: number) => {
        const strength = chain.strength || 0.5;
        nodes.push({
          id: `causal-${i}`,
          type: 'causal',
          position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
          data: {
            label: chain.factor?.substring(0, 15) || `因果${i + 1}`,
            cause: chain.factor,
            effect: chain.description,
            strength
          }
        });
        
        // 连接到时间线（使用权重控制样式）
        const timelineNodes = existingNodes.filter(n => n.id.startsWith('timeline-'));
        if (timelineNodes.length > 0) {
          edges.push(createWeightedEdge(
            `e-timeline-${i % timelineNodes.length}-causal-${i}`,
            `timeline-${i % timelineNodes.length}`,
            `causal-${i}`,
            strength,
            '因果'
          ));
        }
      });
      break;
      
    case 'knowledge_extractor': // 知识抽取器（原key_factor）
      // 关键因素节点
      const keyFactors = state.keyFactors || [];
      keyFactors.slice(0, 6).forEach((factor: any, i: number) => {
        const weight = factor.weight || 0.5;
        nodes.push({
          id: `factor-${i}`,
          type: 'factor',
          position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
          data: {
            label: factor.factor?.substring(0, 15) || `因素${i + 1}`,
            factor: factor.factor,
            description: factor.description,
            weight
          }
        });
        
        // 连接到因果链（使用权重控制样式）
        const causalNodes = existingNodes.filter(n => n.id.startsWith('causal-'));
        if (causalNodes.length > 0) {
          edges.push(createWeightedEdge(
            `e-causal-${i % causalNodes.length}-factor-${i}`,
            `causal-${i % causalNodes.length}`,
            `factor-${i}`,
            weight,
            '因素'
          ));
        }
      });
      break;
      
    case 'scenario_simulator': // 场景推演器（原scenario）
      // 场景推演节点
      const scenarios = state.scenarios || [];
      scenarios.slice(0, 4).forEach((scenario: any, i: number) => {
        const probability = scenario.probability || 0.33;
        nodes.push({
          id: `scenario-${i}`,
          type: 'scenario',
          position: { x: currentX, y: START_Y + i * (DATA_GAP_Y + 15) },
          data: {
            label: scenario.name || `场景${i + 1}`,
            probability,
            description: scenario.description
          }
        });
        
        // 连接到关键因素（使用概率控制样式）
        const factorNodes = existingNodes.filter(n => n.id.startsWith('factor-'));
        if (factorNodes.length > 0) {
          edges.push(createWeightedEdge(
            `e-factor-${i % factorNodes.length}-scenario-${i}`,
            `factor-${i % factorNodes.length}`,
            `scenario-${i}`,
            probability,
            '场景'
          ));
        }
      });
      break;
  }
  
  return { nodes, edges };
}

/**
 * 计算信息源与查询的相关性分数
 */
function calculateRelevanceScore(item: any, query: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const title = (item.title || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();
  const content = (item.content || '').toLowerCase();
  
  let score = 0;
  
  // 标题匹配（权重最高）
  queryTerms.forEach(term => {
    if (title.includes(term)) score += 0.3;
  });
  
  // 摘要匹配
  queryTerms.forEach(term => {
    if (snippet.includes(term)) score += 0.15;
  });
  
  // 内容匹配
  queryTerms.forEach(term => {
    const count = (content.match(new RegExp(term, 'g')) || []).length;
    score += Math.min(count * 0.05, 0.2);
  });
  
  // 时间新鲜度
  if (item.publish_time) {
    const publishDate = new Date(item.publish_time);
    const daysSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePublish < 7) score += 0.2;
    else if (daysSincePublish < 30) score += 0.1;
  }
  
  return Math.min(score, 1);
}

/**
 * 筛选高质量信息源
 * 综合考虑：权威度(40%) + 相关性(40%) + 时效性(20%)
 */
function filterHighQualitySources(
  items: Array<SearchItem & { relevanceScore: number }>,
  targetCount: number
): SearchItem[] {
  // 计算综合评分
  const scoredItems = items.map(item => {
    const authorityScore = (item.authorityLevel || 3) / 5; // 归一化到 0-1
    const relevanceScore = item.relevanceScore;
    
    // 时效性评分
    let timelinessScore = 0.5;
    if (item.publishTime) {
      const publishDate = new Date(item.publishTime);
      const daysSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublish < 3) timelinessScore = 1;
      else if (daysSincePublish < 7) timelinessScore = 0.8;
      else if (daysSincePublish < 14) timelinessScore = 0.6;
      else if (daysSincePublish < 30) timelinessScore = 0.4;
      else timelinessScore = 0.2;
    }
    
    // 综合评分：权威度40% + 相关性40% + 时效性20%
    const totalScore = authorityScore * 0.4 + relevanceScore * 0.4 + timelinessScore * 0.2;
    
    return {
      ...item,
      totalScore
    };
  });
  
  // 按综合评分排序
  scoredItems.sort((a, b) => b.totalScore - a.totalScore);
  
  // 确保信息源多样性（避免同一来源过多）
  const selectedItems: Array<SearchItem & { totalScore: number }> = [];
  const domainCount: Record<string, number> = {};
  const maxPerDomain = 3;
  
  for (const item of scoredItems) {
    const domain = new URL(item.url || '').hostname || 'unknown';
    const currentCount = domainCount[domain] || 0;
    
    if (currentCount < maxPerDomain) {
      selectedItems.push(item);
      domainCount[domain] = currentCount + 1;
    }
    
    if (selectedItems.length >= targetCount) break;
  }
  
  // 如果不够，放宽域名限制
  if (selectedItems.length < targetCount) {
    for (const item of scoredItems) {
      if (!selectedItems.includes(item)) {
        selectedItems.push(item);
        if (selectedItems.length >= targetCount) break;
      }
    }
  }
  
  // 移除内部评分字段，返回标准格式
  return selectedItems.map(({ totalScore, ...rest }) => rest);
}

/**
 * 创建分析工作流图（完整五层混合架构）
 * 
 * 架构设计：
 * - 调度层：intent_parser - 意图解析、复杂度判断、跳过决策
 * - 感知体层：scout_cluster → event_extractor → quality_evaluator → geo_extractor
 * - 认知体层：timeline_analyst → causal_analyst → knowledge_extractor → result_validator
 * - 决策体层：scenario_simulator → sensitivity_analyst → action_advisor
 * - 行动体层：report_generator → document_executor → quality_controller → execution_monitor
 * - 进化体层：knowledge_manager → review_analyst
 */
export function createAnalysisGraph() {
  const workflow = new StateGraph(AnalysisState)
    // ========== 调度层 ==========
    .addNode('intent_parser', async (state: AnalysisStateType) => coordinatorNode(state, createLLMClient()))

    /** 意图解析之后：合并 IntelligentScheduler 与协调器编排 */
    .addNode('scheduler_merge', async (state: AnalysisStateType) => {
      if (process.env.USE_INTELLIGENT_SCHEDULER === 'false') {
        return {};
      }
      try {
        const llm = createLLMClient(getAnalysisForwardHeaders());
        const scheduler = new IntelligentScheduler({
          llmClient: llm,
          maxParallelism: 5,
          enableDynamicScheduling: true,
          enableEarlyTermination: false,
        });
        const decision = await scheduler.analyzeTaskRequirements(state.query, state);
        const merged = mergeSchedulingIntoAgentSchedule(state.agentSchedule, decision);
        return { agentSchedule: merged };
      } catch (e) {
        console.warn('[AnalysisGraph] scheduler_merge failed:', e);
        return {};
      }
    })

    // ========== 感知体层 ==========
    .addNode('scout_cluster', async (state: AnalysisStateType) => {
      const query = state.query || '';
      const customHeaders = getAnalysisForwardHeaders();
      let rawItems: Array<SearchItem & { relevanceScore: number }> = [];
      let searchResults = { summary: '', items: [] as SearchItem[] };
      try {
        const searchResponse = await advancedWebSearch(
          query,
          {
            count: 20,
            needSummary: true,
            needContent: true,
            timeRange: '1m',
          },
          customHeaders
        );
        rawItems = (searchResponse.web_items || []).map((item) => ({
          title: item.title || '',
          url: item.url || '',
          snippet: item.snippet || '',
          content: item.content || '',
          siteName: item.site_name || '',
          publishTime: item.publish_time || '',
          authorityLevel: item.auth_info_level || 0,
          authorityDesc: item.auth_info_des || '',
          relevanceScore: calculateRelevanceScore(item, query),
        })) as (SearchItem & { relevanceScore: number })[];
        const filteredItems = filterHighQualitySources(rawItems, 10);
        searchResults = {
          summary: searchResponse.summary || '',
          items: filteredItems,
        };
      } catch (searchError) {
        console.error('[AnalysisGraph] scout_cluster search error:', searchError);
      }
      return { ...(await searchNode(state, searchResults)) };
    })
    .addNode('event_extractor', async (state: AnalysisStateType) => eventExtractorNode(state, createLLMClient()))
    .addNode('quality_evaluator', async (state: AnalysisStateType) => sourceEvaluatorNode(state, createLLMClient()))
    .addNode('geo_extractor', async (state: AnalysisStateType) => geoExtractorNode(state, createLLMClient()))
    
    // ========== 认知体层 ==========
    .addNode('timeline_analyst', async (state: AnalysisStateType) => timelineNode(state, createLLMClient()))
    .addNode('causal_analyst', async (state: AnalysisStateType) => causalInferenceNode(state, createLLMClient()))
    .addNode('knowledge_extractor', async (state: AnalysisStateType) => keyFactorNode(state, createLLMClient()))
    .addNode('result_validator', async (state: AnalysisStateType) => resultValidatorNode(state, createLLMClient()))
    
    // ========== 决策体层 ==========
    .addNode('scenario_simulator', async (state: AnalysisStateType) => scenarioNode(state, createLLMClient()))
    .addNode('sensitivity_analyst', async (state: AnalysisStateType) => sensitivityAnalysisNode(state, createLLMClient()))
    .addNode('action_advisor', async (state: AnalysisStateType) => actionAdvisorNode(state, createLLMClient()))
    
    // ========== 行动体层 ==========
    .addNode('report_generator', async (state: AnalysisStateType) => reportNode(state, createLLMClient()))
    .addNode('document_executor', async (state: AnalysisStateType) => documentExecutorNode(state, createLLMClient()))
    .addNode('quality_controller', async (state: AnalysisStateType) => qualityCheckNode(state, createLLMClient()))
    .addNode('execution_monitor', async (state: AnalysisStateType) => executionMonitorNode(state, createLLMClient()))
    
    // ========== 进化体层 ==========
    .addNode('knowledge_manager', async (state: AnalysisStateType) => knowledgeManagerNode(state, createLLMClient()))
    .addNode('review_analyst', async (state: AnalysisStateType) => reviewAnalystNode(state, createLLMClient()))
    
    // ========== 问答与修正节点 ==========
    .addNode('chat', async (state: AnalysisStateType) => state)
    
    // ========== 跳过节点（占位） ==========
    .addNode('skip_event_extractor', async (state: AnalysisStateType) => state)
    .addNode('skip_quality_evaluator', async (state: AnalysisStateType) => state)
    .addNode('skip_geo_extractor', async (state: AnalysisStateType) => state)
    .addNode('skip_timeline_analyst', async (state: AnalysisStateType) => state)
    .addNode('skip_causal_analyst', async (state: AnalysisStateType) => state)
    .addNode('skip_knowledge_extractor', async (state: AnalysisStateType) => state)
    .addNode('skip_scenario_simulator', async (state: AnalysisStateType) => state);
  
  // ========== 边连接 ==========
  // 入口 → 调度层
  workflow.addEdge(START, 'intent_parser');

  workflow.addEdge('intent_parser', 'scheduler_merge');
  workflow.addEdge('scheduler_merge', 'scout_cluster');
  
  // 感知体层：scout_cluster → event_extractor
  workflow.addConditionalEdges(
    'scout_cluster',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行事件抽取
      if (!isAgentRequired(state.agentSchedule, 'event_extractor')) return 'skip_event_extractor';
      return 'event_extractor';
    },
    {
      'skip_event_extractor': 'skip_event_extractor',
      'event_extractor': 'event_extractor',
    }
  );
  
  // 感知体层：event_extractor → quality_evaluator（条件执行）
  workflow.addConditionalEdges(
    'event_extractor',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行质量评估
      if (!isAgentRequired(state.agentSchedule, 'quality_evaluator')) return 'skip_quality_evaluator';
      return 'quality_evaluator';
    },
    {
      'skip_quality_evaluator': 'skip_quality_evaluator',
      'quality_evaluator': 'quality_evaluator',
    }
  );
  
  workflow.addEdge('skip_event_extractor', 'quality_evaluator');
  
  // 感知体层：quality_evaluator → geo_extractor
  workflow.addConditionalEdges(
    'quality_evaluator',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行地理抽取
      if (!isAgentRequired(state.agentSchedule, 'geo_extractor')) return 'skip_geo_extractor';
      return 'geo_extractor';
    },
    {
      'skip_geo_extractor': 'skip_geo_extractor',
      'geo_extractor': 'geo_extractor',
    }
  );
  
  workflow.addEdge('skip_quality_evaluator', 'geo_extractor');
  
  // 感知体层 → 认知体层：geo_extractor → timeline_analyst（条件执行）
  workflow.addConditionalEdges(
    'geo_extractor',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行时间线分析
      if (!isAgentRequired(state.agentSchedule, 'timeline_analyst')) return 'skip_timeline_analyst';
      return 'timeline_analyst';
    },
    {
      'skip_timeline_analyst': 'skip_timeline_analyst',
      'timeline_analyst': 'timeline_analyst',
    }
  );
  
  workflow.addConditionalEdges(
    'skip_geo_extractor',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行时间线分析
      if (!isAgentRequired(state.agentSchedule, 'timeline_analyst')) return 'skip_timeline_analyst';
      return 'timeline_analyst';
    },
    {
      'skip_timeline_analyst': 'skip_timeline_analyst',
      'timeline_analyst': 'timeline_analyst',
    }
  );
  
  // 认知体层：timeline_analyst → causal_analyst（条件执行）
  workflow.addConditionalEdges(
    'timeline_analyst',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行因果推理
      if (!isAgentRequired(state.agentSchedule, 'causal_analyst')) return 'skip_causal_analyst';
      return 'causal_analyst';
    },
    {
      'skip_causal_analyst': 'skip_causal_analyst',
      'causal_analyst': 'causal_analyst',
    }
  );
  
  workflow.addConditionalEdges(
    'skip_timeline_analyst',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行因果推理
      if (!isAgentRequired(state.agentSchedule, 'causal_analyst')) return 'skip_causal_analyst';
      return 'causal_analyst';
    },
    {
      'skip_causal_analyst': 'skip_causal_analyst',
      'causal_analyst': 'causal_analyst',
    }
  );
  
  // 认知体层：causal_analyst → knowledge_extractor（条件执行）
  workflow.addConditionalEdges(
    'causal_analyst',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行关键因素抽取
      if (!isAgentRequired(state.agentSchedule, 'knowledge_extractor')) return 'skip_knowledge_extractor';
      return 'knowledge_extractor';
    },
    {
      'skip_knowledge_extractor': 'skip_knowledge_extractor',
      'knowledge_extractor': 'knowledge_extractor',
    }
  );
  
  workflow.addConditionalEdges(
    'skip_causal_analyst',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行关键因素抽取
      if (!isAgentRequired(state.agentSchedule, 'knowledge_extractor')) return 'skip_knowledge_extractor';
      return 'knowledge_extractor';
    },
    {
      'skip_knowledge_extractor': 'skip_knowledge_extractor',
      'knowledge_extractor': 'knowledge_extractor',
    }
  );
  
  // 认知体层：knowledge_extractor → result_validator
  workflow.addEdge('knowledge_extractor', 'result_validator');
  workflow.addEdge('skip_knowledge_extractor', 'result_validator');
  
  // 认知体层 → 决策体层：result_validator → scenario_simulator（条件执行）
  workflow.addConditionalEdges(
    'result_validator',
    (state: AnalysisStateType) => {
      // 根据编排结果决定是否执行场景推演
      if (!isAgentRequired(state.agentSchedule, 'scenario_simulator')) return 'skip_scenario_simulator';
      return 'scenario_simulator';
    },
    {
      'skip_scenario_simulator': 'skip_scenario_simulator',
      'scenario_simulator': 'scenario_simulator',
    }
  );
  
  // 决策体层：scenario_simulator → sensitivity_analyst
  workflow.addEdge('scenario_simulator', 'sensitivity_analyst');
  
  // 决策体层：sensitivity_analyst → action_advisor
  workflow.addEdge('sensitivity_analyst', 'action_advisor');
  workflow.addEdge('skip_scenario_simulator', 'action_advisor');
  
  // 决策体层 → 行动体层
  workflow.addEdge('action_advisor', 'report_generator');
  
  // 行动体层：report_generator → document_executor
  workflow.addEdge('report_generator', 'document_executor');
  
  // 行动体层：document_executor → quality_controller
  workflow.addEdge('document_executor', 'quality_controller');
  
  // 行动体层：quality_controller → execution_monitor
  workflow.addEdge('quality_controller', 'execution_monitor');
  
  // 行动体层 → 进化体层
  workflow.addEdge('execution_monitor', 'knowledge_manager');
  
  // 进化体层：knowledge_manager → review_analyst
  workflow.addEdge('knowledge_manager', 'review_analyst');
  
  // 进化体层 → 结束
  workflow.addEdge('review_analyst', END);
  
  // ========== 循环修正路由 ==========
  // 如果质量检查发现问题，可以返回修正
  workflow.addConditionalEdges(
    'quality_controller',
    (state: AnalysisStateType) => {
      // 如果有用户反馈等待处理，进入 chat 节点
      if (state.userFeedback) {
        return 'chat';
      }
      
      // 如果不需要修正或已达最大循环次数，继续执行
      if (!state.needsRevision || state.iterationCount >= state.maxIterations) {
        return 'execution_monitor';
      }
      
      // 根据 revisionTarget 返回到相应节点
      const target = state.revisionTarget;
      switch (target) {
        case 'search':
        case 'scout_cluster':
          return 'scout_cluster';
        case 'timeline':
        case 'timeline_analyst':
          return 'timeline_analyst';
        case 'causal_inference':
        case 'causal_analyst':
          return 'causal_analyst';
        case 'scenario':
        case 'scenario_simulator':
          return 'scenario_simulator';
        case 'key_factor':
        case 'knowledge_extractor':
          return 'knowledge_extractor';
        default:
          return 'execution_monitor';
      }
    },
    {
      'execution_monitor': 'execution_monitor',
      'chat': 'chat',
      'scout_cluster': 'scout_cluster',
      'timeline_analyst': 'timeline_analyst',
      'causal_analyst': 'causal_analyst',
      'scenario_simulator': 'scenario_simulator',
      'knowledge_extractor': 'knowledge_extractor',
    }
  );
  
  // Chat 反馈循环
  workflow.addConditionalEdges(
    'chat',
    (state: AnalysisStateType) => {
      if (state.needsReanalysis) {
        return 'scout_cluster';  // 重新执行分析
      }
      return END;
    },
    {
      'scout_cluster': 'scout_cluster',
      '__end__': END,
    }
  );
  
  return workflow.compile();
}

let compiledAnalysisSingleton: ReturnType<typeof createAnalysisGraph> | null = null;

export function getCompiledAnalysisGraph() {
  if (!compiledAnalysisSingleton) {
    compiledAnalysisSingleton = createAnalysisGraph();
  }
  return compiledAnalysisSingleton;
}

/**
 * 使用 compile 后的 LangGraph 单次 invoke（默认路径）。
 * 设置 USE_LEGACY_ANALYSIS_LOOP=true 可回退到手写循环。
 */
async function executeAnalysisCompiled(
  query: string,
  customHeaders: Record<string, string>,
  callbacks: GraphCallbacks
) {
  setAnalysisForwardHeaders(customHeaders);
  try {
    callbacks.onSystem?.('📊 使用 compile 分析图执行工作流…');
    const app = getCompiledAnalysisGraph();
    const initial: Partial<AnalysisStateType> = {
      query,
      messages: [],
      searchResults: [],
      searchSummary: '',
      timeline: [],
      causalChain: [],
      keyFactors: [],
      scenarios: [],
      completedAgents: [],
      iterationCount: 0,
      maxIterations: 3,
      qualityIssues: [],
      revisionHistory: [],
      needsRevision: false,
      revisionTarget: '',
      revisionReason: '',
    };
    const finalState = (await app.invoke(initial as AnalysisStateType, {
      recursionLimit: 100,
    })) as Partial<AnalysisStateType>;

    if (finalState.agentSchedule) {
      callbacks.onAgentSchedule?.(finalState.agentSchedule);
    }

    const eventGraph = generateEventGraph(finalState);
    callbacks.onEventGraph?.(eventGraph);

    const finalReport = generateFinalReport(finalState);

    const avgScenarioProb =
      (finalState.scenarios || []).length > 0
        ? (finalState.scenarios || []).reduce(
            (sum: number, s: any) => sum + (s.probability || 0.33),
            0
          ) / (finalState.scenarios || []).length
        : 0.5;
    const searchCount = (finalState.searchResults || []).length;
    const sourceBonus = Math.min(searchCount * 0.02, 0.1);
    const confidence = Math.min(
      0.95,
      avgScenarioProb * 0.5 + 0.4 + sourceBonus
    );

    return {
      searchResults: finalState.searchResults || [],
      timeline: finalState.timeline || [],
      causalChain: finalState.causalChain || [],
      keyFactors: finalState.keyFactors || [],
      scenarios: finalState.scenarios || [],
      eventGraph,
      knowledgeGraph: finalState.knowledgeGraph || null,
      finalReport,
      taskComplexity: finalState.taskComplexity || 'moderate',
      agentSchedule: finalState.agentSchedule || null,
      skippedAgents: [] as string[],
      iterationCount: finalState.iterationCount || 0,
      revisionHistory: finalState.revisionHistory || [],
      confidence,
    };
  } finally {
    clearAnalysisForwardHeaders();
  }
}

/**
 * 执行分析工作流（带回调、条件跳过和循环修正）
 */
export async function executeAnalysis(
  query: string,
  customHeaders: Record<string, string>,
  callbacks: GraphCallbacks
): Promise<{
  searchResults: any[];
  timeline: any[];
  causalChain: any[];
  keyFactors: any[];
  scenarios: any[];
  eventGraph: any;
  knowledgeGraph: {
    entities: Array<{ id: string; name: string; type: string; importance: number; description?: string; verified?: boolean }>;
    relations: Array<{ id: string; source_entity_id: string; target_entity_id: string; source_name?: string; target_name?: string; type: string; confidence: number; evidence?: string; verified?: boolean }>;
  } | null;
  finalReport: string;
  taskComplexity: TaskComplexity;
  agentSchedule: AgentSchedule | null;
  skippedAgents: string[];
  iterationCount: number;
  revisionHistory: any[];
  confidence: number;
}> {
  if (process.env.USE_LEGACY_ANALYSIS_LOOP !== 'true') {
    return executeAnalysisCompiled(query, customHeaders, callbacks);
  }

  const llmClient = createLLMClient(customHeaders);

  let state: Partial<AnalysisStateType> = {
    query,
    messages: [],
    searchResults: [],
    timeline: [],
    causalChain: [],
    keyFactors: [],
    scenarios: [],
    completedAgents: [],
    // 循环相关初始化
    iterationCount: 0,
    maxIterations: 3,
    qualityIssues: [],
    revisionHistory: [],
    needsRevision: false,
    revisionTarget: '',
    revisionReason: '',
  };
  
  const skippedAgents: string[] = [];
  const errors: AgentError[] = [];
  
  // 增量图谱追踪
  const accumulatedNodes: any[] = [];
  const accumulatedEdges: any[] = [];
  
  // 智能体执行顺序索引（使用新架构ID映射）
  // 新架构: scheduler -> perception -> cognition -> decision -> action
  const agentSequence = [
    'intent_parser',      // 调度层: 意图解析器
    'scout_cluster',      // 感知体: 侦察兵集群
    'event_extractor',    // 感知体: 事件抽取器
    'quality_evaluator',  // 感知体: 质量评估器
    'geo_extractor',      // 感知体: 地理抽取器
    'timeline_analyst',   // 认知体: 时序分析师
    'causal_analyst',     // 认知体: 因果分析师
    'knowledge_extractor',// 认知体: 知识抽取器
    'result_validator',   // 认知体: 结果验证器
    'scenario_simulator', // 决策体: 场景推演器
    'sensitivity_analyst',// 决策体: 敏感性分析师
    'action_advisor',     // 决策体: 行动建议器
    'report_generator',   // 行动体: 报告生成器
    'document_executor',  // 行动体: 文档执行器
    'quality_controller', // 行动体: 质量控制器
    'execution_monitor'   // 进化体: 执行监控器
  ];
  
  try {
    // ========== Step 1: 意图解析器（协调器）==========
    // 发送意图解析器开始增量更新（图谱状态）
    callbacks.onIncrementalGraph?.({
      type: 'agent_start',
      agentId: 'intent_parser',
      agentStatus: 'running',
      nodes: [createAgentNode('intent_parser', 0, 'running')],
      edges: [],
      message: '正在执行意图解析器...'
    });
    
    // 执行意图解析器（safeExecuteNode会自动调用onAgentStart/onAgentThinking/onAgentComplete）
    const coordResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'intent_parser',
        agentName: '意图解析器',
        nodeFn: coordinatorNode
      },
      callbacks,
      errors
    );
    state = coordResult.state;
    
    // 发送意图解析器完成增量更新
    const coordUpdate = generateIncrementalUpdate('intent_parser', 0, 'completed', state, accumulatedNodes, accumulatedEdges);
    accumulatedNodes.push(...coordUpdate.nodes!);
    accumulatedEdges.push(...coordUpdate.edges!);
    callbacks.onIncrementalGraph?.(coordUpdate);
    
    // 发送智能体编排结果
    if (state.agentSchedule) {
      callbacks.onAgentSchedule?.(state.agentSchedule);
      callbacks.onSystem?.(`📋 编排决策: 需要执行 ${state.agentSchedule.requiredAgents.length} 个智能体`);
      callbacks.onSystem?.(`   核心目标: ${state.agentSchedule.coreObjective}`);
    }
    
    // ========== Step 2: 搜索（侦察兵集群）==========
    callbacks.onSystem?.('🔍 正在进行实时信息检索...');
    
    // 发送侦察兵集群开始增量更新（图谱状态）
    callbacks.onIncrementalGraph?.({
      type: 'agent_start',
      agentId: 'scout_cluster',
      agentStatus: 'running',
      nodes: [createAgentNode('scout_cluster', 1, 'running')],
      edges: [{
        id: 'e-agent-intent_parser-scout_cluster',
        source: 'agent-intent_parser',
        target: 'agent-scout_cluster',
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeDasharray: '3,3' }
      }],
      message: '正在执行侦察兵集群...'
    });
    
    // 手动调用onAgentStart/onAgentThinking，因为侦察兵集群不使用safeExecuteNode
    callbacks.onAgentStart?.('scout_cluster', '侦察兵集群');
    callbacks.onAgentThinking?.('scout_cluster', '正在处理多源信息采集...');
    
    let searchResponse;
    let rawItems: any[] = [];
    let searchResults = { summary: '', items: [] as SearchItem[] };
    
    try {
      searchResponse = await advancedWebSearch(
        query,
        {
          count: 20, // 增加到20条
          needSummary: true,
          needContent: true,
          timeRange: '1m',
        },
        customHeaders
      );
      
      // 原始搜索结果
      rawItems = (searchResponse.web_items || []).map(item => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.snippet || '',
        content: item.content || '',
        siteName: item.site_name || '',
        publishTime: item.publish_time || '',
        authorityLevel: item.auth_info_level || 0,
        authorityDesc: item.auth_info_des || '',
        // 计算相关性分数
        relevanceScore: calculateRelevanceScore(item, query),
      })) as (SearchItem & { relevanceScore: number })[];
      
      // 筛选高质量信息源（权威度+相关性综合评分）
      const filteredItems = filterHighQualitySources(rawItems, 10);
      
      searchResults = {
        summary: searchResponse.summary || '',
        items: filteredItems,
      };
      
      callbacks.onSystem?.(`✅ 已获取 ${rawItems.length} 条信息，筛选出 ${filteredItems.length} 条高质量信息源`);
    } catch (searchError: any) {
      // 搜索失败时提供更友好的错误信息
      const errorMessage = searchError?.message || 
                           (searchError?.response ? JSON.stringify(searchError.response).substring(0, 200) : '搜索服务暂时不可用');
      console.error('[LangGraph] Search API error:', searchError);
      callbacks.onSystem?.(`⚠️ 搜索服务暂时不可用，将使用基础分析模式`);
      // 继续执行，但使用空搜索结果
    }
    
    // 执行侦察兵集群节点
    state = { ...state, ...await searchNode(state as AnalysisStateType, searchResults) };
    callbacks.onAgentComplete?.('scout_cluster', state.searchOutput?.substring(0, 200) || '');
    
    // 发送侦察兵集群完成增量更新（包含信息源节点）
    const searchUpdate = generateIncrementalUpdate('scout_cluster', 1, 'completed', state, accumulatedNodes, accumulatedEdges);
    accumulatedNodes.push(...searchUpdate.nodes!);
    accumulatedEdges.push(...searchUpdate.edges!);
    callbacks.onIncrementalGraph?.(searchUpdate);
    
    // ========== Step 3: 事件抽取器（核心节点）==========
    // 根据编排结果决定是否执行事件抽取
    const shouldExtractEvents = isAgentRequired(state.agentSchedule, 'event_extractor');
    
    if (shouldExtractEvents) {
      const eventResult = await safeExecuteNode(
        state,
        llmClient,
        {
          agentId: 'event_extractor',
          agentName: '事件抽取器',
          nodeFn: eventExtractorNode,
          skipCondition: false,
          skipReason: ''
        },
        callbacks,
        errors
      );
      state = eventResult.state;
      if (!eventResult.skipped) {
        const eventUpdate = generateIncrementalUpdate('event_extractor', 2, 'completed', state, accumulatedNodes, accumulatedEdges);
        accumulatedNodes.push(...eventUpdate.nodes!);
        accumulatedEdges.push(...eventUpdate.edges!);
        callbacks.onIncrementalGraph?.(eventUpdate);
      }
    } else {
      skippedAgents.push('event_extractor');
      callbacks.onAgentSkip?.('event_extractor', '事件抽取器', '编排结果：不需要事件抽取');
      callbacks.onIncrementalGraph?.({
        type: 'agent_complete',
        agentId: 'event_extractor',
        agentStatus: 'skipped',
        nodes: [createAgentNode('event_extractor', 2, 'skipped')],
        message: '事件抽取器已跳过'
      });
    }
    
    // ========== Step 3.5: 地理信息抽取（条件执行）==========
    // 根据编排结果决定是否需要地理信息抽取
    const shouldExtractGeo = isAgentRequired(state.agentSchedule, 'geo_extractor');
    
    if (shouldExtractGeo) {
      const geoResult = await safeExecuteNode(
        state,
        llmClient,
        {
          agentId: 'geo_extractor',
          agentName: '地理抽取器',
          nodeFn: geoExtractorNode,
          skipCondition: false,
          skipReason: ''
        },
        callbacks,
        errors
      );
      state = geoResult.state;
      if (!geoResult.skipped) {
        const geoUpdate = generateIncrementalUpdate('geo_extractor', 3, 'completed', state, accumulatedNodes, accumulatedEdges);
        accumulatedNodes.push(...geoUpdate.nodes!);
        accumulatedEdges.push(...geoUpdate.edges!);
        callbacks.onIncrementalGraph?.(geoUpdate);
      }
    } else {
      skippedAgents.push('geo_extractor');
      callbacks.onAgentSkip?.('geo_extractor', '地理抽取器', '主题不涉及地理位置信息');
    }
    
    // ========== Step 4: 质量评估器（条件执行）==========
    const sourceResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'quality_evaluator',
        agentName: '质量评估器',
        nodeFn: sourceEvaluatorNode,
        skipCondition: !isAgentRequired(state.agentSchedule, 'quality_evaluator'),
        skipReason: '编排结果：不需要质量评估'
      },
      callbacks,
      errors
    );
    state = sourceResult.state;
    if (sourceResult.skipped) {
      skippedAgents.push('quality_evaluator');
      callbacks.onIncrementalGraph?.({
        type: 'agent_complete',
        agentId: 'quality_evaluator',
        agentStatus: 'skipped',
        nodes: [createAgentNode('quality_evaluator', 4, 'skipped')],
        message: '质量评估器已跳过'
      });
    } else {
      const sourceUpdate = generateIncrementalUpdate('quality_evaluator', 4, 'completed', state, accumulatedNodes, accumulatedEdges);
      accumulatedNodes.push(...sourceUpdate.nodes!);
      accumulatedEdges.push(...sourceUpdate.edges!);
      callbacks.onIncrementalGraph?.(sourceUpdate);
    }
    
    // ========== Step 5: 时序分析师（条件执行）==========
    const timelineResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'timeline_analyst',
        agentName: '时序分析师',
        nodeFn: timelineNode,
        skipCondition: !isAgentRequired(state.agentSchedule, 'timeline_analyst'),
        skipReason: '编排结果：不需要时间线分析'
      },
      callbacks,
      errors
    );
    state = timelineResult.state;
    if (timelineResult.skipped) {
      skippedAgents.push('timeline_analyst');
      callbacks.onIncrementalGraph?.({
        type: 'agent_complete',
        agentId: 'timeline_analyst',
        agentStatus: 'skipped',
        nodes: [createAgentNode('timeline_analyst', 5, 'skipped')],
        message: '时序分析师已跳过'
      });
    } else {
      const timelineUpdate = generateIncrementalUpdate('timeline_analyst', 5, 'completed', state, accumulatedNodes, accumulatedEdges);
      accumulatedNodes.push(...timelineUpdate.nodes!);
      accumulatedEdges.push(...timelineUpdate.edges!);
      callbacks.onIncrementalGraph?.(timelineUpdate);
    }
    
    // ========== Step 6: 因果分析师（条件执行）==========
    const causalResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'causal_analyst',
        agentName: '因果分析师',
        nodeFn: causalInferenceNode,
        skipCondition: !isAgentRequired(state.agentSchedule, 'causal_analyst'),
        skipReason: '编排结果：不需要因果推理'
      },
      callbacks,
      errors
    );
    state = causalResult.state;
    if (causalResult.skipped) {
      skippedAgents.push('causal_analyst');
      callbacks.onIncrementalGraph?.({
        type: 'agent_complete',
        agentId: 'causal_analyst',
        agentStatus: 'skipped',
        nodes: [createAgentNode('causal_analyst', 6, 'skipped')],
        message: '因果分析师已跳过'
      });
    } else {
      const causalUpdate = generateIncrementalUpdate('causal_analyst', 6, 'completed', state, accumulatedNodes, accumulatedEdges);
      accumulatedNodes.push(...causalUpdate.nodes!);
      accumulatedEdges.push(...causalUpdate.edges!);
      callbacks.onIncrementalGraph?.(causalUpdate);
    }
    
    // ========== Step 7: 场景推演器（条件执行）==========
    const scenarioResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'scenario_simulator',
        agentName: '场景推演器',
        nodeFn: scenarioNode,
        skipCondition: !isAgentRequired(state.agentSchedule, 'scenario_simulator'),
        skipReason: '编排结果：不需要场景推演'
      },
      callbacks,
      errors
    );
    state = scenarioResult.state;
    if (scenarioResult.skipped) {
      skippedAgents.push('scenario_simulator');
      callbacks.onIncrementalGraph?.({
        type: 'agent_complete',
        agentId: 'scenario_simulator',
        agentStatus: 'skipped',
        nodes: [createAgentNode('scenario_simulator', 7, 'skipped')],
        message: '场景推演器已跳过'
      });
    } else {
      const scenarioUpdate = generateIncrementalUpdate('scenario_simulator', 7, 'completed', state, accumulatedNodes, accumulatedEdges);
      accumulatedNodes.push(...scenarioUpdate.nodes!);
      accumulatedEdges.push(...scenarioUpdate.edges!);
      callbacks.onIncrementalGraph?.(scenarioUpdate);
    }
    
    // ========== Step 8: 知识抽取器（条件执行）==========
    const factorResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'knowledge_extractor',
        agentName: '知识抽取器',
        nodeFn: keyFactorNode,
        skipCondition: !isAgentRequired(state.agentSchedule, 'knowledge_extractor'),
        skipReason: '编排结果：不需要关键因素分析'
      },
      callbacks,
      errors
    );
    state = factorResult.state;
    if (factorResult.skipped) {
      skippedAgents.push('knowledge_extractor');
      callbacks.onIncrementalGraph?.({
        type: 'agent_complete',
        agentId: 'knowledge_extractor',
        agentStatus: 'skipped',
        nodes: [createAgentNode('knowledge_extractor', 8, 'skipped')],
        message: '知识抽取器已跳过'
      });
    } else {
      const factorUpdate = generateIncrementalUpdate('knowledge_extractor', 8, 'completed', state, accumulatedNodes, accumulatedEdges);
      accumulatedNodes.push(...factorUpdate.nodes!);
      accumulatedEdges.push(...factorUpdate.edges!);
      callbacks.onIncrementalGraph?.(factorUpdate);
    }
    
    // ========== Step 9: 结果验证器 ==========
    const validatorResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'result_validator',
        agentName: '结果验证器',
        nodeFn: resultValidatorNode
      },
      callbacks,
      errors
    );
    state = validatorResult.state;
    if (validatorResult.skipped) {
      skippedAgents.push('result_validator');
    } else {
      callbacks.onIncrementalGraph?.({
        type: 'agent_complete',
        agentId: 'result_validator',
        agentStatus: 'completed',
        nodes: [createAgentNode('result_validator', 9, 'completed')],
        message: '结果验证完成'
      });
    }
    
    // ========== Step 10: 敏感性分析师（条件执行）==========
    // 根据编排结果决定是否需要敏感性分析
    const shouldRunSensitivity = isAgentRequired(state.agentSchedule, 'sensitivity_analyst');
    const sensitivityResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'sensitivity_analyst',
        agentName: '敏感性分析师',
        nodeFn: sensitivityAnalysisNode,
        skipCondition: !shouldRunSensitivity,
        skipReason: 'LLM 决定跳过敏感性分析'
      },
      callbacks,
      errors
    );
    state = sensitivityResult.state;
    if (sensitivityResult.skipped) {
      skippedAgents.push('sensitivity_analyst');
    }
    
    // ========== Step 11: 行动建议器 ==========
    const advisorResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'action_advisor',
        agentName: '行动建议器',
        nodeFn: actionAdvisorNode
      },
      callbacks,
      errors
    );
    state = advisorResult.state;
    if (advisorResult.skipped) {
      skippedAgents.push('action_advisor');
    }
    
    // ========== Step 12: 报告生成器 ==========
    const reportResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'report_generator',
        agentName: '报告生成器',
        nodeFn: reportNode
      },
      callbacks,
      errors
    );
    state = reportResult.state;
    
    const reportUpdate = generateIncrementalUpdate('report_generator', 12, 'completed', state, accumulatedNodes, accumulatedEdges);
    accumulatedNodes.push(...reportUpdate.nodes!);
    accumulatedEdges.push(...reportUpdate.edges!);
    callbacks.onIncrementalGraph?.(reportUpdate);
    
    // ========== Step 13: 文档执行器 ==========
    const documentResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'document_executor',
        agentName: '文档执行器',
        nodeFn: documentExecutorNode
      },
      callbacks,
      errors
    );
    state = documentResult.state;
    
    // ========== Step 14: 质量控制器 ==========
    const qualityResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'quality_controller',
        agentName: '质量控制器',
        nodeFn: qualityCheckNode
      },
      callbacks,
      errors
    );
    state = qualityResult.state;
    
    // ========== Step 15: 执行监控器 ==========
    const monitorResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'execution_monitor',
        agentName: '执行监控器',
        nodeFn: executionMonitorNode
      },
      callbacks,
      errors
    );
    state = monitorResult.state;
    
    // ========== Step 16: 知识管理器 ==========
    const knowledgeResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'knowledge_manager',
        agentName: '知识管理器',
        nodeFn: knowledgeManagerNode
      },
      callbacks,
      errors
    );
    state = knowledgeResult.state;
    
    // ========== Step 17: 复盘分析师 ==========
    const reviewResult = await safeExecuteNode(
      state,
      llmClient,
      {
        agentId: 'review_analyst',
        agentName: '复盘分析师',
        nodeFn: reviewAnalystNode
      },
      callbacks,
      errors
    );
    state = reviewResult.state;
    
    // 记录错误到状态
    state = { ...state, errors, hasErrors: errors.length > 0 };
    
    // ========== Step 11: 循环修正检查 ==========
    // 检查是否需要修正
    while (state.needsRevision && (state.iterationCount || 0) < (state.maxIterations || 3)) {
      const iterationCount = (state.iterationCount || 0) + 1;
      const targetAgent = state.revisionTarget || '';
      const revisionReason = state.revisionReason || '';
      
      callbacks.onSystem?.(`🔄 检测到质量问题，开始第 ${iterationCount} 次修正 (${targetAgent})`);
      callbacks.onAgentThinking?.('quality_controller', `修正原因: ${revisionReason}`);
      
      // 记录修正历史
      const revisionRecord = {
        iteration: iterationCount,
        targetAgent,
        issue: {
          type: 'low_confidence' as const,  // 使用有效的 QualityIssueType
          severity: 'high' as const,
          description: revisionReason,
          suggestion: `重新执行 ${targetAgent}`,
          targetAgent
        },
        timestamp: new Date().toISOString(),
        result: 'pending' as const
      };
      
      // 更新状态
      state = { 
        ...state, 
        iterationCount,
        needsRevision: false,
        revisionHistory: [...(state.revisionHistory || []), revisionRecord]
      };
      
      // 根据目标智能体重新执行
      try {
        switch (targetAgent) {
          case 'search':
            // 重新搜索
            callbacks.onSystem?.('🔍 重新进行信息检索...');
            // 重新执行搜索
            const newSearchResponse = await advancedWebSearch(
              query,
              {
                count: 20,
                needSummary: true,
                needContent: true,
                timeRange: '1m',
              },
              customHeaders
            );
            const newSearchResults = {
              summary: newSearchResponse.summary || '',
              items: (newSearchResponse.web_items || []).map(item => ({
                title: item.title || '',
                url: item.url || '',
                snippet: item.snippet || '',
                content: item.content || '',
                siteName: item.site_name || '',
                publishTime: item.publish_time || '',
                authorityLevel: item.auth_info_level || 3,
                authorityDesc: item.auth_info_des || '',
              }))
            };
            const searchResult = await safeExecuteNode(
              state,
              llmClient,
              {
                agentId: 'search',
                agentName: '搜索',
                nodeFn: async (s) => searchNode(s, newSearchResults)
              },
              callbacks,
              errors
            );
            state = searchResult.state;
            break;
            
          case 'timeline':
            // 重新执行时间线
            callbacks.onSystem?.('📅 重新构建时间线...');
            const timelineResult = await safeExecuteNode(
              state,
              llmClient,
              {
                agentId: 'timeline',
                agentName: '时间线',
                nodeFn: timelineNode,
                skipCondition: !isAgentRequired(state.agentSchedule, 'timeline_analyst'),
                skipReason: '编排结果：不需要时间线分析'
              },
              callbacks,
              errors
            );
            state = timelineResult.state;
            break;
            
          case 'causal_inference':
            // 重新执行因果推理
            callbacks.onSystem?.('🔗 重新进行因果推理...');
            const causalResult = await safeExecuteNode(
              state,
              llmClient,
              {
                agentId: 'causal_inference',
                agentName: '因果推理',
                nodeFn: causalInferenceNode,
                skipCondition: !isAgentRequired(state.agentSchedule, 'causal_analyst'),
                skipReason: '编排结果：不需要因果推理'
              },
              callbacks,
              errors
            );
            state = causalResult.state;
            break;
            
          case 'scenario':
            // 重新执行场景推演
            callbacks.onSystem?.('🎯 重新进行场景推演...');
            const scenarioResult = await safeExecuteNode(
              state,
              llmClient,
              {
                agentId: 'scenario',
                agentName: '场景推演',
                nodeFn: scenarioNode,
                skipCondition: !isAgentRequired(state.agentSchedule, 'scenario_simulator'),
                skipReason: '编排结果：不需要场景推演'
              },
              callbacks,
              errors
            );
            state = scenarioResult.state;
            break;
            
          case 'key_factor':
            // 重新执行关键因素分析
            callbacks.onSystem?.('📊 重新识别关键因素...');
            const factorResult = await safeExecuteNode(
              state,
              llmClient,
              {
                agentId: 'key_factor',
                agentName: '关键因素',
                nodeFn: keyFactorNode,
                skipCondition: !isAgentRequired(state.agentSchedule, 'knowledge_extractor'),
                skipReason: '编排结果：不需要关键因素分析'
              },
              callbacks,
              errors
            );
            state = factorResult.state;
            break;
        }
        
        // 重新生成报告
        const newReportResult = await safeExecuteNode(
          state,
          llmClient,
          {
            agentId: 'report',
            agentName: '报告生成',
            nodeFn: reportNode
          },
          callbacks,
          errors
        );
        state = newReportResult.state;
        
        // 重新进行质量检查
        const newQualityResult = await safeExecuteNode(
          state,
          llmClient,
          {
            agentId: 'quality_check',
            agentName: '质量检查',
            nodeFn: qualityCheckNode
          },
          callbacks,
          errors
        );
        state = newQualityResult.state;
        
        // 更新修正记录结果
        const lastRevision = state.revisionHistory?.[state.revisionHistory.length - 1];
        if (lastRevision) {
          lastRevision.result = state.needsRevision ? 'failed' : 'success';
        }
        
      } catch (error) {
        console.error(`[LangGraph] Revision error for ${targetAgent}:`, error);
        // 修正失败，记录并继续
        const lastRevision = state.revisionHistory?.[state.revisionHistory.length - 1];
        if (lastRevision) {
          lastRevision.result = 'failed';
        }
        state.needsRevision = false;
      }
    }
    
    // 生成最终完整事件图谱（包含结论节点）
    const eventGraph = generateEventGraph(state);
    callbacks.onEventGraph?.(eventGraph);
    
    // 生成最终报告
    const finalReport = generateFinalReport(state);
    
    // 输出循环统计
    if ((state.iterationCount || 0) > 0) {
      callbacks.onSystem?.(`✅ 分析完成，共经历 ${state.iterationCount} 次修正`);
    }
    
    // 计算综合置信度
    const avgScenarioProb = (state.scenarios || []).length > 0
      ? (state.scenarios || []).reduce((sum: number, s: any) => sum + (s.probability || 0.33), 0) / (state.scenarios || []).length
      : 0.5;
    const searchCount = (state.searchResults || []).length;
    const sourceBonus = Math.min(searchCount * 0.02, 0.1);
    const confidence = Math.min(0.95, avgScenarioProb * 0.5 + 0.4 + sourceBonus);
    
    return {
      searchResults: state.searchResults || [],
      timeline: state.timeline || [],
      causalChain: state.causalChain || [],
      keyFactors: state.keyFactors || [],
      scenarios: state.scenarios || [],
      eventGraph,
      knowledgeGraph: state.knowledgeGraph || null,
      finalReport,
      taskComplexity: state.taskComplexity || 'moderate',
      agentSchedule: state.agentSchedule || null,
      skippedAgents,
      iterationCount: state.iterationCount || 0,
      revisionHistory: state.revisionHistory || [],
      confidence,
    };
    
  } catch (error) {
    console.error('[LangGraph] Analysis error:', error);
    throw error;
  }
}

/**
 * 生成事件图谱
 * 
 * 参考 67b93f0 版本结构：
 * 第1层：信息源节点（原始信息）
 * 第2层：时间线节点（事件脉络）
 * 第3层：因果链节点（因果关系）
 * 第4层：关键因素节点（驱动因素）
 * 第5层：场景推演节点（未来预测）
 * 第6层：结论输出节点（态势总结）
 * 
 * 支持无场景推演时的态势感知输出
 */
/**
 * 根据权重计算边的样式
 * 
 * 设计原则：
 * 1. 连接所有相关节点，不判断阈值
 * 2. 权重控制线条粗细和颜色
 * 3. 权重越高，线条越粗、颜色越深
 * 
 * @param weight 权重值 (0-1)
 * @param baseColor 基础颜色（可选）
 * @returns 边样式对象
 */
function getEdgeStyleByWeight(weight: number, baseColor: string = '#6366f1'): any {
  // 确保权重在 0-1 范围内
  const normalizedWeight = Math.max(0, Math.min(1, weight));
  
  // 线条粗细：1-4px（权重越高越粗）
  const strokeWidth = 1 + normalizedWeight * 3;
  
  // 颜色透明度：30%-100%（权重越高越不透明）
  const opacity = 0.3 + normalizedWeight * 0.7;
  
  // 根据权重选择颜色和标签
  let color = baseColor;
  let label = '';
  if (normalizedWeight >= 0.8) {
    color = '#dc2626'; // 红色 - 强关联
    label = '强关联';
  } else if (normalizedWeight >= 0.6) {
    color = '#f59e0b'; // 橙色 - 中等关联
    label = '中等';
  } else if (normalizedWeight >= 0.4) {
    color = '#3b82f6'; // 蓝色 - 一般关联
    label = '一般';
  } else {
    color = '#9ca3af'; // 灰色 - 弱关联
    label = '';
  }
  
  return {
    stroke: color,
    strokeWidth,
    opacity,
    label,
    animated: normalizedWeight >= 0.7 // 高权重时显示动画
  };
}

/**
 * 根据权重创建带样式的边
 * 
 * @param id 边ID
 * @param source 源节点ID
 * @param target 目标节点ID
 * @param weight 权重值 (0-1)
 * @param labelPrefix 标签前缀（如 '因果'、'因素'）
 * @returns 边对象
 */
function createWeightedEdge(
  id: string,
  source: string,
  target: string,
  weight: number,
  labelPrefix?: string
): any {
  const style = getEdgeStyleByWeight(weight);
  const fullLabel = labelPrefix && style.label ? `${labelPrefix}(${style.label})` : (labelPrefix || style.label);
  
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    animated: style.animated,
    label: fullLabel || undefined,
    labelStyle: style.label ? { fill: '#fff', fontWeight: 500, fontSize: 10 } : undefined,
    labelBgStyle: style.label ? { fill: style.stroke, fillOpacity: 0.9 } : undefined,
    labelBgPadding: style.label ? [4, 2] as [number, number] : undefined,
    labelBgBorderRadius: style.label ? 4 : undefined,
    style: {
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      opacity: style.opacity
    }
  };
}

/**
 * 生成态势感知图谱（Situation Awareness Graph）
 * 
 * 功能说明：
 * 这是一个综合性的分析图谱，展示从信息采集到态势结论的完整分析链路。
 * 它不只是"事件图谱"，而是包含事件、因果、因素、场景的多维度态势感知。
 * 
 * 七层结构：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 第0层：智能体执行层 - 展示数据处理流程                        │
 * │ 第1层：信息源节点   - 原始信息（搜索结果）                    │
 * │ 第2层：时间线节点   - 事件脉络（时间序列）                    │
 * │ 第3层：因果链节点   - 因果关系（传导路径）                    │
 * │ 第4层：关键因素节点 - 驱动因素（核心变量）                    │
 * │ 第5层：场景推演节点 - 未来预测（可能性分析）                  │
 * │ 第6层：结论输出节点 - 态势总结（综合研判）                    │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * 数据流转：
 * 信息源 → 时间线 → 因果链 → 关键因素 → 场景推演 → 结论
 * 
 * 注：原函数名 generateEventGraph 保留以保持兼容性，
 *     实际功能远超单纯的"事件图谱"。
 */

function generateEventGraph(state: Partial<AnalysisStateType>): any {
  const nodes: any[] = [];
  const edges: any[] = [];
  
  // 使用统一的布局参数
  const { AGENT_X, AGENT_GAP_Y, DATA_START_X, DATA_GAP_X, DATA_GAP_Y, START_Y } = INCREMENTAL_LAYOUT;
  
  console.log('[EventGraph] Generating graph with state:', {
    hasTimeline: !!state.timeline?.length,
    hasSearchResults: !!state.searchResults?.length,
    hasCausalChain: !!state.causalChain?.length,
    hasKeyFactors: !!state.keyFactors?.length,
    hasScenarios: !!state.scenarios?.length,
    query: state.query
  });
  
  // ==================== 第0层：智能体执行层 ====================
  // 智能体执行顺序
  const agentSequence = [
    { id: 'coordinator', name: '协调器' },
    { id: 'search', name: '搜索' },
    { id: 'source_evaluator', name: '信源评估', skipped: !isAgentRequired(state.agentSchedule, 'quality_evaluator') },
    { id: 'timeline', name: '时间线', skipped: !isAgentRequired(state.agentSchedule, 'timeline_analyst') },
    { id: 'causal_inference', name: '因果推理', skipped: !isAgentRequired(state.agentSchedule, 'causal_analyst') },
    { id: 'key_factor', name: '关键因素', skipped: !isAgentRequired(state.agentSchedule, 'knowledge_extractor') },
    { id: 'scenario', name: '场景推演', skipped: !isAgentRequired(state.agentSchedule, 'scenario_simulator') },
    { id: 'report', name: '报告生成' }
  ];
  
  // 创建智能体节点（纵向排列，使用统一的间距）
  agentSequence.forEach((agent, i) => {
    nodes.push({
      id: `agent-${agent.id}`,
      type: 'agent',
      position: { x: AGENT_X, y: START_Y + i * AGENT_GAP_Y },
      data: {
        label: agent.name,
        agentId: agent.id,
        status: agent.skipped ? 'skipped' : 'completed'
      }
    });
    
    // 连接到下一个智能体（表示执行顺序）
    if (i < agentSequence.length - 1) {
      edges.push({
        id: `e-agent-${agent.id}-${agentSequence[i + 1].id}`,
        source: `agent-${agent.id}`,
        target: `agent-${agentSequence[i + 1].id}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#94a3b8', strokeDasharray: '3,3' }
      });
    }
  });
  
  const timeline = state.timeline || [];
  const searchResults = state.searchResults || [];
  const searchSummary = state.searchSummary || '';
  const SOURCE_COUNT = 10;
  const TIMELINE_COUNT = 8;
  
  let currentX = DATA_START_X;
  
  // ==================== 第1层：信息源节点 ====================
  // 显示所有筛选后的信息源（最多10条）
  const sourceItems = searchResults.slice(0, SOURCE_COUNT);
  sourceItems.forEach((item: any, i: number) => {
    nodes.push({
      id: `source-${i}`,
      type: 'source',
      position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
      data: {
        label: item.title?.substring(0, 25) || `信息源 ${i + 1}`,
        title: item.title,
        snippet: item.snippet,
        url: item.url,
        siteName: item.siteName,
        publishTime: item.publishTime,
        credibility: item.authorityLevel || 3,
        sourceType: item.authorityLevel >= 4 ? 'official' : 
                    item.authorityLevel >= 3 ? 'media' : 'social'
      }
    });
  });
  
  // 连接搜索智能体到信息源节点（表示数据来源）
  edges.push({
    id: `agent-to-source`,
    source: `agent-search`,
    target: `source-0`,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#6366f1', strokeDasharray: '5,5' }
  });
  
  currentX += DATA_GAP_X;
  
  // ==================== 第2层：时间线节点 ====================
  const timelineEvents = timeline.slice(0, TIMELINE_COUNT);
  
  // 如果没有时间线数据，基于搜索结果创建
  if (timelineEvents.length === 0) {
    // 从搜索结果推断事件
    sourceItems.slice(0, 5).forEach((item: any, i: number) => {
      timelineEvents.push({
        event: item.title?.substring(0, 30) || `事件${i + 1}`,
        timestamp: item.publishTime || new Date().toISOString(),
        description: item.snippet || '',
        weight: 0.5,
        heatIndex: 50
      });
    });
  }
  
  timelineEvents.forEach((event: any, i: number) => {
    const weight = event.weight || (event.heatIndex || 50) / 100;
    nodes.push({
      id: `timeline-${i}`,
      type: 'timeline',
      position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
      data: {
        label: event.event?.substring(0, 20) || `事件${i + 1}`,
        timestamp: event.timestamp?.substring(0, 10) || '未知时间',
        event: event.event,
        description: event.description || event.event,
        situation: event.significance,
        heatIndex: event.heatIndex || Math.round(weight * 100),
        trend: event.trendChange || 'neutral',
        importance: weight > 0.7 ? 'high' : weight > 0.4 ? 'medium' : 'low',
        weight
      }
    });
  });
  
  // ==================== 关键改进：多对多连接 ====================
  // 每个信息源连接到最相关的时间线节点
  // 使用智能匹配而非简单取模
  sourceItems.forEach((source: any, sourceIdx: number) => {
    // 计算该信息源与各时间线节点的相关性
    const timelineScores = timelineEvents.map((event: any, timelineIdx: number) => {
      let score = 0;
      const sourceText = `${source.title} ${source.snippet}`.toLowerCase();
      const eventText = `${event.event} ${event.description}`.toLowerCase();
      
      // 时间匹配
      if (source.publishTime && event.timestamp) {
        const sourceDate = new Date(source.publishTime).toDateString();
        const eventDate = new Date(event.timestamp).toDateString();
        if (sourceDate === eventDate) score += 0.5;
      }
      
      // 文本相似度
      const sourceTerms = sourceText.split(/\s+/);
      sourceTerms.forEach((term: string) => {
        if (term.length > 2 && eventText.includes(term)) {
          score += 0.1;
        }
      });
      
      // 归一化分数到 0-1 范围
      score = Math.min(1, score);
      return { timelineIdx, score };
    });
    
    // 排序并选择最相关的1-2个时间线节点
    timelineScores.sort((a: any, b: any) => b.score - a.score);
    
    // 连接所有相关节点，使用相关性分数控制样式
    const topConnections = timelineScores.slice(0, 2);
    topConnections.forEach(({ timelineIdx, score }: any) => {
      if (timelineIdx < timelineEvents.length && score > 0) {
        edges.push(createWeightedEdge(
          `e-source-${sourceIdx}-timeline-${timelineIdx}`,
          `source-${sourceIdx}`,
          `timeline-${timelineIdx}`,
          score,
          '关联'
        ));
      }
    });
    
    // 如果没有找到相关时间线，连接到第一个（使用低权重）
    if (topConnections.length === 0 || topConnections[0].score === 0) {
      edges.push(createWeightedEdge(
        `e-source-${sourceIdx}-timeline-0`,
        `source-${sourceIdx}`,
        'timeline-0',
        0.2, // 低权重
        '关联'
      ));
    }
  });
  
  currentX += DATA_GAP_X;
  
  // ==================== 第3层：因果链节点 ====================
  const causalChain = state.causalChain || [];
  const causalNodes = causalChain.slice(0, 6);
  
  // 如果没有因果链数据，从关键因素推断
  if (causalNodes.length === 0) {
    const inferredCauses = state.keyFactors?.slice(0, 4) || [
      { factor: '市场动态', description: '市场变化的影响', weight: 0.6 },
      { factor: '政策环境', description: '政策调整的影响', weight: 0.5 },
      { factor: '外部因素', description: '外部环境的变化', weight: 0.4 },
      { factor: '技术发展', description: '技术进步的推动', weight: 0.35 }
    ];
    
    inferredCauses.forEach((factor: any, idx: number) => {
      causalNodes.push({
        type: idx === 0 ? 'cause' : idx === inferredCauses.length - 1 ? 'result' : 'intermediary',
        factor: factor.factor,
        description: factor.description,
        strength: factor.weight || 0.5
      });
    });
  }
  
  causalNodes.forEach((chain: any, i: number) => {
    const strength = chain.strength || 0.5;
    nodes.push({
      id: `causal-${i}`,
      type: 'causal',
      position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
      data: {
        label: chain.factor?.substring(0, 15) || `因果${i + 1}`,
        nodeType: chain.type || 'cause',
        cause: chain.factor,
        effect: chain.description,
        description: chain.description,
        preconditions: chain.preconditions,
        mechanism: chain.mechanism,
        strength,
        confidence: strength
      }
    });
    
    // 连接时间线到因果链（多对多，使用权重控制样式）
    // 每个因果链连接到相关的时间线节点
    if (timelineEvents.length > 0) {
      // 选择最近的2-3个时间线事件
      const connectionsCount = Math.min(3, timelineEvents.length);
      for (let j = 0; j < connectionsCount; j++) {
        const timelineIdx = (i + j) % timelineEvents.length;
        edges.push(createWeightedEdge(
          `e-timeline-${timelineIdx}-causal-${i}`,
          `timeline-${timelineIdx}`,
          `causal-${i}`,
          strength,
          '因果'
        ));
      }
    }
  });
  
  currentX += DATA_GAP_X;
  
  // ==================== 第4层：关键因素节点 ====================
  const keyFactors = state.keyFactors || [];
  const factorNodes = keyFactors.slice(0, 6);
  
  // 如果没有关键因素数据，创建默认节点
  if (factorNodes.length === 0) {
    const defaultFactors = [
      { factor: '市场动态', description: '市场变化的影响', weight: 0.7, dimension: '经济', impact: 'positive' as const },
      { factor: '政策环境', description: '政策调整的影响', weight: 0.6, dimension: '政策', impact: 'neutral' as const },
      { factor: '技术发展', description: '技术进步的推动', weight: 0.5, dimension: '技术', impact: 'positive' as const },
      { factor: '外部环境', description: '国际形势的影响', weight: 0.5, dimension: '国际', impact: 'neutral' as const }
    ];
    defaultFactors.forEach((factor) => {
      factorNodes.push({
        factor: factor.factor,
        description: factor.description,
        weight: factor.weight,
        dimension: factor.dimension,
        impact: factor.impact
      });
    });
  }
  
  factorNodes.forEach((factor: any, i: number) => {
    const weight = factor.weight || 0.5;
    nodes.push({
      id: `factor-${i}`,
      type: 'factor',
      position: { x: currentX, y: START_Y + i * DATA_GAP_Y },
      data: {
        label: factor.factor?.substring(0, 15) || `因素${i + 1}`,
        factor: factor.factor,
        description: factor.description,
        dimension: factor.dimension || '综合',
        impact: factor.impact || 'neutral',
        weight,
        evidence: factor.evidence || []
      }
    });
    
    // 连接因果链到因素（多对多，使用权重控制样式）
    const causalCount = causalNodes.length;
    if (causalCount > 0) {
      // 每个因素连接到相关的因果链
      const connectionsCount = Math.min(2, causalCount);
      for (let j = 0; j < connectionsCount; j++) {
        const causalIdx = (i + j) % causalCount;
        edges.push(createWeightedEdge(
          `e-causal-${causalIdx}-factor-${i}`,
          `causal-${causalIdx}`,
          `factor-${i}`,
          weight,
          '因素'
        ));
      }
    }
  });
  
  currentX += DATA_GAP_X;
  
  // ==================== 第5层：传导网络节点（新增）===================
  // 如果有传导网络数据，展示传导路径
  const propagationNetwork = state.propagationNetwork;
  let propagationCurrentX = currentX;
  
  if (propagationNetwork && propagationNetwork.paths && propagationNetwork.paths.length > 0) {
    console.log('[EventGraph] Adding propagation network nodes');
    
    // 创建传导路径节点
    propagationNetwork.paths.forEach((path: any, i: number) => {
      const pathStrength = path.pathStrength || 0.5;
      nodes.push({
        id: `propagation-${i}`,
        type: 'causal',  // 使用因果节点类型（红色）
        position: { x: propagationCurrentX, y: START_Y + i * DATA_GAP_Y },
        data: {
          label: path.pathName?.substring(0, 15) || `传导${i + 1}`,
          nodeType: 'propagation',
          cause: path.sourceNode,
          effect: path.targetNodes?.join(' → ') || path.transmissionMechanism,
          description: path.transmissionMechanism,
          strength: pathStrength,
          confidence: pathStrength,
          // 额外的传导信息
          transmissionDelay: path.transmissionDelay,
          historicalPrecedents: path.historicalPrecedents
        }
      });
      
      // 连接关键因素到传导路径（使用权重控制样式）
      if (factorNodes.length > 0) {
        const factorIdx = i % factorNodes.length;
        edges.push(createWeightedEdge(
          `e-factor-${factorIdx}-propagation-${i}`,
          `factor-${factorIdx}`,
          `propagation-${i}`,
          pathStrength,
          '传导'
        ));
      }
    });
    
    // 传导路径之间的连接（表示传导链，使用权重控制样式）
    for (let i = 0; i < propagationNetwork.paths.length - 1; i++) {
      const pathStrength = propagationNetwork.paths[i].pathStrength || 0.5;
      edges.push(createWeightedEdge(
        `e-propagation-${i}-to-${i + 1}`,
        `propagation-${i}`,
        `propagation-${i + 1}`,
        pathStrength,
        '传导链'
      ));
    }
    
    propagationCurrentX += DATA_GAP_X;
  }
  
  // ==================== 第6层：场景推演节点 ====================
  const scenarios = state.scenarios || [];
  const scenarioNodes = scenarios.slice(0, 4);
  
  // 更新 currentX 到传导网络之后
  currentX = propagationCurrentX;
  
  // 只有当有场景推演数据时才创建场景节点
  if (scenarioNodes.length > 0) {
    scenarioNodes.forEach((scenario: any, i: number) => {
      const probability = scenario.probability || 0.33;
      nodes.push({
        id: `scenario-${i}`,
        type: 'scenario',
        position: { x: currentX, y: START_Y + i * (DATA_GAP_Y + 15) },
        data: {
          label: scenario.name || `场景${i + 1}`,
          scenarioType: scenario.type || 'baseline',
          name: scenario.name,
          probability,
          triggers: scenario.triggers || [],
          predictions: scenario.predictions || [],
          impacts: scenario.impacts || []
        }
      });
      
      // 优先连接传导路径到场景（使用概率控制样式）
      if (propagationNetwork?.paths?.length > 0) {
        const propagationIdx = i % propagationNetwork.paths.length;
        edges.push(createWeightedEdge(
          `e-propagation-${propagationIdx}-scenario-${i}`,
          `propagation-${propagationIdx}`,
          `scenario-${i}`,
          probability,
          '影响'
        ));
      } else if (factorNodes.length > 0) {
        // 如果没有传导网络，连接因素到场景（使用概率控制样式）
        const connectionsCount = Math.min(3, factorNodes.length);
        for (let j = 0; j < connectionsCount; j++) {
          const factorIdx = (i + j) % factorNodes.length;
          edges.push(createWeightedEdge(
            `e-factor-${factorIdx}-scenario-${i}`,
            `factor-${factorIdx}`,
            `scenario-${i}`,
            probability,
            '场景'
          ));
        }
      }
    });
    
    currentX += DATA_GAP_X;
    
    // ==================== 第6层：结论输出节点 ====================
    // 根据场景推演结果生成结论
    const mainConclusion = generateMainConclusion(state, sourceItems);
    nodes.push({
      id: 'conclusion-main',
      type: 'conclusion',
      position: { x: currentX, y: START_Y + 150 },
      data: {
        label: '态势结论',
        mainConclusion: mainConclusion.summary,
        probabilityDistribution: mainConclusion.probabilities,
        confidenceLevel: mainConclusion.confidence,
        earlyWarningIndicators: mainConclusion.warnings,
        recommendations: mainConclusion.recommendations,
        sourceCount: sourceItems.length,  // 记录信息源数量
        usedSources: sourceItems.slice(0, 5).map((s: any) => s.siteName || s.title?.substring(0, 20))
      }
    });
    
    // 连接所有场景到结论（使用概率控制样式）
    scenarioNodes.forEach((scenario: any, i: number) => {
      edges.push(createWeightedEdge(
        `e-scenario-${i}-conclusion`,
        `scenario-${i}`,
        'conclusion-main',
        scenario.probability || 0.33,
        '结论'
      ));
    });
  } else {
    // ==================== 无场景推演时的态势总结 ====================
    // 创建态势总结节点作为替代输出
    const situationSummary = generateSituationSummary(state, sourceItems);
    nodes.push({
      id: 'situation-summary',
      type: 'conclusion',
      position: { x: currentX, y: START_Y + 100 },
      data: {
        label: '态势总结',
        mainConclusion: situationSummary.summary,
        keyTrends: situationSummary.trends,
        riskLevel: situationSummary.riskLevel,
        confidence: situationSummary.confidence,
        recommendations: situationSummary.recommendations,
        earlyWarningIndicators: situationSummary.warnings,
        sourceCount: sourceItems.length,
        usedSources: sourceItems.slice(0, 5).map((s: any) => s.siteName || s.title?.substring(0, 20))
      }
    });
    
    // 连接所有关键因素到态势总结（使用权重控制样式）
    factorNodes.forEach((factor: any, i: number) => {
      edges.push(createWeightedEdge(
        `e-factor-${i}-summary`,
        `factor-${i}`,
        'situation-summary',
        factor.weight || 0.5,
        '总结'
      ));
    });
  }
  
  // ==================== 智能体到数据层的连接 ====================
  // 展示哪个智能体负责处理哪层数据
  const agentDataLinks = [
    { agentId: 'timeline', dataLayer: 'timeline', dataId: 'timeline-0' },
    { agentId: 'causal_inference', dataLayer: 'causal', dataId: 'causal-0' },
    { agentId: 'key_factor', dataLayer: 'factor', dataId: 'factor-0' },
    { agentId: 'scenario', dataLayer: 'scenario', dataId: 'scenario-0' },
  ];
  
  agentDataLinks.forEach(link => {
    // 检查数据节点是否存在
    const dataNodeExists = nodes.some(n => n.id === link.dataId);
    const agentNodeExists = nodes.some(n => n.id === `agent-${link.agentId}`);
    const agentSkipped = !isAgentRequired(state.agentSchedule, link.agentId);
    
    if (dataNodeExists && agentNodeExists && !agentSkipped) {
      edges.push({
        id: `e-agent-${link.agentId}-to-${link.dataLayer}`,
        source: `agent-${link.agentId}`,
        target: link.dataId,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#a855f7', strokeDasharray: '4,4' },
        label: '处理',
        labelStyle: { fill: '#a855f7', fontSize: 10 }
      });
    }
  });
  
  console.log(`[EventGraph] Total nodes: ${nodes.length}, edges: ${edges.length}`);
  
  return { nodes, edges, searchResults };
}

/**
 * 生成主结论（有场景推演时）
 */
function generateMainConclusion(state: Partial<AnalysisStateType>, sources: any[] = []): {
  summary: string;
  probabilities: string;
  confidence: string;
  warnings: string[];
  recommendations: string[];
} {
  const scenarios = state.scenarios || [];
  const keyFactors = state.keyFactors || [];
  
  // 计算综合置信度（包含信息源数量因素）
  const avgProbability = scenarios.length > 0 
    ? scenarios.reduce((sum: number, s: any) => sum + (s.probability || 0.33), 0) / scenarios.length 
    : 0.5;
  
  // 信息源质量加成
  const sourceBonus = Math.min(sources.length * 2, 10); // 每个信息源增加2%，最多10%
  
  // 找出最可能的场景
  const topScenario = scenarios.sort((a: any, b: any) => 
    (b.probability || 0) - (a.probability || 0)
  )[0];
  
  const summary = topScenario 
    ? `当前态势最可能向"${topScenario.name}"方向发展，概率为${((topScenario.probability || 0.33) * 100).toFixed(0)}%。基于${sources.length}条高质量信息源分析，结论可信度较高。${topScenario.description || ''}`
    : '基于当前分析，态势发展方向尚不明朗，需要更多数据支撑。';
  
  const probabilities = scenarios.map((s: any) => 
    `${s.name}: ${((s.probability || 0.33) * 100).toFixed(0)}%`
  ).join(' | ');
  
  const confidence = `综合置信度: ${Math.min(95, ((avgProbability + 0.5) / 2 * 100) + sourceBonus).toFixed(0)}%（基于${sources.length}条信息源）`;
  
  // 提取预警指标
  const warnings: string[] = [];
  scenarios.forEach((s: any) => {
    if (s.triggers && Array.isArray(s.triggers)) {
      warnings.push(...s.triggers.slice(0, 2));
    }
  });
  
  // 生成建议
  const recommendations: string[] = [];
  keyFactors.slice(0, 3).forEach((f: any) => {
    if (f.description) {
      recommendations.push(`关注${f.factor}: ${f.description}`);
    }
  });
  
  return {
    summary,
    probabilities,
    confidence,
    warnings: warnings.slice(0, 5),
    recommendations: recommendations.slice(0, 3)
  };
}

/**
 * 生成态势总结（无场景推演时）
 */
function generateSituationSummary(state: Partial<AnalysisStateType>, sources: any[] = []): {
  summary: string;
  trends: string[];
  riskLevel: string;
  confidence: string;
  warnings: string[];
  recommendations: string[];
} {
  const timeline = state.timeline || [];
  const causalChain = state.causalChain || [];
  const keyFactors = state.keyFactors || [];
  const searchSummary = state.searchSummary || '';
  
  // 生成总结（包含信息源信息）
  let summary = `基于${sources.length}条高质量信息源分析：\n\n`;
  
  if (timeline.length > 0) {
    const latestEvent = timeline[0];
    summary += `最近重要事件：${latestEvent.event || '未知事件'}（${latestEvent.timestamp?.substring(0, 10) || '时间未知'}）\n`;
  }
  
  if (causalChain.length > 0) {
    summary += `主要因果链：${causalChain.slice(0, 2).map((c: any) => c.factor).join(' → ')}\n`;
  }
  
  if (searchSummary) {
    summary += `\n信息摘要：${searchSummary.substring(0, 200)}...`;
  }
  
  // 提取趋势
  const trends: string[] = [];
  timeline.slice(0, 3).forEach((event: any) => {
    if (event.trendChange) {
      trends.push(`${event.event?.substring(0, 20)}: ${event.trendChange === 'up' ? '上升' : event.trendChange === 'down' ? '下降' : '平稳'}`);
    }
  });
  
  // 评估风险等级
  let riskLevel = '中等';
  const highRiskEvents = timeline.filter((e: any) => e.weight > 0.7 || e.heatIndex > 70);
  if (highRiskEvents.length > 2) {
    riskLevel = '较高';
  } else if (highRiskEvents.length === 0) {
    riskLevel = '较低';
  }
  
  // 信息源质量加成
  const sourceBonus = Math.min(sources.length * 2, 10);
  const confidence = `分析置信度: ${Math.min(90, 50 + timeline.length * 5 + keyFactors.length * 5 + sourceBonus)}%（基于${sources.length}条信息源）`;
  
  // 预警指标
  const warnings: string[] = keyFactors
    .filter((f: any) => f.impact === 'negative')
    .map((f: any) => f.factor)
    .slice(0, 3);
  
  // 建议
  const recommendations: string[] = keyFactors
    .slice(0, 3)
    .map((f: any) => `持续关注${f.factor}的动态变化`);
  
  return {
    summary,
    trends,
    riskLevel,
    confidence,
    warnings,
    recommendations
  };
}

function generateFinalReport(state: Partial<AnalysisStateType>): string {
  // 使用 agentSchedule 生成执行策略信息
  const scheduleInfo = state.agentSchedule ? `
## 执行策略
- 任务复杂度: ${state.taskComplexity}
- 需要的智能体: ${state.agentSchedule.requiredAgents.join(', ')}
- 核心目标: ${state.agentSchedule.coreObjective}
- 调度原因: ${state.agentSchedule.reason || '无'}
` : '';

  return `# 宏观态势分析报告

## 分析主题
${state.query}
${scheduleInfo}
## 协调器分析
${state.coordinatorOutput || ''}

## 搜索结果分析
${state.searchOutput || ''}

${state.sourceEvaluatorOutput ? `## 信源评估\n${state.sourceEvaluatorOutput}\n` : ''}

${state.timelineOutput ? `## 时间线梳理\n${state.timelineOutput}\n` : ''}

${state.causalInferenceOutput ? `## 因果推理\n${state.causalInferenceOutput}\n` : ''}

${state.scenarioOutput ? `## 场景推演\n${state.scenarioOutput}\n` : ''}

${state.keyFactorOutput ? `## 关键因素\n${state.keyFactorOutput}\n` : ''}

## 分析报告
${state.reportOutput || ''}

## 质量检查
${state.qualityCheckOutput || ''}

---
报告时间: ${new Date().toLocaleString('zh-CN')}`;
}
