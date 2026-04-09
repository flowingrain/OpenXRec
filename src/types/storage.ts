/**
 * OpenXRec 数据存储层类型定义
 */

// 基础类型
export type Timestamp = string; // ISO 8601 格式

// 用户数据
export interface UserData {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  avatar?: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: Record<string, any>;
}

// 推荐物品数据
export interface ItemData {
  id: string;
  title: string;
  description?: string;
  type: 'knowledge' | 'report' | 'case' | 'scenario' | 'article' | 'dataset';
  category: string;
  subcategory?: string;
  tags: string[];
  keywords: string[];
  qualityScore: number; // 0-1
  popularityScore: number; // 0-1
  relevanceScore?: number; // 0-1
  freshnessScore: number; // 0-1
  viewCount: number;
  clickCount: number;
  likeCount: number;
  bookmarkCount: number;
  shareCount: number;
  avgRating?: number;
  ratingCount: number;
  status: 'active' | 'hidden' | 'archived' | 'deleted';
  featured: boolean;
  publishedAt?: Timestamp;
  expiresAt?: Timestamp;
  thumbnailUrl?: string;
  properties?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 推荐场景配置
export interface ScenarioData {
  id: string;
  scenarioId: string;
  name: string;
  description?: string;
  category: string;
  priority: number;
  context: Record<string, any>;
  constraints: Record<string, any>;
  filters: Record<string, any>;
  defaultAlgorithm: string;
  availableAlgorithms: string[];
  fallbackAlgorithm?: string;
  minDiversity: number; // 0-1
  minNovelty: number; // 0-1
  maxRepeatRatio: number; // 0-1
  maxItemAgeDays?: number;
  refreshIntervalHours: number;
  targetCtr?: number;
  targetConversionRate?: number;
  targetDwellTimeMs?: number;
  status: 'active' | 'paused' | 'disabled' | 'archived';
  totalRecommendations: number;
  avgCtr?: number;
  avgConversionRate?: number;
  isAbTest: boolean;
  testGroup?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 算法配置
export interface AlgorithmData {
  id: string;
  algorithmId: string;
  name: string;
  type: 'collaborative_filtering' | 'content_based' | 'hybrid' | 'knowledge_graph' | 'deep_learning' | 'rule_based' | 'llm_enhanced' | 'custom';
  description?: string;
  version: string;
  author?: string;
  defaultParams: Record<string, any>;
  requiredParams: string[];
  optionalParams: string[];
  enabled: boolean;
  maxConcurrentRequests: number;
  timeoutMs: number;
  cacheTtlSeconds: number;
  minQualityScore: number;
  diversityFactor: number;
  noveltyFactor: number;
  dependsOn: string[];
  dataSources: string[];
  isInAbTest: boolean;
  testGroup?: string;
  testPercentage: number;
  status: 'active' | 'testing' | 'deprecated' | 'disabled';
  totalCalls: number;
  totalErrors: number;
  avgResponseTimeMs?: number;
  avgCtr?: number;
  avgConversionRate?: number;
  lastPerformanceAt?: Timestamp;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 系统配置
export interface ConfigData {
  id: string;  // 配置标识
  system: {
    name: string;
    version: string;
    environment: 'development' | 'production';
  };
  recommendation: {
    defaultLimit: number;
    maxLimit: number;
    cacheEnabled: boolean;
    cacheTtlSeconds: number;
  };
  embedding: {
    model: string;
    dimension: number;
    batchSize: number;
  };
  memory: {
    retentionDays: number;
    maxInteractionsPerUser: number;
  };
}

// 数据存储接口
export interface DataStore<T> {
  get(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  set(id: string, data: T): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  query(filter: (item: T) => boolean): Promise<T[]>;
}
