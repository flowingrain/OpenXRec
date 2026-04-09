/**
 * 推荐系统与知识库集成服务
 * 
 * 功能：
 * - 利用知识库增强推荐解释
 * - 基于知识库生成推荐理由
 * - 支持推荐相关知识查询
 */

import { getKnowledgeManager, KnowledgeManager, KnowledgeSearchResult, KnowledgeContext } from '../knowledge';
import type { RecommendationItem, RecommendationExplanation, UserProfile } from './types';

// ==================== 类型定义 ====================

export interface RecommendationKnowledgeContext {
  userId: string;
  userInterests: string[];
  recommendedItem: RecommendationItem;
  scenario: string;
}

export interface KnowledgeEnhancedExplanation {
  explanation: string;
  knowledgeSources: KnowledgeSearchResult[];
  confidence: number;
  reasoning: string;
}

export interface RecommendationKnowledgeQuery {
  query: string;
  context?: {
    userId?: string;
    itemIds?: string[];
    scenario?: string;
  };
}

// ==================== 推荐知识库管理器 ====================

/**
 * 推荐知识库管理器
 * 将知识库能力集成到推荐系统中
 */
export class RecommendationKnowledgeManager {
  private knowledgeManager: KnowledgeManager;
  
  constructor() {
    this.knowledgeManager = getKnowledgeManager();
  }

  /**
   * 初始化：加载推荐相关知识
   */
  async initialize(): Promise<void> {
    console.log('[RecommendationKnowledge] Initializing...');
    
    // 添加推荐相关的知识条目
    await this.loadRecommendationKnowledge();
    
    console.log('[RecommendationKnowledge] Initialized successfully');
  }

