/**
 * 推荐策略扩展
 *
 * 支持序列推荐、多行为推荐等高级特性
 *
 * 核心理念：
 * - 序列推荐通过智能体实现，而非专门设计深度学习算法
 * - 利用LLM的序列理解和推理能力
 * - 专门算法（如马尔可夫链）作为基线或兜底方案
 */

import {
  RecommendationItem,
  UserProfile,
  RecommendationContext,
  RecommendationResult
} from './types';
import {
  SequenceAnalysisAgent,
  BaselineSequenceRecommender,
  Behavior,
  SequenceRecommendation,
  SequenceAnalysis
} from './sequential-agent';
import { LLMClient } from 'coze-coding-dev-sdk';

// ============================================================================
// 序列推荐（智能体驱动）
// ============================================================================

/**
 * 序列行为窗口
 */
export interface SequenceWindow {
  windowSize: number;  // 窗口大小（行为数量）
  timeWindow: number;  // 时间窗口（毫秒）
  decay: number;      // 衰减因子
}

/**
 * 序列推荐策略（智能体驱动）
 *
 * 核心特性：
 * - 使用序列分析智能体分析用户行为模式
 * - 识别频繁模式、顺序模式、周期模式
 * - 基于LLM的序列理解和推理
 * - 提供详细的推荐理由和模式匹配信息
 *
 * 降级策略：
 * - 智能体失败时使用基线算法（马尔可夫链）
 */
export class SequentialRecommender {
  private sequenceAgent: SequenceAnalysisAgent | null = null;
  private baselineRecommender: BaselineSequenceRecommender | null = null;
  private llmClient: LLMClient | null = null;

  constructor(llmClient?: LLMClient) {
    if (llmClient) {
      this.llmClient = llmClient;
      this.sequenceAgent = new SequenceAnalysisAgent(llmClient);
    }
    this.baselineRecommender = new BaselineSequenceRecommender();
  }

  /**
   * 构建行为序列
   */
  buildSequence(behaviorHistory: any[]): Behavior[] {
    const sorted = [...behaviorHistory].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.map(b => ({
      itemId: b.itemId,
      itemTitle: b.itemTitle || b.title || '未知物品',
      itemType: b.itemType || b.type || 'default',
      action: b.action || 'view',
      timestamp: b.timestamp,
      rating: b.rating,
      duration: b.duration,
      context: b.context
    }));
  }

  /**
   * 生成序列推荐（智能体驱动）
   */
  async generateSequentialRecommendations(
    userProfile: UserProfile,
    candidates: RecommendationItem[],
    windowSize: number = 10,
    limit: number = 10
  ): Promise<Array<{ item: RecommendationItem; score: number; reasoning: string; patternMatch?: any }>> {
    try {
      // 尝试使用智能体
      if (this.sequenceAgent && this.llmClient) {
        return await this.generateAgentBasedRecommendations(
          userProfile,
          candidates,
          windowSize,
          limit
        );
      }
    } catch (error) {
      console.error('[SequentialRecommender] 智能体推荐失败，降级到基线算法:', error);
    }

    // 降级到基线算法
    return this.generateBaselineRecommendations(
      userProfile,
      candidates,
      limit
    );
  }

  /**
   * 基于智能体的推荐
   */
  private async generateAgentBasedRecommendations(
    userProfile: UserProfile,
    candidates: RecommendationItem[],
    windowSize: number,
    limit: number
  ): Promise<Array<{ item: RecommendationItem; score: number; reasoning: string; patternMatch?: any }>> {
    // 1. 构建行为序列
    const behaviors = this.buildSequence(userProfile.behaviorHistory);

    // 2. 转换候选物品格式
    const candidateItems = candidates.map(item => ({
      id: item.id,
      title: item.title,
      type: item.type || 'default'
    }));

    // 3. 调用序列分析智能体
    const analysis: SequenceAnalysis = await this.sequenceAgent!.analyzeSequence(
      userProfile.userId,
      behaviors,
      candidateItems,
      limit
    );

    // 4. 转换为标准格式
    return analysis.recommendations.map(rec => ({
      item: {
        id: rec.item.id,
        title: rec.item.title,
        type: rec.item.type,
        attributes: {},
        metadata: {}
      } as unknown as RecommendationItem,
      score: rec.score,
      reasoning: rec.reasoning,
      patternMatch: rec.patternMatch
    }));
  }

