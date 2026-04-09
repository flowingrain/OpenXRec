/**
 * 统一存储服务入口
 * 
 * 架构设计：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    UnifiedStorageService                        │
 * │  ┌─────────────────────────────────────────────────────────┐   │
 * │  │                    统一查询接口                          │   │
 * │  │  - unifiedSearch()                                       │   │
 * │  │  - healthCheck()                                         │   │
 * │  └─────────────────────────────────────────────────────────┘   │
 * │                              ↓                                  │
 * │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
 * │  │ Database  │  │ Knowledge │  │   Case    │  │  Vector   │   │
 * │  │  Layer    │  │   Layer   │  │   Layer   │  │   Layer   │   │
 * │  │ (元数据)  │  │ (事实层)  │  │ (经验层)  │  │ (索引层)  │   │
 * │  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { DatabaseLayer, getDatabaseLayer } from './layers/database-layer';
import { KnowledgeLayer, getKnowledgeLayer } from './layers/knowledge-layer';
import { CaseLayer, getCaseLayer } from './layers/case-layer';
import { VectorLayer, getVectorLayer } from './layers/vector-layer';
import {
  IStorageService,
  IDatabaseLayer,
  IKnowledgeLayer,
  ICaseLayer,
  IVectorLayer,
  StorageResult,
  BatchStorageResult,
  StorageLayer,
  KnowledgeEntry,
  AnalysisCase,
  VectorSearchResult,
  UserProfile,
  SystemConfig,
  InteractionLog,
  UserFeedback,
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeVersion,
  CaseTemplate,
  VectorIndexRecord,
  VectorSearchOptions,
  QueryOptions,
} from './types';

/**
 * 统一存储服务实现
 */
export class UnifiedStorageService implements IStorageService {
  private _database: DatabaseLayer;
  private _knowledge: KnowledgeLayer;
  private _cases: CaseLayer;
  private _vectors: VectorLayer;
  private initialized: boolean = false;

  constructor() {
    this._database = getDatabaseLayer();
    this._knowledge = getKnowledgeLayer();
    this._cases = getCaseLayer();
    this._vectors = getVectorLayer();
  }

