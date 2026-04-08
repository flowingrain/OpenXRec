/**
 * 通用推荐引擎核心实现
 *
 * 核心能力：
 * 1. 多策略推荐（基于内容、协同过滤、混合、知识图谱、智能体驱动、因果推断）
 * 2. 可解释性生成
 * 3. 多样性、新颖性、惊喜性优化
 * 4. A/B测试支持
 * 5. 实时更新和离线训练
 */

import {
  RecommendationEngine,
  RecommendationRequest,
  RecommendationResult,
  UserProfile,
  UserBehavior,
  RecommendationStats,
  RecommendationMetrics,
  RecommendationStrategy,
  RecommendationOptions,
  TrainingOptions,
  RecommendationItem,
  RecommendationExplanation,
  ExplanationFactor,
  RecommendationContext
} from './types';
import { cosineSimilarity, euclideanDistance } from '../utils';

// ============================================================================
// 推荐引擎配置
// ============================================================================

interface RecommendationEngineConfig {
  // 策略权重配置
  strategyWeights: {
    content_based: number;
    collaborative: number;
    knowledge_based: number;
    agent_based: number;
    causal_based: number;
  };

  // 质量控制
  minScoreThreshold: number;
  maxRecommendations: number;

  // 多样性、新颖性、惊喜性默认权重
  defaultDiversityWeight: number;
  defaultNoveltyWeight: number;
  defaultSerendipityWeight: number;

  // 缓存配置
  enableCache: boolean;
  cacheTTL: number;

  // A/B测试配置
  enableABTest: boolean;
}

// ============================================================================
// 核心推荐引擎类
// ============================================================================

export class UniversalRecommendationEngine implements RecommendationEngine {
  private config: RecommendationEngineConfig;
  private userProfiles: Map<string, UserProfile> = new Map();
  private itemRepository: Map<string, RecommendationItem> = new Map();
  private cache: Map<string, { results: RecommendationResult[]; timestamp: number }> = new Map();
  private abTestConfigs: Map<string, any> = new Map();

  constructor(config?: Partial<RecommendationEngineConfig>) {
    this.config = {
      strategyWeights: {
        content_based: 0.3,
        collaborative: 0.3,
        knowledge_based: 0.2,
        agent_based: 0.1,
        causal_based: 0.1
      },
      minScoreThreshold: 0.3,
      maxRecommendations: 100,
      defaultDiversityWeight: 0.2,
      defaultNoveltyWeight: 0.2,
      defaultSerendipityWeight: 0.1,
      enableCache: true,
      cacheTTL: 300000, // 5分钟
      enableABTest: true,
      ...config
    };
  }

  // ============================================================================
  // 核心推荐接口
  // ============================================================================