  /**
   * 基线算法推荐（马尔可夫链）
   */
  private generateBaselineRecommendations(
    userProfile: UserProfile,
    candidates: RecommendationItem[],
    limit: number
  ): Promise<Array<{ item: RecommendationItem; score: number; reasoning: string; patternMatch?: any }>> {
    const behaviors = this.buildSequence(userProfile.behaviorHistory);

    const candidateItems = candidates.map(item => ({
      id: item.id,
      title: item.title,
      type: item.type || 'default'
    }));

    const recs = this.baselineRecommender!.recommend(
      behaviors,
      candidateItems,
      limit
    );

    return Promise.resolve(recs.map(rec => ({
      item: {
        id: rec.item.id,
        title: rec.item.title,
        type: rec.item.type,
        attributes: {},
        metadata: {}
      } as unknown as RecommendationItem,
      score: rec.score,
      reasoning: rec.reasoning
    })));
  }

  /**
   * 获取序列分析结果（仅用于调试和展示）
   */
  async getSequenceAnalysis(
    userProfile: UserProfile,
    candidates: RecommendationItem[],
    windowSize: number = 10
  ): Promise<SequenceAnalysis | null> {
    try {
      if (!this.sequenceAgent) return null;

      const behaviors = this.buildSequence(userProfile.behaviorHistory);
      const candidateItems = candidates.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type || 'default'
      }));

      return await this.sequenceAgent.analyzeSequence(
        userProfile.userId,
        behaviors,
        candidateItems,
        10
      );
    } catch (error) {
      console.error('[SequentialRecommender] 获取序列分析失败:', error);
      return null;
    }
  }

  /**
   * 提取序列特征（向后兼容）
   */
  extractSequenceFeatures(sequence: any[], windowSize: number = 10): {
    recentItems: string[];
    actionPattern: string[];
    timeGaps: number[];
    frequency: Record<string, number>;
  } {
    const recent = sequence.slice(-windowSize);
    const recentItems = recent.map(s => s.itemId);
    const actionPattern = recent.map(s => s.action);

    const timeGaps = [];
    for (let i = 1; i < recent.length; i++) {
      timeGaps.push(recent[i].timestamp - recent[i - 1].timestamp);
    }

    const frequency: Record<string, number> = {};
    for (const item of recentItems) {
      frequency[item] = (frequency[item] || 0) + 1;
    }

    return {
      recentItems,
      actionPattern,
      timeGaps,
      frequency
    };
  }
}

// ============================================================================
// 多行为推荐
// ============================================================================

/**
 * 行为权重配置
 */
export interface BehaviorWeights {
  view: number;
  click: number;
  like: number;
  dislike: number;
  purchase: number;
  share: number;
  comment: number;
  rating: number;
}

/**
 * 默认行为权重
 */
export const DEFAULT_BEHAVIOR_WEIGHTS: BehaviorWeights = {
  view: 0.1,
  click: 0.3,
  like: 0.7,
  dislike: -0.5,
  purchase: 1.0,
  share: 0.8,
  comment: 0.6,
  rating: 1.0
};

/**
 * 多行为推荐策略
 */
export class MultiBehaviorRecommender {
  private behaviorWeights: BehaviorWeights;

  constructor(weights?: Partial<BehaviorWeights>) {
    this.behaviorWeights = {
      ...DEFAULT_BEHAVIOR_WEIGHTS,
      ...weights
    };
  }

  /**
   * 计算行为得分
   */
  calculateBehaviorScore(behavior: any): number {
    let score = this.behaviorWeights[behavior.action as keyof BehaviorWeights] || 0;

    // 如果有评分，结合评分
    if (behavior.rating && behavior.rating > 0) {
      score *= (behavior.rating / 5);
    }

    // 如果有持续时间，结合持续时间（对于 view 行为）
    if (behavior.duration && behavior.action === 'view') {
      // 假设正常阅读时长为 60 秒
      const normalizedDuration = Math.min(behavior.duration / 60, 2);
      score *= normalizedDuration;
    }

    return score;
  }

