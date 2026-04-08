/**
 * 事件驱动的推演引擎
 * 将人格模拟与事件分析打通，实现智能化的场景推演
 */

import { LLMClient, SearchClient, Config } from 'coze-coding-dev-sdk';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 关键人物识别结果
 */
export interface KeyFigure {
  id: string;
  name: string;
  role: string;
  country: string;
  relevance: number; // 与主题的相关度 0-1
  reasoning: string;
}

/**
 * 近期事件信息
 */
export interface RecentEvent {
  title: string;
  date: string;
  summary: string;
  impact: string;
  source: string;
}

/**
 * 推演决策
 */
export interface SimulatedDecision {
  figureId: string;
  figureName: string;
  decision: string;
  reasoning: string;
  confidence: number;
  constraints: string[]; // 决策约束
}

/**
 * 博弈推演结果
 */
export interface EventSimulationResult {
  topic: string;
  keyFigures: KeyFigure[];
  recentEvents: RecentEvent[];
  decisions: SimulatedDecision[];
  equilibrium: {
    type: 'stable' | 'unstable' | 'none';
    description: string;
    probability: number;
  };
  scenarios: {
    name: string;
    probability: number;
    description: string;
    chinaImpact: string;
  }[];
  recommendations: string[];
  createdAt: string;
}

/**
 * 推演配置
 */
export interface SimulationConfig {
  maxFigures: number;
  includeRecentEvents: boolean;
  simulationRounds: number;
  focusOnChinaImpact: boolean;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: SimulationConfig = {
  maxFigures: 5,
  includeRecentEvents: true,
  simulationRounds: 3,
  focusOnChinaImpact: true
};

// ============================================================================
// 人格库（基础模板，用于LLM失败时的降级）
// ============================================================================

/**
 * 注意：人格库现在主要用于降级场景
 * 正常情况下应该通过 /api/persona/identify 动态获取
 */
const PERSONA_FALLBACK: Record<string, {
  name: string;
  role: string;
  country: string;
  traits: string[];
  decisionStyle: 'conservative' | 'moderate' | 'aggressive';
}> = {
  'jerome_powell': {
    name: '杰罗姆·鲍威尔',
    role: '美联储主席',
    country: '美国',
    traits: ['数据驱动', '谨慎沟通', '注重市场预期管理'],
    decisionStyle: 'moderate'
  },
  'janet_yellen': {
    name: '珍妮特·耶伦',
    role: '美国财政部长',
    country: '美国',
    traits: ['务实', '注重就业', '支持财政刺激'],
    decisionStyle: 'moderate'
  }
};

// ============================================================================
// 事件驱动推演引擎
// ============================================================================

/**
 * 事件驱动推演引擎
 */
export class EventDrivenSimulationEngine {
  private llmClient: LLMClient;
  private searchClient: SearchClient;
  private config: SimulationConfig;
  
