/**
 * 动态传导路径发现系统
 * 
 * 核心理念：
 * - 传导路径不是静态配置的，而是由智能体协作动态发现
 * - 基于当前分析内容实时构建传导网络
 * - 利用历史模式辅助，但不限制发现新的传导路径
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import { 
  CausalChainNode, 
  KeyFactor, 
  TimelineEvent,
  SearchItem 
} from './state';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 动态传导节点
 */
export interface PropagationNode {
  id: string;
  name: string;
  type: 'source' | 'intermediary' | 'target' | 'amplifier' | 'buffer';
  description: string;
  attributes: {
    sector?: string;          // 所属领域/行业
    region?: string;          // 地理区域
    market?: string;          // 相关市场
    sensitivity?: number;     // 敏感度 (0-1)
    resilience?: number;      // 韧性/抵抗力 (0-1)
  };
  state?: {
    currentValue?: string;
    trend?: 'up' | 'down' | 'stable';
    volatility?: number;
  };
}

/**
 * 动态传导边
 */
export interface PropagationEdge {
  id: string;
  sourceId: string;
  targetId: string;
  
  // 传导机制
  mechanism: {
    type: 'causal' | 'correlation' | 'behavioral' | 'structural' | 'contagion';
    description: string;       // 传导机制描述
    channel: string;           // 传导渠道（资金流、信息流、供应链等）
    timeLag: string;           // 时滞
  };
  
  // 传导强度
  strength: {
    value: number;             // 强度值 (0-1)
    confidence: number;        // 置信度
    factors: string[];         // 影响强度的因素
    evidence: string[];        // 证据来源
  };
  
  // 传导条件
  conditions?: {
    prerequisites: string[];   // 前置条件
    triggers: string[];        // 触发条件
    inhibitors: string[];      // 抑制因素
  };
  
  // 历史参考
  historicalCases?: {
    event: string;
    timeLag: string;
    actualImpact: string;
  }[];
}

/**
 * 传导路径（简化格式，用于图谱展示）
 */
export interface PropagationPath {
  id: string;
  pathName: string;
  sourceNode: string;
  targetNodes: string[];
  pathStrength: number;
  transmissionDelay: string;
  transmissionMechanism: string;
  historicalPrecedents?: string[];
}

/**
 * 传导网络
 */
export interface PropagationNetwork {
  id: string;
  query: string;
  createdAt: string;
  
  nodes: PropagationNode[];
  edges: PropagationEdge[];
  
  // 传导路径（简化格式）
  paths: PropagationPath[];
  
  // 网络特征
  characteristics: {
    totalNodes: number;
    totalEdges: number;
    avgPathLength: number;
    clusteringCoefficient: number;
    criticalNodes: string[];     // 关键节点
    vulnerablePaths: string[];   // 脆弱路径
  };
  
  // 发现来源
  discoverySources: {
    agent: string;
    contribution: string;
  }[];
  
  // 置信度和影响评估
  confidence: number;
  totalImpact: number;           // 整体影响强度
}

/**
 * 智能体协作发现结果
 */
export interface CollaborativeDiscoveryResult {
  network: PropagationNetwork;
  contributions: {
    agentId: string;
    agentName: string;
    discoveredNodes: PropagationNode[];
    discoveredEdges: PropagationEdge[];
    reasoning: string;
  }[];
  consensus: {
    agreedNodes: string[];
    agreedEdges: string[];
    disputedItems: string[];
    overallConfidence: number;
  };
  // 新增字段
  consensusLevel: number;         // 共识水平 (0-1)
  collaborationRounds: number;    // 协作轮次
  participatingAgents: string[];  // 参与智能体列表
  recommendations: string[];      // 建议列表
}

// ============================================================================
// 传导路径发现器
// ============================================================================

/**
 * 动态传导路径发现器
 */
export class PropagationPathFinder {
  private llmClient: LLMClient;
  
  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * 智能体协作发现传导网络
   * 
   * 执行流程：
   * 1. 分析师智能体提出初始传导假设
   * 2. 验证者智能体验证传导机制
   * 3. CIK专家补充领域知识
   * 4. 共识融合形成最终网络
   */
  async discoverPropagationNetwork(
    query: string,
    causalChain: CausalChainNode[],
    keyFactors: KeyFactor[],
    timeline: TimelineEvent[],
    searchResults: SearchItem[]
  ): Promise<CollaborativeDiscoveryResult> {
    
    console.log('[PathFinder] Starting collaborative discovery...');
    
    // 第一阶段：分析师提出初始假设
    const analystHypothesis = await this.analystDiscovery(
      query, causalChain, keyFactors, searchResults
    );
    
    // 第二阶段：验证者验证传导机制
    const validatorResult = await this.validatorVerification(
      analystHypothesis, timeline, searchResults
    );
    
    // 第三阶段：领域专家补充知识
    const expertEnhancement = await this.expertEnhancement(
      analystHypothesis, keyFactors
    );
    
    // 第四阶段：共识融合
    const finalNetwork = this.mergeDiscoveries(
      analystHypothesis,
      validatorResult,
      expertEnhancement
    );
    
    return finalNetwork;
  }