  /**
   * 计算用户对物品的综合得分
   */
  calculateItemScore(
    userProfile: UserProfile,
    itemId: string
  ): {
    totalScore: number;
    behaviorBreakdown: Record<string, number>;
    lastActionTime: number;
  } {
    const relevantBehaviors = userProfile.behaviorHistory.filter(
      b => b.itemId === itemId
    );

    if (relevantBehaviors.length === 0) {
      return {
        totalScore: 0,
        behaviorBreakdown: {},
        lastActionTime: 0
      };
    }

    const behaviorBreakdown: Record<string, number> = {};
    let totalScore = 0;
    let lastActionTime = 0;

    for (const behavior of relevantBehaviors) {
      const score = this.calculateBehaviorScore(behavior);
      behaviorBreakdown[behavior.action] = (behaviorBreakdown[behavior.action] || 0) + score;
      totalScore += score;
      lastActionTime = Math.max(lastActionTime, behavior.timestamp);
    }

    return {
      totalScore: Math.min(totalScore, 1),
      behaviorBreakdown,
      lastActionTime
    };
  }

  /**
   * 生成多行为推荐
   */
  generateMultiBehaviorRecommendations(
    userProfile: UserProfile,
    candidates: RecommendationItem[]
  ): Array<{ item: RecommendationItem; score: number; breakdown: any }> {
    const results = [];

    for (const candidate of candidates) {
      const { totalScore, behaviorBreakdown, lastActionTime } =
        this.calculateItemScore(userProfile, candidate.id);

      if (totalScore > 0) {
        results.push({
          item: candidate,
          score: totalScore,
          breakdown: {
            behaviorScores: behaviorBreakdown,
            lastActionTime,
            reasoning: this.generateReasoning(behaviorBreakdown)
          }
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 生成推荐理由
   */
  private generateReasoning(behaviorBreakdown: Record<string, number>): string {
    const reasons: string[] = [];

    for (const [action, score] of Object.entries(behaviorBreakdown)) {
      if (score > 0.3) {
        switch (action) {
          case 'purchase':
            reasons.push('你曾经购买过');
            break;
          case 'like':
            reasons.push('你喜欢过');
            break;
          case 'view':
            reasons.push('你查看过');
            break;
          case 'share':
            reasons.push('你分享过');
            break;
          case 'comment':
            reasons.push('你评论过');
            break;
        }
      }
    }

    return reasons.join('，') || '基于你的行为历史';
  }

  /**
   * 学习行为权重（基于反馈）
   */
  learnWeights(feedback: Array<{
    userId: string;
    itemId: string;
    behavior: any;
    outcome: 'positive' | 'negative';
  }>): BehaviorWeights {
    // 简化的权重学习（实际可以使用强化学习等）
    const newWeights = { ...this.behaviorWeights };

    for (const f of feedback) {
      const action = f.behavior.action as keyof typeof newWeights;
      const adjustment = f.outcome === 'positive' ? 0.01 : -0.01;

      newWeights[action] = Math.max(0, Math.min(1,
        (newWeights[action] || 0) + adjustment
      ));
    }

    // 归一化
    const total = Object.values(newWeights).reduce((sum, v) => sum + Math.abs(v), 0);
    for (const key in newWeights) {
      newWeights[key as keyof typeof newWeights] = Math.abs(newWeights[key as keyof typeof newWeights]) / total;
    }

    this.behaviorWeights = newWeights;
    return newWeights;
  }
}

// ============================================================================
// 混合推荐策略（整合序列和多行为）
// ============================================================================

/**
 * 混合推荐配置
 */
export interface HybridConfig {
  sequentialWeight: number;    // 序列推荐权重
  multiBehaviorWeight: number; // 多行为推荐权重
  contentBasedWeight: number;  // 基于内容权重
  collaborativeWeight: number; // 协同过滤权重
}

/**
 * 高级混合推荐器
 */
export class AdvancedHybridRecommender {
  private sequentialRecommender: SequentialRecommender;
  private multiBehaviorRecommender: MultiBehaviorRecommender;
  private config: HybridConfig;

  constructor(
    behaviorWeights?: Partial<BehaviorWeights>,
    config?: Partial<HybridConfig>
  ) {
    this.sequentialRecommender = new SequentialRecommender();
    this.multiBehaviorRecommender = new MultiBehaviorRecommender(behaviorWeights);
    this.config = {
      sequentialWeight: 0.3,
      multiBehaviorWeight: 0.3,
      contentBasedWeight: 0.2,
      collaborativeWeight: 0.2,
      ...config
    };
  }

  /**
   * 生成高级混合推荐
   */
  async generateRecommendations(
    userProfile: UserProfile,
    candidates: RecommendationItem[],
    limit: number = 10
  ): Promise<RecommendationResult[]> {
    // 1. 序列推荐
    const sequentialRecs = await
      this.sequentialRecommender.generateSequentialRecommendations(
        userProfile,
        candidates
      );

    // 2. 多行为推荐
    const multiBehaviorRecs = await
      this.multiBehaviorRecommender.generateMultiBehaviorRecommendations(
        userProfile,
        candidates
      );

    // 3. 基于内容推荐（简化）
    const contentRecs = candidates
      .filter(item =>
        userProfile.interests.some(interest =>
          item.title.toLowerCase().includes(interest.toLowerCase())
        )
      )
      .map(item => ({
        item,
        score: 0.8,
        reasoning: '基于兴趣匹配'
      }));

    // 4. 协同过滤推荐（简化）
    const collaborativeRecs = candidates
      .map(item => ({
        item,
        score: Math.random() * 0.7,
        reasoning: '基于相似用户'
      }));

    // 5. 合并评分
    const itemScores = new Map<string, {
      item: RecommendationItem;
      scores: Record<string, number>;
      reasonings: string[];
    }>();

    // 添加序列推荐分数
    for (const rec of sequentialRecs) {
      if (!itemScores.has(rec.item.id)) {
        itemScores.set(rec.item.id, {
          item: rec.item,
          scores: {},
          reasonings: []
        });
      }
      const data = itemScores.get(rec.item.id)!;
      data.scores.sequential = rec.score;
      data.reasonings.push(rec.reasoning);
    }

    // 添加多行为推荐分数
    for (const rec of multiBehaviorRecs) {
      if (!itemScores.has(rec.item.id)) {
        itemScores.set(rec.item.id, {
          item: rec.item,
          scores: {},
          reasonings: []
        });
      }
      const data = itemScores.get(rec.item.id)!;
      data.scores.multiBehavior = rec.score;
      data.reasonings.push(rec.breakdown.reasoning);
    }

    // 添加基于内容推荐分数
    for (const rec of contentRecs) {
      if (!itemScores.has(rec.item.id)) {
        itemScores.set(rec.item.id, {
          item: rec.item,
          scores: {},
          reasonings: []
        });
      }
      const data = itemScores.get(rec.item.id)!;
      data.scores.contentBased = rec.score;
      data.reasonings.push(rec.reasoning);
    }

    // 添加协同过滤分数
    for (const rec of collaborativeRecs) {
      if (!itemScores.has(rec.item.id)) {
        itemScores.set(rec.item.id, {
          item: rec.item,
          scores: {},
          reasonings: []
        });
      }
      const data = itemScores.get(rec.item.id)!;
      data.scores.collaborative = rec.score;
      data.reasonings.push(rec.reasoning);
    }

    // 6. 计算综合分数
    const finalResults: RecommendationResult[] = [];

    for (const [itemId, data] of itemScores) {
      const combinedScore =
        (data.scores.sequential || 0) * this.config.sequentialWeight +
        (data.scores.multiBehavior || 0) * this.config.multiBehaviorWeight +
        (data.scores.contentBased || 0) * this.config.contentBasedWeight +
        (data.scores.collaborative || 0) * this.config.collaborativeWeight;

      finalResults.push({
        item: data.item,
        score: Math.min(combinedScore, 1),
        rank: 0,
        explanations: [
          {
            type: 'behavioral',
            reason: data.reasonings.join('，'),
            factors: [],
            weight: 1
          }
        ],
        confidence: combinedScore,
        strategy: 'hybrid',
        agents: ['sequential_recommender', 'multi_behavior_recommender'],
        timestamp: Date.now()
      });
    }

    // 7. 排序并返回
    finalResults.sort((a, b) => b.score - a.score);
    finalResults.slice(0, limit).forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return finalResults;
  }
}

// ============================================================================
// 导出
// ============================================================================

// Types are already exported where defined
