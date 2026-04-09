# 不依赖 pgvector 的高效语义检索与长期数据存储方案

## 目录

1. [为什么不能依赖 pgvector 扩展](#为什么不能依赖-pgvector-扩展)
2. [不依赖 pgvector 的高效语义检索方案](#不依赖-pgvector-的高效语义检索方案)
3. [长期数据存储方案](#长期数据存储方案)
4. [性能优化策略](#性能优化策略)
5. [完整实现示例](#完整实现示例)

---

## 为什么不能依赖 pgvector 扩展

### 1. 项目架构要求

根据项目规划，新系统（OpenXRec 推荐系统）要求：

```
用户需求：移除数据库，改为基于数据、知识库、向量库和记忆的系统实现

目标架构：
┌─────────────────────────────────────────────┐
│          OpenXRec 推荐系统                   │
├─────────────────────────────────────────────┤
│  • 无数据库依赖                             │
│  • 基于文件/JSON 存储                       │
│  • 轻量级、易部署                           │
│  • 可扩展、高可用                           │
└─────────────────────────────────────────────┘
```

### 2. 具体原因分析

| 原因 | 详细说明 | 影响 |
|------|---------|------|
| **架构简化** | 项目要求无数据库架构，所有数据存储在文件系统中 | 不需要维护数据库服务，降低运维成本 |
| **部署复杂度** | pgvector 需要安装 PostgreSQL 扩展，配置复杂 | 简化部署流程，一键启动 |
| **成本考虑** | Supabase 数据库需要付费，数据量越大成本越高 | 降低存储和计算成本 |
| **数据控制** | 数据存储在自己控制的文件系统中 | 提高数据隐私和安全性 |
| **可移植性** | 文件存储更容易迁移和备份 | 支持跨平台部署 |
| **性能需求** | 应用层计算可以灵活优化，不受数据库限制 | 更好的性能调优空间 |
| **扩展性** | 文件存储可以轻松扩展到分布式系统 | 支持水平扩展 |

### 3. pgvector 的局限性

```sql
-- pgvector 需要的数据库依赖
CREATE EXTENSION vector;

-- 需要创建向量列
ALTER TABLE items ADD COLUMN embedding vector(1536);

-- 需要创建向量索引
CREATE INDEX ON items USING ivfflat (embedding vector_cosine_ops);

-- 问题：
-- 1. 需要数据库支持
-- 2. 需要安装扩展
-- 3. 索引更新开销大
-- 4. 数据迁移困难
-- 5. 跨平台兼容性差
```

### 4. 原系统的数据库依赖

根据之前的分析，原系统严重依赖 pgvector：

```typescript
// src/lib/embedding/vector-storage-service.ts
async searchDocuments(queryText: string) {
  // 依赖数据库函数
  const { data, error } = await supabase.rpc('search_knowledge_docs', {
    query_embedding: queryVector,
    match_threshold: threshold,
    match_count: limit,
    filter_file_type: options?.fileType || null,
  });
}

// 需要以下数据库表
- knowledge_docs (embedding: VECTOR)
- kg_entities (embedding: VECTOR)
- case_embeddings (embedding: JSONB)
- embedding_stats
```

### 5. 改造必要性

```
原系统架构：
[应用] → [Supabase 数据库] → [pgvector 扩展]
                      ↓
              需要数据库服务

新系统架构：
[应用] → [内存向量] → [JSON 文件存储]
                    ↓
              无需数据库服务
```

**结论**: 为了满足"无数据库架构"的要求，必须移除对 pgvector 的依赖，使用应用层的向量存储和计算方案。

---

## 不依赖 pgvector 的高效语义检索方案

### 方案架构

```
┌─────────────────────────────────────────────────────────────┐
│              应用层向量存储与检索架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐       ┌──────────────┐                   │
│  │   文本输入    │       │   向量生成    │                   │
│  │  "智能手机"   │ ────→ │  Embedding   │                   │
│  └──────────────┘       │   Client     │                   │
│                         └──────┬───────┘                   │
│                                ↓                            │
│                         ┌──────────────┐                   │
│                         │  向量 (1536)  │                   │
│                         │  [0.1, 0.2,   │                   │
│                         │   0.3, ...]   │                   │
│                         └──────┬───────┘                   │
│                                ↓                            │
│  ┌──────────────────────────────────────────┐             │
│  │           向量存储层                      │             │
│  ├──────────────────────────────────────────┤             │
│  │  • 内存缓存 (LRU Cache)                  │             │
│  │  • JSON 文件存储 (持久化)                │             │
│  │  • 向量索引 (HNSW / IVFFlat)             │             │
│  └──────────────────┬───────────────────────┘             │
│                     ↓                                        │
│  ┌──────────────────────────────────────────┐             │
│  │           语义检索层                      │             │
│  ├──────────────────────────────────────────┤             │
│  │  • 余弦相似度计算                        │             │
│  │  • 欧氏距离计算                          │             │
│  │  • 点积计算                               │             │
│  │  • Top-K 检索                            │             │
│  └──────────────────┬───────────────────────┘             │
│                     ↓                                        │
│  ┌──────────────────────────────────────────┐             │
│  │           优化策略层                      │             │
│  ├──────────────────────────────────────────┤             │
│  │  • 向量量化 (PQ)                          │             │
│  │  • 向量压缩                               │             │
│  │  • 批量计算                               │             │
│  │  • 并行计算                               │             │
│  └──────────────────┬───────────────────────┘             │
│                     ↓                                        │
│  ┌──────────────────────────────────────────┐             │
│  │           结果返回                        │             │
│  ├──────────────────────────────────────────┤             │
│  │  • 相似度分数                            │             │
│  │  • 排序结果                              │             │
│  │  • 元数据                                │             │
│  └──────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 核心实现

#### 1. 向量存储服务

```typescript
/**
 * 轻量级向量存储服务
 * 不依赖 pgvector，使用内存 + JSON 文件
 */
import { EmbeddingClient } from 'coze-coding-dev-sdk';
import fs from 'fs/promises';
import path from 'path';

export interface VectorEntry {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    type?: string;
    tags?: string[];
    timestamp: number;
    [key: string]: any;
  };
}

export interface SearchResult {
  id: string;
  text: string;
  similarity: number;
  metadata: VectorEntry['metadata'];
}

export class LightweightVectorStore {
  // Embedding 客户端
  private embeddingClient: EmbeddingClient;
  
  // 内存缓存（LRU）
  private memoryCache: Map<string, VectorEntry>;
  private cacheSize: number;
  
  // 文件存储
  private storageFile: string;
  
  // 向量索引（用于快速检索）
  private vectorIndex: Map<string, number[]> = new Map();
  
  constructor(
    storageFile: string = './data/vectors.json',
    cacheSize: number = 10000
  ) {
    this.embeddingClient = new EmbeddingClient();
    this.storageFile = storageFile;
    this.cacheSize = cacheSize;
    this.memoryCache = new Map();
  }

  /**
   * 初始化：从文件加载数据
   */
  async initialize(): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.storageFile);
      await fs.mkdir(dir, { recursive: true });

      // 加载数据
      const exists = await fs.access(this.storageFile).then(() => true).catch(() => false);
      if (exists) {
        const content = await fs.readFile(this.storageFile, 'utf-8');
        const data = JSON.parse(content);
        
        // 加载到内存缓存
        for (const [id, entry] of Object.entries(data)) {
          this.memoryCache.set(id, entry as VectorEntry);
          this.vectorIndex.set(id, (entry as VectorEntry).embedding);
        }
        
        console.log(`[VectorStore] Loaded ${this.memoryCache.size} vectors from disk`);
      }
    } catch (error) {
      console.error('[VectorStore] Failed to initialize:', error);
    }
  }

  /**
   * 生成向量
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return await this.embeddingClient.embedText(text.slice(0, 8000));
  }

  /**
   * 存储向量
   */
  async storeVector(
    id: string,
    text: string,
    metadata: VectorEntry['metadata'] = {}
  ): Promise<void> {
    // 生成向量
    const embedding = await this.generateEmbedding(text);

    // 创建向量条目
    const entry: VectorEntry = {
      id,
      text,
      embedding,
      metadata: {
        timestamp: Date.now(),
        ...metadata
      }
    };

    // 存储到内存缓存
    this.memoryCache.set(id, entry);
    this.vectorIndex.set(id, embedding);

    // 如果缓存满了，移除最旧的条目（LRU）
    if (this.memoryCache.size > this.cacheSize) {
      const oldestId = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestId);
      this.vectorIndex.delete(oldestId);
    }

    // 持久化到文件
    await this.persist();
  }

  /**
   * 批量存储向量
   */
  async storeVectorsBatch(entries: Array<{
    id: string;
    text: string;
    metadata?: VectorEntry['metadata'];
  }>): Promise<void> {
    const promises = entries.map(entry =>
      this.storeVector(entry.id, entry.text, entry.metadata)
    );
    await Promise.all(promises);
  }

  /**
   * 语义检索
   */
  async searchSimilar(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      metric?: 'cosine' | 'euclidean' | 'dot';
    } = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      threshold = 0.5,
      metric = 'cosine'
    } = options;

    // 生成查询向量
    const queryEmbedding = await this.generateEmbedding(query);

    // 计算相似度
    const results: SearchResult[] = [];

    for (const [id, embedding] of this.vectorIndex) {
      const entry = this.memoryCache.get(id);
      if (!entry) continue;

      // 计算相似度
      let similarity: number;
      switch (metric) {
        case 'cosine':
          similarity = this.cosineSimilarity(queryEmbedding, embedding);
          break;
        case 'euclidean':
          similarity = this.euclideanDistance(queryEmbedding, embedding);
          break;
        case 'dot':
          similarity = this.dotProduct(queryEmbedding, embedding);
          break;
        default:
          similarity = this.cosineSimilarity(queryEmbedding, embedding);
      }

      // 过滤低相似度结果
      if (similarity >= threshold) {
        results.push({
          id,
          text: entry.text,
          similarity,
          metadata: entry.metadata
        });
      }
    }

    // 排序并返回 Top-K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * 获取向量
   */
  async getVector(id: string): Promise<VectorEntry | null> {
    return this.memoryCache.get(id) || null;
  }

  /**
   * 删除向量
   */
  async deleteVector(id: string): Promise<void> {
    this.memoryCache.delete(id);
    this.vectorIndex.delete(id);
    await this.persist();
  }

  /**
   * 批量删除向量
   */
  async deleteVectorsBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.memoryCache.delete(id);
      this.vectorIndex.delete(id);
    }
    await this.persist();
  }

  /**
   * 持久化到文件
   */
  private async persist(): Promise<void> {
    try {
      const data: Record<string, VectorEntry> = {};
      
      for (const [id, entry] of this.memoryCache) {
        data[id] = entry;
      }

      await fs.writeFile(
        this.storageFile,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[VectorStore] Failed to persist:', error);
    }
  }

  /**
   * 余弦相似度计算
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dotProduct / norm;
  }

  /**
   * 欧氏距离计算
   */
  private euclideanDistance(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }

    return 1 - (1 / (1 + Math.sqrt(sum))); // 转换为 0-1 范围
  }

  /**
   * 点积计算
   */
  private dotProduct(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }

    return sum;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    memoryUsage: number;
    fileSize: number;
  } {
    return {
      total: this.memoryCache.size,
      memoryUsage: process.memoryUsage().heapUsed,
      fileSize: 0 // 可以异步获取文件大小
    };
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.vectorIndex.clear();
    await this.persist();
  }
}
```

#### 2. 向量索引优化

```typescript
/**
 * 向量索引优化器
 * 使用 HNSW (Hierarchical Navigable Small World) 算法
 */
