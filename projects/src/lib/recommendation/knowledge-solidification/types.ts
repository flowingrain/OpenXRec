/**
 * 知识固化系统类型定义
 * 
 * 设计理念：
 * 1. 信息来源分类：用户提供的、系统检索到的、系统内置的、系统总结的
 * 2. 置信度评估：多因素综合评估
 * 3. 固化条件：置信度阈值 + 用户确认 + 专家审核
 * 4. 固化目标：知识库（事实/关系） + 案例库（完整案例/模板）
 */

// ==================== 信息来源分类 ====================

/**
 * 信息来源类型
 */
export type InformationSourceType =
  | 'user_provided'      // 用户提供的信息（用户明确输入）
  | 'system_retrieved'   // 系统检索到的信息（Web搜索、外部数据源）
  | 'system_builtin'     // 系统内置信息（预置知识库）
  | 'system_summarized'; // 系统总结的信息（LLM推理生成）

/**
 * 信息来源元数据
 */
export interface InformationSource {
  type: InformationSourceType;
  description: string;
  confidence: number;  // 基础置信度 0-1
  
  // 来源详情
  details?: {
    url?: string;           // 来源链接（如果是检索到的）
    documentId?: string;    // 文档ID（如果是内置知识）
    llmModel?: string;      // LLM模型（如果是总结的）
    timestamp?: number;     // 时间戳
  };
}

/**
 * 信息来源置信度权重配置
 */
export const SOURCE_CONFIDENCE_WEIGHTS: Record<InformationSourceType, number> = {
  user_provided: 0.95,      // 用户直接提供，可信度最高
  system_builtin: 0.90,      // 系统内置，经过验证
  system_retrieved: 0.75,    // 外部检索，需要验证
  system_summarized: 0.70,   // LLM总结，可能存在幻觉
};

// ==================== 推荐结果内容 ====================

/**
 * 推荐结果中的可固化内容
 */
export interface SolidifiableContent {
  id: string;
  
  // 内容分类
  category: 'fact' | 'relationship' | 'insight' | 'recommendation' | 'comparison';
  
  // 核心内容
  title: string;
  content: string;
  
  // 信息来源
  sources: InformationSource[];
  
  // 置信度评估
  confidence: ContentConfidence;
  
  // 关联实体
  entities?: Array<{
    name: string;
    type: string;
  }>;
  
  // 元数据
  metadata: {
    query: string;              // 原始查询
    scenario?: string;          // 场景
    recommendationId: string;   // 关联的推荐ID
    createdAt: number;
  };
}

/**
 * 内容置信度评估
 */
export interface ContentConfidence {
  // 综合置信度
  overall: number;
  
  // 分项评估
  factors: {
    sourceReliability: number;    // 来源可靠性
    contentCoherence: number;     // 内容连贯性
    userValidation: number;       // 用户验证（0表示未验证）
    historicalAccuracy: number;   // 历史准确率
  };
  
  // 评估依据
  reasoning: string;
  
  // 可固化等级
  solidificationLevel: 'high' | 'medium' | 'low' | 'unsuitable';
}

// ==================== 固化条件与阈值 ====================

/**
 * 固化条件配置
 */
export interface SolidificationThresholds {
  // 置信度阈值
  confidenceThreshold: {
    high: number;       // 高置信度阈值，自动固化（默认 0.85）
    medium: number;     // 中置信度阈值，需用户确认（默认 0.70）
    low: number;        // 低置信度阈值，需专家审核（默认 0.50）
  };
  
  // 用户确认要求
  userConfirmationRequired: boolean;
  
  // 专家审核要求
  expertReviewRequired: boolean;
  
  // 最小推荐命中次数
  minHitCount: number;
  
  // 时间衰减因子
  timeDecayFactor: number;
}

/**
 * 默认固化阈值
 */
export const DEFAULT_SOLIDIFICATION_THRESHOLDS: SolidificationThresholds = {
  confidenceThreshold: {
    high: 0.85,
    medium: 0.70,
    low: 0.50,
  },
  userConfirmationRequired: true,
  expertReviewRequired: false,
  minHitCount: 1,
  timeDecayFactor: 0.95,
};

// ==================== 固化目标 ====================

/**
 * 固化目标类型
 */
export type SolidificationTarget = 
  | 'knowledge_fact'      // 知识库：事实性知识
  | 'knowledge_relation'  // 知识库：关系知识
  | 'case_complete'       // 案例库：完整推荐案例
  | 'case_template';      // 案例库：可复用模板

/**
 * 固化结果
 */
export interface SolidificationResult {
  success: boolean;
  target: SolidificationTarget;
  
  // 固化后的ID
  solidifiedId?: string;
  
  // 固化状态
  status: 'completed' | 'pending_user_confirm' | 'pending_expert_review' | 'rejected';
  
  // 消息
  message: string;
  
  // 固化详情
  details?: {
    originalConfidence: number;
    finalConfidence: number;
    solidifiedAt?: number;
    reviewedBy?: string;
  };
}

// ==================== 固化队列 ====================

/**
 * 待固化项
 */
export interface PendingSolidification {
  id: string;
  content: SolidifiableContent;
  
  // 固化建议
  suggestion: {
    target: SolidificationTarget;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  };
  
  // 状态
  status: 'pending' | 'user_confirmed' | 'expert_reviewing' | 'approved' | 'rejected';
  
  // 时间信息
  createdAt: number;
  confirmedAt?: number;
  reviewedAt?: number;
  
  // 审核信息
  review?: {
    reviewerId?: string;
    comment?: string;
    approved?: boolean;
  };
}

// ==================== 固化统计 ====================

/**
 * 固化统计
 */
export interface SolidificationStats {
  // 总体统计
  totalCandidates: number;
  totalSolidified: number;
  pendingUserConfirm: number;
  pendingExpertReview: number;
  
  // 按来源统计
  bySource: Record<InformationSourceType, {
    candidates: number;
    solidified: number;
    avgConfidence: number;
  }>;
  
  // 按目标统计
  byTarget: Record<SolidificationTarget, number>;
  
  // 最近固化
  recentSolidifications: Array<{
    id: string;
    title: string;
    target: SolidificationTarget;
    solidifiedAt: number;
  }>;
}
