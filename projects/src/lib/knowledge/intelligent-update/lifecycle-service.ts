/**
 * 知识生命周期管理系统
 * 
 * 核心功能：
 * 1. 时效性检测与自动过期
 * 2. 增量更新机制
 * 3. 版本管理与回滚
 * 4. 智能合并
 * 5. 状态流转管理
 */

import { LLMClient, EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { KnowledgeEntry } from '../index';
import {
  TimeSensitivityLevel,
  TimeSensitivityAssessment,
  KnowledgeRelationType,
  UpdateDetectionResult,
  KnowledgeVersion,
  VersionRollbackResult,
  MergeResult,
  MergeStrategy,
  DEFAULT_TIME_SENSITIVITY_CONFIG,
} from './types';

// ==================== 知识生命周期状态 ====================

/**
 * 知识生命周期状态
 */
export type KnowledgeLifecycleState =
  | 'created'      // 新创建
  | 'active'       // 活跃使用中
  | 'updated'      // 已更新
  | 'superseded'   // 被新版本取代
  | 'expired'      // 已过期
  | 'conflicted'   // 存在冲突
  | 'archived';    // 已归档

/**
 * 状态转换事件
 */
export type LifecycleEvent =
  | 'create'       // 创建
  | 'access'       // 访问
  | 'update'       // 更新
  | 'correct'      // 纠正
  | 'supplement'   // 补充
  | 'expire'       // 过期
  | 'restore'      // 恢复
  | 'archive'      // 归档
  | 'conflict';    // 冲突

/**
 * 状态转换规则
 */
const STATE_TRANSITIONS: Record<KnowledgeLifecycleState, Record<LifecycleEvent, KnowledgeLifecycleState>> = {
  created: {
    create: 'created',
    access: 'active',
    update: 'updated',
    correct: 'active',
    supplement: 'active',
    expire: 'expired',
    restore: 'active',
    archive: 'archived',
    conflict: 'conflicted',
  },
  active: {
    create: 'active',
    access: 'active',
    update: 'updated',
    correct: 'active',
    supplement: 'active',
    expire: 'expired',
    restore: 'active',
    archive: 'archived',
    conflict: 'conflicted',
  },
  updated: {
    create: 'updated',
    access: 'active',
    update: 'updated',
    correct: 'active',
    supplement: 'active',
    expire: 'expired',
    restore: 'active',
    archive: 'archived',
    conflict: 'conflicted',
  },
  superseded: {
    create: 'superseded',
    access: 'superseded',
    update: 'superseded',
    correct: 'superseded',
    supplement: 'superseded',
    expire: 'expired',
    restore: 'active',
    archive: 'archived',
    conflict: 'superseded',
  },
  expired: {
    create: 'expired',
    access: 'expired',
    update: 'active',
    correct: 'active',
    supplement: 'expired',
    expire: 'expired',
    restore: 'active',
    archive: 'archived',
    conflict: 'expired',
  },
  conflicted: {
    create: 'conflicted',
    access: 'conflicted',
    update: 'conflicted',
    correct: 'active',
    supplement: 'conflicted',
    expire: 'expired',
    restore: 'active',
    archive: 'archived',
    conflict: 'conflicted',
  },
  archived: {
    create: 'archived',
    access: 'archived',
    update: 'archived',
    correct: 'archived',
    supplement: 'archived',
    expire: 'archived',
    restore: 'active',
    archive: 'archived',
    conflict: 'archived',
  },
};

// ==================== 时效性配置增强 ====================

/**
 * 增强的时效性配置
 */
export interface EnhancedTimeSensitivityConfig {
  // 过期时间（小时）
  expiryHours: {
    realtime: number;   // 实时数据：分钟级
    high: number;       // 高时效：24小时（股价、新闻）
    medium: number;     // 中时效：7天（趋势）
    low: number;        // 低时效：永久（历史事实）
    permanent: number;  // 永久知识
  };
  
  // 关键词检测
  keywords: Record<TimeSensitivityLevel, string[]>;
  
  // 数据类型映射
  dataTypes: Record<TimeSensitivityLevel, string[]>;
  
  // 自动刷新配置
  autoRefresh: {
    enabled: boolean;
    checkIntervalHours: number;
    notifyBeforeExpiryHours: number;
  };
}

/**
 * 默认增强配置
 */
export const DEFAULT_ENHANCED_TIME_CONFIG: EnhancedTimeSensitivityConfig = {
  expiryHours: {
    realtime: 1,           // 1小时
    high: 24,              // 24小时（股价、新闻）
    medium: 168,           // 7天（趋势）
    low: Infinity,         // 永久（历史事实）
    permanent: Infinity,   // 永不过期
  },
  keywords: {
    realtime: ['实时', '当前', '最新', '刚刚', '现在', '正在', '即时'],
    high: ['今天', '昨天', '本周', '最新', '近期', '股价', '汇率', '指数', '行情', '新闻', '公告'],
    medium: ['本月', '上月', '季度', '趋势', '预测', '展望', '预期'],
    low: ['年度', '历史', '长期', '定义', '原理', '基础', '概念', '理论'],
    permanent: ['定义', '概念', '理论', '公式', '原理', '常数', '定律'],
  },
  dataTypes: {
    realtime: ['market_data', 'realtime_indicator'],
    high: ['market_data', 'event', 'news'],
    medium: ['event', 'policy', 'trend'],
    low: ['entity', 'economic_indicator', 'relationship'],
    permanent: ['entity', 'relationship', 'definition'],
  },
  autoRefresh: {
    enabled: true,
    checkIntervalHours: 1,
    notifyBeforeExpiryHours: 4,
  },
};

// ==================== 增量更新 ====================

/**
 * 字段变更
 */
export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'add' | 'remove' | 'modify';
  importance: 'critical' | 'major' | 'minor';
}