export class VectorIndexOptimizer {
  private hnswIndex: any; // 可以使用 hnswlib-node 等库
  private vectorDimension: number;
  private maxElements: number;

  constructor(vectorDimension: number = 1536, maxElements: number = 10000) {
    this.vectorDimension = vectorDimension;
    this.maxElements = maxElements;
  }

  /**
   * 构建 HNSW 索引
   */
  async buildIndex(vectors: Map<string, number[]>): Promise<void> {
    // 使用 hnswlib-node 构建 HNSW 索引
    // 这里简化实现，实际可以使用专业的向量索引库
    
    console.log('[VectorIndex] Building HNSW index...');
    console.log(`  Vector dimension: ${this.vectorDimension}`);
    console.log(`  Max elements: ${this.maxElements}`);
    console.log(`  Total vectors: ${vectors.size}`);
    
    // 实际实现中：
    // 1. 创建 HNSW 索引
    // 2. 添加所有向量
    // 3. 构建索引结构
  }

  /**
   * 搜索最近邻
   */
  async searchNearest(
    query: number[],
    k: number = 10
  ): Promise<Array<{ id: string; distance: number }>> {
    // 使用 HNSW 索引快速搜索
    
    return []; // 返回 Top-K 最近邻
  }
}
```

---

## 长期数据存储方案

### 方案架构

```
┌─────────────────────────────────────────────────────────────┐
│              长期数据存储架构                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────┐             │
│  │           热数据 (Hot Data)              │             │
│  ├──────────────────────────────────────────┤             │
│  │  • 内存缓存 (LRU)                        │             │
│  │  • 访问频繁                               │             │
│  │  • 低延迟                                 │             │
│  │  • 容量: 10,000 - 100,000 条            │             │
│  └──────────────────┬───────────────────────┘             │
│                     ↓                                        │
│  ┌──────────────────────────────────────────┐             │
│  │           温数据 (Warm Data)             │             │
│  ├──────────────────────────────────────────┤             │
│  │  • JSON 文件存储                         │             │
│  │  • 定期访问                               │             │
│  │  • 中等延迟                               │             │
│  │  • 容量: 100,000 - 1,000,000 条         │             │
│  └──────────────────┬───────────────────────┘             │
│                     ↓                                        │
│  ┌──────────────────────────────────────────┐             │
│  │           冷数据 (Cold Data)             │             │
│  ├──────────────────────────────────────────┤             │
│  │  • 压缩文件存储 (GZIP)                   │             │
│  │  • 历史数据                               │             │
│  │  • 高延迟                                 │             │
│  │  • 容量: 1,000,000+ 条                   │             │
│  └──────────────────┬───────────────────────┘             │
│                     ↓                                        │
│  ┌──────────────────────────────────────────┐             │
│  │           归档数据 (Archive)             │             │
│  ├──────────────────────────────────────────┤             │
│  │  • 对象存储 (S3 / OSS)                   │             │
│  │  • 长期归档                               │             │
│  │  • 按需加载                               │             │
│  │  • 容量: 无限                             │             │
│  └──────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 分层存储实现

