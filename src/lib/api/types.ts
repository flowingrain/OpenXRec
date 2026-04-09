/**
 * OpenXRec 对外 API 类型定义
 * 
 * 版本: v1.0.0
 * 
 * 提供统一的对外API接口类型
 */

// ============================================================================
// 通用类型
// ============================================================================

/**
 * API 响应包装
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: number;
    requestId: string;
    version: string;
  };
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;      // 页码，从1开始
  pageSize?: number;  // 每页数量，默认10
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// 推荐API类型
// ============================================================================

/**
 * 推荐请求
 */
export interface RecommendationRequest {
  /** 用户ID */
  userId: string;
  /** 会话ID（可选，用于会话记忆） */
  sessionId?: string;
  /** 推荐场景 */
  scenario: RecommendationScenario;
  /** 上下文信息 */
  context?: RecommendationContext;
  /** 推荐选项 */
  options?: RecommendationOptions;
}

/**
 * 推荐场景
 */
export type RecommendationScenario =
  | 'product_recommendation'
  | 'content_recommendation'
  | 'service_recommendation'
  | 'knowledge_recommendation'
  | 'investment_recommendation'
  | 'general';

/**
 * 推荐上下文
 */
export interface RecommendationContext {
  /** 当前查询/搜索词 */
  query?: string;
  /** 当前页面/位置 */
  currentPage?: string;
  /** 设备类型 */
  device?: 'mobile' | 'desktop' | 'tablet';
  /** 时间上下文 */
  timeContext?: {
    hour: number;
    dayOfWeek: number;
    isWeekend: boolean;
  };
  /** 位置上下文 */
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  /** 自定义上下文 */
  custom?: Record<string, any>;
}

/**
 * 推荐选项
 */
export interface RecommendationOptions {
  /** 返回数量，默认10 */
  topK?: number;
  /** 是否返回解释，默认true */
  withExplanation?: boolean;
  /** 是否启用多样性优化 */
  enableDiversity?: boolean;
  /** 多样性权重 (0-1) */
  diversityWeight?: number;
  /** 是否启用新颖性优化 */
  enableNovelty?: boolean;
  /** 新颖性权重 (0-1) */
  noveltyWeight?: number;
  /** 策略权重配置 */
  strategyWeights?: StrategyWeights;
  /** 过滤条件 */
  filters?: Record<string, any>;
  /** A/B测试ID */
  abTestId?: string;
}

/**
 * 策略权重配置
 */
export interface StrategyWeights {
  content_based?: number;     // 基于内容
  collaborative?: number;     // 协同过滤
  knowledge_based?: number;   // 知识图谱
  agent_based?: number;       // 智能体驱动
  causal_based?: number;      // 因果推断
}

/**
 * 推荐响应
 */
export interface RecommendationResponse {
  /** 推荐结果列表 */
  items: RecommendedItem[];
  /** 推荐策略 */
  strategy: string;
  /** 元数据 */
  metadata: {
    totalCandidates: number;
    selectedCount: number;
    diversityScore: number;
    noveltyScore: number;
    confidence: number;
    latency: number;
    /** 信息来源 */
    sources?: string[];
    /** 知识更新信息 */
    knowledgeUpdate?: {
      updated: number;
      newEntries: string[];
    };
    /** 会话信息 */
    sessionId?: string;
    sessionContext?: {
      hasHistory: boolean;
      messageCount: number;
    };
    /** 元认知信息 */
    metaCognition?: {
      /** 意图分析置信度 */
      intentConfidence: number;
      /** 校准后的意图置信度 */
      calibratedIntentConfidence?: number;
      /** 决策类型 */
      decision: 'high_confidence_search' | 'high_confidence_skip_search' | 'medium_confidence_verify' | 'low_confidence_force_search';
      /** 不确定因素 */
      uncertainty?: string;
      /** 判断来源：LLM或规则兜底 */
      source?: 'llm' | 'rule_fallback';
      /** 使用的阈值 */
      thresholds?: {
        high: number;
        low: number;
      };
      /** 反思信息 */
      reflection?: {
        intent?: {
          score: number;
          shouldTrust: boolean;
          adjustedConfidence: number;
        };
        recommendation?: {
          score: number;
          quality: 'high' | 'medium' | 'low';
          filteredCount: number;
        };
      };
    };
  };
  /** 整体解释 */
  overallExplanation?: string;
}

/**
 * 推荐项
 */
