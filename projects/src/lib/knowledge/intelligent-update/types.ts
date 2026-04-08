/**
 * 智能更新检测系统 - 类型定义
 * 
 * 核心功能：
 * 1. 检测新信息与已有知识的关系类型
 * 2. 时效性检测与管理
 * 3. 增量更新机制
 * 4. 版本管理与回滚
 * 5. 智能合并策略
 */

import { KnowledgeEntry, KnowledgeType } from '../index';

// ==================== 更新类型定义 ====================

/**
 * 知识关系类型
 * 
 * 用于判断新信息与已有知识的关系
 */
export type KnowledgeRelationType =
  | 'new'           // 全新知识，无相似条目
  | 'update'        // 更新已有知识（时间序列数据，如营收、股价）
  | 'correction'    // 纠正已有知识（发现错误，需要修正）
  | 'supplement'    // 补充已有知识（扩展信息，不矛盾）
  | 'conflict';     // 真正的冲突，需要解决

/**
 * 更新检测结果
 */
export interface UpdateDetectionResult {
  /** 检测到的关系类型 */
  relationType: KnowledgeRelationType;
  
  /** 相似的已有知识条目 */
  relatedEntries: Array<{
    entry: KnowledgeEntry;
    similarity: number;
    relationType: KnowledgeRelationType;
    reasoning: string;
  }>;
  
  /** 建议的操作 */
  suggestedAction: SuggestedAction;
  
  /** 检测置信度 */
  confidence: number;
  
  /** 检测依据 */
  reasoning: string;
  
  /** 时间戳 */
  detectedAt: number;
}

/**
 * 建议的操作
 */
export interface SuggestedAction {
  /** 操作类型 */
  type: 'create' | 'update' | 'correct' | 'supplement' | 'merge' | 'conflict_resolve' | 'reject';
  
  /** 目标条目ID（更新/纠正/补充时） */
  targetId?: string;
  
  /** 操作说明 */
  description: string;
  
  /** 是否需要审核 */
  needsReview: boolean;
  
  /** 审核原因 */
  reviewReason?: string;
  
  /** 合并内容（合并操作时） */
  mergedContent?: string;
  
  /** 优先级 */
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// ==================== 时效性管理 ====================

/**
 * 时效性级别
 */
export type TimeSensitivityLevel = 'realtime' | 'high' | 'medium' | 'low' | 'permanent';

/**
 * 时效性配置
 */
export interface TimeSensitivityConfig {
  /** 各级别的过期时间（小时） */
  expiryHours: {
    realtime: number;   // 实时数据：分钟级
    high: number;       // 高时效：天级
    medium: number;     // 中时效：周级
    low: number;        // 低时效：月级
    permanent: number;  // 永久知识：不过期
  };
  
  /** 时效性关键词 */
  keywords: Record<TimeSensitivityLevel, string[]>;
  
  /** 时效性数据类型 */
  dataTypes: Record<TimeSensitivityLevel, KnowledgeType[]>;
}

/**
 * 默认时效性配置
 */
export const DEFAULT_TIME_SENSITIVITY_CONFIG: TimeSensitivityConfig = {
  expiryHours: {
    realtime: 1,          // 1小时
    high: 24,             // 1天
    medium: 168,          // 1周
    low: 720,             // 30天
    permanent: Infinity,  // 永不过期
  },
  keywords: {
    realtime: ['实时', '当前', '最新', '刚刚', '现在', '正在'],
    high: ['今天', '昨天', '本周', '最新', '近期', '股价', '汇率', '指数'],
    medium: ['本月', '上月', '季度', '新闻', '公告', '趋势', '预测'],
    low: ['年度', '历史', '长期', '定义', '原理', '基础'],
    permanent: ['定义', '概念', '理论', '公式', '原理', '常数'],
  },
  dataTypes: {
    realtime: ['market_data'],
    high: ['market_data', 'event'],
    medium: ['event', 'policy'],
    low: ['entity', 'economic_indicator'],
    permanent: ['entity', 'relationship'],
  },
};

/**
 * 时效性评估结果
 */
export interface TimeSensitivityAssessment {
  /** 时效性级别 */
  level: TimeSensitivityLevel;
  
  /** 过期时间 */
  expiresAt: number;
  
  /** 是否已过期 */
  isExpired: boolean;
  
  /** 距离过期的时间（毫秒） */
  timeToExpiry: number;
  
  /** 判断依据 */
  reasoning: string;
}

// ==================== 版本管理 ====================

/**
 * 知识版本
 */
export interface KnowledgeVersion {
  /** 版本ID */
  id: string;
  
  /** 知识条目ID */
  entryId: string;
  
  /** 版本号 */
  version: number;
  
  /** 版本内容快照 */
  snapshot: KnowledgeEntry;
  
  /** 变更类型 */
  changeType: 'create' | 'update' | 'correct' | 'supplement' | 'merge' | 'restore';
  
  /** 变更说明 */
  changeDescription: string;
  
  /** 变更来源 */
  changeSource: {
    type: 'user_input' | 'web_search' | 'llm_generated' | 'system_update' | 'version_restore';
    reference?: string;
    userId?: string;
  };
  
  /** 变更前后对比 */
  diff?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  
  /** 创建时间 */
  createdAt: number;
  
  /** 创建者 */
  createdBy: string;
  
  /** 是否为当前版本 */
  isCurrent: boolean;
  
