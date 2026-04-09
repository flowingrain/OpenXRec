/**
 * 知识清理 API
 * 
 * GET  - 获取知识库健康状态
 * POST - 执行清理任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeCleanupService, CleanupConfig } from '@/lib/knowledge/knowledge-cleanup-service';

export async function GET(request: NextRequest) {
  try {
    const service = new KnowledgeCleanupService();
    const healthStatus = await service.getHealthStatus();

    return NextResponse.json({
      success: true,
      data: healthStatus,
    });
  } catch (error) {
    console.error('[KnowledgeCleanup API] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取知识库健康状态失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const config: Partial<CleanupConfig> = {
      dryRun: body.dryRun ?? false,
      cleanExpiredRelations: body.cleanExpiredRelations ?? true,
      cleanExpiredConfirmations: body.cleanExpiredConfirmations ?? true,
      cleanUnverifiedEntities: body.cleanUnverifiedEntities ?? false,
      unverifiedEntityDays: body.unverifiedEntityDays ?? 90,
    };

    const service = new KnowledgeCleanupService(config);
    const result = await service.cleanup();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[KnowledgeCleanup API] POST error:', error);
    return NextResponse.json(
      { success: false, error: '执行清理任务失败' },
      { status: 500 }
    );
  }
}
