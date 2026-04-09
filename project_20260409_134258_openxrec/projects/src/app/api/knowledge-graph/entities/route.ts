/**
 * 知识图谱浏览 API
 * 
 * GET /api/knowledge-graph?action=entities - 获取实体列表
 * GET /api/knowledge-graph?action=relations - 获取关系列表
 * GET /api/knowledge-graph?action=duplicates - 检测重复实体
 * POST /api/knowledge-graph - 合并实体等操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { duplicateDetector } from '@/lib/knowledge/duplicate-detector';

// ==================== GET 处理器 ====================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'entities':
        return await handleGetEntities(searchParams);
      case 'relations':
        return await handleGetRelations(searchParams);
      case 'duplicates':
        return await handleDetectDuplicates(searchParams);
      case 'entity':
        return await handleGetEntity(searchParams);
      case 'stats':
        return await handleGetStats();
      case 'search':
        return await handleSearchByTopic(searchParams);
      default:
        // 如果没有指定 action，检查是否有 topic 参数（兼容旧版 API）
        const topic = searchParams.get('topic');
        if (topic) {
          return await handleSearchByTopic(searchParams);
        }
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[KnowledgeGraph API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ==================== POST 处理器 ====================

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, payload } = body;

  try {
    switch (action) {
      case 'merge-entities':
        return await handleMergeEntities(payload);
      case 'delete-entity':
        return await handleDeleteEntity(payload);
      case 'delete-relation':
        return await handleDeleteRelation(payload);
      case 'update-entity':
        return await handleUpdateEntity(payload);
      case 'update-relation':
        return await handleUpdateRelation(payload);
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[KnowledgeGraph API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ==================== 处理函数 ====================

/**
 * 获取实体列表
 */
async function handleGetEntities(searchParams: URLSearchParams) {
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const type = searchParams.get('type');
  const search = searchParams.get('search');

  let query = supabase
    .from('kg_entities')
    .select('*', { count: 'exact' });

  // 类型筛选
  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  // 搜索
  if (search) {
    query = query.or(`name.ilike.%${search}%,aliases.cs.["${search}"]`);
  }

  // 分页
  query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
  }

  // 获取每个实体的关系数量
  const entityIds = (data || []).map((e: any) => e.id);
  const { data: relationCounts } = await supabase
    .from('kg_relations')
    .select('source_entity_id, target_entity_id')
    .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`);

  // 计算关系数量
  const countMap = new Map<string, number>();
  (relationCounts || []).forEach((r: any) => {
    countMap.set(r.source_entity_id, (countMap.get(r.source_entity_id) || 0) + 1);
    countMap.set(r.target_entity_id, (countMap.get(r.target_entity_id) || 0) + 1);
  });

  // 格式化输出
  const entities = (data || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    aliases: e.aliases || [],
    description: e.description,
    source: e.source,
    confidence: e.confidence,
    properties: e.properties,
    relationCount: countMap.get(e.id) || 0,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }));

  return NextResponse.json({
    success: true,
    entities,
    total: count || 0,
    limit,
    offset,
  });
}

/**
 * 获取关系列表
 */
async function handleGetRelations(searchParams: URLSearchParams) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const type = searchParams.get('type');
  const entityId = searchParams.get('entityId');

  let query = supabase
    .from('kg_relations')
    .select(`
      *,
      source_entity:kg_entities!source_entity_id(id, name, type),
      target_entity:kg_entities!target_entity_id(id, name, type)
    `, { count: 'exact' });

  // 类型筛选
  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  // 实体筛选
  if (entityId) {
    query = query.or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`);
  }

  // 分页
  query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch relations' }, { status: 500 });
  }

  // 格式化输出
  const relations = (data || []).map((r: any) => ({
    id: r.id,
    source_entity_id: r.source_entity_id,
    source_entity_name: r.source_entity?.name,
    source_entity_type: r.source_entity?.type,
    target_entity_id: r.target_entity_id,
    target_entity_name: r.target_entity?.name,
    target_entity_type: r.target_entity?.type,
    type: r.type,
    description: r.description,
    confidence: r.confidence,
    source: r.source,
    properties: r.properties,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({
    success: true,
    relations,
    total: count || 0,
    limit,
    offset,
  });
}

/**
 * 检测重复实体
 */
async function handleDetectDuplicates(searchParams: URLSearchParams) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const threshold = parseFloat(searchParams.get('threshold') || '0.7');

  // 获取所有实体
  const { data: entities, error } = await supabase
    .from('kg_entities')
    .select('id, name, type, aliases');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
  }

  // 执行检测
  const duplicates = await duplicateDetector.detect(
    (entities || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      aliases: e.aliases,
    }))
  );

  // 过滤阈值
  const filtered = duplicates.filter(d => d.similarity >= threshold);

  return NextResponse.json({
    success: true,
    duplicates: filtered,
    total: filtered.length,
  });
}