export interface RecommendedItem {
  /** 物品ID */
  id: string;
  /** 物品类型 */
  type: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description?: string;
  /** 推荐分数 (0-1) */
  score: number;
  /** 排名 */
  rank: number;
  /** 置信度 */
  confidence: number;
  /** 解释 */
  explanations: ItemExplanation[];
  /** 使用的策略 */
  strategies: string[];
  /** 来源：semantic_search | knowledge_base | web_search | llm_generated */
  source?: string;
  /** 物品属性 */
  attributes?: Record<string, any>;
  /** 缩略图 */
  thumbnail?: string;
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/**
 * 推荐解释
 */
export interface ItemExplanation {
  /** 解释类型 */
  type: 'feature_similarity' | 'behavioral' | 'causal' | 'knowledge_graph' | 'collaborative' | 'rule_based';
  /** 解释文本 */
  reason: string;
  /** 解释因素 */
  factors: ExplanationFactor[];
  /** 权重 */
  weight: number;
}

/**
 * 解释因素
 */
export interface ExplanationFactor {
  name: string;
  value: any;
  importance: number;
  category: 'user' | 'item' | 'context' | 'knowledge';
}

// ============================================================================
// 用户画像API类型
// ============================================================================

/**
 * 用户画像请求
 */
export interface UserProfileRequest {
  /** 用户ID */
  userId: string;
}

/**
 * 用户画像响应
 */
export interface UserProfileResponse {
  /** 用户ID */
  userId: string;
  /** 兴趣标签 */
  interests: string[];
  /** 偏好设置 */
  preferences: Record<string, any>;
  /** 统计信息 */
  statistics: {
    totalQueries: number;
    totalRecommendations: number;
    totalInteractions: number;
    positiveFeedback: number;
    negativeFeedback: number;
    avgSessionLength: number;
    lastActiveTime: number;
  };
  /** 用户画像向量 */
  embedding?: number[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

// ============================================================================
// 反馈API类型
// ============================================================================

/**
 * 反馈请求
 */
export interface FeedbackRequest {
  /** 用户ID */
  userId: string;
  /** 物品ID */
  itemId: string;
  /** 反馈类型 */
  feedbackType: 'view' | 'click' | 'like' | 'dislike' | 'purchase' | 'share' | 'rating';
  /** 评分 (1-5) */
  rating?: number;
  /** 上下文信息 */
  context?: {
    recommendationId?: string;
    position?: number;
    page?: string;
    device?: string;
    [key: string]: any;
  };
  /** 额外数据 */
  metadata?: Record<string, any>;
}

/**
 * 反馈响应
 */
export interface FeedbackResponse {
  /** 是否成功 */
  success: boolean;
  /** 反馈ID */
  feedbackId: string;
  /** 是否触发了配置更新 */
  configUpdated: boolean;
  /** 新的推荐配置（如果触发了更新） */
  newConfig?: StrategyWeights;
}

// ============================================================================
// 配置API类型
// ============================================================================

/**
 * 配置请求
 */
export interface ConfigRequest {
  /** 场景类型 */
  scenario?: RecommendationScenario;
  /** 用户ID（可选，用于个性化配置） */
  userId?: string;
}

/**
 * 配置响应
 */
export interface ConfigResponse {
  /** 当前配置 */
  config: {
    strategyWeights: StrategyWeights;
    diversityWeight: number;
    noveltyWeight: number;
    serendipityWeight: number;
    minScoreThreshold: number;
    maxResults: number;
  };
  /** 配置来源 */
  source: 'default' | 'scenario' | 'user' | 'ppo_optimized';
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 更新配置请求
 */
export interface UpdateConfigRequest {
  /** 场景类型 */
  scenario?: RecommendationScenario;
  /** 用户ID */
  userId?: string;
  /** 新配置 */
  config: Partial<ConfigResponse['config']>;
}

// ============================================================================
// PPO API类型
// ============================================================================

/**
 * PPO状态响应
 */
export interface PPOStateResponse {
  /** 模型状态 */
  modelState: {
    version: string;
    lastUpdated: number;
    totalSteps: number;
    totalEpisodes: number;
    avgReward: number;
    bestReward: number;
  };
  /** 缓冲区大小 */
  bufferSize: number;
  /** 是否就绪 */
  isReady: boolean;
  /** 自适应超参数状态 */
  adaptive?: {
    enabled: boolean;
    hyperparams: {
      learningRate: number;
      clipEpsilon: number;
      entropyCoef: number;
      gaeLambda: number;
      timestamp: number;
    };
    performance: {
      avgReward: number;
      avgLoss: number;
      avgKl: number;
      avgEntropy: number;
      trend: 'improving' | 'stable' | 'degrading';
      shouldStop: boolean;
    };
  };
}

/**
 * PPO动作请求
 */
export interface PPOActionRequest {
  /** 当前状态 */
  state: {
    userId: string;
    userFeatures: Record<string, number>;
    scenarioFeatures: Record<string, any>;
    historyStats: Record<string, number>;
    currentConfig: Record<string, any>;
  };
  /** 是否使用确定性策略 */
  deterministic?: boolean;
}

/**
 * PPO动作响应
 */
export interface PPOActionResponse {
  /** 推荐的动作 */
  action: {
    strategyWeights: StrategyWeights;
    diversityWeight: number;
    noveltyWeight: number;
    serendipityWeight: number;
    minScoreThreshold: number;
  };
  /** 是否使用确定性策略 */
  deterministic: boolean;
}

/**
 * PPO训练请求
 */
export interface PPOTrainRequest {
  /** 训练轮数 */
  epochs?: number;
  /** 批次大小 */
  batchSize?: number;
}

/**
 * PPO训练响应
 */
export interface PPOTrainResponse {
  /** 是否成功 */
  success: boolean;
  /** 训练指标 */
  metrics: {
    epochs: number;
    avgPolicyLoss: number;
    avgValueLoss: number;
    avgReward: number;
    improvement: number;
  };
}

// ============================================================================
// 批量API类型
// ============================================================================

/**
 * 批量推荐请求
 */
export interface BatchRecommendationRequest {
  /** 批量请求 */
  requests: RecommendationRequest[];
}

/**
 * 批量推荐响应
 */
export interface BatchRecommendationResponse {
  /** 批量结果 */
  results: RecommendationResponse[];
  /** 失败的请求索引 */
  failedIndexes: number[];
}

// ============================================================================
// 健康检查类型
// ============================================================================

/**
 * 健康检查响应
 */
export interface HealthCheckResponse {
  /** 服务状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 版本信息 */
  version: string;
  /** 组件状态 */
  components: {
    database: ComponentHealth;
    vectorStore: ComponentHealth;
    llm: ComponentHealth;
    ppo: ComponentHealth;
  };
  /** 运行时间（秒） */
  uptime: number;
}

/**
 * 组件健康状态
 */
export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}
