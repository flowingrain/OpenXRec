/**
 * 存储系统类型定义
 * 
 * 架构设计：
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        数据存储分层架构                          │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  在线检索层 (Web Search) - 实时数据，不持久化                     │
 * │                              ↓                                  │
 * │  RAG检索层 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
 * │            │   向量库     │←→│   知识库     │←→│   案例库     │   │
 * │            │  (索引层)    │  │  (事实层)    │  │  (经验层)    │   │
 * │            └─────────────┘  └─────────────┘  └─────────────┘   │
 * │                              ↓                                  │
 * │  数据库层 (Supabase) - 元数据、配置、日志、事务                   │
 * └─────────────────────────────────────────────────────────────────┘
 */

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 存储层级
 */
export type StorageLayer = 'database' | 'knowledge' | 'case' | 'vector' | 'online';

/**
 * 数据时效性级别
 */
export type TimeSensitivityLevel = 'realtime' | 'high' | 'medium' | 'low' | 'permanent';

/**
 * 数据状态
 */
export type DataStatus = 'active' | 'expired' | 'conflicted' | 'pending_review' | 'archived' | 'superseded';

/**
 * 知识来源类型
 */
export type KnowledgeSourceType = 
  | 'user_input'       // 用户输入
  | 'web_search'       // 网络搜索
  | 'llm_generated'    // LLM生成
  | 'document_upload'  // 文档上传
  | 'auto_extract'     // 自动提取
  | 'feedback_learn'   // 反馈学习
  | 'preset';          // 预置知识

// ============================================================================
// 知识库层类型（事实知识层）
// ============================================================================

/**
 * 知识实体
 */