/**
 * 增量更新请求
 */
export interface IncrementalUpdateRequest {
  entryId: string;
  changes: FieldChange[];
  source: {
    type: 'user_input' | 'web_search' | 'llm_generated' | 'system_update';
    reference?: string;
    confidence: number;
  };
  operator: string;
}

/**
 * 增量更新结果
 */
export interface IncrementalUpdateResult {
  success: boolean;
  entryId: string;
  appliedChanges: FieldChange[];
  skippedChanges: Array<{ change: FieldChange; reason: string }>;
  versionId?: string;
  previousVersion?: number;
  currentVersion?: number;
  message: string;
}

// ==================== 知识生命周期管理服务 ====================

/**
 * 知识生命周期管理服务
 */
export class KnowledgeLifecycleService {
  private llmClient: LLMClient;
  private embeddingClient: EmbeddingClient;
  private config: EnhancedTimeSensitivityConfig;
  private supabase = getSupabaseClient();

  constructor(config?: Partial<EnhancedTimeSensitivityConfig>) {
    const sdkConfig = new Config();
    this.llmClient = new LLMClient(sdkConfig);
    this.embeddingClient = new EmbeddingClient(sdkConfig);
    this.config = { ...DEFAULT_ENHANCED_TIME_CONFIG, ...config };
  }

  // ==================== 时效性管理 ====================

  /**
   * 评估知识的时效性
   */
  async assessTimeSensitivity(entry: KnowledgeEntry): Promise<TimeSensitivityAssessment> {
    const text = `${entry.title} ${entry.content}`.toLowerCase();
    const metadata = entry.metadata;

    // 1. 基于关键词判断
    let detectedLevel: TimeSensitivityLevel = 'low';
    let maxMatchCount = 0;

    for (const [level, keywords] of Object.entries(this.config.keywords)) {
      const matchCount = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        detectedLevel = level as TimeSensitivityLevel;
      }
    }

    // 2. 基于数据类型判断
    const typeLevel = this.getTypeBasedLevel(entry.type);

    // 3. 基于时间戳判断
    const ageHours = (Date.now() - metadata.timestamp) / (1000 * 60 * 60);
    const ageLevel = this.getAgeBasedLevel(ageHours);

    // 4. 综合判断（取最高时效性）
    const levelPriority: Record<TimeSensitivityLevel, number> = {
      realtime: 5,
      high: 4,
      medium: 3,
      low: 2,
      permanent: 1,
    };

