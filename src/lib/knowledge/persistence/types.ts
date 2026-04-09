/**
 * 知识持久化系统 - 类型定义
 * 
 * 功能：
 * 1. Supabase持久化存储
 * 2. 知识时效性管理
 * 3. 知识冲突检测
 * 4. 专家确认机制
 */

import { KnowledgeEntry, KnowledgeType } from '../index';

// ============================================================================
// 数据库表结构
// ============================================================================

/**
 * 知识条目数据库记录
 * 
 * SQL建表语句：
 * ```sql
 * CREATE TABLE knowledge_entries (
 *   id TEXT PRIMARY KEY,
 *   type TEXT NOT NULL,
 *   title TEXT NOT NULL,
 *   content TEXT NOT NULL,
 *   source TEXT NOT NULL,
 *   confidence REAL DEFAULT 0.8,
 *   tags TEXT[] DEFAULT '{}',
 *   related_entities TEXT[] DEFAULT '{}',
 *   region TEXT,
 *   sector TEXT,
 *   is_preset BOOLEAN DEFAULT FALSE,
 *   is_auto_learned BOOLEAN DEFAULT FALSE,
 *   status TEXT DEFAULT 'active',
 *   time_sensitivity TEXT DEFAULT 'low',
 *   expires_at TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   last_accessed_at TIMESTAMPTZ,
 *   access_count INTEGER DEFAULT 0,
 *   conflict_with TEXT[],
 *   expert_reviewed BOOLEAN DEFAULT FALSE,
 *   expert_reviewer TEXT,
 *   expert_reviewed_at TIMESTAMPTZ,
 *   expert_notes TEXT,
 *   embedding VECTOR(1024)
 * );
 * 
 * CREATE INDEX idx_knowledge_type ON knowledge_entries(type);
 * CREATE INDEX idx_knowledge_status ON knowledge_entries(status);
 * CREATE INDEX idx_knowledge_expires ON knowledge_entries(expires_at);
 * CREATE INDEX idx_knowledge_tags ON knowledge_entries USING GIN(tags);
 * CREATE INDEX idx_knowledge_embedding ON knowledge_entries USING ivfflat (embedding vector_cosine_ops);
 * ```
 */
export interface KnowledgeEntryRecord {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  source: string;
  confidence: number;
  tags: string[];
  related_entities: string[];
  region: string | null;
  sector: string | null;
  is_preset: boolean;
  is_auto_learned: boolean;
  status: 'active' | 'expired' | 'conflicted' | 'pending_review' | 'archived';
  time_sensitivity: 'high' | 'medium' | 'low';
  expires_at: string | null;  // ISO timestamp
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  access_count: number;
  conflict_with: string[];    // 冲突的知识条目ID
  expert_reviewed: boolean;
  expert_reviewer: string | null;
  expert_reviewed_at: string | null;
  expert_notes: string | null;
  embedding: number[] | null;
}

// ============================================================================
// 时效性管理
// ============================================================================

/**
 * 时效性配置
 */
export interface TimeSensitivityConfig {
  /** 高时效性（实时数据，如股价、天气）过期时间（小时） */
  high: number;
  /** 中时效性（短期趋势，如新闻、事件）过期时间（天） */
  medium: number;
  /** 低时效性（长期知识，如定义、原理）过期时间（天） */
  low: number;
}

/**
 * 默认时效性配置
 */
export const DEFAULT_TIME_SENSITIVITY: TimeSensitivityConfig = {
  high: 24,      // 1天
  medium: 7,     // 1周
  low: 365,      // 1年（长期知识）
};

/**
 * 时效性类型关键词
 */
export const TIME_SENSITIVITY_KEYWORDS = {
  high: [
    '今天', '昨天', '最新', '实时', '当前', '现在',
    '股价', '汇率', '天气', '比分', '行情',
    '刚刚', '小时', '分钟',
  ],
  medium: [
    '本周', '本月', '近期', '最近',
    '新闻', '公告', '声明', '报告',
    '趋势', '预测',
  ],
  low: [
    '定义', '原理', '概念', '历史',
    '基础', '理论', '方法论',
    '什么是', '如何', '为什么',
  ],
};

/**
 * 清理策略
 */
export interface CleanupStrategy {
  /** 是否启用自动清理 */
  enabled: boolean;
  /** 清理周期（小时） */
  intervalHours: number;
  /** 过期后保留天数（用于审计） */
  retainAfterExpiry: number;
  /** 低访问量阈值（30天内访问次数） */
  lowAccessThreshold: number;
  /** 是否清理低访问量条目 */
  cleanupLowAccess: boolean;
}

/**
 * 默认清理策略
 */
export const DEFAULT_CLEANUP_STRATEGY: CleanupStrategy = {
  enabled: true,
  intervalHours: 24,
  retainAfterExpiry: 30,
  lowAccessThreshold: 1,
  cleanupLowAccess: false,
};

// ============================================================================
// 冲突检测
// ============================================================================

/**
 * 知识冲突类型
 */
export type ConflictType = 
  | 'contradiction'     // 内容矛盾
  | 'duplication'       // 重复内容
  | 'outdated'          // 信息过时
  | 'unreliable_source' // 来源不可靠
  | 'semantic_overlap'; // 语义重叠

/**
 * 知识冲突
 */
