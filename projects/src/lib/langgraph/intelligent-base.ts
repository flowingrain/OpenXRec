/**
 * 智能底座 (Intelligent Base)
 * 
 * 提供三大核心能力：
 * 1. 指挥中枢 - 指挥官、黑板系统、事件总线
 * 2. 模型库 - 因果推理引擎、动态传导发现器
 * 3. 知识库 - 因果模式库、FEMA失效模式库
 * 
 * 重要：传导路径由智能体协作动态发现，不使用静态配置
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { AnalysisStateType, CausalChainNode, TimelineEvent, KeyFactor, ScenarioNode, SearchItem, RiskPropagationPath } from './state';
import { 
  PropagationPathFinder, 
  PropagationNetwork, 
  PropagationPath,
  CollaborativeDiscoveryResult,
  createPropagationPathFinder
} from './propagation-finder';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 智能体能力注册信息
 */
export interface AgentCapability {
  id: string;                        // 智能体ID
  layer: AgentLayer;                 // 所属层级
  capabilities: string[];            // 能力标签
  dependencies: string[];            // 依赖的其他智能体
  inputSchema: Record<string, string>;   // 输入数据结构
  outputSchema: Record<string, string>;  // 输出数据结构
}

/**
 * 智能体层级 - 五层混合架构 + 独立调度层
 */
export type AgentLayer = 'scheduler' | 'perception' | 'cognition' | 'decision' | 'action' | 'evolution';

/**
 * 黑板数据项
 */
export interface BlackboardItem {
  key: string;
  value: any;
  source: string;        // 来源智能体ID
  timestamp: number;
  version: number;
  metadata?: Record<string, any>;
}

/**
 * 事件类型
 */
export type EventType = 
  | 'agent_start'
  | 'agent_complete'
  | 'agent_error'
  | 'layer_start'
  | 'layer_complete'
  | 'revision_required'
  | 'revision_complete'
  | 'propagation_discovered';  // 新增：传导路径发现完成

/**
 * 事件数据
 */
export interface Event {
  type: EventType;
  source: string;
  data: any;
  timestamp: number;
}

/**
 * 事件监听器
 */
export type EventListener = (event: Event) => void;

/**
 * 历史传导案例（仅作参考，不用于直接匹配）
 */
export interface HistoricalPropagationCase {
  id: string;
  event: string;           // 历史事件
  date: string;            // 发生时间
  propagationPath: string; // 传导路径描述
  actualOutcome: string;   // 实际结果
  lessons: string[];       // 经验教训
}

/**
 * 因果模式
 */
export interface CausalPattern {
  id: string;
  name: string;
  description: string;
  template: {
    cause: string;
    intermediary: string[];
    effect: string;
  };
  applicableScenarios: string[];
  strength: number;
}

/**
 * FEMA失效模式
 */
export interface FEMAMode {
  id: string;
  name: string;
  failureMode: string;     // 失效模式
  effect: string;          // 失效影响
  severity: number;        // 严重度 1-10
  occurrence: number;      // 发生频度 1-10
  detection: number;       // 检测难度 1-10
  rpn: number;            // 风险优先级 = S * O * D
  mitigation: string;      // 缓解措施
}

// ============================================================================
// 黑板系统
// ============================================================================

/**
 * 黑板系统 - 智能体间信息共享
 */
export class BlackboardSystem {
  private data: Map<string, BlackboardItem> = new Map();
  private versionHistory: Map<string, BlackboardItem[]> = new Map();

  /**
   * 写入数据
   */
  write(key: string, value: any, source: string, metadata?: Record<string, any>): void {
    const existing = this.data.get(key);
    const newVersion = existing ? existing.version + 1 : 1;
    
    const item: BlackboardItem = {
      key,
      value,
      source,
      timestamp: Date.now(),
      version: newVersion,
      metadata
    };
    
    // 保存历史版本
    if (existing) {
      const history = this.versionHistory.get(key) || [];
      history.push(existing);
      this.versionHistory.set(key, history);
    }
    
    this.data.set(key, item);
    console.log(`[Blackboard] Write: ${key} (v${newVersion}) by ${source}`);
  }

