/**
 * 知识冲突检测 API
 * 手动触发冲突检测，扫描现有知识库中的冲突
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface KnowledgeConflict {
  id: string;
  type: 'entity_conflict' | 'relation_conflict' | 'fact_conflict' | 'value_conflict';
  existingKnowledge: {
    id?: string;
    content?: string;
    source?: string;
    createdAt?: string;
  };
  newKnowledge: {
    content?: string;
    source?: string;
    sourceCaseId?: string;
  };
  conflictDescription: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected' | 'merged' | 'expired';
  createdAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '数据库连接失败' }, { status: 500 });
    }

    const conflicts: KnowledgeConflict[] = [];

    // 1. 检测关系方向冲突（A→B 和 B→A 同时存在且关系类型冲突）
    const { data: relations } = await supabase
      .from('kg_relations')
      .select(`
        id, type, confidence, source_entity_id, target_entity_id
      `)
      .is('valid_to', null);

    if (relations && relations.length > 0) {
      // 获取所有实体名称
      const entityIds = new Set<string>();
      relations.forEach((r: any) => {
        if (r.source_entity_id) entityIds.add(r.source_entity_id);
        if (r.target_entity_id) entityIds.add(r.target_entity_id);
      });

      const { data: entitiesData } = await supabase
        .from('kg_entities')
        .select('id, name')
        .in('id', Array.from(entityIds));

      const entityNameMap = new Map<string, string>();
      (entitiesData || []).forEach((e: any) => {
        entityNameMap.set(e.id, e.name);
      });

      // 构建关系索引
      const relationMap = new Map<string, any[]>();
      
      for (const r of relations) {
        const sourceName = entityNameMap.get(r.source_entity_id) || '';
        const targetName = entityNameMap.get(r.target_entity_id) || '';
        
        // 跳过无效关系（缺少实体名称）
        if (!sourceName || !targetName) continue;
        
        const key = `${sourceName}_${targetName}`;
        if (!relationMap.has(key)) {
          relationMap.set(key, []);
        }
        relationMap.get(key)!.push({ ...r, sourceName, targetName });
      }

      // 检测反向冲突
      for (const [key, rels] of relationMap) {
        const parts = key.split('_');
        if (parts.length < 2) continue;
        
        const sourceName = parts[0];
        const targetName = parts.slice(1).join('_'); // 处理名称中可能有下划线的情况
        const reverseKey = `${targetName}_${sourceName}`;
        const reverseRels = relationMap.get(reverseKey);

        if (reverseRels && rels.length > 0 && reverseRels.length > 0) {
          // 检查是否存在冲突的关系类型
          const conflictTypes = ['竞争', '控股', '投资', '监管'];
          
          for (const r1 of rels) {
            for (const r2 of reverseRels) {
              if (conflictTypes.includes(r1.type) && conflictTypes.includes(r2.type)) {
                // 检查是否已经记录了这个冲突
                const { data: existing } = await supabase
                  .from('knowledge_patterns')
                  .select('id')
                  .eq('pattern_type', 'knowledge_conflict')
                  .eq('pattern_data->existingKnowledge->id', r1.id)
                  .eq('pattern_data->newKnowledge->content', `${r2.sourceName} → ${r2.targetName} (${r2.type})`)
                  .maybeSingle();

                if (!existing) {
                  conflicts.push({
                    id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    type: 'relation_conflict',
                    existingKnowledge: {
                      id: r1.id,
                      content: `${r1.sourceName} → ${r1.targetName} (${r1.type})`,
                      source: '知识图谱',
                      createdAt: r1.created_at,
                    },
                    newKnowledge: {
                      content: `${r2.sourceName} → ${r2.targetName} (${r2.type})`,
                      source: '知识图谱',
                    },
                    conflictDescription: `发现反向关系冲突：${r1.sourceName} ${r1.type} ${r1.targetName} vs ${r2.sourceName} ${r2.type} ${r2.targetName}`,
                    severity: 'high',
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                  });
                }
              }
            }
          }
        }
      }
    }

    // 2. 检测实体重复（同名但不同ID）
    const { data: entities } = await supabase
      .from('kg_entities')
      .select('id, name, type, description')
      .order('name');

    if (entities && entities.length > 0) {
      const nameMap = new Map<string, any[]>();
      
      for (const e of entities) {
        const normalizedName = e.name.toLowerCase().trim();
        if (!nameMap.has(normalizedName)) {
          nameMap.set(normalizedName, []);
        }
        nameMap.get(normalizedName)!.push(e);
      }

      // 检测重复实体
      for (const [name, duplicates] of nameMap) {
        if (duplicates.length > 1) {
          // 检查是否已经记录
          const { data: existing } = await supabase
            .from('knowledge_patterns')
            .select('id')
            .eq('pattern_type', 'knowledge_conflict')
            .eq('pattern_data->type', 'entity_conflict')
            .ilike('pattern_data->existingKnowledge->content', `%${name}%`)
            .maybeSingle();

          if (!existing) {
            conflicts.push({
              id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              type: 'entity_conflict',
              existingKnowledge: {
                id: duplicates[0].id,
                content: `${duplicates[0].name} (${duplicates[0].type})`,
                source: '知识图谱',
                createdAt: duplicates[0].created_at,
              },
              newKnowledge: {
                content: `发现 ${duplicates.length - 1} 个重复: ${duplicates.slice(1).map(d => `${d.name}(${d.type})`).join(', ')}`,
                source: '知识图谱',
              },
              conflictDescription: `发现实体重复："${name}" 存在 ${duplicates.length} 个版本，建议合并`,
              severity: 'medium',
              status: 'pending',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // 3. 存储冲突记录
    let storedCount = 0;
    for (const conflict of conflicts) {
      const { error } = await supabase
        .from('knowledge_patterns')
        .insert({
          id: conflict.id,
          pattern_type: 'knowledge_conflict',
          name: `冲突: ${conflict.type}`,
          description: conflict.conflictDescription,
          pattern_data: {
            type: conflict.type,
            existingKnowledge: conflict.existingKnowledge,
            newKnowledge: conflict.newKnowledge,
            severity: conflict.severity,
            status: conflict.status,
          },
          confidence: conflict.severity === 'high' ? 0.9 : conflict.severity === 'medium' ? 0.7 : 0.5,
          is_verified: false,
        });

      if (!error) {
        storedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `检测完成，发现 ${conflicts.length} 个潜在冲突，已存储 ${storedCount} 条`,
      detected: conflicts.length,
      stored: storedCount,
      conflicts: conflicts.slice(0, 10), // 返回前10个作为预览
    });

  } catch (error) {
    console.error('[Conflict Detection API] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
