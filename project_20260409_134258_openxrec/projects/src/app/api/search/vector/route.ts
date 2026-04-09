/**
 * 向量搜索 API
 * 
 * 提供统一的语义搜索接口：
 * - 知识库文档搜索
 * - 案例库搜索
 * - 知识图谱实体搜索
 * - 综合搜索（跨所有来源）
 */

import { NextRequest, NextResponse } from 'next/server';
import { embeddingService } from '@/lib/embedding/service';

/**
 * 搜索类型
 */
type SearchType = 'knowledge' | 'cases' | 'entities' | 'all';

interface SearchParams {
  query: string;
  type: SearchType;
  limit?: number;
  threshold?: number;
  docType?: string;
  entityType?: string;
}

/**
 * GET: 搜索接口
 * 
 * Query params:
 * - q: 搜索查询（必需）
 * - type: 搜索类型 knowledge|cases|entities|all (default: all)
 * - limit: 返回数量限制 (default: 10)
 * - threshold: 相似度阈值 (default: 0.3)
 * - docType: 文档类型过滤（仅 knowledge 搜索）
 * - entityType: 实体类型过滤（仅 entities 搜索）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少搜索查询参数 q' },
        { status: 400 }
      );
    }

    const type = (searchParams.get('type') || 'all') as SearchType;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const threshold = parseFloat(searchParams.get('threshold') || '0.3');
    const docType = searchParams.get('docType') || undefined;
    const entityType = searchParams.get('entityType') || undefined;

    const results: {
      knowledge?: Awaited<ReturnType<typeof embeddingService.searchKnowledge>>;
      cases?: Awaited<ReturnType<typeof embeddingService.searchSimilarCases>>;
      entities?: Awaited<ReturnType<typeof embeddingService.searchSimilarEntities>>;
    } = {};

    // 根据类型执行搜索
    const searchPromises: Promise<void>[] = [];

    if (type === 'knowledge' || type === 'all') {
      searchPromises.push(
        embeddingService.searchKnowledge(query, { limit, threshold, docType })
          .then(r => { results.knowledge = r; })
      );
    }

    if (type === 'cases' || type === 'all') {
      searchPromises.push(
        embeddingService.searchSimilarCases(query, { limit: Math.min(limit, 5), threshold })
          .then(r => { results.cases = r; })
      );
    }

    if (type === 'entities' || type === 'all') {
      searchPromises.push(
        embeddingService.searchSimilarEntities(query, { limit, threshold, entityType })
          .then(r => { results.entities = r; })
      );
    }

    await Promise.all(searchPromises);

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        query,
        type,
        limit,
        threshold,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Vector Search API] Search error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST: 批量搜索或高级搜索
 * 
 * Body:
 * - queries: string[] (批量查询)
 * - params: SearchParams
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queries, params } = body as { queries: string[]; params?: Omit<SearchParams, 'query'> };

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供查询数组 queries' },
        { status: 400 }
      );
    }

    const type = params?.type || 'all';
    const limit = params?.limit || 10;
    const threshold = params?.threshold || 0.3;

    // 批量搜索
    const allResults = await Promise.all(
      queries.map(async (query) => {
        const results: {
          query: string;
          knowledge?: Awaited<ReturnType<typeof embeddingService.searchKnowledge>>;
          cases?: Awaited<ReturnType<typeof embeddingService.searchSimilarCases>>;
          entities?: Awaited<ReturnType<typeof embeddingService.searchSimilarEntities>>;
        } = { query };

        if (type === 'knowledge' || type === 'all') {
          results.knowledge = await embeddingService.searchKnowledge(query, { limit, threshold });
        }

        if (type === 'cases' || type === 'all') {
          results.cases = await embeddingService.searchSimilarCases(query, { limit: Math.min(limit, 5), threshold });
        }

        if (type === 'entities' || type === 'all') {
          results.entities = await embeddingService.searchSimilarEntities(query, { limit, threshold });
        }

        return results;
      })
    );

    return NextResponse.json({
      success: true,
      data: allResults,
      meta: {
        queryCount: queries.length,
        type,
        limit,
        threshold,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Vector Search API] Batch search error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
