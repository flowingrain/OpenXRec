/**
 * 通用多智能体可解释推荐框架
 *
 * 统一导出模块
 */

// ============================================================================
// 核心类型
// ============================================================================

export * from './types';

// ============================================================================
// 推荐引擎
// ============================================================================

export {
  UniversalRecommendationEngine,
  getRecommendationEngine
} from './engine';

// ============================================================================
// 智能体系统
// ============================================================================

export {
  RECOMMENDATION_AGENT_NODES,
  userProfilerNode,
  itemProfilerNode,
  featureExtractorNode,
  similarityCalculatorNode,
  rankingAgentNode,
  explanationGeneratorNode,
  causalReasonerNode,
  kgReasonerNode,
  diversityOptimizerNode,
  noveltyDetectorNode,
} from './agents-nodes';

export { buildRecommendationGraph, recommendationGraph, RecommendationStateAnnotation } from './agents-graph';

// ============================================================================
// 智能体推荐服务
// ============================================================================

export {
  AgentRecommendationService,
  getAgentRecommendationService,
  type AgentRecommendationResult,
  type AgentRecommendationItem,
  type AgentServiceConfig,
} from './agent-recommendation-service';

// ============================================================================
// 评估模块
// ============================================================================

export {
  RecommendationEvaluator,
  ABTestManager,
  OfflineEvaluator,
  abTestManager
} from './evaluation';

// ============================================================================
// 序列推荐（智能体驱动）
// ============================================================================

export {
  SequenceAnalysisAgent,
  BaselineSequenceRecommender
} from './sequential-agent';

export type {
  BehaviorSequence,
  Behavior,
  SequencePattern,
  SequenceAnalysis,
  SequenceRecommendation
} from './sequential-agent';

// ============================================================================
// 高级策略
// ============================================================================

export {
  SequentialRecommender,
  MultiBehaviorRecommender,
  AdvancedHybridRecommender,
  DEFAULT_BEHAVIOR_WEIGHTS
} from './advanced-strategies';

export type {
  SequenceWindow,
  BehaviorWeights
} from './advanced-strategies';

// ============================================================================
// 领域配置
// ============================================================================

export {
  RECOMMENDATION_DOMAIN_TYPE
} from './domain-config';

// ============================================================================
// 动态配置系统
// ============================================================================

export {
  ConfigurationAgent,
  FeedbackLoopManager,
  DEFAULT_DYNAMIC_CONFIGURATION
} from './dynamic-config';

export type {
  DynamicConfiguration,
  UserFeedback,
  FeedbackStats,
  StrategyWeights,
  QualityControlConfig
} from './dynamic-config';

export {
  ConfigurationStage
} from './dynamic-config';