  /** 标签 */
  tags: string[];
}

/**
 * 版本回滚请求
 */
export interface VersionRollbackRequest {
  /** 知识条目ID */
  entryId: string;
  
  /** 目标版本号 */
  targetVersion: number;
  
  /** 回滚原因 */
  reason: string;
  
  /** 操作者 */
  operator: string;
}

/**
 * 版本回滚结果
 */
export interface VersionRollbackResult {
  success: boolean;
  entryId: string;
  fromVersion: number;
  toVersion: number;
  newVersionId: string;
  message: string;
}

// ==================== 智能合并 ====================

/**
 * 合并策略
 */
export type MergeStrategy = 
  | 'keep_newer'           // 保留更新的内容
  | 'keep_higher_confidence' // 保留高置信度的
  | 'union'                // 合并所有不冲突的信息
  | 'intersect'            // 只保留一致的信息
  | 'llm_merge'            // 使用LLM智能合并
  | 'expert_review';       // 专家审核决定

/**
 * 合并请求
 */
export interface MergeRequest {
  /** 原知识条目 */
  original: KnowledgeEntry;
  
  /** 新知识内容 */
  newInfo: {
    title?: string;
    content?: string;
    metadata?: Partial<KnowledgeEntry['metadata']>;
  };
  
  /** 合并策略 */
  strategy: MergeStrategy;
  
  /** 冲突字段处理 */
  conflictResolution?: Record<string, 'keep_original' | 'keep_new' | 'merge'>;
}

/**
 * 合并结果
 */
export interface MergeResult {
  success: boolean;
  
  /** 合并后的条目 */
  mergedEntry?: KnowledgeEntry;
  
  /** 合并的字段 */
  mergedFields: string[];
  
  /** 保留的字段 */
  keptFields: string[];
  
  /** 冲突字段 */
  conflictedFields: Array<{
    field: string;
    originalValue: any;
    newValue: any;
    resolution: 'original' | 'new' | 'merged' | 'pending';
    mergedValue?: any;
  }>;
  
  /** 合并说明 */
  description: string;
}

// ==================== 更新检测配置 ====================

/**
 * 智能更新检测配置
 */
export interface IntelligentUpdateConfig {
  /** 是否启用智能更新检测 */
  enabled: boolean;
  
  /** 相似度阈值配置 */
  similarityThresholds: {
    /** 认为是同一知识的阈值 */
    sameKnowledge: number;
    /** 认为是相关知识的阈值 */
    relatedKnowledge: number;
    /** 认为是补充信息的阈值 */
    supplementThreshold: number;
  };
  
  /** 时效性配置 */
  timeSensitivity: TimeSensitivityConfig;
  
  /** 自动处理配置 */
  autoHandling: {
    /** 自动接受更新 */
    autoAcceptUpdates: boolean;
    /** 自动接受纠正 */
    autoAcceptCorrections: boolean;
    /** 自动合并补充 */
    autoMergeSupplements: boolean;
    /** 需要审核的置信度阈值 */
    reviewThreshold: number;
  };
  
  /** 版本管理配置 */
  versionManagement: {
    /** 启用版本管理 */
    enabled: boolean;
    /** 最大版本数 */
    maxVersions: number;
    /** 自动清理旧版本 */
    autoCleanup: boolean;
  };
}

/**
 * 默认智能更新配置
 */
export const DEFAULT_INTELLIGENT_UPDATE_CONFIG: IntelligentUpdateConfig = {
  enabled: true,
  similarityThresholds: {
    sameKnowledge: 0.90,
    relatedKnowledge: 0.75,
    supplementThreshold: 0.60,
  },
  timeSensitivity: DEFAULT_TIME_SENSITIVITY_CONFIG,
  autoHandling: {
    autoAcceptUpdates: true,
    autoAcceptCorrections: false,  // 纠正需要审核
    autoMergeSupplements: true,
    reviewThreshold: 0.80,
  },
  versionManagement: {
    enabled: true,
    maxVersions: 20,
    autoCleanup: true,
  },
};

// ==================== 检测上下文 ====================

/**
 * 更新检测上下文
 */
export interface UpdateDetectionContext {
  /** 新知识条目 */
  newEntry: KnowledgeEntry;
  
  /** 信息来源 */
  source: {
    type: 'user_input' | 'web_search' | 'llm_generated' | 'system_extracted';
    url?: string;
    confidence: number;
  };
  
  /** 查询上下文 */
  queryContext?: {
    query: string;
    scenario: string;
    timestamp: number;
  };
  
  /** 用户上下文 */
  userContext?: {
    userId: string;
    role: 'user' | 'expert' | 'admin';
  };
}

// ==================== 统计信息 ====================

/**
 * 更新检测统计
 */
export interface UpdateDetectionStats {
  /** 总检测次数 */
  totalDetections: number;
  
  /** 按关系类型统计 */
  byRelationType: Record<KnowledgeRelationType, number>;
  
  /** 自动处理次数 */
  autoHandledCount: number;
  
  /** 需要审核次数 */
  needsReviewCount: number;
  
  /** 版本创建次数 */
  versionCreatedCount: number;
  
  /** 回滚次数 */
  rollbackCount: number;
  
  /** 平均检测耗时（毫秒） */
  avgDetectionTime: number;
  
  /** 最近检测 */
  recentDetections: Array<{
    timestamp: number;
    relationType: KnowledgeRelationType;
    action: string;
    entryTitle: string;
  }>;
}
