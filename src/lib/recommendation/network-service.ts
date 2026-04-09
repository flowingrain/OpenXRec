/**
 * 协同过滤网络数据提取服务
 * 
 * 从推荐系统中提取用户-物品关系网络数据，用于可视化
 */

import type {
  NetworkData,
  NetworkNode,
  NetworkEdge,
  NetworkConfig,
  NetworkStatistics,
} from './network-types';
import { DEFAULT_NETWORK_CONFIG } from './network-types';

// ============================================================================
// 网络数据服务
// ============================================================================

/**
 * 网络数据提取服务
 */
export class NetworkDataService {
  /**
   * 为用户构建推荐网络
   */
  async buildUserNetwork(
    userId: string,
    config: Partial<NetworkConfig> = {}
  ): Promise<NetworkData> {
    const fullConfig: NetworkConfig = {
      ...DEFAULT_NETWORK_CONFIG,
      ...config,
      userId,
    };
    
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];
    const nodeIds = new Set<string>();
    
    // 1. 添加用户节点
    const userNode = this.createUserNode(userId);
    nodes.push(userNode);
    nodeIds.add(userNode.id);
    
    // 2. 获取用户交互的物品
    const userItems = await this.getUserInteractions(userId, fullConfig);
    for (const item of userItems) {
      if (!nodeIds.has(item.id)) {
        nodes.push(item.node);
        nodeIds.add(item.id);
      }
      edges.push(item.edge);
    }
    
    // 3. 获取相似用户
    if (fullConfig.includeSimilarities) {
      const similarUsers = await this.getSimilarUsers(userId, fullConfig);
      for (const user of similarUsers) {
        if (!nodeIds.has(user.id)) {
          nodes.push(user.node);
          nodeIds.add(user.id);
        }
        edges.push(user.edge);
        
        // 获取相似用户的物品
        if (fullConfig.depth >= 2) {
          const similarUserItems = await this.getUserInteractions(user.id, fullConfig);
          for (const item of similarUserItems) {
            if (!nodeIds.has(item.id)) {
              nodes.push(item.node);
              nodeIds.add(item.id);
            }
            edges.push(item.edge);
          }
        }
      }
    }
    
    // 4. 获取推荐物品
    if (fullConfig.includeRecommendations) {
      const recommendations = await this.getRecommendations(userId, fullConfig);
      for (const rec of recommendations) {
        if (!nodeIds.has(rec.id)) {
          nodes.push(rec.node);
          nodeIds.add(rec.id);
        }
        edges.push(rec.edge);
      }
    }
    
    // 5. 获取物品相似关系
    if (fullConfig.includeSimilarities && fullConfig.depth >= 2) {
      const itemSimilarities = await this.getItemSimilarities(
        nodes.filter(n => n.type === 'item').map(n => n.id),
        fullConfig
      );
      for (const sim of itemSimilarities) {
        if (!nodeIds.has(sim.from) || !nodeIds.has(sim.to)) continue;
        edges.push(sim.edge);
      }
    }
    
    // 6. 应用过滤
    const filteredData = this.applyFilters({ nodes, edges }, fullConfig);
    
    // 7. 计算统计信息
    const stats = this.calculateStatistics(filteredData);
    
