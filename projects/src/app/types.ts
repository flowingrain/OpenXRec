// 类型定义文件

export interface LayerData {
  layer: number;
  message?: string;
  data?: any;
  observability?: LayerObservability;
}

export interface LayerObservability {
  layer: number;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputPreview: string;
  outputPreview: string;
  model: string;
  temperature: number;
  success: boolean;
  error?: string;
}

export interface ObservabilitySummary {
  layers: LayerObservability[];
  totalDuration: number;
  totalTokens: number;
  summary: {
    isChainArchitecture: boolean;
    architectureType: string;
    modelUsed: string;
    layersCount: number;
    avgLayerDuration: number;
  };
}

export interface AnalysisState {
  stage: string;
  message: string;
  progress: number;
  layers: LayerData[];
  completeData: any;
  error?: string;
  observability?: ObservabilitySummary;
  eventGraph?: any;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  layer: string;
  layerColor: string;
}

// Agent 名称映射（五层架构 + 独立调度层）
export const agentNameMap: Record<string, string> = {
  // ========== 调度层 ==========
  'intent_parser': '意图解析器',
  'coordinator': '协调器',
  'goal_manager': '目标管理器',
  
  // ========== 感知体层 ==========
  'scout_cluster': '侦察兵集群',
  'event_extractor': '事件抽取器',
  'quality_evaluator': '质量评估器',
  'geo_extractor': '地理抽取器',
  
  // ========== 认知体层 ==========
  'timeline_analyst': '时序分析师',
  'causal_analyst': '因果分析师',
  'knowledge_extractor': '知识抽取器',
  'result_validator': '结果验证器',
  
  // ========== 决策体层 ==========
  'scenario_simulator': '场景推演器',
  'sensitivity_analyst': '敏感性分析师',
  'action_advisor': '行动建议器',
  
  // ========== 行动体层 ==========
  'report_generator': '报告生成器',
  'document_executor': '文档执行器',
  'quality_controller': '质量控制器',
  'execution_monitor': '执行监控器',
  
  // ========== 进化体层 ==========
  'knowledge_manager': '知识管理器',
  'review_analyst': '复盘分析师'
};

// 层级名称映射
export const layerNameMap: Record<number, string> = {
  1: '信息源采集',
  2: '时间线构建',
  3: '因果链分析',
  4: '关键因素识别',
  5: '场景推演',
  6: '结论输出'
};

// 层级颜色映射（五层架构 + 独立调度层）
export const layerColorMap: Record<string, string> = {
  '调度层': 'from-slate-500 to-slate-600',
  '感知体': 'from-blue-500 to-blue-600',
  '认知体': 'from-purple-500 to-purple-600',
  '决策体': 'from-orange-500 to-orange-600',
  '行动体': 'from-green-500 to-green-600',
  '进化体': 'from-pink-500 to-pink-600'
};

export const layerBgMap: Record<string, string> = {
  '调度层': 'from-slate-50 to-slate-100 border-slate-400',
  '感知体': 'from-blue-50 to-blue-100 border-blue-400',
  '认知体': 'from-purple-50 to-purple-100 border-purple-400',
  '决策体': 'from-orange-50 to-orange-100 border-orange-400',
  '行动体': 'from-green-50 to-green-100 border-green-400',
  '进化体': 'from-pink-50 to-pink-100 border-pink-400'
};
