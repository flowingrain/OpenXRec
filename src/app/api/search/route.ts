import { NextRequest, NextResponse } from 'next/server';
import { advancedWebSearch } from '@/lib/search/advanced-web-search';

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 信息源搜索 API
 * POST /api/search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, count = 10 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    console.log('[Search API] Searching for:', query);

    const response = await advancedWebSearch(query, {
      searchType: 'web',
      count,
      needSummary: true,
    });

    const results = (response as { web_items?: unknown[]; results?: unknown[] }).web_items
      ?? (response as { results?: unknown[] }).results
      ?? [];

    const formattedResults = (Array.isArray(results) ? results : []).map((item: Record<string, unknown>) => ({
      title: String(item.title ?? item.name ?? '未知标题'),
      source: String(item.source ?? item.site ?? item.site_name ?? '未知来源'),
      url: item.url ?? item.link,
      summary: String(
        item.summary ?? item.snippet ?? (typeof item.content === 'string' ? item.content.substring(0, 200) : '') ?? ''
      ),
      content: item.content,
      timestamp: item.timestamp ?? item.publishTime ?? new Date().toISOString(),
      relevance: typeof item.relevance === 'number' ? item.relevance : typeof item.score === 'number' ? item.score : 0.8,
      tags: Array.isArray(item.tags) ? item.tags : [query],
    }));

    const summary =
      typeof (response as { summary?: string }).summary === 'string'
        ? (response as { summary: string }).summary
        : '';

    return NextResponse.json({
      success: true,
      results: formattedResults,
      summary,
      query,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Search API] Error:', error);
    const message = errMessage(error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        results: [],
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}

/**
 * 获取搜索历史 / 热搜占位（可后续接分析或存储）
 * GET /api/search
 */
export async function GET() {
  return NextResponse.json({
    recentQueries: [] as string[],
    trending: [] as string[],
  });
}
