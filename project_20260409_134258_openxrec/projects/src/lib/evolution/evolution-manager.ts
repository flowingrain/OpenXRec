/**
 * 复盘进化增强系统
 * 集成Supabase持久化存储、嵌入模型检索、A/B测试框架
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { EmbeddingClient } from 'coze-coding-dev-sdk';

// 类型定义
interface AnalysisCase {
  id: string;
  query: string;
  domain: string;
  final_report?: string;
  conclusion?: unknown;
  confidence?: string;
  quality_score?: string;
  user_rating?: number;
  feedback_count?: number;
  tags?: unknown;
  status?: string;
  analyzed_at: string;
  created_at: string;
  updated_at?: string;
}

interface UserFeedback {
  id: string;
  case_id: string;
  feedback_type: string;
  rating?: number;
  comment?: string;
  correction?: string;
  aspects?: unknown;
  user_context?: unknown;
  created_at: string;
}

interface Optimization {
  id: string;
  case_id?: string;
  optimization_type: string;
  description: string;
  before_state?: unknown;
  after_state?: unknown;
  improvement_score?: string;
  validation_status?: string;
  validation_results?: unknown;
  is_applied?: boolean;
  applied_at?: string;
  created_at: string;
}

interface ABExperiment {
  id: string;
  name: string;
  description?: string;
  experiment_type: string;
  control_config: unknown;
  treatment_config: unknown;
  traffic_split?: unknown;
  target_criteria?: unknown;
  status?: string;
  started_at?: string;
  ended_at?: string;
  results?: unknown;
  statistical_significance?: string;
  sample_size?: number;
  confidence_level?: string;
  created_at: string;
  updated_at?: string;
}

interface ExperimentRun {
  id: string;
  experiment_id: string;
  case_id?: string;
  variant: string;
  input_data?: unknown;
  output_data?: unknown;
  metrics?: unknown;
  duration_ms?: number;
  created_at: string;
}

interface CaseEmbedding {
  id: string;
  case_id: string;
  embedding_type: string;
  embedding: unknown;
  model: string;
  text_preview?: string;
  created_at: string;
}

interface KnowledgePattern {
  id: string;
  pattern_type: string;
  name: string;
  description?: string;
  pattern_data: unknown;
  occurrence_count?: number;
  success_rate?: string;
  source_case_ids?: unknown;
  is_verified?: boolean;
  confidence?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// 类型定义
// ============================================================================

export interface CaseSearchParams {
  query?: string;
  domain?: string;
  status?: string;
  minQuality?: number;
  tags?: string[];
  dateRange?: { start: string; end: string };
  limit?: number;
  offset?: number;
}

export interface SimilarCaseResult {
  case: AnalysisCase;
  similarity: number;
}

export interface ABTestConfig {
  name: string;
  description?: string;
  experimentType: string;
  controlConfig: Record<string, any>;
  treatmentConfig: Record<string, any>;
  trafficSplit?: { control: number; treatment: number };
  targetCriteria?: Record<string, any>;
}

export interface ABTestResult {
  experimentId: string;
  winner: 'control' | 'treatment' | 'inconclusive';
  controlMetrics: Record<string, number>;
  treatmentMetrics: Record<string, number>;
  statisticalSignificance: number;
  recommendation: string;
}

// ============================================================================
// 复盘进化管理类
// ============================================================================

/**
 * 复盘进化管理器
 */
export class EvolutionManager {
  private supabase = getSupabaseClient();
  private embeddingClient: EmbeddingClient;
  
  constructor(customHeaders?: Record<string, string>) {
    this.embeddingClient = new EmbeddingClient();
  }
  
  // ===========================================================================
  // 案例管理
  // ===========================================================================
  
  /**
   * 保存分析案例
   */
  async saveCase(caseData: Omit<AnalysisCase, 'id' | 'created_at' | 'analyzed_at'>): Promise<AnalysisCase> {
    if (!this.supabase) throw new Error('Database not available');
    const { data, error } = await this.supabase
      .from('analysis_cases')
      .insert(caseData)
      .select()
      .maybeSingle();
    
    if (error) throw new Error(`保存案例失败: ${error.message}`);
    if (!data) throw new Error('保存案例失败: 无返回数据');
    
    // 自动生成嵌入向量
    await this.generateCaseEmbeddings(data.id, caseData.query, caseData.final_report);
    
    return data as AnalysisCase;
  }
  