  /**
   * 加载推荐相关知识
   */
  private async loadRecommendationKnowledge(): Promise<void> {
    const recommendationKnowledge = [
      {
        id: 'rec_strategy_content_based',
        type: 'market_data' as const,
        title: '基于内容的推荐策略',
        content: '基于内容的推荐通过分析物品的特征（如标题、描述、类别）与用户历史喜好的相似性来推荐物品。适合冷启动场景，推荐结果可解释性强。',
        metadata: {
          source: '推荐算法基础',
          confidence: 0.95,
          timestamp: Date.now(),
          tags: ['推荐算法', '内容推荐', '冷启动'],
          relatedEntities: ['用户画像', '物品特征'],
          isPreset: true,
        }
      },
      {
        id: 'rec_strategy_collaborative',
        type: 'market_data' as const,
        title: '协同过滤推荐策略',
        content: '协同过滤通过分析用户行为模式，找到相似用户或相似物品进行推荐。能发现用户未接触过的物品，但存在冷启动问题。',
        metadata: {
          source: '推荐算法基础',
          confidence: 0.95,
          timestamp: Date.now(),
          tags: ['推荐算法', '协同过滤', '用户行为'],
          relatedEntities: ['相似用户', '物品相似度'],
          isPreset: true,
        }
      },
      {
        id: 'rec_diversity',
        type: 'market_data' as const,
        title: '推荐多样性',
        content: '推荐多样性指推荐结果的差异性。过高的相似度会导致推荐结果单调，降低用户体验。常用优化算法包括 MMR（Maximal Marginal Relevance）。',
        metadata: {
          source: '推荐优化',
          confidence: 0.9,
          timestamp: Date.now(),
          tags: ['推荐优化', '多样性', 'MMR'],
          relatedEntities: ['推荐质量', '用户体验'],
          isPreset: true,
        }
      },
      {
        id: 'rec_novelty',
        type: 'market_data' as const,
        title: '推荐新颖性',
        content: '推荐新颖性指推荐用户未接触过的物品。新颖性过高可能导致用户不感兴趣，需要在相关性和新颖性之间取得平衡。',
        metadata: {
          source: '推荐优化',
          confidence: 0.9,
          timestamp: Date.now(),
          tags: ['推荐优化', '新颖性', '用户体验'],
          relatedEntities: ['推荐质量', '用户兴趣'],
          isPreset: true,
        }
      },
      {
        id: 'rec_serendipity',
        type: 'market_data' as const,
        title: '推荐惊喜性',
        content: '推荐惊喜性指推荐用户意想不到但会感兴趣的物品。惊喜性能提升用户满意度，但需要准确把握用户兴趣边界。',
        metadata: {
          source: '推荐优化',
          confidence: 0.85,
          timestamp: Date.now(),
          tags: ['推荐优化', '惊喜性', '用户满意度'],
          relatedEntities: ['推荐质量', '用户兴趣'],
          isPreset: true,
        }
      },
      {
        id: 'rec_cold_start',
        type: 'market_data' as const,
        title: '冷启动问题',
        content: '冷启动问题指新用户或新物品缺乏历史数据，导致推荐效果不佳。解决方案包括：使用用户注册信息、物品元数据、基于内容的推荐等。',
        metadata: {
          source: '推荐挑战',
          confidence: 0.95,
          timestamp: Date.now(),
          tags: ['推荐挑战', '冷启动', '解决方案'],
          relatedEntities: ['新用户', '新物品', '用户画像'],
          isPreset: true,
        }
      },
      {
        id: 'rec_explainability',
        type: 'market_data' as const,
        title: '推荐可解释性',
        content: '推荐可解释性指能否向用户解释为什么推荐该物品。可解释性强的推荐能提升用户信任度和满意度。常见解释方式包括：基于特征相似、基于行为、基于知识图谱等。',
        metadata: {
          source: '推荐特性',
          confidence: 0.95,
          timestamp: Date.now(),
          tags: ['推荐特性', '可解释性', '用户信任'],
          relatedEntities: ['推荐解释', '用户满意度'],
          isPreset: true,
        }
      },
      {
        id: 'rec_personalization',
        type: 'market_data' as const,
        title: '推荐个性化',
        content: '推荐个性化指根据用户的兴趣、偏好、行为历史等特征提供个性化的推荐结果。个性化程度越高，用户满意度通常越高。',
        metadata: {
          source: '推荐特性',
          confidence: 0.95,
          timestamp: Date.now(),
          tags: ['推荐特性', '个性化', '用户画像'],
          relatedEntities: ['用户兴趣', '用户偏好'],
          isPreset: true,
        }
      },
      {
        id: 'rec_ab_testing',
        type: 'market_data' as const,
        title: '推荐A/B测试',
        content: 'A/B测试是评估推荐算法效果的重要方法。通过对比不同算法的点击率、转化率等指标，选择最优算法。需要注意统计显著性检验。',
        metadata: {
          source: '推荐评估',
          confidence: 0.9,
          timestamp: Date.now(),
          tags: ['推荐评估', 'A/B测试', '指标'],
          relatedEntities: ['点击率', '转化率'],
          isPreset: true,
        }
      },
      {
        id: 'rec_metrics',
        type: 'market_data' as const,
        title: '推荐评估指标',
        content: '常用推荐评估指标包括：准确率（Precision）、召回率（Recall）、F1分数、NDCG、MAP等。不同场景下应选择合适的指标。',
        metadata: {
          source: '推荐评估',
          confidence: 0.95,
          timestamp: Date.now(),
          tags: ['推荐评估', '指标', '准确率'],
          relatedEntities: ['Precision', 'Recall', 'NDCG'],
          isPreset: true,
        }
      }
    ];

    for (const knowledge of recommendationKnowledge) {
      await this.knowledgeManager.addKnowledge(knowledge);
    }

    console.log(`[RecommendationKnowledge] Loaded ${recommendationKnowledge.length} knowledge entries`);
  }

  /**
   * 查询推荐相关知识
   */
  async queryRecommendationKnowledge(
    query: string,
    options: {
      limit?: number;
      types?: string[];
      tags?: string[];
    } = {}
  ): Promise<KnowledgeSearchResult[]> {
    return await this.knowledgeManager.searchKnowledge(query, {
      limit: options.limit || 10,
      types: options.types as any,
      tags: options.tags
    });
  }

  /**
   * 获取推荐知识上下文
   */
  async getRecommendationKnowledgeContext(
    query: string,
    options: {
      maxEntries?: number;
    } = {}
  ): Promise<KnowledgeContext> {
    return await this.knowledgeManager.getKnowledgeContext(query, {
      maxEntries: options.maxEntries || 5
    });
  }

