import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config } from 'coze-coding-dev-sdk';

/**
 * 信息源搜索 API
 * POST /api/search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, count = 10 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Invalid query' },
        { status: 400 }
      );
    }

    // 创建搜索客户端
    const config = new Config();
    const searchClient = new SearchClient(config);

    console.log('[Search API] Searching for:', query);

    // 执行搜索
    const response = await searchClient.advancedSearch(query, {
      searchType: 'web',
      count,
      needSummary: true
    });

    console.log('[Search API] Found results');

    // 提取结果
    const results = (response as any).web_items || (response as any).results || [];
    
    // 转换为统一格式
    const formattedResults = results.map((item: any) => ({
      title: item.title || item.name || '未知标题',
      source: item.source || item.site || '未知来源',
      url: item.url || item.link,
      summary: item.summary || item.snippet || item.content?.substring(0, 200) || '',
      content: item.content,
      timestamp: item.timestamp || item.publishTime || new Date().toISOString(),
      relevance: item.relevance || item.score || 0.8,
      tags: item.tags || [query]
    }));

    return NextResponse.json({
      results: formattedResults,
      query,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Search API] Error:', error);
    
    // 返回模拟数据作为后备
    const mockResults = [
      {
        title: '美联储利率政策最新动态',
        source: '财经新闻',
        url: 'https://example.com/news/1',
        summary: '市场普遍预期美联储将在下次会议上讨论利率调整，投资者密切关注经济数据变化。',
        timestamp: new Date().toISOString(),
        relevance: 0.92,
        tags: ['美联储', '利率', '货币政策']
      },
      {
        title: '全球市场展望与分析',
        source: '金融时报',
        url: 'https://example.com/news/2',
        summary: '分析师对当前市场形势进行深入解读，提出未来走势预测和投资建议。',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        relevance: 0.85,
        tags: ['市场分析', '投资', '预测']
      },
      {
        title: '经济数据解读报告',
        source: '研究报告',
        url: 'https://example.com/news/3',
        summary: '最新经济数据显示通胀压力有所缓解，但仍需关注后续发展趋势。',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        relevance: 0.78,
        tags: ['经济数据', '通胀', '分析']
      }
    ];
    
    return NextResponse.json({
      results: mockResults,
      timestamp: new Date().toISOString(),
      isMock: true
    });
  }
}

/**
 * 获取搜索历史
 * GET /api/search
 */
export async function GET() {
  return NextResponse.json({
    recentQueries: [
      '美联储降息概率',
      '国际油价走势',
      '人民币汇率',
      '中美贸易关系'
    ],
    trending: [
      '美联储利率决议',
      '全球通胀数据',
      '地缘政治风险'
    ]
  });
}