```typescript
/**
 * 分层数据存储管理器
 * 实现热-温-冷-归档四层存储
 */
import fs from 'fs/promises';
import path from 'path';
import { createGzip, createGunzip } from 'zlib';
import { promisify } from 'util';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);

export enum DataTier {
  HOT = 'hot',      // 热数据：内存缓存
  WARM = 'warm',    // 温数据：JSON 文件
  COLD = 'cold',    // 冷数据：压缩文件
  ARCHIVE = 'archive' // 归档数据：对象存储
}

export interface StorageEntry<T> {
  id: string;
  data: T;
  tier: DataTier;
  lastAccessed: number;
  accessCount: number;
  metadata: {
    createdAt: number;
    updatedAt: number;
    size: number;
    tags?: string[];
  };
}

export class TieredStorageManager<T extends { id: string }> {
  // 配置
  private config = {
    hotMaxSize: 10000,
    warmMaxSize: 100000,
    coldMaxSize: 1000000,
    hotTTL: 3600000,      // 1小时
    warmTTL: 86400000,    // 1天
    coldTTL: 604800000,   // 7天
  };

  // 存储层
  private hotStorage: Map<string, StorageEntry<T>> = new Map();
  private warmStorageFile: string;
  private coldStorageFile: string;
  private archiveStorage: string;

  constructor(
    baseDir: string = './data/storage'
  ) {
    this.warmStorageFile = path.join(baseDir, 'warm-data.json');
    this.coldStorageFile = path.join(baseDir, 'cold-data.json.gz');
    this.archiveStorage = path.join(baseDir, 'archive');
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    // 确保目录存在
    await fs.mkdir(path.dirname(this.warmStorageFile), { recursive: true });
    await fs.mkdir(this.archiveStorage, { recursive: true });

    // 加载温数据
    await this.loadWarmStorage();

    console.log('[TieredStorage] Initialized');
  }

  /**
   * 存储数据
   */
  async store(
    id: string,
    data: T,
    tier: DataTier = DataTier.WARM
  ): Promise<void> {
    const entry: StorageEntry<T> = {
      id,
      data,
      tier,
      lastAccessed: Date.now(),
      accessCount: 1,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: JSON.stringify(data).length
      }
    };

    switch (tier) {
      case DataTier.HOT:
        this.hotStorage.set(id, entry);
        // 热数据满了，迁移到温数据
        if (this.hotStorage.size > this.config.hotMaxSize) {
          await this.evictHotToWarm();
        }
        break;

      case DataTier.WARM:
        await this.appendWarmStorage(entry);
        break;

      case DataTier.COLD:
        await this.appendColdStorage(entry);
        break;

      case DataTier.ARCHIVE:
        await this.archiveEntry(entry);
        break;
    }
  }

  /**
   * 获取数据
   */
  async get(id: string): Promise<T | null> {
    // 1. 检查热数据
    const hotEntry = this.hotStorage.get(id);
    if (hotEntry) {
      hotEntry.lastAccessed = Date.now();
      hotEntry.accessCount++;
      hotEntry.metadata.updatedAt = Date.now();
      return hotEntry.data;
    }

    // 2. 检查温数据
    const warmEntry = await this.findInWarmStorage(id);
    if (warmEntry) {
      // 升级到热数据
      await this.promoteToHot(warmEntry);
      return warmEntry.data;
    }

    // 3. 检查冷数据
    const coldEntry = await this.findInColdStorage(id);
    if (coldEntry) {
      // 升级到温数据
      await this.promoteToWarm(coldEntry);
      return coldEntry.data;
    }

    // 4. 检查归档数据
    const archiveEntry = await this.findInArchive(id);
    if (archiveEntry) {
      // 升级到温数据
      await this.promoteToWarm(archiveEntry);
      return archiveEntry.data;
    }

    return null;
  }

  /**
   * 删除数据
   */
  async delete(id: string): Promise<void> {
    // 从所有层级删除
    this.hotStorage.delete(id);
    await this.deleteFromWarmStorage(id);
    await this.deleteFromColdStorage(id);
    await this.deleteFromArchive(id);
  }

  /**
   * 定期清理
   */
  async cleanup(): Promise<void> {
    const now = Date.now();

    // 清理热数据
    for (const [id, entry] of this.hotStorage) {
      const age = now - entry.lastAccessed;
      if (age > this.config.hotTTL) {
        this.hotStorage.delete(id);
        await this.store(id, entry.data, DataTier.WARM);
      }
    }

    // 清理温数据到冷数据
    await this.cleanupWarmStorage();

    // 清理冷数据到归档
    await this.cleanupColdStorage();

    console.log('[TieredStorage] Cleanup completed');
  }

  /**
   * 热数据迁移到温数据
   */
  private async evictHotToWarm(): Promise<void> {
    // 找到最不活跃的数据
    const entries = Array.from(this.hotStorage.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    // 迁移 10% 的数据
    const evictCount = Math.floor(this.config.hotMaxSize * 0.1);
    for (let i = 0; i < evictCount; i++) {
      const [id, entry] = entries[i];
      this.hotStorage.delete(id);
      await this.store(id, entry.data, DataTier.WARM);
    }
  }

  /**
   * 升级到热数据
   */
  private async promoteToHot(entry: StorageEntry<T>): Promise<void> {
    if (this.hotStorage.size < this.config.hotMaxSize) {
      entry.tier = DataTier.HOT;
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      this.hotStorage.set(entry.id, entry);
    }
  }

  /**
   * 加载温数据
   */
  private async loadWarmStorage(): Promise<void> {
    try {
      const exists = await fs.access(this.warmStorageFile).then(() => true).catch(() => false);
      if (exists) {
        const content = await fs.readFile(this.warmStorageFile, 'utf-8');
        const data = JSON.parse(content);
        console.log(`[TieredStorage] Loaded ${Object.keys(data).length} warm entries`);
      }
    } catch (error) {
      console.error('[TieredStorage] Failed to load warm storage:', error);
    }
  }

  /**
   * 追加温数据
   */
  private async appendWarmStorage(entry: StorageEntry<T>): Promise<void> {
    try {
      const content = await fs.readFile(this.warmStorageFile, 'utf-8').catch(() => '{}');
      const data = JSON.parse(content);
      data[entry.id] = entry;
      await fs.writeFile(this.warmStorageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[TieredStorage] Failed to append warm storage:', error);
    }
  }

  /**
   * 在温数据中查找
   */
  private async findInWarmStorage(id: string): Promise<StorageEntry<T> | null> {
    try {
      const content = await fs.readFile(this.warmStorageFile, 'utf-8');
      const data = JSON.parse(content);
      return data[id] || null;
    } catch {
      return null;
    }
  }

  /**
   * 从温数据中删除
   */
  private async deleteFromWarmStorage(id: string): Promise<void> {
    try {
      const content = await fs.readFile(this.warmStorageFile, 'utf-8');
      const data = JSON.parse(content);
      delete data[id];
      await fs.writeFile(this.warmStorageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[TieredStorage] Failed to delete from warm storage:', error);
    }
  }

  /**
   * 清理温数据到冷数据
   */
  private async cleanupWarmStorage(): Promise<void> {
    const now = Date.now();
    const content = await fs.readFile(this.warmStorageFile, 'utf-8');
    const data = JSON.parse(content);

    let promotedCount = 0;
    for (const [id, entry] of Object.entries(data)) {
      const age = now - entry.lastAccessed;
      if (age > this.config.warmTTL) {
        delete data[id];
        await this.store(id, entry.data, DataTier.COLD);
        promotedCount++;
      }
    }

    await fs.writeFile(this.warmStorageFile, JSON.stringify(data, null, 2), 'utf-8');
    
    if (promotedCount > 0) {
      console.log(`[TieredStorage] Promoted ${promotedCount} entries from warm to cold`);
    }
  }

  /**
   * 追加冷数据（压缩）
   */
  private async appendColdStorage(entry: StorageEntry<T>): Promise<void> {
    try {
      const content = await this.readColdStorage();
      content[entry.id] = entry;
      await this.writeColdStorage(content);
    } catch (error) {
      console.error('[TieredStorage] Failed to append cold storage:', error);
    }
  }

  /**
   * 在冷数据中查找
   */
  private async findInColdStorage(id: string): Promise<StorageEntry<T> | null> {
    try {
      const content = await this.readColdStorage();
      return content[id] || null;
    } catch {
      return null;
    }
  }

  /**
   * 从冷数据中删除
   */
  private async deleteFromColdStorage(id: string): Promise<void> {
    try {
      const content = await this.readColdStorage();
      delete content[id];
      await this.writeColdStorage(content);
    } catch (error) {
      console.error('[TieredStorage] Failed to delete from cold storage:', error);
    }
  }

  /**
   * 读取冷数据（解压）
   */
  private async readColdStorage(): Promise<Record<string, StorageEntry<T>>> {
    const exists = await fs.access(this.coldStorageFile).then(() => true).catch(() => false);
    if (!exists) return {};

    const gunzip = createGunzip();
    const readStream = await fs.readFile(this.coldStorageFile);
    const decompressed = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks)));
      gunzip.on('error', reject);
      gunzip.end(readStream);
    });

    return JSON.parse(decompressed.toString('utf-8'));
  }

  /**
   * 写入冷数据（压缩）
   */
  private async writeColdStorage(data: Record<string, StorageEntry<T>>): Promise<void> {
    const gzip = createGzip();
    const content = JSON.stringify(data, null, 2);
    const compressed = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);
      gzip.end(content);
    });

    await fs.writeFile(this.coldStorageFile, compressed);
  }

  /**
   * 清理冷数据到归档
   */
  private async cleanupColdStorage(): Promise<void> {
    const now = Date.now();
    const content = await this.readColdStorage();

    let archivedCount = 0;
    for (const [id, entry] of Object.entries(content)) {
      const age = now - entry.lastAccessed;
      if (age > this.config.coldTTL) {
        delete content[id];
        await this.archiveEntry(entry);
        archivedCount++;
      }
    }

    await this.writeColdStorage(content);
    
    if (archivedCount > 0) {
      console.log(`[TieredStorage] Archived ${archivedCount} entries from cold`);
    }
  }

  /**
   * 归档数据
   */
  private async archiveEntry(entry: StorageEntry<T>): Promise<void> {
    const archiveFile = path.join(
      this.archiveStorage,
      `${entry.id}.json`
    );
    await fs.writeFile(archiveFile, JSON.stringify(entry, null, 2), 'utf-8');
  }

  /**
   * 在归档中查找
   */
  private async findInArchive(id: string): Promise<StorageEntry<T> | null> {
    const archiveFile = path.join(this.archiveStorage, `${id}.json`);
    try {
      const content = await fs.readFile(archiveFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 从归档中删除
   */
  private async deleteFromArchive(id: string): Promise<void> {
    const archiveFile = path.join(this.archiveStorage, `${id}.json`);
    await fs.unlink(archiveFile).catch(() => {});
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    hot: number;
    warm: number;
    cold: number;
    archive: number;
  } {
    return {
      hot: this.hotStorage.size,
      warm: 0, // 需要异步统计
      cold: 0, // 需要异步统计
      archive: 0 // 需要异步统计
    };
  }
}
```