export interface KnowledgeEntity {
  id: string;
  name: string;
  type: 'company' | 'person' | 'concept' | 'event' | 'policy' | 'product' | 'location' | 'other';
  aliases: string[];
  description: string;
  properties: Record<string, any>;
  importance: number;  // 0-1
  source: KnowledgeSourceType;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * 知识关系
 */
export interface KnowledgeRelation {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;  // 关系类型：投资、竞争、合作等
  confidence: number;
  evidence?: string;
  properties: Record<string, any>;
  source: KnowledgeSourceType;
  verified: boolean;
  validFrom?: number;
  validTo?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 知识规则
 */
export interface KnowledgeRule {
  id: string;
  name: string;
  type: 'business' | 'logic' | 'constraint' | 'inference';
  condition: string;
  action: string;
  priority: number;
  enabled: boolean;
  source: KnowledgeSourceType;
  createdAt: number;
  updatedAt: number;
}

/**
 * 知识条目（综合）
 */
export interface KnowledgeEntry {
  id: string;
  type: 'economic_indicator' | 'event' | 'entity' | 'policy' | 'relationship' | 'market_data';
  title: string;
  content: string;
  metadata: {
    source: KnowledgeSourceType;
    confidence: number;
    timestamp: number;
    tags: string[];
    relatedEntities: string[];
    impact?: string;
    region?: string;
    sector?: string;
    isPreset?: boolean;
  };
  embedding?: number[];
}

/**
 * 知识版本
 */
export interface KnowledgeVersion {
  id: string;
  entryId: string;
  version: number;
  snapshot: KnowledgeEntry;
  changeType: 'create' | 'update' | 'correct' | 'supplement' | 'merge' | 'restore';
  changeDescription: string;
  changeSource: {
    type: KnowledgeSourceType;
    reference?: string;
    userId?: string;
  };
  diff?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  createdAt: number;
  createdBy: string;
  isCurrent: boolean;
  tags: string[];
}

// ============================================================================
// 案例库层类型（经验知识层）
// ============================================================================

/**
 * 分析案例
 */
export interface AnalysisCase {
  id: string;
  query: string;
  domain: string;
  context: {
    userProfile?: Record<string, any>;
    sessionContext?: Record<string, any>;
    knowledgeUsed: string[];  // 使用的知识ID
    searchUsed: boolean;
  };
  process: {
    intentAnalysis?: any;
    candidateGeneration?: any;
    ranking?: any;
    explanation?: any;
  };
  result: {
    recommendations: Array<{
      id: string;
      type: string;
      content: any;
      score: number;
      explanation: string;
    }>;
    summary: string;
    confidence: number;
  };
  feedback?: {
    rating?: number;
    comment?: string;
    helpful?: boolean;
    timestamp: number;
  };
  metadata: {
    qualityScore?: number;
    tags: string[];
    status: 'completed' | 'partial' | 'failed';
    duration?: number;
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * 案例模板
 */
export interface CaseTemplate {
  id: string;
  name: string;
  description: string;
  domain: string;
  template: {
    queryPattern: string;
    analysisSteps: string[];
    outputFormat: string;
  };
  usageCount: number;
  successRate: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// 向量库层类型（语义索引层）
// ============================================================================

/**
 * 向量索引记录
 */
export interface VectorIndexRecord {
  id: string;
  vector: number[];
  sourceType: 'entity' | 'case' | 'knowledge' | 'query';
  sourceId: string;
  model: string;
  dimension: number;
  textPreview: string;
  metadata: Record<string, any>;
  createdAt: number;
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  record: VectorIndexRecord;
  similarity: number;
  distance: number;
}

/**
 * 向量索引统计
 */
export interface VectorIndexStats {
  total: number;
  bySource: Record<string, number>;
  byModel: Record<string, number>;
  avgDimension: number;
}

// ============================================================================
// 数据库层类型（元数据与事务层）
// ============================================================================

/**
 * 用户画像
 */
export interface UserProfile {
  id: string;
  userId: string;
  preferences: {
    domains: string[];
    explanationDetail: 'brief' | 'normal' | 'detailed';
    responseStyle: 'formal' | 'casual' | 'technical';
  };
  behavior: {
    queryCount: number;
    feedbackCount: number;
    avgRating: number;
    lastActiveAt: number;
  };
  interests: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 系统配置
 */
export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  category: string;
  description?: string;
  updatedAt: number;
  updatedBy: string;
}

/**
 * 交互日志
 */
export interface InteractionLog {
  id: string;
  userId?: string;
  sessionId: string;
  type: 'query' | 'click' | 'feedback' | 'search';
  data: Record<string, any>;
  metadata: {
    userAgent?: string;
    ip?: string;
    referrer?: string;
  };
  createdAt: number;
}

/**
 * 用户反馈
 */
export interface UserFeedback {
  id: string;
  userId?: string;
  targetId: string;
  targetType: 'recommendation' | 'case' | 'knowledge';
  type: 'rating' | 'comment' | 'helpful' | 'report';
  value: number | string | boolean;
  metadata?: Record<string, any>;
  createdAt: number;
}

// ============================================================================
// 存储操作类型
// ============================================================================

/**
 * 存储操作结果
 */
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  affected?: number;
  duration?: number;
}

/**
 * 批量存储结果
 */
export interface BatchStorageResult<T = any> extends StorageResult<T[]> {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
  includeEmbedding?: boolean;
}

/**
 * 向量搜索选项
 */
export interface VectorSearchOptions {
  topK?: number;
  minSimilarity?: number;
  sourceTypes?: Array<'entity' | 'case' | 'knowledge' | 'query'>;
  filters?: Record<string, any>;
  includeMetadata?: boolean;
}

// ============================================================================
// 存储层接口定义
// ============================================================================

/**
 * 数据库层接口（元数据与事务）
 */
export interface IDatabaseLayer {
  // 用户管理
  getUserProfile(userId: string): Promise<StorageResult<UserProfile>>;
  updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<StorageResult<UserProfile>>;
  
  // 配置管理
  getConfig(key: string): Promise<StorageResult<SystemConfig>>;
  setConfig(key: string, value: any, updatedBy: string): Promise<StorageResult<SystemConfig>>;
  
  // 日志管理
  logInteraction(log: Omit<InteractionLog, 'id' | 'createdAt'>): Promise<StorageResult<InteractionLog>>;
  getInteractionLogs(filters: Record<string, any>, options?: QueryOptions): Promise<StorageResult<InteractionLog[]>>;
  
  // 反馈管理
  saveFeedback(feedback: Omit<UserFeedback, 'id' | 'createdAt'>): Promise<StorageResult<UserFeedback>>;
  getFeedback(targetId: string): Promise<StorageResult<UserFeedback[]>>;
}

/**
 * 知识库层接口（事实知识）
 */
export interface IKnowledgeLayer {
  // 实体管理
  createEntity(entity: Omit<KnowledgeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<KnowledgeEntity>>;
  getEntity(id: string): Promise<StorageResult<KnowledgeEntity>>;
  updateEntity(id: string, updates: Partial<KnowledgeEntity>): Promise<StorageResult<KnowledgeEntity>>;
  deleteEntity(id: string): Promise<StorageResult<void>>;
  searchEntities(query: string, options?: QueryOptions): Promise<StorageResult<KnowledgeEntity[]>>;
  
  // 关系管理
  createRelation(relation: Omit<KnowledgeRelation, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<KnowledgeRelation>>;
  getRelation(id: string): Promise<StorageResult<KnowledgeRelation>>;
  getRelationsByEntity(entityId: string): Promise<StorageResult<KnowledgeRelation[]>>;
  deleteRelation(id: string): Promise<StorageResult<void>>;
  
  // 条目管理
  createEntry(entry: KnowledgeEntry): Promise<StorageResult<KnowledgeEntry>>;
  getEntry(id: string): Promise<StorageResult<KnowledgeEntry>>;
  updateEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<StorageResult<KnowledgeEntry>>;
  deleteEntry(id: string): Promise<StorageResult<void>>;
  searchEntries(query: string, options?: QueryOptions): Promise<StorageResult<KnowledgeEntry[]>>;
  
  // 版本管理
  getVersionHistory(entryId: string): Promise<StorageResult<KnowledgeVersion[]>>;
  rollbackVersion(entryId: string, versionId: string): Promise<StorageResult<KnowledgeEntry>>;
}

/**
 * 案例库层接口（经验知识）
 */
export interface ICaseLayer {
  // 案例管理
  createCase(caseData: Omit<AnalysisCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<AnalysisCase>>;
  getCase(id: string): Promise<StorageResult<AnalysisCase>>;
  updateCase(id: string, updates: Partial<AnalysisCase>): Promise<StorageResult<AnalysisCase>>;
  deleteCase(id: string): Promise<StorageResult<void>>;
  searchCases(query: string, options?: QueryOptions): Promise<StorageResult<AnalysisCase[]>>;
  
  // 模板管理
  createTemplate(template: Omit<CaseTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'successRate'>): Promise<StorageResult<CaseTemplate>>;
  getTemplate(id: string): Promise<StorageResult<CaseTemplate>>;
  listTemplates(domain?: string): Promise<StorageResult<CaseTemplate[]>>;
}

/**
 * 向量库层接口（语义索引）
 */
export interface IVectorLayer {
  // 索引管理
  indexVector(record: Omit<VectorIndexRecord, 'id' | 'createdAt'>): Promise<StorageResult<VectorIndexRecord>>;
  batchIndex(records: Array<Omit<VectorIndexRecord, 'id' | 'createdAt'>>): Promise<BatchStorageResult<VectorIndexRecord>>;
  deleteVector(id: string): Promise<StorageResult<void>>;
  deleteBySource(sourceType: string, sourceId: string): Promise<StorageResult<void>>;
  
  // 搜索
  search(vector: number[], options?: VectorSearchOptions): Promise<StorageResult<VectorSearchResult[]>>;
  
  // 统计
  getStats(): Promise<StorageResult<VectorIndexStats>>;
}

/**
 * 统一存储服务接口
 */
export interface IStorageService extends IDatabaseLayer, IKnowledgeLayer, ICaseLayer, IVectorLayer {
  // 层级访问
  database: IDatabaseLayer;
  knowledge: IKnowledgeLayer;
  cases: ICaseLayer;
  vectors: IVectorLayer;
  
  // 统一查询
  unifiedSearch(query: string, options?: {
    includeKnowledge?: boolean;
    includeCases?: boolean;
    useVectorSearch?: boolean;
    useOnlineSearch?: boolean;
  }): Promise<StorageResult<{
    knowledge: KnowledgeEntry[];
    cases: AnalysisCase[];
    vectorResults: VectorSearchResult[];
    onlineResults?: any[];
  }>>;
  
  // 初始化与清理
  initialize(): Promise<void>;
  healthCheck(): Promise<{ layer: StorageLayer; status: 'healthy' | 'unhealthy'; message?: string }[]>;
}
