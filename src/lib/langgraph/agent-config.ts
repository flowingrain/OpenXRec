/**
 * 五层架构 + 独立调度层 智能体配置
 * 
 * 设计原则：
 * 1. 调度层（意图解析器）是独立的协调器，不属于五类智能体
 * 2. 只显示真正执行的智能体，不显示兼容ID
 * 3. 各类智能体有明确职责边界
 */

// ============================================================================
// 调度层（独立协调器）
// ============================================================================

/**
 * 调度层配置
 * 意图解析器是独立的协调器，负责理解意图、判断复杂度、调度智能体
 */
export const SCHEDULER_CONFIG = {
  id: 'scheduler',
  name: '调度层',
  desc: '独立协调器',
  color: '#64748b', // 深灰色
  agents: [
    { id: 'intent_parser', name: '意图解析器', desc: '理解意图、判断复杂度、调度智能体' }
  ],
  // 调度器可以使用的策略
  strategies: ['static', 'intelligent'],
  // 当前使用的策略
  defaultStrategy: 'intelligent'
};

// ============================================================================
// 五类智能体配置（UI显示用）
// ============================================================================

/**
 * 智能体配置 - 包含独立调度层和五类智能体
 * 
 * 设计说明：
 * - 调度层是独立的协调器，负责意图理解、复杂度判断、智能体调度
 * - 每类智能体只列出该类的核心智能体，职责单一、边界清晰
 * - 不包含兼容ID、废弃ID
 * 
 * 架构原则：
 * - 每个智能体职责单一，避免功能重叠
 * - 完整的数据流链路，避免环节缺失
 * - 明确的层级边界，避免跨层调用
 */
export const AGENT_LAYERS = {
  // ========== 调度层（独立协调器） ==========
  // 职责：意图理解、复杂度判断、智能体调度
  // 特点：独立于五类智能体，是"指挥官"角色
  scheduler: {
    name: '调度层',
    desc: '独立协调器',
    color: '#64748b', // 深灰色
    agents: [
      { id: 'intent_parser', name: '意图解析器', desc: '理解用户意图、判断任务复杂度、确定执行策略' }
    ]
  },
  
  // ========== 感知体 ==========
  // 职责：信息采集、事件抽取、质量评估
  // 完整链路：采集 → 抽取 → 评估
  perception: {
    name: '感知体',
    desc: '信息采集层',
    color: '#3b82f6', // 蓝色
    agents: [
      { id: 'scout_cluster', name: '侦察兵集群', desc: '多源信息采集、实时数据抓取' },
      { id: 'event_extractor', name: '事件抽取器', desc: '从非结构化文本中抽取结构化事件' },
      { id: 'quality_evaluator', name: '质量评估器', desc: '信息可信度评估、来源可靠性分析' },
      { id: 'geo_extractor', name: '地理抽取器', desc: '地理位置抽取、空间关系分析' }
    ]
  },
  
  // ========== 认知体 ==========
  // 职责：时序分析、因果推理、知识提取
  // 完整链路：时序 → 因果 → 知识 → 验证
  cognition: {
    name: '认知体',
    desc: '分析推理层',
    color: '#8b5cf6', // 紫色
    agents: [
      { id: 'timeline_analyst', name: '时序分析师', desc: '事件时间线构建、发展脉络梳理' },
      { id: 'causal_analyst', name: '因果分析师', desc: '因果链识别、风险传导路径分析' },
      { id: 'knowledge_extractor', name: '知识抽取器', desc: '关键因素识别、领域知识提取' },
      { id: 'result_validator', name: '结果验证器', desc: '分析结果验证、逻辑一致性检查' }
    ]
  },
  
  // ========== 决策体 ==========
  // 职责：场景预测、策略规划、决策支持
  // 完整链路：推演 → 分析 → 建议
  decision: {
    name: '决策体',
    desc: '决策支持层',
    color: '#f59e0b', // 橙色
    agents: [
      { id: 'scenario_simulator', name: '场景推演器', desc: '多场景模拟、概率预测、路径规划' },
      { id: 'sensitivity_analyst', name: '敏感性分析师', desc: '关键变量敏感性、脆弱点识别' },
      { id: 'action_advisor', name: '行动建议器', desc: '基于分析结果的策略建议' }
    ]
  },
  
  // ========== 行动体 ==========
  // 职责：输出生成、存储执行、质量控制
  // 完整链路：生成 → 执行 → 控制 → 监控
  action: {
    name: '行动体',
    desc: '执行输出层',
    color: '#10b981', // 绿色
    agents: [
      { id: 'report_generator', name: '报告生成器', desc: '生成结构化报告和分析文档' },
      { id: 'document_executor', name: '文档执行器', desc: '写入存储（对象存储/数据库）' },
      { id: 'quality_controller', name: '质量控制器', desc: '风险边界控制、合规性检查、异常拦截' },
      { id: 'execution_monitor', name: '执行监控器', desc: '执行状态监控、完整性检查' }
    ]
  },
  
  // ========== 进化体 ==========
  // 职责：知识沉淀、案例管理、持续优化
  // 完整链路：存储 → 检索 → 复盘
  evolution: {
    name: '进化体',
    desc: '持续优化层',
    color: '#ec4899', // 粉色
    agents: [
      { id: 'knowledge_manager', name: '知识管理器', desc: '知识图谱维护、案例存储检索' },
      { id: 'review_analyst', name: '复盘分析师', desc: '分析成败原因、提取经验教训' }
    ]
  }
};