export interface KnowledgeConflict {
  id: string;
  type: ConflictType;
  entryId1: string;
  entryId2: string;
  description: string;
  detectedAt: number;
  resolution: 'pending' | 'auto_resolved' | 'expert_review' | 'ignored';
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNotes?: string;
  confidence: number;  // 冲突检测置信度
}

/**
 * 冲突检测配置
 */
export interface ConflictDetectionConfig {
  /** 是否启用冲突检测 */
  enabled: boolean;
  /** 语义相似度阈值（高于此值认为有冲突） */
  similarityThreshold: number;
  /** 内容矛盾检测阈值 */
  contradictionThreshold: number;
  /** 是否自动解决简单冲突 */
  autoResolve: boolean;
  /** 冲突解决策略 */
  resolutionStrategy: 'keep_newer' | 'keep_higher_confidence' | 'keep_preset' | 'expert_review';
}

/**
 * 默认冲突检测配置
 */
export const DEFAULT_CONFLICT_CONFIG: ConflictDetectionConfig = {
  enabled: true,
  similarityThreshold: 0.9,
  contradictionThreshold: 0.7,
  autoResolve: true,
  resolutionStrategy: 'keep_higher_confidence',
};

// ============================================================================
// 专家确认
// ============================================================================

/**
 * 专家审核状态
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision';

/**
 * 专家审核请求
 */
export interface ExpertReviewRequest {
  id: string;
  entryId: string;
  entrySnapshot: KnowledgeEntry;
  requestedAt: number;
  requestedBy: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  status: ReviewStatus;
  assignedTo?: string;
  assignedAt?: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNotes?: string;
  suggestedRevision?: Partial<KnowledgeEntry>;
}

/**
 * 专家审核结果
 */
export interface ExpertReviewResult {
  requestId: string;
  entryId: string;
  status: 'approved' | 'rejected' | 'needs_revision';
  reviewer: string;
  reviewedAt: number;
  notes?: string;
  revision?: Partial<KnowledgeEntry>;
}

/**
 * 专家确认配置
 */
export interface ExpertReviewConfig {
  /** 是否需要专家审核 */
  enabled: boolean;
  /** 需要审核的情况 */
  triggers: {
    /** 新学习的知识是否需要审核 */
    newLearnedKnowledge: boolean;
    /** 冲突解决后是否需要审核 */
    conflictResolution: boolean;
    /** 低置信度知识是否需要审核 */
    lowConfidence: boolean;
    /** 置信度阈值 */
    lowConfidenceThreshold: number;
    /** 高时效性知识是否需要审核 */
    highTimeSensitivity: boolean;
  };
  /** 审核超时（小时），超时后自动批准 */
  autoApproveAfterHours: number;
  /** 默认审核员 */
  defaultReviewer?: string;
}

/**
 * 默认专家审核配置
 */
export const DEFAULT_EXPERT_REVIEW_CONFIG: ExpertReviewConfig = {
  enabled: true,
  triggers: {
    newLearnedKnowledge: false,  // 默认不审核新知识
    conflictResolution: true,    // 冲突解决需要审核
    lowConfidence: true,         // 低置信度需要审核
    lowConfidenceThreshold: 0.6,
    highTimeSensitivity: false,  // 高时效性不审核（时效性更重要）
  },
  autoApproveAfterHours: 72,     // 72小时后自动批准
};

// ============================================================================
// 持久化服务配置
// ============================================================================

/**
 * 知识持久化服务配置
 */
export interface KnowledgePersistenceConfig {
  /** 时效性配置 */
  timeSensitivity: TimeSensitivityConfig;
  /** 清理策略 */
  cleanup: CleanupStrategy;
  /** 冲突检测配置 */
  conflictDetection: ConflictDetectionConfig;
  /** 专家审核配置 */
  expertReview: ExpertReviewConfig;
  /** 批量操作大小 */
  batchSize: number;
  /** 是否启用向量存储 */
  enableVectorStorage: boolean;
  /** 向量维度 */
  vectorDimension: number;
}

/**
 * 默认配置
 */
export const DEFAULT_PERSISTENCE_CONFIG: KnowledgePersistenceConfig = {
  timeSensitivity: DEFAULT_TIME_SENSITIVITY,
  cleanup: DEFAULT_CLEANUP_STRATEGY,
  conflictDetection: DEFAULT_CONFLICT_CONFIG,
  expertReview: DEFAULT_EXPERT_REVIEW_CONFIG,
  batchSize: 100,
  enableVectorStorage: true,
  vectorDimension: 1024,
};

// ============================================================================
// 操作结果
// ============================================================================

/**
 * 持久化操作结果
 */
export interface PersistenceResult {
  success: boolean;
  entryId?: string;
  error?: string;
  details?: Record<string, any>;
}

/**
 * 批量操作结果
 */
export interface BatchPersistenceResult {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: PersistenceResult[];
  errors: Array<{ index: number; error: string }>;
}

/**
 * 清理操作结果
 */
export interface CleanupResult {
  expiredCount: number;
  lowAccessCount: number;
  archivedCount: number;
  deletedCount: number;
  freedSpace?: number;
}

/**
 * 冲突检测结果
 */
export interface ConflictDetectionResult {
  conflicts: KnowledgeConflict[];
  totalChecked: number;
  conflictRate: number;
}
