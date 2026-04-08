/**
 * ContextManager PPO 扩展
 * 
 * 功能：
 * 1. 将 PPO 超参数纳入会话上下文管理
 * 2. 实现跨会话记忆加载（加载用户最优配置）
 * 3. 会话恢复时自动应用历史最优配置
 * 4. 压缩上下文时保留关键超参数信息
 */

import type { SessionMemory, CompressedContext } from './context-manager';
import type { PPOHyperparamVersionRecord } from './persistence/types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * PPO 上下文扩展配置
 */
export interface PPOContextExtensionConfig {
  // 是否启用 PPO 上下文集成
  enabled: boolean;
  
  // 是否自动加载用户最优配置
  autoLoadUserOptimal: boolean;
  
  // 是否保存配置到压缩上下文
  saveToCompressedContext: boolean;
  
  // 最优配置选择策略
  optimalSelectionStrategy: 'best_performance' | 'most_used' | 'latest_verified';
}

/**
 * 默认配置
 */
const DEFAULT_PPO_CONTEXT_CONFIG: PPOContextExtensionConfig = {
  enabled: true,
  autoLoadUserOptimal: true,
  saveToCompressedContext: true,
  optimalSelectionStrategy: 'best_performance',
};

/**
 * 会话中的 PPO 配置信息
 */
export interface SessionPPOConfig {
  // 当前使用的配置
  currentConfig: {
    versionId: string;
    version: number;
    hyperparams: {
      learningRate: number;
      clipEpsilon: number;
      entropyCoef: number;
      gaeLambda: number;
    };
    source: 'loaded' | 'optimized' | 'default';
  };
  
  // 本次会话的效果
  sessionEffect: {
    samplesProcessed: number;
    avgReward: number;
    avgLoss: number;
    startTime: number;
  };
  
  // 是否需要保存新版本
  needsSave: boolean;
}

/**
 * 扩展的压缩上下文（包含 PPO 信息）
 */
export interface ExtendedCompressedContext extends CompressedContext {
  // PPO 配置摘要
  ppoConfig?: {
    version: number;
    hyperparams: SessionPPOConfig['currentConfig']['hyperparams'];
    performance?: {
      avgReward: number;
      trend: string;
    };
  };
}

// ============================================================================
// PPO 上下文扩展类
// ============================================================================

/**
 * PPO 上下文扩展
 */
export class PPOContextExtension {
  private config: PPOContextExtensionConfig;
  private sessionConfigs: Map<string, SessionPPOConfig> = new Map();
  
  constructor(config: Partial<PPOContextExtensionConfig> = {}) {
    this.config = { ...DEFAULT_PPO_CONTEXT_CONFIG, ...config };
  }

  // ===========================================================================
  // 核心接口
  // ===========================================================================

  /**
   * 初始化会话的 PPO 配置
   */
  async initializeSessionConfig(
    sessionId: string,
    userId: string
  ): Promise<SessionPPOConfig> {
    // 检查是否已有配置
    if (this.sessionConfigs.has(sessionId)) {
      return this.sessionConfigs.get(sessionId)!;
    }
    
    let config: SessionPPOConfig;
    
    if (this.config.autoLoadUserOptimal) {
      // 尝试加载用户最优配置
      const optimalConfig = await this.loadUserOptimalConfig(userId);
      
      if (optimalConfig) {
        config = {
          currentConfig: {
            versionId: optimalConfig.id,
            version: optimalConfig.version,
            hyperparams: {
              learningRate: optimalConfig.config.learningRate,
              clipEpsilon: optimalConfig.config.clipEpsilon,
              entropyCoef: optimalConfig.config.entropyCoef,
              gaeLambda: optimalConfig.config.gaeLambda,
            },
            source: 'loaded',
          },
          sessionEffect: {
            samplesProcessed: 0,
            avgReward: 0,
            avgLoss: 0,
            startTime: Date.now(),
          },
          needsSave: false,
        };
        
        console.log(`[PPOContextExtension] Loaded optimal config v${optimalConfig.version} for user ${userId}`);
      } else {
        // 使用默认配置
        config = this.createDefaultConfig();
        console.log(`[PPOContextExtension] Using default config for user ${userId}`);
      }
    } else {
      config = this.createDefaultConfig();
    }
    
    this.sessionConfigs.set(sessionId, config);
    return config;
  }

  /**
   * 更新会话效果
   */
  updateSessionEffect(
    sessionId: string,
    effect: Partial<SessionPPOConfig['sessionEffect']>
  ): void {
    const config = this.sessionConfigs.get(sessionId);
    if (!config) return;
    
    config.sessionEffect = {
      ...config.sessionEffect,
      ...effect,
    };
    
    // 检查是否需要保存
    if (config.sessionEffect.samplesProcessed >= 100 && 
        config.sessionEffect.avgReward > 0.5) {
      config.needsSave = true;
    }
  }