  constructor(config?: Partial<SimulationConfig>) {
    const sdkConfig = new Config();
    this.llmClient = new LLMClient(sdkConfig);
    this.searchClient = new SearchClient(sdkConfig);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 执行完整的推演流程
   */
  async simulate(topic: string, context?: {
    searchResults?: any[];
    timeline?: any[];
  }): Promise<EventSimulationResult> {
    console.log('[EventSimulation] 开始推演:', topic);
    
    // 1. 识别关键人物
    const keyFigures = await this.identifyKeyFigures(topic);
    console.log('[EventSimulation] 识别到关键人物:', keyFigures.length);
    
    // 2. 获取近期事件
    const recentEvents = this.config.includeRecentEvents 
      ? await this.getRecentEvents(topic, context?.searchResults)
      : [];
    console.log('[EventSimulation] 近期事件:', recentEvents.length);
    
    // 3. 模拟各方决策
    const decisions = await this.simulateDecisions(topic, keyFigures, recentEvents);
    console.log('[EventSimulation] 决策模拟完成:', decisions.length);
    
    // 4. 分析博弈均衡
    const equilibrium = await this.analyzeEquilibrium(topic, decisions);
    
    // 5. 生成推演场景
    const scenarios = await this.generateScenarios(topic, decisions, equilibrium);
    
    // 6. 生成建议
    const recommendations = this.generateRecommendations(scenarios);
    
    return {
      topic,
      keyFigures,
      recentEvents,
      decisions,
      equilibrium,
      scenarios,
      recommendations,
      createdAt: new Date().toISOString()
    };
  }
  
  /**
   * 识别关键人物
   */
  private async identifyKeyFigures(topic: string): Promise<KeyFigure[]> {
    const prompt = `分析以下主题，识别最相关的关键决策者（最多${this.config.maxFigures}人）：

主题：${topic}

请从以下维度考虑：
1. 该主题涉及的主要国家/地区
2. 相关领域的决策权限
3. 近期公开表态和立场
4. 对中国市场的潜在影响

请按以下JSON格式输出：
{
  "figures": [
    {
      "name": "人物姓名",
      "role": "职务",
      "country": "国家",
      "relevance": 0.0-1.0,
      "reasoning": "为什么此人与主题相关"
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是国际政治经济分析师，擅长识别关键决策者。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.figures || []).slice(0, this.config.maxFigures).map((f: any, i: number) => ({
          id: `figure_${i}`,
          name: f.name,
          role: f.role,
          country: f.country,
          relevance: f.relevance || 0.5,
          reasoning: f.reasoning
        }));
      }
    } catch (error) {
      console.error('[identifyKeyFigures] Error:', error);
    }
    
    // 降级：基于关键词匹配
    return this.fallbackIdentifyFigures(topic);
  }
  
  /**
   * 降级：关键词匹配识别人物
   */
  private fallbackIdentifyFigures(topic: string): KeyFigure[] {
    const figures: KeyFigure[] = [];
    const topicLower = topic.toLowerCase();
    
    // 金融关键词
    if (topicLower.includes('美联储') || topicLower.includes('降息') || topicLower.includes('利率')) {
      figures.push({
        id: 'jerome_powell',
        name: '杰罗姆·鲍威尔',
        role: '美联储主席',
        country: '美国',
        relevance: 0.95,
        reasoning: '美联储货币政策决策者'
      });
    }
    
    if (topicLower.includes('财政') || topicLower.includes('债务')) {
      figures.push({
        id: 'janet_yellen',
        name: '珍妮特·耶伦',
        role: '美国财政部长',
        country: '美国',
        relevance: 0.85,
        reasoning: '美国财政政策决策者'
      });
    }
    
    // 地缘政治关键词
    if (topicLower.includes('俄乌') || topicLower.includes('俄罗斯')) {
      figures.push({
        id: 'vladimir_putin',
        name: '弗拉基米尔·普京',
        role: '俄罗斯总统',
        country: '俄罗斯',
        relevance: 0.9,
        reasoning: '俄罗斯最高决策者'
      });
    }
    
    if (topicLower.includes('中美') || topicLower.includes('贸易战')) {
      figures.push({
        id: 'joe_biden',
        name: '乔·拜登',
        role: '美国总统',
        country: '美国',
        relevance: 0.9,
        reasoning: '美国对华政策决策者'
      });
    }
    
    // 如果没有匹配到，添加默认人物
    if (figures.length === 0) {
      figures.push({
        id: 'jerome_powell',
        name: '杰罗姆·鲍威尔',
        role: '美联储主席',
        country: '美国',
        relevance: 0.7,
        reasoning: '全球金融市场关键人物'
      });
    }
    
    return figures.slice(0, this.config.maxFigures);
  }
  
  /**
   * 获取近期事件
   */
  private async getRecentEvents(topic: string, searchResults?: any[]): Promise<RecentEvent[]> {
    // 如果有搜索结果，从中提取
    if (searchResults && searchResults.length > 0) {
      return searchResults.slice(0, 5).map((r: any) => ({
        title: r.title || r.source || '相关事件',
        date: r.date || new Date().toISOString().split('T')[0],
        summary: r.summary || r.snippet || '',
        impact: '待评估',
        source: r.source || r.url || ''
      }));
    }
    
    // 否则进行搜索
    try {
      const results = await this.searchClient.advancedSearch(`${topic} 最新动态`, {
        searchType: 'web',
        count: 5,
        needSummary: true
      });
      
      const items = (results as any).web_items || [];
      return items.map((item: any) => ({
        title: item.title || '',
        date: item.publish_date || new Date().toISOString().split('T')[0],
        summary: item.summary || item.snippet || '',
        impact: '待评估',
        source: item.source || item.url || ''
      }));
    } catch (error) {
      console.error('[getRecentEvents] Error:', error);
      return [];
    }
  }
  
  /**
   * 模拟各方决策（优先使用动态人格服务）
   */
  private async simulateDecisions(
    topic: string,
    figures: KeyFigure[],
    recentEvents: RecentEvent[]
  ): Promise<SimulatedDecision[]> {
    const decisions: SimulatedDecision[] = [];
    
    // 尝试调用动态人格服务获取增强的人格信息
    let enhancedPersonas: Record<string, any> = {};
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/persona/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, maxFigures: figures.length })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.figures) {
          // 建立名字到人格信息的映射
          result.data.figures.forEach((fig: any) => {
            enhancedPersonas[fig.name] = fig;
          });
        }
      }
    } catch (e) {
      console.warn('[simulateDecisions] Failed to get enhanced personas, using fallback');
    }
    
    // 为每个关键人物模拟决策
    for (const figure of figures) {
      // 优先使用动态获取的人格信息，其次使用降级人格库
      const persona = enhancedPersonas[figure.name] || PERSONA_FALLBACK[figure.id];
      
      const decision = await this.simulateSingleDecision(topic, figure, persona, recentEvents);
      decisions.push(decision);
    }
    
    return decisions;
  }
  
  /**
   * 模拟单个决策（优先使用动态人格服务）
   */
  private async simulateSingleDecision(
    topic: string,
    figure: KeyFigure,
    persona: any,
    recentEvents: RecentEvent[]
  ): Promise<SimulatedDecision> {
    const recentEventsText = recentEvents
      .map(e => `- ${e.title}: ${e.summary}`)
      .join('\n');
    
    // 尝试调用动态人格服务
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/persona/simulate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: {
            id: figure.id,
            name: figure.name,
            role: figure.role,
            traits: persona?.traits,
            decisionStyle: persona?.decisionStyle,
            recentStance: figure.reasoning
          },
          topic,
          recentEvents: recentEvents.slice(0, 3)
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.decision) {
          return {
            figureId: figure.id,
            figureName: figure.name,
            decision: result.data.decision.decision,
            reasoning: result.data.decision.reasoning,
            confidence: result.data.decision.confidence || 0.7,
            constraints: result.data.decision.constraints || []
          };
        }
      }
    } catch (e) {
      console.warn('[simulateSingleDecision] Dynamic service failed, using fallback');
    }
    
    // 降级：使用LLM直接模拟
    const prompt = `你现在是${figure.name}（${figure.role}），请基于以下信息做出决策判断：

【分析主题】
${topic}

【近期事件】
${recentEventsText || '暂无近期事件信息'}

【你的特征】
${persona?.traits?.join('、') || '稳健、务实'}
决策风格：${persona?.decisionStyle || 'moderate'}

请分析：
1. 你对这个主题的核心立场是什么？
2. 你最可能做出什么决策？
3. 你的决策约束因素有哪些？
4. 你对中国市场的考量是什么？

请按以下JSON格式输出：
{
  "decision": "你的核心决策判断",
  "reasoning": "决策理由（考虑你的立场、约束和目标）",
  "confidence": 0.0-1.0,
  "constraints": ["约束1", "约束2"]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: `你是${figure.name}的决策模拟器，需要完全代入其角色思考。` },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          figureId: figure.id,
          figureName: figure.name,
          decision: parsed.decision || '维持现状',
          reasoning: parsed.reasoning || '',
          confidence: parsed.confidence || 0.5,
          constraints: parsed.constraints || []
        };
      }
    } catch (error) {
      console.error('[simulateSingleDecision] Error:', error);
    }
    
