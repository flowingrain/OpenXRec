/**
 * 知识图谱服务
 * 负责实体关系抽取、合并、同步到知识库
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { embeddingService } from '@/lib/embedding/service';
import type { 
  KGEntity, 
  KGRelation, 
  KnowledgeGraph, 
  LLMExtractionResult,
  GraphChange,
  EntityType,
  RelationType,
  ENTITY_TYPE_CONFIG,
  RELATION_TYPE_CONFIG
} from './types';

// 使用 Coze 托管的 Supabase 客户端
function getSupabase() {
  try {
    return getSupabaseClient();
  } catch (error) {
    console.warn('[KnowledgeGraphService] Supabase not configured:', error);
    return null;
  }
}

/**
 * LLM 实体关系抽取 Prompt
 */
export const EXTRACTION_PROMPT = `你是一个专业的知识图谱构建助手。请从给定的文本中抽取实体和关系。

## 实体类型
- 公司：企业、集团、机构
- 人物：个人、高管、决策者
- 地点：城市、国家、区域
- 政策：法规、政策、标准
- 事件：具体发生的事件
- 行业：产业领域
- 产品：商品、服务、技术
- 其他：无法归类的实体

## 关系类型
- 投资：A投资B
- 控股：A控股B
- 合作：A与B合作
- 竞争：A与B竞争
- 供应链：A是B的供应商/客户
- 监管：A监管B
- 影响：A影响B
- 关联：A与B有关联
- 任职：A在B任职
- 隶属：A隶属于B
- 生产：A生产B
- 采购：A采购B
- 销售：A销售B
- 其他：其他关系

## 输出格式
请严格按照以下JSON格式输出，不要添加任何其他文字：

{
  "entities": [
    {
      "name": "实体名称",
      "type": "实体类型",
      "importance": 0.8,
      "description": "实体描述（可选）"
    }
  ],
  "relations": [
    {
      "source": "源实体名称",
      "target": "目标实体名称",
      "type": "关系类型",
      "confidence": 0.9,
      "evidence": "关系来源证据（可选）"
    }
  ]
}

## 注意事项
1. 实体名称要准确，使用文本中的原始名称
2. importance 和 confidence 取值范围 0-1
3. 只抽取文本中明确提到的实体和关系
4. 不要臆测或推断不存在的关系

## 待分析文本
`;

/**
 * 知识图谱服务类
 */
export class KnowledgeGraphService {
  
  /**
   * 检查数据库是否可用
   */
  private isDatabaseAvailable(): boolean {
    return getSupabase() !== null;
  }
  
