/**
 * Supabase持久化存储（生产环境推荐）
 * 
 * 功能：
 * - 数据库持久化存储
 * - 向量相似度搜索
 * - 实时订阅
 * - 行级安全策略
 */

import { createClient } from '@supabase/supabase-js';
import {
  IMemoryStore,
  MemoryEntry,
  ConversationMemory,
  AgentState,
  MemorySearchResult
} from './index';

// Supabase配置
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export class SupabaseStore implements IMemoryStore {
  private supabase;
  
  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  // ==================== 会话管理 ====================
  
  async saveConversation(memory: ConversationMemory): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .upsert({
        session_id: memory.sessionId,
        user_id: memory.userId,
        messages: memory.messages,
        context: memory.context,
        created_at: new Date(memory.createdAt).toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }
  
  async loadConversation(sessionId: string): Promise<ConversationMemory | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    
    if (error || !data) return null;
    
    return {
      sessionId: data.session_id,
      userId: data.user_id,
      messages: data.messages || [],
      context: data.context || { entities: [], preferences: {} },
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime()
    };
  }
  
  async listConversations(userId?: string): Promise<ConversationMemory[]> {
    let query = this.supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error || !data) return [];
    
    return data.map(row => ({
      sessionId: row.session_id,
      userId: row.user_id,
      messages: row.messages || [],
      context: row.context || { entities: [], preferences: {} },
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime()
    }));
  }
  
  async deleteConversation(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .delete()
      .eq('session_id', sessionId);
    
    if (error) throw error;
  }
  
  // ==================== 记忆管理 ====================
  
  async saveMemory(entry: MemoryEntry): Promise<void> {
    const { error } = await this.supabase
      .from('memories')
      .insert({
        id: entry.id,
        type: entry.type,
        content: entry.content,
        metadata: entry.metadata,
        embedding: entry.embedding,
        created_at: new Date(entry.metadata.timestamp).toISOString()
      });
    
    if (error) throw error;
  }
  
  async loadMemory(id: string): Promise<MemoryEntry | null> {
    const { data, error } = await this.supabase
      .from('memories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return null;
    
    // 更新访问计数
    await this.supabase
      .from('memories')
      .update({
        access_count: (data.access_count || 0) + 1,
        last_accessed: new Date().toISOString()
      })
      .eq('id', id);
    
    return {
      id: data.id,
      type: data.type,
      content: data.content,
      metadata: data.metadata,
      embedding: data.embedding
    };
  }
  
  /**
   * 向量相似度搜索（需要pgvector扩展）
   */
  async searchMemory(query: string, limit: number = 10): Promise<MemorySearchResult[]> {
    // 方法1：使用向量相似度搜索
    // 需要先对query进行向量化，然后使用pgvector
    
    // 方法2：使用全文搜索
    const { data, error } = await this.supabase
      .from('memories')
      .select('*')
      .textSearch('content', query)
      .order('importance', { ascending: false })
      .limit(limit);
    
    if (error || !data) return [];
    
    return data.map(row => ({
      entry: {
        id: row.id,
        type: row.type,
        content: row.content,
        metadata: row.metadata
      },
      relevance: row.metadata?.importance || 0.5
    }));
  }
  
  /**
   * 向量搜索（需要embedding）
   */
  async vectorSearch(embedding: number[], limit: number = 10): Promise<MemorySearchResult[]> {
    const { data, error } = await this.supabase.rpc('match_memories', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit
    });
    
    if (error || !data) return [];
    
    return data.map((row: any) => ({
      entry: {
        id: row.id,
        type: row.type,
        content: row.content,
        metadata: row.metadata
      },
      relevance: row.similarity
    }));
  }
  
  async deleteMemory(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('memories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
  
  // ==================== Agent状态 ====================
  
  async saveAgentState(state: AgentState): Promise<void> {
    const { error } = await this.supabase
      .from('agent_states')
      .upsert({
        agent_id: state.agentId,
        session_id: state.sessionId,
        status: state.status,
        current_task: state.currentTask,
        intermediate_results: state.intermediateResults,
        last_error: state.lastError,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }
  
  async loadAgentState(agentId: string, sessionId: string): Promise<AgentState | null> {
    const { data, error } = await this.supabase
      .from('agent_states')
      .select('*')
      .eq('agent_id', agentId)
      .eq('session_id', sessionId)
      .single();
    
    if (error || !data) return null;
    
    return {
      agentId: data.agent_id,
      sessionId: data.session_id,
      status: data.status,
      currentTask: data.current_task,
      intermediateResults: data.intermediate_results || {},
      lastError: data.last_error,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime()
    };
  }
}

/**
 * 数据库表结构（Supabase SQL）
 * 
 * -- 会话表
 * CREATE TABLE conversations (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   session_id TEXT UNIQUE NOT NULL,
 *   user_id TEXT,
 *   messages JSONB DEFAULT '[]',
 *   context JSONB DEFAULT '{"entities": [], "preferences": {}}',
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 记忆表（带向量）
 * CREATE TABLE memories (
 *   id TEXT PRIMARY KEY,
 *   type TEXT NOT NULL,
 *   content TEXT NOT NULL,
 *   metadata JSONB DEFAULT '{}',
 *   embedding VECTOR(1536),  -- OpenAI embedding dimension
 *   access_count INT DEFAULT 0,
 *   last_accessed TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 向量索引
 * CREATE INDEX ON memories USING ivfflat (embedding vector_cosine_ops);
 * 
 * -- 向量搜索函数
 * CREATE FUNCTION match_memories(
 *   query_embedding VECTOR(1536),
 *   match_threshold FLOAT,
 *   match_count INT
 * ) RETURNS TABLE (
 *   id TEXT,
 *   type TEXT,
 *   content TEXT,
 *   metadata JSONB,
 *   similarity FLOAT
 * ) AS $$
 * BEGIN
 *   RETURN QUERY
 *   SELECT
 *     m.id,
 *     m.type,
 *     m.content,
 *     m.metadata,
 *     1 - (m.embedding <=> query_embedding) AS similarity
 *   FROM memories m
 *   WHERE 1 - (m.embedding <=> query_embedding) > match_threshold
 *   ORDER BY m.embedding <=> query_embedding
 *   LIMIT match_count;
 * END;
 * $$ LANGUAGE plpgsql;
 * 
 * -- Agent状态表
 * CREATE TABLE agent_states (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   agent_id TEXT NOT NULL,
 *   session_id TEXT NOT NULL,
 *   status TEXT NOT NULL,
 *   current_task TEXT,
 *   intermediate_results JSONB DEFAULT '{}',
 *   last_error TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(agent_id, session_id)
 * );
 */

export function createSupabaseStore(): SupabaseStore {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
  }
  return new SupabaseStore();
}