  /**
   * 更新当前配置
   */
  updateCurrentConfig(
    sessionId: string,
    newConfig: Partial<SessionPPOConfig['currentConfig']>
  ): void {
    const config = this.sessionConfigs.get(sessionId);
    if (!config) return;
    
    config.currentConfig = {
      ...config.currentConfig,
      ...newConfig,
    };
    config.needsSave = true;
  }

  /**
   * 获取会话配置
   */
  getSessionConfig(sessionId: string): SessionPPOConfig | null {
    return this.sessionConfigs.get(sessionId) || null;
  }

  /**
   * 清理会话配置
   */
  cleanupSession(sessionId: string): void {
    this.sessionConfigs.delete(sessionId);
  }

  // ===========================================================================
  // 上下文压缩集成
  // ===========================================================================

  /**
   * 将 PPO 信息添加到压缩上下文
   */
  enrichCompressedContext(
    sessionId: string,
    context: CompressedContext
  ): ExtendedCompressedContext {
    const config = this.sessionConfigs.get(sessionId);
    
    if (!config || !this.config.saveToCompressedContext) {
      return context as ExtendedCompressedContext;
    }
    
    const extended: ExtendedCompressedContext = {
      ...context,
      ppoConfig: {
        version: config.currentConfig.version,
        hyperparams: config.currentConfig.hyperparams,
        performance: {
          avgReward: config.sessionEffect.avgReward,
          trend: 'stable', // 简化，实际可从历史计算
        },
      },
    };
    
    return extended;
  }

  /**
   * 从压缩上下文恢复 PPO 配置
   */
  async restoreFromCompressedContext(
    sessionId: string,
    context: ExtendedCompressedContext,
    userId: string
  ): Promise<SessionPPOConfig | null> {
    if (!context.ppoConfig) {
      return this.initializeSessionConfig(sessionId, userId);
    }
    
    const ppoConfig = context.ppoConfig;
    
    // 查找对应版本
    const { getPPOPersistenceService } = await import('./ppo/adaptive-hyperparams');
    const persistence = getPPOPersistenceService();
    
    const versions = await persistence.getVersions({ limit: 100 });
    const version = versions.find(v => v.version === ppoConfig.version);
    
    if (version) {
      const config: SessionPPOConfig = {
        currentConfig: {
          versionId: version.id,
          version: version.version,
          hyperparams: ppoConfig.hyperparams,
          source: 'loaded',
        },
        sessionEffect: {
          samplesProcessed: 0,
          avgReward: 0,
          avgLoss: 0,
          startTime: Date.now(),
        },
        needsSave: false,
      };
      
      this.sessionConfigs.set(sessionId, config);
      console.log(`[PPOContextExtension] Restored PPO config v${version.version} from context`);
      return config;
    }
    
    // 版本不存在，使用当前配置但更新参数
    const config: SessionPPOConfig = {
      currentConfig: {
        versionId: 'unknown',
        version: ppoConfig.version,
        hyperparams: ppoConfig.hyperparams,
        source: 'loaded',
      },
      sessionEffect: {
        samplesProcessed: 0,
        avgReward: 0,
        avgLoss: 0,
        startTime: Date.now(),
      },
      needsSave: false,
    };
    
    this.sessionConfigs.set(sessionId, config);
    return config;
  }

  // ===========================================================================
  // 用户最优配置加载
  // ===========================================================================

  /**
   * 加载用户最优配置
   */
  private async loadUserOptimalConfig(userId: string): Promise<PPOHyperparamVersionRecord | null> {
    try {
      const { getPPOPersistenceService } = await import('./ppo/adaptive-hyperparams');
      const persistence = getPPOPersistenceService();
      
      // 根据策略选择最优配置
      switch (this.config.optimalSelectionStrategy) {
        case 'best_performance':
          return await this.selectBestPerformance(persistence);
        
        case 'most_used':
          return await this.selectMostUsed(persistence);
        
        case 'latest_verified':
          return await this.selectLatestVerified(persistence);
        
        default:
          return await this.selectBestPerformance(persistence);
      }
    } catch (error) {
      console.error('[PPOContextExtension] Failed to load user optimal config:', error);
      return null;
    }
  }

