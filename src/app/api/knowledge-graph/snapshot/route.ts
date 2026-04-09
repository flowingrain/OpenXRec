/**
 * 知识图谱快照 API
 * 用于保存和加载知识图谱快照，支持复盘分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

function getSupabase() {
  try {
    return getSupabaseClient();
  } catch {
    return null;
  }
}

/**
 * GET /api/knowledge-graph/snapshot
 * 获取快照列表或单个快照详情
 * 
 * 参数：
 * - id: 快照ID（可选，不传则返回列表）
 * - caseId: 关联案例ID（可选，筛选特定案例的快照）
 * - limit: 返回数量限制（默认20）
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const snapshotId = searchParams.get('id');
    const caseId = searchParams.get('caseId');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // 获取单个快照详情
    if (snapshotId) {
      const { data, error } = await supabase
        .from('kg_snapshots')
        .select(`
          *,
          creator:profiles(name)
        `)
        .eq('id', snapshotId)
        .single();
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      if (!data) {
        return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
      }
      
      return NextResponse.json({ snapshot: data });
    }
    
    // 获取快照列表
    let query = supabase
      .from('kg_snapshots')
      .select(`
        id,
        name,
        description,
        case_id,
        entity_count,
        relation_count,
        created_at,
        created_by,
        creator:profiles(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (caseId) {
      query = query.eq('case_id', caseId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ snapshots: data });
    
  } catch (error) {
    console.error('Get snapshots error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/knowledge-graph/snapshot
 * 创建知识图谱快照
 * 
 * 请求体：
 * {
 *   name: string;           // 快照名称
 *   description?: string;   // 快照描述
 *   caseId?: string;        // 关联案例ID
 *   entities: KGEntity[];   // 实体数据
 *   relations: KGRelation[]; // 关系数据
 *   metadata?: object;      // 元数据（分析主题、时间等）
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  try {
    const body = await request.json();
    const { name, description, caseId, entities, relations, metadata } = body;
    
    if (!name || !entities || !relations) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, entities, relations' 
      }, { status: 400 });
    }
    
    // 创建快照
    const { data, error } = await supabase
      .from('kg_snapshots')
      .insert({
        name,
        description,
        case_id: caseId,
        entities,
        relations,
        metadata,
        entity_count: entities.length,
        relation_count: relations.length
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: 'Snapshot created successfully',
      snapshot: data 
    });
    
  } catch (error) {
    console.error('Create snapshot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/knowledge-graph/snapshot
 * 删除快照
 * 
 * 请求体：
 * {
 *   id: string;  // 快照ID
 * }
 */
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase();
  
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  
  try {
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Snapshot ID required' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('kg_snapshots')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'Snapshot deleted successfully' });
    
  } catch (error) {
    console.error('Delete snapshot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
