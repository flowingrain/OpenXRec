/**
 * 知识版本管理服务
 * 
 * 核心功能：
 * 1. 版本创建与快照
 * 2. 版本历史查询
 * 3. 版本回滚
 * 4. 变更追踪
 * 5. 自动清理旧版本
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { KnowledgeEntry } from '../index';
import {
  KnowledgeVersion,
  VersionRollbackRequest,
  VersionRollbackResult,
  DEFAULT_INTELLIGENT_UPDATE_CONFIG,
} from './types';

// ==================== 版本管理服务类 ====================

/**
 * 知识版本管理服务
 */
export class KnowledgeVersionManager {
  private supabase = getSupabaseClient();
  private maxVersions: number;

  constructor(maxVersions: number = DEFAULT_INTELLIGENT_UPDATE_CONFIG.versionManagement.maxVersions) {
    this.maxVersions = maxVersions;
  }

  // ==================== 核心接口 ====================

  /**
   * 创建新版本
   */
  async createVersion(
    entry: KnowledgeEntry,
    changeType: KnowledgeVersion['changeType'],
    changeDescription: string,
    operator: string,
    source: {
      type: 'user_input' | 'web_search' | 'llm_generated' | 'system_update' | 'version_restore';
      reference?: string;
      userId?: string;
    }
  ): Promise<KnowledgeVersion | null> {
    if (!this.supabase) {
      console.warn('[VersionManager] Supabase not available');
      return null;
    }

    try {
      // 获取当前最大版本号
      const currentVersion = await this.getCurrentVersion(entry.id);
      const newVersionNumber = currentVersion ? currentVersion.version + 1 : 1;

      // 将旧版本标记为非当前版本
      if (currentVersion) {
        await this.supabase
          .from('knowledge_versions')
          .update({ is_current: false })
          .eq('id', currentVersion.id);
      }

      // 计算差异
      const diff = currentVersion
        ? this.computeDiff(currentVersion.snapshot, entry)
        : undefined;

      // 创建新版本
      const versionId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const version: KnowledgeVersion = {
        id: versionId,
        entryId: entry.id,
        version: newVersionNumber,
        snapshot: entry,
        changeType,
        changeDescription,
        changeSource: {
          type: source.type,
          reference: source.reference,
          userId: source.userId,
        },
        diff,
        createdAt: Date.now(),
        createdBy: operator,
        isCurrent: true,
        tags: this.extractTags(entry, changeType),
      };

      // 存储到数据库
      const { error } = await this.supabase
        .from('knowledge_versions')
        .insert({
          id: version.id,
          entry_id: version.entryId,
          version: version.version,
          snapshot: version.snapshot,
          change_type: version.changeType,
          change_description: version.changeDescription,
          change_source: version.changeSource,
          diff: version.diff,
          created_at: new Date(version.createdAt).toISOString(),
          created_by: version.createdBy,
          is_current: version.isCurrent,
          tags: version.tags,
        });

      if (error) {
        console.error('[VersionManager] Failed to create version:', error);
        return null;
      }

      // 自动清理旧版本
      await this.cleanupOldVersions(entry.id);

      return version;
    } catch (error) {
      console.error('[VersionManager] Error creating version:', error);
      return null;
    }
  }

  /**
   * 获取知识的当前版本
   */
  async getCurrentVersion(entryId: string): Promise<KnowledgeVersion | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('knowledge_versions')
      .select('*')
      .eq('entry_id', entryId)
      .eq('is_current', true)
      .single();

    if (error || !data) return null;

