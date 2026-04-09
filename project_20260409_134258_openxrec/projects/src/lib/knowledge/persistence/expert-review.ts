/**
 * 专家确认服务
 * 
 * 功能：
 * 1. 管理待审核知识
 * 2. 专家审核流程
 * 3. 自动批准超时
 * 4. 审核历史记录
 */

import { SupabaseKnowledgeStorage } from './storage';
import {
  ExpertReviewConfig,
  DEFAULT_EXPERT_REVIEW_CONFIG,
  ExpertReviewRequest,
  ExpertReviewResult,
  ReviewStatus,
} from './types';
import { KnowledgeEntry } from '../index';

// ============================================================================
// 专家确认服务类
// ============================================================================

export class ExpertReviewService {
  private storage: SupabaseKnowledgeStorage;
  private config: ExpertReviewConfig;
  private pendingReviews: Map<string, ExpertReviewRequest> = new Map();
  private reviewHistory: ExpertReviewRequest[] = [];

  constructor(
    storage: SupabaseKnowledgeStorage,
    config?: Partial<ExpertReviewConfig>
  ) {
    this.storage = storage;
    this.config = { ...DEFAULT_EXPERT_REVIEW_CONFIG, ...config };
    
    // 启动超时检查
    if (this.config.enabled) {
      this.startTimeoutChecker();
    }
  }

  // ===========================================================================
  // 核心接口
  // ===========================================================================

  /**
   * 提交审核请求
   */
  async submitForReview(options: {
    entryId: string;
    entrySnapshot: KnowledgeEntry;
    reason: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    requestedBy?: string;
  }): Promise<ExpertReviewRequest> {
    const request: ExpertReviewRequest = {
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entryId: options.entryId,
      entrySnapshot: options.entrySnapshot,
      requestedAt: Date.now(),
      requestedBy: options.requestedBy || 'system',
      priority: options.priority || 'medium',
      reason: options.reason,
      status: 'pending',
    };
    
    // 保存到内存
    this.pendingReviews.set(request.id, request);
    
    // 更新知识条目状态
    await this.storage.update(options.entryId, {
      status: 'pending_review',
    });
    
    return request;
  }

  /**
   * 检查是否需要审核
   */
  async needsReview(entry: KnowledgeEntry, context?: {
    isConflictResolution?: boolean;
  }): Promise<{ needsReview: boolean; reason: string }> {
    if (!this.config.enabled) {
      return { needsReview: false, reason: 'Expert review disabled' };
    }
    
    const triggers = this.config.triggers;
    
    // 冲突解决后需要审核
    if (context?.isConflictResolution && triggers.conflictResolution) {
      return { needsReview: true, reason: 'Conflict resolution requires review' };
    }
    
    // 低置信度需要审核
    if (triggers.lowConfidence && entry.metadata.confidence < triggers.lowConfidenceThreshold) {
      return { 
        needsReview: true, 
        reason: `Low confidence (${(entry.metadata.confidence * 100).toFixed(0)}% < ${(triggers.lowConfidenceThreshold * 100).toFixed(0)}%)` 
      };
    }
    
    return { needsReview: false, reason: 'No review trigger matched' };
  }

  /**
   * 分配审核员
   */
  async assignReviewer(
    requestId: string,
    reviewerId: string
  ): Promise<void> {
    const request = this.pendingReviews.get(requestId);
    
    if (!request) {
      throw new Error(`Review request not found: ${requestId}`);
    }
    
    request.assignedTo = reviewerId;
    request.assignedAt = Date.now();
    request.status = 'pending';
  }

  /**
   * 提交审核结果
   */
  async submitReview(result: ExpertReviewResult): Promise<void> {
    const request = this.pendingReviews.get(result.requestId);
    
    if (!request) {
      throw new Error(`Review request not found: ${result.requestId}`);
    }
    
    request.status = result.status === 'approved' ? 'approved' : 
                     result.status === 'rejected' ? 'rejected' : 'pending';
    request.reviewedAt = result.reviewedAt;
    request.reviewedBy = result.reviewer;
    request.reviewNotes = result.notes;
    request.suggestedRevision = result.revision;
    
    // 更新知识条目
    const updates: Record<string, any> = {
      expert_reviewed: true,
      expert_reviewer: result.reviewer,
      expert_reviewed_at: new Date(result.reviewedAt).toISOString(),
      expert_notes: result.notes || null,
    };
    
    if (result.status === 'approved') {
      updates.status = 'active';
      
      // 应用修订
      if (result.revision) {
        if (result.revision.content) updates.content = result.revision.content;
        if (result.revision.metadata?.confidence) {
          updates.confidence = result.revision.metadata.confidence;
        }
      }
    } else if (result.status === 'rejected') {
      updates.status = 'archived';
    }
    
    await this.storage.update(result.entryId, updates);
    
    // 移动到历史
    this.reviewHistory.push(request);
    this.pendingReviews.delete(result.requestId);
  }