  /**
   * 从知识库查询相关实体
   */
  async queryEntities(keyword: string, limit: number = 50): Promise<KGEntity[]> {
    const client = getSupabase();
    if (!client) return [];
    
    const { data, error } = await client
      .from('kg_entities')
      .select('*')
      .or(`name.ilike.%${keyword}%,aliases.cs.{${keyword}}`)
      .order('importance', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Query entities error:', error);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * 从知识库查询相关关系
   */
  async queryRelations(entityIds: string[]): Promise<KGRelation[]> {
    const client = getSupabase();
    if (!client || entityIds.length === 0) return [];
    
    const { data, error } = await client
      .from('kg_relations')
      .select(`
        *,
        source_entity:kg_entities!kg_relations_source_entity_id_fkey(name),
        target_entity:kg_entities!kg_relations_target_entity_id_fkey(name)
      `)
      .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`)
      .is('valid_to', null)
      .order('confidence', { ascending: false });
    
    if (error) {
      console.error('Query relations error:', error);
      return [];
    }
    
    // 展开实体名称
    return (data || []).map((r: any) => ({
      ...r,
      source_name: r.source_entity?.name,
      target_name: r.target_entity?.name
    }));
  }
  
  /**
   * 从知识库构建图谱（自动构建）
   */
  async buildFromKnowledgeBase(topic: string): Promise<KnowledgeGraph> {
    if (!this.isDatabaseAvailable()) {
      return { entities: [], relations: [] };
    }
    
    // 1. 查询相关实体
    const entities = await this.queryEntities(topic);
    
    // 2. 查询相关关系
    const entityIds = entities.map(e => e.id);
    const relations = await this.queryRelations(entityIds);
    
    return { entities, relations };
  }
  
  /**
   * 使用 LLM 抽取实体关系
   */
  async extractFromContent(content: string, llmClient: any): Promise<LLMExtractionResult> {
    const prompt = EXTRACTION_PROMPT + content;
    
    try {
      // 使用 invoke 方法调用 LLM
      const { getChatModelId } = await import('@/lib/llm/chat-model');
      const response = await llmClient.invoke([{
        role: 'user',
        content: prompt
      }], {
        model: getChatModelId(),
        temperature: 0.3  // 低温度以确保输出格式稳定
      });
      
      const responseText = response.content || '';
      
      // 提取 JSON 部分
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in LLM response');
        return { entities: [], relations: [] };
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      // 验证并清理结果
      if (!result.entities || !Array.isArray(result.entities)) {
        result.entities = [];
      }
      if (!result.relations || !Array.isArray(result.relations)) {
        result.relations = [];
      }
      
      return result;
    } catch (error) {
      console.error('Extract from content error:', error);
      return { entities: [], relations: [] };
    }
  }
  
  /**
   * 实体对齐（去重）
   */
  async alignEntities(
    newEntities: LLMExtractionResult['entities']
  ): Promise<Array<{ entity: LLMExtractionResult['entities'][0]; existingId?: string }>> {
    const client = getSupabase();
    const results: Array<{ entity: LLMExtractionResult['entities'][0]; existingId?: string }> = [];
    
    if (!client) {
      // 数据库不可用时，直接返回新实体
      return newEntities.map(entity => ({ entity }));
    }
    
    for (const entity of newEntities) {
      // 查询知识库中是否存在同名或别名实体
      const { data: existing } = await client
        .from('kg_entities')
        .select('id, name, aliases')
        .or(`name.eq.${entity.name},aliases.cs.{${entity.name}}`)
        .limit(1)
        .maybeSingle();
      
      if (existing) {
        results.push({ entity, existingId: existing.id });
      } else {
        results.push({ entity });
      }
    }
    
    return results;
  }
  
  /**
   * 合并知识库 + LLM抽取（核心方法）
   */
  async mergeWithKnowledgeBase(
    topic: string,
    llmResult: LLMExtractionResult
  ): Promise<KnowledgeGraph> {
    if (!this.isDatabaseAvailable()) {
      // 数据库不可用时，返回 LLM 抽取的结果
      return {
        entities: llmResult.entities.map((e, i) => ({
          id: `temp-${i}`,
          name: e.name,
          type: e.type,
          importance: e.importance || 0.5,
          description: e.description,
          source_type: 'llm',
          verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as KGEntity)),
        relations: llmResult.relations.map((r, i) => ({
          id: `temp-rel-${i}`,
          source_entity_id: `temp-${llmResult.entities.findIndex(e => e.name === r.source)}`,
          target_entity_id: `temp-${llmResult.entities.findIndex(e => e.name === r.target)}`,
          type: r.type,
          confidence: r.confidence || 0.5,
          evidence: r.evidence,
          source_type: 'llm',
          verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as KGRelation))
      };
    }
    
    const client = getSupabase();
    
    // 1. 从知识库获取已有数据
    const kbGraph = await this.buildFromKnowledgeBase(topic);
    
    // 2. 实体对齐
    const alignedEntities = await this.alignEntities(llmResult.entities);
    
    // 3. 创建新实体并收集ID映射
    const entityIdMap: Record<string, string> = {};
    
    for (const { entity, existingId } of alignedEntities) {
      if (existingId) {
        entityIdMap[entity.name] = existingId;
      } else {
        // 创建新实体
        const newEntity = await this.addEntity({
          name: entity.name,
          type: entity.type,
          importance: entity.importance || 0.5,
          description: entity.description,
          source_type: 'llm',
          verified: false
        });
        if (newEntity) {
          entityIdMap[entity.name] = newEntity.id;
        }
      }
    }
    
    // 4. 处理关系
    for (const relation of llmResult.relations) {
      const sourceId = entityIdMap[relation.source];
      const targetId = entityIdMap[relation.target];
      
      if (!sourceId || !targetId) {
        console.warn(`Missing entity ID for relation: ${relation.source} -> ${relation.target}`);
        continue;
      }
      
      // 检查关系是否已存在
      const { data: existingRelation } = await client!
        .from('kg_relations')
        .select('id')
        .eq('source_entity_id', sourceId)
        .eq('target_entity_id', targetId)
        .eq('type', relation.type)
        .maybeSingle();
      
      if (!existingRelation) {
        // 创建新关系
        await this.addRelation({
          source_entity_id: sourceId,
          target_entity_id: targetId,
          type: relation.type,
          confidence: relation.confidence || 0.5,
          evidence: relation.evidence,
          source_type: 'llm',
          verified: false
        });
      }
    }
    
    // 5. 返回合并后的图谱
    return this.buildFromKnowledgeBase(topic);
  }
  
  /**
   * 添加实体到知识库
   */
  async addEntity(data: Partial<KGEntity>): Promise<KGEntity | null> {
    const client = getSupabase();
    if (!client) return null;
    
    const { data: entity, error } = await client
      .from('kg_entities')
      .insert({
        name: data.name,
        type: data.type || '其他',
        aliases: data.aliases || [],
        description: data.description,
        importance: data.importance || 0.5,
        source_type: data.source_type || 'llm',
        verified: data.verified || false
      })
      .select()
      .single();
    
    if (error) {
      console.error('Add entity error:', error);
      return null;
    }
    
    // 后台生成嵌入向量（不阻塞响应）
    if (entity && data.name) {
      embeddingService.indexEntity(entity.id, data.name, data.description)
        .then(success => {
          console.log(`[KnowledgeGraph] Embedding generated for entity ${entity.id}: ${success ? 'success' : 'failed'}`);
        })
        .catch(err => {
          console.warn(`[KnowledgeGraph] Embedding generation failed:`, err);
        });
    }
    
    return entity;
  }
  
  /**
   * 添加关系到知识库（支持演化逻辑）
   */
  async addRelation(data: Partial<KGRelation>): Promise<KGRelation | null> {
    const client = getSupabase();
    if (!client) return null;
    
    // 动态导入演化服务，避免循环依赖
    const { knowledgeEvolutionService } = await import('./evolution-service');
    
    // 1. 检查并处理关系演化
    if (data.source_entity_id && data.target_entity_id && data.type) {
      const evolution = await knowledgeEvolutionService.handleRelationEvolution({
        sourceEntityId: data.source_entity_id,
        targetEntityId: data.target_entity_id,
        relationType: data.type,
        newConfidence: data.confidence || 0.5,
        newEvidence: data.evidence,
        sourceType: data.source_type || 'llm'
      });
      
      if (evolution.action === 'keep_old') {
        // 保留旧关系，不创建新关系
        console.log('[KnowledgeGraph] 保留旧关系，不创建新关系');
        const { data: oldRelation } = await client
          .from('kg_relations')
          .select('*')
          .eq('source_entity_id', data.source_entity_id)
          .eq('target_entity_id', data.target_entity_id)
          .eq('type', data.type)
          .is('valid_to', null)
          .single();
        return oldRelation;
      }
      
      if (evolution.evolved) {
        console.log(`[KnowledgeGraph] 关系演化: ${evolution.oldRelationId} -> 新关系`);
      }
    }
    
    // 2. 创建新关系
    const { data: relation, error } = await client
      .from('kg_relations')
      .insert({
        source_entity_id: data.source_entity_id,
        target_entity_id: data.target_entity_id,
        type: data.type,
        confidence: data.confidence || 0.5,
        evidence: data.evidence,
        source_type: data.source_type || 'llm',
        verified: data.verified || false
      })
      .select()
      .single();
    
    if (error) {
      console.error('Add relation error:', error);
      return null;
    }
    
    // 3. 设置有效期
    if (relation) {
      await knowledgeEvolutionService.setRelationExpiration(
        relation.id,
        data.source_type || 'llm',
        data.confidence || 0.5
      );
    }
    
    return relation;
  }
  
  /**
   * 更新关系（手动修正同步到知识库）
   */
  async updateRelation(
    relationId: string,
    updates: Partial<KGRelation>,
    userId?: string,
    reason?: string
  ): Promise<KGRelation | null> {
    const client = getSupabase();
    if (!client) return null;
    
    // 1. 获取旧值
    const { data: oldRelation } = await client
      .from('kg_relations')
      .select('*')
      .eq('id', relationId)
      .single();
    
    if (!oldRelation) return null;
    
    // 2. 更新关系
    const { data: newRelation, error } = await client
      .from('kg_relations')
      .update({
        ...updates,
        verified: true,
        source_type: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', relationId)
      .select()
      .single();
    
    if (error) {
      console.error('Update relation error:', error);
      return null;
    }
    
    // 3. 记录修正历史
    await this.recordCorrection({
      relation_id: relationId,
      change_type: 'relation_update',
      old_value: {
        type: (oldRelation as any).type,
        confidence: (oldRelation as any).confidence
      },
      new_value: {
        type: updates.type || (oldRelation as any).type,
        confidence: updates.confidence || (oldRelation as any).confidence
      },
      reason,
      corrected_by: userId
    });
    
    return newRelation;
  }
  
  /**
   * 删除关系（软删除）
   */
  async deleteRelation(relationId: string, userId?: string, reason?: string): Promise<boolean> {
    const client = getSupabase();
    if (!client) return false;
    
    // 1. 获取旧值
    const { data: oldRelation } = await client
      .from('kg_relations')
      .select('*')
      .eq('id', relationId)
      .single();
    
    if (!oldRelation) return false;
    
    // 2. 软删除（设置 valid_to）
    const { error } = await client
      .from('kg_relations')
      .update({
        valid_to: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', relationId);
    
    if (error) {
      console.error('Delete relation error:', error);
      return false;
    }
    
    // 3. 记录修正历史
    await this.recordCorrection({
      relation_id: relationId,
      change_type: 'relation_delete',
      old_value: oldRelation,
      reason,
      corrected_by: userId
    });
    
    return true;
  }
  
  /**
   * 更新实体
   */
  async updateEntity(
    entityId: string,
    updates: Partial<KGEntity>,
    userId?: string,
    reason?: string
  ): Promise<KGEntity | null> {
    const client = getSupabase();
    if (!client) return null;
    
    // 1. 获取旧值
    const { data: oldEntity } = await client
      .from('kg_entities')
      .select('*')
      .eq('id', entityId)
      .single();
    
    if (!oldEntity) return null;
    
    // 2. 更新实体
    const { data: newEntity, error } = await client
      .from('kg_entities')
      .update({
        ...updates,
        verified: true,
        source_type: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId)
      .select()
      .single();
    
    if (error) {
      console.error('Update entity error:', error);
      return null;
    }
    
    // 3. 记录修正历史
    await this.recordCorrection({
      entity_id: entityId,
      change_type: 'entity_update',
      old_value: oldEntity,
      new_value: updates,
      reason,
      corrected_by: userId
    });
    
    return newEntity;
  }
  
  /**
   * 记录修正历史（审计追溯）
   */
  async recordCorrection(data: {
    entity_id?: string;
    relation_id?: string;
    change_type: string;
    old_value?: any;
    new_value?: any;
    reason?: string;
    corrected_by?: string;
  }): Promise<void> {
    const client = getSupabase();
    if (!client) return;
    
    const { error } = await client
      .from('kg_corrections')
      .insert({
        entity_id: data.entity_id,
        relation_id: data.relation_id,
        change_type: data.change_type,
        old_value: data.old_value,
        new_value: data.new_value,
        reason: data.reason,
        corrected_by: data.corrected_by
      });
    
    if (error) {
      console.error('Record correction error:', error);
    }
  }
  
  /**
   * 获取修正历史
   */
  async getCorrectionHistory(limit: number = 50): Promise<any[]> {
    const client = getSupabase();
    if (!client) return [];
    
    const { data, error } = await client
      .from('kg_corrections')
      .select(`
        *,
        entity:kg_entities(name),
        relation:kg_relations(id)
      `)
      .order('corrected_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Get correction history error:', error);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * 获取知识库统计
   */
  async getStatistics(): Promise<{
    totalEntities: number;
    verifiedEntities: number;
    totalRelations: number;
    verifiedRelations: number;
    entityTypes: Record<string, number>;
    relationTypes: Record<string, number>;
  }> {
    const client = getSupabase();
    if (!client) {
      return {
        totalEntities: 0,
        verifiedEntities: 0,
        totalRelations: 0,
        verifiedRelations: 0,
        entityTypes: {},
        relationTypes: {}
      };
    }
    
    // 实体统计
    const { count: totalEntities } = await client
      .from('kg_entities')
      .select('*', { count: 'exact', head: true });
    
    const { count: verifiedEntities } = await client
      .from('kg_entities')
      .select('*', { count: 'exact', head: true })
      .eq('verified', true);
    
    // 关系统计
    const { count: totalRelations } = await client
      .from('kg_relations')
      .select('*', { count: 'exact', head: true })
      .is('valid_to', null);
    
    const { count: verifiedRelations } = await client
      .from('kg_relations')
      .select('*', { count: 'exact', head: true })
      .eq('verified', true)
      .is('valid_to', null);
    
    // 类型分布
    const { data: entityTypeData } = await client
      .from('kg_entities')
      .select('type');
    
    const { data: relationTypeData } = await client
      .from('kg_relations')
      .select('type')
      .is('valid_to', null);
    
    const entityTypes: Record<string, number> = {};
    entityTypeData?.forEach((e: any) => {
      entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
    });
    
    const relationTypes: Record<string, number> = {};
    relationTypeData?.forEach((r: any) => {
      relationTypes[r.type] = (relationTypes[r.type] || 0) + 1;
    });
    
    return {
      totalEntities: totalEntities || 0,
      verifiedEntities: verifiedEntities || 0,
      totalRelations: totalRelations || 0,
      verifiedRelations: verifiedRelations || 0,
      entityTypes,
      relationTypes
    };
  }
/**
   * 导出知识图谱快照到对象存储
   */
  async exportToStorage(
    topic: string,
    caseId?: string
  ): Promise<{ key: string; url: string } | null> {
    try {
      // 动态导入存储服务
      const { uploadSnapshot } = await import('@/lib/storage/object-storage');
      
      // 获取知识图谱数据
      const graph = await this.buildFromKnowledgeBase(topic);
      
      if (graph.entities.length === 0) {
        console.warn('No entities to export');
        return null;
      }
      
      // 上传快照
      const result = await uploadSnapshot(caseId || 'default', {
        entities: graph.entities,
        relations: graph.relations,
        metadata: {
          topic,
          exportedAt: new Date().toISOString(),
          entityCount: graph.entities.length,
          relationCount: graph.relations.length,
        },
      });
      
      return result;
    } catch (error) {
      console.error('Export to storage error:', error);
      return null;
    }
  }
  
  /**
   * 从对象存储导入知识图谱快照
   */
  async importFromStorage(key: string): Promise<KnowledgeGraph | null> {
    try {
      // 动态导入存储服务
      const { readFile } = await import('@/lib/storage/object-storage');
      
      // 读取快照数据
      const content = await readFile(key);
      const text = content.toString('utf-8');
      const data = JSON.parse(text);
      
      return {
        entities: data.entities || [],
        relations: data.relations || [],
      };
    } catch (error) {
      console.error('Import from storage error:', error);
      return null;
    }
  }
}

// 导出单例
export const kgService = new KnowledgeGraphService();
