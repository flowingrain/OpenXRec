/**
 * 智能更新检测服务
 * 
 * 核心功能：
 * 1. 检测新信息与已有知识的关系类型（new/update/correction/supplement/conflict）
 * 2. 时效性评估与检测
 * 3. 生成建议操作
 * 4. 与版本管理服务协同
 */

import { LLMClient, EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { KnowledgeEntry } from '../index';
import {
  KnowledgeRelationType,
  UpdateDetectionResult,
  UpdateDetectionContext,
  SuggestedAction,
  IntelligentUpdateConfig,
  DEFAULT_INTELLIGENT_UPDATE_CONFIG,
  TimeSensitivityLevel,
  TimeSensitivityAssessment,
  DEFAULT_TIME_SENSITIVITY_CONFIG,
  MergeRequest,
  MergeResult,
  MergeStrategy,
  UpdateDetectionStats,
} from './types';
import { getVersionManager, KnowledgeVersion } from './version-manager';

// ==================== 智能更新检测服务类 ====================

/**
 * 智能更新检测服务
 */
export class IntelligentUpdateService {
  private llmClient: LLMClient;
  private embeddingClient: EmbeddingClient;
  private config: IntelligentUpdateConfig;
  private supabase = getSupabaseClient();
  private stats: UpdateDetectionStats = {
    totalDetections: 0,
    byRelationType: {
      new: 0,
      update: 0,
      correction: 0,
      supplement: 0,
      conflict: 0,
    },
    autoHandledCount: 0,
    needsReviewCount: 0,
    versionCreatedCount: 0,
    rollbackCount: 0,
    avgDetectionTime: 0,
    recentDetections: [],
  };

  constructor(config?: Partial<IntelligentUpdateConfig>) {
    const sdkConfig = new Config();
    this.llmClient = new LLMClient(sdkConfig);
    this.embeddingClient = new EmbeddingClient(sdkConfig);
    this.config = { ...DEFAULT_INTELLIGENT_UPDATE_CONFIG, ...config };
  }

  // ==================== 核心接口 ====================

  /**
   * 检测新知识的更新类型
   */
  async detectUpdateType(
    context: UpdateDetectionContext
  ): Promise<UpdateDetectionResult> {
    const startTime = Date.now();
    const { newEntry, source, queryContext, userContext } = context;

    // 1. 搜索相似知识
    const similarEntries = await this.findSimilarEntries(newEntry);

    // 2. 如果没有相似条目，判定为新知识
    if (similarEntries.length === 0) {
      return this.buildResult('new', [], {
        type: 'create',
        description: '全新知识，无相似条目',
        needsReview: false,
        priority: 'low',
      }, 0.95, '未找到相似知识条目', startTime);
    }

    // 3. 分析每个相似条目的关系类型
    const relatedEntries: UpdateDetectionResult['relatedEntries'] = [];
    let primaryRelation: KnowledgeRelationType = 'new';
    let primaryEntry: { entry: KnowledgeEntry; similarity: number } | null = null;

    for (const { entry, similarity } of similarEntries) {
      const relation = await this.analyzeRelation(newEntry, entry, similarity, source);
      relatedEntries.push({
        entry,
        similarity,
        relationType: relation.type,
        reasoning: relation.reasoning,
      });

      // 选择最相关的关系作为主要关系
      if (relation.priority < this.getRelationPriority(primaryRelation)) {
        primaryRelation = relation.type;
        primaryEntry = { entry, similarity };
      }
    }

    // 4. 生成建议操作
    const suggestedAction = this.generateSuggestedAction(
      primaryRelation,
      primaryEntry?.entry || null,
      newEntry,
      source,
      userContext
    );

    // 5. 构建结果
    const result = this.buildResult(
      primaryRelation,
      relatedEntries,
      suggestedAction,
      primaryEntry?.similarity || 0,
      `与已有知识的关系类型: ${primaryRelation}`,
      startTime
    );

    // 6. 更新统计
    this.updateStats(primaryRelation, suggestedAction.type, newEntry.title);

    return result;
  }

  /**
   * 执行建议的操作
   */
  async executeAction(
    result: UpdateDetectionResult,
    newEntry: KnowledgeEntry,
    options?: {
      skipReview?: boolean;
      operator?: string;
    }
  ): Promise<{
    success: boolean;
    entryId?: string;
    versionId?: string;
    message: string;
  }> {
    const { suggestedAction } = result;
    const { skipReview = false, operator = 'system' } = options || {};

    // 检查是否需要审核
    if (suggestedAction.needsReview && !skipReview) {
      // 提交到审核队列
      await this.submitForReview(result, newEntry, operator);
      return {
        success: false,
        message: '已提交审核，等待批准',
      };
    }

    const versionManager = getVersionManager();

    switch (suggestedAction.type) {
      case 'create':
        return await this.executeCreate(newEntry, operator, versionManager);

      case 'update':
        return await this.executeUpdate(
          suggestedAction.targetId!,
          newEntry,
          operator,
          versionManager
        );

      case 'correct':
        return await this.executeCorrect(
          suggestedAction.targetId!,
          newEntry,
          operator,
          versionManager
        );

      case 'supplement':
        return await this.executeSupplement(
          suggestedAction.targetId!,
          newEntry,
          operator,
          versionManager
        );

      case 'merge':
        return await this.executeMerge(
          suggestedAction.targetId!,
          newEntry,
          suggestedAction.mergedContent!,
          operator,
          versionManager
        );

      case 'conflict_resolve':
        // 冲突解决需要专家介入
        await this.submitForReview(result, newEntry, operator);
        return {
          success: false,
          message: '存在冲突，已提交专家审核',
        };

      default:
        return {
          success: false,
          message: '未知操作类型',
        };
    }
  }

  // ==================== 关系分析 ====================

  /**
   * 查找相似的知识条目
   */
  private async findSimilarEntries(
    entry: KnowledgeEntry,
    limit: number = 5
  ): Promise<Array<{ entry: KnowledgeEntry; similarity: number }>> {
    if (!this.supabase) return [];

    try {
      // 生成查询向量
      const queryEmbedding = await this.embeddingClient.embedText(
        `${entry.title}\n${entry.content}`,
        { dimensions: 1024 }
      );

      // 使用向量搜索
      const { data, error } = await this.supabase
        .from('knowledge_entries')
        .select('*')
        .eq('status', 'active')
        .limit(50);

      if (error || !data) return [];

      // 计算相似度
      const results: Array<{ entry: KnowledgeEntry; similarity: number }> = [];
      for (const record of data) {
        if (!record.embedding) continue;

        const similarity = this.cosineSimilarity(
          queryEmbedding,
          record.embedding as number[]
        );

        if (similarity >= this.config.similarityThresholds.relatedKnowledge) {
          results.push({
            entry: this.recordToEntry(record),
            similarity,
          });
        }
      }

      // 按相似度排序
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, limit);
    } catch (error) {
      console.error('[IntelligentUpdate] Error finding similar entries:', error);
      return [];
    }
  }

  /**
   * 分析新知识与已有知识的关系类型
   */
  private async analyzeRelation(
    newEntry: KnowledgeEntry,
    existingEntry: KnowledgeEntry,
    similarity: number,
    source: UpdateDetectionContext['source']
  ): Promise<{ type: KnowledgeRelationType; reasoning: string; priority: number }> {
    // 高相似度情况下，需要仔细分析关系类型
    if (similarity >= this.config.similarityThresholds.sameKnowledge) {
      return await this.analyzeHighSimilarityRelation(newEntry, existingEntry, source);
    }

    // 中等相似度，可能是补充信息
    if (similarity >= this.config.similarityThresholds.supplementThreshold) {
      return {
        type: 'supplement',
        reasoning: `相似度 ${similarity.toFixed(2)}，可能是补充信息`,
        priority: 3,
      };
    }

    // 低相似度，判定为相关但独立的知识
    return {
      type: 'new',
      reasoning: `相似度 ${similarity.toFixed(2)} 较低，判定为独立知识`,
      priority: 5,
    };
  }

  /**
   * 分析高相似度知识的关系类型
   */
  private async analyzeHighSimilarityRelation(
    newEntry: KnowledgeEntry,
    existingEntry: KnowledgeEntry,
    source: UpdateDetectionContext['source']
  ): Promise<{ type: KnowledgeRelationType; reasoning: string; priority: number }> {
    try {
      const prompt = `分析新信息与已有知识的关系类型。

已有知识：
标题：${existingEntry.title}
内容：${existingEntry.content}
时间：${new Date(existingEntry.metadata.timestamp).toISOString()}

新信息：
标题：${newEntry.title}
内容：${newEntry.content}
来源：${source.type}
时间：${new Date(newEntry.metadata.timestamp).toISOString()}

请判断两者关系类型（只返回JSON）：
{
  "type": "update|correction|supplement|conflict",
  "reasoning": "判断依据",
  "confidence": 0.0-1.0
}

关系类型说明：
- update: 更新已有知识（如：2023年营收→2024年营收）
- correction: 纠正已有知识的错误
- supplement: 补充已有知识，增加新信息但不矛盾
- conflict: 存在矛盾，无法简单合并`;

      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是知识关系分析专家，擅长判断知识间的更新、纠正、补充关系。' },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.1,
      });

      const cleaned = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleaned);

      const priorityMap: Record<KnowledgeRelationType, number> = {
        new: 5,
        update: 1,
        correction: 2,
        supplement: 3,
        conflict: 0,
      };

      return {
        type: result.type as KnowledgeRelationType,
        reasoning: result.reasoning,
        priority: priorityMap[result.type as KnowledgeRelationType] ?? 5,
      };
    } catch (error) {
      console.error('[IntelligentUpdate] Error analyzing relation:', error);
      // 默认判定为更新
      return {
        type: 'update',
        reasoning: 'LLM分析失败，默认判定为更新',
        priority: 1,
      };
    }
  }

  /**
   * 获取关系类型的优先级（数字越小优先级越高）
   */
  private getRelationPriority(type: KnowledgeRelationType): number {
    const priorityMap: Record<KnowledgeRelationType, number> = {
      conflict: 0,
      update: 1,
      correction: 2,
      supplement: 3,
      new: 5,
    };
    return priorityMap[type];
  }

  // ==================== 操作生成 ====================

  /**
   * 生成建议的操作
   */
  private generateSuggestedAction(
    relationType: KnowledgeRelationType,
    existingEntry: KnowledgeEntry | null,
    newEntry: KnowledgeEntry,
    source: UpdateDetectionContext['source'],
    userContext?: UpdateDetectionContext['userContext']
  ): SuggestedAction {
    const isAdmin = userContext?.role === 'admin';
    const isExpert = userContext?.role === 'expert';
    const highConfidenceSource = source.confidence >= this.config.autoHandling.reviewThreshold;

    switch (relationType) {
      case 'new':
        return {
          type: 'create',
          description: '创建新知识条目',
          needsReview: false,
          priority: 'low',
        };

      case 'update':
        return {
          type: 'update',
          targetId: existingEntry?.id,
          description: '更新已有知识（时间序列数据）',
          needsReview: !this.config.autoHandling.autoAcceptUpdates && !isAdmin,
          reviewReason: '需要确认更新是否正确',
          priority: 'medium',
        };

      case 'correction':
        return {
          type: 'correct',
          targetId: existingEntry?.id,
          description: '纠正已有知识的错误',
          needsReview: !this.config.autoHandling.autoAcceptCorrections && !isExpert,
          reviewReason: '知识纠正需要专家确认',
          priority: 'high',
        };

      case 'supplement':
        return {
          type: 'supplement',
          targetId: existingEntry?.id,
          description: '补充已有知识',
          needsReview: !this.config.autoHandling.autoMergeSupplements,
          priority: 'low',
        };

      case 'conflict':
        return {
          type: 'conflict_resolve',
          targetId: existingEntry?.id,
          description: '存在冲突，需要解决',
          needsReview: true,
          reviewReason: '知识冲突需要专家判断',
          priority: 'urgent',
        };

      default:
        return {
          type: 'create',
          description: '默认创建新知识',
          needsReview: false,
          priority: 'low',
        };
    }
  }

  // ==================== 操作执行 ====================

  /**
   * 执行创建操作
   */
  private async executeCreate(
    entry: KnowledgeEntry,
    operator: string,
    versionManager: ReturnType<typeof getVersionManager>
  ): Promise<{ success: boolean; entryId?: string; versionId?: string; message: string }> {
    try {
      // 存储到数据库
      const { data, error } = await this.supabase!
        .from('knowledge_entries')
        .insert({
          id: entry.id,
          type: entry.type,
          title: entry.title,
          content: entry.content,
          source: entry.metadata.source,
          confidence: entry.metadata.confidence,
          tags: entry.metadata.tags,
          related_entities: entry.metadata.relatedEntities,
          embedding: entry.embedding,
          created_at: new Date().toISOString(),
          status: 'active',
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, message: `创建失败: ${error.message}` };
      }

      // 创建初始版本
      const version = await versionManager.createVersion(entry, 'create', '初始创建', operator, {
        type: 'system_update',
      });

      this.stats.versionCreatedCount++;

      return {
        success: true,
        entryId: data.id,
        versionId: version?.id,
        message: '知识条目创建成功',
      };
    } catch (error) {
      return {
        success: false,
        message: `创建失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 执行更新操作
   */
  private async executeUpdate(
    targetId: string,
    newEntry: KnowledgeEntry,
    operator: string,
    versionManager: ReturnType<typeof getVersionManager>
  ): Promise<{ success: boolean; entryId?: string; versionId?: string; message: string }> {
    try {
      // 获取原有条目
      const { data: existing, error: fetchError } = await this.supabase!
        .from('knowledge_entries')
        .select('*')
        .eq('id', targetId)
        .single();

      if (fetchError || !existing) {
        return { success: false, message: '未找到目标知识条目' };
      }

      const existingEntry = this.recordToEntry(existing);

      // 更新数据库
      const { error: updateError } = await this.supabase!
        .from('knowledge_entries')
        .update({
          title: newEntry.title,
          content: newEntry.content,
          confidence: newEntry.metadata.confidence,
          tags: newEntry.metadata.tags,
          embedding: newEntry.embedding,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);

      if (updateError) {
        return { success: false, message: `更新失败: ${updateError.message}` };
      }

      // 创建新版本
      const version = await versionManager.createVersion(
        { ...existingEntry, ...newEntry, id: targetId },
        'update',
        '知识更新',
        operator,
        { type: 'system_update' }
      );

      this.stats.versionCreatedCount++;

      return {
        success: true,
        entryId: targetId,
        versionId: version?.id,
        message: '知识更新成功',
      };
    } catch (error) {
      return {
        success: false,
        message: `更新失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 执行纠正操作
   */
  private async executeCorrect(
    targetId: string,
    newEntry: KnowledgeEntry,
    operator: string,
    versionManager: ReturnType<typeof getVersionManager>
  ): Promise<{ success: boolean; entryId?: string; versionId?: string; message: string }> {
    // 纠正操作与更新类似，但会标记为纠正
    const result = await this.executeUpdate(targetId, newEntry, operator, versionManager);
    if (result.success) {
      result.message = '知识纠正成功';
    }
    return result;
  }

  /**
   * 执行补充操作
   */
  private async executeSupplement(
    targetId: string,
    newEntry: KnowledgeEntry,
    operator: string,
    versionManager: ReturnType<typeof getVersionManager>
  ): Promise<{ success: boolean; entryId?: string; versionId?: string; message: string }> {
    try {
      // 获取原有条目
      const { data: existing, error: fetchError } = await this.supabase!
        .from('knowledge_entries')
        .select('*')
        .eq('id', targetId)
        .single();

      if (fetchError || !existing) {
        return { success: false, message: '未找到目标知识条目' };
      }

      const existingEntry = this.recordToEntry(existing);

      // 合并内容
      const mergedContent = `${existingEntry.content}\n\n补充信息：${newEntry.content}`;
      const mergedTags = [...new Set([...existingEntry.metadata.tags, ...newEntry.metadata.tags])];

      // 更新数据库
      const { error: updateError } = await this.supabase!
        .from('knowledge_entries')
        .update({
          content: mergedContent,
          tags: mergedTags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);

      if (updateError) {
        return { success: false, message: `补充失败: ${updateError.message}` };
      }

      // 创建新版本
      const version = await versionManager.createVersion(
        { ...existingEntry, content: mergedContent, metadata: { ...existingEntry.metadata, tags: mergedTags } },
        'supplement',
        '知识补充',
        operator,
        { type: 'system_update' }
      );

      this.stats.versionCreatedCount++;

      return {
        success: true,
        entryId: targetId,
        versionId: version?.id,
        message: '知识补充成功',
      };
    } catch (error) {
      return {
        success: false,
        message: `补充失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 执行合并操作
   */
  private async executeMerge(
    targetId: string,
    newEntry: KnowledgeEntry,
    mergedContent: string,
    operator: string,
    versionManager: ReturnType<typeof getVersionManager>
  ): Promise<{ success: boolean; entryId?: string; versionId?: string; message: string }> {
    try {
      // 更新数据库
      const { error: updateError } = await this.supabase!
        .from('knowledge_entries')
        .update({
          content: mergedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);

      if (updateError) {
        return { success: false, message: `合并失败: ${updateError.message}` };
      }

      // 创建新版本
      const version = await versionManager.createVersion(
        { ...newEntry, id: targetId, content: mergedContent },
        'merge',
        '知识合并',
        operator,
        { type: 'system_update' }
      );

      this.stats.versionCreatedCount++;

      return {
        success: true,
        entryId: targetId,
        versionId: version?.id,
        message: '知识合并成功',
      };
    } catch (error) {
      return {
        success: false,
        message: `合并失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 提交到审核队列
   */
  private async submitForReview(
    result: UpdateDetectionResult,
    entry: KnowledgeEntry,
    operator: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('knowledge_review_queue').insert({
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entry_snapshot: entry,
      detection_result: result,
      status: 'pending',
      submitted_by: operator,
      submitted_at: new Date().toISOString(),
      priority: result.suggestedAction.priority,
    });

    this.stats.needsReviewCount++;
  }

  // ==================== 时效性管理 ====================

  /**
   * 评估知识的时效性
   */
  async assessTimeSensitivity(entry: KnowledgeEntry): Promise<TimeSensitivityAssessment> {
    const config = this.config.timeSensitivity;
    const text = `${entry.title} ${entry.content}`.toLowerCase();

    // 基于关键词判断
    let detectedLevel: TimeSensitivityLevel = 'low';
    for (const [level, keywords] of Object.entries(config.keywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          detectedLevel = level as TimeSensitivityLevel;
          break;
        }
      }
    }

    // 基于数据类型判断
    const typeLevel = Object.entries(config.dataTypes).find(([_, types]) =>
      types.includes(entry.type)
    )?.[0] as TimeSensitivityLevel | undefined;

    // 取更高的时效性
    const levelPriority: Record<TimeSensitivityLevel, number> = {
      realtime: 5,
      high: 4,
      medium: 3,
      low: 2,
      permanent: 1,
    };

    const finalLevel = (typeLevel && levelPriority[typeLevel] > levelPriority[detectedLevel])
      ? typeLevel
      : detectedLevel;

    // 计算过期时间
    const expiryHours = config.expiryHours[finalLevel];
    const expiresAt = expiryHours === Infinity
      ? Infinity
      : Date.now() + expiryHours * 60 * 60 * 1000;

    return {
      level: finalLevel,
      expiresAt,
      isExpired: false,
      timeToExpiry: expiresAt === Infinity ? Infinity : expiresAt - Date.now(),
      reasoning: `基于关键词和类型判断，时效性级别: ${finalLevel}`,
    };
  }

  /**
   * 检查知识是否过期
   */
  async checkExpired(entryId: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { data } = await this.supabase
      .from('knowledge_entries')
      .select('created_at, time_sensitivity')
      .eq('id', entryId)
      .single();

    if (!data) return true;

    const sensitivity = data.time_sensitivity as TimeSensitivityLevel;
    const expiryHours = this.config.timeSensitivity.expiryHours[sensitivity] || Infinity;

    if (expiryHours === Infinity) return false;

    const createdAt = new Date(data.created_at).getTime();
    const expiresAt = createdAt + expiryHours * 60 * 60 * 1000;

    return Date.now() > expiresAt;
  }

  /**
   * 清理过期知识
   */
  async cleanupExpiredKnowledge(): Promise<number> {
    if (!this.supabase) return 0;

    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('knowledge_entries')
      .update({ status: 'expired' })
      .lt('expires_at', now)
      .eq('status', 'active')
      .select('id');

    return data?.length || 0;
  }

  // ==================== 智能合并 ====================

  /**
   * 智能合并知识
   */
  async mergeKnowledge(request: MergeRequest): Promise<MergeResult> {
    const { original, newInfo, strategy } = request;
    const conflictedFields: MergeResult['conflictedFields'] = [];

    // 默认使用 LLM 合并策略
    if (strategy === 'llm_merge') {
      return this.llmMerge(original, newInfo);
    }

    // 简单策略处理
    let mergedContent = original.content;
    let mergedTitle = original.title;
    const mergedFields: string[] = [];
    const keptFields: string[] = [];

    if (newInfo.content) {
      switch (strategy) {
        case 'keep_newer':
        case 'keep_higher_confidence':
          mergedContent = newInfo.content;
          mergedFields.push('content');
          break;
        case 'union':
          mergedContent = `${original.content}\n\n补充：${newInfo.content}`;
          mergedFields.push('content');
          break;
        case 'intersect':
          // 只保留一致的部分
          if (original.content.includes(newInfo.content)) {
            mergedContent = original.content;
            keptFields.push('content');
          } else {
            conflictedFields.push({
              field: 'content',
              originalValue: original.content,
              newValue: newInfo.content,
              resolution: 'original',
            });
          }
          break;
      }
    }

    return {
      success: true,
      mergedEntry: {
        ...original,
        title: mergedTitle,
        content: mergedContent,
        metadata: {
          ...original.metadata,
          ...newInfo.metadata,
        },
      },
      mergedFields,
      keptFields,
      conflictedFields,
      description: `使用 ${strategy} 策略合并完成`,
    };
  }

  /**
   * 使用 LLM 智能合并
   */
  private async llmMerge(
    original: KnowledgeEntry,
    newInfo: MergeRequest['newInfo']
  ): Promise<MergeResult> {
    try {
      const prompt = `智能合并两条知识。

原始知识：
标题：${original.title}
内容：${original.content}

新信息：
${newInfo.title ? `标题：${newInfo.title}` : ''}
${newInfo.content ? `内容：${newInfo.content}` : ''}

请生成合并后的知识内容，要求：
1. 保留原始知识的核心信息
2. 合并新信息中有价值的部分
3. 消除矛盾和重复
4. 保持内容的连贯性

只返回JSON格式：
{
  "title": "合并后的标题",
  "content": "合并后的内容",
  "mergedFields": ["content"],
  "conflicts": [
    {"field": "xxx", "original": "旧值", "new": "新值", "resolution": "merged|original|new"}
  ],
  "description": "合并说明"
}`;

      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是知识合并专家，擅长整合多条知识并消除矛盾。' },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.1,
      });

      const cleaned = response.content.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleaned);

      return {
        success: true,
        mergedEntry: {
          ...original,
          title: result.title || original.title,
          content: result.content || original.content,
        },
        mergedFields: result.mergedFields || [],
        keptFields: [],
        conflictedFields: (result.conflicts || []).map((c: any) => ({
          field: c.field,
          originalValue: c.original,
          newValue: c.new,
          resolution: c.resolution,
        })),
        description: result.description,
      };
    } catch (error) {
      return {
        success: false,
        mergedFields: [],
        keptFields: [],
        conflictedFields: [],
        description: `LLM合并失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 构建检测结果
   */
  private buildResult(
    relationType: KnowledgeRelationType,
    relatedEntries: UpdateDetectionResult['relatedEntries'],
    suggestedAction: SuggestedAction,
    confidence: number,
    reasoning: string,
    startTime: number
  ): UpdateDetectionResult {
    const detectionTime = Date.now() - startTime;
    this.stats.avgDetectionTime = (this.stats.avgDetectionTime + detectionTime) / 2;

    return {
      relationType,
      relatedEntries,
      suggestedAction,
      confidence,
      reasoning,
      detectedAt: Date.now(),
    };
  }

  /**
   * 更新统计信息
   */
  private updateStats(
    relationType: KnowledgeRelationType,
    actionType: string,
    entryTitle: string
  ): void {
    this.stats.totalDetections++;
    this.stats.byRelationType[relationType]++;

    if (['update', 'supplement'].includes(actionType)) {
      this.stats.autoHandledCount++;
    }

    this.stats.recentDetections.unshift({
      timestamp: Date.now(),
      relationType,
      action: actionType,
      entryTitle: entryTitle.substring(0, 50),
    });

    // 保留最近100条
    if (this.stats.recentDetections.length > 100) {
      this.stats.recentDetections.pop();
    }
  }

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

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): UpdateDetectionStats {
    return { ...this.stats };
  }
}

// ==================== 单例管理 ====================

let instance: IntelligentUpdateService | null = null;

export function getIntelligentUpdateService(
  config?: Partial<IntelligentUpdateConfig>
): IntelligentUpdateService {
  if (!instance) {
    instance = new IntelligentUpdateService(config);
  }
  return instance;
}

export function createIntelligentUpdateService(
  config?: Partial<IntelligentUpdateConfig>
): IntelligentUpdateService {
  return new IntelligentUpdateService(config);
}
