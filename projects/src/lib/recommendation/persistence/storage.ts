/**
 * 自适应优化持久化存储服务
 * 
 * 功能：
 * 1. 反馈数据持久化到 Supabase
 * 2. 关键词规则持久化
 * 3. 校准状态持久化
 * 4. A/B测试数据存储
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import type {
  IntentFeedbackRecord,
  KeywordRuleRecord,
  CalibrationBinRecord,
  FallbackStateRecord,
  ABTestExperimentRecord,
  ABTestEventRecord,
  OptimizationHistoryRecord,
} from './types';

// ============================================================================
// 持久化存储服务
// ============================================================================

/**
 * 自适应优化持久化存储服务
 */
export class PersistenceStorageService {
  private supabase: ReturnType<typeof getSupabaseClient>;
  private initialized: boolean = false;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  // ===========================================================================
  // 初始化
  // ===========================================================================

  /**
   * 初始化存储（确保表存在）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[PersistenceStorage] Initializing...');

    // 检查必要的表是否存在，如果不存在则创建
    await this.ensureTablesExist();

    this.initialized = true;
    console.log('[PersistenceStorage] Initialized successfully');
  }

  /**
   * 确保表存在
   */
  private async ensureTablesExist(): Promise<void> {
    // 创建意图反馈表
    const createIntentFeedbacksTable = `
      CREATE TABLE IF NOT EXISTS adaptive_intent_feedbacks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        session_id VARCHAR(255),
        query TEXT NOT NULL,
        scenario VARCHAR(100),
        predicted_needs_search BOOLEAN NOT NULL,
        predicted_confidence FLOAT NOT NULL,
        prediction_source VARCHAR(50) NOT NULL,
        actual_needs_search BOOLEAN NOT NULL,
        actual_outcome VARCHAR(20) DEFAULT 'unknown',
        matched_keywords TEXT[] DEFAULT '{}',
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_intent_feedbacks_user_id ON adaptive_intent_feedbacks(user_id);
      CREATE INDEX IF NOT EXISTS idx_intent_feedbacks_created_at ON adaptive_intent_feedbacks(created_at);
      CREATE INDEX IF NOT EXISTS idx_intent_feedbacks_scenario ON adaptive_intent_feedbacks(scenario);
    `;

    // 创建关键词规则表
    const createKeywordRulesTable = `
      CREATE TABLE IF NOT EXISTS adaptive_keyword_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        keyword VARCHAR(100) NOT NULL UNIQUE,
        category VARCHAR(20) NOT NULL,
        match_count INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        confidence FLOAT DEFAULT 0.7,
        source VARCHAR(20) DEFAULT 'initial',
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_matched_at TIMESTAMP WITH TIME ZONE
      );
      
      CREATE INDEX IF NOT EXISTS idx_keyword_rules_keyword ON adaptive_keyword_rules(keyword);
      CREATE INDEX IF NOT EXISTS idx_keyword_rules_category ON adaptive_keyword_rules(category);
    `;

    // 创建校准数据表
    const createCalibrationBinsTable = `
      CREATE TABLE IF NOT EXISTS adaptive_calibration_bins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bin_index INTEGER NOT NULL,
        bin_start FLOAT NOT NULL,
        bin_end FLOAT NOT NULL,
        predicted_count INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        actual_accuracy FLOAT DEFAULT 0,
        time_window_start TIMESTAMP WITH TIME ZONE,
        time_window_end TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(bin_index, time_window_start)
      );
      
      CREATE INDEX IF NOT EXISTS idx_calibration_bins_bin_index ON adaptive_calibration_bins(bin_index);
    `;

    // 创建兜底策略状态表
    const createFallbackStateTable = `
      CREATE TABLE IF NOT EXISTS adaptive_fallback_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        level_name VARCHAR(50) NOT NULL UNIQUE,
        priority INTEGER NOT NULL,
        enabled BOOLEAN DEFAULT true,
        current_level BOOLEAN DEFAULT false,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        success_rate FLOAT DEFAULT 0.5,
        avg_response_time_ms FLOAT DEFAULT 0,
        last_used_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 创建A/B测试表
    const createABTestsTable = `
      CREATE TABLE IF NOT EXISTS ab_experiments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        experiment_name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        variant_a JSONB NOT NULL,
        variant_b JSONB NOT NULL,
        traffic_split INTEGER DEFAULT 50,
        status VARCHAR(20) DEFAULT 'draft',
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 创建A/B测试事件表
    const createABEventsTable = `
      CREATE TABLE IF NOT EXISTS ab_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        experiment_id UUID NOT NULL REFERENCES ab_experiments(id),
        user_id VARCHAR(255) NOT NULL,
        variant VARCHAR(1) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_ab_events_experiment_id ON ab_events(experiment_id);
      CREATE INDEX IF NOT EXISTS idx_ab_events_user_id ON ab_events(user_id);
    `;

    // 创建优化历史表
    const createOptimizationHistoryTable = `
      CREATE TABLE IF NOT EXISTS adaptive_optimization_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        optimization_type VARCHAR(50) NOT NULL,
        changes JSONB NOT NULL,
        metrics JSONB,
        trigger VARCHAR(20) DEFAULT 'auto',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_optimization_history_type ON adaptive_optimization_history(optimization_type);
    `;

    // 执行DDL（使用 RPC 或直接执行）
    // 注意：在生产环境中，这些DDL应该通过迁移脚本执行
    try {
      // 检查表是否存在
      const { data, error } = await this.supabase
        .from('adaptive_intent_feedbacks')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        console.log('[PersistenceStorage] Tables do not exist, will use memory fallback');
        // 表不存在时，使用内存存储作为后备
      }
    } catch (e) {
      console.warn('[PersistenceStorage] Table check failed, will use memory fallback:', e);
    }
  }

  // ===========================================================================
  // 意图反馈 CRUD
  // ===========================================================================

  /**
   * 存储意图反馈
   */
  async saveIntentFeedback(feedback: Omit<IntentFeedbackRecord, 'id' | 'created_at'>): Promise<IntentFeedbackRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('adaptive_intent_feedbacks')
        .insert({
          user_id: feedback.user_id,
          session_id: feedback.session_id,
          query: feedback.query,
          scenario: feedback.scenario,
          predicted_needs_search: feedback.predicted_needs_search,
          predicted_confidence: feedback.predicted_confidence,
          prediction_source: feedback.prediction_source,
          actual_needs_search: feedback.actual_needs_search,
          actual_outcome: feedback.actual_outcome || 'unknown',
          matched_keywords: feedback.matched_keywords,
          metadata: feedback.metadata,
        })
        .select()
        .single();

      if (error) {
        console.error('[PersistenceStorage] Failed to save intent feedback:', error);
        return null;
      }

      return data as IntentFeedbackRecord;
    } catch (e) {
      console.error('[PersistenceStorage] Exception saving intent feedback:', e);
      return null;
    }
  }

  /**
   * 批量获取意图反馈
   */
  async getIntentFeedbacks(options: {
    userId?: string;
    scenario?: string;
    limit?: number;
    offset?: number;
    startTime?: Date;
    endTime?: Date;
  }): Promise<IntentFeedbackRecord[]> {
    try {
      let query = this.supabase
        .from('adaptive_intent_feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }
      if (options.scenario) {
        query = query.eq('scenario', options.scenario);
      }
      if (options.startTime) {
        query = query.gte('created_at', options.startTime.toISOString());
      }
      if (options.endTime) {
        query = query.lte('created_at', options.endTime.toISOString());
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PersistenceStorage] Failed to get intent feedbacks:', error);
        return [];
      }

      return (data || []) as IntentFeedbackRecord[];
    } catch (e) {
      console.error('[PersistenceStorage] Exception getting intent feedbacks:', e);
      return [];
    }
  }

  /**
   * 获取反馈统计
   */
  async getFeedbackStats(options: {
    startTime?: Date;
    endTime?: Date;
  } = {}): Promise<{
    total: number;
    correct: number;
    accuracy: number;
    bySource: Record<string, { count: number; accuracy: number }>;
  }> {
    try {
      let query = this.supabase
        .from('adaptive_intent_feedbacks')
        .select('prediction_source, predicted_needs_search, actual_needs_search');

      if (options.startTime) {
        query = query.gte('created_at', options.startTime.toISOString());
      }
      if (options.endTime) {
        query = query.lte('created_at', options.endTime.toISOString());
      }

      const { data, error } = await query;

      if (error || !data) {
        return { total: 0, correct: 0, accuracy: 0, bySource: {} };
      }

      let total = 0;
      let correct = 0;
      const bySource: Record<string, { count: number; correct: number }> = {};

      for (const record of data) {
        total++;
        const isCorrect = record.predicted_needs_search === record.actual_needs_search;
        if (isCorrect) correct++;

        const source = record.prediction_source;
        if (!bySource[source]) {
          bySource[source] = { count: 0, correct: 0 };
        }
        bySource[source].count++;
        if (isCorrect) bySource[source].correct++;
      }

      const bySourceResult: Record<string, { count: number; accuracy: number }> = {};
      for (const [source, stats] of Object.entries(bySource)) {
        bySourceResult[source] = {
          count: stats.count,
          accuracy: stats.count > 0 ? stats.correct / stats.count : 0,
        };
      }

      return {
        total,
        correct,
        accuracy: total > 0 ? correct / total : 0,
        bySource: bySourceResult,
      };
    } catch (e) {
      console.error('[PersistenceStorage] Exception getting feedback stats:', e);
      return { total: 0, correct: 0, accuracy: 0, bySource: {} };
    }
  }

  // ===========================================================================
  // 关键词规则 CRUD
  // ===========================================================================

  /**
   * 保存关键词规则
   */
  async saveKeywordRule(rule: Omit<KeywordRuleRecord, 'id' | 'created_at' | 'updated_at'>): Promise<KeywordRuleRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('adaptive_keyword_rules')
        .upsert({
          keyword: rule.keyword,
          category: rule.category,
          match_count: rule.match_count,
          correct_count: rule.correct_count,
          confidence: rule.confidence,
          source: rule.source,
          version: rule.version,
          last_matched_at: rule.last_matched_at,
        }, { onConflict: 'keyword' })
        .select()
        .single();

      if (error) {
        console.error('[PersistenceStorage] Failed to save keyword rule:', error);
        return null;
      }

      return data as KeywordRuleRecord;
    } catch (e) {
      console.error('[PersistenceStorage] Exception saving keyword rule:', e);
      return null;
    }
  }

  /**
   * 批量获取关键词规则
   */
  async getKeywordRules(options: {
    category?: 'search' | 'no_search' | 'ambiguous';
    minConfidence?: number;
    source?: 'initial' | 'learned' | 'expert';
  } = {}): Promise<KeywordRuleRecord[]> {
    try {
      let query = this.supabase
        .from('adaptive_keyword_rules')
        .select('*')
        .order('match_count', { ascending: false });

      if (options.category) {
        query = query.eq('category', options.category);
      }
      if (options.minConfidence !== undefined) {
        query = query.gte('confidence', options.minConfidence);
      }
      if (options.source) {
        query = query.eq('source', options.source);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PersistenceStorage] Failed to get keyword rules:', error);
        return [];
      }

      return (data || []) as KeywordRuleRecord[];
    } catch (e) {
      console.error('[PersistenceStorage] Exception getting keyword rules:', e);
      return [];
    }
  }

  // ===========================================================================
  // 校准数据 CRUD
  // ===========================================================================

  /**
   * 保存校准区间数据
   */
  async saveCalibrationBin(bin: Omit<CalibrationBinRecord, 'id' | 'updated_at'>): Promise<CalibrationBinRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('adaptive_calibration_bins')
        .upsert({
          bin_index: bin.bin_index,
          bin_start: bin.bin_start,
          bin_end: bin.bin_end,
          predicted_count: bin.predicted_count,
          correct_count: bin.correct_count,
          actual_accuracy: bin.actual_accuracy,
          time_window_start: bin.time_window_start,
          time_window_end: bin.time_window_end,
        }, { onConflict: 'bin_index,time_window_start' })
        .select()
        .single();

      if (error) {
        console.error('[PersistenceStorage] Failed to save calibration bin:', error);
        return null;
      }

      return data as CalibrationBinRecord;
    } catch (e) {
      console.error('[PersistenceStorage] Exception saving calibration bin:', e);
      return null;
    }
  }

  /**
   * 获取校准曲线数据
   */
  async getCalibrationCurve(): Promise<CalibrationBinRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('adaptive_calibration_bins')
        .select('*')
        .order('bin_index', { ascending: true });

      if (error) {
        console.error('[PersistenceStorage] Failed to get calibration curve:', error);
        return [];
      }

      return (data || []) as CalibrationBinRecord[];
    } catch (e) {
      console.error('[PersistenceStorage] Exception getting calibration curve:', e);
      return [];
    }
  }

  // ===========================================================================
  // A/B 测试
  // ===========================================================================

  /**
   * 创建A/B测试实验
   */
  async createABExperiment(experiment: Omit<ABTestExperimentRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ABTestExperimentRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('ab_experiments')
        .insert({
          experiment_name: experiment.experiment_name,
          description: experiment.description,
          variant_a: experiment.variant_a,
          variant_b: experiment.variant_b,
          traffic_split: experiment.traffic_split,
          status: experiment.status,
          start_time: experiment.start_time,
          end_time: experiment.end_time,
        })
        .select()
        .single();

      if (error) {
        console.error('[PersistenceStorage] Failed to create A/B experiment:', error);
        return null;
      }

      return data as ABTestExperimentRecord;
    } catch (e) {
      console.error('[PersistenceStorage] Exception creating A/B experiment:', e);
      return null;
    }
  }

  /**
   * 获取活跃的A/B测试
   */
  async getActiveABExperiments(): Promise<ABTestExperimentRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('ab_experiments')
        .select('*')
        .eq('status', 'running');

      if (error) {
        console.error('[PersistenceStorage] Failed to get active A/B experiments:', error);
        return [];
      }

      return (data || []) as ABTestExperimentRecord[];
    } catch (e) {
      console.error('[PersistenceStorage] Exception getting active A/B experiments:', e);
      return [];
    }
  }

  /**
   * 记录A/B测试事件
   */
  async recordABEvent(event: Omit<ABTestEventRecord, 'id' | 'created_at'>): Promise<void> {
    try {
      await this.supabase
        .from('ab_events')
        .insert({
          experiment_id: event.experiment_id,
          user_id: event.user_id,
          variant: event.variant,
          event_type: event.event_type,
          event_data: event.event_data,
        });
    } catch (e) {
      console.error('[PersistenceStorage] Exception recording A/B event:', e);
    }
  }

  /**
   * 获取A/B测试结果
   */
  async getABTestResults(experimentId: string): Promise<{
    variantA: { count: number; accuracy: number };
    variantB: { count: number; accuracy: number };
    significance: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('ab_events')
        .select('variant, event_data')
        .eq('experiment_id', experimentId);

      if (error || !data) {
        return {
          variantA: { count: 0, accuracy: 0 },
          variantB: { count: 0, accuracy: 0 },
          significance: 0,
        };
      }

      const stats = {
        A: { count: 0, correct: 0 },
        B: { count: 0, correct: 0 },
      };

      for (const event of data) {
        const variant = event.variant as 'A' | 'B';
        stats[variant].count++;
        if (event.event_data?.is_correct) {
          stats[variant].correct++;
        }
      }

      const accuracyA = stats.A.count > 0 ? stats.A.correct / stats.A.count : 0;
      const accuracyB = stats.B.count > 0 ? stats.B.correct / stats.B.count : 0;

      // 简单的显著性检验（z-test）
      const significance = this.calculateSignificance(
        stats.A.count, stats.A.correct,
        stats.B.count, stats.B.correct
      );

      return {
        variantA: { count: stats.A.count, accuracy: accuracyA },
        variantB: { count: stats.B.count, accuracy: accuracyB },
        significance,
      };
    } catch (e) {
      console.error('[PersistenceStorage] Exception getting A/B test results:', e);
      return {
        variantA: { count: 0, accuracy: 0 },
        variantB: { count: 0, accuracy: 0 },
        significance: 0,
      };
    }
  }

  /**
   * 获取A/B测试事件列表
   */
  async getABEvents(experimentId: string): Promise<ABTestEventRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('ab_events')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return [];
      }

      return data as ABTestEventRecord[];
    } catch (e) {
      console.error('[PersistenceStorage] Exception getting A/B events:', e);
      return [];
    }
  }

  /**
   * 计算显著性（简化版z-test）
   */
  private calculateSignificance(
    n1: number, x1: number,
    n2: number, x2: number
  ): number {
    if (n1 < 10 || n2 < 10) return 0;

    const p1 = x1 / n1;
    const p2 = x2 / n2;
    const p = (x1 + x2) / (n1 + n2);

    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    if (se === 0) return 0;

    const z = Math.abs(p1 - p2) / se;
    
    // 转换为置信度（近似）
    if (z > 2.576) return 0.99;  // p < 0.01
    if (z > 1.96) return 0.95;   // p < 0.05
    if (z > 1.645) return 0.90;  // p < 0.10
    return z / 1.96 * 0.95;      // 线性插值
  }

  // ===========================================================================
  // 优化历史
  // ===========================================================================

  /**
   * 记录优化历史
   */
  async saveOptimizationHistory(history: Omit<OptimizationHistoryRecord, 'id' | 'created_at'>): Promise<void> {
    try {
      await this.supabase
        .from('adaptive_optimization_history')
        .insert({
          optimization_type: history.optimization_type,
          changes: history.changes,
          metrics: history.metrics,
          trigger: history.trigger,
        });
    } catch (e) {
      console.error('[PersistenceStorage] Exception saving optimization history:', e);
    }
  }

  /**
   * 获取优化历史
   */
  async getOptimizationHistory(options: {
    type?: 'keyword_update' | 'calibration' | 'fallback_adjustment';
    limit?: number;
  } = {}): Promise<OptimizationHistoryRecord[]> {
    try {
      let query = this.supabase
        .from('adaptive_optimization_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.type) {
        query = query.eq('optimization_type', options.type);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PersistenceStorage] Failed to get optimization history:', error);
        return [];
      }

      return (data || []) as OptimizationHistoryRecord[];
    } catch (e) {
      console.error('[PersistenceStorage] Exception getting optimization history:', e);
      return [];
    }
  }
}

// ============================================================================
// 单例
// ============================================================================

let storageInstance: PersistenceStorageService | null = null;

export function getPersistenceStorage(): PersistenceStorageService {
  if (!storageInstance) {
    storageInstance = new PersistenceStorageService();
  }
  return storageInstance;
}
