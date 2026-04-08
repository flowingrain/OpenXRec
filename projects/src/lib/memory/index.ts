/**
 * 记忆系统 - 核心模块
 * 
 * 功能：
 * - 短期记忆（当前会话上下文）
 * - 长期记忆（跨会话持久化）
 * - 工作记忆（Agent执行中间状态）
 */

// ==================== 类型定义 ====================

export interface MemoryEntry {
  id: string;
  type: 'conversation' | 'fact' | 'preference' | 'context' | 'result';
  content: string;
  metadata: {
    agentId?: string;
    timestamp: number;
    importance: number; // 0-1, 用于记忆衰减
    accessCount: number;
    lastAccessed: number;
  };
  embedding?: number[]; // 用于语义检索
}

export interface ConversationMemory {
  sessionId: string;
  userId?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    agentId?: string;
    timestamp: number;
  }>;
  context: {
    topic?: string;
    entities: string[];
    preferences: Record<string, any>;
  };
  createdAt: number;
  updatedAt: number;
}

export interface AgentState {
  agentId: string;
  sessionId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentTask?: string;
  intermediateResults: Record<string, any>;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  relevance: number;
}

// ==================== 记忆存储接口 ====================

export interface IMemoryStore {
  // 会话记忆
  saveConversation(memory: ConversationMemory): Promise<void>;
  loadConversation(sessionId: string): Promise<ConversationMemory | null>;
  listConversations(userId?: string): Promise<ConversationMemory[]>;
  deleteConversation(sessionId: string): Promise<void>;
  
  // 长期记忆
  saveMemory(entry: MemoryEntry): Promise<void>;
  loadMemory(id: string): Promise<MemoryEntry | null>;
  searchMemory(query: string, limit?: number): Promise<MemorySearchResult[]>;
  deleteMemory(id: string): Promise<void>;
  
  // Agent状态
  saveAgentState(state: AgentState): Promise<void>;
  loadAgentState(agentId: string, sessionId: string): Promise<AgentState | null>;
  
  // 清理
  cleanup?(): Promise<void>;
}

// ==================== 内存存储实现 ====================

export class InMemoryStore implements IMemoryStore {
  private conversations: Map<string, ConversationMemory> = new Map();
  private memories: Map<string, MemoryEntry> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  
  // 会话记忆
  async saveConversation(memory: ConversationMemory): Promise<void> {
    this.conversations.set(memory.sessionId, {
      ...memory,
      updatedAt: Date.now()
    });
  }
  
  async loadConversation(sessionId: string): Promise<ConversationMemory | null> {
    return this.conversations.get(sessionId) || null;
  }
  
  async listConversations(userId?: string): Promise<ConversationMemory[]> {
    const all = Array.from(this.conversations.values());
    if (userId) {
      return all.filter(c => c.userId === userId);
    }
    return all;
  }
  
  async deleteConversation(sessionId: string): Promise<void> {
    this.conversations.delete(sessionId);
  }
  
  // 长期记忆
  async saveMemory(entry: MemoryEntry): Promise<void> {
    this.memories.set(entry.id, entry);
  }
  
  async loadMemory(id: string): Promise<MemoryEntry | null> {
    const entry = this.memories.get(id);
    if (entry) {
      entry.metadata.accessCount++;
      entry.metadata.lastAccessed = Date.now();
    }
    return entry || null;
  }
  
  async searchMemory(query: string, limit: number = 10): Promise<MemorySearchResult[]> {
    // 简单的关键词匹配（实际应该用向量相似度）
    const queryLower = query.toLowerCase();
    const results: MemorySearchResult[] = [];
    
    for (const entry of this.memories.values()) {
      const contentLower = entry.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        results.push({
          entry,
          relevance: entry.metadata.importance
        });
      }
    }
    
    // 按重要性排序
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }
  
  async deleteMemory(id: string): Promise<void> {
    this.memories.delete(id);
  }
  
  // Agent状态
  async saveAgentState(state: AgentState): Promise<void> {
    const key = `${state.sessionId}:${state.agentId}`;
    this.agentStates.set(key, {
      ...state,
      updatedAt: Date.now()
    });
  }
  
  async loadAgentState(agentId: string, sessionId: string): Promise<AgentState | null> {
    return this.agentStates.get(`${sessionId}:${agentId}`) || null;
  }
  
  // 清理过期记忆
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天
    
    for (const [id, entry] of this.memories.entries()) {
      const age = now - entry.metadata.lastAccessed;
      const decayedImportance = entry.metadata.importance * Math.exp(-age / maxAge);
      
      if (decayedImportance < 0.1) {
        this.memories.delete(id);
      }
    }
  }
}

// ==================== 记忆管理器 ====================

export class MemoryManager {
  private store: IMemoryStore;
  private currentSession: ConversationMemory | null = null;
  
  constructor(store: IMemoryStore = new InMemoryStore()) {
    this.store = store;
  }
  
