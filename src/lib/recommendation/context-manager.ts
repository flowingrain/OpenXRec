/**
 * 上下文管理服务
 * 
 * 功能：
 * 1. 会话记忆管理 - 当前会话的对话历史
 * 2. 上下文压缩 - 当上下文过长时进行智能压缩
 * 3. 跨会话记忆 - 加载历史会话的关键信息
 * 4. PPO 配置管理 - 跨会话的超参数配置记忆
 * 
 * 设计理念：
 * - 短期记忆：最近N轮对话（默认10轮）
 * - 压缩摘要：早期对话的压缩版本
 * - 长期记忆：关键事实和用户偏好（持久化）
 * - PPO记忆：最优超参数配置（跨会话学习）
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import { createClient } from '@supabase/supabase-js';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import { 
  PPOContextExtension, 
  getPPOContextExtension,
  type SessionPPOConfig,
  type ExtendedCompressedContext,
} from './context-ppo-extension';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 消息角色
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 会话消息
 */
export interface SessionMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: {
    query?: string;
    intent?: string;
    sources?: string[];
    confidence?: number;
  };
}

/**
 * 压缩后的上下文
 */
export interface CompressedContext {
  summary: string;              // 对话摘要
  keyFacts: string[];           // 关键事实
  userPreferences: string[];    // 用户偏好
  topics: string[];             // 讨论主题
  messageCount: number;         // 原始消息数量
  compressedAt: number;
  
  // PPO 配置摘要（可选）
  ppoConfig?: {
    version: number;
    hyperparams: {
      learningRate: number;
      clipEpsilon: number;
      entropyCoef: number;
      gaeLambda: number;
    };
    performance?: {
      avgReward: number;
      trend: string;
    };
  };
}

/**
 * 会话记忆
 */
export interface SessionMemory {
  sessionId: string;
  userId: string;
  messages: SessionMessage[];
  compressedContext?: CompressedContext;
  metadata: {
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    compressionCount: number;
  };
  
  // 场景标识（用于场景级配置）
  scenario?: string;
  
  // PPO 配置（会话级）
  ppoConfig?: SessionPPOConfig;
}

/**
 * 上下文管理配置
 */
export interface ContextManagerConfig {
  // 短期记忆限制
  maxRecentMessages: number;        // 保留最近N条完整消息（默认10）
  /** 供服务端估算与压缩触发：接近该预算时尝试摘要（非精确 tokenizer） */
  maxContextTokens: number;         // 默认8000
  
  // 压缩配置（按「估算 token 占满预算」触发，而非固定条数）
  /** 当估算 token ≥ maxContextTokens × 该比例时触发压缩（默认 0.88） */
  compressAtTokenRatio: number;
  /** @deprecated 不再作为触发条件；保留仅为兼容旧配置 */
  compressionThreshold?: number;
  compressionRatio: number;         // 保留字段；摘要提示仍可用
  
  // 长期记忆
  enableLongTermMemory: boolean;    // 启用长期记忆
  maxKeyFacts: number;              // 最大关键事实数（默认20）
  
  // PPO 配置记忆
  enablePPOMemory: boolean;         // 启用 PPO 跨会话记忆
  ppoOptimalStrategy: 'best_performance' | 'most_used' | 'latest_verified';
  
  // 持久化
  enablePersistence: boolean;       // 启用持久化
  persistenceType: 'memory' | 'supabase' | 'file';
}

// 默认配置
const DEFAULT_CONFIG: ContextManagerConfig = {
  maxRecentMessages: 10,
  maxContextTokens: 8000,
  compressAtTokenRatio: 0.88,
  compressionRatio: 0.3,
  enableLongTermMemory: true,
  maxKeyFacts: 20,
  enablePPOMemory: true,
  ppoOptimalStrategy: 'best_performance',
  enablePersistence: true,
  persistenceType: 'supabase',
};

// ============================================================================
// 上下文管理器
// ============================================================================

/**
 * 上下文管理器
 * 
 * 管理会话记忆、上下文压缩和跨会话记忆加载
 */