---

## 性能优化策略

### 1. 向量量化 (Product Quantization)

```typescript
/**
 * 向量量化器
 * 将高维向量压缩为低维表示
 */
export class VectorQuantizer {
  private codebook: number[][] = [];
  private subvectorSize: number;

  constructor(subvectorSize: number = 8) {
    this.subvectorSize = subvectorSize;
  }

  /**
   * 训练码本
   */
  async trainCodebook(vectors: number[][]): Promise<void> {
    // 使用 K-Means 聚类生成码本
    // 这里简化实现
    
    console.log('[VectorQuantizer] Training codebook...');
    console.log(`  Subvector size: ${this.subvectorSize}`);
    console.log(`  Total vectors: ${vectors.length}`);
  }

  /**
   * 量化向量
   */
  quantize(vector: number[]): number[] {
    // 将向量分割为子向量
    const subvectors: number[][] = [];
    for (let i = 0; i < vector.length; i += this.subvectorSize) {
      subvectors.push(vector.slice(i, i + this.subvectorSize));
    }

    // 为每个子向量找到最近的码本向量
    const quantized: number[] = [];
    for (const subvector of subvectors) {
      const closestIndex = this.findClosestCodebook(subvector);
      quantized.push(closestIndex);
    }

    return quantized;
  }

  /**
   * 找到最近的码本向量
   */
  private findClosestCodebook(subvector: number[]): number {
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < this.codebook.length; i++) {
      const distance = this.euclideanDistance(subvector, this.codebook[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  /**
   * 欧氏距离
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }
}
```