  // ===========================================================================
  // 查询接口
  // ===========================================================================

  /**
   * 获取待审核列表
   */
  getPendingReviews(options?: {
    reviewerId?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    limit?: number;
  }): ExpertReviewRequest[] {
    let reviews = Array.from(this.pendingReviews.values());
    
    if (options?.reviewerId) {
      reviews = reviews.filter(r => r.assignedTo === options.reviewerId);
    }
    
    if (options?.priority) {
      reviews = reviews.filter(r => r.priority === options.priority);
    }
    
    // 按优先级排序
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    reviews.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return reviews.slice(0, options?.limit || 50);
  }

  /**
   * 获取审核历史
   */
  getReviewHistory(options?: {
    entryId?: string;
    reviewer?: string;
    status?: ReviewStatus;
    limit?: number;
  }): ExpertReviewRequest[] {
    let history = [...this.reviewHistory];
    
    if (options?.entryId) {
      history = history.filter(r => r.entryId === options.entryId);
    }
    
    if (options?.reviewer) {
      history = history.filter(r => r.reviewedBy === options.reviewer);
    }
    
    if (options?.status) {
      history = history.filter(r => r.status === options.status);
    }
    
    return history
      .sort((a, b) => b.reviewedAt! - a.reviewedAt!)
      .slice(0, options?.limit || 50);
  }

  /**
   * 获取审核统计
   */
  getStats(): {
    pending: number;
    approved: number;
    rejected: number;
    needsRevision: number;
    avgReviewTime: number;
  } {
    const pending = this.pendingReviews.size;
    const history = this.reviewHistory;
    
    const approved = history.filter(r => r.status === 'approved').length;
    const rejected = history.filter(r => r.status === 'rejected').length;
    const needsRevision = history.filter(r => r.status === 'pending').length;
    
    // 计算平均审核时间
    const reviewedItems = history.filter(r => r.reviewedAt);
    const avgReviewTime = reviewedItems.length > 0
      ? reviewedItems.reduce((sum, r) => sum + (r.reviewedAt! - r.requestedAt), 0) / reviewedItems.length
      : 0;
    
    return {
      pending,
      approved,
      rejected,
      needsRevision,
      avgReviewTime,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): ExpertReviewConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExpertReviewConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 启动超时检查器
   */
  private startTimeoutChecker(): void {
    setInterval(() => {
      this.checkTimeouts();
    }, 60 * 60 * 1000); // 每小时检查一次
  }

  /**
   * 检查超时的审核请求
   */
  private async checkTimeouts(): Promise<void> {
    const timeoutMs = this.config.autoApproveAfterHours * 60 * 60 * 1000;
    const now = Date.now();
    
    for (const [id, request] of this.pendingReviews) {
      const elapsed = now - request.requestedAt;
      
      if (elapsed > timeoutMs) {
        // 自动批准
        await this.submitReview({
          requestId: id,
          entryId: request.entryId,
          status: 'approved',
          reviewer: 'system_timeout',
          reviewedAt: now,
          notes: `Auto-approved after ${this.config.autoApproveAfterHours}h timeout`,
        });
        
        console.log(`[ExpertReview] Auto-approved: ${request.entryId}`);
      }
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let reviewInstance: ExpertReviewService | null = null;

export function getExpertReviewService(
  storage?: SupabaseKnowledgeStorage,
  config?: Partial<ExpertReviewConfig>
): ExpertReviewService {
  if (!reviewInstance) {
    const storageInstance = storage || new SupabaseKnowledgeStorage();
    reviewInstance = new ExpertReviewService(storageInstance, config);
  }
  return reviewInstance;
}

export function createExpertReviewService(
  storage: SupabaseKnowledgeStorage,
  config?: Partial<ExpertReviewConfig>
): ExpertReviewService {
  return new ExpertReviewService(storage, config);
}
