/**
 * 语义搜索 API
 * POST /api/search/semantic - 语义搜索
 * GET /api/search/semantic - 获取搜索建议
 */

import { NextRequest, NextResponse } from 'next/server';
import { embeddingService } from '@/lib/embedding/service';

/**
 * POST - 执行语义搜索
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, type = 'all', limit = 10, threshold = 0.3 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({
        success: false,
        error: '请提供搜索关键词',
      }, { status: 400 });
    }

    // 根据类型搜索
    const results: {
      knowledge?: any[];
      cases?: any[];
      entities?: any[];
    } = {};

    if (type === 'all' || type === 'knowledge') {
      results.knowledge = await embeddingService.searchKnowledge(query, { limit, threshold });
    }

    if (type === 'all' || type === 'cases') {
      results.cases = await embeddingService.searchSimilarCases(query, { limit, threshold });
    }

    if (type === 'all' || type === 'entities') {
      results.entities = await embeddingService.searchSimilarEntities(query, { limit, threshold });
    }

    // 计算总数
    const total = Object.values(results).reduce(
      (sum, arr) => sum + (arr?.length || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        query,
        results,
        total,
        limit,
        threshold,
      },
    });

  } catch (error: any) {
    console.error('[Semantic Search] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * GET - 获取搜索建议
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'entities';
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query) {
      return NextResponse.json({
        success: true,
        data: { suggestions: [] },
      });
    }

    let suggestions: any[] = [];

    if (type === 'entities') {
      const entities = await embeddingService.searchSimilarEntities(query, { limit });
      suggestions = entities.map(e => ({
        id: e.id,
        text: e.name,
        type: e.type,
        subtitle: e.description?.slice(0, 50),
      }));
    } else if (type === 'cases') {
      const cases = await embeddingService.searchSimilarCases(query, { limit });
      suggestions = cases.map(c => {
        let subtitle = '';
        if (c.conclusion) {
          if (typeof c.conclusion === 'string') {
            subtitle = c.conclusion.slice(0, 50);
          } else if (typeof c.conclusion === 'object') {
            subtitle = JSON.stringify(c.conclusion).slice(0, 50);
          }
        }
        return {
          id: c.id,
          text: c.topic,
          type: 'case',
          subtitle,
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: { suggestions },
    });

  } catch (error: any) {
    console.error('[Semantic Search] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