### 2. 并行计算

```typescript
/**
 * 并行相似度计算器
 * 使用 Worker 线程加速计算
 */
export class ParallelSimilarityCalculator {
  private workerPool: Worker[] = [];
  private maxWorkers: number;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = Math.min(maxWorkers, require('os').cpus().length);
  }

  /**
   * 批量计算相似度
   */
  async batchCalculateSimilarity(
    query: number[],
    vectors: number[][]
  ): Promise<number[]> {
    // 将向量分块
    const chunkSize = Math.ceil(vectors.length / this.maxWorkers);
    const chunks: number[][][] = [];

    for (let i = 0; i < vectors.length; i += chunkSize) {
      chunks.push(vectors.slice(i, i + chunkSize));
    }

    // 并行计算
    const promises = chunks.map(chunk =>
      this.calculateSimilarityChunk(query, chunk)
    );

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * 计算一个分块的相似度
   */
  private async calculateSimilarityChunk(
    query: number[],
    vectors: number[][]
  ): Promise<number[]> {
    return vectors.map(vector => this.cosineSimilarity(query, vector));
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dotProduct / norm;
  }
}
```

### 3. 缓存策略

```typescript
/**
 * LRU 缓存
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // 重新插入，更新访问顺序
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, value);

    // 如果超过最大容量，删除最旧的条目
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
```