  /**
   * 获取案例
   */
  async getCase(caseId: string): Promise<AnalysisCase | null> {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('analysis_cases')
      .select('*')
      .eq('id', caseId)
      .maybeSingle();
    
    if (error) throw new Error(`获取案例失败: ${error.message}`);
    return data as AnalysisCase | null;
  }
  
  /**
   * 搜索案例
   */
  async searchCases(params: CaseSearchParams): Promise<AnalysisCase[]> {
    if (!this.supabase) return [];
    let query = this.supabase
      .from('analysis_cases')
      .select('*')
      .order('analyzed_at', { ascending: false });
    
    if (params.domain) {
      query = query.eq('domain', params.domain);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.minQuality !== undefined) {
      query = query.gte('quality_score', params.minQuality);
    }
    if (params.tags && params.tags.length > 0) {
      query = query.contains('tags', params.tags);
    }
    if (params.dateRange) {
      query = query
        .gte('analyzed_at', params.dateRange.start)
        .lte('analyzed_at', params.dateRange.end);
    }
    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) throw new Error(`搜索案例失败: ${error.message}`);
    
    // 文本搜索（如果提供了查询）
    let results = (data || []) as AnalysisCase[];
    if (params.query) {
      const queryLower = params.query.toLowerCase();
      results = results.filter(c => 
        c.query?.toLowerCase().includes(queryLower) ||
        c.final_report?.toLowerCase().includes(queryLower)
      );
    }
    
