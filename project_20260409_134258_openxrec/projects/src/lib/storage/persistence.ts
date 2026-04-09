/**
 * 探索路径持久化存储
 * 使用 IndexedDB 存储分析会话、假设验证沙盒等数据
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 存储的分析会话
 */
export interface StoredSession {
  id: string;
  type: 'exploration' | 'sandbox' | 'scenario' | 'review';
  name: string;
  description?: string;
  data: any; // 会话数据
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
    tags: string[];
    isFavorite: boolean;
  };
  statistics?: {
    hypothesesCount?: number;
    evidenceCount?: number;
    confidence?: number;
    status?: string;
  };
}

/**
 * 存储配置
 */
export interface StorageConfig {
  dbName: string;
  dbVersion: number;
  storeName: string;
}

/**
 * 搜索参数
 */
export interface SearchParams {
  query?: string;
  type?: StoredSession['type'];
  tags?: string[];
  isFavorite?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  limit?: number;
  offset?: number;
}

/**
 * 导出数据
 */
export interface ExportData {
  version: string;
  exportedAt: string;
  sessions: StoredSession[];
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: StorageConfig = {
  dbName: 'SituationAwarenessDB',
  dbVersion: 1,
  storeName: 'sessions'
};

const CURRENT_VERSION = '1.0.0';

// ============================================================================
// 持久化存储类
// ============================================================================

/**
 * IndexedDB 持久化存储
 */
export class PersistenceStorage {
  private config: StorageConfig;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  
  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initPromise = this.init();
  }
  