  /**
   * 生成知识增强的推荐解释
   */
  async generateKnowledgeEnhancedExplanation(
    item: RecommendationItem,
    userProfile: UserProfile,
    score: number,
    strategy: string
  ): Promise<KnowledgeEnhancedExplanation> {
    // 1. 获取用户兴趣相关知识
    const interestKnowledge = await this.queryRecommendationKnowledge(
      userProfile.interests.join(' ') || '推荐',
      { limit: 3 }
    );

    // 2. 获取推荐策略相关知识
    const strategyKnowledge = await this.queryRecommendationKnowledge(
      strategy || '推荐策略',
      { limit: 2 }
    );

    // 3. 获取物品相关知识
    const itemKnowledge = await this.queryRecommendationKnowledge(
      item.title || '推荐',
      { limit: 2 }
    );

    // 4. 合并所有相关知识
    const allKnowledge = [
      ...interestKnowledge,
      ...strategyKnowledge,
      ...itemKnowledge
    ];

    // 5. 生成解释
    const explanation = this.buildExplanation(item, userProfile, allKnowledge, strategy);

    // 6. 计算置信度
    const confidence = this.calculateConfidence(score, allKnowledge);

    return {
      explanation,
      knowledgeSources: allKnowledge.slice(0, 5),
      confidence,
      reasoning: this.buildReasoning(allKnowledge)
    };
  }

  /**
   * 构建解释
   */
  private buildExplanation(
    item: RecommendationItem,
    userProfile: UserProfile,
    knowledge: KnowledgeSearchResult[],
    strategy: string
  ): string {
    const parts: string[] = [];

    // 1. 基于用户兴趣的解释
    if (userProfile.interests.length > 0) {
      const matchedInterests = userProfile.interests.slice(0, 3);
      parts.push(`基于你的兴趣：${matchedInterests.join('、')}`);
    }

    // 2. 基于推荐策略的解释
    const strategyKnowledge = knowledge.filter(k => 
      k.entry.title.includes('策略') || k.entry.title.includes('推荐')
    );
    if (strategyKnowledge.length > 0) {
      parts.push(`采用${strategy}策略`);
    }

    // 3. 基于知识的解释
    const relevantKnowledge = knowledge.slice(0, 2);
    if (relevantKnowledge.length > 0) {
      const knowledgeTitles = relevantKnowledge.map(k => k.entry.title);
      parts.push(`结合相关知识：${knowledgeTitles.join('、')}`);
    }

    // 4. 基于物品特征的解释
    if (item.title) {
      parts.push(`推荐"${item.title}"`);
    }

    return parts.join('，') + '。';
  }

  /**
   * 构建推理过程
   */
  private buildReasoning(knowledge: KnowledgeSearchResult[]): string {
    if (knowledge.length === 0) {
      return '基于历史行为和兴趣偏好进行推荐';
    }

    const reasoningSteps = knowledge.map(k => {
      return `${k.entry.title}：${k.entry.content.substring(0, 50)}...`;
    });

    return reasoningSteps.join('\n');
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    score: number,
    knowledge: KnowledgeSearchResult[]
  ): number {
    // 基础置信度：推荐分数
    let confidence = score;

    // 知识增强：相关知识数量
    const knowledgeBoost = Math.min(knowledge.length * 0.05, 0.15);

    // 知识可信度：平均可信度
    const avgKnowledgeConfidence = knowledge.length > 0
      ? knowledge.reduce((sum, k) => sum + k.entry.metadata.confidence, 0) / knowledge.length
      : 0.5;

    // 综合计算
    confidence = confidence * 0.7 + knowledgeBoost + avgKnowledgeConfidence * 0.2;

    return Math.min(confidence, 1);
  }

  /**
   * 获取推荐知识库统计
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
  } {
    return this.knowledgeManager.getStats();
  }

  /**
   * 添加推荐相关知识
   */
  async addRecommendationKnowledge(
    knowledge: {
      id: string;
      title: string;
      content: string;
      type?: string;
      tags?: string[];
    }
  ): Promise<void> {
    await this.knowledgeManager.addKnowledge({
      id: knowledge.id,
      type: (knowledge.type as any) || 'knowledge_based',
      title: knowledge.title,
      content: knowledge.content,
      metadata: {
        source: '推荐系统',
        confidence: 0.9,
        timestamp: Date.now(),
        tags: knowledge.tags || ['推荐'],
        relatedEntities: [],
        isPreset: false,
      }
    });
  }
}

// ==================== 单例导出 ====================

let recommendationKnowledgeManagerInstance: RecommendationKnowledgeManager | null = null;

export function getRecommendationKnowledgeManager(): RecommendationKnowledgeManager {
  if (!recommendationKnowledgeManagerInstance) {
    recommendationKnowledgeManagerInstance = new RecommendationKnowledgeManager();
  }
  return recommendationKnowledgeManagerInstance;
}