  /**
   * 读取数据
   */
  read(key: string): BlackboardItem | undefined {
    return this.data.get(key);
  }

  /**
   * 读取数据值
   */
  getValue<T = any>(key: string): T | undefined {
    return this.data.get(key)?.value as T | undefined;
  }

  /**
   * 批量读取
   */
  readAll(): BlackboardItem[] {
    return Array.from(this.data.values());
  }

  /**
   * 按来源过滤
   */
  filterBySource(source: string): BlackboardItem[] {
    return this.readAll().filter(item => item.source === source);
  }

  /**
   * 获取历史版本
   */
  getHistory(key: string): BlackboardItem[] {
    return this.versionHistory.get(key) || [];
  }

  /**
   * 清除所有数据
   */
  clear(): void {
    this.data.clear();
    this.versionHistory.clear();
  }

  /**
   * 导出状态快照
   */
  exportSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    this.data.forEach((item, key) => {
      snapshot[key] = item.value;
    });
    return snapshot;
  }
}

// ============================================================================
// 事件总线
// ============================================================================

/**
 * 事件总线 - 智能体间事件通信
 */
export class EventBus {
  private listeners: Map<EventType, Set<EventListener>> = new Map();
  private eventHistory: Event[] = [];
  private maxHistorySize = 1000;