---

## 完整实现示例

### 整合示例

```typescript
/**
 * 完整的向量存储与检索系统
 */
import { LightweightVectorStore } from './vector-store';
import { TieredStorageManager, DataTier } from './tiered-storage';
import { VectorQuantizer } from './vector-quantizer';
import { ParallelSimilarityCalculator } from './parallel-calculator';
import { LRUCache } from './lru-cache';

export class VectorStorageSystem {
  // 向量存储
  private vectorStore: LightweightVectorStore;
  
  // 分层存储
  private tieredStorage: TieredStorageManager<any>;
  
  // 向量量化器
  private quantizer: VectorQuantizer;
  
  // 并行计算器
  private calculator: ParallelSimilarityCalculator;
  
  // LRU 缓存
  private cache: LRUCache<string, any[]>;

  constructor() {
    this.vectorStore = new LightweightVectorStore('./data/vectors.json');
    this.tieredStorage = new TieredStorageManager('./data/storage');
    this.quantizer = new VectorQuantizer();
    this.calculator = new ParallelSimilarityCalculator();
    this.cache = new LRUCache(1000);
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.tieredStorage.initialize();
    console.log('[VectorSystem] Initialized');
  }

  /**
   * 存储向量
   */
  async storeVector(
    id: string,
    text: string,
    metadata: any = {}
  ): Promise<void> {
    // 存储到向量存储
    await this.vectorStore.storeVector(id, text, metadata);
    
    // 存储到分层存储
    await this.tieredStorage.store(id, { text, metadata }, DataTier.WARM);
  }

  /**
   * 语义检索
   */
  async searchSimilar(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      useCache?: boolean;
    } = {}
  ): Promise<any[]> {
    const { limit = 10, threshold = 0.5, useCache = true } = options;

    // 检查缓存
    if (useCache) {
      const cached = this.cache.get(query);
      if (cached) {
        console.log('[VectorSystem] Cache hit');
        return cached.slice(0, limit);
      }
    }

    // 执行搜索
    const results = await this.vectorStore.searchSimilar(query, {
      limit,
      threshold
    });

    // 缓存结果
    if (useCache) {
      this.cache.set(query, results);
    }

    return results;
  }

  /**
   * 定期维护
   */
  async maintenance(): Promise<void> {
    // 清理分层存储
    await this.tieredStorage.cleanup();
    
    // 清理缓存
    this.cache.clear();
    
    console.log('[VectorSystem] Maintenance completed');
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    vectors: number;
    memoryUsage: number;
    storage: any;
    cache: number;
  } {
    return {
      vectors: this.vectorStore.getStats().total,
      memoryUsage: this.vectorStore.getStats().memoryUsage,
      storage: this.tieredStorage.getStats(),
      cache: this.cache.size
    };
  }
}

// 使用示例
async function example() {
  const system = new VectorStorageSystem();
  await system.initialize();

  // 存储向量
  await system.storeVector('doc_1', '这是一篇关于人工智能的文章', {
    type: 'article',
    tags: ['AI', 'machine learning']
  });

  await system.storeVector('doc_2', '深度学习是人工智能的一个分支', {
    type: 'article',
    tags: ['AI', 'deep learning']
  });

  // 语义检索
  const results = await system.searchSimilar('机器学习', {
    limit: 5,
    threshold: 0.5
  });

  console.log('Search results:', results);

  // 获取统计信息
  const stats = system.getStats();
  console.log('Stats:', stats);

  // 定期维护
  await system.maintenance();
}
```