export class ContextManager {
  private llmClient: LLMClient;
  private config: ContextManagerConfig;
  private sessions: Map<string, SessionMemory> = new Map();
  private supabase: ReturnType<typeof createClient> | null = null;
  private ppoExtension: PPOContextExtension;

  constructor(config: Partial<ContextManagerConfig> = {}, llmClient?: LLMClient) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.llmClient = llmClient ?? (createLLMClient({}) as unknown as LLMClient);
    
    // 初始化 PPO 扩展
    this.ppoExtension = getPPOContextExtension({
      enabled: this.config.enablePPOMemory,
      autoLoadUserOptimal: this.config.enablePPOMemory,
      optimalSelectionStrategy: this.config.ppoOptimalStrategy,
    });
    
    // 仅当环境变量存在时才初始化Supabase
    if (this.config.enablePersistence && this.config.persistenceType === 'supabase') {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
      } else {
        console.warn('[ContextManager] Supabase credentials not found, falling back to memory mode');
        this.config.persistenceType = 'memory';
        this.config.enablePersistence = false;
      }
    }
  }

  // ===========================================================================
  // 核心方法：创建和加载会话
  // ===========================================================================

  /**
   * 创建新会话
   */
  async createSession(userId: string, scenario?: string, customSessionId?: string): Promise<string> {
    // 支持用户指定的 sessionId，或自动生成
    const sessionId = customSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const session: SessionMemory = {
      sessionId,
      userId,
      messages: [],
      scenario,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
        compressionCount: 0,
      },
    };
    
    this.sessions.set(sessionId, session);
    
    // 尝试加载用户的历史偏好
    if (this.config.enableLongTermMemory) {
      await this.loadUserPreferences(userId, session);
    }
    
    // 加载用户最优 PPO 配置
    if (this.config.enablePPOMemory) {
      try {
        const ppoConfig = await this.ppoExtension.initializeSessionConfig(sessionId, userId);
        session.ppoConfig = ppoConfig;
        console.log(`[ContextManager] Loaded PPO config v${ppoConfig.currentConfig.version} for user ${userId}`);
      } catch (error) {
        console.warn('[ContextManager] Failed to load PPO config:', error);
      }
    }
    
    console.log(`[ContextManager] Created session ${sessionId} for user ${userId}`);
    return sessionId;
  }

  /**
   * 加载现有会话
   */
  async loadSession(sessionId: string): Promise<SessionMemory | null> {
    // 先从内存中查找
    let session = this.sessions.get(sessionId);
    
    if (session) {
      console.log(`[ContextManager] Loaded session ${sessionId} from memory`);
      return session;
    }
    
    // 从持久化存储加载（仅当启用持久化且Supabase已配置时）
    if (this.supabase && this.config.enablePersistence) {
      const { data, error } = await this.supabase
        .from('session_memories')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (!error && data) {
        const row = data as any;
        session = {
          sessionId: row.session_id,
          userId: row.user_id,
          messages: row.messages || [],
          compressedContext: row.compressed_context,
          scenario: row.scenario,
          metadata: row.metadata,
        };
        
        // 恢复 PPO 配置
        if (this.config.enablePPOMemory && row.compressed_context?.ppoConfig) {
          try {
            const ppoConfig = await this.ppoExtension.restoreFromCompressedContext(
              sessionId,
              row.compressed_context as ExtendedCompressedContext,
              row.user_id
            );
            if (ppoConfig) {
              session.ppoConfig = ppoConfig;
            }
          } catch (error) {
            console.warn('[ContextManager] Failed to restore PPO config:', error);
          }
        }
        
        this.sessions.set(sessionId, session);
        console.log(`[ContextManager] Loaded session ${sessionId} from database`);
        return session;
      }
    }
    
    console.log(`[ContextManager] Session ${sessionId} not found`);
    return null;
  }

  /**
   * 获取或创建会话
   */
  async getOrCreateSession(userId: string, sessionId?: string): Promise<SessionMemory> {
    if (sessionId) {
      const existing = await this.loadSession(sessionId);
      if (existing) return existing;
      
      // 没找到现有会话，使用用户指定的 sessionId 创建
      return this.sessions.get(await this.createSession(userId, undefined, sessionId))!;
    }
    
    return this.sessions.get(await this.createSession(userId))!;
  }

  // ===========================================================================
  // 估算与压缩触发（供服务端；非展示用）
  // ===========================================================================

  /** 与 getContextForLLM 拼接一致，粗估 token ≈ ceil(chars/4) */
  private buildContextStringForEstimate(session: SessionMemory): string {
    const parts: string[] = [];
    if (session.compressedContext) {
      parts.push(`【历史对话摘要】\n${session.compressedContext.summary}`);
      if (session.compressedContext.keyFacts.length > 0) {
        parts.push(`\n【关键事实】\n${session.compressedContext.keyFacts.map((f) => `- ${f}`).join('\n')}`);
      }
      if (session.compressedContext.userPreferences.length > 0) {
        parts.push(`\n【用户偏好】\n${session.compressedContext.userPreferences.map((p) => `- ${p}`).join('\n')}`);
      }
    }
    const recentMessages = session.messages.slice(-this.config.maxRecentMessages);
    if (recentMessages.length > 0) {
      parts.push(
        `\n【最近对话】\n${recentMessages
          .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
          .join('\n\n')}`
      );
    }
    return parts.join('\n');
  }

  private estimateContextTokens(session: SessionMemory): number {
    const text = this.buildContextStringForEstimate(session);
    return Math.max(1, Math.ceil(text.length / 4));
  }

  /** 仅在估算接近 maxContextTokens 时压缩；不达到预算不压 */
  private async maybeCompressAfterMutation(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.messages.length < 2) return;
    const ratio = this.config.compressAtTokenRatio ?? 0.88;
    const budget = this.config.maxContextTokens;
    if (this.estimateContextTokens(session) < budget * ratio) return;
    await this.compressContext(sessionId);
  }

  // ===========================================================================
  // 核心方法：消息管理
  // ===========================================================================

  /**
   * 添加用户消息
   */
  async addUserMessage(
    sessionId: string,
    content: string,
    metadata?: SessionMessage['metadata']
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const message: SessionMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata,
    };
    
    session.messages.push(message);
    session.metadata.messageCount++;
    session.metadata.updatedAt = Date.now();

    await this.maybeCompressAfterMutation(sessionId);

    await this.persistSession(session);
  }

  /**
   * 添加助手消息
   */
  async addAssistantMessage(
    sessionId: string,
    content: string,
    metadata?: SessionMessage['metadata']
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const message: SessionMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata,
    };
    
    session.messages.push(message);
    session.metadata.messageCount++;
    session.metadata.updatedAt = Date.now();

    await this.maybeCompressAfterMutation(sessionId);

    await this.persistSession(session);
  }

  /**
   * 获取上下文（用于LLM调用）
   */
  async getContextForLLM(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    
    const parts: string[] = [];
    
    // 1. 添加压缩后的历史摘要
    if (session.compressedContext) {
      parts.push(`【历史对话摘要】\n${session.compressedContext.summary}`);
      
      if (session.compressedContext.keyFacts.length > 0) {
        parts.push(`\n【关键事实】\n${session.compressedContext.keyFacts.map(f => `- ${f}`).join('\n')}`);
      }
      
      if (session.compressedContext.userPreferences.length > 0) {
        parts.push(`\n【用户偏好】\n${session.compressedContext.userPreferences.map(p => `- ${p}`).join('\n')}`);
      }
    }
    
    // 2. 添加最近N条完整消息
    const recentMessages = session.messages.slice(-this.config.maxRecentMessages);
    if (recentMessages.length > 0) {
      parts.push(`\n【最近对话】\n${recentMessages.map(m => 
        `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`
      ).join('\n\n')}`);
    }
    
    return parts.join('\n');
  }

  /**
   * 获取LLM调用格式的消息列表
   */
  async getMessagesForLLM(sessionId: string): Promise<Array<{ role: MessageRole; content: string }>> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    const messages: Array<{ role: MessageRole; content: string }> = [];
    
    // 1. 如果有压缩摘要，添加为系统消息
    if (session.compressedContext) {
      messages.push({
        role: 'system',
        content: `这是之前对话的摘要：\n${session.compressedContext.summary}\n\n用户偏好：${session.compressedContext.userPreferences.join('、')}`,
      });
    }
    
    // 2. 添加最近N条消息
    const recentMessages = session.messages.slice(-this.config.maxRecentMessages);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
    
    return messages;
  }

  // ===========================================================================
  // 核心方法：上下文压缩
  // ===========================================================================

  /**
   * 压缩上下文
   * 
   * 将早期对话压缩为摘要，保留最近N条完整消息
   */
  async compressContext(sessionId: string): Promise<CompressedContext | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.messages.length < 2) {
      return null;
    }

    console.log(`[ContextManager] Compressing context for session ${sessionId}`);

    const maxR = this.config.maxRecentMessages;
    let recentMessages = session.messages.slice(-maxR);
    let toCompress = session.messages.slice(0, -maxR);

    // 条数未超过「最近窗口」但总字数已需压缩：保留末尾至少 2 条，前面并入摘要
    if (toCompress.length === 0) {
      const keep = Math.min(maxR, Math.max(2, session.messages.length - 1));
      if (session.messages.length <= keep) {
        return null;
      }
      recentMessages = session.messages.slice(-keep);
      toCompress = session.messages.slice(0, -keep);
    }

    if (toCompress.length === 0) {
      return null;
    }
    
    try {
      // 使用LLM进行压缩
      const compressionPrompt = `请分析以下对话历史，提取关键信息：

${toCompress.map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n\n')}

请以JSON格式返回：
{
  "summary": "对话摘要（100字以内）",
  "keyFacts": ["关键事实1", "关键事实2"],
  "userPreferences": ["用户偏好1", "用户偏好2"],
  "topics": ["讨论主题1", "讨论主题2"]
}`;

      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是一个专业的对话分析师，擅长提取关键信息和生成摘要。' },
        { role: 'user', content: compressionPrompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        const compressed: CompressedContext = {
          summary: parsed.summary || '',
          keyFacts: (parsed.keyFacts || []).slice(0, this.config.maxKeyFacts),
          userPreferences: parsed.userPreferences || [],
          topics: parsed.topics || [],
          messageCount: toCompress.length,
          compressedAt: Date.now(),
        };
        
        // 将 PPO 配置添加到压缩上下文
        if (this.config.enablePPOMemory && session.ppoConfig) {
          const extendedContext = this.ppoExtension.enrichCompressedContext(sessionId, compressed);
          compressed.ppoConfig = extendedContext.ppoConfig;
        }
        
        // 更新会话
        session.compressedContext = compressed;
        session.messages = recentMessages;
        session.metadata.compressionCount++;
        session.metadata.updatedAt = Date.now();
        
        await this.persistSession(session);
        
        console.log(`[ContextManager] Compressed ${toCompress.length} messages into summary`);
        return compressed;
      }
    } catch (error) {
      console.error('[ContextManager] Compression failed:', error);
    }
    
    return null;
  }

  // ===========================================================================
  // 核心方法：长期记忆
  // ===========================================================================

  /**
   * 加载用户历史偏好
   */
  private async loadUserPreferences(userId: string, session: SessionMemory): Promise<void> {
    if (!this.supabase) return;
    
    try {
      // 从历史会话中提取用户偏好
      const { data } = await this.supabase
        .from('session_memories')
        .select('compressed_context')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5);
      
      if (data && data.length > 0) {
        const preferences = new Set<string>();
        const facts = new Set<string>();
        
        for (const row of data) {
          const ctx = (row as any).compressed_context as CompressedContext | null;
          if (ctx) {
            ctx.userPreferences?.forEach(p => preferences.add(p));
            ctx.keyFacts?.forEach(f => facts.add(f));
          }
        }
        
        // 初始化压缩上下文
        session.compressedContext = {
          summary: '这是您的新会话。',
          keyFacts: Array.from(facts).slice(0, this.config.maxKeyFacts),
          userPreferences: Array.from(preferences),
          topics: [],
          messageCount: 0,
          compressedAt: Date.now(),
        };
        
        console.log(`[ContextManager] Loaded ${preferences.size} preferences and ${facts.size} facts for user ${userId}`);
      }
    } catch (error) {
      console.error('[ContextManager] Failed to load user preferences:', error);
    }
  }

  /**
   * 添加关键事实到会话上下文
   * 用于在追问场景中保存已提取的信息
   */
  async addKeyFacts(sessionId: string, facts: string[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || facts.length === 0) return;
    
    // 初始化压缩上下文（如果不存在）
    if (!session.compressedContext) {
      session.compressedContext = {
        summary: '',
        keyFacts: [],
        userPreferences: [],
        topics: [],
        messageCount: 0,
        compressedAt: Date.now(),
      };
    }
    
    // 合并并去重
    const existingFacts = new Set(session.compressedContext.keyFacts);
    for (const fact of facts) {
      existingFacts.add(fact);
    }
    
    // 更新并限制数量
    session.compressedContext.keyFacts = Array.from(existingFacts).slice(-this.config.maxKeyFacts);
    
    console.log(`[ContextManager] Added ${facts.length} key facts, total: ${session.compressedContext.keyFacts.length}`);
    
    // 持久化
    await this.persistSession(session);
  }

  /**
   * 保存会话到持久化存储
   */
  private async persistSession(session: SessionMemory): Promise<void> {
    if (!this.config.enablePersistence || !this.supabase) return;
    
    try {
      const { error } = await this.supabase
        .from('session_memories')
        .upsert({
          session_id: session.sessionId,
          user_id: session.userId,
          scenario: session.scenario ?? null,
          messages: session.messages,
          compressed_context: session.compressedContext,
          metadata: session.metadata,
          updated_at: new Date().toISOString(),
        } as any);
      
      if (error) {
        console.error('[ContextManager] Persist error:', error);
      }
    } catch (error) {
      console.error('[ContextManager] Failed to persist session:', error);
    }
  }

  // ===========================================================================
  // 工具方法
  // ===========================================================================

  /**
   * 获取会话统计
   */
  getSessionStats(sessionId: string): {
    messageCount: number;
    compressionCount: number;
    hasCompressedContext: boolean;
    createdAt: number;
    updatedAt: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return {
      messageCount: session.metadata.messageCount,
      compressionCount: session.metadata.compressionCount,
      hasCompressedContext: !!session.compressedContext,
      createdAt: session.metadata.createdAt,
      updatedAt: session.metadata.updatedAt,
    };
  }

  // ===========================================================================
  // PPO 配置管理
  // ===========================================================================

  /**
   * 更新会话的 PPO 配置
   */
  async updatePPOConfig(
    sessionId: string,
    updates: {
      hyperparams?: Partial<SessionPPOConfig['currentConfig']['hyperparams']>;
      effect?: Partial<SessionPPOConfig['sessionEffect']>;
    }
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.ppoConfig) return false;
    
    if (updates.hyperparams) {
      // 合并现有的hyperparams与更新
      const currentHyperparams = session.ppoConfig.currentConfig.hyperparams;
      const newHyperparams = {
        learningRate: updates.hyperparams.learningRate ?? currentHyperparams.learningRate,
        clipEpsilon: updates.hyperparams.clipEpsilon ?? currentHyperparams.clipEpsilon,
        entropyCoef: updates.hyperparams.entropyCoef ?? currentHyperparams.entropyCoef,
        gaeLambda: updates.hyperparams.gaeLambda ?? currentHyperparams.gaeLambda,
      };
      
      this.ppoExtension.updateCurrentConfig(sessionId, {
        hyperparams: newHyperparams,
        source: 'optimized',
      });
    }
    
    if (updates.effect) {
      this.ppoExtension.updateSessionEffect(sessionId, updates.effect);
    }
    
    // 更新 session 引用
    session.ppoConfig = this.ppoExtension.getSessionConfig(sessionId) || session.ppoConfig;
    session.metadata.updatedAt = Date.now();
    
    await this.persistSession(session);
    return true;
  }

  /**
   * 获取会话的 PPO 配置
   */
  getPPOConfig(sessionId: string): SessionPPOConfig | null {
    const session = this.sessions.get(sessionId);
    return session?.ppoConfig || null;
  }

  /**
   * 保存会话 PPO 配置为新版本
   */
  async savePPOConfigAsVersion(sessionId: string): Promise<{ success: boolean; versionId?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.ppoConfig) {
      return { success: false };
    }
    
    const result = await this.ppoExtension.saveSessionConfigAsVersion(sessionId);
    
    if (result.success && result.versionId) {
      session.ppoConfig.currentConfig.versionId = result.versionId;
      await this.persistSession(session);
    }
    
    return result;
  }

  /**
   * 基于场景加载最优配置
   */
  async loadOptimalConfigForScenario(
    userId: string,
    scenario: string
  ): Promise<SessionPPOConfig | null> {
    // 创建临时会话ID用于加载配置
    const tempSessionId = `temp_${Date.now()}`;
    
    try {
      const config = await this.ppoExtension.initializeSessionConfig(tempSessionId, userId);
      
      // 清理临时会话
      this.ppoExtension.cleanupSession(tempSessionId);
      
      return config;
    } catch (error) {
      console.error('[ContextManager] Failed to load optimal config for scenario:', error);
      return null;
    }
  }

  /**
   * 获取 PPO 扩展统计信息
   */
  getPPOStats(): {
    activeSessions: number;
    totalSamplesProcessed: number;
    avgSessionReward: number;
  } {
    return this.ppoExtension.getStats();
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions) {
      if (now - session.metadata.updatedAt > maxAgeMs) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[ContextManager] Cleaned up ${cleaned} expired sessions`);
    }
    
    return cleaned;
  }

  /**
   * 列出用户的所有会话
   */
  async listUserSessions(userId: string): Promise<Array<{
    sessionId: string;
    messageCount: number;
    updatedAt: number;
    summary?: string;
  }>> {
    const result: Array<{
      sessionId: string;
      messageCount: number;
      updatedAt: number;
      summary?: string;
    }> = [];
    
    // 从内存中查找
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        result.push({
          sessionId: session.sessionId,
          messageCount: session.metadata.messageCount,
          updatedAt: session.metadata.updatedAt,
          summary: session.compressedContext?.summary,
        });
      }
    }
    
    // 从数据库中查找（仅当启用持久化且Supabase已配置时）
    if (this.supabase && this.config.enablePersistence) {
      const { data } = await this.supabase
        .from('session_memories')
        .select('session_id, metadata, compressed_context')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (data) {
        for (const item of data) {
          const row = item as any;
          if (!result.find(r => r.sessionId === row.session_id)) {
            result.push({
              sessionId: row.session_id,
              messageCount: row.metadata?.messageCount || 0,
              updatedAt: row.metadata?.updatedAt || 0,
              summary: row.compressed_context?.summary,
            });
          }
        }
      }
    }
    
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

// ============================================================================
// 单例
// ============================================================================

let contextManagerInstance: ContextManager | null = null;

export function getContextManager(config?: Partial<ContextManagerConfig>): ContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new ContextManager(config);
  }
  return contextManagerInstance;
}

// ============================================================================
// 数据库表创建SQL
// ============================================================================

/**
 * 创建session_memories表的SQL
 * 
 * CREATE TABLE session_memories (
 *   id SERIAL PRIMARY KEY,
 *   session_id VARCHAR(255) UNIQUE NOT NULL,
 *   user_id VARCHAR(255) NOT NULL,
 *   scenario VARCHAR(100),                    -- 场景标识
 *   messages JSONB DEFAULT '[]',
 *   compressed_context JSONB,                 -- 包含 ppoConfig 字段
 *   metadata JSONB DEFAULT '{}',
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_session_memories_user_id ON session_memories(user_id);
 * CREATE INDEX idx_session_memories_scenario ON session_memories(scenario);
 * CREATE INDEX idx_session_memories_updated_at ON session_memories(updated_at);
 */
