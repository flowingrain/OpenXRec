/**
 * 知识使用统计API
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeUsageService } from '@/lib/knowledge/usage-service';

// GET: 获取使用统计
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entityId');
  const action = searchParams.get('action');

  try {
    if (entityId) {
      const stats = await knowledgeUsageService.getEntityUsageStats(entityId);
      return NextResponse.json({
        success: true,
        data: { stats },
      });
    }

    if (action === 'overview') {
      const overview = await knowledgeUsageService.getUsageOverview();
      return NextResponse.json({
        success: true,
        data: overview,
      });
    }

    if (action === 'top') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const topEntities = await knowledgeUsageService.getTopUsedEntities(limit);
      return NextResponse.json({
        success: true,
        data: { entities: topEntities },
      });
    }

    // 默认返回概览
    const overview = await knowledgeUsageService.getUsageOverview();
    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('[KnowledgeUsage API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST: 记录使用
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entityId, entityType, contextType, userId, metadata } = body;

    if (!entityId || !entityType || !contextType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await knowledgeUsageService.recordUsage({
      entityId,
      entityType,
      contextType,
      userId,
      metadata,
    });

    return NextResponse.json({
      success: true,
      message: 'Usage recorded',
    });
  } catch (error) {
    console.error('[KnowledgeUsage API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
