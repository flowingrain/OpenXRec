/**
 * 知识持久化模块入口
 * 
 * 导出所有公共API
 */

// 类型
export * from './types';

// 存储
export { 
  SupabaseKnowledgeStorage,
  getKnowledgeStorage,
  createKnowledgeStorage,
} from './storage';

// 时效性清理
export { 
  KnowledgeCleanupService,
  getKnowledgeCleanupService,
  createKnowledgeCleanupService,
} from './cleanup';

// 冲突检测
export { 
  ConflictDetectionService,
  getConflictDetectionService,
  createConflictDetectionService,
} from './conflict';

// 专家审核
export { 
  ExpertReviewService,
  getExpertReviewService,
  createExpertReviewService,
} from './expert-review';

// 管理器
export { 
  KnowledgePersistenceManager,
  getKnowledgePersistenceManager,
  createKnowledgePersistenceManager,
} from './manager';
