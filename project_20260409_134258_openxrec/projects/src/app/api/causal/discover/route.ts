/**
 * 因果发现API
 * 从文本中发现因果关系
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCausalDiscoveryEngine } from '@/lib/causal/discovery-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, domain, searchResults } = body;
    
    if (!text && !searchResults) {
      return NextResponse.json(
        { error: '请提供文本内容或搜索结果' },
        { status: 400 }
      );
    }
    
    const discoveryEngine = createCausalDiscoveryEngine();
    
    let result;
    if (searchResults && Array.isArray(searchResults)) {
      result = await discoveryEngine.discoverFromSearchResults(searchResults, domain);
    } else {
      result = await discoveryEngine.discoverFromText(text, { domain });
    }
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API /causal/discover] Error:', error);
    return NextResponse.json(
      { error: '因果发现失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
