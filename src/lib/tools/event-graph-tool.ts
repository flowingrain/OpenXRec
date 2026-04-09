/**
 * 事件图谱工具
 * 
 * 提供事件因果链分析、时间线构建、事件关系可视化等功能
 */

import type { ToolDefinition, ToolCallRequest, ToolCallResult, ToolExecutor } from './types';
import { createSuccessResult, createErrorResult } from './registry';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ============================================================================
// 工具定义
// ============================================================================

/**
 * 生成事件图谱
 */
const generateEventGraphDefinition: ToolDefinition = {
  name: 'eg_generate',
  displayName: '生成事件图谱',
  description: '根据主题或事件描述生成事件图谱，包含相关事件、因果链和关键因素。适用于分析事件发展脉络和因果关系。',
  parameters: {
    topic: {
      type: 'string',
      description: '分析主题或事件描述',
    },
    depth: {
      type: 'number',
      description: '分析深度，1=基础事件，2=因果链，3=深层因素',
      default: 2,
    },
    includeTimeline: {
      type: 'boolean',
      description: '是否包含时间线',
      default: true,
    },
  },
  required: ['topic'],
  category: 'event',
  examples: [
    {
      scenario: '用户想了解某事件的发展脉络',
      parameters: { topic: '新能源汽车行业发展', depth: 2 },
      expectedOutput: '返回包含关键事件、因果关系的事件图谱',
    },
  ],
};

/**
 * 查询历史事件图谱
 */
const getEventGraphDefinition: ToolDefinition = {
  name: 'eg_get_history',
  displayName: '查询历史事件图谱',
  description: '获取已存储的历史事件图谱记录。',
  parameters: {
    topic: {
      type: 'string',
      description: '主题关键词',
    },
    limit: {
      type: 'number',
      description: '返回数量限制',
      default: 10,
    },
  },
  category: 'event',
  examples: [
    {
      scenario: '用户想查看之前分析过的事件图谱',
      parameters: { topic: '科技' },
      expectedOutput: '返回相关历史事件图谱列表',
    },
  ],
};

/**
 * 分析事件因果关系
 */
const analyzeCausalityDefinition: ToolDefinition = {
  name: 'eg_analyze_causality',
  displayName: '分析事件因果关系',
  description: '分析指定事件的因果链，识别原因、结果和传导路径。',
  parameters: {
    event: {
      type: 'string',
      description: '事件名称或描述',
    },
    direction: {
      type: 'string',
      description: '分析方向：forward=正向（结果），backward=反向（原因），both=双向',
      enum: ['forward', 'backward', 'both'],
      default: 'both',
    },
    maxDepth: {
      type: 'number',
      description: '最大分析深度',
      default: 3,
    },
  },
  required: ['event'],
  category: 'event',
  examples: [
    {
      scenario: '用户想分析某事件的原因和结果',
      parameters: { event: '芯片短缺', direction: 'both' },
      expectedOutput: '返回芯片短缺的原因链和结果链',
    },
  ],
};

/**
 * 构建事件时间线
 */
const buildTimelineDefinition: ToolDefinition = {
  name: 'eg_build_timeline',
  displayName: '构建事件时间线',
  description: '根据事件列表构建时间线，展示事件发展脉络。',
  parameters: {
    events: {
      type: 'array',
      description: '事件列表，每个事件包含时间、描述',
      items: {
        type: 'object',
        description: '事件信息对象',
        properties: {
          timestamp: { type: 'string', description: '事件时间' },
          description: { type: 'string', description: '事件描述' },
        },
      },
    },
    title: {
      type: 'string',
      description: '时间线标题',
    },
  },
  required: ['events'],
  category: 'event',
  examples: [
    {
      scenario: '用户想整理一系列事件的时间顺序',
      parameters: { events: [{ timestamp: '2024-01', description: '事件A' }], title: '某行业发展' },
      expectedOutput: '返回可视化时间线',
    },
  ],
};

/**
 * 查找事件关联路径
 */
const findEventPathDefinition: ToolDefinition = {
  name: 'eg_find_path',
  displayName: '查找事件关联路径',
  description: '查找两个事件之间的关联路径，展示事件如何相互影响。',
  parameters: {
    fromEvent: {
      type: 'string',
      description: '起始事件',
    },
    toEvent: {
      type: 'string',
      description: '目标事件',
    },
  },
  required: ['fromEvent', 'toEvent'],
  category: 'event',
  examples: [
    {
      scenario: '用户想了解两个事件之间的关联',
      parameters: { fromEvent: '疫情爆发', toEvent: '远程办公普及' },
      expectedOutput: '返回两个事件之间的因果链',
    },
  ],
};

// ============================================================================
// 工具执行器
// ============================================================================

/**
 * 生成事件图谱执行器
 */
