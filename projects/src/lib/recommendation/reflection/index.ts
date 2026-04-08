/**
 * 反思机制集成模块
 * 
 * 将反思机制集成到推荐流程的各个阶段
 */

export * from './types';
export { getReflectionService, ReflectionService } from './types';
export { 
  ReflectionEnhancedService, 
  getReflectionEnhancedService,
  type EnhancedIntentAnalysis,
  type EnhancedRecommendation,
  type FeedbackLoopResult,
} from './enhanced-service';