  /**
   * 初始化数据库
   */
  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);
      
      request.onerror = () => {
        console.error('[Storage] Failed to open database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[Storage] Database opened successfully');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建对象存储
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const store = db.createObjectStore(this.config.storeName, { keyPath: 'id' });
          
          // 创建索引
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
          store.createIndex('updatedAt', 'metadata.updatedAt', { unique: false });
          store.createIndex('isFavorite', 'metadata.isFavorite', { unique: false });
          store.createIndex('tags', 'metadata.tags', { unique: false, multiEntry: true });
          
          console.log('[Storage] Object store created');
        }
      };
    });
  }
  
  /**
   * 确保数据库已初始化
   */
  private async ensureReady(): Promise<void> {
    if (!this.db && this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
  }
  
  /**
   * 获取事务和存储
   */
  private getStore(mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction(this.config.storeName, mode);
    return transaction.objectStore(this.config.storeName);
  }
  
  /**
   * 保存会话
   */
  async saveSession(session: Omit<StoredSession, 'metadata'> & Partial<{ metadata: Partial<StoredSession['metadata']> }>): Promise<StoredSession> {
    await this.ensureReady();
    
    const now = new Date().toISOString();
    const existing = await this.getSession(session.id);
    
    const fullSession: StoredSession = {
      ...session,
      metadata: {
        createdAt: existing?.metadata.createdAt || now,
        updatedAt: now,
        version: CURRENT_VERSION,
        tags: session.metadata?.tags || existing?.metadata.tags || [],
        isFavorite: session.metadata?.isFavorite ?? existing?.metadata.isFavorite ?? false
      }
    };
    
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.put(fullSession);
      
      request.onsuccess = () => resolve(fullSession);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 获取会话
   */
  async getSession(id: string): Promise<StoredSession | null> {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 删除会话
   */
  async deleteSession(id: string): Promise<boolean> {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 搜索会话
   */
  async searchSessions(params: SearchParams = {}): Promise<StoredSession[]> {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const request = store.getAll();
      
      request.onsuccess = () => {
        let results = request.result as StoredSession[];
        
        // 过滤类型
        if (params.type) {
          results = results.filter(s => s.type === params.type);
        }
        
        // 过滤收藏
        if (params.isFavorite !== undefined) {
          results = results.filter(s => s.metadata.isFavorite === params.isFavorite);
        }
        
        // 过滤标签
        if (params.tags && params.tags.length > 0) {
          results = results.filter(s =>
            params.tags!.some(tag => s.metadata.tags.includes(tag))
          );
        }
        
        // 过滤日期范围
        if (params.dateRange) {
          const start = new Date(params.dateRange.start).getTime();
          const end = new Date(params.dateRange.end).getTime();
          results = results.filter(s => {
            const created = new Date(s.metadata.createdAt).getTime();
            return created >= start && created <= end;
          });
        }
        
        // 文本搜索
        if (params.query) {
          const query = params.query.toLowerCase();
          results = results.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.description?.toLowerCase().includes(query) ||
            s.metadata.tags.some(t => t.toLowerCase().includes(query))
          );
        }
        
        // 按更新时间排序（最新的在前）
        results.sort((a, b) =>
          new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime()
        );
        
        // 分页
        if (params.offset !== undefined || params.limit !== undefined) {
          const offset = params.offset || 0;
          const limit = params.limit || results.length;
          results = results.slice(offset, offset + limit);
        }
        
        resolve(results);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 获取所有标签
   */
  async getAllTags(): Promise<string[]> {
    const sessions = await this.searchSessions();
    const tagsSet = new Set<string>();
    
    for (const session of sessions) {
      session.metadata.tags.forEach(tag => tagsSet.add(tag));
    }
    
    return Array.from(tagsSet).sort();
  }
  
  /**
   * 切换收藏状态
   */
  async toggleFavorite(id: string): Promise<boolean> {
    const session = await this.getSession(id);
    if (!session) return false;
    
    session.metadata.isFavorite = !session.metadata.isFavorite;
    await this.saveSession(session);
    
    return session.metadata.isFavorite;
  }
  
  /**
   * 添加标签
   */
  async addTags(id: string, tags: string[]): Promise<void> {
    const session = await this.getSession(id);
    if (!session) return;
    
    const newTags = [...new Set([...session.metadata.tags, ...tags])];
    session.metadata.tags = newTags;
    await this.saveSession(session);
  }
  
  /**
   * 移除标签
   */
  async removeTags(id: string, tags: string[]): Promise<void> {
    const session = await this.getSession(id);
    if (!session) return;
    
    session.metadata.tags = session.metadata.tags.filter(t => !tags.includes(t));
    await this.saveSession(session);
  }
  
  /**
   * 导出所有数据
   */
  async exportAll(): Promise<ExportData> {
    const sessions = await this.searchSessions();
    
    return {
      version: CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      sessions
    };
  }
  
  /**
   * 导入数据
   */
  async importData(data: ExportData, options?: { overwrite?: boolean }): Promise<number> {
    let imported = 0;
    
    for (const session of data.sessions) {
      try {
        const existing = await this.getSession(session.id);
        
        if (existing && !options?.overwrite) {
          continue;
        }
        
        await this.saveSession({
          ...session,
          metadata: {
            ...session.metadata,
            version: CURRENT_VERSION
          }
        });
        imported++;
      } catch (error) {
        console.error('[Storage] Import failed for session:', session.id, error);
      }
    }
    
    return imported;
  }
  
  /**
   * 清空所有数据
   */
  async clearAll(): Promise<void> {
    await this.ensureReady();
    
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * 获取存储统计
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    byType: Record<string, number>;
    favorites: number;
    totalSize: number;
  }> {
    const sessions = await this.searchSessions();
    
    const byType: Record<string, number> = {};
    let favorites = 0;
    
    for (const session of sessions) {
      byType[session.type] = (byType[session.type] || 0) + 1;
      if (session.metadata.isFavorite) favorites++;
    }
    
    // 估算存储大小
    const totalSize = new Blob([JSON.stringify(sessions)]).size;
    
    return {
      totalSessions: sessions.length,
      byType,
      favorites,
      totalSize
    };
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let storageInstance: PersistenceStorage | null = null;

/**
 * 获取存储实例
 */
export function getStorage(): PersistenceStorage {
  if (!storageInstance) {
    storageInstance = new PersistenceStorage();
  }
  return storageInstance;
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 保存探索会话
 */
export async function saveExplorationSession(
  id: string,
  name: string,
  data: any,
  options?: {
    description?: string;
    tags?: string[];
    statistics?: StoredSession['statistics'];
  }
): Promise<StoredSession> {
  const storage = getStorage();
  return storage.saveSession({
    id,
    type: 'exploration',
    name,
    description: options?.description,
    data,
    metadata: {
      tags: options?.tags || [],
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: CURRENT_VERSION
    },
    statistics: options?.statistics
  });
}

/**
 * 保存沙盒会话
 */
export async function saveSandboxSession(
  id: string,
  name: string,
  data: any,
  options?: {
    description?: string;
    tags?: string[];
    statistics?: StoredSession['statistics'];
  }
): Promise<StoredSession> {
  const storage = getStorage();
  return storage.saveSession({
    id,
    type: 'sandbox',
    name,
    description: options?.description,
    data,
    metadata: {
      tags: options?.tags || [],
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: CURRENT_VERSION
    },
    statistics: options?.statistics
  });
}
