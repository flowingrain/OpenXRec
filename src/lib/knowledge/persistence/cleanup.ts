/**
 * 知识时效性清理服务
 * 
 * 功能：
 * 1. 自动检测过期知识
 * 2. 定期清理过期条目
 * 3. 低访问量条目清理
 * 4. 清理日志记录
 */

import { SupabaseKnowledgeStorage } from './storage';
import {
  CleanupStrategy,
  DEFAULT_CLEANUP_STRATEGY,
  CleanupResult,
  KnowledgeEntryRecord,
} from './types';

// ============================================================================
// 清理日志记录
// ============================================================================

export interface CleanupLog {
  id: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'failed';
  result?: CleanupResult;
  error?: string;
}

// ============================================================================
// 清理服务类
// ============================================================================

export class KnowledgeCleanupService {
  private storage: SupabaseKnowledgeStorage;
  private strategy: CleanupStrategy;
  private cleanupLogs: CleanupLog[] = [];
  private lastCleanupTime: number = 0;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    storage: SupabaseKnowledgeStorage,
    strategy?: Partial<CleanupStrategy>
  ) {
    this.storage = storage;
    this.strategy = { ...DEFAULT_CLEANUP_STRATEGY, ...strategy };
  }

  // ===========================================================================
  // 核心清理接口
  // ===========================================================================

  /**
   * 执行清理操作
   */
  async cleanup(): Promise<CleanupResult> {
    const log: CleanupLog = {
      id: `cleanup_${Date.now()}`,
      startedAt: Date.now(),
      status: 'running',
    };
    
    this.cleanupLogs.push(log);
    
    try {
      const result: CleanupResult = {
        expiredCount: 0,
        lowAccessCount: 0,
        archivedCount: 0,
        deletedCount: 0,
      };
      
      // 1. 清理过期条目
      result.expiredCount = await this.cleanupExpired();
      
      // 2. 清理低访问量条目（可选）
      if (this.strategy.cleanupLowAccess) {
        result.lowAccessCount = await this.cleanupLowAccess();
      }
      
      // 3. 归档长期未访问的条目
      result.archivedCount = await this.archiveStale();
      
      // 更新日志
      log.completedAt = Date.now();
      log.status = 'completed';
      log.result = result;
      this.lastCleanupTime = Date.now();
      
      console.log('[KnowledgeCleanup] Completed:', result);
      return result;
    } catch (err) {
      log.status = 'failed';
      log.error = err instanceof Error ? err.message : String(err);
      console.error('[KnowledgeCleanup] Failed:', err);
      
      return {
        expiredCount: 0,
        lowAccessCount: 0,
        archivedCount: 0,
        deletedCount: 0,
      };
    }
  }

  /**
   * 检查并执行清理（根据策略）
   */
  async checkAndCleanup(): Promise<CleanupResult | null> {
    if (!this.strategy.enabled) {
      return null;
    }
    
    const hoursSinceLastCleanup = 
      (Date.now() - this.lastCleanupTime) / (1000 * 60 * 60);
    
    if (hoursSinceLastCleanup < this.strategy.intervalHours) {
      return null;
    }
    
    return this.cleanup();
  }

  /**
   * 启动定时清理
   */
  startScheduledCleanup(): void {
    if (this.cleanupTimer) {
      this.stopScheduledCleanup();
    }
    
    const intervalMs = this.strategy.intervalHours * 60 * 60 * 1000;
    
    this.cleanupTimer = setInterval(async () => {
      await this.cleanup();
    }, intervalMs);
    
    console.log(`[KnowledgeCleanup] Scheduled cleanup started, interval: ${this.strategy.intervalHours}h`);
  }

  /**
   * 停止定时清理
   */
  stopScheduledCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  // ===========================================================================
  // 查询接口
  // ===========================================================================

  /**
   * 获取即将过期的条目（提前预警）
   */
  async getExpiringEntries(hours: number = 24): Promise<{
    entries: KnowledgeEntryRecord[];
    summary: {
      high: number;
      medium: number;
      low: number;
    };
  }> {
    const entries = await this.storage.getExpiringWithin(hours);
    
    const summary = {
      high: entries.filter(e => e.time_sensitivity === 'high').length,
      medium: entries.filter(e => e.time_sensitivity === 'medium').length,
      low: entries.filter(e => e.time_sensitivity === 'low').length,
    };
    
    return { entries, summary };
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
    const expired = await this.storage.getExpired();
    const expiring24h = await this.storage.getExpiringWithin(24);
    const expiring7d = await this.storage.getExpiringWithin(24 * 7);
    const stats = await this.storage.getStats();
    
    return {
      expired: expired.length,
      expiringIn24h: expiring24h.length,
      expiringIn7d: expiring7d.length,
      active: stats.byStatus['active'] || 0,
    };
  }

  /**
   * 获取清理历史
   */
  getCleanupHistory(limit: number = 10): CleanupLog[] {
    return this.cleanupLogs.slice(-limit);
  }

  /**
   * 获取最后清理时间
   */
  getLastCleanupTime(): number {
    return this.lastCleanupTime;
  }

  /**
   * 获取清理策略
   */
  getStrategy(): CleanupStrategy {
    return { ...this.strategy };
  }

  /**
   * 更新清理策略
   */
  updateStrategy(strategy: Partial<CleanupStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
    
    // 如果正在运行定时清理，重启
    if (this.cleanupTimer) {
      this.startScheduledCleanup();
    }
  }

  // ===========================================================================
  // 内部方法
  // ===========================================================================

  /**
   * 清理过期条目
   */
  private async cleanupExpired(): Promise<number> {
    const expired = await this.storage.getExpired();
    
    if (expired.length === 0) {
      return 0;
    }
    
    // 检查是否在保留期内
    const retainDate = new Date(
      Date.now() - this.strategy.retainAfterExpiry * 24 * 60 * 60 * 1000
    );
    
    const toDelete: string[] = [];
    const toArchive: string[] = [];
    
    for (const entry of expired) {
      const expiredDate = new Date(entry.expires_at!);
      
      if (expiredDate < retainDate) {
        toDelete.push(entry.id);
      } else {
        toArchive.push(entry.id);
      }
    }
    
    // 归档
    if (toArchive.length > 0) {
      for (const id of toArchive) {
        await this.storage.update(id, { status: 'expired' });
      }
    }
    
    // 删除
    for (const id of toDelete) {
      await this.storage.delete(id);
    }
    
    return expired.length;
  }

  /**
   * 清理低访问量条目
   */
  private async cleanupLowAccess(): Promise<number> {
    // 获取30天前的条目
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    
    // 这个需要通过Supabase查询实现
    // 这里简化处理，实际应使用SQL查询
    // SELECT id FROM knowledge_entries 
    // WHERE created_at < thirtyDaysAgo 
    // AND access_count < threshold
    // AND is_preset = false
    // AND is_auto_learned = true
    
    return 0; // 暂时返回0，待实现完整查询
  }

  /**
   * 归档长期未访问的条目
   */
  private async archiveStale(): Promise<number> {
    // 获取90天未访问的条目
    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000
    ).toISOString();
    
    // 类似cleanupLowAccess，需要SQL查询
    // 这里简化处理
    
    return 0;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let cleanupInstance: KnowledgeCleanupService | null = null;

export function getKnowledgeCleanupService(
  storage?: SupabaseKnowledgeStorage,
  strategy?: Partial<CleanupStrategy>
): KnowledgeCleanupService {
  if (!cleanupInstance) {
    const storageInstance = storage || new SupabaseKnowledgeStorage();
    cleanupInstance = new KnowledgeCleanupService(storageInstance, strategy);
  }
  return cleanupInstance;
}

export function createKnowledgeCleanupService(
  storage: SupabaseKnowledgeStorage,
  strategy?: Partial<CleanupStrategy>
): KnowledgeCleanupService {
  return new KnowledgeCleanupService(storage, strategy);
}
