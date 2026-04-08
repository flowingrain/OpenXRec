/**
 * 知识冲突管理 API
 * 
 * GET    - 获取待确认冲突列表
 * POST   - 处理冲突确认（确认/拒绝/合并）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 获取待确认冲突列表
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '数据库连接失败' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('knowledge_patterns')
      .select('*')
      .eq('pattern_type', 'knowledge_conflict')
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const conflicts = (data || []).map((item: any) => ({
      id: item.id,
      type: item.pattern_data?.type || 'entity_conflict',
      existingKnowledge: item.pattern_data?.existingKnowledge || {},
      newKnowledge: item.pattern_data?.newKnowledge || {},
      conflictDescription: item.description,
      severity: item.pattern_data?.severity || 'medium',
      status: item.pattern_data?.status || 'pending',
      createdAt: item.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: conflicts,
      total: conflicts.length,
    });
  } catch (error) {
    console.error('[KnowledgeConflicts API] GET error:', error);
    return NextResponse.json({ success: false, error: '获取冲突列表失败' }, { status: 500 });
  }
}

/**
 * 处理冲突确认
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '数据库连接失败' }, { status: 500 });
    }

    const body = await request.json();
    const { conflictId, action, resolution, userId } = body;

    if (!conflictId || !action) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    // 获取冲突详情
    const { data: conflict, error: fetchError } = await supabase
      .from('knowledge_patterns')
      .select('*')
      .eq('id', conflictId)
      .single();

    if (fetchError || !conflict) {
      return NextResponse.json({ success: false, error: '冲突不存在' }, { status: 404 });
    }

    const patternData = conflict.pattern_data || {};
    let result = { success: true, message: '' };

    switch (action) {
      case 'approve':
        // 批准新知识
        await handleApprove(supabase, conflict, patternData, userId, resolution);
        result.message = '已批准新知识';
        break;

      case 'reject':
        // 拒绝新知识，保留原有知识
        await handleReject(supabase, conflictId, userId, resolution);
        result.message = '已拒绝新知识';
        break;

      case 'merge':
        // 合并知识
        await handleMerge(supabase, conflict, patternData, userId, resolution);
        result.message = '已合并知识';
        break;

      default:
        return NextResponse.json({ success: false, error: '无效的操作类型' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[KnowledgeConflicts API] POST error:', error);
    return NextResponse.json({ success: false, error: '处理冲突失败' }, { status: 500 });
  }
}

/**
 * 处理批准操作
 */
async function handleApprove(
  supabase: any,
  conflict: any,
  patternData: any,
  userId: string,
  resolution?: string
) {
  const newKnowledge = patternData.newKnowledge;
  const existingKnowledge = patternData.existingKnowledge;

  // 更新冲突状态
  await supabase
    .from('knowledge_patterns')
    .update({
      is_verified: true,
      pattern_data: {
        ...patternData,
        status: 'approved',
        resolution,
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
      },
    })
    .eq('id', conflict.id);

  // 根据冲突类型更新知识图谱
  if (patternData.type === 'entity_conflict') {
    // 更新实体：使用 existingKnowledge.id 来定位实体
    if (existingKnowledge?.id) {
      const { error } = await supabase
        .from('kg_entities')
        .update({
          verified: true,
          source_type: 'expert_verified',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingKnowledge.id);
      
      if (error) {
        console.error('[handleApprove] 更新实体失败:', error);
      } else {
        console.log('[handleApprove] 实体已标记为已验证:', existingKnowledge.id);
      }
    }
  } else if (patternData.type === 'relation_conflict') {
    // 更新关系：使用 existingKnowledge.id 来定位关系
    if (existingKnowledge?.id) {
      const { error } = await supabase
        .from('kg_relations')
        .update({
          verified: true,
          source_type: 'expert_verified',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingKnowledge.id);
      
      if (error) {
        console.error('[handleApprove] 更新关系失败:', error);
      } else {
        console.log('[handleApprove] 关系已标记为已验证:', existingKnowledge.id);
      }
    }
  }
}

/**
 * 处理拒绝操作
 */
async function handleReject(
  supabase: any,
  conflictId: string,
  userId: string,
  resolution?: string
) {
  await supabase
    .from('knowledge_patterns')
    .update({
      is_verified: true,
      pattern_data: {
        status: 'rejected',
        resolution,
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
      },
    })
    .eq('id', conflictId);
}

/**
 * 处理合并操作
 */
async function handleMerge(
  supabase: any,
  conflict: any,
  patternData: any,
  userId: string,
  resolution?: string
) {
  const existing = patternData.existingKnowledge;
  const newK = patternData.newKnowledge;

  // 更新冲突状态
  await supabase
    .from('knowledge_patterns')
    .update({
      is_verified: true,
      pattern_data: {
        ...patternData,
        status: 'merged',
        resolution,
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
      },
    })
    .eq('id', conflict.id);

  // 合并知识（根据类型处理）
  if (patternData.type === 'entity_conflict') {
    const mergedDescription = [
      existing?.content || existing?.description,
      newK?.content || newK?.description,
    ]
      .filter(Boolean)
      .join('\n\n【补充】');

    await supabase
      .from('kg_entities')
      .update({
        description: mergedDescription,
        verified: true,
        source_type: 'expert_merged',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing?.id);
  }
}