/**
 * 获取单个实体详情
 */
async function handleGetEntity(searchParams: URLSearchParams) {
  const supabase = getSupabaseClient();
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Entity ID is required' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { data: entity, error: entityError } = await supabase
    .from('kg_entities')
    .select('*')
    .eq('id', id)
    .single();

  if (entityError) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // 获取相关关系
  const { data: relations } = await supabase
    .from('kg_relations')
    .select(`
      *,
      source_entity:kg_entities!source_entity_id(id, name, type),
      target_entity:kg_entities!target_entity_id(id, name, type)
    `)
    .or(`source_entity_id.eq.${id},target_entity_id.eq.${id}`);

  return NextResponse.json({
    success: true,
    entity: {
      ...entity,
      relations: relations || [],
    },
  });
}

/**
 * 获取统计信息
 */
async function handleGetStats() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  // 实体统计
  const { count: entityCount } = await supabase
    .from('kg_entities')
    .select('*', { count: 'exact', head: true });

  // 关系统计
  const { count: relationCount } = await supabase
    .from('kg_relations')
    .select('*', { count: 'exact', head: true });

  // 实体类型分布
  const { data: entityTypeData } = await supabase
    .from('kg_entities')
    .select('type');

  const entityTypeDistribution: Record<string, number> = {};
  (entityTypeData || []).forEach((e: any) => {
    entityTypeDistribution[e.type] = (entityTypeDistribution[e.type] || 0) + 1;
  });

  // 关系类型分布
  const { data: relationTypeData } = await supabase
    .from('kg_relations')
    .select('type');

  const relationTypeDistribution: Record<string, number> = {};
  (relationTypeData || []).forEach((r: any) => {
    relationTypeDistribution[r.type] = (relationTypeDistribution[r.type] || 0) + 1;
  });

  return NextResponse.json({
    success: true,
    stats: {
      entityCount: entityCount || 0,
      relationCount: relationCount || 0,
      entityTypeDistribution,
      relationTypeDistribution,
    },
  });
}

/**
 * 按主题搜索知识图谱（兼容旧版 API）
 * 支持通过 topic 参数搜索相关实体和关系
 */