// ============================================================================
// ID映射（内部使用，不显示在UI）
// ============================================================================

/**
 * 旧ID到新ID的映射
 * 用于向后兼容，但不在UI上显示
 * 
 * 映射规则：
 * - 旧系统ID → 新标准ID
 * - 废弃ID → 替代ID
 */
export const AGENT_ID_MAPPING: Record<string, string> = {
  // 调度层映射
  'coordinator': 'intent_parser',
  'goal_manager': 'intent_parser',
  
  // 感知体映射
  'search': 'scout_cluster',
  'alert_sentinel': 'quality_evaluator',  // 重命名
  'source_evaluator': 'quality_evaluator',
  
  // 认知体映射
  'analyst': 'timeline_analyst',  // 拆分
  'timeline': 'timeline_analyst',
  'causal_inference': 'causal_analyst',  // 拆分
  'cik_expert': 'knowledge_extractor',  // 重命名
  'key_factor': 'knowledge_extractor',
  'validator': 'result_validator',  // 重命名
  'arbitrator': 'result_validator',  // 合并到验证器
  
  // 决策体映射
  'strategy_planner': 'scenario_simulator',  // 合并
  'simulation': 'scenario_simulator',  // 重命名
  'scenario': 'scenario_simulator',
  'sensitivity_analysis': 'sensitivity_analyst',  // 重命名
  'action_advisor': 'action_advisor',  // 保持
  
  // 行动体映射
  'report': 'report_generator',
  'instruction_parser': 'report_generator',
  'red_line_control': 'quality_controller',  // 重命名
  'execution_monitor': 'execution_monitor',  // 保持
  
  // 进化体映射
  'memory_agent': 'knowledge_manager',  // 重命名
  'review_agent': 'review_analyst',  // 重命名
  'rl_trainer': 'review_analyst'  // 合并
};

/**
 * 获取智能体的标准ID（处理兼容映射）
 */
export function getCanonicalAgentId(agentId: string): string {
  return AGENT_ID_MAPPING[agentId] || agentId;
}

/**
 * 获取智能体的显示配置
 */
export function getAgentDisplayConfig(agentId: string) {
  const canonicalId = getCanonicalAgentId(agentId);
  
  for (const [layerId, layer] of Object.entries(AGENT_LAYERS)) {
    const agent = layer.agents.find(a => a.id === canonicalId);
    if (agent) {
      return {
        ...agent,
        layer: layerId,
        layerName: layer.name,
        color: layer.color
      };
    }
  }
  
  // 未找到，返回默认配置
  return {
    id: agentId,
    name: agentId,
    desc: '',
    layer: 'unknown',
    layerName: '未知',
    color: '#6b7280'
  };
}

// ============================================================================
// 扁平化智能体列表（方便遍历）
// ============================================================================

/**
 * 所有智能体的扁平列表
 */
export const ALL_AGENTS = Object.entries(AGENT_LAYERS).flatMap(([layerId, layer]) =>
  layer.agents.map(agent => ({
    ...agent,
    layer: layerId,
    layerName: layer.name,
    color: layer.color
  }))
);

/**
 * 获取某一层的智能体列表
 */
export function getLayerAgents(layerId: string) {
  const layers = AGENT_LAYERS as Record<string, { name: string; desc: string; color: string; agents: Array<{ id: string; name: string; desc: string }> }>;
  return layers[layerId]?.agents || [];
}

// 类型导出
export type AgentLayerId = keyof typeof AGENT_LAYERS;
export type AgentConfig = typeof AGENT_LAYERS[keyof typeof AGENT_LAYERS];
export type SchedulerConfig = typeof SCHEDULER_CONFIG;

// 为向后兼容导出类型别名
export const SCHEDULER_CONFIG_TYPE = SCHEDULER_CONFIG;
export const AGENT_LAYER_TYPE = AGENT_LAYERS;

// AGENT_DISPLAY_CONFIG 在 graph.ts 中定义，这里提供类型
export type AgentDisplayConfigType = ReturnType<typeof getAgentDisplayConfig>;
export const AGENT_DISPLAY_CONFIG_TYPE: Record<string, AgentDisplayConfigType> = {};