  /**
   * 订阅事件
   */
  subscribe(eventType: EventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * 发布事件
   */
  emit(type: EventType, source: string, data: any): void {
    const event: Event = {
      type,
      source,
      data,
      timestamp: Date.now()
    };
    
    // 记录历史
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // 通知监听器
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[EventBus] Listener error for ${type}:`, error);
        }
      });
    }
    
    console.log(`[EventBus] Emit: ${type} from ${source}`);
  }

  /**
   * 获取事件历史
   */
  getHistory(eventType?: EventType): Event[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

// ============================================================================
// 指挥官
// ============================================================================

/**
 * 指挥官 - 全局调度决策
 */
export class Commander {
  private blackboard: BlackboardSystem;
  private eventBus: EventBus;
  private agentRegistry: Map<string, AgentCapability> = new Map();
  private layerAgents: Map<AgentLayer, string[]> = new Map();

  constructor(blackboard: BlackboardSystem, eventBus: EventBus) {
    this.blackboard = blackboard;
    this.eventBus = eventBus;
    
    // 初始化层级映射
    ['perception', 'cognition', 'decision', 'action', 'evolution'].forEach(layer => {
      this.layerAgents.set(layer as AgentLayer, []);
    });
  }

  /**
   * 注册智能体能力
   */
  registerAgent(capability: AgentCapability): void {
    this.agentRegistry.set(capability.id, capability);
    
    // 添加到层级映射
    const agents = this.layerAgents.get(capability.layer) || [];
    if (!agents.includes(capability.id)) {
      agents.push(capability.id);
      this.layerAgents.set(capability.layer, agents);
    }
    
    console.log(`[Commander] Registered agent: ${capability.id} (${capability.layer})`);
  }

  /**
   * 获取智能体能力
   */
  getAgent(id: string): AgentCapability | undefined {
    return this.agentRegistry.get(id);
  }

  /**
   * 获取层级内所有智能体
   */
  getAgentsByLayer(layer: AgentLayer): AgentCapability[] {
    const ids = this.layerAgents.get(layer) || [];
    return ids.map(id => this.agentRegistry.get(id)!).filter(Boolean);
  }

  /**
   * 获取执行顺序
   */
  getExecutionOrder(): AgentLayer[] {
    return ['perception', 'cognition', 'decision', 'action', 'evolution'];
  }

  /**
   * 决定是否跳过某智能体
   */
  shouldSkipAgent(agentId: string, state: AnalysisStateType): boolean {
    const capability = this.agentRegistry.get(agentId);
    if (!capability) return false;
    
    // 检查依赖是否满足
    for (const depId of capability.dependencies) {
      if (!state.completedAgents?.includes(depId)) {
        console.log(`[Commander] Skip ${agentId}: dependency ${depId} not satisfied`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 决定下一个执行的智能体
   */
  getNextAgent(currentAgent: string, state: AnalysisStateType): string | null {
    const layers = this.getExecutionOrder();
    const currentLayer = this.agentRegistry.get(currentAgent)?.layer;
    
    if (!currentLayer) return null;
    
    // 查找同层下一个智能体
    const layerAgentIds = this.layerAgents.get(currentLayer) || [];
    const currentIndex = layerAgentIds.indexOf(currentAgent);
    
    if (currentIndex < layerAgentIds.length - 1) {
      const nextAgent = layerAgentIds[currentIndex + 1];
      if (!this.shouldSkipAgent(nextAgent, state)) {
        return nextAgent;
      }
    }
    
    // 移动到下一层
    const layerIndex = layers.indexOf(currentLayer);
    if (layerIndex < layers.length - 1) {
      const nextLayer = layers[layerIndex + 1];
      const nextLayerAgents = this.layerAgents.get(nextLayer) || [];
      return nextLayerAgents[0] || null;
    }
    
    return null;
  }

  /**
   * 发布调度决策
   */
  emitScheduleDecision(decision: {
    agentId: string;
    action: 'execute' | 'skip' | 'retry';
    reason: string;
  }): void {
    this.eventBus.emit('agent_start', 'commander', decision);
  }
}

// ============================================================================
// 动态传导发现器（替代静态传导库）
// ============================================================================

/**
 * 动态传导发现器 - 智能体协作发现传导路径
 * 
 * 核心差异：
 * - 不使用预定义的静态传导路径
 * - 通过智能体协作动态发现传导网络
 * - 利用历史案例辅助发现，但不限制发现范围
 */
export class DynamicPropagationDiscovery {
  private pathFinder: PropagationPathFinder;
  private historicalCases: HistoricalPropagationCase[] = [];
  private discoveredNetworks: Map<string, PropagationNetwork> = new Map();
  
  constructor(llmClient: LLMClient) {
    this.pathFinder = createPropagationPathFinder(llmClient);
    this.initializeHistoricalCases();
  }

  /**
   * 初始化历史案例（仅作参考，不用于直接匹配）
   */
  private initializeHistoricalCases(): void {
    this.historicalCases = [
      {
        id: 'case_fed_rate_2015',
        event: '美联储2015年加息周期',
        date: '2015-12',
        propagationPath: '美联储加息 → 美元走强 → 新兴市场资本外流 → 人民币贬值压力',
        actualOutcome: '人民币贬值约5%，资本外流加剧',
        lessons: ['加息预期已提前消化', '中国资本管制影响传导效率']
      },
      {
        id: 'case_covid_2020',
        event: '2020年新冠疫情',
        date: '2020-01',
        propagationPath: '疫情爆发 → 供应链中断 → 生产停滞 → 全球经济衰退',
        actualOutcome: '全球供应链严重受阻，多国经济负增长',
        lessons: ['供应链韧性重要性凸显', '数字化转型加速']
      },
      {
        id: 'case_ukraine_2022',
        event: '2022年俄乌冲突',
        date: '2022-02',
        propagationPath: '地缘冲突 → 能源供给担忧 → 油价飙升 → 通胀压力',
        actualOutcome: '布油突破120美元，全球通胀高企',
        lessons: ['能源安全战略重要性', '替代能源发展机遇']
      }
    ];
    
    console.log(`[DynamicPropagation] Loaded ${this.historicalCases.length} historical cases as reference`);
  }

  /**
   * 动态发现传导网络（核心方法）
   * 
   * 执行流程：
   * 1. 分析师智能体提出初始传导假设
   * 2. 验证者智能体验证传导机制
   * 3. 领域专家补充知识
   * 4. 共识融合形成最终网络
   */
  async discoverNetwork(
    query: string,
    causalChain: CausalChainNode[],
    keyFactors: KeyFactor[],
    timeline: TimelineEvent[],
    searchResults: SearchItem[]
  ): Promise<CollaborativeDiscoveryResult> {
    
    console.log('[DynamicPropagation] Starting collaborative discovery for:', query);
    
    // 使用 PropagationPathFinder 进行智能体协作发现
    const result = await this.pathFinder.discoverPropagationNetwork(
      query,
      causalChain,
      keyFactors,
      timeline,
      searchResults
    );
    
    // 缓存发现的网络
    this.discoveredNetworks.set(result.network.id, result.network);
    
    return result;
  }

  /**
   * 查询历史相似案例（辅助发现，不替代发现）
   */
  findSimilarHistoricalCases(factors: string[]): HistoricalPropagationCase[] {
    const similarCases = this.historicalCases.filter(case_ => {
      const caseText = `${case_.event} ${case_.propagationPath} ${case_.actualOutcome}`.toLowerCase();
      return factors.some(f => caseText.includes(f.toLowerCase()));
    });
    
    console.log(`[DynamicPropagation] Found ${similarCases.length} similar historical cases`);
    return similarCases;
  }

  /**
   * 获取已发现的网络
   */
  getDiscoveredNetwork(networkId: string): PropagationNetwork | undefined {
    return this.discoveredNetworks.get(networkId);
  }

  /**
   * 追踪传导影响
   */
  async traceImpact(
    network: PropagationNetwork,
    sourceNodeId: string,
    impactScenario: string
  ): Promise<{
    affectedNodes: { nodeId: string; impactPath: string[]; impactStrength: number }[];
    timeline: { node: string; expectedTime: string; impact: string }[];
    totalImpact: number;
  }> {
    return this.pathFinder.tracePropagationImpact(network, sourceNodeId, impactScenario);
  }
}

// ============================================================================
// 因果推理引擎
// ============================================================================

/**
 * 因果推理引擎 - 增强因果链分析
 */
export class CausalReasoningEngine {
  private llmClient: LLMClient;
  
  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * 使用LLM增强因果推理
   */
  async enhanceCausalChain(
    causalChain: CausalChainNode[],
    timeline: TimelineEvent[],
    context: string
  ): Promise<CausalChainNode[]> {
    const prompt = `你是因果推理专家。请分析以下因果链是否完整、合理，并补充缺失的中间环节。

已有因果链:
${causalChain.map((c, i) => `${i + 1}. [${c.type}] ${c.factor}: ${c.description} (强度: ${c.strength})`).join('\n')}

相关事件:
${timeline.slice(0, 5).map(e => `- ${e.event} (${e.timestamp})`).join('\n')}

上下文: ${context.substring(0, 500)}

请输出JSON格式的增强后因果链:
{
  "enhancedChain": [
    {
      "type": "cause|intermediary|conductor|result",
      "factor": "因素名称",
      "description": "详细描述",
      "strength": 0.8,
      "strengthReason": "强度依据",
      "relatedCoreEvents": ["相关事件"]
    }
  ],
  "additions": ["新增的因果环节说明"],
  "confidence": 0.85
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是因果推理专家，只输出JSON格式结果。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3
      });

      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.enhancedChain && Array.isArray(parsed.enhancedChain)) {
          return parsed.enhancedChain.map((c: any) => ({
            type: c.type || 'intermediary',
            factor: c.factor,
            description: c.description,
            strength: c.strength || 0.5,
            strengthReason: c.strengthReason,
            relatedCoreEvents: c.relatedCoreEvents || []
          }));
        }
      }
    } catch (error) {
      console.error('[CausalReasoningEngine] Enhancement failed:', error);
    }
    
    return causalChain;
  }

  /**
   * 验证因果链一致性
   */
  validateCausalChain(causalChain: CausalChainNode[]): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // 检查是否有因果闭环
    const factorSet = new Set(causalChain.map(c => c.factor));
    
    // 检查是否有根本原因
    const hasRootCause = causalChain.some(c => c.type === 'cause');
    if (!hasRootCause) {
      issues.push('因果链缺少根本原因节点');
    }
    
    // 检查是否有最终结果
    const hasResult = causalChain.some(c => c.type === 'result');
    if (!hasResult) {
      issues.push('因果链缺少最终结果节点');
    }
    
    // 检查强度分布是否合理
    const strengths = causalChain.map(c => c.strength);
    const avgStrength = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    if (avgStrength < 0.3) {
      issues.push('因果链整体强度过低，可靠性不足');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

// ============================================================================
// 知识库
// ============================================================================

/**
 * 因果模式库 - 存储常见因果模式
 */
export class CausalPatternLibrary {
  private patterns: Map<string, CausalPattern> = new Map();
  
  constructor() {
    this.initializeDefaultPatterns();
  }

  private initializeDefaultPatterns(): void {
    this.addPattern({
      id: 'monetary-policy-transmission',
      name: '货币政策传导模式',
      description: '央行政策变化到实体经济的传导过程',
      template: {
        cause: '央行政策利率变化',
        intermediary: ['市场利率调整', '银行信贷规模变化', '企业融资成本变化'],
        effect: '实体经济活动变化'
      },
      applicableScenarios: ['货币政策分析', '利率影响评估'],
      strength: 0.85
    });
    
    this.addPattern({
      id: 'supply-chain-disruption',
      name: '供应链中断模式',
      description: '供应链中断对市场的影响',
      template: {
        cause: '供应链中断事件',
        intermediary: ['原材料短缺', '生产成本上升', '产品价格上涨'],
        effect: '通胀压力和市场波动'
      },
      applicableScenarios: ['地缘政治风险', '疫情冲击'],
      strength: 0.80
    });
    
    this.addPattern({
      id: 'risk-contagion',
      name: '风险传染模式',
      description: '金融风险在不同市场间的传染',
      template: {
        cause: '金融市场冲击',
        intermediary: ['投资者情绪恶化', '流动性紧张', '跨市场抛售'],
        effect: '系统性风险上升'
      },
      applicableScenarios: ['金融危机', '市场暴跌'],
      strength: 0.75
    });
  }

  addPattern(pattern: CausalPattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * 查找适用的因果模式
   */
  findApplicablePatterns(scenario: string): CausalPattern[] {
    return Array.from(this.patterns.values()).filter(p =>
      p.applicableScenarios.some(s => scenario.includes(s))
    );
  }

  /**
   * 基于模式生成因果链建议
   */
  generateCausalChainSuggestion(patternId: string, context: string): CausalChainNode[] | null {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;
    
    const chain: CausalChainNode[] = [
      {
        type: 'cause',
        factor: pattern.template.cause,
        description: `基于${pattern.name}的根本原因`,
        strength: pattern.strength,
        relatedCoreEvents: []
      }
    ];
    
    pattern.template.intermediary.forEach((factor, i) => {
      chain.push({
        type: 'intermediary',
        factor,
        description: `传导环节 ${i + 1}`,
        strength: pattern.strength * (1 - i * 0.1),
        relatedCoreEvents: []
      });
    });
    
    chain.push({
      type: 'result',
      factor: pattern.template.effect,
      description: '最终影响',
      strength: pattern.strength * 0.9,
      relatedCoreEvents: []
    });
    
    return chain;
  }
}

/**
 * FEMA失效模式库 - 识别潜在风险
 */
export class FEMA_LIBRARY {
  private modes: Map<string, FEMAMode> = new Map();
  
  constructor() {
    this.initializeDefaultModes();
  }

  private initializeDefaultModes(): void {
    this.addMode({
      id: 'data-quality',
      name: '数据质量问题',
      failureMode: '数据源不可靠或数据缺失',
      effect: '分析结论偏差',
      severity: 7,
      occurrence: 5,
      detection: 6,
      rpn: 210,
      mitigation: '多源验证、交叉检查'
    });
    
    this.addMode({
      id: 'model-bias',
      name: '模型偏差',
      failureMode: '模型对特定场景过度拟合',
      effect: '预测不准确',
      severity: 8,
      occurrence: 4,
      detection: 5,
      rpn: 160,
      mitigation: '引入多样化场景、敏感性分析'
    });
    
    this.addMode({
      id: 'causal-oversimplification',
      name: '因果过度简化',
      failureMode: '忽略复杂系统中多重因果关系',
      effect: '因果链不完整',
      severity: 6,
      occurrence: 6,
      detection: 4,
      rpn: 144,
      mitigation: '使用因果模式库、专家验证'
    });
  }

  addMode(mode: FEMAMode): void {
    this.modes.set(mode.id, mode);
  }

  /**
   * 获取高风险失效模式
   */
  getHighRiskModes(threshold: number = 150): FEMAMode[] {
    return Array.from(this.modes.values())
      .filter(m => m.rpn >= threshold)
      .sort((a, b) => b.rpn - a.rpn);
  }

  /**
   * 评估分析结果的潜在风险
   */
  assessRisk(factors: string[]): {
    risks: FEMAMode[];
    recommendations: string[];
  } {
    const risks = this.getHighRiskModes();
    const recommendations = risks.map(r => r.mitigation);
    
    return { risks, recommendations };
  }
}

// ============================================================================
// 智能底座主类
// ============================================================================

/**
 * 智能底座 - 统一入口
 * 
 * 重要改进：风险传导路径由智能体协作动态发现，不使用静态配置
 */
export class IntelligentBase {
  // 三大核心组件
  blackboard: BlackboardSystem;
  eventBus: EventBus;
  commander: Commander;
  
  // 模型库
  dynamicPropagationDiscovery: DynamicPropagationDiscovery;  // 替换静态传导库
  causalReasoningEngine: CausalReasoningEngine;
  
  // 知识库
  causalPatternLibrary: CausalPatternLibrary;
  femaLibrary: FEMA_LIBRARY;
  
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
    
    // 初始化核心组件
    this.blackboard = new BlackboardSystem();
    this.eventBus = new EventBus();
    this.commander = new Commander(this.blackboard, this.eventBus);
    
    // 初始化模型库 - 使用动态传导发现器
    this.dynamicPropagationDiscovery = new DynamicPropagationDiscovery(llmClient);
    this.causalReasoningEngine = new CausalReasoningEngine(llmClient);
    
    // 初始化知识库
    this.causalPatternLibrary = new CausalPatternLibrary();
    this.femaLibrary = new FEMA_LIBRARY();
    
    console.log('[IntelligentBase] Initialized with dynamic propagation discovery');
  }

  /**
   * 注册智能体能力
   */
  registerAgent(capability: AgentCapability): void {
    this.commander.registerAgent(capability);
  }

  /**
   * 执行风险传导分析 - 使用动态发现机制
   * 
   * 核心改进：通过智能体协作动态发现传导路径，而非静态匹配
   */
  async analyzeRiskPropagation(
    causalChain: CausalChainNode[],
    keyFactors: KeyFactor[],
    context?: {
      query?: string;
      timeline?: TimelineEvent[];
      searchResults?: SearchItem[];
    }
  ): Promise<{
    paths: RiskPropagationPath[];
    strongestPath: RiskPropagationPath | null;
    overallRisk: number;
    recommendations: string[];
    propagationNetwork?: PropagationNetwork;  // 新增：完整传导网络
    discoveryProcess?: CollaborativeDiscoveryResult;  // 新增：发现过程
  }> {
    console.log('[IntelligentBase] Starting dynamic propagation discovery...');
    
    // 如果有完整上下文，使用动态发现机制
    if (context?.query && context?.timeline && context?.searchResults) {
      try {
        // 调用动态传导发现器
        const discoveryResult = await this.dynamicPropagationDiscovery.discoverNetwork(
          context.query,
          causalChain,
          keyFactors,
          context.timeline,
          context.searchResults
        );
        
        // 提取传导路径
        const paths = this.extractPathsFromNetwork(discoveryResult.network);
        
        // 使用因果推理引擎验证
        const validation = this.causalReasoningEngine.validateCausalChain(causalChain);
        
        // 获取FEMA风险建议
        const riskAssessment = this.femaLibrary.assessRisk(keyFactors.map(f => f.factor));
        
        // 发布传导发现完成事件
        this.eventBus.emit('propagation_discovered', 'IntelligentBase', {
          networkId: discoveryResult.network.id,
          pathCount: paths.length,
          consensusLevel: discoveryResult.consensusLevel
        });
        
        return {
          paths,
          strongestPath: paths.reduce((max, p) => 
            p.传导强度 > (max?.传导强度 || 0) ? p : max
          , null as RiskPropagationPath | null),
          overallRisk: discoveryResult.network.totalImpact,
          recommendations: [
            ...validation.issues,
            ...riskAssessment.recommendations,
            ...discoveryResult.recommendations
          ],
          propagationNetwork: discoveryResult.network,
          discoveryProcess: discoveryResult
        };
      } catch (error) {
        console.error('[IntelligentBase] Dynamic discovery failed, falling back to simplified analysis:', error);
      }
    }
    
    // 回退到简化的静态分析（仅在缺少上下文时）
    console.log('[IntelligentBase] Using fallback analysis with historical cases');
    
    // 查询相似历史案例
    const historicalCases = this.dynamicPropagationDiscovery.findSimilarHistoricalCases(
      keyFactors.map(f => f.factor)
    );
    
    // 从历史案例推导传导路径
    const paths = this.inferPathsFromHistoricalCases(historicalCases, causalChain);
    
    // 使用因果推理引擎验证
    const validation = this.causalReasoningEngine.validateCausalChain(causalChain);
    
    // 获取FEMA风险建议
    const riskAssessment = this.femaLibrary.assessRisk(keyFactors.map(f => f.factor));
    
    return {
      paths,
      strongestPath: paths.reduce((max, p) => 
        p.传导强度 > (max?.传导强度 || 0) ? p : max
      , null as RiskPropagationPath | null),
      overallRisk: paths.length > 0 
        ? paths.reduce((sum, p) => sum + p.传导强度, 0) / paths.length 
        : 0.5,
      recommendations: [
        ...validation.issues,
        ...riskAssessment.recommendations
      ]
    };
  }
  
  /**
   * 从传导网络提取路径（转换为兼容格式）
   */
  private extractPathsFromNetwork(network: PropagationNetwork): RiskPropagationPath[] {
    const paths: RiskPropagationPath[] = [];
    
    network.paths.forEach(path => {
      paths.push({
        id: path.id,
        name: path.pathName,
        sourceNode: path.sourceNode,
        targetNodes: path.targetNodes,
        传导强度: path.pathStrength,
        传导时滞: path.transmissionDelay,
        传导机制: path.transmissionMechanism,
        historicalCases: path.historicalPrecedents
      });
    });
    
    return paths;
  }
  
  /**
   * 从历史案例推导传导路径
   */
  private inferPathsFromHistoricalCases(
    cases: HistoricalPropagationCase[],
    causalChain: CausalChainNode[]
  ): RiskPropagationPath[] {
    return cases.map((case_, index) => {
      // 根据因果链调整强度
      let strength = 0.6;
      if (causalChain.some(c => case_.propagationPath.includes(c.factor))) {
        strength = 0.75;
      }
      
      // 解析传导路径
      const pathNodes = case_.propagationPath.split('→').map(n => n.trim());
      
      return {
        id: `historical-${case_.id}`,
        name: `${case_.event}传导模式`,
        sourceNode: pathNodes[0] || '事件',
        targetNodes: pathNodes.slice(1),
        传导强度: strength,
        传导时滞: '参考历史',
        传导机制: case_.propagationPath,
        historicalCases: [case_.event]
      };
    });
  }

  /**
   * 获取适用的因果模式
   */
  getApplicableCausalPatterns(scenario: string): CausalPattern[] {
    return this.causalPatternLibrary.findApplicablePatterns(scenario);
  }

  /**
   * 发布事件
   */
  emitEvent(type: EventType, source: string, data: any): void {
    this.eventBus.emit(type, source, data);
  }

  /**
   * 订阅事件
   */
  subscribeEvent(type: EventType, listener: EventListener): () => void {
    return this.eventBus.subscribe(type, listener);
  }

  /**
   * 写入黑板
   */
  writeToBlackboard(key: string, value: any, source: string): void {
    this.blackboard.write(key, value, source);
  }

  /**
   * 读取黑板
   */
  readFromBlackboard<T = any>(key: string): T | undefined {
    return this.blackboard.getValue<T>(key);
  }
}

/**
 * 创建智能底座实例
 */
export function createIntelligentBase(customHeaders?: Record<string, string>): IntelligentBase {
  const config = new Config();
  const llmClient = new LLMClient(config, customHeaders);
  return new IntelligentBase(llmClient);
}