async function handleSearchByTopic(searchParams: URLSearchParams) {
  const supabase = getSupabaseClient();
  const topic = searchParams.get('topic');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!topic) {
    return NextResponse.json({ error: 'Topic parameter is required' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ entities: [], relations: [] });
  }

  console.log(`[KnowledgeGraph API] Searching for topic: ${topic}`);

  // 1. 搜索相关实体（通过名称或别名匹配）
  const { data: entities, error: entityError } = await supabase
    .from('kg_entities')
    .select('*')
    .or(`name.ilike.%${topic}%,description.ilike.%${topic}%`)
    .order('importance', { ascending: false })
    .limit(limit);

  if (entityError) {
    console.error('[KnowledgeGraph API] Entity search error:', entityError);
    return NextResponse.json({ entities: [], relations: [] });
  }

  // 收集所有实体
  let finalEntities = entities || [];
  const entityIdSet = new Set(finalEntities.map((e: any) => e.id));
  
  // 分词搜索 - 提取关键词进行更宽泛的搜索
  // 移除常见无意义词，提取核心关键词
  const stopWords = ['的', '与', '和', '及', '以及', '对', '为', '等', '中', '在', '是', '有', '了', '上', '下', '走势', '趋势', '情况', '分析', '相关', '影响', '变化'];
  
  // 改进分词逻辑：支持连续中文字符的分解
  const extractKeywords = (text: string): string[] => {
    const keywords: Set<string> = new Set();
    
    // 1. 按分隔符分词
    const parts = text.split(/[\s,，、；;]+/);
    for (const part of parts) {
      if (part.length >= 2 && !stopWords.includes(part)) {
        keywords.add(part);
      }
    }
    
    // 2. 对于连续的中文字符串，提取 2-4 字的子串
    const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseChars) {
      // 提取 2-4 字的滑动窗口
      for (let len = 2; len <= 4; len++) {
        for (let i = 0; i <= segment.length - len; i++) {
          const sub = segment.substring(i, i + len);
          if (!stopWords.includes(sub)) {
            keywords.add(sub);
          }
        }
      }
    }
    
    return Array.from(keywords);
  };
  
  const keywords = extractKeywords(topic);
  console.log(`[KnowledgeGraph API] Extracted keywords: ${keywords.join(', ')}`);
  
  // 对每个关键词进行搜索
  for (const word of keywords.slice(0, 8)) {
    const { data: partialEntities } = await supabase
      .from('kg_entities')
      .select('*')
      .or(`name.ilike.%${word}%,description.ilike.%${word}%`)
      .order('importance', { ascending: false })
      .limit(30);
    
    if (partialEntities && partialEntities.length > 0) {
      for (const e of partialEntities) {
        if (!entityIdSet.has(e.id)) {
          entityIdSet.add(e.id);
          finalEntities.push(e);
        }
      }
    }
  }
  
  // 如果仍然没有找到足够多的实体，尝试更短的词
  if (finalEntities.length < 10) {
    // 提取2-3字的关键词
    const shortWords = topic.split('').filter(w => w.length >= 1);
    for (const word of shortWords.slice(0, 3)) {
      if (word.length < 2) continue;
      const { data: partialEntities } = await supabase
        .from('kg_entities')
        .select('*')
        .or(`name.ilike.%${word}%,description.ilike.%${word}%`)
        .order('importance', { ascending: false })
        .limit(20);
      
      if (partialEntities && partialEntities.length > 0) {
        for (const e of partialEntities) {
          if (!entityIdSet.has(e.id)) {
            entityIdSet.add(e.id);
            finalEntities.push(e);
          }
        }
      }
    }
  }

  console.log(`[KnowledgeGraph API] Found ${finalEntities.length} entities for topic: ${topic}`);

  // 如果关键词匹配结果不足，补充高重要度实体
  if (finalEntities.length < 20) {
    console.log('[KnowledgeGraph API] Keywords matched few entities, supplementing with high-importance entities...');
    
    // 获取高重要度的实体作为补充
    const { data: topEntities } = await supabase
      .from('kg_entities')
      .select('*')
      .order('importance', { ascending: false })
      .limit(50);
    
    if (topEntities) {
      for (const e of topEntities) {
        if (!entityIdSet.has(e.id)) {
          entityIdSet.add(e.id);
          finalEntities.push(e);
        }
      }
    }
    
    console.log(`[KnowledgeGraph API] After supplementing: ${finalEntities.length} entities`);
  }

  // 2. 获取相关关系
  const entityIds = finalEntities.map((e: any) => e.id);
  let relations: any[] = [];

  if (entityIds.length > 0) {
    const { data: relationData, error: relationError } = await supabase
      .from('kg_relations')
      .select(`
        *,
        source_entity:kg_entities!source_entity_id(id, name, type),
        target_entity:kg_entities!target_entity_id(id, name, type)
      `)
      .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`)
      .order('confidence', { ascending: false })
      .limit(100);

    if (!relationError && relationData) {
      relations = relationData.map((r: any) => ({
        id: r.id,
        source_entity_id: r.source_entity_id,
        target_entity_id: r.target_entity_id,
        source_name: r.source_entity?.name,
        target_name: r.target_entity?.name,
        type: r.type,
        confidence: r.confidence,
        evidence: r.evidence,
        verified: r.verified,
        source_type: r.source_type || 'llm',
      }));
    }
  }

  // 3. 扩展：获取关系关联的额外实体（一跳扩展）
  const relationEntityIds = new Set(entityIds);
  relations.forEach((r: any) => {
    relationEntityIds.add(r.source_entity_id);
    relationEntityIds.add(r.target_entity_id);
  });

  // 获取额外实体
  const extraEntityIds = [...relationEntityIds].filter(id => !entityIds.includes(id));
  if (extraEntityIds.length > 0 && extraEntityIds.length <= 50) {
    const { data: extraEntities } = await supabase
      .from('kg_entities')
      .select('*')
      .in('id', extraEntityIds);

    if (extraEntities) {
      finalEntities = [...finalEntities, ...extraEntities];
    }
  }

  // 格式化实体
  const formattedEntities = finalEntities.map((e: any) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    importance: e.importance || 0.5,
    description: e.description,
    aliases: e.aliases || [],
    verified: e.verified,
    source_type: e.source_type || 'llm',
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));

  console.log(`[KnowledgeGraph API] Returning ${formattedEntities.length} entities, ${relations.length} relations`);

  return NextResponse.json({
    entities: formattedEntities,
    relations,
    topic,
  });
}

/**
 * 合并实体
 */
async function handleMergeEntities(payload: {
  primaryEntityId: string;
  entityIdsToMerge: string[];
  newAliases?: string[];
}) {
  const supabase = getSupabaseClient();
  const { primaryEntityId, entityIdsToMerge, newAliases = [] } = payload;

  if (!primaryEntityId || !entityIdsToMerge || entityIdsToMerge.length === 0) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  // 1. 更新主实体的别名
  const { data: primaryEntity } = await supabase
    .from('kg_entities')
    .select('aliases')
    .eq('id', primaryEntityId)
    .single();

  const currentAliases = primaryEntity?.aliases || [];
  const updatedAliases = [...new Set([...currentAliases, ...newAliases])];

  await supabase
    .from('kg_entities')
    .update({ aliases: updatedAliases, updated_at: new Date().toISOString() })
    .eq('id', primaryEntityId);

  // 2. 转移关系
  for (const entityId of entityIdsToMerge) {
    // 更新源关系
    await supabase
      .from('kg_relations')
      .update({ source_entity_id: primaryEntityId })
      .eq('source_entity_id', entityId);

    // 更新目标关系
    await supabase
      .from('kg_relations')
      .update({ target_entity_id: primaryEntityId })
      .eq('target_entity_id', entityId);
  }

  // 3. 删除被合并的实体
  await supabase
    .from('kg_entities')
    .delete()
    .in('id', entityIdsToMerge);

  return NextResponse.json({
    success: true,
    message: `Merged ${entityIdsToMerge.length} entities into ${primaryEntityId}`,
  });
}

/**
 * 删除实体
 */
async function handleDeleteEntity(payload: { id: string }) {
  const supabase = getSupabaseClient();
  const { id } = payload;

  if (!id) {
    return NextResponse.json({ error: 'Entity ID is required' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  // 删除相关关系
  await supabase
    .from('kg_relations')
    .delete()
    .or(`source_entity_id.eq.${id},target_entity_id.eq.${id}`);

  // 删除实体
  const { error } = await supabase
    .from('kg_entities')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete entity' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * 删除关系
 */
async function handleDeleteRelation(payload: { id: string }) {
  const supabase = getSupabaseClient();
  const { id } = payload;

  if (!id) {
    return NextResponse.json({ error: 'Relation ID is required' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { error } = await supabase
    .from('kg_relations')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete relation' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * 更新实体
 */
async function handleUpdateEntity(payload: { id: string; data: any }) {
  const supabase = getSupabaseClient();
  const { id, data } = payload;

  if (!id || !data) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { error } = await supabase
    .from('kg_entities')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update entity' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * 更新关系
 */
async function handleUpdateRelation(payload: { id: string; data: any }) {
  const supabase = getSupabaseClient();
  const { id, data } = payload;

  if (!id || !data) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const { error } = await supabase
    .from('kg_relations')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update relation' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
