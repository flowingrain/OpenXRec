/**
 * 文件数据存储实现
 * 基于 JSON 文件的简单键值存储
 */

import fs from 'fs/promises';
import path from 'path';
import type { DataStore } from '@/types/storage';

export class FileDataStore<T extends { id: string }> implements DataStore<T> {
  private filePath: string;
  private data: Map<string, T> = new Map();
  private initialized: boolean = false;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      // 确保目录存在
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      // 尝试加载数据
      const exists = await fs.access(this.filePath).then(() => true).catch(() => false);
      if (exists) {
        const content = await fs.readFile(this.filePath, 'utf-8');
        const jsonData = JSON.parse(content);
        this.data = new Map(Object.entries(jsonData));
      }

      this.initialized = true;
    } catch (error) {
      console.error(`Failed to initialize FileDataStore: ${this.filePath}`, error);
      throw error;
    }
  }

  private async persist(): Promise<void> {
    try {
      const jsonData = Object.fromEntries(this.data);
      await fs.writeFile(this.filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to persist FileDataStore: ${this.filePath}`, error);
      throw error;
    }
  }

  async get(id: string): Promise<T | null> {
    await this.ensureInitialized();
    return this.data.get(id) || null;
  }

  async getAll(): Promise<T[]> {
    await this.ensureInitialized();
    return Array.from(this.data.values());
  }

  async set(id: string, data: T): Promise<void> {
    await this.ensureInitialized();
    this.data.set(id, data);
    await this.persist();
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    this.data.delete(id);
    await this.persist();
  }

  async exists(id: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.data.has(id);
  }

  async query(filter: (item: T) => boolean): Promise<T[]> {
    await this.ensureInitialized();
    return Array.from(this.data.values()).filter(filter);
  }
}

/**
 * 数据存储管理器
 * 统一管理所有数据存储
 */
import type {
  UserData,
  ItemData,
  ScenarioData,
  AlgorithmData,
  ConfigData
} from '@/types/storage';

export class DataStoreManager {
  private stores: {
    users: FileDataStore<UserData>;
    items: FileDataStore<ItemData>;
    scenarios: FileDataStore<ScenarioData>;
    algorithms: FileDataStore<AlgorithmData>;
    config: FileDataStore<ConfigData>;
  };

  constructor(dataDir: string = './data') {
    this.stores = {
      users: new FileDataStore<UserData>(path.join(dataDir, 'users.json')),
      items: new FileDataStore<ItemData>(path.join(dataDir, 'items.json')),
      scenarios: new FileDataStore<ScenarioData>(path.join(dataDir, 'scenarios.json')),
      algorithms: new FileDataStore<AlgorithmData>(path.join(dataDir, 'algorithms.json')),
      config: new FileDataStore<ConfigData>(path.join(dataDir, 'config.json')),
    };
  }

  get users() {
    return this.stores.users;
  }

  get items() {
    return this.stores.items;
  }

  get scenarios() {
    return this.stores.scenarios;
  }

  get algorithms() {
    return this.stores.algorithms;
  }

  get config() {
    return this.stores.config;
  }
}

// 单例实例
let dataStoreManagerInstance: DataStoreManager | null = null;

export function getDataStoreManager(dataDir?: string): DataStoreManager {
  if (!dataStoreManagerInstance) {
    dataStoreManagerInstance = new DataStoreManager(dataDir);
  }
  return dataStoreManagerInstance;
}
