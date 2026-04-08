/**
 * 基于 Supabase 的知识图谱服务
 * 
 * 功能：
 * - 使用 kg_entities 表存储知识图谱实体
 * - 使用 kg_relations 表存储实体关系
 * - 支持图遍历和路径查询
 * - 与推荐系统深度集成
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== 类型定义 ====================

export interface SupabaseGraphNode {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  description?: string;
  importance: number;
  properties: any;
  sourceType: string;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SupabaseGraphEdge {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  confidence: number;
  evidence?: string;
  properties: any;
  sourceType: string;
  verified: boolean;
  validFrom?: string;
  validTo?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GraphPath {
  nodes: SupabaseGraphNode[];
  edges: SupabaseGraphEdge[];
  length: number;
  totalConfidence: number;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  typeDistribution: Record<string, number>;
  relationTypeDistribution: Record<string, number>;
  avgDegree: number;
}

// ==================== Supabase 知识图谱管理器 ====================

/**
 * Supabase 知识图谱管理器
 */
export class SupabaseKnowledgeGraph {
  private supabase: ReturnType<typeof getSupabaseClient>;
  private initialized: boolean = false;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[SupabaseKnowledgeGraph] Initializing...');

    // 检查数据库连接
    const { data, error } = await this.supabase
      .from('kg_entities')
      .select('count')
      .limit(1);

    if (error) {
      console.error('[SupabaseKnowledgeGraph] Failed to connect to database:', error);
      throw error;
    }