    return this.recordToVersion(data);
  }

  /**
   * 获取知识的版本历史
   */
  async getVersionHistory(
    entryId: string,
    options?: {
      limit?: number;
      offset?: number;
      changeType?: KnowledgeVersion['changeType'];
    }
  ): Promise<KnowledgeVersion[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('knowledge_versions')
      .select('*')
      .eq('entry_id', entryId)
      .order('version', { ascending: false });

    if (options?.changeType) {
      query = query.eq('change_type', options.changeType);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map(this.recordToVersion);
  }

  /**
   * 获取指定版本
   */
  async getVersion(entryId: string, versionNumber: number): Promise<KnowledgeVersion | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('knowledge_versions')
      .select('*')
      .eq('entry_id', entryId)
      .eq('version', versionNumber)
      .single();

    if (error || !data) return null;

    return this.recordToVersion(data);
  }

  /**
   * 回滚到指定版本
   */
  async rollback(request: VersionRollbackRequest): Promise<VersionRollbackResult> {
    const { entryId, targetVersion, reason, operator } = request;

    if (!this.supabase) {
      return {
        success: false,
        entryId,
        fromVersion: 0,
        toVersion: targetVersion,
        newVersionId: '',
        message: '数据库连接失败',
      };
    }

    try {
      // 获取当前版本
      const currentVersion = await this.getCurrentVersion(entryId);
      if (!currentVersion) {
        return {
          success: false,
          entryId,
          fromVersion: 0,
          toVersion: targetVersion,
          newVersionId: '',
          message: '未找到当前版本',
        };
      }

      // 获取目标版本
      const targetVersionRecord = await this.getVersion(entryId, targetVersion);
      if (!targetVersionRecord) {
        return {
          success: false,
          entryId,
          fromVersion: currentVersion.version,
          toVersion: targetVersion,
          newVersionId: '',
          message: `未找到版本 ${targetVersion}`,
        };
      }

      // 更新知识条目为目标版本的内容
      const { error: updateError } = await this.supabase
        .from('knowledge_entries')
        .update({
          title: targetVersionRecord.snapshot.title,
          content: targetVersionRecord.snapshot.content,
          confidence: targetVersionRecord.snapshot.metadata.confidence,
          tags: targetVersionRecord.snapshot.metadata.tags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      if (updateError) {
        return {
          success: false,
          entryId,
          fromVersion: currentVersion.version,
          toVersion: targetVersion,
          newVersionId: '',
          message: `更新失败: ${updateError.message}`,
        };
      }

      // 创建回滚版本记录
      const newVersion = await this.createVersion(
        targetVersionRecord.snapshot,
        'restore',
        `回滚到版本 ${targetVersion}: ${reason}`,
        operator,
        { type: 'version_restore', reference: targetVersionRecord.id }
      );

      return {
        success: true,
        entryId,
        fromVersion: currentVersion.version,
        toVersion: targetVersion,
        newVersionId: newVersion?.id || '',
        message: `已回滚到版本 ${targetVersion}`,
      };
    } catch (error) {
      return {
        success: false,
        entryId,
        fromVersion: 0,
        toVersion: targetVersion,
        newVersionId: '',
        message: `回滚失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 批量回滚
   */
  async batchRollback(
    requests: VersionRollbackRequest[]
  ): Promise<VersionRollbackResult[]> {
    const results: VersionRollbackResult[] = [];

    for (const request of requests) {
      const result = await this.rollback(request);
      results.push(result);
    }

    return results;
  }

  // ==================== 变更追踪 ====================

  /**
   * 获取变更摘要
   */
  async getChangeSummary(
    entryId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<{
    changes: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      changedAt: number;
      changedBy: string;
    }>;
    summary: string;
  }> {
    const fromVer = await this.getVersion(entryId, fromVersion);
    const toVer = await this.getVersion(entryId, toVersion);

    if (!fromVer || !toVer) {
      return { changes: [], summary: '版本不存在' };
    }

    const changes = this.computeDiff(fromVer.snapshot, toVer.snapshot);

    const summary = `从版本 ${fromVersion} 到 ${toVersion}，共 ${changes.length} 处变更`;

    return {
      changes: changes.map((c) => ({
        ...c,
        changedAt: toVer.createdAt,
        changedBy: toVer.createdBy,
      })),
      summary,
    };
  }

  /**
   * 获取知识的完整变更历史
   */
  async getFullChangeHistory(entryId: string): Promise<{
    versions: KnowledgeVersion[];
    timeline: Array<{
      version: number;
      changeType: string;
      description: string;
      changedAt: string;
      changedBy: string;
    }>;
  }> {
    const versions = await this.getVersionHistory(entryId, { limit: 100 });

    const timeline = versions.map((v) => ({
      version: v.version,
      changeType: v.changeType,
      description: v.changeDescription,
      changedAt: new Date(v.createdAt).toLocaleString('zh-CN'),
      changedBy: v.createdBy,
    }));

    return { versions, timeline };
  }

  // ==================== 自动清理 ====================

  /**
   * 清理旧版本
   */
  private async cleanupOldVersions(entryId: string): Promise<number> {
    if (!this.supabase) return 0;

    // 获取版本数量
    const { count, error } = await this.supabase
      .from('knowledge_versions')
      .select('*', { count: 'exact', head: true })
      .eq('entry_id', entryId);

    if (error || !count || count <= this.maxVersions) {
      return 0;
    }

    // 获取需要保留的版本ID
    const { data: keepVersions } = await this.supabase
      .from('knowledge_versions')
      .select('id')
      .eq('entry_id', entryId)
      .order('version', { ascending: false })
      .limit(this.maxVersions);

    if (!keepVersions || keepVersions.length === 0) {
      return 0;
    }

    const keepIds = keepVersions.map((v) => v.id);

    // 删除其他版本
    const { data: deleted } = await this.supabase
      .from('knowledge_versions')
      .delete()
      .eq('entry_id', entryId)
      .not('id', 'in', `(${keepIds.map((id) => `'${id}'`).join(',')})`)
      .select('id');

    return deleted?.length || 0;
  }

  /**
   * 批量清理所有知识的旧版本
   */
  async cleanupAllVersions(): Promise<{ totalCleaned: number; details: Record<string, number> }> {
    if (!this.supabase) {
      return { totalCleaned: 0, details: {} };
    }

    // 获取所有知识条目ID
    const { data: entries } = await this.supabase
      .from('knowledge_entries')
      .select('id');

    if (!entries) {
      return { totalCleaned: 0, details: {} };
    }

    const details: Record<string, number> = {};
    let totalCleaned = 0;

    for (const entry of entries) {
      const cleaned = await this.cleanupOldVersions(entry.id);
      if (cleaned > 0) {
        details[entry.id] = cleaned;
        totalCleaned += cleaned;
      }
    }

    return { totalCleaned, details };
  }

  // ==================== 辅助方法 ====================

  /**
   * 计算两个版本之间的差异
   */
  private computeDiff(
    oldEntry: KnowledgeEntry,
    newEntry: KnowledgeEntry
  ): Array<{ field: string; oldValue: any; newValue: any }> {
    const diff: Array<{ field: string; oldValue: any; newValue: any }> = [];

    // 标题变更
    if (oldEntry.title !== newEntry.title) {
      diff.push({
        field: 'title',
        oldValue: oldEntry.title,
        newValue: newEntry.title,
      });
    }

    // 内容变更
    if (oldEntry.content !== newEntry.content) {
      diff.push({
        field: 'content',
        oldValue: oldEntry.content,
        newValue: newEntry.content,
      });
    }

    // 类型变更
    if (oldEntry.type !== newEntry.type) {
      diff.push({
        field: 'type',
        oldValue: oldEntry.type,
        newValue: newEntry.type,
      });
    }

    // 置信度变更
    if (oldEntry.metadata.confidence !== newEntry.metadata.confidence) {
      diff.push({
        field: 'confidence',
        oldValue: oldEntry.metadata.confidence,
        newValue: newEntry.metadata.confidence,
      });
    }

    // 标签变更
    const oldTags = new Set(oldEntry.metadata.tags);
    const newTags = new Set(newEntry.metadata.tags);
    if (oldTags.size !== newTags.size || ![...oldTags].every((t) => newTags.has(t))) {
      diff.push({
        field: 'tags',
        oldValue: oldEntry.metadata.tags,
        newValue: newEntry.metadata.tags,
      });
    }

    return diff;
  }

  /**
   * 提取版本标签
   */
  private extractTags(entry: KnowledgeEntry, changeType: KnowledgeVersion['changeType']): string[] {
    const tags: string[] = [changeType];

    if (entry.metadata.tags.length > 0) {
      tags.push(...entry.metadata.tags.slice(0, 3));
    }

    return [...new Set(tags)];
  }

  /**
   * 将数据库记录转换为版本对象
   */
  private recordToVersion(record: any): KnowledgeVersion {
    return {
      id: record.id,
      entryId: record.entry_id,
      version: record.version,
      snapshot: record.snapshot,
      changeType: record.change_type,
      changeDescription: record.change_description,
      changeSource: record.change_source,
      diff: record.diff,
      createdAt: new Date(record.created_at).getTime(),
      createdBy: record.created_by,
      isCurrent: record.is_current,
      tags: record.tags || [],
    };
  }

  // ==================== 统计信息 ====================

  /**
   * 获取版本统计
   */
  async getStats(): Promise<{
    totalVersions: number;
    entriesWithVersions: number;
    avgVersionsPerEntry: number;
    changeTypeDistribution: Record<string, number>;
  }> {
    if (!this.supabase) {
      return {
        totalVersions: 0,
        entriesWithVersions: 0,
        avgVersionsPerEntry: 0,
        changeTypeDistribution: {},
      };
    }

    // 获取版本总数
    const { count: totalVersions } = await this.supabase
      .from('knowledge_versions')
      .select('*', { count: 'exact', head: true });

    // 获取有版本的知识条目数
    const { data: entryData } = await this.supabase
      .from('knowledge_versions')
      .select('entry_id');
    
    const uniqueEntryIds = entryData ? [...new Set(entryData.map((d) => d.entry_id))] : [];

    // 获取变更类型分布
    const { data: changeTypes } = await this.supabase
      .from('knowledge_versions')
      .select('change_type');

    const changeTypeDistribution: Record<string, number> = {};
    if (changeTypes) {
      for (const ct of changeTypes) {
        changeTypeDistribution[ct.change_type] = (changeTypeDistribution[ct.change_type] || 0) + 1;
      }
    }

    return {
      totalVersions: totalVersions || 0,
      entriesWithVersions: uniqueEntryIds.length,
      avgVersionsPerEntry:
        uniqueEntryIds.length && totalVersions
          ? totalVersions / uniqueEntryIds.length
          : 0,
      changeTypeDistribution,
    };
  }
}

// ==================== 单例管理 ====================

let versionManagerInstance: KnowledgeVersionManager | null = null;

export function getVersionManager(): KnowledgeVersionManager {
  if (!versionManagerInstance) {
    versionManagerInstance = new KnowledgeVersionManager();
  }
  return versionManagerInstance;
}

export function createVersionManager(maxVersions?: number): KnowledgeVersionManager {
  return new KnowledgeVersionManager(maxVersions);
}

// 重新导出类型
export type { KnowledgeVersion, VersionRollbackRequest, VersionRollbackResult };
