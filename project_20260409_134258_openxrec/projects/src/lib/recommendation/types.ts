/**
 * 通用多智能体可解释推荐框架 - 核心类型定义
 *
 * 设计理念：
 * 1. 可解释性优先 - 每个推荐结果都必须附带可解释的理由
 * 2. 多智能体协作 - 利用多智能体进行特征提取、推理、排序
 * 3. 领域无关 - 核心逻辑与具体领域解耦
 * 4. 可扩展性 - 支持多种推荐算法和策略
 */

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 推荐场景类型
 */
export type RecommendationScenario =
  | 'product_recommendation'      // 商品推荐
  | 'content_recommendation'      // 内容推荐（文章、视频）
  | 'service_recommendation'      // 服务推荐
  | 'risk_recommendation'         // 风险推荐（当前项目）
  | 'investment_recommendation'   // 投资推荐
  | 'travel_recommendation'      // 旅游推荐
  | 'career_recommendation'      // 职业推荐
  | 'general_recommendation';     // 通用推荐

/**
 * 推荐策略类型
 */
export type RecommendationStrategy =
  | 'content_based'       // 基于内容
  | 'collaborative'       // 协同过滤
  | 'hybrid'             // 混合推荐
  | 'knowledge_based'    // 知识图谱驱动
  | 'agent_based'        // 智能体驱动（当前项目特色）
  | 'causal_based';      // 因果推断驱动（当前项目特色）

/**
 * 推荐对象类型（可以是任何东西：商品、文章、视频、服务等）
 */
export interface RecommendationItem {
  id: string;
  type: string;  // 物品类型，如 'product', 'article', 'video', 'service' 等
  title: string;
  description?: string;
  attributes: Record<string, any>;  // 动态属性，支持不同领域的物品
  embeddings?: number[];            // 向量表示（可选）
  metadata?: Record<string, any>;   // 额外的元数据
}

/**
 * 用户画像
 */
export interface UserProfile {
  userId: string;
  demographics?: {
    age?: number;
    gender?: string;
    location?: string;
    education?: string;
    occupation?: string;
  };
  interests: string[];              // 兴趣标签
  preferences: Record<string, any>; // 偏好设置
  behaviorHistory: UserBehavior[];  // 行为历史
  embeddings?: number[];            // 用户向量表示
  knowledgeGraph?: UserKG;          // 用户知识图谱
  createdAt?: number;               // 创建时间
  updatedAt?: number;               // 更新时间
}

/**
 * 用户行为
 */
export interface UserBehavior {
  itemId: string;
  action: 'view' | 'click' | 'like' | 'dislike' | 'purchase' | 'share' | 'comment' | 'rating';
  rating?: number;  // 评分（1-5）
  timestamp: number;
  context?: Record<string, any>;    // 行为上下文（如设备、时间等）
  duration?: number;  // 持续时间（如阅读时长、观看时长）
}

/**
 * 用户知识图谱节点
 */
export interface UserKG {
  nodes: UserKGNode[];
  edges: UserKGEdge[];
}

export interface UserKGNode {
  id: string;
  type: 'interest' | 'preference' | 'behavior' | 'attribute';
  label: string;
  weight: number;
  attributes?: Record<string, any>;
}

export interface UserKGEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

// ============================================================================
// 推荐结果定义
// ============================================================================

/**
 * 推荐结果（带解释）
 */
export interface RecommendationResult {
  item: RecommendationItem;
  score: number;  // 推荐分数（0-1）
  rank: number;   // 排序位置
  explanations: RecommendationExplanation[];  // 可解释性信息
  confidence: number;  // 置信度（0-1）
  strategy: RecommendationStrategy;  // 使用的推荐策略
  agents: string[];  // 参与的智能体
  timestamp: number;
}

/**
 * 推荐解释（可解释性核心）
 */
export interface RecommendationExplanation {
  type: 'feature_similarity' | 'behavioral' | 'causal' | 'knowledge_graph' | 'collaborative' | 'rule_based';
  reason: string;  // 自然语言解释
  factors: ExplanationFactor[];  // 具体因素
  weight: number;  // 该解释的权重（0-1）
  evidence?: any[];  // 支持证据
}

/**
 * 解释因素
 */
export interface ExplanationFactor {
  name: string;
  value: any;
  importance: number;  // 重要程度（0-1）
  category: 'user' | 'item' | 'context' | 'knowledge';
}

/**
 * 推荐请求
 */
export interface RecommendationRequest {
  userId: string;
  scenario: RecommendationScenario;
  strategy?: RecommendationStrategy;
  limit: number;  // 返回数量
  filters?: RecommendationFilter[];  // 过滤条件
  context?: RecommendationContext;  // 推荐上下文
  options?: RecommendationOptions;  // 可选参数
}

/**
 * 推荐过滤条件
 */
export interface RecommendationFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'contains';
  value: any;
}

/**
 * 推荐上下文
 */
export interface RecommendationContext {
  query: string;  // 用户查询
  time: number;
  device?: string;
  location?: string;
  session?: {
    sessionId: string;
    previousItems?: string[];
    previousActions?: string[];
  };
  weather?: any;
  social?: any;
}

/**
 * 推荐选项
 */
