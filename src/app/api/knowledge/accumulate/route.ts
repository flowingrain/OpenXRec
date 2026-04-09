/**
 * 知识自动积累 API
 * 
 * 分析完成后自动触发：
 * 1. 存储案例到 analysis_cases 表
 * 2. 提取知识并存储到 knowledge_docs 表
 * 3. 存储知识图谱到 kg_entities 和 kg_relations 表
 * 4. 存储向量嵌入到向量库
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { vectorStorageService } from '@/lib/embedding/vector-storage-service';

interface AccumulationRequest {
  topic: string;
  caseId: string;
  query: string;
  domain: string;
  finalReport?: string;
  conclusion?: string;
  timeline?: any[];
  keyFactors?: any[];
  scenarios?: any[];
  causalChains?: any[];
  knowledgeGraph?: {
    entities: Array<{
      id: string;
      name: string;
      type: string;
      importance: number;
      description?: string;
    }>;
    relations: Array<{
      id: string;
      source: string;
      target: string;
      type: string;
      confidence: number;
      evidence?: string;
    }>;
  } | null;
  confidence?: number;
  agentOutputs?: Record<string, unknown>;
  searchResults?: any[];
  eventGraph?: any;  // 事件图谱（包含 nodes 和 edges）
}

export async function POST(request: NextRequest) {
  try {
    const body: AccumulationRequest = await request.json();
    const {
      topic,
      caseId,
      query,
      domain,
      finalReport,
      conclusion,
      timeline,
      keyFactors,
      scenarios,
      causalChains,
      knowledgeGraph,
      confidence,
      agentOutputs,
      searchResults,
      eventGraph  // 新增：事件图谱
    } = body;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ 
        success: false, 
        error: '数据库连接失败',
        data: null,
        errors: ['Supabase not available']
      }, { status: 500 });
    }

    const results = {
      caseStored: false,
      knowledgeStored: 0,
      entitiesStored: 0,
      relationsStored: 0,
      vectorsStored: 0,
    };

    const errors: string[] = [];

    // 1. 存储案例到数据库
    try {
      const { error: caseError } = await supabase
        .from('analysis_cases')
        .insert({
          id: caseId,
          query: topic,  // 数据库列名是 query，不是 topic
          domain,
          final_report: finalReport,
          conclusion,
          timeline: timeline || [],
          key_factors: keyFactors || [],
          scenarios: scenarios || [],
          causal_chains: causalChains || [],
          event_graph: eventGraph,  // 新增：保存事件图谱
          confidence: confidence?.toString() || '0.8',
          agent_outputs: {
            ...agentOutputs,
            search: searchResults || [],  // 搜索结果存储在 agent_outputs.search 中
          },
          tags: extractTags(topic, conclusion),
          created_at: new Date().toISOString(),
        });

      if (caseError) {
        errors.push(`案例存储失败: ${caseError.message}`);
      } else {
        results.caseStored = true;
        console.log(`[知识积累] 案例已存储: ${caseId}`);
      }
    } catch (e) {
      errors.push(`案例存储异常: ${String(e)}`);
    }

    // 2. 存储知识图谱（实体和关系）
    if (knowledgeGraph && knowledgeGraph.entities.length > 0) {
      try {
        const entityIdMap: Record<string, string> = {};

        // 存储实体
        for (const entity of knowledgeGraph.entities) {
          // 检查是否已存在
          const { data: existing } = await supabase
            .from('kg_entities')
            .select('id')
            .eq('name', entity.name)
            .maybeSingle();

          if (existing) {
            entityIdMap[entity.id] = existing.id;
          } else {
            const { data: newEntity, error } = await supabase
              .from('kg_entities')
              .insert({
                name: entity.name,
                type: entity.type || '其他',
                description: entity.description,
                importance: entity.importance?.toString() || '0.5',
                source_type: 'llm',
                verified: false,
              })
              .select('id')
              .single();

            if (newEntity && !error) {
              entityIdMap[entity.id] = newEntity.id;
              results.entitiesStored++;
            }
          }
        }

        // 存储关系
        if (knowledgeGraph.relations && knowledgeGraph.relations.length > 0) {
          for (const relation of knowledgeGraph.relations) {
            const sourceId = entityIdMap[relation.source];
            const targetId = entityIdMap[relation.target];

            if (!sourceId || !targetId) continue;

            // 检查是否已存在
            const { data: existing } = await supabase
              .from('kg_relations')
              .select('id')
              .eq('source_entity_id', sourceId)
              .eq('target_entity_id', targetId)
              .eq('type', relation.type)
              .is('valid_to', null)
              .maybeSingle();

            if (!existing) {
              const { error } = await supabase
                .from('kg_relations')
                .insert({
                  source_entity_id: sourceId,
                  target_entity_id: targetId,
                  type: relation.type,
                  confidence: relation.confidence?.toString() || '0.5',
                  evidence: relation.evidence,
                  source_type: 'llm',
                  verified: false,
                });

              if (!error) {
                results.relationsStored++;
              }
            }
          }
        }

        console.log(`[知识积累] 知识图谱已存储: ${results.entitiesStored} 实体, ${results.relationsStored} 关系`);
      } catch (e) {
        errors.push(`知识图谱存储异常: ${String(e)}`);
      }
    }

    // 3. 提取并存储知识条目到知识库
    try {
      const knowledgeItems = extractKnowledgeFromAnalysis({
        topic,
        conclusion,
        timeline,
        keyFactors,
        scenarios,
        causalChains,
      });

      for (const item of knowledgeItems) {
        const { error } = await supabase
          .from('knowledge_docs')
          .insert({
            title: item.title,
            content: item.content,
            type: item.type,
            metadata: {
              ...item.metadata,
              sourceCaseId: caseId,
              source: 'auto_extraction',
            },
            confidence: item.confidence?.toString() || '0.7',
            tags: item.tags || [],
            created_at: new Date().toISOString(),
          });

        if (!error) {
          results.knowledgeStored++;
        }
      }

      console.log(`[知识积累] 知识条目已存储: ${results.knowledgeStored} 条`);
    } catch (e) {
      errors.push(`知识存储异常: ${String(e)}`);
    }

    // 4. 存储向量嵌入（用于语义搜索）
    try {
      // 对结论进行嵌入 - 存储到知识库文档表
      if (conclusion && conclusion.length > 20) {
        // 先插入文档记录
        const { data: docData } = await supabase
          .from('knowledge_docs')
          .insert({
            title: `${topic} - 分析结论`,
            content: conclusion,
            type: 'case_conclusion',
            metadata: {
              sourceCaseId: caseId,
              source: 'auto_extraction',
              domain,
            },
            tags: ['结论', '自动提取'],
            confidence: '0.8',
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        // 然后为文档生成向量索引
        if (docData?.id) {
          await vectorStorageService.indexDocument(docData.id, conclusion);
          results.vectorsStored++;
        }
      }

      // 对关键因素进行嵌入
      if (keyFactors && keyFactors.length > 0) {
        for (let i = 0; i < Math.min(keyFactors.length, 3); i++) {
          const factor = keyFactors[i];
          if (factor.description || factor.factor) {
            const text = `${factor.factor}: ${factor.description || ''}`;
            const { data: docData } = await supabase
              .from('knowledge_docs')
              .insert({
                title: factor.factor,
                content: text,
                type: 'key_factor',
                metadata: {
                  sourceCaseId: caseId,
                  source: 'auto_extraction',
                  impact: factor.impact,
                },
                tags: ['关键因素'],
                confidence: (factor.weight || 0.7).toString(),
                created_at: new Date().toISOString(),
              })
              .select('id')
              .single();

            if (docData?.id) {
              await vectorStorageService.indexDocument(docData.id, text);
              results.vectorsStored++;
            }
          }
        }
      }

      console.log(`[知识积累] 向量嵌入已存储: ${results.vectorsStored} 条`);
    } catch (e) {
      // 向量存储失败不影响整体流程
      console.warn('[知识积累] 向量存储失败:', e);
      errors.push(`向量存储异常: ${String(e)}`);
    }

    return NextResponse.json({
      success: results.caseStored || results.knowledgeStored > 0 || results.entitiesStored > 0,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[知识积累 API] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      data: null,
      errors: [String(error)],
    }, { status: 500 });
  }
}

/**
 * 从主题和结论中提取标签
 */