    return results;
  }
  
  /**
   * 更新案例质量评分
   */
  async updateCaseQuality(caseId: string, qualityScore: number): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('analysis_cases')
      .update({ quality_score: qualityScore, updated_at: new Date().toISOString() })
      .eq('id', caseId);
    
    if (error) throw new Error(`更新质量评分失败: ${error.message}`);
  }
  
  // ===========================================================================
  // 嵌入向量检索
  // ===========================================================================
  
  /**
   * 生成案例嵌入向量
   */
  private async generateCaseEmbeddings(
    caseId: string, 
    query: string, 
    report?: string | null
  ): Promise<void> {
    try {
      // 生成查询嵌入
      const queryEmbedding = await this.embeddingClient.embedText(query, { dimensions: 1024 });
      await this.saveEmbedding(caseId, 'query', queryEmbedding, query.substring(0, 200));
      
      // 生成结论嵌入
      if (report) {
        const reportEmbedding = await this.embeddingClient.embedText(report, { dimensions: 1024 });
        await this.saveEmbedding(caseId, 'conclusion', reportEmbedding, report.substring(0, 200));
      }
    } catch (error) {
      console.error('[EvolutionManager] 生成嵌入失败:', error);
      // 不抛出错误，避免影响主流程
    }
  }
  
  /**
   * 保存嵌入向量
   */
  private async saveEmbedding(
    caseId: string,
    type: string,
    embedding: number[],
    preview: string
  ): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('case_embeddings')
      .insert({
        case_id: caseId,
        embedding_type: type,
        embedding: { vector: embedding, dimensions: embedding.length },
        model: 'doubao-embedding-vision-251215',
        text_preview: preview
      });
    
    if (error) {
      console.error('[EvolutionManager] 保存嵌入失败:', error);
    }
  }
  
  /**
   * 语义相似案例检索
   */
  async findSimilarCases(
    queryText: string, 
    topK: number = 5,
    minSimilarity: number = 0.7
  ): Promise<SimilarCaseResult[]> {
    // 生成查询向量
    const queryEmbedding = await this.embeddingClient.embedText(queryText, { dimensions: 1024 });
    
    if (!this.supabase) return [];
    
    // 获取所有嵌入向量
    const { data: embeddings, error } = await this.supabase
      .from('case_embeddings')
      .select('*, analysis_cases(*)')
      .eq('embedding_type', 'query');
    
    if (error) throw new Error(`检索嵌入失败: ${error.message}`);
    if (!embeddings || embeddings.length === 0) return [];
    
    // 计算相似度
    const results: SimilarCaseResult[] = [];
    for (const emb of embeddings) {
      const storedVector = emb.embedding?.vector;
      if (!storedVector) continue;
      
      const similarity = this.cosineSimilarity(queryEmbedding, storedVector);
      if (similarity >= minSimilarity) {
        results.push({
          case: emb.analysis_cases as AnalysisCase,
          similarity
        });
      }
    }
    
    // 排序并返回topK
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }
  
  /**
   * 余弦相似度计算
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
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  // ===========================================================================
  // 用户反馈
  // ===========================================================================
  
  /**
   * 提交用户反馈
   */
  async submitFeedback(
    caseId: string,
    feedbackType: UserFeedback['feedback_type'],
    options?: {
      rating?: number;
      comment?: string;
      correction?: string;
      aspects?: Record<string, boolean>;
    }
  ): Promise<UserFeedback> {
    if (!this.supabase) throw new Error('Database not available');
    const { data, error } = await this.supabase
      .from('user_feedbacks')
      .insert({
        case_id: caseId,
        feedback_type: feedbackType,
        rating: options?.rating,
        comment: options?.comment,
        correction: options?.correction,
        aspects: options?.aspects
      })
      .select()
      .maybeSingle();
    
    if (error) throw new Error(`提交反馈失败: ${error.message}`);
    if (!data) throw new Error('提交反馈失败: 无返回数据');
    
    // 更新案例的反馈计数和评分
    await this.updateCaseFeedbackStats(caseId);
    
    // 如果有修正建议，创建优化记录
    if (options?.correction) {
      await this.createOptimization(
        caseId,
        'knowledge_update',
        '用户修正建议',
        { afterState: { userCorrection: options.correction } }
      );
    }
    
    return data as UserFeedback;
  }
  
  /**
   * 更新案例反馈统计
   */
  private async updateCaseFeedbackStats(caseId: string): Promise<void> {
    if (!this.supabase) return;
    // 获取该案例的所有反馈
    const { data: feedbacks, error } = await this.supabase
      .from('user_feedbacks')
      .select('rating')
      .eq('case_id', caseId);
    
    if (error || !feedbacks) return;
    
    const count = feedbacks.length;
    const avgRating = feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / count;
    
    // 更新案例
    await this.supabase
      .from('analysis_cases')
      .update({
        feedback_count: count,
        user_rating: avgRating,
        updated_at: new Date().toISOString()
      })
      .eq('id', caseId);
  }
  
  // ===========================================================================
  // 优化记录
  // ===========================================================================
  
  /**
   * 创建优化记录
   */
  async createOptimization(
    caseId: string | null,
    type: Optimization['optimization_type'],
    description: string,
    options?: {
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
    }
  ): Promise<Optimization> {
    if (!this.supabase) throw new Error('Database not available');
    const { data, error } = await this.supabase
      .from('optimizations')
      .insert({
        case_id: caseId,
        optimization_type: type,
        description,
        before_state: options?.beforeState,
        after_state: options?.afterState
      })
      .select()
      .maybeSingle();
    
    if (error) throw new Error(`创建优化记录失败: ${error.message}`);
    if (!data) throw new Error('创建优化记录失败: 无返回数据');
    
    return data as Optimization;
  }
  
  /**
   * 获取待验证的优化
   */
  async getPendingOptimizations(): Promise<Optimization[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('optimizations')
      .select('*')
      .eq('validation_status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(`获取待验证优化失败: ${error.message}`);
    return (data || []) as Optimization[];
  }
  
  /**
   * 应用优化
   */
  async applyOptimization(optimizationId: string): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('optimizations')
      .update({
        is_applied: true,
        applied_at: new Date().toISOString(),
        validation_status: 'approved'
      })
      .eq('id', optimizationId);
    
    if (error) throw new Error(`应用优化失败: ${error.message}`);
  }
  
  // ===========================================================================
  // A/B测试框架
  // ===========================================================================
  
  /**
   * 创建A/B测试实验
   */
  async createExperiment(config: ABTestConfig): Promise<ABExperiment> {
    if (!this.supabase) throw new Error('Database not available');
    const { data, error } = await this.supabase
      .from('ab_experiments')
      .insert({
        name: config.name,
        description: config.description,
        experiment_type: config.experimentType,
        control_config: config.controlConfig,
        treatment_config: config.treatmentConfig,
        traffic_split: config.trafficSplit || { control: 50, treatment: 50 },
        target_criteria: config.targetCriteria
      })
      .select()
      .maybeSingle();
    
    if (error) throw new Error(`创建实验失败: ${error.message}`);
    if (!data) throw new Error('创建实验失败: 无返回数据');
    
    return data as ABExperiment;
  }
  
  /**
   * 启动实验
   */
  async startExperiment(experimentId: string): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('ab_experiments')
      .update({
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', experimentId);
    
    if (error) throw new Error(`启动实验失败: ${error.message}`);
  }
  
  /**
   * 停止实验
   */
  async stopExperiment(experimentId: string): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('ab_experiments')
      .update({
        status: 'stopped',
        ended_at: new Date().toISOString()
      })
      .eq('id', experimentId);
    
    if (error) throw new Error(`停止实验失败: ${error.message}`);
  }
  
  /**
   * 分配实验变体
   */
  async assignVariant(experimentId: string, caseId?: string): Promise<'control' | 'treatment'> {
    if (!this.supabase) return 'control';
    // 获取实验配置
    const { data: experiment, error } = await this.supabase
      .from('ab_experiments')
      .select('*')
      .eq('id', experimentId)
      .eq('status', 'running')
      .maybeSingle();
    
    if (error || !experiment) {
      // 实验不存在或未运行，返回对照组
      return 'control';
    }
    
    // 根据流量分配决定变体
    const split = experiment.traffic_split as { control: number; treatment: number };
    const random = Math.random() * 100;
    
    return random < split.control ? 'control' : 'treatment';
  }
  
  /**
   * 记录实验运行
   */
  async recordExperimentRun(
    experimentId: string,
    variant: 'control' | 'treatment',
    options?: {
      caseId?: string;
      inputData?: Record<string, any>;
      outputData?: Record<string, any>;
      metrics?: Record<string, number>;
      durationMs?: number;
    }
  ): Promise<ExperimentRun> {
    if (!this.supabase) throw new Error('Database not available');
    const { data, error } = await this.supabase
      .from('experiment_runs')
      .insert({
        experiment_id: experimentId,
        case_id: options?.caseId,
        variant,
        input_data: options?.inputData,
        output_data: options?.outputData,
        metrics: options?.metrics,
        duration_ms: options?.durationMs
      })
      .select()
      .maybeSingle();
    
    if (error) throw new Error(`记录实验运行失败: ${error.message}`);
    if (!data) throw new Error('记录实验运行失败: 无返回数据');
    
    // 更新实验样本量
    await this.supabase.rpc('increment_sample_size', { exp_id: experimentId });
    
    return data as ExperimentRun;
  }
  
  /**
   * 分析实验结果
   */
  async analyzeExperiment(experimentId: string): Promise<ABTestResult> {
    if (!this.supabase) {
      return {
        experimentId,
        winner: 'inconclusive',
        controlMetrics: {},
        treatmentMetrics: {},
        statisticalSignificance: 0,
        recommendation: 'Database not available'
      };
    }
    // 获取所有运行记录
    const { data: runs, error } = await this.supabase
      .from('experiment_runs')
      .select('*')
      .eq('experiment_id', experimentId);
    
    if (error) throw new Error(`获取实验数据失败: ${error.message}`);
    if (!runs || runs.length === 0) {
      return {
        experimentId,
        winner: 'inconclusive',
        controlMetrics: {},
        treatmentMetrics: {},
        statisticalSignificance: 0,
        recommendation: '实验暂无数据'
      };
    }
    
    // 分组统计
    const controlRuns = runs.filter(r => r.variant === 'control');
    const treatmentRuns = runs.filter(r => r.variant === 'treatment');
    
    const controlMetrics = this.aggregateMetrics(controlRuns);
    const treatmentMetrics = this.aggregateMetrics(treatmentRuns);
    
    // 计算统计显著性（简化版t检验）
    const significance = this.calculateSignificance(controlRuns, treatmentRuns);
    
    // 决定胜者
    let winner: 'control' | 'treatment' | 'inconclusive' = 'inconclusive';
    if (significance >= 0.95) {
      const controlQuality = controlMetrics.quality_score || 0;
      const treatmentQuality = treatmentMetrics.quality_score || 0;
      
      if (treatmentQuality > controlQuality * 1.1) {
        winner = 'treatment';
      } else if (controlQuality > treatmentQuality * 1.1) {
        winner = 'control';
      }
    }
    
    // 生成推荐
    const recommendation = this.generateRecommendation(winner, controlMetrics, treatmentMetrics, significance);
    
    // 更新实验结果
    await this.supabase
      .from('ab_experiments')
      .update({
        results: { control: controlMetrics, treatment: treatmentMetrics, winner },
        statistical_significance: significance,
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', experimentId);
    
    return {
      experimentId,
      winner,
      controlMetrics,
      treatmentMetrics,
      statisticalSignificance: significance,
      recommendation
    };
  }
  
  /**
   * 聚合指标
   */
  private aggregateMetrics(runs: any[]): Record<string, number> {
    if (runs.length === 0) return {};
    
    const metrics: Record<string, number[]> = {};
    
    for (const run of runs) {
      const runMetrics = run.metrics || {};
      for (const [key, value] of Object.entries(runMetrics)) {
        if (!metrics[key]) metrics[key] = [];
        metrics[key].push(value as number);
      }
    }
    
    const result: Record<string, number> = {};
    for (const [key, values] of Object.entries(metrics)) {
      result[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }
    
    return result;
  }
  
  /**
   * 计算统计显著性（简化版）
   */
  private calculateSignificance(controlRuns: any[], treatmentRuns: any[]): number {
    if (controlRuns.length < 10 || treatmentRuns.length < 10) {
      return 0;
    }
    
    // 简化的统计显著性计算
    const controlScores = controlRuns.map(r => r.metrics?.quality_score || 0.5);
    const treatmentScores = treatmentRuns.map(r => r.metrics?.quality_score || 0.5);
    
    const controlMean = controlScores.reduce((a, b) => a + b, 0) / controlScores.length;
    const treatmentMean = treatmentScores.reduce((a, b) => a + b, 0) / treatmentScores.length;
    
    const controlVar = this.variance(controlScores, controlMean);
    const treatmentVar = this.variance(treatmentScores, treatmentMean);
    
    // 简化的z-score
    const pooledSE = Math.sqrt(controlVar / controlScores.length + treatmentVar / treatmentScores.length);
    if (pooledSE === 0) return 0;
    
    const zScore = Math.abs(treatmentMean - controlMean) / pooledSE;
    
    // 转换为置信度（近似）
    return Math.min(0.99, Math.max(0, 1 - Math.exp(-zScore * zScore / 2)));
  }
  
  private variance(values: number[], mean: number): number {
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }
  
  /**
   * 生成推荐
   */
  private generateRecommendation(
    winner: string,
    control: Record<string, number>,
    treatment: Record<string, number>,
    significance: number
  ): string {
    if (winner === 'inconclusive') {
      return '实验结果不显著，建议继续收集数据或调整实验设计';
    }
    
    const winnerMetrics = winner === 'treatment' ? treatment : control;
    const improvement = winner === 'treatment' 
      ? ((treatment.quality_score || 0) - (control.quality_score || 0)) / (control.quality_score || 1) * 100
      : ((control.quality_score || 0) - (treatment.quality_score || 0)) / (treatment.quality_score || 1) * 100;
    
    return `建议采用${winner === 'treatment' ? '实验组' : '对照组'}配置，质量提升 ${improvement.toFixed(1)}%，置信度 ${(significance * 100).toFixed(1)}%`;
  }
  
  // ===========================================================================
  // 知识模式提取
  // ===========================================================================
  
  /**
   * 提取知识模式
   */
  async extractKnowledgePatterns(): Promise<KnowledgePattern[]> {
    if (!this.supabase) return [];
    // 获取高质量案例
    const { data: cases, error } = await this.supabase
      .from('analysis_cases')
      .select('*')
      .gte('quality_score', 0.7)
      .order('quality_score', { ascending: false })
      .limit(100);
    
    if (error) throw new Error(`获取案例失败: ${error.message}`);
    if (!cases || cases.length < 5) return [];
    
    const patterns: KnowledgePattern[] = [];
    
    // 提取因果模式
    const causalPatterns = this.extractCausalPatterns(cases);
    for (const pattern of causalPatterns) {
      const saved = await this.savePattern('causal_pattern', pattern);
      patterns.push(saved);
    }
    
    // 提取风险模式
    const riskPatterns = this.extractRiskPatterns(cases);
    for (const pattern of riskPatterns) {
      const saved = await this.savePattern('risk_pattern', pattern);
      patterns.push(saved);
    }
    
    return patterns;
  }
  
  private extractCausalPatterns(cases: any[]): any[] {
    // 简化的因果模式提取
    const patterns: any[] = [];
    const causalChains = cases.flatMap(c => c.causal_chains || []);
    
    // 统计因果链频率
    const chainCounts = new Map<string, number>();
    for (const chain of causalChains) {
      const key = `${chain.cause}->${chain.effect}`;
      chainCounts.set(key, (chainCounts.get(key) || 0) + 1);
    }
    
    // 转换为模式
    for (const [key, count] of chainCounts.entries()) {
      if (count >= 3) {
        const [cause, effect] = key.split('->');
        patterns.push({
          name: key,
          description: `因果模式: ${cause} 导致 ${effect}`,
          pattern_data: { cause, effect, frequency: count },
          occurrence_count: count
        });
      }
    }
    
    return patterns;
  }
  
  private extractRiskPatterns(cases: any[]): any[] {
    // 简化的风险模式提取
    const patterns: any[] = [];
    const keyFactors = cases.flatMap(c => c.key_factors || []);
    
    // 统计风险因素频率
    const factorCounts = new Map<string, number>();
    for (const factor of keyFactors) {
      const name = factor.name || factor.factor;
      if (name) {
        factorCounts.set(name, (factorCounts.get(name) || 0) + 1);
      }
    }
    
    // 转换为模式
    for (const [name, count] of factorCounts.entries()) {
      if (count >= 3) {
        patterns.push({
          name,
          description: `关键风险因素: ${name}`,
          pattern_data: { factor: name, frequency: count },
          occurrence_count: count
        });
      }
    }
    
    return patterns;
  }
  
  private async savePattern(type: string, pattern: any): Promise<KnowledgePattern> {
    if (!this.supabase) throw new Error('Database not available');
    const { data, error } = await this.supabase
      .from('knowledge_patterns')
      .insert({
        pattern_type: type,
        name: pattern.name,
        description: pattern.description,
        pattern_data: pattern.pattern_data,
        occurrence_count: pattern.occurrence_count
      })
      .select()
      .maybeSingle();
    
    if (error) throw new Error(`保存模式失败: ${error.message}`);
    if (!data) throw new Error('保存模式失败: 无返回数据');
    
    return data as KnowledgePattern;
  }
  
  /**
   * 获取相关知识模式
   */
  async getRelevantPatterns(queryText: string, topK: number = 5): Promise<KnowledgePattern[]> {
    // 语义检索相关模式
    const queryEmbedding = await this.embeddingClient.embedText(queryText, { dimensions: 1024 });
    
    if (!this.supabase) return [];
    const { data: patterns, error } = await this.supabase
      .from('knowledge_patterns')
      .select('*')
      .eq('is_verified', true)
      .order('occurrence_count', { ascending: false })
      .limit(50);
    
    if (error) throw new Error(`获取模式失败: ${error.message}`);
    if (!patterns) return [];
    
    // 计算相似度并排序
    const results = patterns.map(pattern => {
      const patternText = `${pattern.name} ${pattern.description}`;
      // 简化：使用文本匹配而非向量匹配
      const matchScore = this.textMatchScore(queryText, patternText);
      return { pattern, score: matchScore };
    });
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map(r => r.pattern as KnowledgePattern);
  }
  
  private textMatchScore(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    return intersection.size / Math.sqrt(words1.size * words2.size);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建复盘进化管理器
 */
export function createEvolutionManager(customHeaders?: Record<string, string>): EvolutionManager {
  return new EvolutionManager(customHeaders);
}

/**
 * 从Next.js请求创建管理器
 */
export function createEvolutionManagerFromRequest(request: { headers: Record<string, string> | Headers }): EvolutionManager {
  // 简化处理，不再提取转发头
  return new EvolutionManager();
}