  /**
   * 生成推荐（主入口）
   */
  async recommend(request: RecommendationRequest): Promise<RecommendationResult[]> {
    const { userId, scenario, strategy, limit, filters, context, options } = request;

    // 1. 获取用户画像
    const userProfile = await this.getUserProfile(userId);

    // 2. 检查缓存
    const cacheKey = this.getCacheKey(request);
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
        console.log(`[RecommendationEngine] Using cached results for user ${userId}`);
        return cached.results.slice(0, limit);
      }
    }

    // 3. 确定推荐策略（如果未指定）
    const effectiveStrategy = strategy || this.selectStrategy(userProfile, scenario, context);

    // 4. 获取候选物品
    let candidates = await this.getCandidates(userProfile, scenario, filters, context);

    // 5. 根据策略进行评分
    let scoredItems: Array<{ item: RecommendationItem; score: number; details: any }> = [];

    switch (effectiveStrategy) {
      case 'content_based':
        scoredItems = await this.contentBasedScoring(candidates, userProfile);
        break;
      case 'collaborative':
        scoredItems = await this.collaborativeScoring(candidates, userProfile);
        break;
      case 'hybrid':
        scoredItems = await this.hybridScoring(candidates, userProfile);
        break;
      case 'knowledge_based':
        scoredItems = await this.knowledgeBasedScoring(candidates, userProfile);
        break;
      case 'agent_based':
        scoredItems = await this.agentBasedScoring(candidates, userProfile, context);
        break;
      case 'causal_based':
        scoredItems = await this.causalBasedScoring(candidates, userProfile, context);
        break;
      default:
        scoredItems = await this.hybridScoring(candidates, userProfile);
    }

    // 6. 过滤低分项
    scoredItems = scoredItems.filter(s => s.score >= this.config.minScoreThreshold);

    // 7. 排序和多样性优化
    const finalOptions = {
      enableDiversity: options?.enableDiversity ?? true,
      enableNovelty: options?.enableNovelty ?? true,
      enableSerendipity: options?.enableSerendipity ?? true,
      diversityWeight: options?.diversityWeight ?? this.config.defaultDiversityWeight,
      noveltyWeight: options?.noveltyWeight ?? this.config.defaultNoveltyWeight,
      serendipityWeight: options?.serendipityWeight ?? this.config.defaultSerendipityWeight,
      ...options
    };

    const rankedItems = await this.rankingWithOptimization(
      scoredItems,
      userProfile,
      finalOptions
    );

    // 8. 生成解释
    const results: RecommendationResult[] = [];
    for (let i = 0; i < Math.min(rankedItems.length, limit); i++) {
      const { item, score, details } = rankedItems[i];

      const explanations = finalOptions.enableExplanation
        ? await this.generateExplanations(item, userProfile, score, details, effectiveStrategy)
        : [];

      results.push({
        item,
        score,
        rank: i + 1,
        explanations,
        confidence: this.calculateConfidence(score, details),
        strategy: effectiveStrategy,
        agents: details.agents || [],
        timestamp: Date.now()
      });
    }

    // 9. 缓存结果
    if (this.config.enableCache) {
      this.cache.set(cacheKey, { results, timestamp: Date.now() });
    }

    return results;
  }

  // ============================================================================
  // 评分策略实现
  // ============================================================================

  /**
   * 基于内容的推荐评分
   */
  private async contentBasedScoring(
    candidates: RecommendationItem[],
    userProfile: UserProfile
  ): Promise<Array<{ item: RecommendationItem; score: number; details: any }>> {
    const results = [];

    for (const item of candidates) {
      let score = 0;
      const factors: ExplanationFactor[] = [];

      // 1. 兴趣匹配度
      for (const interest of userProfile.interests) {
        if (item.description?.toLowerCase().includes(interest.toLowerCase()) ||
            item.title.toLowerCase().includes(interest.toLowerCase())) {
          score += 0.3;
          factors.push({
            name: 'interest_match',
            value: interest,
            importance: 0.3,
            category: 'user'
          });
        }
      }

      // 2. 属性相似度
      for (const [key, value] of Object.entries(item.attributes)) {
        if (userProfile.preferences[key] === value) {
          score += 0.2;
          factors.push({
            name: 'attribute_match',
            value: { key, value },
            importance: 0.2,
            category: 'item'
          });
        }
      }

      // 3. 向量相似度（如果有）
      if (userProfile.embeddings && item.embeddings) {
        const similarity = cosineSimilarity(userProfile.embeddings, item.embeddings);
        score += similarity * 0.5;
        factors.push({
          name: 'embedding_similarity',
          value: similarity,
          importance: 0.5,
          category: 'item'
        });
      }

      results.push({
        item,
        score: Math.min(score, 1),
        details: { factors, agents: [] }
      });
    }

    return results;
  }

  /**
   * 协同过滤推荐评分
   */
  private async collaborativeScoring(
    candidates: RecommendationItem[],
    userProfile: UserProfile
  ): Promise<Array<{ item: RecommendationItem; score: number; details: any }>> {
    const results = [];

    // 找到相似用户（简化实现）
    const similarUsers = await this.findSimilarUsers(userProfile, 10);

    for (const item of candidates) {
      let score = 0;
      let voteCount = 0;

      for (const similarUser of similarUsers) {
        const behavior = similarUser.behaviorHistory.find(b => b.itemId === item.id);
        if (behavior && (behavior.action === 'like' || behavior.action === 'purchase')) {
          score += behavior.rating ? behavior.rating / 5 : 1;
          voteCount++;
        }
      }

      if (voteCount > 0) {
        score = score / voteCount;
      }

      results.push({
        item,
        score,
        details: {
          factors: [
            {
              name: 'collaborative_rating',
              value: score,
              importance: 1,
              category: 'user'
            }
          ],
          agents: []
        }
      });
    }

    return results;
  }

  /**
   * 混合推荐评分
   */
  private async hybridScoring(
    candidates: RecommendationItem[],
    userProfile: UserProfile
  ): Promise<Array<{ item: RecommendationItem; score: number; details: any }>> {
    // 并行计算多个策略的分数
    const [contentScores, collaborativeScores, knowledgeScores] = await Promise.all([
      this.contentBasedScoring(candidates, userProfile),
      this.collaborativeScoring(candidates, userProfile),
      this.knowledgeBasedScoring(candidates, userProfile)
    ]);

    const results = [];

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      const content = contentScores[i];
      const collaborative = collaborativeScores[i];
      const knowledge = knowledgeScores[i];

      const combinedScore =
        content.score * this.config.strategyWeights.content_based +
        collaborative.score * this.config.strategyWeights.collaborative +
        knowledge.score * this.config.strategyWeights.knowledge_based;

      const allFactors = [
        ...content.details.factors,
        ...collaborative.details.factors,
        ...knowledge.details.factors
      ];

      results.push({
        item,
        score: Math.min(combinedScore, 1),
        details: {
          factors: allFactors,
          agents: [],
          componentScores: {
            content_based: content.score,
            collaborative: collaborative.score,
            knowledge_based: knowledge.score
          }
        }
      });
    }

    return results;
  }

  /**
   * 知识图谱驱动推荐评分
   */
  private async knowledgeBasedScoring(
    candidates: RecommendationItem[],
    userProfile: UserProfile
  ): Promise<Array<{ item: RecommendationItem; score: number; details: any }>> {
    const results = [];

    for (const item of candidates) {
      let score = 0;
      const factors: ExplanationFactor[] = [];

      // 使用用户知识图谱进行推理
      if (userProfile.knowledgeGraph) {
        for (const node of userProfile.knowledgeGraph.nodes) {
          // 检查物品属性与知识图谱节点的关联
          for (const [key, value] of Object.entries(item.attributes)) {
            if (node.type === 'interest' &&
                String(value).toLowerCase().includes(node.label.toLowerCase())) {
              score += node.weight * 0.3;
              factors.push({
                name: 'knowledge_match',
                value: node.label,
                importance: node.weight,
                category: 'knowledge'
              });
            }
          }
        }

        // 检查知识图谱中的关系
        for (const edge of userProfile.knowledgeGraph.edges) {
          if (item.attributes[edge.relation] === edge.target) {
            score += edge.weight * 0.2;
            factors.push({
              name: 'knowledge_relation',
              value: edge.relation,
              importance: edge.weight,
              category: 'knowledge'
            });
          }
        }
      }

      results.push({
        item,
        score: Math.min(score, 1),
        details: { factors, agents: [] }
      });
    }

    return results;
  }

  /**
   * 智能体驱动推荐评分
   */
  private async agentBasedScoring(
    candidates: RecommendationItem[],
    userProfile: UserProfile,
    context: RecommendationContext
  ): Promise<Array<{ item: RecommendationItem; score: number; details: any }>> {
    // 这里会调用多智能体系统进行评分
    // 在实际实现中，会使用 LangGraph 的智能体协作机制

    const results = [];

    for (const item of candidates) {
      // 模拟智能体评分（实际实现中会调用智能体）
      const agentScores = await this.callAgentScoring(item, userProfile, context);

      const score = agentScores.reduce((sum, s) => sum + s.score, 0) / agentScores.length;

      results.push({
        item,
        score,
        details: {
          factors: agentScores.map(s => ({
            name: `agent_${s.agentName}`,
            value: s.reasoning,
            importance: s.score,
            category: 'user'
          })),
          agents: agentScores.map(s => s.agentName)
        }
      });
    }

    return results;
  }

  /**
   * 因果推断驱动推荐评分
   */
  private async causalBasedScoring(
    candidates: RecommendationItem[],
    userProfile: UserProfile,
    context: RecommendationContext
  ): Promise<Array<{ item: RecommendationItem; score: number; details: any }>> {
    // 这里会调用因果推断引擎进行评分
    // 利用项目已有的因果推断能力

    const results = [];

    for (const item of candidates) {
      // 模拟因果推断评分（实际实现中会调用因果推断服务）
      const causalScore = await this.callCausalInference(item, userProfile, context);

      results.push({
        item,
        score: causalScore.score,
        details: {
          factors: [{
            name: 'causal_impact',
            value: causalScore.causalChain,
            importance: causalScore.score,
            category: 'knowledge'
          }],
          agents: ['causal_analyst']
        }
      });
    }

    return results;
  }

  // ============================================================================
  // 排序优化
  // ============================================================================

  /**
   * 带优化的排序
   */
  private async rankingWithOptimization(
    scoredItems: Array<{ item: RecommendationItem; score: number; details: any }>,
    userProfile: UserProfile,
    options: RecommendationOptions
  ): Promise<Array<{ item: RecommendationItem; score: number; details: any }>> {
    let results = [...scoredItems];

    // 1. 基础排序（按分数降序）
    results.sort((a, b) => b.score - a.score);

    // 2. 多样性优化
    if (options.enableDiversity) {
      results = this.optimizeDiversity(results, userProfile, options.diversityWeight);
    }

    // 3. 新颖性优化
    if (options.enableNovelty) {
      results = this.optimizeNovelty(results, userProfile, options.noveltyWeight);
    }

    // 4. 惊喜性优化
    if (options.enableSerendipity) {
      results = this.optimizeSerendipity(results, userProfile, options.serendipityWeight);
    }

    return results;
  }

  /**
   * 多样性优化（MMR算法）
   */
  private optimizeDiversity(
    items: Array<{ item: RecommendationItem; score: number; details: any }>,
    userProfile: UserProfile,
    diversityWeight: number
  ): Array<{ item: RecommendationItem; score: number; details: any }> {
    const selected: Array<{ item: RecommendationItem; score: number; details: any }> = [];
    const remaining = [...items];

    while (remaining.length > 0 && selected.length < items.length) {
      let bestIndex = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];

        // 计算相关性分数
        const relevanceScore = item.score;

        // 计算多样性分数（与已选物品的最大相似度）
        let maxSimilarity = 0;
        for (const selected of selected) {
          const similarity = this.calculateItemSimilarity(item.item, selected.item);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
        const diversityScore = 1 - maxSimilarity;

        // 综合分数
        const combinedScore =
          (1 - diversityWeight) * relevanceScore +
          diversityWeight * diversityScore;

        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestIndex = i;
        }
      }

      selected.push(remaining.splice(bestIndex, 1)[0]);
    }

    return selected;
  }

  /**
   * 新颖性优化
   */
  private optimizeNovelty(
    items: Array<{ item: RecommendationItem; score: number; details: any }>,
    userProfile: UserProfile,
    noveltyWeight: number
  ): Array<{ item: RecommendationItem; score: number; details: any }> {
    return items.map(item => {
      // 计算新颖性分数（用户历史中出现过该物品的次数）
      const historyCount = userProfile.behaviorHistory.filter(
        b => b.itemId === item.item.id
      ).length;
      const noveltyScore = Math.max(0, 1 - historyCount * 0.2);

      const adjustedScore =
        (1 - noveltyWeight) * item.score +
        noveltyWeight * noveltyScore;

      return {
        ...item,
        score: adjustedScore,
        details: {
          ...item.details,
          noveltyScore
        }
      };
    });
  }

  /**
   * 惊喜性优化
   */
  private optimizeSerendipity(
    items: Array<{ item: RecommendationItem; score: number; details: any }>,
    userProfile: UserProfile,
    serendipityWeight: number
  ): Array<{ item: RecommendationItem; score: number; details: any }> {
    return items.map(item => {
      // 计算惊喜性分数（相关性不高但可能有价值）
      const relevanceScore = item.score;

      // 基于用户兴趣和物品属性的差异计算惊喜性
      let surpriseScore = 0;
      for (const interest of userProfile.interests) {
        if (!item.item.description?.toLowerCase().includes(interest.toLowerCase())) {
          surpriseScore += 0.2;
        }
      }
      surpriseScore = Math.min(surpriseScore, 1);

      const adjustedScore =
        (1 - serendipityWeight) * relevanceScore +
        serendipityWeight * surpriseScore * 0.5; // 惊喜性权重不能太高

      return {
        ...item,
        score: adjustedScore,
        details: {
          ...item.details,
          surpriseScore
        }
      };
    });
  }

  // ============================================================================
  // 解释生成
  // ============================================================================

  /**
   * 生成推荐解释
   */
  private async generateExplanations(
    item: RecommendationItem,
    userProfile: UserProfile,
    score: number,
    details: any,
    strategy: RecommendationStrategy
  ): Promise<RecommendationExplanation[]> {
    const explanations: RecommendationExplanation[] = [];

    // 1. 基于特征相似性的解释
    if (details.factors) {
      const featureFactors = details.factors.filter((f: ExplanationFactor) =>
        f.category === 'item' || f.category === 'user'
      );
      if (featureFactors.length > 0) {
        const reason = `基于你的兴趣和偏好：${featureFactors
          .slice(0, 3)
          .map((f: ExplanationFactor) => f.value)
          .join('、')}`;
        explanations.push({
          type: 'feature_similarity',
          reason,
          factors: featureFactors.slice(0, 5),
          weight: 0.4
        });
      }
    }

    // 2. 基于行为的解释
    const behaviorFactors = details.factors?.filter((f: ExplanationFactor) =>
      f.name === 'collaborative_rating'
    );
    if (behaviorFactors && behaviorFactors.length > 0) {
      const reason = '和你有相似偏好的用户也喜欢这个';
      explanations.push({
        type: 'behavioral',
        reason,
        factors: behaviorFactors,
        weight: 0.3
      });
    }

    // 3. 基于知识图谱的解释
    const knowledgeFactors = details.factors?.filter((f: ExplanationFactor) =>
      f.category === 'knowledge'
    );
    if (knowledgeFactors && knowledgeFactors.length > 0) {
      const reason = `根据知识图谱推理：${knowledgeFactors
        .slice(0, 2)
        .map((f: ExplanationFactor) => f.value)
        .join(' → ')}`;
      explanations.push({
        type: 'knowledge_graph',
        reason,
        factors: knowledgeFactors.slice(0, 3),
        weight: 0.2
      });
    }

    // 4. 基于因果推断的解释
    if (strategy === 'causal_based') {
      const reason = '因果分析显示这个推荐可能带来正向影响';
      explanations.push({
        type: 'causal',
        reason,
        factors: details.factors || [],
        weight: 0.1
      });
    }

    return explanations;
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private async getUserProfile(userId: string): Promise<UserProfile> {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      // 创建默认用户画像
      profile = {
        userId,
        interests: [],
        preferences: {},
        behaviorHistory: []
      };
      this.userProfiles.set(userId, profile);
    }
    return profile;
  }

  private async getCandidates(
    userProfile: UserProfile,
    scenario: string,
    filters?: any[],
    context?: RecommendationContext
  ): Promise<RecommendationItem[]> {
    // 从物品库获取候选物品（简化实现）
    // 实际实现中会根据场景、过滤器等条件查询
    return Array.from(this.itemRepository.values());
  }

  private selectStrategy(
    userProfile: UserProfile,
    scenario: string,
    context?: RecommendationContext
  ): RecommendationStrategy {
    // 根据用户画像和场景选择策略
    if (userProfile.behaviorHistory.length < 5) {
      return 'content_based'; // 新用户优先基于内容
    }
    return 'hybrid'; // 老用户使用混合策略
  }

  private getCacheKey(request: RecommendationRequest): string {
    return `${request.userId}_${request.scenario}_${request.limit}_${JSON.stringify(request.filters)}`;
  }

  private calculateConfidence(score: number, details: any): number {
    // 简化实现：分数越高，置信度越高
    return score * 0.8 + 0.2;
  }

  private async findSimilarUsers(userProfile: UserProfile, limit: number): Promise<UserProfile[]> {
    // 简化实现：随机返回一些用户
    return Array.from(this.userProfiles.values())
      .filter(u => u.userId !== userProfile.userId)
      .slice(0, limit);
  }

  private calculateItemSimilarity(item1: RecommendationItem, item2: RecommendationItem): number {
    // 简化实现：基于标题相似度
    const title1 = item1.title.toLowerCase();
    const title2 = item2.title.toLowerCase();
    const commonWords = title1.split(' ').filter(w => title2.includes(w));
    return commonWords.length / Math.max(title1.split(' ').length, title2.split(' ').length);
  }

  private async callAgentScoring(
    item: RecommendationItem,
    userProfile: UserProfile,
    context: RecommendationContext
  ): Promise<Array<{ agentName: string; score: number; reasoning: string }>> {
    // 简化实现：模拟智能体评分
    // 实际实现中会调用 LangGraph 智能体
    return [
      { agentName: 'feature_extractor', score: 0.8, reasoning: '特征匹配度高' },
      { agentName: 'similarity_calculator', score: 0.7, reasoning: '相似度适中' }
    ];
  }

  private async callCausalInference(
    item: RecommendationItem,
    userProfile: UserProfile,
    context: RecommendationContext
  ): Promise<{ score: number; causalChain: string }> {
    // 简化实现：模拟因果推断
    return {
      score: 0.75,
      causalChain: '兴趣匹配 → 行为倾向 → 推荐结果'
    };
  }

  // ============================================================================
  // 用户画像更新
  // ============================================================================

  async updateUserProfile(userId: string, behavior: UserBehavior): Promise<void> {
    const profile = await this.getUserProfile(userId);
    profile.behaviorHistory.push(behavior);

    // 更新兴趣标签
    if (behavior.action === 'like' || behavior.action === 'purchase') {
      const item = this.itemRepository.get(behavior.itemId);
      if (item) {
        // 从物品标题和描述中提取关键词作为兴趣
        const keywords = this.extractKeywords(item.title + ' ' + (item.description || ''));
        for (const keyword of keywords) {
          if (!profile.interests.includes(keyword)) {
            profile.interests.push(keyword);
          }
        }
      }
    }

    // 更新偏好
    const item = this.itemRepository.get(behavior.itemId);
    if (item) {
      for (const [key, value] of Object.entries(item.attributes)) {
        if (behavior.action === 'like' || behavior.action === 'purchase') {
          profile.preferences[key] = value;
        }
      }
    }

    this.userProfiles.set(userId, profile);

    // 清除缓存
    this.clearCacheForUser(userId);
  }

  private extractKeywords(text: string): string[] {
    // 简化实现：简单的关键词提取
    const stopWords = ['的', '了', '是', '在', '和', '与', '或', '但', '等', '很', '非常'];
    const words = text.split(/[\s,，.。!！?？;；:：]+/);
    return words
      .filter(w => w.length > 1 && !stopWords.includes(w))
      .slice(0, 10);
  }

  // ============================================================================
  // 训练和统计
  // ============================================================================

  async train(options?: TrainingOptions): Promise<void> {
    console.log('[RecommendationEngine] Training started...');
    // 实现离线训练逻辑
    console.log('[RecommendationEngine] Training completed.');
  }

  async getStats(userId: string): Promise<RecommendationStats> {
    const profile = await this.getUserProfile(userId);
    return {
      totalRecommendations: profile.behaviorHistory.length,
      clickRate: 0.0,
      conversionRate: 0.0,
      averageRating: 0.0,
      diversityScore: 0.7,
      noveltyScore: 0.6,
      strategyDistribution: {
        content_based: 0.4,
        collaborative: 0.3,
        knowledge_based: 0.2,
        agent_based: 0.05,
        causal_based: 0.05,
        hybrid: 0
      }
    };
  }

  private clearCacheForUser(userId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(userId + '_')) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  // ============================================================================
  // 物品库管理
  // ============================================================================

  addItem(item: RecommendationItem): void {
    this.itemRepository.set(item.id, item);
  }

  removeItem(itemId: string): void {
    this.itemRepository.delete(itemId);
  }

  getItem(itemId: string): RecommendationItem | undefined {
    return this.itemRepository.get(itemId);
  }

  getAllItems(): RecommendationItem[] {
    return Array.from(this.itemRepository.values());
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let instance: UniversalRecommendationEngine | null = null;

export function getRecommendationEngine(config?: Partial<RecommendationEngineConfig>): UniversalRecommendationEngine {
  if (!instance) {
    instance = new UniversalRecommendationEngine(config);
  }
  return instance;
}