  /**
   * 初始化所有层
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[UnifiedStorageService] Initializing all layers...');

    await Promise.all([
      this._database.initialize(),
      this._knowledge.initialize(),
      this._cases.initialize(),
      this._vectors.initialize(),
    ]);

    this.initialized = true;
    console.log('[UnifiedStorageService] All layers initialized');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ layer: StorageLayer; status: 'healthy' | 'unhealthy'; message?: string }[]> {
    const results: { layer: StorageLayer; status: 'healthy' | 'unhealthy'; message?: string }[] = [];

    // 检查数据库层
    try {
      await this._database.getUserProfile('health_check_test');
      results.push({ layer: 'database', status: 'healthy' });
    } catch (e) {
      results.push({ layer: 'database', status: 'unhealthy', message: String(e) });
    }

    // 检查知识库层
    try {
      await this._knowledge.searchEntities('health_check_test', { limit: 1 });
      results.push({ layer: 'knowledge', status: 'healthy' });
    } catch (e) {
      results.push({ layer: 'knowledge', status: 'unhealthy', message: String(e) });
    }

    // 检查案例库层
    try {
      await this._cases.searchCases('health_check_test', { limit: 1 });
      results.push({ layer: 'case', status: 'healthy' });
    } catch (e) {
      results.push({ layer: 'case', status: 'unhealthy', message: String(e) });
    }

    // 检查向量库层
    try {
      await this._vectors.getStats();
      results.push({ layer: 'vector', status: 'healthy' });
    } catch (e) {
      results.push({ layer: 'vector', status: 'unhealthy', message: String(e) });
    }

    return results;
  }

  // ============================================================================
  // 层级访问
  // ============================================================================

  get database(): IDatabaseLayer {
    return this._database;
  }

  get knowledge(): IKnowledgeLayer {
    return this._knowledge;
  }

  get cases(): ICaseLayer {
    return this._cases;
  }

  get vectors(): IVectorLayer {
    return this._vectors;
  }

  // ============================================================================
  // 统一查询
  // ============================================================================

  /**
   * 统一搜索
   * 
   * 同时搜索知识库、案例库、向量库，并可选调用在线搜索
   */
  async unifiedSearch(
    query: string,
    options?: {
      includeKnowledge?: boolean;
      includeCases?: boolean;
      useVectorSearch?: boolean;
      useOnlineSearch?: boolean;
    }
  ): Promise<
    StorageResult<{
      knowledge: KnowledgeEntry[];
      cases: AnalysisCase[];
      vectorResults: VectorSearchResult[];
      onlineResults?: any[];
    }>
  > {
    const startTime = Date.now();

    try {
      const includeKnowledge = options?.includeKnowledge !== false;
      const includeCases = options?.includeCases !== false;
      const useVectorSearch = options?.useVectorSearch !== false;

      // 并行执行搜索
      const [knowledgeResult, casesResult, vectorResult] = await Promise.all([
        includeKnowledge ? this._knowledge.searchEntries(query, { limit: 5 }) : Promise.resolve({ success: true, data: [] }),
        includeCases ? this._cases.searchCases(query, { limit: 5 }) : Promise.resolve({ success: true, data: [] }),
        useVectorSearch
          ? this._vectors
              .generateEmbedding(query)
              .then((embedding) =>
                embedding
                  ? this._vectors.search(embedding, { topK: 10 })
                  : { success: true, data: [] }
              )
          : Promise.resolve({ success: true, data: [] }),
      ]);

      // 如果启用在线搜索，可以在这里调用 Web Search API
      let onlineResults: any[] | undefined;
      if (options?.useOnlineSearch) {
        // 在线搜索需要单独调用 Web Search API
        // 这里暂不实现，由上层调用
      }

      return {
        success: true,
        data: {
          knowledge: knowledgeResult.success ? knowledgeResult.data || [] : [],
          cases: casesResult.success ? casesResult.data || [] : [],
          vectorResults: vectorResult.success ? vectorResult.data || [] : [],
          onlineResults,
        },
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ============================================================================
  // 数据库层代理方法
  // ============================================================================

  async getUserProfile(userId: string): Promise<StorageResult<UserProfile>> {
    return this._database.getUserProfile(userId);
  }

  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<StorageResult<UserProfile>> {
    return this._database.updateUserProfile(userId, profile);
  }

  async getConfig(key: string): Promise<StorageResult<SystemConfig>> {
    return this._database.getConfig(key);
  }

  async setConfig(key: string, value: any, updatedBy: string): Promise<StorageResult<SystemConfig>> {
    return this._database.setConfig(key, value, updatedBy);
  }

  async logInteraction(log: Omit<InteractionLog, 'id' | 'createdAt'>): Promise<StorageResult<InteractionLog>> {
    return this._database.logInteraction(log);
  }

  async getInteractionLogs(filters: Record<string, any>, options?: QueryOptions): Promise<StorageResult<InteractionLog[]>> {
    return this._database.getInteractionLogs(filters, options);
  }

  async saveFeedback(feedback: Omit<UserFeedback, 'id' | 'createdAt'>): Promise<StorageResult<UserFeedback>> {
    return this._database.saveFeedback(feedback);
  }

  async getFeedback(targetId: string): Promise<StorageResult<UserFeedback[]>> {
    return this._database.getFeedback(targetId);
  }

  // ============================================================================
  // 知识库层代理方法
  // ============================================================================

  async createEntity(entity: Omit<KnowledgeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<KnowledgeEntity>> {
    return this._knowledge.createEntity(entity);
  }

  async getEntity(id: string): Promise<StorageResult<KnowledgeEntity>> {
    return this._knowledge.getEntity(id);
  }

  async updateEntity(id: string, updates: Partial<KnowledgeEntity>): Promise<StorageResult<KnowledgeEntity>> {
    return this._knowledge.updateEntity(id, updates);
  }

  async deleteEntity(id: string): Promise<StorageResult<void>> {
    return this._knowledge.deleteEntity(id);
  }

  async searchEntities(query: string, options?: QueryOptions): Promise<StorageResult<KnowledgeEntity[]>> {
    return this._knowledge.searchEntities(query, options);
  }

  async createRelation(relation: Omit<KnowledgeRelation, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<KnowledgeRelation>> {
    return this._knowledge.createRelation(relation);
  }

  async getRelation(id: string): Promise<StorageResult<KnowledgeRelation>> {
    return this._knowledge.getRelation(id);
  }

  async getRelationsByEntity(entityId: string): Promise<StorageResult<KnowledgeRelation[]>> {
    return this._knowledge.getRelationsByEntity(entityId);
  }

  async deleteRelation(id: string): Promise<StorageResult<void>> {
    return this._knowledge.deleteRelation(id);
  }

  async createEntry(entry: KnowledgeEntry): Promise<StorageResult<KnowledgeEntry>> {
    return this._knowledge.createEntry(entry);
  }

  async getEntry(id: string): Promise<StorageResult<KnowledgeEntry>> {
    return this._knowledge.getEntry(id);
  }

  async updateEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<StorageResult<KnowledgeEntry>> {
    return this._knowledge.updateEntry(id, updates);
  }

  async deleteEntry(id: string): Promise<StorageResult<void>> {
    return this._knowledge.deleteEntry(id);
  }

  async searchEntries(query: string, options?: QueryOptions): Promise<StorageResult<KnowledgeEntry[]>> {
    return this._knowledge.searchEntries(query, options);
  }

  async getVersionHistory(entryId: string): Promise<StorageResult<KnowledgeVersion[]>> {
    return this._knowledge.getVersionHistory(entryId);
  }

  async rollbackVersion(entryId: string, versionId: string): Promise<StorageResult<KnowledgeEntry>> {
    return this._knowledge.rollbackVersion(entryId, versionId);
  }

  // ============================================================================
  // 案例库层代理方法
  // ============================================================================

  async createCase(caseData: Omit<AnalysisCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<AnalysisCase>> {
    return this._cases.createCase(caseData);
  }

  async getCase(id: string): Promise<StorageResult<AnalysisCase>> {
    return this._cases.getCase(id);
  }

  async updateCase(id: string, updates: Partial<AnalysisCase>): Promise<StorageResult<AnalysisCase>> {
    return this._cases.updateCase(id, updates);
  }

  async deleteCase(id: string): Promise<StorageResult<void>> {
    return this._cases.deleteCase(id);
  }

  async searchCases(query: string, options?: QueryOptions): Promise<StorageResult<AnalysisCase[]>> {
    return this._cases.searchCases(query, options);
  }

  async createTemplate(template: Omit<CaseTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'successRate'>): Promise<StorageResult<CaseTemplate>> {
    return this._cases.createTemplate(template);
  }

  async getTemplate(id: string): Promise<StorageResult<CaseTemplate>> {
    return this._cases.getTemplate(id);
  }

  async listTemplates(domain?: string): Promise<StorageResult<CaseTemplate[]>> {
    return this._cases.listTemplates(domain);
  }

  // ============================================================================
  // 向量库层代理方法
  // ============================================================================

  async indexVector(record: Omit<VectorIndexRecord, 'id' | 'createdAt'>): Promise<StorageResult<VectorIndexRecord>> {
    return this._vectors.indexVector(record);
  }

  async batchIndex(records: Array<Omit<VectorIndexRecord, 'id' | 'createdAt'>>): Promise<BatchStorageResult<VectorIndexRecord>> {
    return this._vectors.batchIndex(records);
  }

  async deleteVector(id: string): Promise<StorageResult<void>> {
    return this._vectors.deleteVector(id);
  }

  async deleteBySource(sourceType: string, sourceId: string): Promise<StorageResult<void>> {
    return this._vectors.deleteBySource(sourceType, sourceId);
  }

  async search(vector: number[], options?: VectorSearchOptions): Promise<StorageResult<VectorSearchResult[]>> {
    return this._vectors.search(vector, options);
  }

  async getStats(): Promise<StorageResult<{ total: number; bySource: Record<string, number>; byModel: Record<string, number>; avgDimension: number }>> {
    return this._vectors.getStats();
  }
}

// ============================================================================
// 导出单例
// ============================================================================

let storageServiceInstance: UnifiedStorageService | null = null;

export function getStorageService(): UnifiedStorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new UnifiedStorageService();
  }
  return storageServiceInstance;
}

// 初始化存储服务
export async function initializeStorage(): Promise<UnifiedStorageService> {
  const service = getStorageService();
  await service.initialize();
  return service;
}

// 导出类型
export * from './types';
export { DatabaseLayer } from './layers/database-layer';
export { KnowledgeLayer } from './layers/knowledge-layer';
export { CaseLayer } from './layers/case-layer';
export { VectorLayer } from './layers/vector-layer';