    return {
      ...filteredData,
      stats,
      metadata: {
        userId,
        scenario: fullConfig.scenario,
        depth: fullConfig.depth,
        generatedAt: Date.now(),
      },
    };
  }
  
  /**
   * 创建用户节点
   */
  private createUserNode(userId: string): NetworkNode {
    return {
      id: `user_${userId}`,
      label: `用户 ${userId.substring(0, 6)}`,
      type: 'user',
      shape: 'circle',
      size: 30,
      color: '#4A90E2',
      metadata: {
        userId,
      },
      highlighted: true,
    };
  }
  
  /**
   * 创建物品节点
   */
  private createItemNode(
    itemId: string,
    metadata: {
      title?: string;
      category?: string;
      popularity?: number;
    }
  ): NetworkNode {
    return {
      id: `item_${itemId}`,
      label: metadata.title || `物品 ${itemId.substring(0, 6)}`,
      type: 'item',
      shape: 'box',
      size: 20 + Math.min(20, (metadata.popularity || 0) * 5),
      color: '#7ED321',
      metadata: {
        itemId,
        category: metadata.category,
        popularity: metadata.popularity,
      },
    };
  }
  
  /**
   * 获取用户交互的物品
   */
  private async getUserInteractions(
    userId: string,
    config: NetworkConfig
  ): Promise<Array<{ id: string; node: NetworkNode; edge: NetworkEdge }>> {
    // 模拟数据 - 实际应从数据库获取
    const interactions = await this.fetchUserInteractions(userId, config.maxNodes);
    
    return interactions.map(interaction => ({
      id: `item_${interaction.itemId}`,
      node: this.createItemNode(interaction.itemId, {
        title: interaction.title,
        category: interaction.category,
        popularity: interaction.popularity,
      }),
      edge: {
        id: `edge_${userId}_${interaction.itemId}`,
        from: `user_${userId}`,
        to: `item_${interaction.itemId}`,
        type: 'interaction' as const,
        value: interaction.rating || 1,
        color: this.getInteractionColor(interaction.type),
        metadata: {
          interactionType: interaction.type,
          rating: interaction.rating,
          timestamp: interaction.timestamp,
        },
      },
    }));
  }
  
  /**
   * 获取相似用户
   */
  private async getSimilarUsers(
    userId: string,
    config: NetworkConfig
  ): Promise<Array<{ id: string; node: NetworkNode; edge: NetworkEdge }>> {
    // 模拟数据 - 实际应从协同过滤算法获取
    const similarUsers = await this.fetchSimilarUsers(userId, config.minSimilarity);
    
    return similarUsers.map(user => ({
      id: `user_${user.userId}`,
      node: {
        id: `user_${user.userId}`,
        label: `用户 ${user.userId.substring(0, 6)}`,
        type: 'user' as const,
        shape: 'circle',
        size: 25,
        color: '#4A90E2',
        metadata: {
          userId: user.userId,
        },
      },
      edge: {
        id: `sim_${userId}_${user.userId}`,
        from: `user_${userId}`,
        to: `user_${user.userId}`,
        type: 'similarity' as const,
        value: user.similarity,
        color: '#9B9B9B',
        dashes: true,
        width: 1 + user.similarity * 2,
        metadata: {
          similarityScore: user.similarity,
          commonItems: user.commonItems,
        },
      },
    }));
  }
  
  /**
   * 获取推荐物品
   */
  private async getRecommendations(
    userId: string,
    config: NetworkConfig
  ): Promise<Array<{ id: string; node: NetworkNode; edge: NetworkEdge }>> {
    // 模拟数据 - 实际应从推荐引擎获取
    const recommendations = await this.fetchRecommendations(
      userId,
      config.minRecommendationScore
    );
    
    return recommendations.map(rec => ({
      id: `item_${rec.itemId}`,
      node: this.createItemNode(rec.itemId, {
        title: rec.title,
        category: rec.category,
        popularity: rec.popularity,
      }),
      edge: {
        id: `rec_${userId}_${rec.itemId}`,
        from: `user_${userId}`,
        to: `item_${rec.itemId}`,
        type: 'recommendation' as const,
        value: rec.score,
        color: '#FF6B35',
        width: 2 + rec.score * 2,
        arrows: 'to',
        metadata: {
          recommendationScore: rec.score,
          confidence: rec.confidence,
          reason: rec.reason,
          strategy: rec.strategy,
        },
        highlighted: true,
      },
    }));
  }
  
  /**
   * 获取物品相似关系
   */
  private async getItemSimilarities(
    itemIds: string[],
    config: NetworkConfig
  ): Promise<Array<{ from: string; to: string; edge: NetworkEdge }>> {
    // 模拟数据 - 实际应从物品相似度矩阵获取
    const similarities = await this.fetchItemSimilarities(itemIds, config.minSimilarity);
    
    return similarities.map(sim => ({
      from: `item_${sim.itemId1}`,
      to: `item_${sim.itemId2}`,
      edge: {
        id: `sim_${sim.itemId1}_${sim.itemId2}`,
        from: `item_${sim.itemId1}`,
        to: `item_${sim.itemId2}`,
        type: 'similarity' as const,
        value: sim.similarity,
        color: '#9B9B9B',
        dashes: true,
        width: sim.similarity * 2,
        metadata: {
          similarityScore: sim.similarity,
        },
      },
    }));
  }
  
  /**
   * 应用过滤规则
   */
  private applyFilters(
    data: { nodes: NetworkNode[]; edges: NetworkEdge[] },
    config: NetworkConfig
  ): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
    let { nodes, edges } = data;
    
    // 过滤边
    edges = edges.filter(edge => {
      if (edge.type === 'similarity') {
        return (edge.value || 0) >= config.minSimilarity;
      }
      if (edge.type === 'recommendation') {
        return (edge.value || 0) >= config.minRecommendationScore;
      }
      return true;
    });
    
    // 过滤孤立节点
    const connectedNodeIds = new Set<string>();
    edges.forEach(edge => {
      connectedNodeIds.add(edge.from);
      connectedNodeIds.add(edge.to);
    });
    nodes = nodes.filter(node => connectedNodeIds.has(node.id));
    
    // 限制数量
    if (nodes.length > config.maxNodes) {
      // 保留高亮节点和高度节点
      const nodeDegrees = this.calculateNodeDegrees(nodes, edges);
      nodes = nodes
        .sort((a, b) => {
          if (a.highlighted && !b.highlighted) return -1;
          if (!a.highlighted && b.highlighted) return 1;
          return (nodeDegrees.get(b.id) || 0) - (nodeDegrees.get(a.id) || 0);
        })
        .slice(0, config.maxNodes);
      
      // 过滤边
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
    }
    
    if (edges.length > config.maxEdges) {
      edges = edges
        .sort((a, b) => (b.value || 0) - (a.value || 0))
        .slice(0, config.maxEdges);
    }
    
    return { nodes, edges };
  }
  
  /**
   * 计算节点度
   */
  private calculateNodeDegrees(
    nodes: NetworkNode[],
    edges: NetworkEdge[]
  ): Map<string, number> {
    const degrees = new Map<string, number>();
    nodes.forEach(n => degrees.set(n.id, 0));
    edges.forEach(e => {
      degrees.set(e.from, (degrees.get(e.from) || 0) + 1);
      degrees.set(e.to, (degrees.get(e.to) || 0) + 1);
    });
    return degrees;
  }
  
  /**
   * 计算网络统计信息
   */
  private calculateStatistics(data: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
  }): NetworkStatistics {
    const { nodes, edges } = data;
    const degrees = this.calculateNodeDegrees(nodes, edges);
    const degreeValues = Array.from(degrees.values());
    
    const userCount = nodes.filter(n => n.type === 'user').length;
    const itemCount = nodes.filter(n => n.type === 'item').length;
    
    const interactionCount = edges.filter(e => e.type === 'interaction').length;
    const similarityCount = edges.filter(e => e.type === 'similarity').length;
    const recommendationCount = edges.filter(e => e.type === 'recommendation').length;
    
    // 计算平均度
    const avgDegree = degreeValues.length > 0
      ? degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length
      : 0;
    
    // 计算密度
    const maxEdges = nodes.length * (nodes.length - 1);
    const density = maxEdges > 0 ? edges.length / maxEdges : 0;
    
    // 计算高度节点
    const topDegreeNodes = nodes
      .map(n => ({ nodeId: n.id, degree: degrees.get(n.id) || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 10);
    
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      avgDegree,
      maxDegree: Math.max(...degreeValues, 0),
      minDegree: Math.min(...degreeValues, 0),
      avgClusteringCoefficient: 0, // 需要复杂计算
      avgPathLength: 0,            // 需要复杂计算
      diameter: 0,                 // 需要复杂计算
      topDegreeNodes,
      topBetweennessNodes: [],     // 需要复杂计算
      communityCount: 0,           // 需要复杂计算
      communities: [],
    };
  }
  
  /**
   * 获取交互颜色
   */
  private getInteractionColor(type: string): string {
    switch (type) {
      case 'purchase':
        return '#4CAF50';
      case 'rating':
        return '#2196F3';
      case 'click':
        return '#9E9E9E';
      case 'view':
        return '#BDBDBD';
      default:
        return '#888888';
    }
  }
  
  // ===========================================================================
  // 数据获取方法（模拟）
  // ===========================================================================
  
  /**
   * 获取用户交互数据
   */
  private async fetchUserInteractions(
    userId: string,
    limit: number
  ): Promise<Array<{
    itemId: string;
    title?: string;
    category?: string;
    type: 'purchase' | 'click' | 'rating' | 'view';
    rating?: number;
    timestamp?: number;
    popularity?: number;
  }>> {
    // 模拟数据 - 实际应从 Supabase 获取
    const count = Math.min(limit, 15);
    return Array.from({ length: count }, (_, i) => ({
      itemId: `item_${i + 1}`,
      title: `物品 ${i + 1}`,
      category: ['电子产品', '服装', '食品', '书籍'][i % 4],
      type: (['purchase', 'click', 'rating', 'view'] as const)[i % 4],
      rating: 3 + Math.random() * 2,
      timestamp: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      popularity: Math.random() * 10,
    }));
  }
  
  /**
   * 获取相似用户
   */
  private async fetchSimilarUsers(
    userId: string,
    minSimilarity: number
  ): Promise<Array<{
    userId: string;
    similarity: number;
    commonItems: number;
  }>> {
    // 模拟数据 - 实际应从协同过滤算法获取
    const count = Math.floor(Math.random() * 5) + 3;
    return Array.from({ length: count }, (_, i) => ({
      userId: `user_${100 + i}`,
      similarity: minSimilarity + Math.random() * (1 - minSimilarity),
      commonItems: Math.floor(Math.random() * 10) + 3,
    }));
  }
  
  /**
   * 获取推荐物品
   */
  private async fetchRecommendations(
    userId: string,
    minScore: number
  ): Promise<Array<{
    itemId: string;
    title?: string;
    category?: string;
    score: number;
    confidence: number;
    reason?: string;
    strategy?: 'collaborative' | 'content_based' | 'hybrid';
    popularity?: number;
  }>> {
    // 模拟数据 - 实际应从推荐引擎获取
    const count = Math.floor(Math.random() * 5) + 5;
    return Array.from({ length: count }, (_, i) => ({
      itemId: `item_${100 + i}`,
      title: `推荐物品 ${i + 1}`,
      category: ['电子产品', '服装', '食品', '书籍'][i % 4],
      score: minScore + Math.random() * (1 - minScore),
      confidence: 0.5 + Math.random() * 0.5,
      reason: ['相似用户购买', '基于您的浏览历史', '热门推荐'][i % 3],
      strategy: (['collaborative', 'content_based', 'hybrid'] as const)[i % 3],
      popularity: Math.random() * 10,
    }));
  }
  
  /**
   * 获取物品相似度
   */
  private async fetchItemSimilarities(
    itemIds: string[],
    minSimilarity: number
  ): Promise<Array<{
    itemId1: string;
    itemId2: string;
    similarity: number;
  }>> {
    // 模拟数据 - 实际应从物品相似度矩阵获取
    const similarities: Array<{
      itemId1: string;
      itemId2: string;
      similarity: number;
    }> = [];
    
    for (let i = 0; i < itemIds.length && i < 10; i++) {
      for (let j = i + 1; j < itemIds.length && j < 10; j++) {
        const sim = minSimilarity + Math.random() * (1 - minSimilarity);
        if (sim > 0.5) {
          similarities.push({
            itemId1: itemIds[i].replace('item_', ''),
            itemId2: itemIds[j].replace('item_', ''),
            similarity: sim,
          });
        }
      }
    }
    
    return similarities;
  }
}

// ============================================================================
// 单例
// ============================================================================

let networkServiceInstance: NetworkDataService | null = null;

export function getNetworkDataService(): NetworkDataService {
  if (!networkServiceInstance) {
    networkServiceInstance = new NetworkDataService();
  }
  return networkServiceInstance;
}

export default NetworkDataService;