const generateEventGraphExecutor: ToolExecutor = async (request) => {
  const { topic, depth = 2, includeTimeline = true } = request.parameters;
  
  try {
    // 使用 LLM 生成事件图谱结构
    // 这里简化为返回一个基本的事件图谱框架
    // 实际项目中应该调用 LLM 进行深度分析
    
    const eventGraph = {
      nodes: [
        { id: 'event_1', type: 'core', label: topic, description: `核心事件: ${topic}` },
      ],
      edges: [],
      timeline: includeTimeline ? [
        { timestamp: new Date().toISOString().split('T')[0], event: topic, significance: '起始事件' },
      ] : [],
    };
    
    // 尝试从知识库获取相关事件
    const supabase = getSupabaseClient();
    const { data: relatedCases } = await supabase
      .from('knowledge_cases')
      .select('*')
      .ilike('topic', `%${topic}%`)
      .limit(5);
    
    if (relatedCases && relatedCases.length > 0) {
      // 合并历史案例的事件图谱
      for (const caseData of relatedCases) {
        if (caseData.event_graph) {
          const caseNodes = (caseData.event_graph as { nodes?: unknown[]; edges?: unknown[] }).nodes || [];
          const caseEdges = (caseData.event_graph as { nodes?: unknown[]; edges?: unknown[] }).edges || [];
          eventGraph.nodes.push(...caseNodes as typeof eventGraph.nodes);
          eventGraph.edges.push(...caseEdges as typeof eventGraph.edges);
        }
      }
    }
    
    return createSuccessResult(
      {
        topic,
        depth,
        graph: eventGraph,
        relatedCases: relatedCases?.length || 0,
      },
      `已生成 "${topic}" 的事件图谱，包含 ${eventGraph.nodes.length} 个事件节点`,
      {
        type: 'event_graph',
        data: eventGraph,
      }
    );
  } catch (error) {
    return createErrorResult(`生成事件图谱失败: ${error}`);
  }
};

/**
 * 查询历史事件图谱执行器
 */
const getEventGraphExecutor: ToolExecutor = async (request) => {
  const { topic, limit = 10 } = request.parameters;
  
  try {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('knowledge_cases')
      .select('id, topic, created_at, event_graph')
      .not('event_graph', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (topic) {
      query = query.ilike('topic', `%${topic}%`);
    }
    
    const { data: cases, error } = await query;
    
    if (error) {
      return createErrorResult(`查询失败: ${error.message}`);
    }
    
    const eventGraphs = (cases || []).map(c => ({
      id: c.id,
      topic: c.topic,
      createdAt: c.created_at,
      nodeCount: c.event_graph?.nodes?.length || 0,
      edgeCount: c.event_graph?.edges?.length || 0,
    }));
    
    return createSuccessResult(
      { total: eventGraphs.length, eventGraphs },
      `找到 ${eventGraphs.length} 个历史事件图谱`,
      {
        type: 'table',
        data: {
          headers: ['主题', '节点数', '关系数', '创建时间'],
          rows: eventGraphs.map(g => [g.topic, g.nodeCount, g.edgeCount, g.createdAt]),
        },
      }
    );
  } catch (error) {
    return createErrorResult(`查询历史事件图谱失败: ${error}`);
  }
};

/**
 * 分析事件因果关系执行器
 */
const analyzeCausalityExecutor: ToolExecutor = async (request) => {
  const { event, direction = 'both', maxDepth = 3 } = request.parameters;
  
  try {
    // 这里简化实现，实际应该调用 LLM 进行因果分析
    const causalityGraph = {
      rootEvent: event,
      direction,
      causes: [] as Array<{ event: string; strength: number; path: string[] }>,
      effects: [] as Array<{ event: string; strength: number; path: string[] }>,
    };
    
    // 尝试从知识库获取相关因果链
    const supabase = getSupabaseClient();
    const { data: relatedCases } = await supabase
      .from('knowledge_cases')
      .select('causal_chain, event_graph')
      .or(`topic.ilike.%${event}%,summary.ilike.%${event}%`)
      .limit(3);
    
    if (relatedCases) {
      for (const caseData of relatedCases) {
        if (caseData.causal_chain) {
          // 提取因果关系
          const chain = caseData.causal_chain;
          if (Array.isArray(chain)) {
            for (const node of chain) {
              if (node.type === 'cause') {
                causalityGraph.causes.push({
                  event: node.factor || node.description,
                  strength: node.strength || 0.5,
                  path: [node.factor || node.description, event],
                });
              } else if (node.type === 'result') {
                causalityGraph.effects.push({
                  event: node.factor || node.description,
                  strength: node.strength || 0.5,
                  path: [event, node.factor || node.description],
                });
              }
            }
          }
        }
      }
    }
    
    // 构建可视化数据
    const nodes = [
      { id: 'root', label: event, type: 'root' },
      ...causalityGraph.causes.map((c, i) => ({ id: `cause_${i}`, label: c.event, type: 'cause' })),
      ...causalityGraph.effects.map((e, i) => ({ id: `effect_${i}`, label: e.event, type: 'effect' })),
    ];
    
    const edges = [
      ...causalityGraph.causes.map((c, i) => ({
        id: `edge_cause_${i}`,
        source: `cause_${i}`,
        target: 'root',
        label: '导致',
        strength: c.strength,
      })),
      ...causalityGraph.effects.map((e, i) => ({
        id: `edge_effect_${i}`,
        source: 'root',
        target: `effect_${i}`,
        label: '导致',
        strength: e.strength,
      })),
    ];
    
    return createSuccessResult(
      causalityGraph,
      `"${event}" 的因果分析: ${causalityGraph.causes.length} 个原因, ${causalityGraph.effects.length} 个结果`,
      {
        type: 'event_graph',
        data: { nodes, edges },
      }
    );
  } catch (error) {
    return createErrorResult(`因果分析失败: ${error}`);
  }
};

/**
 * 构建时间线执行器
 */
const buildTimelineExecutor: ToolExecutor = async (request) => {
  const { events, title = '事件时间线' } = request.parameters;
  
  try {
    if (!events || events.length === 0) {
      return createErrorResult('事件列表为空');
    }
    
    // 按时间排序
    const sortedEvents = [...events].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });
    
    // 构建可视化数据
    const nodes = sortedEvents.map((e, i) => ({
      id: `event_${i}`,
      label: e.description || e.event,
      timestamp: e.timestamp,
      type: 'event',
    }));
    
    const edges = sortedEvents.slice(0, -1).map((_, i) => ({
      id: `edge_${i}`,
      source: `event_${i}`,
      target: `event_${i + 1}`,
      label: '→',
    }));
    
    return createSuccessResult(
      {
        title,
        events: sortedEvents,
        total: sortedEvents.length,
        timeRange: {
          start: sortedEvents[0]?.timestamp,
          end: sortedEvents[sortedEvents.length - 1]?.timestamp,
        },
      },
      `已构建时间线 "${title}"，包含 ${sortedEvents.length} 个事件`,
      {
        type: 'event_graph',
        data: { nodes, edges },
      }
    );
  } catch (error) {
    return createErrorResult(`构建时间线失败: ${error}`);
  }
};

