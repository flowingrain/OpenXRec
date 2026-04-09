/**
 * 协同过滤网络可视化类型定义
 * 
 * 用于构建用户-物品关系图，展示协同过滤推荐过程
 */

// ============================================================================
// 节点类型
// ============================================================================

/**
 * 网络节点类型
 */
export type NetworkNodeType = 'user' | 'item' | 'category' | 'tag';

/**
 * 网络节点
 */
export interface NetworkNode {
  // 基础信息
  id: string;
  label: string;
  type: NetworkNodeType;
  
  // 可视化属性
  group?: string;              // 分组（用于着色）
  value?: number;              // 节点大小权重
  color?: string;              // 自定义颜色
  shape?: 'circle' | 'box' | 'diamond' | 'star' | 'triangle';
  size?: number;
  
  // 元数据
  metadata?: {
    userId?: string;
    itemId?: string;
    category?: string;
    tags?: string[];
    rating?: number;
    interactions?: number;
    popularity?: number;
  };
  
  // 高亮状态
  highlighted?: boolean;
  selected?: boolean;
}

/**
 * 用户节点
 */
export interface UserNode extends NetworkNode {
  type: 'user';
  metadata: {
    userId: string;
    username?: string;
    activeLevel?: number;       // 活跃度
    diversityPreference?: number;
    interactionCount?: number;
  };
}

/**
 * 物品节点
 */
export interface ItemNode extends NetworkNode {
  type: 'item';
  metadata: {
    itemId: string;
    title?: string;
    category?: string;
    tags?: string[];
    avgRating?: number;
    popularity?: number;
  };
}

// ============================================================================
// 边类型
// ============================================================================

/**
 * 网络边类型
 */
export type NetworkEdgeType = 
  | 'interaction'     // 用户-物品交互（购买、点击、评分等）
  | 'similarity'      // 用户-用户或物品-物品相似度
  | 'recommendation'  // 推荐关系
  | 'category'        // 物品-分类关系
  | 'tag';            // 物品-标签关系

/**
 * 网络边
 */
export interface NetworkEdge {
  // 基础信息
  id: string;
  from: string;
  to: string;
  type: NetworkEdgeType;
  
  // 可视化属性
  label?: string;
  value?: number;              // 边的粗细权重
  color?: string;
  width?: number;
  dashes?: boolean;
  arrows?: 'to' | 'from' | 'middle' | boolean;
  
  // 元数据
  metadata?: {
    interactionType?: 'purchase' | 'click' | 'rating' | 'view';
    similarityScore?: number;
    recommendationScore?: number;
    confidence?: number;
    timestamp?: number;
  };
  
  // 高亮状态
  highlighted?: boolean;
}

/**
 * 用户-物品交互边
 */
export interface InteractionEdge extends NetworkEdge {
  type: 'interaction';
  metadata: {
    interactionType: 'purchase' | 'click' | 'rating' | 'view';
    rating?: number;
    timestamp?: number;
  };
}

/**
 * 相似度边
 */
export interface SimilarityEdge extends NetworkEdge {
  type: 'similarity';
  metadata: {
    similarityScore: number;
    method?: 'cosine' | 'pearson' | 'jaccard';
    commonItems?: number;       // 共同物品数
  };
}

/**
 * 推荐边
 */
export interface RecommendationEdge extends NetworkEdge {
  type: 'recommendation';
  metadata: {
    recommendationScore: number;
    confidence: number;
    reason?: string;
    strategy?: 'collaborative' | 'content_based' | 'hybrid';
  };
}

// ============================================================================
// 网络数据
// ============================================================================

/**
 * 网络数据
 */
export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  
  // 统计信息
  stats: NetworkStatistics;
  
  // 元数据
  metadata: {
    userId?: string;
    scenario?: string;
    depth?: number;
    generatedAt: number;
    expiresAt?: number;
  };
}

/**
 * 网络配置
 */
export interface NetworkConfig {
  // 数据过滤
  userId?: string;
  scenario?: string;
  depth: number;               // 关系深度（1-3）
  maxNodes: number;            // 最大节点数
  maxEdges: number;            // 最大边数
  
  // 过滤阈值
  minSimilarity: number;       // 最小相似度
  minInteraction: number;      // 最小交互次数
  minRecommendationScore: number;
  
  // 包含的类型
  includeInteractions: boolean;
  includeSimilarities: boolean;
  includeRecommendations: boolean;
  includeCategories: boolean;
  includeTags: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  depth: 2,
  maxNodes: 100,
  maxEdges: 500,
  minSimilarity: 0.3,
  minInteraction: 1,
  minRecommendationScore: 0.5,
  includeInteractions: true,
  includeSimilarities: true,
  includeRecommendations: true,
  includeCategories: false,
  includeTags: false,
};

// ============================================================================
// 可视化配置
// ============================================================================

/**
 * 节点样式配置
 */
