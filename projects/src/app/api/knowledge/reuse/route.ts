/**
 * 知识复用 API
 * POST /api/knowledge/reuse - 分析可复用知识
 * GET /api/knowledge/reuse - 获取知识复用统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeReuseService } from '@/lib/knowledge/reuse-service';

/**
 * POST - 分析可复用知识
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, maxCases = 5, maxEntities = 10, maxPatterns = 5 } = body;

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({
        success: false,
        error: '请提供分析主题',
      }, { status: 400 });
    }

    const result = await knowledgeReuseService.analyzeForReuse(topic, {
      maxCases,
      maxEntities,
      maxPatterns,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `发现 ${result.similarCases.length} 个相似案例，${result.relatedEntities.length} 个相关实体`,
    });

  } catch (error: any) {
    console.error('[Knowledge Reuse] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * GET - 获取知识复用统计
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'reuse') {
      // 复用指定案例的知识
      const sourceCaseId = searchParams.get('sourceCaseId');
      const targetTopic = searchParams.get('topic');

      if (!sourceCaseId || !targetTopic) {
        return NextResponse.json({
          success: false,
          error: '请提供 sourceCaseId 和 topic 参数',
        }, { status: 400 });
      }

      const result = await knowledgeReuseService.reuseKnowledge(sourceCaseId, targetTopic);

      return NextResponse.json({
        success: result.success,
        data: result,
      });
    }

    // 默认返回使用说明
    return NextResponse.json({
      success: true,
      data: {
        endpoints: {
          'POST /api/knowledge/reuse': {
            description: '分析可复用知识',
            body: {
              topic: 'string (必填) - 分析主题',
              maxCases: 'number (可选) - 最大案例数，默认 5',
              maxEntities: 'number (可选) - 最大实体数，默认 10',
              maxPatterns: 'number (可选) - 最大模式数，默认 5',
            },
          },
          'GET /api/knowledge/reuse?action=reuse': {
            description: '复用指定案例的知识',
            params: {
              sourceCaseId: 'string - 源案例 ID',
              topic: 'string - 目标主题',
            },
          },
        },
        example: {
          request: {
            topic: '美联储降息对中国市场的影响',
          },
          response: {
            similarCases: [
              { id: 'xxx', topic: '美联储加息周期分析', similarity: 0.85 },
            ],
            relatedEntities: [
              { id: 'xxx', name: '美联储', type: '机构', relevance: 0.9 },
            ],
            patterns: [
              { pattern: '利率传导机制', frequency: 8, applicability: 0.85 },
            ],
            suggestions: [
              '建议关注: 利率传导机制',
              '建议从政策、市场、技术、竞争四个维度分析',
            ],
          },
        },
      },
    });

  } catch (error: any) {
    console.error('[Knowledge Reuse] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