/**
 * 查找事件关联路径执行器
 */
const findEventPathExecutor: ToolExecutor = async (request) => {
  const { fromEvent, toEvent } = request.parameters;
  
  try {
    // 从知识库搜索相关事件
    const supabase = getSupabaseClient();
    const { data: relatedCases } = await supabase
      .from('knowledge_cases')
      .select('event_graph, causal_chain, topic')
      .or(`topic.ilike.%${fromEvent}%,topic.ilike.%${toEvent}%,summary.ilike.%${fromEvent}%,summary.ilike.%${toEvent}%`)
      .limit(5);
    
    // 简化实现：返回一个关联路径框架
    const path = {
      fromEvent,
      toEvent,
      found: false,
      nodes: [
        { id: 'from', label: fromEvent, type: 'source' },
        { id: 'to', label: toEvent, type: 'target' },
      ],
      edges: [],
      intermediateEvents: [],
    };
    
    // 尝试从历史数据中找到连接
    if (relatedCases && relatedCases.length > 0) {
      for (const caseData of relatedCases) {
        if (caseData.event_graph?.nodes) {
          const hasFrom = caseData.event_graph.nodes.some(
            (n: any) => n.label?.includes(fromEvent) || n.description?.includes(fromEvent)
          );
          const hasTo = caseData.event_graph.nodes.some(
            (n: any) => n.label?.includes(toEvent) || n.description?.includes(toEvent)
          );
          
          if (hasFrom && hasTo) {
            path.found = true;
            path.nodes = caseData.event_graph.nodes;
            path.edges = caseData.event_graph.edges;
            break;
          }
        }
      }
    }
    
    return createSuccessResult(
      path,
      path.found
        ? `找到 "${fromEvent}" 到 "${toEvent}" 的关联路径`
        : `未找到 "${fromEvent}" 到 "${toEvent}" 的直接关联路径`,
      {
        type: 'event_graph',
        data: { nodes: path.nodes, edges: path.edges },
      }
    );
  } catch (error) {
    return createErrorResult(`查找事件关联路径失败: ${error}`);
  }
};

// ============================================================================
// 注册工具
// ============================================================================

export function registerEventGraphTools(registry: {
  register: (def: ToolDefinition, executor: ToolExecutor) => void;
}): void {
  registry.register(generateEventGraphDefinition, generateEventGraphExecutor);
  registry.register(getEventGraphDefinition, getEventGraphExecutor);
  registry.register(analyzeCausalityDefinition, analyzeCausalityExecutor);
  registry.register(buildTimelineDefinition, buildTimelineExecutor);
  registry.register(findEventPathDefinition, findEventPathExecutor);
}