export interface NodeStyleConfig {
  // 用户节点
  user: {
    color: string;
    shape: 'circle' | 'box' | 'diamond';
    size: number;
    borderWidth: number;
    borderColor: string;
  };
  
  // 物品节点
  item: {
    color: string;
    shape: 'circle' | 'box' | 'diamond';
    size: number;
    borderWidth: number;
    borderColor: string;
  };
  
  // 分类节点
  category: {
    color: string;
    shape: 'circle' | 'box' | 'diamond';
    size: number;
    borderWidth: number;
    borderColor: string;
  };
  
  // 标签节点
  tag: {
    color: string;
    shape: 'circle' | 'box' | 'diamond';
    size: number;
    borderWidth: number;
    borderColor: string;
  };
}

/**
 * 默认节点样式
 */
export const DEFAULT_NODE_STYLE: NodeStyleConfig = {
  user: {
    color: '#4A90E2',
    shape: 'circle',
    size: 25,
    borderWidth: 2,
    borderColor: '#2E5B8B',
  },
  item: {
    color: '#7ED321',
    shape: 'box',
    size: 20,
    borderWidth: 2,
    borderColor: '#5A9A18',
  },
  category: {
    color: '#BD10E0',
    shape: 'diamond',
    size: 15,
    borderWidth: 1,
    borderColor: '#8B0AA8',
  },
  tag: {
    color: '#F5A623',
    shape: 'circle',
    size: 12,
    borderWidth: 1,
    borderColor: '#C07D0A',
  },
};

/**
 * 边样式配置
 */
export interface EdgeStyleConfig {
  // 交互边
  interaction: {
    color: string;
    width: number;
    dashes: boolean;
    opacity: number;
  };
  
  // 相似度边
  similarity: {
    color: string;
    width: number;
    dashes: boolean;
    opacity: number;
  };
  
  // 推荐边
  recommendation: {
    color: string;
    width: number;
    dashes: boolean;
    opacity: number;
  };
}

/**
 * 默认边样式
 */
export const DEFAULT_EDGE_STYLE: EdgeStyleConfig = {
  interaction: {
    color: '#888888',
    width: 1,
    dashes: false,
    opacity: 0.6,
  },
  similarity: {
    color: '#9B9B9B',
    width: 1,
    dashes: true,
    opacity: 0.4,
  },
  recommendation: {
    color: '#FF6B35',
    width: 3,
    dashes: false,
    opacity: 0.9,
  },
};

// ============================================================================
// 图布局配置
// ============================================================================

/**
 * 布局类型
 */
export type LayoutType = 
  | 'force-directed'    // 力导向布局
  | 'hierarchical'      // 层次布局
  | 'circular'          // 环形布局
  | 'grid';             // 网格布局

/**
 * 布局配置
 */
export interface LayoutConfig {
  type: LayoutType;
  
  // 力导向参数
  physics?: {
    enabled: boolean;
    barnesHut?: {
      gravitationalConstant: number;
      centralGravity: number;
      springLength: number;
      springConstant: number;
      damping: number;
    };
    repulsion?: {
      nodeDistance: number;
      centralGravity: number;
      springLength: number;
      springConstant: number;
    };
  };
  
  // 层次布局参数
  hierarchical?: {
    direction: 'UD' | 'DU' | 'LR' | 'RL';  // 上下、下上、左右、右左
    sortMethod: 'hubsize' | 'directed';
    levelSeparation: number;
    nodeSpacing: number;
    treeSpacing: number;
  };
}

/**
 * 默认布局配置
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  type: 'force-directed',
  physics: {
    enabled: true,
    barnesHut: {
      gravitationalConstant: -3000,
      centralGravity: 0.3,
      springLength: 100,
      springConstant: 0.05,
      damping: 0.5,
    },
  },
};

// ============================================================================
// 交互事件
// ============================================================================

/**
 * 节点点击事件
 */
export interface NodeClickEvent {
  node: NetworkNode;
  position: { x: number; y: number };
  connectedNodes: string[];
  connectedEdges: string[];
}

/**
 * 边点击事件
 */
export interface EdgeClickEvent {
  edge: NetworkEdge;
  position: { x: number; y: number };
  fromNode: NetworkNode;
  toNode: NetworkNode;
}

/**
 * 网络统计
 */
export interface NetworkStatistics {
  // 基础统计
  nodeCount: number;
  edgeCount: number;
  
  // 度统计
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  
  // 聚类系数
  avgClusteringCoefficient: number;
  
  // 路径统计
  avgPathLength: number;
  diameter: number;
  
  // 中心性
  topDegreeNodes: Array<{ nodeId: string; degree: number }>;
  topBetweennessNodes: Array<{ nodeId: string; betweenness: number }>;
  
  // 社区
  communityCount: number;
  communities: Array<{ id: string; size: number; nodes: string[] }>;
}
