/**
 * 知识图谱提取 API
 * 
 * 从用户对话和推荐结果中提取实体和关系
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import { getChatModelId } from '@/lib/llm/chat-model';
import type { KGEntity, KGRelation } from '@/lib/knowledge-graph/types';
import {
  normalizeEntityType,
  normalizeRelationType,
} from '@/lib/knowledge-graph/kg-type-normalize';
import {
  findCanonicalFromRegistry,
  loadTypeRegistry,
  updateTypeRegistry,
  type TypeRegistryFile,
} from '@/lib/knowledge-graph/type-registry';

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
  domainSummary?: string;
  /** 本场景下模型归纳的实体/关系类型（动态发现，供前端展示） */
  discoveredEntityTypes?: Array<{ label: string; description?: string }>;
  discoveredRelationTypes?: Array<{ label: string; description?: string }>;
  typeRegistry?: TypeRegistryFile;
}

/**
 * 从对话中提取实体和关系
 */
async function extractFromConversation(
  query: string,
  items: any[],
  explanation: string,
  registry?: TypeRegistryFile
): Promise<ExtractResponse> {
  const prompt = `你是一个知识图谱专家。请从以下对话内容中**先理解场景**，再**动态归纳**本话题适用的实体类型与关系类型，最后抽取实体与关系。

## 用户查询
${query}

## 推荐结果
${items?.map((item, i) => `${i + 1}. ${item.title}: ${item.description}`).join('\n') || '无'}

## 推荐解释
${explanation || '无'}

## 规则
1. **动态类型发现**：根据查询与推荐领域，在 \`discoveredEntityTypes\` / \`discoveredRelationTypes\` 中各给出 2～8 条「本场景常用」的类型标签及一句说明（可与预置类型不完全一致，如「风险因子」「竞品」「用户需求」等）。
2. **实体抽取**：为每个实体填写 \`type\`（优先使用你归纳的标签；系统会再映射到规范类型），并写清 \`description\`。
3. **关系抽取**：\`type\` 用自然语言关系名即可（如「满足」「优于」「制约」），系统会映射到规范关系。
4. **预置参考**（映射用，不必穷举）：实体基类含 公司、人物、地点、政策、事件、行业、产品、其他；关系基类含 投资、控股、合作、竞争、供应链、监管、影响、关联、任职、隶属、生产、采购、销售、其他。

## 输出格式（严格 JSON，勿含 markdown）
{
  "domainSummary": "一句话概括本段文本的领域与主题",
  "discoveredEntityTypes": [ { "label": "类型名", "description": "何时使用该类型" } ],
  "discoveredRelationTypes": [ { "label": "关系名", "description": "语义说明" } ],
  "entities": [
    {
      "name": "实体名称",
      "type": "你归纳或预置的实体类型",
      "importance": 0.9,
      "description": "实体描述",
      "verified": false
    }
  ],
  "relations": [
    {
      "source": "源实体名称",
      "target": "目标实体名称",
      "type": "关系类型",
      "confidence": 0.8,
      "evidence": "关系证据",
      "verified": false
    }
  ]
}`;

  try {
    const response = await llmClient.invoke(
      [
        {
          role: 'system',
          content:
            '你是知识图谱与信息抽取专家：先归纳场景本体再抽三元组，输出仅合法 JSON。',
        },
        { role: 'user', content: prompt },
      ],
      {
        model: getChatModelId(),
        temperature: 0.25,
      }
    );

    // 解析JSON
    const jsonMatch = response.content?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);

      const discoveredEntityTypes = Array.isArray(data.discoveredEntityTypes)
        ? data.discoveredEntityTypes
        : [];
      const discoveredRelationTypes = Array.isArray(data.discoveredRelationTypes)
        ? data.discoveredRelationTypes
        : [];

      // 转换为标准格式（类型归一化 + 保留原始标签）
      const entities: KGEntity[] = (data.entities || []).map((e: any, index: number) => {
        const rawType = typeof e.type === 'string' ? e.type : '其他';
        const canonical = findCanonicalFromRegistry(registry, 'entity', rawType);
        return {
          id: `entity_${Date.now()}_${index}`,
          name: e.name,
          type: canonical,
          importance: e.importance || 0.5,
          description: e.description || '',
          aliases: [],
          properties: {
            typeLabelRaw: rawType,
          },
          source_type: 'llm' as const,
          verified: e.verified || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      // 构建实体名称到ID的映射
      const entityNameToId = new Map<string, string>();
      entities.forEach((e) => entityNameToId.set(e.name, e.id));

      const relations: KGRelation[] = (data.relations || []).map((r: any, index: number) => {
        const rawRel = typeof r.type === 'string' ? r.type : '关联';
        const canonicalRel = findCanonicalFromRegistry(registry, 'relation', rawRel);
        return {
          id: `relation_${Date.now()}_${index}`,
          source_entity_id: entityNameToId.get(r.source) || r.source,
          target_entity_id: entityNameToId.get(r.target) || r.target,
          type: canonicalRel,
          confidence: r.confidence || 0.5,
          evidence: r.evidence || '',
          properties: { relationLabelRaw: rawRel },
          source_type: 'llm' as const,
          verified: r.verified || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      return {
        entities,
        relations,
        domainSummary:
          typeof data.domainSummary === 'string' ? data.domainSummary : undefined,
        discoveredEntityTypes,
        discoveredRelationTypes,
        typeRegistry: registry,
      };
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

    const loadedRegistry = await loadTypeRegistry();

    // 提取实体和关系
    const extracted = await extractFromConversation(query, items, explanation, loadedRegistry);

    // 基于本轮抽取与动态发现增量更新类型注册表（专门 JSON 文件）
    const updatedRegistry = await updateTypeRegistry({
      entityLabels: [
        ...(extracted.discoveredEntityTypes ?? []),
        ...extracted.entities.map((e) => ({
          label: String(e.properties?.typeLabelRaw || e.type || '其他'),
        })),
      ],
      relationLabels: [
        ...(extracted.discoveredRelationTypes ?? []),
        ...extracted.relations.map((r) => ({
          label: String(r.properties?.relationLabelRaw || r.type || '关联'),
        })),
      ],
    });

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
        discoveredEntityTypes: extracted.discoveredEntityTypes ?? [],
        discoveredRelationTypes: extracted.discoveredRelationTypes ?? [],
        domainSummary: extracted.domainSummary,
        typeRegistry: updatedRegistry,
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
