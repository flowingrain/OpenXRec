// 图谱节点类型定义

export interface GraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  animated?: boolean;
}

export interface EventGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// 时间线事件
export interface TimelineEvent {
  label: string;
  date: string;
  description: string;
  source?: string;
  url?: string;
}

// 因果关系
export interface CausalRelation {
  label: string;
  cause: string;
  effect: string;
  confidence: number;
}

// 关键因素
export interface KeyFactor {
  name: string;
  description: string;
  impact: '高' | '中' | '低';
  trend: '上升' | '平稳' | '下降' | '波动';
  evidence: string;
}

// 场景推演
export interface Scenario {
  label: string;
  type: 'optimistic' | 'neutral' | 'pessimistic';
  description: string;
  probability: number;
  keyEvents: string[];
  timeFrame: string;
}

// 可观测性指标
export interface Observable {
  label: string;
  metric: string;
  currentValue: string;
  threshold: string;
  status: '正常' | '警告' | '危险';
  trend: string;
}

// 搜索结果项
export interface SearchItem {
  title?: string;
  url?: string;
  siteName?: string;
  publishTime?: string;
  authorityLevel?: number;
  snippet?: string;
  content?: string;
}

// 搜索结果
export interface SearchResults {
  items?: SearchItem[];
  summary?: string;
}