export interface RecommendationOptions {
  enableExplanation: boolean;  // 是否生成解释
  enableDiversity: boolean;    // 是否启用多样性
  diversityWeight?: number;    // 多样性权重（0-1）
  enableNovelty: boolean;      // 是否启用新颖性
  noveltyWeight?: number;      // 新颖性权重（0-1）
  enableSerendipity: boolean;  // 是否启用惊喜性
  serendipityWeight?: number;  // 惊喜性权重（0-1）
  enableCausalExplanation: boolean;  // 是否启用因果解释
  enableKGExplanation: boolean;      // 是否启用知识图谱解释
  abTestId?: string;  // A/B测试ID
}

// ============================================================================
// 推荐引擎接口
// ============================================================================

/**
 * 推荐引擎接口
 */
export interface RecommendationEngine {
  /**
   * 生成推荐
   */
  recommend(request: RecommendationRequest): Promise<RecommendationResult[]>;

  /**
   * 更新用户画像
   */
  updateUserProfile(userId: string, behavior: UserBehavior): Promise<void>;

  /**
   * 批量训练（离线）
   */
  train(options?: TrainingOptions): Promise<void>;

  /**
   * 获取推荐统计
   */
  getStats(userId: string): Promise<RecommendationStats>;
}

/**
 * 训练选项
 */
export interface TrainingOptions {
  startDate: Date;
  endDate: Date;
  batchSize?: number;
  epochs?: number;
  validationSplit?: number;
}

/**
 * 推荐统计
 */
export interface RecommendationStats {
  totalRecommendations: number;
  clickRate: number;
  conversionRate: number;
  averageRating: number;
  diversityScore: number;
  noveltyScore: number;
  strategyDistribution: Record<RecommendationStrategy, number>;
}

// ============================================================================
// 评估指标
// ============================================================================

/**
 * 推荐评估指标
 */
export interface RecommendationMetrics {
  precision: number;     // 精确率
  recall: number;        // 召回率
  ndcg: number;          // NDCG
  map: number;           // MAP
  diversity: number;     // 多样性
  novelty: number;       // 新颖性
  coverage: number;      // 覆盖率
  serendipity: number;   // 惊喜性
  explainability: number; // 可解释性分数
}

/**
 * 评估数据集
 */
export interface EvaluationDataset {
  testCases: EvaluationTestCase[];
}

export interface EvaluationTestCase {
  userId: string;
  context: RecommendationContext;
  groundTruth: string[];  // 真实喜欢的物品ID
  candidates: string[];   // 候选物品ID
}

// ============================================================================
// A/B测试
// ============================================================================

/**
 * A/B测试配置
 */
export interface ABTestConfig {
  testId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  variants: ABTestVariant[];
  trafficSplit: number[];  // 流量分配（和为1）
  metrics: string[];  // 评估指标
  status: 'draft' | 'running' | 'completed' | 'paused';
}

/**
 * A/B测试变体
 */
export interface ABTestVariant {
  variantId: string;
  name: string;
  strategy: RecommendationStrategy;
  config: Record<string, any>;
}

/**
 * A/B测试结果
 */
export interface ABTestResult {
  testId: string;
  variantId: string;
  metrics: Record<string, number>;
  improvement: Record<string, number>;  // 相对基线的提升
  significance: Record<string, number>;  // 统计显著性
  winner: boolean;
}

// ============================================================================
// 智能体相关
// ============================================================================

/**
 * 推荐智能体类型
 */
export type RecommendationAgentType =
  | 'user_profiler'        // 用户画像智能体
  | 'item_profiler'        // 物品画像智能体
  | 'intent_analyzer'      // 意图分析智能体
  | 'candidate_generator'  // 候选生成智能体
  | 'feature_extractor'    // 特征提取智能体
  | 'similarity_calculator' // 相似度计算智能体
  | 'ranking_agent'        // 排序智能体
  | 'explanation_generator' // 解释生成智能体
  | 'causal_reasoner'      // 因果推理智能体
  | 'kg_reasoner'          // 知识图谱推理智能体
  | 'kg_builder'           // 知识图谱构建智能体
  | 'knowledge_extractor'  // 知识抽取智能体
  | 'diversity_optimizer'  // 多样性优化智能体
  | 'novelty_detector'     // 新颖性检测智能体
  | 'template_renderer'    // 模板渲染智能体
  | 'config_optimizer'     // 配置优化智能体
  | 'feedback_collector'  // 反馈收集智能体

/**
 * 推荐智能体配置
 */
export interface RecommendationAgentConfig {
  type: RecommendationAgentType;
  name: string;
  description: string;
  llmModel?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];  // 可用工具
  capabilities: AgentCapability[];
}

/**
 * 智能体能力
 */
export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
}

// ============================================================================
// 工具函数类型
// ============================================================================

/**
 * 相似度计算函数
 */
export type SimilarityFunction = (a: number[], b: number[]) => number;

/**
 * 排序函数
 */
export type RankingFunction = (
  items: RecommendationItem[],
  userProfile: UserProfile,
  context: RecommendationContext
) => Promise<RecommendationItem[]>;

/**
 * 解释生成函数
 */
export type ExplanationFunction = (
  item: RecommendationItem,
  userProfile: UserProfile,
  score: number,
  factors: ExplanationFactor[]
) => Promise<RecommendationExplanation>;
