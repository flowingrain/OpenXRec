/**
 * 知识演化 API
 * 提供演化历史查询和统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeEvolutionService } from '@/lib/knowledge-graph/evolution-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'stats';
    
    switch (action) {
      case 'stats': {
        // 获取演化统计
        const stats = await knowledgeEvolutionService.getEvolutionStats();
        return NextResponse.json({
          success: true,
          data: stats
        });
      }
      
      case 'entity_history': {
        // 获取实体的演化历史
        const entityId = searchParams.get('entityId');
        if (!entityId) {
          return NextResponse.json(
            { success: false, error: '缺少 entityId 参数' },
            { status: 400 }
          );
        }
        
        const history = await knowledgeEvolutionService.getEntityEvolutionHistory(entityId);
        return NextResponse.json({
          success: true,
          data: history
        });
      }
      
      case 'relation_timeline': {
        // 获取关系的时间线
        const relationId = searchParams.get('relationId');
        if (!relationId) {
          return NextResponse.json(
            { success: false, error: '缺少 relationId 参数' },
            { status: 400 }
          );
        }
        
        const timeline = await knowledgeEvolutionService.getRelationTimeline(relationId);
        return NextResponse.json({
          success: true,
          data: timeline
        });
      }
      
      case 'batch_expiration': {
        // 批量设置有效期
        const result = await knowledgeEvolutionService.batchSetExpiration();
        return NextResponse.json({
          success: true,
          data: result
        });
      }
      
      case 'cleanup_expired': {
        // 清理过期关系
        const result = await knowledgeEvolutionService.cleanupExpiredRelations();
        return NextResponse.json({
          success: true,
          data: result
        });
      }
      
      default:
        return NextResponse.json(
          { success: false, error: '未知操作' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('[Knowledge Evolution API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
    
    switch (action) {
      case 'record': {
        // 手动记录演化事件
        const result = await knowledgeEvolutionService.recordEvolution({
          relation_id: data.relationId,
          entity_id: data.entityId,
          evolution_type: data.evolutionType,
          old_value: data.oldValue,
          new_value: data.newValue,
          reason: data.reason,
          triggered_by: 'manual'
        });
        
        return NextResponse.json({
          success: result,
          message: result ? '记录成功' : '记录失败'
        });
      }
      
      default:
        return NextResponse.json(
          { success: false, error: '未知操作' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('[Knowledge Evolution API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
