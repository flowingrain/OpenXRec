/**
 * 知识图谱工具
 * 
 * 提供知识图谱的查询、搜索、分析功能
 */

import type { ToolDefinition, ToolCallRequest, ToolCallResult, ToolExecutor } from './types';
import { createSuccessResult, createErrorResult } from './registry';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ============================================================================
// 工具定义
// ============================================================================

/**
 * 搜索知识图谱实体
 */
const searchEntitiesDefinition: ToolDefinition = {
  name: 'kg_search_entities',
  displayName: '搜索知识图谱实体',
  description: '根据关键词搜索知识图谱中的实体，返回匹配的实体及其关系。适用于用户询问特定实体、概念或关联信息时。',
  parameters: {
    query: {
      type: 'string',
      description: '搜索关键词，可以是实体名称、类型或描述中的关键词',
    },
    type: {
      type: 'string',
      description: '实体类型筛选，如：公司、人物、地点、事件、行业等',
      enum: ['公司', '人物', '地点', '事件', '行业', '政策', '产品', '其他'],
    },
    limit: {
      type: 'number',
      description: '返回结果数量限制，默认10',
      default: 10,
    },
    includeRelations: {
      type: 'boolean',
      description: '是否包含关联关系',
      default: true,
    },
  },
  required: ['query'],
  category: 'knowledge',
  examples: [
    {
      scenario: '用户询问某公司相关信息',
      parameters: { query: '腾讯', includeRelations: true },
      expectedOutput: '返回腾讯公司实体及其关联的公司、人物、事件等',
    },
  ],
};

/**
 * 获取实体详情
 */
const getEntityDefinition: ToolDefinition = {
  name: 'kg_get_entity',
  displayName: '获取实体详情',
  description: '获取指定实体的详细信息，包括属性、关联实体和关系。',
  parameters: {
    entityId: {
      type: 'string',
      description: '实体ID',
    },
    entityName: {
      type: 'string',
      description: '实体名称（作为ID的替代）',
    },
  },
  category: 'knowledge',
  examples: [
    {
      scenario: '用户想了解某个实体的详细信息',
      parameters: { entityName: '阿里巴巴' },
      expectedOutput: '返回阿里巴巴的详细信息，包括类型、描述、关联实体等',
    },
  ],
};

/**
 * 查找实体间路径
 */
const findPathDefinition: ToolDefinition = {
  name: 'kg_find_path',
  displayName: '查找实体间路径',
  description: '查找两个实体之间的关系路径，展示它们如何关联。适用于分析实体间的关系链。',
  parameters: {
    fromEntity: {
      type: 'string',
      description: '起始实体名称',
    },
    toEntity: {
      type: 'string',
      description: '目标实体名称',
    },
    maxDepth: {
      type: 'number',
      description: '最大搜索深度，默认3',
      default: 3,
    },
  },
  required: ['fromEntity', 'toEntity'],
  category: 'knowledge',
  examples: [
    {
      scenario: '用户询问两个公司之间的关系',
      parameters: { fromEntity: '腾讯', toEntity: '京东', maxDepth: 3 },
      expectedOutput: '返回腾讯与京东之间的关系路径，如：腾讯 -> 投资 -> 京东',
    },
  ],
};

/**
 * 获取实体关系网络
 */
const getNetworkDefinition: ToolDefinition = {
  name: 'kg_get_network',
  displayName: '获取实体关系网络',
  description: '获取以指定实体为中心的关系网络，用于可视化展示。',
  parameters: {
    centerEntity: {
      type: 'string',
      description: '中心实体名称',
    },
    depth: {
      type: 'number',
      description: '扩展深度，默认2',
      default: 2,
    },
    relationTypes: {
      type: 'array',
      description: '关系类型筛选',
      items: {
        type: 'string',
        description: '关系类型',
        enum: ['投资', '控股', '合作', '竞争', '供应链', '监管', '影响', '关联', '任职', '隶属', '生产', '采购', '销售', '其他'],
      },
    },
  },
  required: ['centerEntity'],
  category: 'knowledge',
  examples: [
    {
      scenario: '用户想查看某个公司的关系网络',
      parameters: { centerEntity: '华为', depth: 2 },
      expectedOutput: '返回华为的二级关系网络，包括其合作伙伴、竞争对手、子公司等',
    },
  ],
};

/**
 * 分析实体影响范围
 */
