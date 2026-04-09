/**
 * 知识库类型定义
 */

import type { Timestamp } from './storage';

// 知识文档
export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  type: 'general' | 'strategy' | 'domain' | 'rule' | 'explanation' | 'best_practice';
  sourceType: 'manual' | 'llm' | 'import';
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  tags: string[];
  categories: string[];
  author?: string;
  version: number;
  status: 'active' | 'archived' | 'deprecated';
  usageCount: number;
  lastAccessedAt?: Timestamp;
  embedding?: number[]; // 向量嵌入
  embeddingModel?: string;
  embeddingGeneratedAt?: Timestamp;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 文档搜索结果
export interface DocumentSearchResult {
  document: KnowledgeDocument;
  similarity: number;
  score: number;
}

// 文档导入选项
export interface DocumentImportOptions {
  type?: KnowledgeDocument['type'];
  sourceType?: KnowledgeDocument['sourceType'];
  tags?: string[];
  categories?: string[];
  generateEmbedding?: boolean;
}

// 知识库统计
export interface KnowledgeStats {
  totalDocuments: number;
  activeDocuments: number;
  archivedDocuments: number;
  totalEmbeddings: number;
  embeddingPercentage: number;
  documentsByType: Record<string, number>;
  documentsByCategory: Record<string, number>;
}
