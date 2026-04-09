/**
 * 文件系统持久化存储
 * 
 * 将记忆和会话数据持久化到本地文件系统
 * 生产环境建议使用数据库（如Supabase）
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  IMemoryStore,
  MemoryEntry,
  ConversationMemory,
  AgentState,
  MemorySearchResult
} from './index';

// 存储目录配置
const DATA_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp/memory-store'  // 生产环境使用临时目录
  : path.join(process.env.COZE_WORKSPACE_PATH || process.cwd(), 'data', 'memory-store');

// 确保目录存在
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // 目录已存在，忽略错误
  }
}

export class FileSystemStore implements IMemoryStore {
  private initialized = false;
  
  private async init(): Promise<void> {
    if (this.initialized) return;
    
    await ensureDir(DATA_DIR);
    await ensureDir(path.join(DATA_DIR, 'conversations'));
    await ensureDir(path.join(DATA_DIR, 'memories'));
    await ensureDir(path.join(DATA_DIR, 'agents'));
    
    this.initialized = true;
  }
  
  // ==================== 会话记忆 ====================
  
  async saveConversation(memory: ConversationMemory): Promise<void> {
    await this.init();
    
    const filePath = path.join(DATA_DIR, 'conversations', `${memory.sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify({
      ...memory,
      updatedAt: Date.now()
    }, null, 2), 'utf-8');
  }
  
  async loadConversation(sessionId: string): Promise<ConversationMemory | null> {
    await this.init();
    
    try {
      const filePath = path.join(DATA_DIR, 'conversations', `${sessionId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
  
  async listConversations(userId?: string): Promise<ConversationMemory[]> {
    await this.init();
    
    try {
      const dir = path.join(DATA_DIR, 'conversations');
      const files = await fs.readdir(dir);
      
      const conversations: ConversationMemory[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(dir, file), 'utf-8');
          const conv = JSON.parse(data) as ConversationMemory;
          
          if (!userId || conv.userId === userId) {
            conversations.push(conv);
          }
        }
      }
      
      return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      return [];
    }
  }
  
  async deleteConversation(sessionId: string): Promise<void> {
    await this.init();
    
    try {
      const filePath = path.join(DATA_DIR, 'conversations', `${sessionId}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // 文件不存在，忽略
    }
  }
  
  // ==================== 长期记忆 ====================
  
  async saveMemory(entry: MemoryEntry): Promise<void> {
    await this.init();
    
    const filePath = path.join(DATA_DIR, 'memories', `${entry.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    
    // 更新索引
    await this.updateIndex('memories', entry.id, {
      type: entry.type,
      timestamp: entry.metadata.timestamp,
      importance: entry.metadata.importance
    });
  }
  
  async loadMemory(id: string): Promise<MemoryEntry | null> {
    await this.init();
    
    try {
      const filePath = path.join(DATA_DIR, 'memories', `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(data) as MemoryEntry;
      
      // 更新访问计数
      entry.metadata.accessCount++;
      entry.metadata.lastAccessed = Date.now();
      await this.saveMemory(entry);
      
      return entry;
    } catch (error) {
      return null;
    }
  }
  
  async searchMemory(query: string, limit: number = 10): Promise<MemorySearchResult[]> {
    await this.init();
    
    try {
      const dir = path.join(DATA_DIR, 'memories');
      const files = await fs.readdir(dir);
      
      const queryLower = query.toLowerCase();
      const results: MemorySearchResult[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(dir, file), 'utf-8');
            const entry = JSON.parse(data) as MemoryEntry;
            
            // 简单的关键词匹配
            const contentLower = entry.content.toLowerCase();
            if (contentLower.includes(queryLower)) {
              // 计算相关性分数
              const relevance = this.calculateRelevance(entry, queryLower);
              
              results.push({ entry, relevance });
            }
          } catch (e) {
            // 单个文件错误不影响整体搜索
          }
        }
      }
      
      // 按相关性排序
      return results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
    } catch (error) {
      return [];
    }
  }
  
  async deleteMemory(id: string): Promise<void> {
    await this.init();
    
    try {
      const filePath = path.join(DATA_DIR, 'memories', `${id}.json`);
      await fs.unlink(filePath);
      await this.removeFromIndex('memories', id);
    } catch (error) {
      // 文件不存在，忽略
    }
  }
  
  // ==================== Agent状态 ====================
  
  async saveAgentState(state: AgentState): Promise<void> {
    await this.init();
    
    const fileName = `${state.sessionId}_${state.agentId}.json`;
    const filePath = path.join(DATA_DIR, 'agents', fileName);
    
    await fs.writeFile(filePath, JSON.stringify({
      ...state,
      updatedAt: Date.now()
    }, null, 2), 'utf-8');
  }
  
  async loadAgentState(agentId: string, sessionId: string): Promise<AgentState | null> {
    await this.init();
    
    try {
      const fileName = `${sessionId}_${agentId}.json`;
      const filePath = path.join(DATA_DIR, 'agents', fileName);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
  
  // ==================== 辅助方法 ====================
  
  private async updateIndex(
    type: 'memories',
    id: string,
    metadata: any
  ): Promise<void> {
    try {
      const indexPath = path.join(DATA_DIR, type, '_index.json');
      let index: Record<string, any> = {};
      
      try {
        const data = await fs.readFile(indexPath, 'utf-8');
        index = JSON.parse(data);
      } catch (e) {
        // 索引不存在，创建新的
      }
      
      index[id] = metadata;
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      // 索引更新失败不影响主流程
    }
  }
  
  private async removeFromIndex(type: 'memories', id: string): Promise<void> {
    try {
      const indexPath = path.join(DATA_DIR, type, '_index.json');
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data);
      
      delete index[id];
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      // 忽略
    }
  }
  
  private calculateRelevance(entry: MemoryEntry, query: string): number {
    let score = entry.metadata.importance;
    
    // 时间衰减
    const ageMs = Date.now() - entry.metadata.timestamp;
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    score *= Math.exp(-ageDays / 30); // 30天半衰期
    
    // 访问次数加权
    score *= Math.log(1 + entry.metadata.accessCount) / 10;
    
    // 类型加权
    const typeWeights: Record<string, number> = {
      fact: 1.2,
      preference: 1.1,
      context: 1.0,
      conversation: 0.8,
      result: 0.9
    };
    score *= typeWeights[entry.type] || 1.0;
    
    return Math.min(1, Math.max(0, score));
  }
  
  // ==================== 维护操作 ====================
  
  async cleanup(): Promise<void> {
    await this.init();
    
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
    
    try {
      const dir = path.join(DATA_DIR, 'memories');
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        if (file.endsWith('.json') && file !== '_index.json') {
          try {
            const filePath = path.join(dir, file);
            const data = await fs.readFile(filePath, 'utf-8');
            const entry = JSON.parse(data) as MemoryEntry;
            
            const age = now - entry.metadata.lastAccessed;
            const decayedImportance = entry.metadata.importance * Math.exp(-age / maxAge);
            
            if (decayedImportance < 0.05) {
              await fs.unlink(filePath);
              await this.removeFromIndex('memories', entry.id);
            }
          } catch (e) {
            // 忽略单个文件错误
          }
        }
      }
    } catch (error) {
      // 忽略
    }
  }
  
  // 获取存储统计信息
  async getStats(): Promise<{
    conversations: number;
    memories: number;
    agents: number;
    totalSize: number;
  }> {
    await this.init();
    
    const countFiles = async (dir: string): Promise<number> => {
      try {
        const files = await fs.readdir(dir);
        return files.filter(f => f.endsWith('.json') && f !== '_index.json').length;
      } catch {
        return 0;
      }
    };
    
    const getDirSize = async (dir: string): Promise<number> => {
      try {
        const files = await fs.readdir(dir);
        let size = 0;
        for (const file of files) {
          const stat = await fs.stat(path.join(dir, file));
          size += stat.size;
        }
        return size;
      } catch {
        return 0;
      }
    };
    
    const [conversations, memories, agents, convSize, memSize, agentSize] = await Promise.all([
      countFiles(path.join(DATA_DIR, 'conversations')),
      countFiles(path.join(DATA_DIR, 'memories')),
      countFiles(path.join(DATA_DIR, 'agents')),
      getDirSize(path.join(DATA_DIR, 'conversations')),
      getDirSize(path.join(DATA_DIR, 'memories')),
      getDirSize(path.join(DATA_DIR, 'agents'))
    ]);
    
    return {
      conversations,
      memories,
      agents,
      totalSize: convSize + memSize + agentSize
    };
  }
}

// 导出工厂函数
export function createPersistentStore(): FileSystemStore {
  return new FileSystemStore();
}