    this.initialized = true;
    console.log('[SupabaseKnowledgeGraph] Initialized successfully');
  }

  /**
   * 添加节点
   */
  async addNode(node: {
    name: string;
    type: string;
    description?: string;
    aliases?: string[];
    properties?: any;
    importance?: number;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('kg_entities')
      .insert({
        name: node.name,
        type: node.type,
        description: node.description,
        aliases: node.aliases || [],
        properties: node.properties || {},
        importance: node.importance || 0.5,
        sourceType: 'llm',
        verified: false
      })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseKnowledgeGraph] Failed to add node:', error);
      throw error;
    }

    console.log(`[SupabaseKnowledgeGraph] Added node: ${node.name}`);
    return data.id;
  }

  /**
   * 批量添加节点
   */
  async addNodeBatch(nodes: Array<{
    name: string;
    type: string;
    description?: string;
    aliases?: string[];
    properties?: any;
    importance?: number;
  }>): Promise<string[]> {
    const ids: string[] = [];

    for (const node of nodes) {
      const id = await this.addNode(node);
      ids.push(id);
    }

    return ids;
  }

  /**
   * 添加边
   */
  async addEdge(edge: {
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    confidence?: number;
    evidence?: string;
    properties?: any;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('kg_relations')
      .insert({
        sourceEntityId: edge.sourceEntityId,
        targetEntityId: edge.targetEntityId,
        type: edge.type,
        confidence: edge.confidence || 0.5,
        evidence: edge.evidence,
        properties: edge.properties || {},
        sourceType: 'llm',
        verified: false
      })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseKnowledgeGraph] Failed to add edge:', error);
      throw error;
    }

    console.log(`[SupabaseKnowledgeGraph] Added edge: ${edge.type}`);
    return data.id;
  }

  /**
   * 获取节点
   */
  async getNode(id: string): Promise<SupabaseGraphNode | null> {
    const { data, error } = await this.supabase
      .from('kg_entities')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      aliases: data.aliases || [],
      description: data.description,
      importance: parseFloat(data.importance?.toString() || '0.5'),
      properties: data.properties,
      sourceType: data.sourceType,
      verified: data.verified,
      createdAt: new Date(data.createdAt).getTime(),
      updatedAt: new Date(data.updatedAt).getTime()
    };
  }

  /**
   * 获取边
   */
  async getEdge(id: string): Promise<SupabaseGraphEdge | null> {
    const { data, error } = await this.supabase
      .from('kg_relations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      sourceEntityId: data.sourceEntityId,
      targetEntityId: data.targetEntityId,
      type: data.type,
      confidence: parseFloat(data.confidence?.toString() || '0.5'),
      evidence: data.evidence,
      properties: data.properties,
      sourceType: data.sourceType,
      verified: data.verified,
      validFrom: data.validFrom,
      validTo: data.validTo,
      createdAt: new Date(data.createdAt).getTime(),
      updatedAt: new Date(data.updatedAt).getTime()
    };
  }

  /**
   * 获取节点的邻居
   */
  async getNeighbors(
    nodeId: string,
    relationType?: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<SupabaseGraphNode[]> {
    let neighbors: SupabaseGraphNode[] = [];

    if (direction === 'outgoing' || direction === 'both') {
      const { data: outgoingEdges } = await this.supabase
        .from('kg_relations')
        .select('*, kg_entities_target!inner(*)')
        .eq('sourceEntityId', nodeId)
        .limit(100);

      if (outgoingEdges) {
        for (const edge of outgoingEdges) {
          if (!relationType || edge.type === relationType) {
            const node = (edge as any).kg_entities_target;
            neighbors.push({
              id: node.id,
              name: node.name,
              type: node.type,
              aliases: node.aliases || [],
              description: node.description,
              importance: parseFloat(node.importance?.toString() || '0.5'),
              properties: node.properties,
              sourceType: node.sourceType,
              verified: node.verified,
              createdAt: new Date(node.createdAt).getTime(),
              updatedAt: new Date(node.updatedAt).getTime()
            });
          }
        }
      }
    }

    if (direction === 'incoming' || direction === 'both') {
      const { data: incomingEdges } = await this.supabase
        .from('kg_relations')
        .select('*, kg_entities_source!inner(*)')
        .eq('targetEntityId', nodeId)
        .limit(100);

      if (incomingEdges) {
        for (const edge of incomingEdges) {
          if (!relationType || edge.type === relationType) {
            const node = (edge as any).kg_entities_source;
            neighbors.push({
              id: node.id,
              name: node.name,
              type: node.type,
              aliases: node.aliases || [],
              description: node.description,
              importance: parseFloat(node.importance?.toString() || '0.5'),
              properties: node.properties,
              sourceType: node.sourceType,
              verified: node.verified,
              createdAt: new Date(node.createdAt).getTime(),
              updatedAt: new Date(node.updatedAt).getTime()
            });
          }
        }
      }
    }

    return neighbors;
  }

  /**
   * 广度优先搜索
   */
  async bfs(
    startId: string,
    maxDepth: number = 3,
    relationType?: string
  ): Promise<SupabaseGraphNode[]> {
    const visited = new Set<string>();
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startId, depth: 0 }];
    const result: SupabaseGraphNode[] = [];

    visited.add(startId);

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (depth > maxDepth) continue;

      const node = await this.getNode(nodeId);
      if (node) {
        result.push(node);
      }

      const neighbors = await this.getNeighbors(nodeId, relationType, 'outgoing');
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ nodeId: neighbor.id, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  /**
   * 查找最短路径（BFS）
   */
  async findShortestPath(
    sourceId: string,
    targetId: string,
    relationType?: string
  ): Promise<GraphPath | null> {
    const visited = new Set<string>();
    const queue: { nodeId: string; path: SupabaseGraphNode[] }[] = [];
    const startNode = await this.getNode(sourceId);

    if (!startNode) return null;

    queue.push({ nodeId: sourceId, path: [startNode] });
    visited.add(sourceId);

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === targetId) {
        // 获取路径中的边
        const edges: SupabaseGraphEdge[] = [];
        for (let i = 0; i < path.length - 1; i++) {
          const edge = await this.findEdgeBetween(path[i].id, path[i + 1].id, relationType);
          if (edge) edges.push(edge);
        }

        return {
          nodes: path,
          edges,
          length: path.length,
          totalConfidence: edges.reduce((sum, e) => sum + e.confidence, 0) / edges.length
        };
      }

      const neighbors = await this.getNeighbors(nodeId, relationType, 'outgoing');
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ nodeId: neighbor.id, path: [...path, neighbor] });
        }
      }
    }

    return null;
  }

  /**
   * 查找两个节点之间的边
   */
  private async findEdgeBetween(
    sourceId: string,
    targetId: string,
    relationType?: string
  ): Promise<SupabaseGraphEdge | null> {
    let query = this.supabase
      .from('kg_relations')
      .select('*')
      .eq('sourceEntityId', sourceId)
      .eq('targetEntityId', targetId);

    if (relationType) {
      query = query.eq('type', relationType);
    }

    const { data, error } = await query.single();

    if (error || !data) return null;

    return {
      id: data.id,
      sourceEntityId: data.sourceEntityId,
      targetEntityId: data.targetEntityId,
      type: data.type,
      confidence: parseFloat(data.confidence?.toString() || '0.5'),
      evidence: data.evidence,
      properties: data.properties,
      sourceType: data.sourceType,
      verified: data.verified,
      validFrom: data.validFrom,
      validTo: data.validTo,
      createdAt: new Date(data.createdAt).getTime(),
      updatedAt: new Date(data.updatedAt).getTime()
    };
  }

  /**
   * 按类型搜索节点
   */
  async searchNodesByType(type: string, limit: number = 100): Promise<SupabaseGraphNode[]> {
    const { data, error } = await this.supabase
      .from('kg_entities')
      .select('*')
      .eq('type', type)
      .order('importance', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      aliases: item.aliases || [],
      description: item.description,
      importance: parseFloat(item.importance?.toString() || '0.5'),
      properties: item.properties,
      sourceType: item.sourceType,
      verified: item.verified,
      createdAt: new Date(item.createdAt).getTime(),
      updatedAt: new Date(item.updatedAt).getTime()
    }));
  }

  /**
   * 按名称搜索节点
   */
  async searchNodesByName(query: string, limit: number = 100): Promise<SupabaseGraphNode[]> {
    const { data, error } = await this.supabase
      .from('kg_entities')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      aliases: item.aliases || [],
      description: item.description,
      importance: parseFloat(item.importance?.toString() || '0.5'),
      properties: item.properties,
      sourceType: item.sourceType,
      verified: item.verified,
      createdAt: new Date(item.createdAt).getTime(),
      updatedAt: new Date(item.updatedAt).getTime()
    }));
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<GraphStats> {
    const [nodesResult, edgesResult] = await Promise.all([
      this.supabase.from('kg_entities').select('*'),
      this.supabase.from('kg_relations').select('*')
    ]);

    const nodes = nodesResult.data || [];
    const edges = edgesResult.data || [];

    const typeDistribution: Record<string, number> = {};
    const relationTypeDistribution: Record<string, number> = {};
    let totalDegree = 0;

    // 统计节点类型
    for (const node of nodes) {
      typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;
    }

    // 统计边类型和度数
    for (const edge of edges) {
      relationTypeDistribution[edge.type] = (relationTypeDistribution[edge.type] || 0) + 1;
      totalDegree += 2; // 每条边贡献两个节点的度数
    }

    const avgDegree = nodes.length > 0 ? totalDegree / nodes.length : 0;

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      typeDistribution,
      relationTypeDistribution,
      avgDegree
    };
  }

  /**
   * 删除节点
   */
  async deleteNode(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('kg_entities')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseKnowledgeGraph] Failed to delete node:', error);
      throw error;
    }

    console.log(`[SupabaseKnowledgeGraph] Deleted node ${id}`);
  }

  /**
   * 删除边
   */
  async deleteEdge(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('kg_relations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseKnowledgeGraph] Failed to delete edge:', error);
      throw error;
    }

    console.log(`[SupabaseKnowledgeGraph] Deleted edge ${id}`);
  }

  /**
   * 更新节点
   */
  async updateNode(
    id: string,
    updates: {
      name?: string;
      type?: string;
      description?: string;
      aliases?: string[];
      properties?: any;
      importance?: number;
      verified?: boolean;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('kg_entities')
      .update({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('[SupabaseKnowledgeGraph] Failed to update node:', error);
      throw error;
    }

    console.log(`[SupabaseKnowledgeGraph] Updated node ${id}`);
  }

  /**
   * 更新边
   */
  async updateEdge(
    id: string,
    updates: {
      type?: string;
      confidence?: number;
      evidence?: string;
      properties?: any;
      verified?: boolean;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('kg_relations')
      .update({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('[SupabaseKnowledgeGraph] Failed to update edge:', error);
      throw error;
    }

    console.log(`[SupabaseKnowledgeGraph] Updated edge ${id}`);
  }

  /**
   * 导出知识图谱数据
   */
  async exportData(options: {
    type?: string;
    limit?: number;
    includeEdges?: boolean;
  } = {}): Promise<{
    nodes: SupabaseGraphNode[];
    edges: SupabaseGraphEdge[];
    metadata: {
      exportDate: string;
      nodeCount: number;
      edgeCount: number;
      types: string[];
    };
  }> {
    // 导出节点
    let nodeQuery = this.supabase
      .from('kg_entities')
      .select('*');

    if (options.type) {
      nodeQuery = nodeQuery.eq('type', options.type);
    }

    if (options.limit) {
      nodeQuery = nodeQuery.limit(options.limit);
    } else {
      nodeQuery = nodeQuery.limit(10000);
    }

    const { data: nodeData, error: nodeError } = await nodeQuery;

    if (nodeError) {
      throw new Error(`导出节点失败: ${nodeError.message}`);
    }

    const nodes: SupabaseGraphNode[] = nodeData.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      aliases: item.aliases || [],
      description: item.description,
      importance: parseFloat(item.importance?.toString() || '0.5'),
      properties: item.properties,
      sourceType: item.sourceType,
      verified: item.verified,
      createdAt: new Date(item.createdAt).getTime(),
      updatedAt: new Date(item.updatedAt).getTime()
    }));

    // 导出边
    let edges: SupabaseGraphEdge[] = [];
    if (options.includeEdges !== false) {
      let edgeQuery = this.supabase
        .from('kg_relations')
        .select('*');

      const { data: edgeData, error: edgeError } = await edgeQuery;

      if (!edgeError && edgeData) {
        edges = edgeData.map(item => ({
          id: item.id,
          sourceEntityId: item.sourceEntityId,
          targetEntityId: item.targetEntityId,
          type: item.type,
          confidence: parseFloat(item.confidence?.toString() || '0.5'),
          evidence: item.evidence,
          properties: item.properties,
          sourceType: item.sourceType,
          verified: item.verified,
          validFrom: item.validFrom,
          validTo: item.validTo,
          createdAt: new Date(item.createdAt).getTime(),
          updatedAt: new Date(item.updatedAt).getTime()
        }));
      }
    }

    const types = [...new Set(nodes.map(n => n.type))];

    return {
      nodes,
      edges,
      metadata: {
        exportDate: new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length,
        types
      }
    };
  }

  /**
   * 导入知识图谱数据
   */
  async importData(data: {
    nodes?: SupabaseGraphNode[];
    edges?: SupabaseGraphEdge[];
    metadata?: any;
  }, options: {
    skipExisting?: boolean;
    updateExisting?: boolean;
    validateReferences?: boolean;
    batchSize?: number;
  } = {}): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const {
      skipExisting = true,
      updateExisting = false,
      validateReferences = true,
      batchSize = 100
    } = options;

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // 导入节点
    if (data.nodes) {
      for (let i = 0; i < data.nodes.length; i += batchSize) {
        const batch = data.nodes.slice(i, i + batchSize);

        for (const node of batch) {
          try {
            if (skipExisting || updateExisting) {
              const { data: existing } = await this.supabase
                .from('kg_entities')
                .select('id')
                .eq('id', node.id)
                .single();

              if (existing) {
                if (skipExisting) {
                  continue;
                }
                if (updateExisting) {
                  const { error: updateError } = await this.supabase
                    .from('kg_entities')
                    .update({
                      name: node.name,
                      type: node.type,
                      description: node.description,
                      aliases: node.aliases,
                      importance: node.importance,
                      properties: node.properties,
                      verified: node.verified,
                      updatedAt: new Date(node.updatedAt).toISOString()
                    })
                    .eq('id', node.id);

                  if (updateError) {
                    errors.push(`更新节点 ${node.id} 失败: ${updateError.message}`);
                    failed++;
                  } else {
                    success++;
                  }
                  continue;
                }
              }
            }

            const { error: insertError } = await this.supabase
              .from('kg_entities')
              .insert({
                id: node.id,
                name: node.name,
                type: node.type,
                description: node.description,
                aliases: node.aliases,
                importance: node.importance,
                properties: node.properties,
                sourceType: node.sourceType,
                verified: node.verified,
                createdAt: new Date(node.createdAt).toISOString(),
                updatedAt: new Date(node.updatedAt).toISOString()
              });

            if (insertError) {
              errors.push(`导入节点 ${node.id} 失败: ${insertError.message}`);
              failed++;
            } else {
              success++;
            }
          } catch (error: any) {
            errors.push(`处理节点 ${node.id} 时出错: ${error.message}`);
            failed++;
          }
        }
      }
    }

    // 导入边
    if (data.edges) {
      for (let i = 0; i < data.edges.length; i += batchSize) {
        const batch = data.edges.slice(i, i + batchSize);

        for (const edge of batch) {
          try {
            // 验证引用的节点是否存在
            if (validateReferences) {
              const [sourceExists, targetExists] = await Promise.all([
                this.supabase
                  .from('kg_entities')
                  .select('id')
                  .eq('id', edge.sourceEntityId)
                  .single()
                  .then(r => !r.error),
                this.supabase
                  .from('kg_entities')
                  .select('id')
                  .eq('id', edge.targetEntityId)
                  .single()
                  .then(r => !r.error)
              ]);

              if (!sourceExists) {
                errors.push(`边 ${edge.id}: 源节点 ${edge.sourceEntityId} 不存在`);
                failed++;
                continue;
              }

              if (!targetExists) {
                errors.push(`边 ${edge.id}: 目标节点 ${edge.targetEntityId} 不存在`);
                failed++;
                continue;
              }
            }

            const { error: insertError } = await this.supabase
              .from('kg_relations')
              .insert({
                id: edge.id,
                sourceEntityId: edge.sourceEntityId,
                targetEntityId: edge.targetEntityId,
                type: edge.type,
                confidence: edge.confidence,
                evidence: edge.evidence,
                properties: edge.properties,
                sourceType: edge.sourceType,
                verified: edge.verified,
                validFrom: edge.validFrom,
                validTo: edge.validTo,
                createdAt: new Date(edge.createdAt).toISOString(),
                updatedAt: new Date(edge.updatedAt).toISOString()
              });

            if (insertError) {
              errors.push(`导入边 ${edge.id} 失败: ${insertError.message}`);
              failed++;
            } else {
              success++;
            }
          } catch (error: any) {
            errors.push(`处理边 ${edge.id} 时出错: ${error.message}`);
            failed++;
          }
        }
      }
    }

    console.log(`[SupabaseKnowledgeGraph] 导入完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed, errors };
  }

  /**
   * 清空知识图谱
   */
  async clearAll(options: {
    type?: string;
    confirm?: boolean;
    clearNodes?: boolean;
    clearEdges?: boolean;
  } = {}): Promise<{
    nodesCleared: number;
    edgesCleared: number;
  }> {
    if (!options.confirm) {
      throw new Error('需要确认才能清空数据（设置 confirm: true）');
    }

    let nodesCleared = 0;
    let edgesCleared = 0;

    if (options.clearEdges !== false) {
      let edgeQuery = this.supabase.from('kg_relations').delete();

      const { count: edgeCount } = await this.supabase
        .from('kg_relations')
        .select('*', { count: 'exact', head: true });

      const { error: edgeError } = await edgeQuery;

      if (!edgeError) {
        edgesCleared = edgeCount || 0;
      }
    }

    if (options.clearNodes !== false) {
      let nodeQuery = this.supabase.from('kg_entities').delete();

      if (options.type) {
        nodeQuery = nodeQuery.eq('type', options.type);
      }

      const { count: nodeCount } = await this.supabase
        .from('kg_entities')
        .select('*', { count: 'exact', head: true });

      const { error: nodeError } = await nodeQuery;

      if (!nodeError) {
        nodesCleared = nodeCount || 0;
      }
    }

    console.log(`[SupabaseKnowledgeGraph] Cleared ${nodesCleared} nodes, ${edgesCleared} edges`);
    return { nodesCleared, edgesCleared };
  }
}

// ==================== 单例导出 ====================

let supabaseKnowledgeGraphInstance: SupabaseKnowledgeGraph | null = null;

export function getSupabaseKnowledgeGraph(): SupabaseKnowledgeGraph {
  if (!supabaseKnowledgeGraphInstance) {
    supabaseKnowledgeGraphInstance = new SupabaseKnowledgeGraph();
  }
  return supabaseKnowledgeGraphInstance;
}