  // 创建新会话
  async createSession(userId?: string): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      sessionId,
      userId,
      messages: [],
      context: {
        entities: [],
        preferences: {}
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    await this.store.saveConversation(this.currentSession);
    return sessionId;
  }
  
  // 获取当前会话
  getCurrentSession(): ConversationMemory | null {
    return this.currentSession;
  }
  
  // 加载会话
  async loadSession(sessionId: string): Promise<ConversationMemory | null> {
    this.currentSession = await this.store.loadConversation(sessionId);
    return this.currentSession;
  }
  
  // 添加消息到会话
  async addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    agentId?: string
  ): Promise<void> {
    if (!this.currentSession) {
      await this.createSession();
    }
    
    this.currentSession!.messages.push({
      role,
      content,
      agentId,
      timestamp: Date.now()
    });
    
    this.currentSession!.updatedAt = Date.now();
    await this.store.saveConversation(this.currentSession!);
    
    // 同时保存到长期记忆
    await this.addMemory({
      type: 'conversation',
      content,
      metadata: {
        agentId,
        timestamp: Date.now(),
        importance: role === 'user' ? 0.8 : 0.6,
        accessCount: 1,
        lastAccessed: Date.now()
      }
    });
  }
  
  // 更新上下文
  async updateContext(updates: Partial<ConversationMemory['context']>): Promise<void> {
    if (!this.currentSession) return;
    
    this.currentSession.context = {
      ...this.currentSession.context,
      ...updates
    };
    
    this.currentSession.updatedAt = Date.now();
    await this.store.saveConversation(this.currentSession);
  }
  
  // 添加长期记忆
  async addMemory(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.store.saveMemory({
      id,
      ...entry
    });
    
    return id;
  }
  
  // 搜索相关记忆
  async recall(query: string, limit: number = 5): Promise<MemorySearchResult[]> {
    return this.store.searchMemory(query, limit);
  }
  
  // 获取会话历史摘要
  getHistorySummary(maxMessages: number = 10): string {
    if (!this.currentSession?.messages.length) {
      return '';
    }
    
    const recentMessages = this.currentSession.messages.slice(-maxMessages);
    return recentMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
  }
  
  // 获取上下文增强的提示
  getContextualPrompt(query: string): string {
    const summary = this.getHistorySummary();
    const context = this.currentSession?.context;
    
    let prompt = '';
    
    if (context?.topic) {
      prompt += `当前分析主题: ${context.topic}\n`;
    }
    
    if (context?.entities.length) {
      prompt += `已识别实体: ${context.entities.join(', ')}\n`;
    }
    
    if (summary) {
      prompt += `\n对话历史:\n${summary}\n`;
    }
    
    prompt += `\n当前问题: ${query}`;
    
    return prompt;
  }
  
  // 学习用户偏好
  async learnPreference(key: string, value: any): Promise<void> {
    if (!this.currentSession) return;
    
    this.currentSession.context.preferences[key] = value;
    await this.store.saveConversation(this.currentSession);
    
    // 同时保存为长期记忆
    await this.addMemory({
      type: 'preference',
      content: `${key}: ${JSON.stringify(value)}`,
      metadata: {
        timestamp: Date.now(),
        importance: 0.9, // 偏好信息重要性高
        accessCount: 1,
        lastAccessed: Date.now()
      }
    });
  }
  
  // 获取用户偏好
  getPreference(key: string): any {
    return this.currentSession?.context.preferences[key];
  }
}

// ==================== Agent状态管理器 ====================

export class AgentStateManager {
  private store: IMemoryStore;
  
  constructor(store: IMemoryStore = new InMemoryStore()) {
    this.store = store;
  }
  
  // 保存Agent状态
  async saveState(state: Omit<AgentState, 'createdAt' | 'updatedAt'>): Promise<void> {
    const existing = await this.store.loadAgentState(state.agentId, state.sessionId);
    
    await this.store.saveAgentState({
      ...state,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    });
  }
  
  // 加载Agent状态
  async loadState(agentId: string, sessionId: string): Promise<AgentState | null> {
    return this.store.loadAgentState(agentId, sessionId);
  }
  
  // 清除Agent状态
  async clearState(agentId: string, sessionId: string): Promise<void> {
    const state = await this.store.loadAgentState(agentId, sessionId);
    if (state) {
      await this.store.saveAgentState({
        ...state,
        status: 'idle',
        currentTask: undefined,
        intermediateResults: {},
        lastError: undefined
      });
    }
  }
}

// 导出单例实例
let memoryManagerInstance: MemoryManager | null = null;
let agentStateManagerInstance: AgentStateManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
  }
  return memoryManagerInstance;
}

export function getAgentStateManager(): AgentStateManager {
  if (!agentStateManagerInstance) {
    agentStateManagerInstance = new AgentStateManager();
  }
  return agentStateManagerInstance;
}

export const memoryManager = new MemoryManager();
export const agentStateManager = new AgentStateManager();
