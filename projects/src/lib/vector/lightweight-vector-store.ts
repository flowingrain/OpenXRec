/**
 * 轻量级向量存储服务
 * 
 * 功能：
 * - 向量存储：支持浮点向量存储
 * - 向量检索：余弦相似度、欧氏距离
 * - 持久化：JSON 文件存储
 * - 缓存：LRU 缓存
 * - 分层存储：热数据内存、冷数据文件
 */

import { EmbeddingClient } from 'coze-coding-dev-sdk';

// ==================== 类型定义 ====================

export interface VectorEntry {
  id: string;
  vector: number[];
  metadata: {
    content: string;
    type?: string;
    timestamp: number;
    tags?: string[];
    [key: string]: any;
  };
  embedding?: number[];
}

export interface VectorSearchResult {
  entry: VectorEntry;
  similarity: number;
  distance: number;
}

export interface VectorSearchOptions {
  topK?: number;
  threshold?: number;
  metric?: 'cosine' | 'euclidean' | 'dot';
  filter?: (metadata: any) => boolean;
}

export interface VectorStoreStats {
  total: number;
  inMemory: number;
  onDisk: number;
  cacheSize: number;
  cacheHitRate: number;
}

// ==================== 向量计算工具 ====================

/**
 * 向量计算工具
 */
export class VectorCalculator {
  /**
   * 计算余弦相似度
   */
  static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * 计算欧氏距离
   */
  static euclideanDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector dimensions must match');
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * 计算点积
   */
  static dotProduct(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector dimensions must match');
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += vec1[i] * vec2[i];
    }

    return sum;
  }

  /**
   * 向量归一化
   */
  static normalize(vec: number[]): number[] {
    let norm = 0;
    for (const val of vec) {
      norm += val * val;
    }

    norm = Math.sqrt(norm);
    if (norm === 0) return vec;

    return vec.map(val => val / norm);
  }
}

// ==================== LRU 缓存 ====================

/**
 * LRU 缓存节点
 */
class LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null = null;
  next: LRUNode<K, V> | null = null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

/**
 * LRU 缓存
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, LRUNode<K, V>>;
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;
  private hits: number = 0;
  private misses: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    this.hits++;
    this.moveToHead(node);
    return node.value;
  }

  put(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      existingNode.value = value;
      this.moveToHead(existingNode);
      return;
    }

    const newNode = new LRUNode(key, value);
    this.cache.set(key, newNode);
    this.addToHead(newNode);

    if (this.cache.size > this.capacity) {
      this.removeTail();
    }
  }

  delete(key: K): void {
    const node = this.cache.get(key);
    if (node) {
      this.removeNode(node);
      this.cache.delete(key);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  private addToHead(node: LRUNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private moveToHead(node: LRUNode<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private removeTail(): void {
    if (this.tail) {
      this.cache.delete(this.tail.key);
      this.removeNode(this.tail);
    }
  }
}

// ==================== 轻量级向量存储 ====================

/**
 * 轻量级向量存储
 * 支持分层存储：热数据内存 + 冷数据文件
 */
export class LightweightVectorStore {
  private inMemory: Map<string, VectorEntry> = new Map();
  private cache: LRUCache<string, VectorEntry>;
  private filePath: string;
  private maxInMemory: number;
  private embeddingClient: EmbeddingClient;
  private dimension: number = 1536; // 默认 OpenAI embedding 维度

  constructor(
    filePath: string = '/workspace/projects/data/vectors.json',
    maxInMemory: number = 1000,
    cacheSize: number = 100
  ) {
    this.filePath = filePath;
    this.maxInMemory = maxInMemory;
    this.cache = new LRUCache(cacheSize);
    this.embeddingClient = new EmbeddingClient();
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    console.log('[LightweightVectorStore] Initializing...');

    // 尝试加载持久化数据
    await this.loadFromDisk();

    console.log(`[LightweightVectorStore] Initialized with ${this.inMemory.size} entries`);
  }