  /**
   * 选择性能最优的配置
   */
  private async selectBestPerformance(persistence: any): Promise<PPOHyperparamVersionRecord | null> {
    // 首先尝试获取激活版本
    const activeVersion = await persistence.getActiveVersion();
    if (activeVersion && activeVersion.performance?.avgReward > 0) {
      return activeVersion;
    }
    
    // 获取所有版本并按性能排序
    const versions = await persistence.getVersions({ limit: 20, includeInactive: false });
    
    if (versions.length === 0) return null;
    
    // 按平均奖励排序
    const sorted = versions
      .filter((v: PPOHyperparamVersionRecord) => v.performance && v.performance.avgReward > 0)
      .sort((a: PPOHyperparamVersionRecord, b: PPOHyperparamVersionRecord) => (b.performance?.avgReward || 0) - (a.performance?.avgReward || 0));
    
    return sorted[0] || versions[0];
  }

  /**
   * 选择使用最多的配置
   */
  private async selectMostUsed(persistence: any): Promise<PPOHyperparamVersionRecord | null> {
    const versions = await persistence.getVersions({ limit: 20 });
    
    if (versions.length === 0) return null;
    
    // 按样本数排序
    const sorted = versions
      .filter((v: PPOHyperparamVersionRecord) => v.performance && v.performance.sampleCount > 0)
      .sort((a: PPOHyperparamVersionRecord, b: PPOHyperparamVersionRecord) => (b.performance?.sampleCount || 0) - (a.performance?.sampleCount || 0));
    
    return sorted[0] || versions[0];
  }

  /**
   * 选择最新审核通过的配置
   */
  private async selectLatestVerified(persistence: any): Promise<PPOHyperparamVersionRecord | null> {
    const versions = await persistence.getVersions({ limit: 20 });
    
    // 筛选已审核的版本
    const verified = versions.filter((v: PPOHyperparamVersionRecord) => v.is_verified);
    
    if (verified.length > 0) {
      return verified[0];
    }
    
    // 没有审核版本，返回激活版本或最新版本
    const activeVersion = await persistence.getActiveVersion();
    return activeVersion || versions[0];
  }

  // ===========================================================================
  // 辅助方法
  // ===========================================================================

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): SessionPPOConfig {
    return {
      currentConfig: {
        versionId: 'default',
        version: 0,
        hyperparams: {
          learningRate: 3e-4,
          clipEpsilon: 0.2,
          entropyCoef: 0.01,
          gaeLambda: 0.95,
        },
        source: 'default',
      },
      sessionEffect: {
        samplesProcessed: 0,
        avgReward: 0,
        avgLoss: 0,
        startTime: Date.now(),
      },
      needsSave: false,
    };
  }

  /**
   * 保存会话配置为新版本
   */
  async saveSessionConfigAsVersion(sessionId: string): Promise<{ success: boolean; versionId?: string }> {
    const config = this.sessionConfigs.get(sessionId);
    if (!config || !config.needsSave) {
      return { success: false };
    }
    
    try {
      const { getPPOPersistenceService } = await import('./ppo/adaptive-hyperparams');
      const persistence = getPPOPersistenceService();
      
      const version = await persistence.saveVersion({
        config: {
          ...config.currentConfig.hyperparams,
          timestamp: Date.now(),
        },
        performance: {
          avgReward: config.sessionEffect.avgReward,
          avgLoss: config.sessionEffect.avgLoss,
          avgKl: 0,
          trend: 'stable',
          sampleCount: config.sessionEffect.samplesProcessed,
        },
        source: 'auto',
        tags: ['session-derived'],
        notes: `会话 ${sessionId} 生成的配置`,
        createdBy: 'ppo-context-extension',
      });
      
      if (version) {
        config.currentConfig.versionId = version.id;
        config.currentConfig.version = version.version;
        config.needsSave = false;
        
        console.log(`[PPOContextExtension] Saved session config as version ${version.version}`);
        return { success: true, versionId: version.id };
      }
      
      return { success: false };
    } catch (error) {
      console.error('[PPOContextExtension] Failed to save session config:', error);
      return { success: false };
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    activeSessions: number;
    totalSamplesProcessed: number;
    avgSessionReward: number;
  } {
    const sessions = Array.from(this.sessionConfigs.values());
    
    return {
      activeSessions: sessions.length,
      totalSamplesProcessed: sessions.reduce((sum, s) => sum + s.sessionEffect.samplesProcessed, 0),
      avgSessionReward: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.sessionEffect.avgReward, 0) / sessions.length
        : 0,
    };
  }
}

// ============================================================================
// 单例
// ============================================================================

let extensionInstance: PPOContextExtension | null = null;

export function getPPOContextExtension(
  config?: Partial<PPOContextExtensionConfig>
): PPOContextExtension {
  if (!extensionInstance) {
    extensionInstance = new PPOContextExtension(config);
  }
  return extensionInstance;
}

export default PPOContextExtension;
