/**
 * 向量库类型定义
 */

import type { Timestamp } from './storage';

// 向量类型
export type VectorType = 'user' | 'item' | 'item_content' | 'user_preference' | 'user_behavior' | 'context' | 'interaction';

// 向量数据
export interface VectorData {
  id: string;
  type: VectorType;
  targetId: string; // 关联的对象ID
  vector: number[]; // 向量嵌入
  modelName: string;
  modelVersion?: string;
  embeddingDim: number;
  updateFrequency: number;
  lastUpdatedAt: Timestamp;
  updateReason?: string;
  usageCount: number;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
}

// 向量搜索结果
export interface VectorSearchResult {
  id: string;
  type: VectorType;
  targetId: string;
  similarity: number;
  distance: number;
  metadata?: Record<string, any>;
}

// 向量搜索选项
export interface VectorSearchOptions {
  limit?: number;
  threshold?: number; // 最小相似度
  filterType?: VectorType;
  includeMetadata?: boolean;
}

// 向量相似度计算方法
export type SimilarityMethod = 'cosine' | 'euclidean' | 'dot';

// 向量库统计
export interface VectorStoreStats {
  totalVectors: number;
  vectorsByType: Record<VectorType, number>;
  avgUpdateFrequency: number;
  totalUsageCount: number;
  modelDistribution: Record<string, number>;
}
