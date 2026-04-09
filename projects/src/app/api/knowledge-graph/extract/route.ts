/**
 * 知识图谱提取 API
 * 
 * 从用户对话和推荐结果中提取实体和关系
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import { getChatModelId } from '@/lib/llm/chat-model';
import type { KGEntity, KGRelation } from '@/lib/knowledge-graph/types';

const llmClient = createLLMClient({});

interface ExtractRequest {
  query: string;
  items?: any[];
  explanation?: string;
  existingEntities?: KGEntity[];
  existingRelations?: KGRelation[];
}

interface ExtractResponse {
  entities: KGEntity[];
  relations: KGRelation[];
}

/**
 * 从对话中提取实体和关系
 */
async function extractFromConversation(
  query: string,
  items: any[],
  explanation: string
): Promise<ExtractResponse> {
  const prompt = `你是一个知识图谱专家。请从以下对话内容中提取实体和关系。

## 用户查询
${query}

## 推荐结果
${items?.map((item, i) => `${i + 1}. ${item.title}: ${item.description}`).join('\n') || '无'}

## 推荐解释
${explanation || '无'}

## 提取规则
1. 提取关键实体（如产品、品牌、概念、需求等）
2. 提取实体间的关系（如"属于"、"推荐"、"关联"等）
3. 实体类型包括：公司、人物、地点、政策、事件、行业、产品、其他
4. 关系类型包括：投资、控股、合作、竞争、供应链、监管、影响、关联、任职、隶属、生产、采购、销售、其他

## 输出格式（严格JSON）
{
  "entities": [
    {
      "name": "实体名称",
      "type": "产品",
      "importance": 0.9,
      "description": "实体描述",
      "verified": false
    }
  ],
  "relations": [
    {
      "source": "源实体名称",
      "target": "目标实体名称",
      "type": "关联",
      "confidence": 0.8,
      "evidence": "关系证据",
      "verified": false
    }
  ]
}

请只输出JSON，不要输出其他内容。`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是一个知识图谱专家，擅长从文本中提取结构化的实体和关系。' },
      { role: 'user', content: prompt },
    ], {
      model: getChatModelId('doubao-seed-2-0-pro-260215'),
      temperature: 0.3,
    });

    // 解析JSON
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      
      // 转换为标准格式
      const entities: KGEntity[] = (data.entities || []).map((e: any, index: number) => ({
        id: `entity_${Date.now()}_${index}`,
        name: e.name,
        type: e.type || '其他',
        importance: e.importance || 0.5,
        description: e.description || '',
        aliases: [],
        source_type: 'llm_extracted',
        verified: e.verified || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // 构建实体名称到ID的映射
      const entityNameToId = new Map<string, string>();
      entities.forEach(e => entityNameToId.set(e.name, e.id));

      const relations: KGRelation[] = (data.relations || []).map((r: any, index: number) => ({
        id: `relation_${Date.now()}_${index}`,
        source_entity_id: entityNameToId.get(r.source) || r.source,
        target_entity_id: entityNameToId.get(r.target) || r.target,
        type: r.type || '关联',
        confidence: r.confidence || 0.5,
        evidence: r.evidence || '',
        source_type: 'llm_extracted',
        verified: r.verified || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      return { entities, relations };
    }
  } catch (error) {
    console.error('[KnowledgeGraph Extract] Error:', error);
  }

  return { entities: [], relations: [] };
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtractRequest = await request.json();
    const { query, items = [], explanation = '', existingEntities = [], existingRelations = [] } = body;

    if (!query) {
      return NextResponse.json({
        success: false,
        error: '缺少查询内容',
      }, { status: 400 });
    }

    // 提取实体和关系
    const extracted = await extractFromConversation(query, items, explanation);

    // 过滤已存在的实体和关系
    const newEntities = extracted.entities.filter(
      e => !existingEntities.find(ex => ex.name === e.name)
    );
    const newRelations = extracted.relations.filter(
      r => !existingRelations.find(er => 
        er.source_entity_id === r.source_entity_id && 
        er.target_entity_id === r.target_entity_id
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        entities: newEntities,
        relations: newRelations,
      },
    });
  } catch (error) {
    console.error('[KnowledgeGraph Extract] Error:', error);
    return NextResponse.json({
      success: false,
      error: '提取失败',
    }, { status: 500 });
  }
}