  /**
   * 分析师智能体发现传导路径
   */
  private async analystDiscovery(
    query: string,
    causalChain: CausalChainNode[],
    keyFactors: KeyFactor[],
    searchResults: SearchItem[]
  ): Promise<{
    nodes: PropagationNode[];
    edges: PropagationEdge[];
    reasoning: string;
  }> {
    
    const systemPrompt = `你是宏观分析专家，负责发现和构建风险传导路径。

## 核心任务
基于当前分析内容，动态发现风险传导路径，而不是使用预定义的模式。

## 发现原则

### 1. 传导节点识别
- **源头节点**：事件/政策的起源点
- **中介节点**：传导过程中的关键环节
- **目标节点**：最终受影响的实体/市场
- **放大节点**：放大传导效应的因素
- **缓冲节点**：减缓传导效应的因素

### 2. 传导机制识别
- **因果传导**：A直接导致B
- **相关性传导**：A和B因共同因素联动
- **行为传导**：市场参与者行为变化
- **结构传导**：制度/结构关联
- **传染传导**：信心/恐慌蔓延

### 3. 强度评估
- 基于证据质量评估置信度
- 考虑传导路径的历史验证
- 评估当前环境与历史的差异

## 输出要求
输出JSON格式，包含nodes和edges数组，以及reasoning说明发现逻辑。`;

    const userPrompt = `请基于以下分析内容，发现风险传导路径。

## 分析主题
${query}

## 因果链
${causalChain.map((c, i) => `${i + 1}. [${c.type}] ${c.factor}: ${c.description} (强度: ${c.strength})`).join('\n')}

## 关键因素
${keyFactors.map((f, i) => `${i + 1}. ${f.factor} (${f.dimension}): ${f.description}`).join('\n')}

## 信息来源
${searchResults.slice(0, 5).map((s, i) => `${i + 1}. ${s.title}`).join('\n')}

请严格按照以下JSON格式输出（不要包含markdown代码块标记）：
{
  "nodes": [
    {
      "id": "node_1",
      "name": "节点名称",
      "type": "source|intermediary|target|amplifier|buffer",
      "description": "节点描述",
      "attributes": {
        "sector": "所属领域",
        "region": "地理区域",
        "sensitivity": 0.8,
        "resilience": 0.5
      },
      "state": {
        "currentValue": "当前状态",
        "trend": "up|down|stable",
        "volatility": 0.3
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "sourceId": "node_1",
      "targetId": "node_2",
      "mechanism": {
        "type": "causal|correlation|behavioral|structural|contagion",
        "description": "传导机制描述",
        "channel": "传导渠道",
        "timeLag": "时滞估计"
      },
      "strength": {
        "value": 0.75,
        "confidence": 0.8,
        "factors": ["影响强度的因素"],
        "evidence": ["证据来源"]
      },
      "conditions": {
        "prerequisites": ["前置条件"],
        "triggers": ["触发条件"],
        "inhibitors": ["抑制因素"]
      }
    }
  ],
  "reasoning": "发现逻辑说明"
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3
      });

      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[PathFinder] Analyst discovered ${parsed.nodes?.length || 0} nodes, ${parsed.edges?.length || 0} edges`);
        return {
          nodes: parsed.nodes || [],
          edges: parsed.edges || [],
          reasoning: parsed.reasoning || ''
        };
      }
    } catch (error) {
      console.error('[PathFinder] Analyst discovery error:', error);
    }
    
    return { nodes: [], edges: [], reasoning: '发现失败' };
  }

  /**
   * 验证者智能体验证传导机制
   */
  private async validatorVerification(
    analystHypothesis: { nodes: PropagationNode[]; edges: PropagationEdge[]; reasoning: string },
    timeline: TimelineEvent[],
    searchResults: SearchItem[]
  ): Promise<{
    validatedNodes: string[];
    validatedEdges: string[];
    disputedEdges: string[];
    corrections: PropagationEdge[];
  }> {
    
    if (analystHypothesis.edges.length === 0) {
      return { validatedNodes: [], validatedEdges: [], disputedEdges: [], corrections: [] };
    }

    const systemPrompt = `你是验证专家，负责验证传导路径的合理性和可靠性。

## 验证维度

### 1. 逻辑一致性
- 传导机制是否符合因果逻辑
- 时间顺序是否合理
- 强度评估是否有依据

### 2. 证据支撑
- 是否有信息来源支持
- 历史是否有类似案例
- 理论框架是否成立

### 3. 可行性评估
- 传导渠道是否真实存在
- 时滞估计是否合理
- 前置条件是否满足

## 输出要求
输出JSON格式，标记哪些传导边得到验证，哪些存在争议，并提供修正建议。`;

    const userPrompt = `请验证以下传导路径。

## 待验证的传导边
${analystHypothesis.edges.map((e, i) => 
  `${i + 1}. ${analystHypothesis.nodes.find(n => n.id === e.sourceId)?.name || e.sourceId} 
     → ${analystHypothesis.nodes.find(n => n.id === e.targetId)?.name || e.targetId}
     [${e.mechanism.type}] 强度: ${e.strength.value}, 置信度: ${e.strength.confidence}
     机制: ${e.mechanism.description}`
).join('\n')}

## 相关事件时间线
${timeline.slice(0, 5).map((e, i) => `${i + 1}. [${e.timestamp}] ${e.event}`).join('\n')}

## 信息来源
${searchResults.slice(0, 3).map((s, i) => `${i + 1}. ${s.title}`).join('\n')}

请严格按照以下JSON格式输出：
{
  "validatedEdges": ["edge_1", "edge_2"],
  "disputedEdges": ["edge_3"],
  "disputes": [
    {
      "edgeId": "edge_3",
      "issue": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "corrections": [
    {
      "originalEdgeId": "edge_3",
      "correctedEdge": {
        "id": "edge_3_corrected",
        "sourceId": "node_1",
        "targetId": "node_3",
        "mechanism": { ... },
        "strength": { ... }
      }
    }
  ],
  "overallAssessment": "整体评估"
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.2
      });

      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[PathFinder] Validator validated ${parsed.validatedEdges?.length || 0} edges, disputed ${parsed.disputedEdges?.length || 0}`);
        return {
          validatedNodes: [],
          validatedEdges: parsed.validatedEdges || [],
          disputedEdges: parsed.disputedEdges || [],
          corrections: parsed.corrections?.map((c: any) => c.correctedEdge).filter(Boolean) || []
        };
      }
    } catch (error) {
      console.error('[PathFinder] Validator verification error:', error);
    }
    
    return { 
      validatedNodes: [], 
      validatedEdges: analystHypothesis.edges.map(e => e.id),
      disputedEdges: [], 
      corrections: [] 
    };
  }

  /**
   * 领域专家增强传导网络
   */
  private async expertEnhancement(
    analystHypothesis: { nodes: PropagationNode[]; edges: PropagationEdge[] },
    keyFactors: KeyFactor[]
  ): Promise<{
    additionalNodes: PropagationNode[];
    additionalEdges: PropagationEdge[];
    enhancements: {
      edgeId: string;
      enhancement: string;
    }[];
  }> {
    
    if (analystHypothesis.nodes.length === 0) {
      return { additionalNodes: [], additionalEdges: [], enhancements: [] };
    }

    const systemPrompt = `你是领域专家，负责补充和增强传导网络。

## 任务
1. 检查是否有遗漏的重要传导节点
2. 补充领域特定的传导机制
3. 提供更精确的强度评估依据`;

    const userPrompt = `请检查并增强以下传导网络。

## 现有节点
${analystHypothesis.nodes.map((n, i) => 
  `${i + 1}. [${n.type}] ${n.name}: ${n.description}`
).join('\n')}

## 现有传导边
${analystHypothesis.edges.map((e, i) => 
  `${i + 1}. ${e.sourceId} → ${e.targetId} [${e.mechanism.type}]`
).join('\n')}

## 关键因素
${keyFactors.map((f, i) => `${i + 1}. ${f.factor}: ${f.description}`).join('\n')}

请输出JSON格式：
{
  "additionalNodes": [
    {
      "id": "additional_node_1",
      "name": "节点名称",
      "type": "intermediary",
      "description": "为何此节点重要",
      ...
    }
  ],
  "additionalEdges": [
    {
      "id": "additional_edge_1",
      "sourceId": "node_x",
      "targetId": "additional_node_1",
      "mechanism": { ... },
      "strength": { ... }
    }
  ],
  "enhancements": [
    {
      "edgeId": "edge_1",
      "enhancement": "增强说明，如补充历史案例、修正强度评估等"
    }
  ],
  "expertInsight": "领域专家的整体洞察"
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3
      });

      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[PathFinder] Expert added ${parsed.additionalNodes?.length || 0} nodes, ${parsed.additionalEdges?.length || 0} edges`);
        return {
          additionalNodes: parsed.additionalNodes || [],
          additionalEdges: parsed.additionalEdges || [],
          enhancements: parsed.enhancements || []
        };
      }
    } catch (error) {
      console.error('[PathFinder] Expert enhancement error:', error);
    }
    
    return { additionalNodes: [], additionalEdges: [], enhancements: [] };
  }

  /**
   * 融合多个智能体的发现结果
   */
  private mergeDiscoveries(
    analystHypothesis: { nodes: PropagationNode[]; edges: PropagationEdge[]; reasoning: string },
    validatorResult: {
      validatedEdges: string[];
      disputedEdges: string[];
      corrections: PropagationEdge[];
    },
    expertEnhancement: {
      additionalNodes: PropagationNode[];
      additionalEdges: PropagationEdge[];
      enhancements: { edgeId: string; enhancement: string }[];
    }
  ): CollaborativeDiscoveryResult {
    
    // 合并节点
    const allNodes = [...analystHypothesis.nodes, ...expertEnhancement.additionalNodes];
    
    // 处理传导边：验证通过的 + 修正的 + 新增的
    const validatedEdges = analystHypothesis.edges.filter(
      e => validatorResult.validatedEdges.includes(e.id)
    );
    
    const correctedEdges = validatorResult.corrections;
    const newEdges = expertEnhancement.additionalEdges;
    
    const allEdges = [...validatedEdges, ...correctedEdges, ...newEdges];
    
    // 计算共识
    const agreedNodes = allNodes.map(n => n.id);
    const agreedEdges = validatedEdges.map(e => e.id);
    const disputedItems = validatorResult.disputedEdges;
    
    // 计算整体置信度
    const avgConfidence = allEdges.reduce((sum, e) => sum + (e.strength?.confidence || 0.5), 0) / Math.max(allEdges.length, 1);
    
    // 计算整体影响强度
    const totalImpact = allEdges.reduce((sum, e) => sum + (e.strength?.value || 0.5), 0) / Math.max(allEdges.length, 1);
    
    // 生成传导路径（简化格式）
    const paths: PropagationPath[] = allEdges.map((edge, i) => {
      const sourceNode = allNodes.find(n => n.id === edge.sourceId);
      const targetNode = allNodes.find(n => n.id === edge.targetId);
      return {
        id: `path_${i}`,
        pathName: `${sourceNode?.name || edge.sourceId} → ${targetNode?.name || edge.targetId}`,
        sourceNode: sourceNode?.name || edge.sourceId,
        targetNodes: [targetNode?.name || edge.targetId],
        pathStrength: edge.strength?.value || 0.5,
        transmissionDelay: edge.mechanism?.timeLag || '未知',
        transmissionMechanism: edge.mechanism?.description || '',
        historicalPrecedents: edge.historicalCases?.map(c => c.event)
      };
    });
    
    // 构建网络
    const network: PropagationNetwork = {
      id: `network_${Date.now()}`,
      query: '',
      createdAt: new Date().toISOString(),
      nodes: allNodes,
      edges: allEdges,
      paths,
      characteristics: {
        totalNodes: allNodes.length,
        totalEdges: allEdges.length,
        avgPathLength: this.calculateAvgPathLength(allNodes, allEdges),
        clusteringCoefficient: 0.5,
        criticalNodes: this.identifyCriticalNodes(allNodes, allEdges),
        vulnerablePaths: this.identifyVulnerablePaths(allEdges)
      },
      discoverySources: [
        { agent: 'analyst', contribution: '初始发现' },
        { agent: 'validator', contribution: '验证和修正' },
        { agent: 'expert', contribution: '领域知识补充' }
      ],
      confidence: avgConfidence,
      totalImpact
    };
    
    // 生成建议
    const recommendations: string[] = [
      ...network.characteristics.criticalNodes.map(n => `关注关键节点: ${allNodes.find(node => node.id === n)?.name || n}`),
      ...network.characteristics.vulnerablePaths.map(p => `验证脆弱路径: ${p}`)
    ];
    
    return {
      network,
      contributions: [
        {
          agentId: 'analyst',
          agentName: '分析师',
          discoveredNodes: analystHypothesis.nodes,
          discoveredEdges: analystHypothesis.edges,
          reasoning: analystHypothesis.reasoning
        },
        {
          agentId: 'validator',
          agentName: '验证者',
          discoveredNodes: [],
          discoveredEdges: validatorResult.corrections,
          reasoning: '验证传导机制，修正争议路径'
        },
        {
          agentId: 'expert',
          agentName: '领域专家',
          discoveredNodes: expertEnhancement.additionalNodes,
          discoveredEdges: expertEnhancement.additionalEdges,
          reasoning: '补充领域知识'
        }
      ],
      consensus: {
        agreedNodes,
        agreedEdges,
        disputedItems,
        overallConfidence: avgConfidence
      },
      consensusLevel: disputedItems.length === 0 ? 1 : (agreedEdges.length / (agreedEdges.length + disputedItems.length)),
      collaborationRounds: 3,  // 分析师 → 验证者 → 专家
      participatingAgents: ['analyst', 'validator', 'expert'],
      recommendations
    };
  }

  /**
   * 计算平均路径长度
   */
  private calculateAvgPathLength(nodes: PropagationNode[], edges: PropagationEdge[]): number {
    // 简化计算：基于网络密度估算
    if (nodes.length <= 1) return 0;
    const density = edges.length / (nodes.length * (nodes.length - 1));
    return density > 0 ? 1 / density : nodes.length;
  }

  /**
   * 识别关键节点
   */
  private identifyCriticalNodes(nodes: PropagationNode[], edges: PropagationEdge[]): string[] {
    const nodeDegree: Record<string, number> = {};
    
    nodes.forEach(n => nodeDegree[n.id] = 0);
    edges.forEach(e => {
      nodeDegree[e.sourceId] = (nodeDegree[e.sourceId] || 0) + 1;
      nodeDegree[e.targetId] = (nodeDegree[e.targetId] || 0) + 1;
    });
    
    // 返回度数最高的节点
    return Object.entries(nodeDegree)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
  }

  /**
   * 识别脆弱路径
   */
  private identifyVulnerablePaths(edges: PropagationEdge[]): string[] {
    return edges
      .filter(e => e.strength.value > 0.7 && e.strength.confidence < 0.5)
      .map(e => e.id);
  }

  /**
   * 追踪特定节点的传导影响
   */
  async tracePropagationImpact(
    network: PropagationNetwork,
    sourceNodeId: string,
    impactScenario: string
  ): Promise<{
    affectedNodes: { nodeId: string; impactPath: string[]; impactStrength: number }[];
    timeline: { node: string; expectedTime: string; impact: string }[];
    totalImpact: number;
  }> {
    
    const sourceNode = network.nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) {
      return { affectedNodes: [], timeline: [], totalImpact: 0 };
    }

    // BFS遍历传导网络
    const visited = new Set<string>();
    const affectedNodes: { nodeId: string; impactPath: string[]; impactStrength: number }[] = [];
    const queue: { nodeId: string; path: string[]; strength: number }[] = [
      { nodeId: sourceNodeId, path: [sourceNodeId], strength: 1 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);
      
      if (current.nodeId !== sourceNodeId) {
        affectedNodes.push({
          nodeId: current.nodeId,
          impactPath: current.path,
          impactStrength: current.strength
        });
      }
      
      // 找到从当前节点出发的边
      const outgoingEdges = network.edges.filter(e => e.sourceId === current.nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.targetId)) {
          queue.push({
            nodeId: edge.targetId,
            path: [...current.path, edge.targetId],
            strength: current.strength * edge.strength.value
          });
        }
      }
    }

    // 构建时间线
    const timeline = affectedNodes.map((n, i) => {
      const edge = network.edges.find(e => e.targetId === n.nodeId);
      return {
        node: network.nodes.find(node => node.id === n.nodeId)?.name || n.nodeId,
        expectedTime: edge?.mechanism.timeLag || '未知',
        impact: `强度: ${(n.impactStrength * 100).toFixed(0)}%`
      };
    });

    // 计算总影响
    const totalImpact = affectedNodes.reduce((sum, n) => sum + n.impactStrength, 0);

    return { affectedNodes, timeline, totalImpact };
  }
}

// ============================================================================
// 导出
// ============================================================================

export function createPropagationPathFinder(llmClient: LLMClient): PropagationPathFinder {
  return new PropagationPathFinder(llmClient);
}