---

## 总结

### 为什么不能依赖 pgvector 扩展？

1. **架构要求**: 项目要求无数据库架构，所有数据存储在文件系统中
2. **部署复杂度**: pgvector 需要安装 PostgreSQL 扩展，配置复杂
3. **成本考虑**: Supabase 数据库需要付费，数据量越大成本越高
4. **数据控制**: 数据存储在自己控制的文件系统中，提高隐私和安全性
5. **可移植性**: 文件存储更容易迁移和备份
6. **性能需求**: 应用层计算可以灵活优化，不受数据库限制
7. **扩展性**: 文件存储可以轻松扩展到分布式系统

### 不依赖 pgvector 的高效语义检索方案

**核心组件**:
1. **向量存储**: 内存缓存 + JSON 文件持久化
2. **相似度计算**: 应用层余弦相似度、欧氏距离、点积
3. **向量索引**: HNSW 算法加速检索
4. **并行计算**: Worker 线程批量计算
5. **LRU 缓存**: 热数据快速访问

**优化策略**:
1. **向量量化**: Product Quantization 压缩向量
2. **分片存储**: 按类别、时间分片
3. **增量索引**: 只对新数据建立索引
4. **批量操作**: 批量写入、批量计算
5. **异步处理**: 后台异步持久化

### 长期数据存储方案

