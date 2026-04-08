/**
 * 智能更新检测系统 - 入口文件
 * 
 * 统一导出所有模块
 */

// 类型定义
export * from './types';

// 智能更新检测服务
export {
  IntelligentUpdateService,
  getIntelligentUpdateService,
  createIntelligentUpdateService,
} from './detection-service';

// 版本管理服务
export {
  KnowledgeVersionManager,
  getVersionManager,
  createVersionManager,
} from './version-manager';

// 知识生命周期管理服务
export {
  KnowledgeLifecycleService,
  getKnowledgeLifecycleService,
  createKnowledgeLifecycleService,
} from './lifecycle-service';

// 类型导出
export type {
  KnowledgeLifecycleState,
  LifecycleEvent,
  EnhancedTimeSensitivityConfig,
  IncrementalUpdateRequest,
  IncrementalUpdateResult,
  FieldChange,
} from './lifecycle-service';