const analyzeInfluenceDefinition: ToolDefinition = {
  name: 'kg_analyze_influence',
  displayName: '分析实体影响范围',
  description: '分析指定实体在整个知识图谱中的影响力和影响范围。',
  parameters: {
    entityName: {
      type: 'string',
      description: '实体名称',
    },
    analysisType: {
      type: 'string',
      description: '分析类型',
      enum: ['centrality', 'reachability', 'community'],
      default: 'centrality',
    },
  },
  required: ['entityName'],
  category: 'knowledge',
  examples: [
    {
      scenario: '用户想知道某公司在行业中的影响力',
      parameters: { entityName: '比亚迪', analysisType: 'centrality' },
      expectedOutput: '返回比亚迪的中心性分析结果，包括度中心性、接近中心性等',
    },
  ],
};

// ============================================================================
// 工具执行器
// ============================================================================

/**
 * 搜索实体执行器
 */
const searchEntitiesExecutor: ToolExecutor = async (request) => {
  const { query, type, limit = 10, includeRelations = true } = request.parameters;
  
  try {
    const supabase = getSupabaseClient();
    
    // 构建查询
    let entitiesQuery = supabase
      .from('kg_entities')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('importance', { ascending: false })
      .limit(limit);
    
    if (type) {
      entitiesQuery = entitiesQuery.eq('type', type);
    }
    
    const { data: entities, error } = await entitiesQuery;
    
    if (error) {
      return createErrorResult(`查询失败: ${error.message}`);
    }
    
    // 如果需要关联关系
    let relations: any[] = [];
    if (includeRelations && entities && entities.length > 0) {
      const entityIds = entities.map(e => e.id);
      const { data: relData } = await supabase
        .from('kg_relations')
        .select('*')
        .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`);
      relations = relData || [];
    }
    
    const result = {
      entities: entities || [],
      relations,
      total: entities?.length || 0,
    };
    
    return createSuccessResult(
      result,
      `找到 ${result.total} 个与 "${query}" 相关的实体`,
      {
        type: 'knowledge_graph',
        data: {
          nodes: result.entities.map(e => ({
            id: e.id,
            label: e.name,
            type: e.type,
            description: e.description,
            importance: e.importance,
          })),
          edges: result.relations.map(r => ({
            id: r.id,
            source: r.source_entity_id,
            target: r.target_entity_id,
            label: r.type,
          })),
        },
      }
    );
  } catch (error) {
    return createErrorResult(`搜索失败: ${error}`);
  }
};

/**
 * 获取实体详情执行器
 */
const getEntityExecutor: ToolExecutor = async (request) => {
  const { entityId, entityName } = request.parameters;
  
  if (!entityId && !entityName) {
    return createErrorResult('需要提供 entityId 或 entityName');
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // 查询实体
    let query = supabase.from('kg_entities').select('*');
    if (entityId) {
      query = query.eq('id', entityId);
    } else {
      query = query.eq('name', entityName);
    }
    
    const { data: entity, error } = await query.single();
    
    if (error || !entity) {
      return createErrorResult(`实体不存在: ${entityName || entityId}`);
    }
    
    // 查询关联关系
    const { data: relations } = await supabase
      .from('kg_relations')
      .select(`
        *,
        source:kg_entities!kg_relations_source_entity_id_fkey(id, name, type),
        target:kg_entities!kg_relations_target_entity_id_fkey(id, name, type)
      `)
      .or(`source_entity_id.eq.${entity.id},target_entity_id.eq.${entity.id}`);
    
    return createSuccessResult(
      { entity, relations: relations || [] },
      `实体 "${entity.name}" 的详细信息，包含 ${relations?.length || 0} 个关联关系`,
      {
        type: 'knowledge_graph',
        data: {
          nodes: [
            { id: entity.id, label: entity.name, type: entity.type },
            ...((relations || []).map(r => 
              r.source.id === entity.id 
                ? { id: r.target.id, label: r.target.name, type: r.target.type }
                : { id: r.source.id, label: r.source.name, type: r.source.type }
            )),
          ].filter((v, i, a) => a.findIndex(n => n.id === v.id) === i),
          edges: (relations || []).map(r => ({
            id: r.id,
            source: r.source_entity_id,
            target: r.target_entity_id,
            label: r.type,
          })),
        },
      }
    );
  } catch (error) {
    return createErrorResult(`获取实体失败: ${error}`);
  }
};

/**
 * 查找路径执行器
 */
const findPathExecutor: ToolExecutor = async (request) => {
  const { fromEntity, toEntity, maxDepth = 3 } = request.parameters;
  
  try {
    const supabase = getSupabaseClient();
    
    // 获取所有实体和关系
    const { data: entities } = await supabase.from('kg_entities').select('id, name, type');
    const { data: relations } = await supabase.from('kg_relations').select('source_entity_id, target_entity_id, type');
    
    if (!entities || !relations) {
      return createErrorResult('知识图谱数据为空');
    }
    
    // 构建邻接表
    const graph = new Map<string, Set<{ id: string; type: string }>>();
    for (const rel of relations) {
      if (!graph.has(rel.source_entity_id)) {
        graph.set(rel.source_entity_id, new Set());
      }
      if (!graph.has(rel.target_entity_id)) {
        graph.set(rel.target_entity_id, new Set());
      }
      graph.get(rel.source_entity_id)!.add({ id: rel.target_entity_id, type: rel.type });
      // 假设关系是双向的
      graph.get(rel.target_entity_id)!.add({ id: rel.source_entity_id, type: rel.type });
    }
    
    // 查找实体ID
    const fromId = entities.find(e => e.name === fromEntity)?.id;
    const toId = entities.find(e => e.name === toEntity)?.id;
    
    if (!fromId || !toId) {
      return createErrorResult(`找不到实体: ${!fromId ? fromEntity : toEntity}`);
    }
    
    // BFS 查找路径
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[]; edges: Array<{ type: string }> }> = [
      { id: fromId, path: [fromId], edges: [] },
    ];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.id === toId) {
        // 找到路径
        const pathEntities = current.path.map(id => entities.find(e => e.id === id)!);
        const pathRelations = current.edges;
        
        return createSuccessResult(
          {
            path: pathEntities.map(e => e.name),
            relations: pathRelations,
            length: current.path.length - 1,
          },
          `找到从 "${fromEntity}" 到 "${toEntity}" 的路径，长度为 ${current.path.length - 1}`,
          {
            type: 'knowledge_graph',
            data: {
              nodes: pathEntities.map(e => ({ id: e.id, label: e.name, type: e.type })),
              edges: pathRelations.map((r, i) => ({
                id: `path_${i}`,
                source: current.path[i],
                target: current.path[i + 1],
                label: r.type,
              })),
            },
          }
        );
      }
      
      if (current.path.length > maxDepth) continue;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      
      const neighbors = graph.get(current.id);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.id)) {
            queue.push({
              id: neighbor.id,
              path: [...current.path, neighbor.id],
              edges: [...current.edges, { type: neighbor.type }],
            });
          }
        }
      }
    }
    
    return createSuccessResult(
      { path: null, message: '未找到连接路径' },
      `"${fromEntity}" 和 "${toEntity}" 之间没有找到连接路径`,
      { type: 'text', data: { message: '未找到连接路径' } }
    );
  } catch (error) {
    return createErrorResult(`路径查找失败: ${error}`);
  }
};

/**
 * 获取关系网络执行器
 */
const getNetworkExecutor: ToolExecutor = async (request) => {
  const { centerEntity, depth = 2, relationTypes } = request.parameters;
  
  try {
    const supabase = getSupabaseClient();
    
    // 获取中心实体
    const { data: centerData } = await supabase
      .from('kg_entities')
      .select('*')
      .eq('name', centerEntity)
      .single();
    
    if (!centerData) {
      return createErrorResult(`实体 "${centerEntity}" 不存在`);
    }
    
    // 递归获取关联实体
    const visitedIds = new Set<string>([centerData.id]);
    const allEntities = [centerData];
    const allRelations: any[] = [];
    
    let currentLevel = [centerData.id];
    
    for (let level = 0; level < depth; level++) {
      const nextLevel: string[] = [];
      
      // 查询这一层的所有关系
      let relationsQuery = supabase
        .from('kg_relations')
        .select('*, source:kg_entities!kg_relations_source_entity_id_fkey(*), target:kg_entities!kg_relations_target_entity_id_fkey(*)')
        .or(`source_entity_id.in.(${currentLevel.join(',')}),target_entity_id.in.(${currentLevel.join(',')})`);
      
      if (relationTypes && relationTypes.length > 0) {
        relationsQuery = relationsQuery.in('type', relationTypes);
      }
      
      const { data: relations } = await relationsQuery;
      
      if (relations) {
        for (const rel of relations) {
          const otherId = currentLevel.includes(rel.source_entity_id) 
            ? rel.target_entity_id 
            : rel.source_entity_id;
          
          if (!visitedIds.has(otherId)) {
            visitedIds.add(otherId);
            nextLevel.push(otherId);
            allEntities.push(rel.target.id === otherId ? rel.target : rel.source);
          }
          
          allRelations.push(rel);
        }
      }
      
      currentLevel = nextLevel;
      if (currentLevel.length === 0) break;
    }
    
    return createSuccessResult(
      {
        center: centerData,
        entities: allEntities,
        relations: allRelations,
        depth: Math.min(depth, Math.ceil(allEntities.length / 10)), // 实际深度
      },
      `以 "${centerEntity}" 为中心的 ${depth} 级关系网络，包含 ${allEntities.length} 个实体和 ${allRelations.length} 个关系`,
      {
        type: 'knowledge_graph',
        data: {
          nodes: allEntities.map(e => ({
            id: e.id,
            label: e.name,
            type: e.type,
            isCenter: e.id === centerData.id,
          })),
          edges: allRelations.map(r => ({
            id: r.id,
            source: r.source_entity_id,
            target: r.target_entity_id,
            label: r.type,
          })),
        },
      }
    );
  } catch (error) {
    return createErrorResult(`获取关系网络失败: ${error}`);
  }
};

/**
 * 分析影响力执行器
 */
const analyzeInfluenceExecutor: ToolExecutor = async (request) => {
  const { entityName, analysisType = 'centrality' } = request.parameters;
  
  try {
    const supabase = getSupabaseClient();
    
    // 获取实体
    const { data: entity } = await supabase
      .from('kg_entities')
      .select('*')
      .eq('name', entityName)
      .single();
    
    if (!entity) {
      return createErrorResult(`实体 "${entityName}" 不存在`);
    }
    
    // 获取所有关系
    const { data: relations } = await supabase
      .from('kg_relations')
      .select('source_entity_id, target_entity_id')
      .or(`source_entity_id.eq.${entity.id},target_entity_id.eq.${entity.id}`);
    
    // 计算度中心性
    const degree = relations?.length || 0;
    const inDegree = relations?.filter(r => r.target_entity_id === entity.id).length || 0;
    const outDegree = relations?.filter(r => r.source_entity_id === entity.id).length || 0;
    
    // 获取全局统计
    const { count: totalEntities } = await supabase
      .from('kg_entities')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalRelations } = await supabase
      .from('kg_relations')
      .select('*', { count: 'exact', head: true });
    
    const avgDegree = totalRelations && totalEntities 
      ? (totalRelations * 2) / totalEntities 
      : 0;
    
    // 影响力评分
    const influenceScore = Math.min(100, Math.round((degree / (avgDegree || 1)) * 50));
    
    return createSuccessResult(
      {
        entity: { id: entity.id, name: entity.name, type: entity.type },
        metrics: {
          degree,
          inDegree,
          outDegree,
          avgDegree: Math.round(avgDegree * 10) / 10,
          influenceScore,
        },
        ranking: {
          percentile: Math.round((influenceScore / 100) * 100),
          level: influenceScore >= 80 ? '核心实体' : influenceScore >= 50 ? '重要实体' : '一般实体',
        },
        globalStats: {
          totalEntities,
          totalRelations,
        },
      },
      `"${entityName}" 的影响力评分: ${influenceScore}分，度中心性: ${degree}，属于${influenceScore >= 80 ? '核心实体' : influenceScore >= 50 ? '重要实体' : '一般实体'}`,
      {
        type: 'chart',
        data: {
          type: 'radar',
          labels: ['连接度', '入度', '出度', '影响力'],
          values: [degree, inDegree, outDegree, influenceScore],
        },
      }
    );
  } catch (error) {
    return createErrorResult(`影响力分析失败: ${error}`);
  }
};

// ============================================================================
// 注册工具
// ============================================================================

export function registerKnowledgeGraphTools(registry: {
  register: (def: ToolDefinition, executor: ToolExecutor) => void;
}): void {
  registry.register(searchEntitiesDefinition, searchEntitiesExecutor);
  registry.register(getEntityDefinition, getEntityExecutor);
  registry.register(findPathDefinition, findPathExecutor);
  registry.register(getNetworkDefinition, getNetworkExecutor);
  registry.register(analyzeInfluenceDefinition, analyzeInfluenceExecutor);
}
