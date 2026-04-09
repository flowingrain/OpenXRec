/**
 * Supabase 健康检查 API
 * GET /api/supabase/health - 检查连接和表状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    // 获取 Supabase 客户端
    const supabase = getSupabaseClient();

    // 检查各表状态
    const tables = [
      'kg_entities',
      'kg_relations', 
      'kg_corrections',
      'kg_snapshots',
      'analysis_cases',
      'knowledge_docs',
      'user_preferences',
      'report_versions'
    ];

    const tableStatus: Record<string, { exists: boolean; count?: number; error?: string }> = {};

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          tableStatus[table] = { exists: false, error: error.message };
        } else {
          tableStatus[table] = { exists: true, count: count || 0 };
        }
      } catch (e: any) {
        tableStatus[table] = { exists: false, error: e.message };
      }
    }

    // 计算健康状态
    const existingTables = Object.values(tableStatus).filter(t => t.exists).length;
    const allTablesExist = existingTables === tables.length;

    return NextResponse.json({
      success: true,
      connection: 'ok',
      type: 'Coze 托管 Supabase',
      tables: tableStatus,
      summary: {
        total: tables.length,
        existing: existingTables,
        missing: tables.length - existingTables,
        healthy: allTablesExist
      },
      message: allTablesExist 
        ? '✅ Supabase 配置完成，所有表已创建'
        : `⚠️ 部分表未创建，请检查 schema.ts 并执行 db upgrade`
    });

  } catch (error: any) {
    console.error('[Supabase Health] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: 'Coze 托管 Supabase 未开通，请在 Coze 平台开通服务'
    }, { status: 500 });
  }
}
