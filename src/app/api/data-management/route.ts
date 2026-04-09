import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseVectorStore } from '@/lib/vector/supabase-vector-store';
import { getSupabaseRecommendationKnowledgeManager } from '@/lib/recommendation/supabase-knowledge-integration';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { getSupabaseKnowledgeGraph } from '@/lib/graph/supabase-knowledge-graph';

// 获取所有服务的统计信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 获取统计信息
    if (action === 'stats') {
      const [vectorStats, knowledgeStats, memoryStats, graphStats] = await Promise.all([
        getSupabaseVectorStore().getStats(),
        getSupabaseRecommendationKnowledgeManager().getStats(),
        getSupabaseRecommendationMemoryManager().getStats(),
        getSupabaseKnowledgeGraph().getStats()
      ]);

      return NextResponse.json({
        success: true,
        data: {
          vectorStore: vectorStats,
          knowledge: knowledgeStats,
          memory: memoryStats,
          graph: graphStats
        }
      });
    }

    // 导出数据
    if (action === 'export') {
      const service = searchParams.get('service');
      const options = JSON.parse(searchParams.get('options') || '{}');

      let result;

      switch (service) {
        case 'vector':
          result = await getSupabaseVectorStore().exportData(options);
          break;
        case 'knowledge':
          result = await getSupabaseRecommendationKnowledgeManager().exportData(options);
          break;
        case 'memory':
          result = await getSupabaseRecommendationMemoryManager().exportData(options);
          break;
        case 'graph':
          result = await getSupabaseKnowledgeGraph().exportData(options);
          break;
        default:
          return NextResponse.json(
            { success: false, error: 'Unknown service' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        data: result
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Data Management API] GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// 导入数据
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 导入数据
    if (action === 'import') {
      const body = await request.json();
      const { service, data, options } = body;

      let result;

      switch (service) {
        case 'vector':
          result = await getSupabaseVectorStore().importData(data, options);
          break;
        case 'knowledge':
          result = await getSupabaseRecommendationKnowledgeManager().importData(data, options);
          break;
        case 'memory':
          result = await getSupabaseRecommendationMemoryManager().importData(data, options);
          break;
        case 'graph':
          result = await getSupabaseKnowledgeGraph().importData(data, options);
          break;
        default:
          return NextResponse.json(
            { success: false, error: 'Unknown service' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // 清空数据
    if (action === 'clear') {
      const body = await request.json();
      const { service, options } = body;

      if (!options?.confirm) {
        return NextResponse.json(
          { success: false, error: 'Confirmation required (set confirm: true)' },
          { status: 400 }
        );
      }

      let result;

      switch (service) {
        case 'vector':
          result = { deleted: await getSupabaseVectorStore().clearAll(options) };
          break;
        case 'knowledge':
          result = { deleted: await getSupabaseRecommendationKnowledgeManager().clearAll(options) };
          break;
        case 'memory':
          result = await getSupabaseRecommendationMemoryManager().clearAll(options);
          break;
        case 'graph':
          result = await getSupabaseKnowledgeGraph().clearAll(options);
          break;
        default:
          return NextResponse.json(
            { success: false, error: 'Unknown service' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        data: result
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Data Management API] POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