function extractTags(topic: string, conclusion?: string | object | null): string[] {
  const tags: Set<string> = new Set();
  
  // 从主题中提取关键词
  const topicKeywords = topic.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  topicKeywords.forEach(k => tags.add(k));
  
  // 将 conclusion 转换为字符串
  let conclusionStr = '';
  if (conclusion) {
    if (typeof conclusion === 'string') {
      conclusionStr = conclusion;
    } else if (typeof conclusion === 'object') {
      // 如果是对象，尝试提取 summary 或转换为 JSON 字符串
      if ('summary' in conclusion && typeof (conclusion as any).summary === 'string') {
        conclusionStr = (conclusion as any).summary;
      } else {
        conclusionStr = JSON.stringify(conclusion);
      }
    }
  }
  
  // 预定义领域标签
  const domains = ['经济', '金融', '政策', '市场', '风险', '投资', '产业', '供应链'];
  domains.forEach(d => {
    if (topic.includes(d) || conclusionStr.includes(d)) {
      tags.add(d);
    }
  });
  
  return Array.from(tags).slice(0, 10);
}

/**
 * 从分析结果中提取知识条目
 */
function extractKnowledgeFromAnalysis(data: {
  topic: string;
  conclusion?: string | object | null;
  timeline?: any[];
  keyFactors?: any[];
  scenarios?: any[];
  causalChains?: any[];
}): Array<{
  title: string;
  content: string;
  type: string;
  confidence: number;
  tags: string[];
  metadata: Record<string, any>;
}> {
  const items: Array<{
    title: string;
    content: string;
    type: string;
    confidence: number;
    tags: string[];
    metadata: Record<string, any>;
  }> = [];

  // 将 conclusion 转换为字符串
  let conclusionStr = '';
  if (data.conclusion) {
    if (typeof data.conclusion === 'string') {
      conclusionStr = data.conclusion;
    } else if (typeof data.conclusion === 'object') {
      if ('summary' in data.conclusion && typeof (data.conclusion as any).summary === 'string') {
        conclusionStr = (data.conclusion as any).summary;
      } else {
        conclusionStr = JSON.stringify(data.conclusion);
      }
    }
  }

  // 从结论提取知识
  if (conclusionStr && conclusionStr.length > 50) {
    items.push({
      title: `${data.topic} - 分析结论`,
      content: conclusionStr,
      type: 'event',
      confidence: 0.8,
      tags: ['结论', '分析'],
      metadata: { source: 'conclusion' },
    });
  }

  // 从关键因素提取知识
  if (data.keyFactors && data.keyFactors.length > 0) {
    for (const factor of data.keyFactors.slice(0, 5)) {
      if (factor.factor && factor.description) {
        items.push({
          title: factor.factor,
          content: `${factor.description}。影响: ${factor.impact || '未知'}`,
          type: 'entity',
          confidence: factor.weight || 0.7,
          tags: ['关键因素', factor.impact || '影响'],
          metadata: { 
            source: 'key_factor',
            impact: factor.impact,
            weight: factor.weight 
          },
        });
      }
    }
  }

  // 从因果链提取知识
  if (data.causalChains && data.causalChains.length > 0) {
    for (const chain of data.causalChains.slice(0, 5)) {
      if (chain.cause && chain.effect) {
        items.push({
          title: `${chain.cause} → ${chain.effect}`,
          content: `因果关联：${chain.cause} 导致 ${chain.effect}。关联强度: ${chain.strength || '中'}`,
          type: 'relationship',
          confidence: chain.strength || 0.7,
          tags: ['因果关系'],
          metadata: { 
            source: 'causal_chain',
            cause: chain.cause,
            effect: chain.effect,
          },
        });
      }
    }
  }

  // 从时间线提取知识
  if (data.timeline && data.timeline.length > 0) {
    for (const event of data.timeline.slice(0, 5)) {
      if (event.event && event.timestamp) {
        items.push({
          title: event.event.substring(0, 50),
          content: `时间: ${event.timestamp}。事件: ${event.event}。${event.significance ? '意义: ' + event.significance : ''}`,
          type: 'event',
          confidence: 0.7,
          tags: ['时间线', '事件'],
          metadata: { 
            source: 'timeline',
            timestamp: event.timestamp,
          },
        });
      }
    }
  }

  return items;
}
