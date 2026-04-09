/**
 * LangGraph 状态定义
 * 定义多智能体工作流的状态结构
 */

import { Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * 智能体层级定义 - 五层混合架构 + 独立调度层
 */
export type AgentLayer = 'scheduler' | 'perception' | 'cognition' | 'decision' | 'action' | 'evolution';

/**
 * 智能体节点定义
 */
export interface AgentNode {
  id: string;
  name: string;
  layer: AgentLayer;
  description: string;
  icon?: string;  // Lucide图标名称
}

/**
 * 五类智能体定义 - 五层混合架构（感知体、认知体、决策体、行动体、进化体）
 */
export const AGENT_NODES: AgentNode[] = [
  // ========== 调度层（独立协调器）- 职责：意图理解、复杂度判断、智能体调度 ==========
  // 特点：独立于五类智能体，是"指挥官"角色，不参与业务流程，仅负责编排
  { id: 'intent_parser', name: '意图解析器', layer: 'scheduler', description: '理解用户意图、判断任务复杂度、确定执行策略' },
  
  // ========== 感知体层（第一层：感知体） - 职责：信息采集、事件抽取、质量评估 ==========
  // 完整链路：采集 → 抽取 → 评估
  { id: 'scout_cluster', name: '侦察兵集群', layer: 'perception', description: '多源信息采集、实时数据抓取' },
  { id: 'event_extractor', name: '事件抽取器', layer: 'perception', description: '从非结构化文本中抽取结构化事件' },
  { id: 'quality_evaluator', name: '质量评估器', layer: 'perception', description: '信息可信度评估、来源可靠性分析' },
  { id: 'geo_extractor', name: '地理抽取器', layer: 'perception', description: '地理位置抽取、空间关系分析' },

  // ========== 认知体层（第二层：认知体） - 职责：时序分析、因果推理、知识提取 ==========
  // 完整链路：时序 → 因果 → 知识 → 验证
  { id: 'timeline_analyst', name: '时序分析师', layer: 'cognition', description: '事件时间线构建、发展脉络梳理' },
  { id: 'causal_analyst', name: '因果分析师', layer: 'cognition', description: '因果链识别、风险传导路径分析' },
  { id: 'knowledge_extractor', name: '知识抽取器', layer: 'cognition', description: '关键因素识别、领域知识提取' },
  { id: 'result_validator', name: '结果验证器', layer: 'cognition', description: '分析结果验证、逻辑一致性检查' },

  // ========== 决策体层（第三层：决策体） - 职责：场景预测、策略规划、决策支持 ==========
  // 完整链路：推演 → 分析 → 建议
  { id: 'scenario_simulator', name: '场景推演器', layer: 'decision', description: '多场景模拟、概率预测、路径规划' },
  { id: 'sensitivity_analyst', name: '敏感性分析师', layer: 'decision', description: '关键变量敏感性、脆弱点识别' },
  { id: 'action_advisor', name: '行动建议器', layer: 'decision', description: '基于分析结果的策略建议' },

  // ========== 行动体层（第四层：行动体） - 职责：输出生成、存储执行、质量控制 ==========
  // 完整链路：生成 → 执行 → 控制 → 监控
  { id: 'report_generator', name: '报告生成器', layer: 'action', description: '生成结构化报告和分析文档' },
  { id: 'document_executor', name: '文档执行器', layer: 'action', description: '写入存储（对象存储/数据库）' },
  { id: 'quality_controller', name: '质量控制器', layer: 'action', description: '风险边界控制、合规性检查、异常拦截' },
  { id: 'execution_monitor', name: '执行监控器', layer: 'action', description: '执行状态监控、完整性检查' },

  // ========== 进化体层（第五层：进化体） - 职责：知识沉淀、案例管理、持续优化 ==========
  // 完整链路：存储 → 检索 → 复盘
  { id: 'knowledge_manager', name: '知识管理器', layer: 'evolution', description: '知识图谱维护、案例存储检索' },
  { id: 'review_analyst', name: '复盘分析师', layer: 'evolution', description: '分析成败原因、提取经验教训' }
];

/**
 * 时间线事件
 */
export interface TimelineEvent {
  timestamp: string;
  event: string;
  description?: string;
  significance?: string;
  trendChange?: 'up' | 'down' | 'stable';
  heatIndex?: number;
  weight?: number; // 事件重要性权重 (0-1)，用于图谱连接线显示
  isCoreEvent?: boolean; // 是否为核心事件
}

/**
 * 因果链节点
 */
export interface CausalChainNode {
  type: 'cause' | 'intermediary' | 'conductor' | 'result';
  factor: string;
  description: string;
  strength: number;
  strengthReason?: string; // 强度评估依据
  relatedCoreEvents?: string[]; // 相关的核心事件
}

/**
 * 关键因素
 */
export interface KeyFactor {
  factor: string;
  description: string;
  dimension: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  trend?: string;
}

/**
 * 场景推演
 */
export interface ScenarioNode {
  name: string;
  type: 'optimistic' | 'neutral' | 'pessimistic' | 'custom';
  direction?: 'up' | 'down' | 'stable'; // 对分析目标的影响方向
  probability: number;
  probabilityReasoning?: string; // 概率计算依据
  description: string;
  triggers?: string[];
  driverFactors?: string[]; // 核心驱动因素
  predictions?: Array<{ timeframe: string; result: string }>;
  impacts?: Array<ChinaMarketImpact>; // 中国市场影响
}

/**
 * 中国市场影响
 */
export interface ChinaMarketImpact {
  market: 'A股市场' | '人民币汇率' | '中国债券' | '大宗商品' | '跨境资本' | '房地产' | '产业链' | string;
  direction: 'up' | 'down' | 'stable' | 'inflow' | 'outflow';
  magnitude: string; // 具体数值区间
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string; // 影响逻辑说明
}

/**
 * 搜索结果项
 */
export interface SearchItem {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  siteName?: string;
  publishTime?: string;
  authorityLevel?: number;
  authorityDesc?: string;
}

/**
 * 任务复杂度等级
 */
export type TaskComplexity = 'simple' | 'moderate' | 'complex';

/**
 * 智能体调度决策 - 采用"编排思维"
 * 
 * 设计原则：
 * - 默认不执行任何智能体
 * - 根据任务需求，动态添加需要执行的智能体
 * - 核心智能体（如事件抽取器）应默认添加
 */
export interface AgentSchedule {
  /** 需要执行的智能体ID列表 */
  requiredAgents: string[];
  
  /** 分析目标 */
  coreObjective: string;
  
  /** 关键问题列表 */
  keyQuestions: string[];
  
  /** 分析计划 */
  analysisPlan: string[];
  
  /** 任务复杂度 */
  taskComplexity: TaskComplexity;
  
  /** 调度原因说明 */
  reason: string;
}

/**
 * 检查智能体是否需要执行
 */
export function isAgentRequired(schedule: AgentSchedule | null | undefined, agentId: string): boolean {
  if (!schedule || !schedule.requiredAgents) return false;
  return schedule.requiredAgents.includes(agentId);
}

/**
 * 智能体执行错误
 */
export interface AgentError {
  agentId: string;            // 智能体 ID
  agentName: string;          // 智能体名称
  error: string;              // 错误信息
  timestamp: string;          // 错误时间
  retryCount: number;         // 重试次数
  fallbackUsed?: string;      // 使用的回退策略
  recovered: boolean;         // 是否已恢复
}

/**
 * 回退策略配置
 */
export interface FallbackStrategy {
  agentId: string;            // 智能体 ID
  maxRetries: number;         // 最大重试次数
  retryDelayMs: number;       // 重试延迟（毫秒）
  fallbackAgent?: string;     // 降级到哪个智能体
  defaultOutput?: any;        // 默认输出
  skipOnFailure: boolean;     // 失败时是否跳过
  useSimplifiedPrompt: boolean; // 是否使用简化 Prompt 重试
}

/**
 * 默认回退策略配置
 */
export const DEFAULT_FALLBACK_STRATEGIES: FallbackStrategy[] = [
  {
    agentId: 'coordinator',
    maxRetries: 3,
    retryDelayMs: 1000,
    skipOnFailure: false,
    useSimplifiedPrompt: true,
    defaultOutput: {
      taskComplexity: 'moderate',
      agentSchedule: {
        requiredAgents: ['scout_cluster', 'event_extractor', 'report_generator'],
        coreObjective: '分析任务',
        keyQuestions: [],
        analysisPlan: [],
        taskComplexity: 'moderate',
        reason: '协调器失败，使用默认配置'
      }
    }
  },
  {
    agentId: 'search',
    maxRetries: 2,
    retryDelayMs: 500,
    skipOnFailure: false,
    useSimplifiedPrompt: false,
    defaultOutput: { summary: '', items: [] }
  },
  {
    agentId: 'source_evaluator',
    maxRetries: 2,
    retryDelayMs: 500,
    skipOnFailure: true,
    useSimplifiedPrompt: true
  },
  {
    agentId: 'timeline',
    maxRetries: 3,
    retryDelayMs: 1000,
    skipOnFailure: true,
    useSimplifiedPrompt: true,
    defaultOutput: {
      events: [],
      evolutionSummary: '时间线分析暂时不可用，请稍后重试'
    }
  },
  {
    agentId: 'causal_inference',
    maxRetries: 3,
    retryDelayMs: 1000,
    skipOnFailure: true,
    useSimplifiedPrompt: true,
    defaultOutput: {
      chains: [],
      causalSummary: '因果分析暂时不可用，请稍后重试'
    }
  },
  {
    agentId: 'scenario',
    maxRetries: 3,
    retryDelayMs: 1000,
    fallbackAgent: 'situation_summary',
    skipOnFailure: true,
    useSimplifiedPrompt: true,
    defaultOutput: {
      scenarios: [],
      scenarioSummary: '场景推演暂时不可用，已使用态势总结替代'
    }
  },
  {
    agentId: 'key_factor',
    maxRetries: 2,
    retryDelayMs: 500,
    skipOnFailure: true,
    useSimplifiedPrompt: true,
    defaultOutput: {
      factors: [],
      factorSummary: '关键因素分析暂时不可用'
    }
  },
  {
    agentId: 'report',
    maxRetries: 2,
    retryDelayMs: 500,
    skipOnFailure: false,
    useSimplifiedPrompt: true,
    defaultOutput: {
      title: '分析报告',
      executiveSummary: '报告生成失败，请查看各模块分析结果'
    }
  },
  {
    agentId: 'quality_check',
    maxRetries: 1,
    retryDelayMs: 500,
    skipOnFailure: true,
    useSimplifiedPrompt: false,
    defaultOutput: {
      completeness: 0.5,
      consistency: 0.5,
      issues: ['质量检查未能完成']
    }
  }
];

/**
 * 分析状态 - LangGraph Annotation
 */
export const AnalysisState = Annotation.Root({
  // ========== 输入 ==========
  
  // 输入
  query: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // 会话ID（用于记忆持久化）
  sessionId: Annotation<string>({
    reducer: (_, x) => x ?? '',
    default: () => '',
  }),
  
  // 消息历史
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  
  // 搜索结果
  searchResults: Annotation<SearchItem[]>({
    reducer: (_, x) => x,
    default: () => [],
  }),
  searchSummary: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // 各智能体输出
  coordinatorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  searchOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  sourceEvaluatorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  timelineOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  causalInferenceOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  scenarioOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  keyFactorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  reportOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  qualityCheckOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // ========== 五层混合架构新增智能体输出（感知体、认知体、决策体、行动体、进化体） ==========
  
  // 地理信息抽取
  geoExtractorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  geoLocations: Annotation<GeoLocation[]>({
    reducer: (_, x) => x,
    default: () => [],
  }),
  geoPatterns: Annotation<GeoPatterns>({
    reducer: (_, x) => x,
    default: () => ({ mainRegions: [], hotspots: [], connections: [] }),
  }),
  
  // 敏感性分析
  sensitivityAnalysisOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  sensitivityAnalysis: Annotation<SensitivityAnalysis>({
    reducer: (_, x) => x,
    default: () => ({
      keyVariables: [],
      sensitivityMatrix: [],
      vulnerabilities: [],
      stressTests: [],
      overallSensitivity: { score: 0.5, level: 'medium', mainDrivers: [], recommendations: [] }
    }),
  }),
  
  // 行动建议
  actionAdvisorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  actionAdvice: Annotation<ActionAdvice>({
    reducer: (_, x) => x,
    default: () => ({
      coreRecommendations: [],
      strategyMatrix: [],
      chinaPerspective: { opportunities: [], challenges: [], recommendedActions: [] },
      riskAlerts: [],
      monitoringIndicators: []
    }),
  }),
  
  // 风险传导分析结果
  riskPropagationResult: Annotation<RiskPropagationResult | null>({
    reducer: (_, x) => x ?? null,
    default: () => null,
  }),
  
  // 动态传导网络（新架构）
  propagationNetwork: Annotation<any | null>({
    reducer: (_, x) => x ?? null,
    default: () => null,
  }),
  
  // 结构化数据输出
  timeline: Annotation<TimelineEvent[]>({
    reducer: (_, x) => x,
    default: () => [],
  }),
  causalChain: Annotation<CausalChainNode[]>({
    reducer: (_, x) => x,
    default: () => [],
  }),
  keyFactors: Annotation<KeyFactor[]>({
    reducer: (_, x) => x,
    default: () => [],
  }),
  scenarios: Annotation<ScenarioNode[]>({
    reducer: (_, x) => x,
    default: () => [],
  }),
  
  // 事件图谱
  eventGraph: Annotation<any>({
    reducer: (_, x) => x,
    default: () => null,
  }),
  
  // 最终报告
  finalReport: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // 执行状态
  currentAgent: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  completedAgents: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  
  // ========== v2.0新架构新增状态 ==========
  
  // 事件抽取器输出
  extractedEvents: Annotation<Array<{
    name: string;
    time?: string;
    entities?: string[];
    type?: string;
    summary?: string;
  }>>({
    reducer: (_, x) => x,
    default: () => [],
  }),
  eventExtractorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // 结果验证器输出
  validationResults: Annotation<{
    passed: boolean;
    issues: string[];
    suggestions: string[];
    confidence?: number;
  }>({
    reducer: (_, x) => x ?? { passed: true, issues: [], suggestions: [] },
    default: () => ({ passed: true, issues: [], suggestions: [] }),
  }),
  resultValidatorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // 文档执行器输出
  documentExecutorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  documentStored: Annotation<boolean>({
    reducer: (_, x) => x ?? false,
    default: () => false,
  }),
  storagePath: Annotation<string>({
    reducer: (_, x) => x ?? '',
    default: () => '',
  }),
  
  // 执行监控器输出
  qualityCheck: Annotation<{
    completed: boolean;
    totalAgents: number;
    completedCount: number;
    missingAgents: string[];
    timestamp?: string;
  }>({
    reducer: (_, x) => x ?? { completed: false, totalAgents: 0, completedCount: 0, missingAgents: [] },
    default: () => ({ completed: false, totalAgents: 0, completedCount: 0, missingAgents: [] }),
  }),
  executionMonitorOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),

  
  // 任务复杂度评估
  taskComplexity: Annotation<TaskComplexity>({
    reducer: (_, x) => x ?? 'moderate',
    default: () => 'moderate',
  }),
  
  // 智能体调度决策（编排思维：选择需要的智能体）
  agentSchedule: Annotation<AgentSchedule | null>({
    reducer: (_, x) => x ?? null,
    default: () => null,
  }),
  
  // 下一个要执行的节点（用于条件路由）
  next: Annotation<string>({
    reducer: (_, x) => x ?? '__end__',
    default: () => '__end__',
  }),
  
  // 错误状态
  errors: Annotation<AgentError[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  
  // 回退策略配置
  fallbackStrategies: Annotation<FallbackStrategy[]>({
    reducer: (_, x) => x,
    default: () => DEFAULT_FALLBACK_STRATEGIES,
  }),
  
  // 是否有错误
  hasErrors: Annotation<boolean>({
    reducer: (_, x) => x,
    default: () => false,
  }),
  
  // ========== 循环与动态调度相关 ==========
  
  // 当前循环次数
  iterationCount: Annotation<number>({
    reducer: (_, x) => x ?? 0,
    default: () => 0,
  }),
  
  // 最大循环次数（防止无限循环）
  maxIterations: Annotation<number>({
    reducer: (_, x) => x ?? 3,
    default: () => 3,
  }),
  
  // 质量检查发现的问题
  qualityIssues: Annotation<QualityIssue[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  
  // 修正历史
  revisionHistory: Annotation<RevisionRecord[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  
  // 是否需要修正
  needsRevision: Annotation<boolean>({
    reducer: (_, x) => x ?? false,
    default: () => false,
  }),
  
  // 需要修正的目标智能体
  revisionTarget: Annotation<string>({
    reducer: (_, x) => x ?? '',
    default: () => '',
  }),
  
  // 修正原因
  revisionReason: Annotation<string>({
    reducer: (_, x) => x ?? '',
    default: () => '',
  }),
  
  // 整体质量分数
  overallScore: Annotation<number>({
    reducer: (_, x) => x ?? 0.7,
    default: () => 0.7,
  }),
  
  // ========== 聊天与反馈相关 ==========
  
  // 聊天消息历史（用于智能问答）
  chatMessages: Annotation<ChatMessage[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  
  // 当前用户输入（问题或反馈）
  userFeedback: Annotation<string>({
    reducer: (_, x) => x ?? '',
    default: () => '',
  }),
  
  // 反馈类型
  feedbackType: Annotation<FeedbackType>({
    reducer: (_, x) => x ?? 'question',
    default: () => 'question',
  }),
  
  // 反馈目标节点（需要重新执行的智能体）
  feedbackTarget: Annotation<string>({
    reducer: (_, x) => x ?? '',
    default: () => '',
  }),
  
  // 是否需要重新分析
  needsReanalysis: Annotation<boolean>({
    reducer: (_, x) => x ?? false,
    default: () => false,
  }),
  
  // Chat 智能体输出
  chatOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // ========== 进化体层相关 ==========
  
  // 记忆智能体输出
  memoryAgentOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // 复盘智能体输出
  reviewAgentOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // 策略优化输出（复盘智能体调用的优化机制）
  // 注：策略优化器是一个优化机制，不是智能体
  rlTrainerOutput: Annotation<string>({
    reducer: (_, x) => x,
    default: () => '',
  }),
  
  // 进化体层综合输出
  evolutionOutput: Annotation<EvolutionOutput | null>({
    reducer: (_, x) => x ?? null,
    default: () => null,
  }),
  
  // 案例ID（存储后分配）
  caseId: Annotation<string>({
    reducer: (_, x) => x ?? '',
    default: () => '',
  }),
  
  // 用户评分（1-5）
  userRating: Annotation<number>({
    reducer: (_, x) => x ?? 0,
    default: () => 0,
  }),
  
  // 分析阶段（用于控制工作流）
  analysisPhase: Annotation<AnalysisPhase>({
    reducer: (_, x) => x ?? 'initial',
    default: () => 'initial',
  }),
  
  // ========== 知识图谱相关 ==========
  
  // 知识图谱数据
  knowledgeGraph: Annotation<{
    entities: Array<{
      id: string;
      name: string;
      type: string;
      importance: number;
      description?: string;
      verified?: boolean;
    }>;
    relations: Array<{
      id: string;
      source_entity_id: string;
      target_entity_id: string;
      source_name?: string;
      target_name?: string;
      type: string;
      confidence: number;
      evidence?: string;
      verified?: boolean;
    }>;
  } | null>({
    reducer: (_, x) => x ?? null,
    default: () => null,
  }),
  
  // 知识图谱抽取状态
  kgExtractionStatus: Annotation<'pending' | 'extracting' | 'completed' | 'failed'>({
    reducer: (_, x) => x ?? 'pending',
    default: () => 'pending',
  }),
});

/**
 * 聊天消息类型
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    agentId?: string;
    feedbackType?: FeedbackType;
    targetNode?: string;
    action?: string;
  };
}

/**
 * 反馈类型
 */
export type FeedbackType = 
  | 'question'       // 普通问询
  | 'correction'     // 纠正错误
  | 'supplement'     // 补充信息
  | 'deep_dive'      // 深入分析
  | 'rerun';         // 重新执行

/**
 * 分析阶段
 */
export type AnalysisPhase = 
  | 'initial'        // 初始状态
  | 'analyzing'      // 分析中
  | 'completed'      // 分析完成
  | 'feedback'       // 等待反馈
  | 'chatting'       // 聊天交互中
  | 'reanalyzing';   // 重新分析中

/**
 * 质量问题类型
 */
export type QualityIssueType = 
  | 'insufficient_info'      // 信息不足
  | 'timeline_gap'           // 时间线断层
  | 'causal_contradiction'   // 因果矛盾
  | 'scenario_unreasonable'  // 场景不合理
  | 'factor_incomplete'      // 因素不完整
  | 'low_confidence'         // 置信度过低
  | 'missing_impact';        // 缺少影响分析

/**
 * 质量问题
 */
export interface QualityIssue {
  type: QualityIssueType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
  targetAgent: string;  // 需要修正的智能体
}

/**
 * 修正记录
 */
export interface RevisionRecord {
  iteration: number;
  targetAgent: string;
  issue: QualityIssue;
  timestamp: string;
  result: 'pending' | 'success' | 'failed' | 'skipped';
}

/**
 * 进化体层输出
 */
export interface EvolutionOutput {
  memoryOutput?: {
    caseId: string;
    similarCases: Array<{
      case: any;
      similarity: number;
      matchedAspects: string[];
    }>;
    recalledPatterns: string[];
    contextEnriched: boolean;
  };
  reviewOutput?: {
    caseId: string;
    reviewTimestamp: string;
    successFactors: string[];
    failureLessons: string[];
    improvements: Array<{
      target: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
      expectedImpact: string;
    }>;
    reusablePatterns: Array<{
      patternName: string;
      patternDescription: string;
      applicableScenarios: string[];
      implementation: string;
    }>;
    antiPatterns: Array<{
      patternName: string;
      description: string;
      avoidanceStrategy: string;
    }>;
    knowledgeNuggets: Array<{
      domain: string;
      insight: string;
      evidence: string;
      confidence: number;
    }>;
  };
  optimizationOutput?: {
    optimizations: Array<{
      optimizationId: string;
      timestamp?: string;
      target: string;
      type: 'prompt' | 'parameter' | 'workflow' | 'tool';
      description?: string;
      priority?: 'high' | 'medium' | 'low';
      autoApplicable?: boolean;
      expectedImpact?: string;
      status?: 'pending' | 'applied' | 'validated' | 'rejected';
    }>;
    appliedOptimizations: string[];
    pendingValidations: string[];
  };
}

/**
 * 状态类型导出
 */
export type AnalysisStateType = typeof AnalysisState.State;

// ============================================================================
// 五层混合架构新增类型定义（感知体、认知体、决策体、行动体、进化体）
// ============================================================================

/**
 * 地理位置类型
 */
export interface GeoLocation {
  name: string;
  type: 'country' | 'city' | 'region' | 'landmark' | 'water' | 'mountain';
  coordinates?: {
    lat: number;
    lng: number;
  };
  significance?: string;
  relatedEvents?: string[];
  importance?: number;
}

/**
 * 地理模式类型
 */
export interface GeoPatterns {
  mainRegions: string[];
  hotspots: string[];
  connections: GeoConnection[];
}

/**
 * 地理连接类型
 */
export interface GeoConnection {
  from: string;
  to: string;
  type: 'trade' | 'conflict' | 'cooperation' | 'flow';
  strength: number;
}

/**
 * 敏感性分析类型
 */
export interface SensitivityAnalysis {
  keyVariables: SensitivityVariable[];
  sensitivityMatrix: SensitivityMatrixItem[];
  vulnerabilities: Vulnerability[];
  stressTests: StressTest[];
  overallSensitivity: {
    score: number;
    level: 'high' | 'medium' | 'low';
    mainDrivers: string[];
    recommendations: string[];
  };
}

/**
 * 敏感性变量类型
 */
export interface SensitivityVariable {
  name: string;
  currentValue: string;
  range: {
    min: string;
    max: string;
    baseline: string;
  };
  sensitivity: number;
  description: string;
}

/**
 * 敏感性矩阵项
 */
export interface SensitivityMatrixItem {
  variable: string;
  scenario: string;
  impact: {
    direction: 'positive' | 'negative' | 'neutral';
    magnitude: string;
    probability: number;
  };
}

/**
 * 脆弱性类型
 */
export interface Vulnerability {
  node: string;
  trigger: string;
  consequence: string;
  severity: 'high' | 'medium' | 'low';
  mitigation: string;
}

/**
 * 压力测试类型
 */
export interface StressTest {
  scenario: string;
  assumptions: string[];
  results: string;
  systemRecovery: string;
}

/**
 * 行动建议类型
 */
export interface ActionAdvice {
  coreRecommendations: CoreRecommendation[];
  strategyMatrix: StrategyMatrixItem[];
  chinaPerspective: {
    opportunities: string[];
    challenges: string[];
    recommendedActions: string[];
  };
  riskAlerts: RiskAlert[];
  monitoringIndicators: MonitoringIndicator[];
}

/**
 * 核心建议类型
 */
export interface CoreRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  timeframe: string;
  actions: {
    step: number;
    action: string;
    responsible: string;
    resources: string;
  }[];
  expectedOutcome: string;
  risks: string[];
}

/**
 * 策略矩阵项
 */
export interface StrategyMatrixItem {
  scenario: string;
  conservativeStrategy: string;
  moderateStrategy: string;
  aggressiveStrategy: string;
  recommendedStrategy: 'moderate' | 'conservative' | 'aggressive';
  reasoning: string;
}

/**
 * 风险警报类型
 */
export interface RiskAlert {
  risk: string;
  probability: number;
  impact: 'high' | 'medium' | 'low';
  earlyWarning: string;
  mitigation: string;
}

/**
 * 监测指标类型
 */
export interface MonitoringIndicator {
  indicator: string;
  currentValue: string;
  threshold: string;
  frequency: string;
  source: string;
}

/**
 * 风险传导分析结果类型
 */
export interface RiskPropagationResult {
  paths: RiskPropagationPath[];
  strongestPath: RiskPropagationPath | null;
  overallRisk: number;
  recommendations: string[];
}

/**
 * 风险传导路径类型
 */
export interface RiskPropagationPath {
  id: string;
  name: string;
  sourceNode: string;
  targetNodes: string[];
  传导强度: number;
  传导时滞: string;
  传导机制: string;
  historicalCases?: string[];
}
