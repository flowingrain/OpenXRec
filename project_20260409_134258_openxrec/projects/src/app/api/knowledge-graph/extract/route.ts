/**
 * 知识图谱提取 API
 * 
 * 从用户对话和推荐结果中提取实体和关系
 * 支持动态实体类型发现，不依赖预定义类型列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import type { KGEntity, KGRelation } from '@/lib/knowledge-graph/types';

const llmClient = new LLMClient(new Config());

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
 * 使用动态实体类型发现，不依赖预定义类型列表
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

## 提取规则（动态类型发现）
1. **主动发现实体类型**：仔细分析文本内容，发现所有有意义的实体类型，不要局限于常见类型
2. **实体类型发现示例**：
   - 如果文本提到学术会议（SIGIR、KDD、CVPR等）→ 类型应为"学术会议"
   - 如果文本提到技术方法（矩阵分解、协同过滤、深度学习等）→ 类型应为"学术技术"
   - 如果文本提到研究机构/大学 → 类型应为"学术机构"
   - 如果文本提到公司、品牌、产品 → 类型应为"公司"或"产品"
   - 如果文本提到人物、专家 → 类型应为"人物"
   - 如果文本提到地点/位置 → 类型应为"地点"
   - 如果文本提到时间/日期/事件 → 类型应为"事件"
   - 如果文本提到政策/法规/标准 → 类型应为"政策"
   - 如果文本提到行业/领域/分类 → 类型应为"行业"
   - 如果文本提到抽象概念/术语 → 类型应为"概念"
   - 如果都不属于上述 → 类型应为"其他"
3. **关系类型发现**：根据实际文本内容发现关系，不要只使用"关联"
   - 如果文本提到"A投资B" → 类型应为"投资"
   - 如果文本提到"A控股B" → 类型应为"控股"
   - 如果文本提到"A是B的研究方向" → 类型应为"研究"
   - 如果文本提到"A属于B" → 类型应为"属于"
   - 如果文本提到"A引用B" → 类型应为"引用"
   - 如果文本提到"A发表在B" → 类型应为"发表"
   - 如果文本暗示其他关系 → 使用最能描述关系的类型
4. **灵活性**：实体类型和关系类型都应该从文本内容中自然发现

## 输出格式（严格JSON）
{
  "discoveredEntityTypes": [
    {"type": "发现的类型名称", "reasoning": "为什么识别为这个类型"}
  ],
  "entities": [
    {
      "name": "实体名称",
      "type": "动态发现的实体类型",
      "importance": 0.9,
      "description": "实体描述或从文本中提取的信息",
      "verified": false
    }
  ],
  "relations": [
    {
      "source": "源实体名称",
      "target": "目标实体名称",
      "type": "动态发现的关系类型",
      "confidence": 0.8,
      "evidence": "关系证据（从文本中提取）",
      "verified": false
    }
  ]
}

请只输出JSON，不要输出其他内容。`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: `你是一个知识图谱专家，擅长从文本中提取结构化的实体和关系。
      
【重要】你的核心任务是动态发现实体类型和关系类型：
- 不要假设实体类型只能是"公司、人物、地点"等常见类型
- 不要假设关系类型只能是"投资、合作、关联"等常见类型
- 要根据文本的领域和内容，灵活发现新的类型
- 例如：学术论文领域会有"学术会议"、"学术技术"、"学术机构"等类型
- 例如：技术领域会有"使用技术"、"实现方法"等关系

请主动发现类型，不要被预定义列表限制。` },
      { role: 'user', content: prompt },
    ], {
      model: 'doubao-seed-2-0-pro-260215',
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