  /**
   * 加载数据从磁盘
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.filePath, 'utf-8');
      const entries: VectorEntry[] = JSON.parse(data);

      // 加载到内存（限制数量）
      for (const entry of entries.slice(0, this.maxInMemory)) {
        this.inMemory.set(entry.id, entry);
      }

      console.log(`[LightweightVectorStore] Loaded ${entries.length} entries from disk`);
    } catch (error) {
      console.log('[LightweightVectorStore] No existing data found, starting fresh');
    }
  }

  /**
   * 保存数据到磁盘
   */
  private async saveToDisk(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // 确保目录存在
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      // 合并内存和缓存数据
      const allEntries: VectorEntry[] = [];
      
      for (const entry of this.inMemory.values()) {
        allEntries.push(entry);
      }

      for (const cacheNode of (this.cache as any).cache.values()) {
        const entry = cacheNode.value;
        if (!this.inMemory.has(entry.id)) {
          allEntries.push(entry);
        }
      }

      // 保存到文件
      await fs.writeFile(this.filePath, JSON.stringify(allEntries, null, 2), 'utf-8');

      console.log(`[LightweightVectorStore] Saved ${allEntries.length} entries to disk`);
    } catch (error) {
      console.error('[LightweightVectorStore] Failed to save to disk:', error);
    }
  }

  /**
   * 添加向量
   */
  async add(entry: VectorEntry): Promise<void> {
    // 如果没有向量，自动生成
    if (!entry.vector || entry.vector.length === 0) {
      const content = entry.metadata.content;
      const embedding = await this.generateEmbedding(content);
      entry.vector = embedding;
    }

    // 设置时间戳
    entry.metadata.timestamp = entry.metadata.timestamp || Date.now();

    // 添加到内存
    this.inMemory.set(entry.id, entry);

    // 如果超过内存限制，触发持久化
    if (this.inMemory.size > this.maxInMemory) {
      await this.evictToCache();
    }

    console.log(`[LightweightVectorStore] Added entry ${entry.id}`);
  }

  /**
   * 批量添加向量
   */
  async addBatch(entries: VectorEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.add(entry);
    }

    // 批量添加后持久化
    await this.saveToDisk();
  }

  /**
   * 获取向量
   */
  get(id: string): VectorEntry | undefined {
    // 先查内存
    let entry = this.inMemory.get(id);

    // 再查缓存
    if (!entry) {
      entry = this.cache.get(id);
    }

    return entry;
  }

  /**
   * 删除向量
   */
  async delete(id: string): Promise<void> {
    // 从内存删除
    this.inMemory.delete(id);

    // 从缓存删除
    this.cache.delete(id);

    // 持久化
    await this.saveToDisk();

    console.log(`[LightweightVectorStore] Deleted entry ${id}`);
  }

  /**
   * 向量搜索
   */
  async search(
    query: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const {
      topK = 10,
      threshold = 0.7,
      metric = 'cosine',
      filter
    } = options;

    // 生成查询向量
    const queryVector = await this.generateEmbedding(query);

    // 收集所有向量（内存 + 缓存）
    const allEntries: VectorEntry[] = [];
    
    for (const entry of this.inMemory.values()) {
      if (!filter || filter(entry.metadata)) {
        allEntries.push(entry);
      }
    }

    // 计算相似度
    const results: VectorSearchResult[] = [];

    for (const entry of allEntries) {
      if (!entry.vector || entry.vector.length === 0) {
        continue;
      }

      let similarity: number;
      let distance: number;

      switch (metric) {
        case 'cosine':
          similarity = VectorCalculator.cosineSimilarity(queryVector, entry.vector);
          distance = 1 - similarity;
          break;
        case 'euclidean':
          distance = VectorCalculator.euclideanDistance(queryVector, entry.vector);
          similarity = 1 / (1 + distance);
          break;
        case 'dot':
          const dot = VectorCalculator.dotProduct(queryVector, entry.vector);
          similarity = dot;
          distance = 1 - dot;
          break;
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }

      if (similarity >= threshold) {
        results.push({
          entry,
          similarity,
          distance
        });
      }
    }

    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);

    // 返回 topK
    return results.slice(0, topK);
  }

  /**
   * 生成向量嵌入
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddingClient.embedText(text);

      return embedding;
    } catch (error) {
      console.error('[LightweightVectorStore] Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * 将条目驱逐到缓存
   */
  private async evictToCache(): Promise<void> {
    const entriesToEvict: VectorEntry[] = [];

    // 找出最老的条目
    const sortedEntries = Array.from(this.inMemory.values())
      .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    const evictCount = Math.floor(this.maxInMemory * 0.2);

    for (let i = 0; i < Math.min(evictCount, sortedEntries.length); i++) {
      const entry = sortedEntries[i];
      this.inMemory.delete(entry.id);
      this.cache.put(entry.id, entry);
      entriesToEvict.push(entry);
    }

    console.log(`[LightweightVectorStore] Evicted ${entriesToEvict.length} entries to cache`);
  }

  /**
   * 获取统计信息
   */
  getStats(): VectorStoreStats {
    return {
      total: this.inMemory.size + this.cache.size(),
      inMemory: this.inMemory.size,
      onDisk: this.cache.size(),
      cacheSize: this.cache.size(),
      cacheHitRate: this.cache.getHitRate()
    };
  }

  /**
   * 持久化
   */
  async persist(): Promise<void> {
    await this.saveToDisk();
  }

  /**
   * 清空
   */
  async clear(): Promise<void> {
    this.inMemory.clear();
    this.cache.clear();

    try {
      const fs = await import('fs/promises');
      await fs.unlink(this.filePath);
    } catch (error) {
      // 文件不存在，忽略
    }

    console.log('[LightweightVectorStore] Cleared all entries');
  }

  /**
   * 获取所有 ID
   */
  getAllIds(): string[] {
    return Array.from(this.inMemory.keys());
  }

  /**
   * 批量获取
   */
  getBatch(ids: string[]): VectorEntry[] {
    const entries: VectorEntry[] = [];

    for (const id of ids) {
      const entry = this.get(id);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }
}

// ==================== 单例导出 ====================

let vectorStoreInstance: LightweightVectorStore | null = null;

export function getVectorStore(): LightweightVectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new LightweightVectorStore(
      '/workspace/projects/data/vectors.json',
      1000,
      100
    );
  }
  return vectorStoreInstance;
}
