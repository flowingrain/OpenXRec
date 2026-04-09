/**
 * 知识持久化管理器
 * 
 * 整合所有持久化服务：
 * 1. Supabase存储
 * 2. 时效性清理
 * 3. 冲突检测
 * 4. 专家确认
 */

import { EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import { SupabaseKnowledgeStorage } from './storage';
import { KnowledgeCleanupService } from './cleanup';
import { ConflictDetectionService } from './conflict';
import { ExpertReviewService } from './expert-review';
import {
  KnowledgePersistenceConfig,
  DEFAULT_PERSISTENCE_CONFIG,
  CleanupResult,
  ConflictDetectionResult,
  ExpertReviewRequest,
  KnowledgeEntryRecord,
} from './types';
import { KnowledgeEntry } from '../index';

// ============================================================================
// 知识持久化管理器类
// ============================================================================

export class KnowledgePersistenceManager {
  private config: KnowledgePersistenceConfig;
  private storage: SupabaseKnowledgeStorage;
  private cleanupService: KnowledgeCleanupService;
  private conflictService: ConflictDetectionService;
  private reviewService: ExpertReviewService;
  private embeddingClient: EmbeddingClient;
  private customHeaders?: Record<string, string>;

  constructor(
    customHeaders?: Record<string, string>,
    config?: Partial<KnowledgePersistenceConfig>
  ) {
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
    this.customHeaders = customHeaders;
    
    // 初始化存储
    this.storage = new SupabaseKnowledgeStorage(customHeaders, config);
    
    // 初始化服务
    this.cleanupService = new KnowledgeCleanupService(
      this.storage,
      this.config.cleanup
    );
    
    this.conflictService = new ConflictDetectionService(
      this.storage,
      customHeaders,
      this.config.conflictDetection
    );
    
    this.reviewService = new ExpertReviewService(
      this.storage,
      this.config.expertReview
    );
    
    // 初始化嵌入客户端
    this.embeddingClient = new EmbeddingClient(new Config(), customHeaders);
  }

  // ===========================================================================
  // 核心操作接口
  // ===========================================================================

  /**
   * 存储知识条目（完整流程）
   * 
   * 流程：
   * 1. 检测时效性
   * 2. 检测冲突
   * 3. 判断是否需要审核
   * 4. 存储
   */
  async storeKnowledge(entry: KnowledgeEntry, options?: {
    isAutoLearned?: boolean;
    skipConflictDetection?: boolean;
    skipReviewCheck?: boolean;
  }): Promise<{
    success: boolean;
    entryId: string;
    conflicts?: ConflictDetectionResult;
    reviewRequest?: ExpertReviewRequest;
    error?: string;
  }> {
    try {
      let conflicts: ConflictDetectionResult | undefined;
      let reviewRequest: ExpertReviewRequest | undefined;
      
      // 1. 冲突检测
      if (!options?.skipConflictDetection && this.config.conflictDetection.enabled) {
        conflicts = await this.conflictService.detectConflicts(entry);
      }
      
      // 2. 检查是否需要审核
      if (!options?.skipReviewCheck && this.config.expertReview.enabled) {
        const { needsReview, reason } = await this.reviewService.needsReview(entry, {
          isConflictResolution: conflicts?.conflicts.some(c => c.resolution !== 'pending'),
        });
        
        if (needsReview) {
          reviewRequest = await this.reviewService.submitForReview({
            entryId: entry.id,
            entrySnapshot: entry,
            reason,
            priority: conflicts?.conflicts.length ? 'high' : 'medium',
          });
        }
      }
      
      // 3. 存储到数据库
      const result = await this.storage.store(entry, {
        isAutoLearned: options?.isAutoLearned,
      });
      
      return {
        success: result.success,
        entryId: entry.id,
        conflicts,
        reviewRequest,
        error: result.error,
      };
    } catch (err) {
      return {
        success: false,
        entryId: entry.id,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 批量存储知识条目
   */
  async storeBatch(entries: KnowledgeEntry[], options?: {
    isAutoLearned?: boolean;
  }): Promise<{
    success: boolean;
    succeeded: number;
    failed: number;
    results: Array<{
      entryId: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results: Array<{
      entryId: string;
      success: boolean;
      error?: string;
    }> = [];
    
    for (const entry of entries) {
      const result = await this.storeKnowledge(entry, options);
      results.push({
        entryId: result.entryId,
        success: result.success,
        error: result.error,
      });
    }
    
    return {
      success: results.every(r => r.success),
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  /**
   * 搜索知识
   */
  async searchKnowledge(query: string, options?: {
    type?: string;
    tags?: string[];
    limit?: number;
    useVector?: boolean;
  }): Promise<Array<{
    entry: KnowledgeEntry;
    relevance: number;
  }>> {
    if (options?.useVector !== false && this.config.enableVectorStorage) {
      const vectorResults = await this.storage.vectorSearch(query, {
        limit: options?.limit,
        type: options?.type as any,
      });
      return vectorResults.map(r => ({
        entry: r.entry,
        relevance: r.similarity,
      }));
    }
    
    const { entries } = await this.storage.search({
      query,
      type: options?.type as any,
      tags: options?.tags,
      limit: options?.limit,
    });
    
    return entries.map(entry => ({
      entry,
      relevance: 0.5, // 非向量搜索默认相关度
    }));
  }

  /**
   * 获取知识条目
   */
  async getKnowledge(id: string): Promise<KnowledgeEntry | null> {
    return this.storage.get(id);
  }

  /**
   * 更新知识条目
   */
  async updateKnowledge(id: string, updates: Partial<KnowledgeEntryRecord>): Promise<{
    success: boolean;
    error?: string;
  }> {
    const result = await this.storage.update(id, updates);
    return {
      success: result.success,
      error: result.error,
    };
  }

  /**
   * 删除知识条目
   */
  async deleteKnowledge(id: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const result = await this.storage.delete(id);
    return {
      success: result.success,
      error: result.error,
    };
  }

  // ===========================================================================
  // 时效性管理接口
  // ===========================================================================

  /**
   * 执行清理
   */
  async performCleanup(): Promise<CleanupResult> {
    return this.cleanupService.cleanup();
  }

  /**
   * 获取过期统计
   */
  async getExpiryStats(): Promise<{
    expired: number;
    expiringIn24h: number;
    expiringIn7d: number;
    active: number;
  }> {
    return this.cleanupService.getExpiryStats();
  }

  /**
   * 启动定时清理
   */
  startScheduledCleanup(): void {
    this.cleanupService.startScheduledCleanup();
  }

  /**
   * 停止定时清理
   */
  stopScheduledCleanup(): void {
    this.cleanupService.stopScheduledCleanup();
  }

  // ===========================================================================
  // 冲突检测接口
  // ===========================================================================

  /**
   * 检测冲突
   */
  async detectConflicts(entry: KnowledgeEntry): Promise<ConflictDetectionResult> {
    return this.conflictService.detectConflicts(entry);
  }

  /**
   * 获取未解决的冲突
   */
  getUnresolvedConflicts(): Array<{
    id: string;
    type: string;
    entryId1: string;
    entryId2: string;
    description: string;
  }> {
    return this.conflictService.getUnresolvedConflicts().map(c => ({
      id: c.id,
      type: c.type,
      entryId1: c.entryId1,
      entryId2: c.entryId2,
      description: c.description,
    }));
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflictId: string,
    resolution: {
      keep: 'entry1' | 'entry2' | 'both';
      reason: string;
      resolvedBy: string;
    }
  ): Promise<void> {
    const conflicts = this.conflictService.getConflictHistory();
    const conflict = conflicts.find(c => c.id === conflictId);
    
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }
    
    await this.conflictService.resolveConflict(conflict, resolution);
  }

  // ===========================================================================
  // 专家审核接口
  // ===========================================================================

  /**
   * 获取待审核列表
   */
  getPendingReviews(options?: {
    reviewerId?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    limit?: number;
  }): ExpertReviewRequest[] {
    return this.reviewService.getPendingReviews(options);
  }

  /**
   * 提交审核结果
   */
  async submitReviewResult(result: {
    requestId: string;
    entryId: string;
    status: 'approved' | 'rejected' | 'needs_revision';
    reviewer: string;
    notes?: string;
    revision?: Partial<KnowledgeEntry>;
  }): Promise<void> {
    await this.reviewService.submitReview({
      requestId: result.requestId,
      entryId: result.entryId,
      status: result.status,
      reviewer: result.reviewer,
      reviewedAt: Date.now(),
      notes: result.notes,
      revision: result.revision,
    });
  }

  /**
   * 获取审核统计
   */
  getReviewStats(): {
    pending: number;
    approved: number;
    rejected: number;
    needsRevision: number;
    avgReviewTime: number;
  } {
    return this.reviewService.getStats();
  }

  // ===========================================================================
  // 状态与配置
  // ===========================================================================

  /**
   * 获取存储统计
   */
  async getStorageStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byTimeSensitivity: Record<string, number>;
    expired: number;
    pendingReview: number;
    autoLearned: number;
    preset: number;
  }> {
    return this.storage.getStats();
  }

  /**
   * 获取配置
   */
  getConfig(): KnowledgePersistenceConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<KnowledgePersistenceConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 更新子服务配置
    if (config.cleanup) {
      this.cleanupService.updateStrategy(config.cleanup);
    }
    if (config.expertReview) {
      this.reviewService.updateConfig(config.expertReview);
    }
  }

  /**
   * 获取健康状态
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    storage: boolean;
    cleanup: boolean;
    conflictDetection: boolean;
    expertReview: boolean;
    lastCleanupTime: number;
    pendingReviews: number;
  }> {
    let storageHealthy = true;
    
    try {
      await this.storage.getStats();
    } catch {
      storageHealthy = false;
    }
    
    const pendingReviews = this.reviewService.getPendingReviews().length;
    const lastCleanupTime = this.cleanupService.getLastCleanupTime();
    
    const allHealthy = storageHealthy;
    const degraded = pendingReviews > 10; // 积压过多审核
    
    return {
      status: allHealthy ? (degraded ? 'degraded' : 'healthy') : 'unhealthy',
      storage: storageHealthy,
      cleanup: this.config.cleanup.enabled,
      conflictDetection: this.config.conflictDetection.enabled,
      expertReview: this.config.expertReview.enabled,
      lastCleanupTime,
      pendingReviews,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let managerInstance: KnowledgePersistenceManager | null = null;

export function getKnowledgePersistenceManager(
  customHeaders?: Record<string, string>,
  config?: Partial<KnowledgePersistenceConfig>
): KnowledgePersistenceManager {
  if (!managerInstance) {
    managerInstance = new KnowledgePersistenceManager(customHeaders, config);
  }
  return managerInstance;
}

export function createKnowledgePersistenceManager(
  customHeaders?: Record<string, string>,
  config?: Partial<KnowledgePersistenceConfig>
): KnowledgePersistenceManager {
  return new KnowledgePersistenceManager(customHeaders, config);
}