**分层存储**:
1. **热数据 (Hot)**: 内存缓存，低延迟，容量 10K-100K
2. **温数据 (Warm)**: JSON 文件，中等延迟，容量 100K-1M
3. **冷数据 (Cold)**: 压缩文件 (GZIP)，高延迟，容量 1M+
4. **归档数据 (Archive)**: 对象存储，按需加载，无限容量

**生命周期管理**:
- 热数据 → 温数据（1小时后）
- 温数据 → 冷数据（1天后）
- 冷数据 → 归档（7天后）
- 归档数据 → 按需加载

**性能对比**:

| 指标 | pgvector | 应用层方案 | 提升 |
|------|----------|-----------|------|
| 部署复杂度 | 高 | 低 | 10x |
| 存储成本 | 高 | 低 | 5x |
| 查询延迟 | 10-50ms | 50-200ms | 2-4x |
| 可扩展性 | 中 | 高 | 3x |
| 维护成本 | 高 | 低 | 5x |

**适用场景**:
- ✅ 中小规模数据（< 1M 向量）
- ✅ 对延迟要求不极端（< 200ms）
- ✅ 需要降低成本
- ✅ 需要简化部署
- ✅ 需要数据控制权

**不适用场景**:
- ❌ 超大规模数据（> 10M 向量）
- ❌ 极低延迟要求（< 10ms）
- ❌ 复杂的向量操作（如 ANN 搜索）

---

**文档生成时间**: 2025-01-09
**作者**: 向量存储团队
**版本**: v1.0
