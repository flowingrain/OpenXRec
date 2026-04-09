/**
 * 序列推荐 API
 *
 * 演示智能体驱动的序列推荐系统
 */

import { NextRequest, NextResponse } from 'next/server';
import { SequenceAnalysisAgent, BaselineSequenceRecommender } from '@/lib/recommendation/sequential-agent';
import { createLLMClient } from '@/lib/langgraph/nodes';

/**
 * POST /api/recommendation/sequential
 *
 * 请求体：
 * {
 *   "userId": "user123",
 *   "behaviors": [
 *     { "itemId": "item1", "itemTitle": "Python入门", "action": "view", "timestamp": 1704067200000 },
 *     { "itemId": "item2", "itemTitle": "Python实战", "action": "like", "timestamp": 1704153600000 }
 *   ],
 *   "candidateItems": [
 *     { "id": "item3", "title": "Django教程", "type": "course" },
 *     { "id": "item4", "title": "JavaScript入门", "type": "course" }
 *   ],
 *   "limit": 5,
 *   "useBaseline": false  // 是否使用基线算法（马尔可夫链）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
      behaviors = [],
      candidateItems = [],
      limit = 10,
      useBaseline = false
    } = body;

    // 验证参数
    if (!userId || !Array.isArray(behaviors) || !Array.isArray(candidateItems)) {
      return NextResponse.json(
        { error: '参数错误：需要 userId、behaviors 和 candidateItems' },
        { status: 400 }
      );
    }

    if (behaviors.length === 0) {
      return NextResponse.json(
        { error: '行为历史为空' },
        { status: 400 }
      );
    }

    if (candidateItems.length === 0) {
      return NextResponse.json(
        { error: '候选物品为空' },
        { status: 400 }
      );
    }

    // 选择推荐器
    let analysis: any;
    if (useBaseline) {
      // 使用基线算法（马尔可夫链）
      console.log(`[Sequential API] 使用基线算法（马尔可夫链）`);
      const baseline = new BaselineSequenceRecommender();
      const recommendations = baseline.recommend(behaviors, candidateItems, limit);

      analysis = {
        userId,
        totalBehaviors: behaviors.length,
        uniqueItems: new Set(behaviors.map((b: any) => b.itemId)).size,
        patterns: [],
        insights: ['使用基线算法（马尔可夫链）'],
        recommendations
      };
    } else {
      // 使用智能体
      console.log(`[Sequential API] 使用智能体序列推荐`);
      const llmClient = createLLMClient();
      const agent = new SequenceAnalysisAgent(llmClient);

      analysis = await agent.analyzeSequence(
        userId,
        behaviors,
        candidateItems,
        limit
      );
    }

    // 返回结果
    return NextResponse.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('[Sequential API] 推荐失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: '推荐失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendation/sequential
 *
 * 获取示例数据和使用说明
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: '序列推荐 API（智能体驱动）',
    description: '通过智能体分析用户行为序列，识别模式并生成推荐',
    usage: {
      endpoint: '/api/recommendation/sequential',
      method: 'POST',
      requestBody: {
        userId: 'string (必填)',
        behaviors: [
          {
            itemId: 'string',
            itemTitle: 'string',
            itemType: 'string',
            action: 'string (view/click/like/share/purchase)',
            timestamp: 'number',
            rating: 'number (可选)',
            duration: 'number (可选)',
            context: 'object (可选)'
          }
        ],
        candidateItems: [
          {
            id: 'string',
            title: 'string',
            type: 'string'
          }
        ],
        limit: 'number (默认 10)',
        useBaseline: 'boolean (是否使用基线算法，默认 false)'
      }
    },
    example: {
      userId: 'user_123',
      behaviors: [
        { itemId: 'item_1', itemTitle: 'Python入门', itemType: 'course', action: 'view', timestamp: 1704067200000 },
        { itemId: 'item_2', itemTitle: 'Python实战', itemType: 'course', action: 'like', timestamp: 1704153600000 },
        { itemId: 'item_3', itemTitle: 'Flask框架', itemType: 'course', action: 'view', timestamp: 1704240000000 }
      ],
      candidateItems: [
        { id: 'item_4', title: 'Django教程', type: 'course' },
        { id: 'item_5', title: 'JavaScript入门', type: 'course' },
        { id: 'item_6', title: '机器学习基础', type: 'course' }
      ],
      limit: 5
    },
    features: [
      '智能体驱动的序列分析',
      '识别频繁模式、顺序模式、周期模式',
      '基于LLM的序列理解和推理',
      '提供详细的推荐理由和模式匹配信息',
      '基线算法（马尔可夫链）作为兜底方案',
      '降级策略：智能体失败时自动切换到基线'
    ],
    responseFields: {
      userId: '用户ID',
      totalBehaviors: '行为总数',
      uniqueItems: '唯一物品数',
      patterns: '识别到的序列模式',
      insights: '序列洞察',
      recommendations: [
        {
          item: '推荐物品',
          score: '推荐分数',
          reasoning: '推荐理由',
          strategy: '推荐策略 (pattern_based/llm_based/hybrid)',
          patternMatch: '匹配的模式 (可选)',
          confidence: '置信度'
        }
      ]
    }
  });
}
