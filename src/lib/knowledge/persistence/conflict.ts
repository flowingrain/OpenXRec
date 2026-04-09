/**
 * 知识冲突检测服务
 * 
 * 功能：
 * 1. 检测知识矛盾
 * 2. 检测重复内容
 * 3. 检测语义重叠
 * 4. 自动/手动解决冲突
 */

import { LLMClient, EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import { SupabaseKnowledgeStorage } from './storage';
import {
  KnowledgeConflict,
  ConflictType,
  ConflictDetectionConfig,
  DEFAULT_CONFLICT_CONFIG,
  ConflictDetectionResult,
} from './types';
import { KnowledgeEntry } from '../index';

// ============================================================================
// 冲突检测服务类
// ============================================================================

export class ConflictDetectionService {
  private storage: SupabaseKnowledgeStorage;
  private config: ConflictDetectionConfig;
  private llmClient: LLMClient;
  private embeddingClient: EmbeddingClient;
  private conflictLog: KnowledgeConflict[] = [];

  constructor(
    storage: SupabaseKnowledgeStorage,
    customHeaders?: Record<string, string>,
    config?: Partial<ConflictDetectionConfig>
  ) {
    this.storage = storage;
    this.config = { ...DEFAULT_CONFLICT_CONFIG, ...config };
    
    const sdkConfig = new Config();
    this.llmClient = new LLMClient(sdkConfig, customHeaders);
    this.embeddingClient = new EmbeddingClient(sdkConfig, customHeaders);
  }

  // ===========================================================================
  // 核心检测接口
  // ===========================================================================

  /**
   * 检测新条目与现有知识的冲突
   */
  async detectConflicts(newEntry: KnowledgeEntry): Promise<ConflictDetectionResult> {
    if (!this.config.enabled) {
      return { conflicts: [], totalChecked: 0, conflictRate: 0 };
    }
    
    const conflicts: KnowledgeConflict[] = [];
    
    // 1. 检测语义相似度（重复/重叠）
    const semanticConflicts = await this.detectSemanticConflicts(newEntry);
    conflicts.push(...semanticConflicts);
    
    // 2. 检测内容矛盾
    const contradictionConflicts = await this.detectContradictions(newEntry);
    conflicts.push(...contradictionConflicts);
    
    // 3. 自动解决简单冲突
    if (this.config.autoResolve) {
      await this.autoResolveConflicts(conflicts);
    }
    
    const totalChecked = semanticConflicts.length + contradictionConflicts.length;
    
    return {
      conflicts,
      totalChecked,
      conflictRate: totalChecked > 0 ? conflicts.length / totalChecked : 0,
    };
  }

  /**
   * 批量检测冲突
   */
  async batchDetect(entries: KnowledgeEntry[]): Promise<Map<string, ConflictDetectionResult>> {
    const results = new Map<string, ConflictDetectionResult>();
    
    for (const entry of entries) {
      const result = await this.detectConflicts(entry);
      results.set(entry.id, result);
    }
    
    return results;
  }

  /**
   * 全库冲突扫描
   */
  async fullScan(): Promise<ConflictDetectionResult> {
    if (!this.config.enabled) {
      return { conflicts: [], totalChecked: 0, conflictRate: 0 };
    }
    
    const { entries } = await this.storage.search({ limit: 1000 });
    const allConflicts: KnowledgeConflict[] = [];
    let totalChecked = 0;
    
    // 两两比较
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const conflict = await this.compareEntries(entries[i], entries[j]);
        if (conflict) {
          allConflicts.push(conflict);
        }
        totalChecked++;
      }
    }
    
    return {
      conflicts: allConflicts,
      totalChecked,
      conflictRate: allConflicts.length / Math.max(totalChecked, 1),
    };
  }

  // ===========================================================================
  // 冲突解决
  // ===========================================================================

  /**
   * 解决冲突
   */
  async resolveConflict(
    conflict: KnowledgeConflict,
    resolution: {
      keep: 'entry1' | 'entry2' | 'both';
      reason: string;
      resolvedBy: string;
    }
  ): Promise<void> {
    const { keep, reason, resolvedBy } = resolution;
    
    conflict.resolution = 'expert_review';
    conflict.resolvedAt = Date.now();
    conflict.resolvedBy = resolvedBy;
    conflict.resolutionNotes = reason;
    
    // 根据选择更新条目状态
    if (keep === 'entry1') {
      await this.storage.update(conflict.entryId2, {
        status: 'conflicted',
        conflict_with: [conflict.entryId1],
      });
    } else if (keep === 'entry2') {
      await this.storage.update(conflict.entryId1, {
        status: 'conflicted',
        conflict_with: [conflict.entryId2],
      });
    }
    // both: 保留两者，仅标记冲突
    
    this.conflictLog.push(conflict);
  }

  /**
   * 获取未解决的冲突
   */
  getUnresolvedConflicts(): KnowledgeConflict[] {
    return this.conflictLog.filter(c => c.resolution === 'pending');
  }

  /**
   * 获取冲突历史
   */
  getConflictHistory(limit: number = 50): KnowledgeConflict[] {
    return this.conflictLog.slice(-limit);
  }

  // ===========================================================================
  // 内部检测方法
  // ===========================================================================

  /**
   * 检测语义冲突（重复/重叠）
   */
  private async detectSemanticConflicts(entry: KnowledgeEntry): Promise<KnowledgeConflict[]> {
    const conflicts: KnowledgeConflict[] = [];
    
    // 向量搜索相似条目
    const similar = await this.storage.vectorSearch(entry.content, {
      limit: 10,
      threshold: this.config.similarityThreshold,
    });
    
    for (const { entry: existing, similarity } of similar) {
      if (existing.id === entry.id) continue;
      
      const conflictType: ConflictType = similarity > 0.95 
        ? 'duplication' 
        : 'semantic_overlap';
      
      conflicts.push({
        id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: conflictType,
        entryId1: entry.id,
        entryId2: existing.id,
        description: `语义相似度: ${(similarity * 100).toFixed(1)}%`,
        detectedAt: Date.now(),
        resolution: 'pending',
        confidence: similarity,
      });
    }
    
    return conflicts;
  }

  /**
   * 检测内容矛盾
   */
  private async detectContradictions(entry: KnowledgeEntry): Promise<KnowledgeConflict[]> {
    const conflicts: KnowledgeConflict[] = [];
    
    // 使用LLM检测矛盾
    const relatedEntries = await this.storage.search({
      query: entry.title,
      limit: 5,
    });
    
    for (const existing of relatedEntries.entries) {
      if (existing.id === entry.id) continue;
      
      const hasContradiction = await this.llmCheckContradiction(entry, existing);
      
      if (hasContradiction) {
        conflicts.push({
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'contradiction',
          entryId1: entry.id,
          entryId2: existing.id,
          description: '内容存在矛盾',
          detectedAt: Date.now(),
          resolution: 'pending',
          confidence: this.config.contradictionThreshold,
        });
      }
    }
    
    return conflicts;
  }

  /**
   * 比较两个条目
   */
  private async compareEntries(
    entry1: KnowledgeEntry,
    entry2: KnowledgeEntry
  ): Promise<KnowledgeConflict | null> {
    // 计算语义相似度
    const similarity = await this.computeSimilarity(entry1.content, entry2.content);
    
    if (similarity > this.config.similarityThreshold) {
      return {
        id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: similarity > 0.95 ? 'duplication' : 'semantic_overlap',
        entryId1: entry1.id,
        entryId2: entry2.id,
        description: `语义相似度: ${(similarity * 100).toFixed(1)}%`,
        detectedAt: Date.now(),
        resolution: 'pending',
        confidence: similarity,
      };
    }
    
    return null;
  }

  /**
   * 使用LLM检测矛盾
   */
  private async llmCheckContradiction(
    entry1: KnowledgeEntry,
    entry2: KnowledgeEntry
  ): Promise<boolean> {
    try {
      const prompt = `判断以下两条知识是否存在矛盾或冲突。

知识1：${entry1.title}
${entry1.content}

知识2：${entry2.title}
${entry2.content}

请回答：如果存在矛盾或冲突，回答"YES"；否则回答"NO"。`;

      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.1,
      });
      
      return response.content.trim().toUpperCase().includes('YES');
    } catch {
      return false;
    }
  }

  /**
   * 计算语义相似度
   */
  private async computeSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const [vec1, vec2] = await Promise.all([
        this.embeddingClient.embedText(text1.substring(0, 1000)),
        this.embeddingClient.embedText(text2.substring(0, 1000)),
      ]);
      
      return this.cosineSimilarity(vec1 || [], vec2 || []);
    } catch {
      return 0;
    }
  }

  /**
   * 余弦相似度
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
   * 自动解决冲突
   */
  private async autoResolveConflicts(conflicts: KnowledgeConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      // 只自动解决重复冲突
      if (conflict.type === 'duplication') {
        const entry1 = await this.storage.get(conflict.entryId1);
        const entry2 = await this.storage.get(conflict.entryId2);
        
        if (!entry1 || !entry2) continue;
        
        // 根据策略选择保留哪个
        let toKeep: string;
        let toArchive: string;
        
        switch (this.config.resolutionStrategy) {
          case 'keep_newer':
            toKeep = entry1.metadata.timestamp > entry2.metadata.timestamp 
              ? conflict.entryId1 : conflict.entryId2;
            break;
          case 'keep_higher_confidence':
            toKeep = entry1.metadata.confidence > entry2.metadata.confidence 
              ? conflict.entryId1 : conflict.entryId2;
            break;
          case 'keep_preset':
            toKeep = entry1.metadata.isPreset 
              ? conflict.entryId1 
              : (entry2.metadata.isPreset ? conflict.entryId2 : conflict.entryId1);
            break;
          default:
            toKeep = conflict.entryId1;
        }
        
        toArchive = toKeep === conflict.entryId1 ? conflict.entryId2 : conflict.entryId1;
        
        await this.storage.update(toArchive, {
          status: 'conflicted',
          conflict_with: [toKeep],
        });
        
        conflict.resolution = 'auto_resolved';
        conflict.resolvedAt = Date.now();
        conflict.resolvedBy = 'system';
        conflict.resolutionNotes = `自动解决：保留 ${toKeep}，归档 ${toArchive}`;
      }
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let conflictInstance: ConflictDetectionService | null = null;

export function getConflictDetectionService(
  storage?: SupabaseKnowledgeStorage,
  customHeaders?: Record<string, string>,
  config?: Partial<ConflictDetectionConfig>
): ConflictDetectionService {
  if (!conflictInstance) {
    const storageInstance = storage || new SupabaseKnowledgeStorage(customHeaders);
    conflictInstance = new ConflictDetectionService(storageInstance, customHeaders, config);
  }
  return conflictInstance;
}

export function createConflictDetectionService(
  storage: SupabaseKnowledgeStorage,
  customHeaders?: Record<string, string>,
  config?: Partial<ConflictDetectionConfig>
): ConflictDetectionService {
  return new ConflictDetectionService(storage, customHeaders, config);
}