    const levels = [detectedLevel, typeLevel, ageLevel];
    const finalLevel = levels.reduce((highest, current) => 
      levelPriority[current] > levelPriority[highest] ? current : highest
    );

    // 计算过期时间
    const expiryHours = this.config.expiryHours[finalLevel];
    const expiresAt = expiryHours === Infinity 
      ? Infinity 
      : metadata.timestamp + expiryHours * 60 * 60 * 1000;

    const isExpired = expiresAt !== Infinity && Date.now() > expiresAt;
    const timeToExpiry = expiresAt === Infinity ? Infinity : Math.max(0, expiresAt - Date.now());

    return {
      level: finalLevel,
      expiresAt,
      isExpired,
      timeToExpiry,
      reasoning: this.generateSensitivityReasoning(finalLevel, detectedLevel, typeLevel, ageLevel),
    };
  }

  /**
   * 根据数据类型判断时效性
   */
  private getTypeBasedLevel(type: string): TimeSensitivityLevel {
    for (const [level, types] of Object.entries(this.config.dataTypes)) {
      if (types.includes(type)) {
        return level as TimeSensitivityLevel;
      }
    }
    return 'low';
  }

  /**
   * 根据知识年龄判断时效性
   */
  private getAgeBasedLevel(ageHours: number): TimeSensitivityLevel {
    if (ageHours < 1) return 'realtime';
    if (ageHours < 24) return 'high';
    if (ageHours < 168) return 'medium';
    return 'low';
  }

  /**
   * 生成时效性判断依据
   */
  private generateSensitivityReasoning(
    final: TimeSensitivityLevel,
    keyword: TimeSensitivityLevel,
    type: TimeSensitivityLevel,
    age: TimeSensitivityLevel
  ): string {
    const parts: string[] = [];
    
    if (keyword !== 'low') {
      parts.push(`关键词匹配: ${keyword}`);
    }
    if (type !== 'low') {
      parts.push(`数据类型: ${type}`);
    }
    if (age !== 'low') {
      parts.push(`知识年龄: ${age}`);
    }
    
    return parts.length > 0 
      ? `综合判断: ${final} (${parts.join(', ')})` 
      : `默认时效性: ${final}`;
  }

  /**
   * 检查并更新过期知识
   */
  async checkAndUpdateExpired(): Promise<{
    checked: number;
    expired: number;
    updated: number;
    details: Array<{ id: string; title: string; action: string }>;
  }> {
    if (!this.supabase) {
      return { checked: 0, expired: 0, updated: 0, details: [] };
    }

    const details: Array<{ id: string; title: string; action: string }> = [];
    let expired = 0;
    let updated = 0;

    // 获取所有活跃知识
    const { data: entries, error } = await this.supabase
      .from('knowledge_entries')
      .select('*')
      .eq('status', 'active');

    if (error || !entries) {
      return { checked: 0, expired: 0, updated: 0, details: [] };
    }

    for (const record of entries) {
      const entry = this.recordToEntry(record);
      const assessment = await this.assessTimeSensitivity(entry);

      if (assessment.isExpired) {
        // 标记为过期
        const { error: updateError } = await this.supabase
          .from('knowledge_entries')
          .update({ 
            status: 'expired',
            expires_at: new Date(assessment.expiresAt).toISOString(),
          })
          .eq('id', entry.id);

        if (!updateError) {
          expired++;
          details.push({
            id: entry.id,
            title: entry.title,
            action: 'expired',
          });
        }
      } else {
        // 更新过期时间
        await this.supabase
          .from('knowledge_entries')
          .update({
            time_sensitivity: assessment.level,
            expires_at: assessment.expiresAt === Infinity ? null : new Date(assessment.expiresAt).toISOString(),
          })
          .eq('id', entry.id);
        updated++;
      }
    }

    return {
      checked: entries.length,
      expired,
      updated,
      details,
    };
  }

  // ==================== 增量更新 ====================

  /**
   * 执行增量更新
   */
  async incrementalUpdate(request: IncrementalUpdateRequest): Promise<IncrementalUpdateResult> {
    const { entryId, changes, source, operator } = request;

    if (!this.supabase) {
      return {
        success: false,
        entryId,
        appliedChanges: [],
        skippedChanges: [],
        message: '数据库连接失败',
      };
    }

    try {
      // 1. 获取当前知识条目
      const { data: current, error: fetchError } = await this.supabase
        .from('knowledge_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (fetchError || !current) {
        return {
          success: false,
          entryId,
          appliedChanges: [],
          skippedChanges: [],
          message: '未找到知识条目',
        };
      }

      const currentEntry = this.recordToEntry(current);
      const previousVersion = current.version_count || 0;

      // 2. 验证变更
      const validatedChanges = this.validateChanges(changes, currentEntry);
      const appliedChanges: FieldChange[] = [];
      const skippedChanges: Array<{ change: FieldChange; reason: string }> = [];

      for (const change of validatedChanges) {
        const validation = this.validateFieldChange(change, currentEntry, source);
        if (validation.valid) {
          appliedChanges.push(change);
        } else {
          skippedChanges.push({ change, reason: validation.reason });
        }
      }

      if (appliedChanges.length === 0) {
        return {
          success: false,
          entryId,
          appliedChanges: [],
          skippedChanges,
          message: '没有有效的变更',
        };
      }

      // 3. 应用变更
      const updatedEntry = this.applyChanges(currentEntry, appliedChanges);

      // 4. 更新数据库
      const { error: updateError } = await this.supabase
        .from('knowledge_entries')
        .update({
          title: updatedEntry.title,
          content: updatedEntry.content,
          confidence: updatedEntry.metadata.confidence,
          tags: updatedEntry.metadata.tags,
          updated_at: new Date().toISOString(),
          last_updated_by: operator,
          version_count: previousVersion + 1,
        })
        .eq('id', entryId);

      if (updateError) {
        return {
          success: false,
          entryId,
          appliedChanges: [],
          skippedChanges,
          message: `更新失败: ${updateError.message}`,
        };
      }

      // 5. 创建版本记录
      const versionId = await this.createVersionRecord(
        entryId,
        currentEntry,
        updatedEntry,
        appliedChanges,
        operator,
        source
      );

      // 6. 触发状态转换
      await this.transitionState(entryId, 'update');

      return {
        success: true,
        entryId,
        appliedChanges,
        skippedChanges,
        versionId,
        previousVersion,
        currentVersion: previousVersion + 1,
        message: `成功应用 ${appliedChanges.length} 个变更`,
      };
    } catch (error) {
      return {
        success: false,
        entryId,
        appliedChanges: [],
        skippedChanges: [],
        message: `更新失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 验证变更列表
   */
  private validateChanges(changes: FieldChange[], entry: KnowledgeEntry): FieldChange[] {
    return changes.filter(change => {
      // 过滤无效变更
      if (!change.field || change.oldValue === change.newValue) {
        return false;
      }
      return true;
    });
  }

  /**
   * 验证单个字段变更
   */
  private validateFieldChange(
    change: FieldChange,
    entry: KnowledgeEntry,
    source: IncrementalUpdateRequest['source']
  ): { valid: boolean; reason: string } {
    // 检查字段是否存在
    const allowedFields = ['title', 'content', 'confidence', 'tags', 'relatedEntities'];
    if (!allowedFields.includes(change.field)) {
      return { valid: false, reason: `字段 ${change.field} 不允许更新` };
    }

    // 检查关键字段变更权限
    if (change.field === 'title' && change.importance === 'critical' && source.confidence < 0.9) {
      return { valid: false, reason: '标题修改需要更高置信度' };
    }

    // 检查值有效性
    if (change.field === 'confidence' && (change.newValue < 0 || change.newValue > 1)) {
      return { valid: false, reason: '置信度必须在 0-1 之间' };
    }

    return { valid: true, reason: '' };
  }

  /**
   * 应用变更到知识条目
   */
  private applyChanges(entry: KnowledgeEntry, changes: FieldChange[]): KnowledgeEntry {
    const updated = { ...entry };
    
    for (const change of changes) {
      switch (change.field) {
        case 'title':
          updated.title = change.newValue;
          break;
        case 'content':
          updated.content = change.newValue;
          break;
        case 'confidence':
          updated.metadata = { ...updated.metadata, confidence: change.newValue };
          break;
        case 'tags':
          updated.metadata = { ...updated.metadata, tags: change.newValue };
          break;
        case 'relatedEntities':
          updated.metadata = { ...updated.metadata, relatedEntities: change.newValue };
          break;
      }
    }

    return updated;
  }

  /**
   * 创建版本记录
   */
  private async createVersionRecord(
    entryId: string,
    oldEntry: KnowledgeEntry,
    newEntry: KnowledgeEntry,
    changes: FieldChange[],
    operator: string,
    source: IncrementalUpdateRequest['source']
  ): Promise<string | undefined> {
    if (!this.supabase) return undefined;

    const versionId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentVersion = oldEntry.metadata.timestamp || 1;

    await this.supabase
      .from('knowledge_versions')
      .insert({
        id: versionId,
        entry_id: entryId,
        version: currentVersion + 1,
        snapshot: newEntry,
        change_type: 'update',
        change_description: `增量更新: ${changes.map(c => c.field).join(', ')}`,
        change_source: source,
        diff: changes,
        created_at: new Date().toISOString(),
        created_by: operator,
        is_current: true,
      });

    // 标记旧版本为非当前
    await this.supabase
      .from('knowledge_versions')
      .update({ is_current: false })
      .eq('entry_id', entryId)
      .neq('id', versionId);

    return versionId;
  }

  // ==================== 智能合并增强版 ====================

  /**
   * 智能合并知识（增强版）
   */
  async smartMerge(
    original: KnowledgeEntry,
    newInfo: {
      title?: string;
      content?: string;
      metadata?: Partial<KnowledgeEntry['metadata']>;
    },
    options?: {
      strategy?: MergeStrategy;
      preserveOriginal?: boolean;
      confidenceThreshold?: number;
    }
  ): Promise<MergeResult & { 
    mergeType: 'replace' | 'append' | 'integrate' | 'conflict';
    preservedFields: string[];
  }> {
    const strategy = options?.strategy || 'llm_merge';
    const preserveOriginal = options?.preserveOriginal ?? false;
    const threshold = options?.confidenceThreshold ?? 0.7;

    // 分析合并类型
    const mergeType = this.analyzeMergeType(original, newInfo);
    const preservedFields: string[] = [];

    // 根据合并类型选择策略
    switch (mergeType) {
      case 'replace':
        // 完全替换
        return this.executeReplace(original, newInfo, preservedFields);

      case 'append':
        // 追加内容
        return this.executeAppend(original, newInfo, preservedFields);

      case 'integrate':
        // 整合内容
        return this.executeIntegrate(original, newInfo, strategy, preservedFields);

      case 'conflict':
        // 存在冲突，需要智能解决
        return this.executeConflictResolution(original, newInfo, strategy, threshold, preservedFields);
    }
  }

  /**
   * 分析合并类型
   */
  private analyzeMergeType(
    original: KnowledgeEntry,
    newInfo: { title?: string; content?: string; metadata?: Partial<KnowledgeEntry['metadata']> }
  ): 'replace' | 'append' | 'integrate' | 'conflict' {
    // 检查标题是否相同
    const sameTitle = !newInfo.title || newInfo.title === original.title;
    
    // 检查内容是否包含
    const contentIncluded = !newInfo.content || original.content.includes(newInfo.content);
    const contentIncludes = newInfo.content && newInfo.content.includes(original.content);

    if (!sameTitle && newInfo.title) {
      // 标题不同，可能是更新或冲突
      if (newInfo.content && this.hasTimeSeriesChange(original.content, newInfo.content)) {
        return 'replace'; // 时间序列数据，替换
      }
      return 'conflict';
    }

    if (contentIncludes) {
      return 'replace'; // 新内容更完整，替换
    }

    if (contentIncluded) {
      return 'append'; // 新内容是子集，追加
    }

    // 检查是否有矛盾
    if (this.hasContradiction(original.content, newInfo.content || '')) {
      return 'conflict';
    }

    return 'integrate'; // 整合
  }

  /**
   * 检测时间序列变化
   */
  private hasTimeSeriesChange(oldContent: string, newContent: string): boolean {
    const yearPattern = /\d{4}年?/;
    const oldYears = oldContent.match(yearPattern) || [];
    const newYears = newContent.match(yearPattern) || [];
    
    // 如果新内容有更新的年份，认为是时间序列更新
    const latestOldYear = Math.max(...oldYears.map(y => parseInt(y)));
    const latestNewYear = Math.max(...newYears.map(y => parseInt(y)));
    
    return latestNewYear > latestOldYear;
  }

  /**
   * 检测矛盾
   */
  private hasContradiction(content1: string, content2: string): boolean {
    // 简单的矛盾检测（数字不一致）
    const numbers1 = content1.match(/\d+(\.\d+)?/g) || [];
    const numbers2 = content2.match(/\d+(\.\d+)?/g) || [];
    
    // 如果两个内容都有数字，但数字不同
    if (numbers1.length > 0 && numbers2.length > 0) {
      // 提取主要数字进行比较
      const mainNumber1 = numbers1[0];
      const mainNumber2 = numbers2[0];
      return mainNumber1 !== mainNumber2;
    }
    
    return false;
  }

  /**
   * 执行替换
   */
  private executeReplace(
    original: KnowledgeEntry,
    newInfo: { title?: string; content?: string; metadata?: Partial<KnowledgeEntry['metadata']> },
    preservedFields: string[]
  ): MergeResult & { mergeType: 'replace'; preservedFields: string[] } {
    preservedFields.push('id', 'type');
    
    return {
      success: true,
      mergedEntry: {
        ...original,
        title: newInfo.title || original.title,
        content: newInfo.content || original.content,
        metadata: {
          ...original.metadata,
          ...newInfo.metadata,
          timestamp: Date.now(),
        },
      },
      mergedFields: Object.keys(newInfo).filter(k => newInfo[k as keyof typeof newInfo] !== undefined),
      keptFields: ['id', 'type'],
      conflictedFields: [],
      description: '完整替换内容',
      mergeType: 'replace',
      preservedFields,
    };
  }

  /**
   * 执行追加
   */
  private executeAppend(
    original: KnowledgeEntry,
    newInfo: { title?: string; content?: string; metadata?: Partial<KnowledgeEntry['metadata']> },
    preservedFields: string[]
  ): MergeResult & { mergeType: 'append'; preservedFields: string[] } {
    const mergedContent = newInfo.content 
      ? `${original.content}\n\n补充信息：${newInfo.content}`
      : original.content;

    const mergedTags = newInfo.metadata?.tags
      ? [...new Set([...original.metadata.tags, ...newInfo.metadata.tags])]
      : original.metadata.tags;

    preservedFields.push('title', 'content');

    return {
      success: true,
      mergedEntry: {
        ...original,
        content: mergedContent,
        metadata: {
          ...original.metadata,
          tags: mergedTags,
          ...newInfo.metadata,
          timestamp: Date.now(),
        },
      },
      mergedFields: ['content', 'tags'],
      keptFields: ['title'],
      conflictedFields: [],
      description: '追加补充信息',
      mergeType: 'append',
      preservedFields,
    };
  }

  /**
   * 执行整合
   */
  private async executeIntegrate(
    original: KnowledgeEntry,
    newInfo: { title?: string; content?: string; metadata?: Partial<KnowledgeEntry['metadata']> },
    strategy: MergeStrategy,
    preservedFields: string[]
  ): Promise<MergeResult & { mergeType: 'integrate'; preservedFields: string[] }> {
    if (strategy === 'llm_merge') {
      return this.llmIntegrate(original, newInfo, preservedFields);
    }

    // 默认整合策略：合并内容
    const mergedContent = `${original.content}\n\n相关补充：${newInfo.content}`;
    const mergedTags = [...new Set([...original.metadata.tags, ...(newInfo.metadata?.tags || [])])];

    return {
      success: true,
      mergedEntry: {
        ...original,
        content: mergedContent,
        metadata: {
          ...original.metadata,
          tags: mergedTags,
          ...newInfo.metadata,
          timestamp: Date.now(),
        },
      },
      mergedFields: ['content', 'tags'],
      keptFields: ['title'],
      conflictedFields: [],
      description: '整合补充内容',
      mergeType: 'integrate',
      preservedFields,
    };
  }

  /**
   * LLM 智能整合
   */
  private async llmIntegrate(
    original: KnowledgeEntry,
    newInfo: { title?: string; content?: string; metadata?: Partial<KnowledgeEntry['metadata']> },
    preservedFields: string[]
  ): Promise<MergeResult & { mergeType: 'integrate'; preservedFields: string[] }> {
    try {
      const prompt = `整合以下两条相关知识，生成更完整的知识条目。

原始知识：
标题：${original.title}
内容：${original.content}

补充信息：
${newInfo.content || ''}

要求：
1. 保留原始知识的核心内容
2. 有机整合补充信息
3. 消除重复，保持连贯
4. 如果有数据更新，保留最新数据

返回JSON格式：
{
  "title": "整合后的标题",
  "content": "整合后的内容",
  "integratedParts": ["原始内容", "补充信息"],
  "description": "整合说明"
}`;

      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是知识整合专家。' },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.2,
      });

      const cleaned = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleaned);

      return {
        success: true,
        mergedEntry: {
          ...original,
          title: result.title || original.title,
          content: result.content || original.content,
          metadata: {
            ...original.metadata,
            ...newInfo.metadata,
            timestamp: Date.now(),
          },
        },
        mergedFields: ['content', ...(result.title ? ['title'] : [])],
        keptFields: [],
        conflictedFields: [],
        description: result.description,
        mergeType: 'integrate',
        preservedFields,
      };
    } catch (error) {
      // 降级到简单整合
      return this.executeIntegrate(original, newInfo, 'union', preservedFields);
    }
  }

  /**
   * 执行冲突解决
   */
  private async executeConflictResolution(
    original: KnowledgeEntry,
    newInfo: { title?: string; content?: string; metadata?: Partial<KnowledgeEntry['metadata']> },
    strategy: MergeStrategy,
    threshold: number,
    preservedFields: string[]
  ): Promise<MergeResult & { mergeType: 'conflict'; preservedFields: string[] }> {
    // 使用 LLM 分析冲突并建议解决方案
    try {
      const prompt = `分析以下知识冲突并提供解决方案。

原始知识：
标题：${original.title}
内容：${original.content}
置信度：${original.metadata.confidence}

新信息：
${newInfo.content || ''}
来源置信度：${newInfo.metadata?.confidence || 0.8}

请分析：
1. 冲突点在哪里
2. 哪个版本更可信
3. 是否可以合并解决

返回JSON格式：
{
  "conflictPoints": ["冲突1", "冲突2"],
  "recommendedResolution": "keep_original|keep_new|merge|need_review",
  "reasoning": "判断依据",
  "mergedContent": "如果可以合并，提供合并后的内容",
  "needsReview": true/false
}`;

      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是知识冲突解决专家。' },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.1,
      });

      const cleaned = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleaned);

      if (result.needsReview) {
        return {
          success: false,
          mergedFields: [],
          keptFields: [],
          conflictedFields: [{
            field: 'content',
            originalValue: original.content,
            newValue: newInfo.content,
            resolution: 'pending',
          }],
          description: '存在冲突，需要人工审核',
          mergeType: 'conflict',
          preservedFields,
        };
      }

      // 执行推荐的解决方案
      if (result.recommendedResolution === 'keep_original') {
        return {
          success: true,
          mergedEntry: original,
          mergedFields: [],
          keptFields: ['content'],
          conflictedFields: [{
            field: 'content',
            originalValue: original.content,
            newValue: newInfo.content,
            resolution: 'original',
          }],
          description: result.reasoning,
          mergeType: 'conflict',
          preservedFields,
        };
      }

      if (result.recommendedResolution === 'keep_new') {
        return {
          success: true,
          mergedEntry: {
            ...original,
            content: newInfo.content || original.content,
            metadata: { ...original.metadata, ...newInfo.metadata, timestamp: Date.now() },
          },
          mergedFields: ['content'],
          keptFields: [],
          conflictedFields: [{
            field: 'content',
            originalValue: original.content,
            newValue: newInfo.content,
            resolution: 'new',
          }],
          description: result.reasoning,
          mergeType: 'conflict',
          preservedFields,
        };
      }

      // 合并解决方案
      return {
        success: true,
        mergedEntry: {
          ...original,
          content: result.mergedContent || original.content,
          metadata: { ...original.metadata, ...newInfo.metadata, timestamp: Date.now() },
        },
        mergedFields: ['content'],
        keptFields: [],
        conflictedFields: [{
          field: 'content',
          originalValue: original.content,
          newValue: newInfo.content,
          resolution: 'merged',
          mergedValue: result.mergedContent,
        }],
        description: result.reasoning,
        mergeType: 'conflict',
        preservedFields,
      };
    } catch (error) {
      return {
        success: false,
        mergedFields: [],
        keptFields: [],
        conflictedFields: [{
          field: 'content',
          originalValue: original.content,
          newValue: newInfo.content,
          resolution: 'pending',
        }],
        description: `冲突解决失败: ${error instanceof Error ? error.message : String(error)}`,
        mergeType: 'conflict',
        preservedFields,
      };
    }
  }

  // ==================== 状态转换 ====================

  /**
   * 状态转换
   */
  async transitionState(
    entryId: string,
    event: LifecycleEvent
  ): Promise<{ success: boolean; oldState?: KnowledgeLifecycleState; newState?: KnowledgeLifecycleState }> {
    if (!this.supabase) {
      return { success: false };
    }

    // 获取当前状态
    const { data: current } = await this.supabase
      .from('knowledge_entries')
      .select('status')
      .eq('id', entryId)
      .single();

    if (!current) {
      return { success: false };
    }

    const oldState = current.status as KnowledgeLifecycleState;
    const newState = STATE_TRANSITIONS[oldState]?.[event];

    if (!newState) {
      return { success: false, oldState };
    }

    // 更新状态
    const { error } = await this.supabase
      .from('knowledge_entries')
      .update({ status: newState })
      .eq('id', entryId);

    if (error) {
      return { success: false, oldState };
    }

    // 记录状态变更
    await this.supabase
      .from('knowledge_lifecycle_events')
      .insert({
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entry_id: entryId,
        event,
        old_state: oldState,
        new_state: newState,
        created_at: new Date().toISOString(),
      });

    return { success: true, oldState, newState };
  }

  /**
   * 获取知识生命周期状态
   */
  async getLifecycleState(entryId: string): Promise<{
    state: KnowledgeLifecycleState;
    history: Array<{ event: LifecycleEvent; from: KnowledgeLifecycleState; to: KnowledgeLifecycleState; timestamp: number }>;
  } | null> {
    if (!this.supabase) return null;

    const { data: current } = await this.supabase
      .from('knowledge_entries')
      .select('status')
      .eq('id', entryId)
      .single();

    if (!current) return null;

    const { data: history } = await this.supabase
      .from('knowledge_lifecycle_events')
      .select('*')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      state: current.status as KnowledgeLifecycleState,
      history: (history || []).map(h => ({
        event: h.event as LifecycleEvent,
        from: h.old_state as KnowledgeLifecycleState,
        to: h.new_state as KnowledgeLifecycleState,
        timestamp: new Date(h.created_at).getTime(),
      })),
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 将数据库记录转换为知识条目
   */
  private recordToEntry(record: any): KnowledgeEntry {
    return {
      id: record.id,
      type: record.type,
      title: record.title,
      content: record.content,
      metadata: {
        source: record.source,
        confidence: record.confidence,
        timestamp: new Date(record.created_at).getTime(),
        tags: record.tags || [],
        relatedEntities: record.related_entities || [],
      },
      embedding: record.embedding,
    };
  }
}

// ==================== 单例管理 ====================

let lifecycleInstance: KnowledgeLifecycleService | null = null;

export function getKnowledgeLifecycleService(
  config?: Partial<EnhancedTimeSensitivityConfig>
): KnowledgeLifecycleService {
  if (!lifecycleInstance) {
    lifecycleInstance = new KnowledgeLifecycleService(config);
  }
  return lifecycleInstance;
}

export function createKnowledgeLifecycleService(
  config?: Partial<EnhancedTimeSensitivityConfig>
): KnowledgeLifecycleService {
  return new KnowledgeLifecycleService(config);
}