    // 最终降级
    return {
      figureId: figure.id,
      figureName: figure.name,
      decision: '观望，等待更多信息',
      reasoning: `作为${figure.role}，倾向于采取${persona?.decisionStyle || '稳健'}的策略`,
      confidence: 0.5,
      constraints: ['信息不完整', '需要协调多方利益']
    };
  }
  
  /**
   * 分析博弈均衡
   */
  private async analyzeEquilibrium(
    topic: string,
    decisions: SimulatedDecision[]
  ): Promise<EventSimulationResult['equilibrium']> {
    const decisionsText = decisions
      .map(d => `- ${d.figureName}: ${d.decision}（置信度${(d.confidence * 100).toFixed(0)}%）`)
      .join('\n');
    
    const prompt = `分析以下多方决策是否存在博弈均衡：

【主题】
${topic}

【各方决策】
${decisionsText}

请判断：
1. 各方决策是否形成了稳定的均衡状态？
2. 是否存在某方有改变策略的动机？
3. 均衡可能的持续时间？

请按以下JSON格式输出：
{
  "type": "stable/unstable/none",
  "description": "均衡分析描述",
  "probability": 0.0-1.0
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是博弈论专家，擅长分析多方博弈均衡。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'unstable',
          description: parsed.description || '',
          probability: parsed.probability || 0.5
        };
      }
    } catch (error) {
      console.error('[analyzeEquilibrium] Error:', error);
    }
    
    return {
      type: 'unstable',
      description: '各方立场存在分歧，博弈尚未达到均衡',
      probability: 0.4
    };
  }
  
  /**
   * 生成推演场景
   */
  private async generateScenarios(
    topic: string,
    decisions: SimulatedDecision[],
    equilibrium: EventSimulationResult['equilibrium']
  ): Promise<EventSimulationResult['scenarios']> {
    const decisionsText = decisions
      .map(d => `${d.figureName}: ${d.decision}`)
      .join('\n');
    
    const prompt = `基于以下博弈分析，生成3个可能的推演场景：

【主题】
${topic}

【当前决策状态】
${decisionsText}

【博弈均衡】
类型：${equilibrium.type}
描述：${equilibrium.description}

请生成：
1. 乐观场景：对中国有利
2. 基准场景：最可能发生
3. 悲观场景：对中国不利

请按以下JSON格式输出：
{
  "scenarios": [
    {
      "name": "场景名称",
      "probability": 0.0-1.0,
      "description": "场景描述",
      "chinaImpact": "对中国市场的影响"
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是情景规划专家，擅长生成多情景推演。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.4
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.scenarios || []).slice(0, 3);
      }
    } catch (error) {
      console.error('[generateScenarios] Error:', error);
    }
    
    // 降级场景
    return [
      {
        name: '基准场景',
        probability: 0.5,
        description: '当前趋势延续',
        chinaImpact: '影响中性'
      },
      {
        name: '上行场景',
        probability: 0.25,
        description: '乐观情况发展',
        chinaImpact: '正面影响'
      },
      {
        name: '下行场景',
        probability: 0.25,
        description: '悲观情况发展',
        chinaImpact: '负面冲击'
      }
    ];
  }
  
  /**
   * 生成建议
   */
  private generateRecommendations(scenarios: EventSimulationResult['scenarios']): string[] {
    const recommendations: string[] = [];
    
    // 基于场景生成建议
    const highProbScenario = scenarios.reduce((a, b) => 
      a.probability > b.probability ? a : b
    );
    
    recommendations.push(`重点关注"${highProbScenario.name}"，概率${(highProbScenario.probability * 100).toFixed(0)}%`);
    
    if (highProbScenario.chinaImpact.includes('负面') || highProbScenario.chinaImpact.includes('不利')) {
      recommendations.push('建议提前制定风险应对预案');
    }
    
    const optimisticScenario = scenarios.find(s => 
      s.name.includes('乐观') || s.name.includes('上行')
    );
    if (optimisticScenario && optimisticScenario.probability > 0.2) {
      recommendations.push('存在乐观情景，可适度把握机会窗口');
    }
    
    recommendations.push('持续监控关键决策者动态');
    
    return recommendations;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 快速执行事件推演
 */
export async function quickSimulate(
  topic: string,
  context?: {
    searchResults?: any[];
    timeline?: any[];
  },
  config?: Partial<SimulationConfig>
): Promise<EventSimulationResult> {
  const engine = new EventDrivenSimulationEngine(config);
  return engine.simulate(topic, context);
}

/**
 * 创建事件驱动推演引擎
 */
export function createEventDrivenSimulationEngine(
  config?: Partial<SimulationConfig>
): EventDrivenSimulationEngine {
  return new EventDrivenSimulationEngine(config);
}
