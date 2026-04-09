/**
 * 博弈仿真引擎
 * 实现多方博弈推演和均衡分析
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import {
  PersonaProfile,
  PersonaDecision,
  GameRound,
  GameSimulationResult,
  GameSimulationConfig,
  personaAgentNode,
  createLLMClientForPersona,
  getAllPersonas,
  getPersonaById
} from './persona-system';

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: GameSimulationConfig = {
  maxRounds: 3,
  convergenceThreshold: 0.85,
  includeChinaImpact: true
};

// ============================================================================
// 博弈仿真引擎类
// ============================================================================

/**
 * 博弈仿真引擎
 */
export class GameSimulationEngine {
  private llmClient: LLMClient;
  private config: GameSimulationConfig;
  
  constructor(config?: Partial<GameSimulationConfig>) {
    this.llmClient = createLLMClientForPersona();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 执行博弈仿真
   * 
   * @param scenario 场景描述
   * @param personaIds 参与者ID列表
   * @returns 仿真结果
   */
  async simulate(
    scenario: string,
    personaIds: string[]
  ): Promise<GameSimulationResult> {
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startTime = new Date().toISOString();
    
    console.log(`[GameSimulation] Starting simulation ${simulationId}`);
    console.log(`[GameSimulation] Scenario: ${scenario.substring(0, 100)}...`);
    console.log(`[GameSimulation] Participants: ${personaIds.join(', ')}`);
    
    // 获取参与者人格
    const personas = personaIds
      .map(id => getPersonaById(id))
      .filter((p): p is PersonaProfile => p !== undefined);
    
    if (personas.length === 0) {
      throw new Error('No valid personas found for simulation');
    }
    
    // 初始化结果
    const result: GameSimulationResult = {
      simulationId,
      scenario,
      participants: personas.map(p => p.name),
      startTime,
      endTime: '',
      rounds: [],
      equilibrium: {
        reached: false,
        description: '',
        outcomes: []
      },
      turningPoints: [],
      confidence: 0,
      conclusion: ''
    };
    
    // 执行多轮博弈
    let allDecisions: PersonaDecision[] = [];
    
    for (let round = 1; round <= this.config.maxRounds; round++) {
      console.log(`[GameSimulation] Starting round ${round}`);
      
      const roundResult = await this.executeRound(
        round,
        scenario,
        personas,
        allDecisions
      );
      
      result.rounds.push(roundResult);
      allDecisions = [...allDecisions, ...roundResult.decisions];
      
      // 检查是否达到均衡
      if (round > 1) {
        const convergence = this.checkConvergence(
          result.rounds[round - 2],
          roundResult
        );
        
        if (convergence.reached) {
          result.equilibrium.reached = true;
          result.equilibrium.roundReached = round;
          console.log(`[GameSimulation] Equilibrium reached at round ${round}`);
          break;
        }
        
        // 记录转折点
        if (convergence.turningPoint) {
          result.turningPoints.push({
            round,
            description: convergence.turningPoint,
            impact: convergence.impact || ''
          });
        }
      }
    }
    
    // 计算均衡结果
    result.equilibrium = await this.computeEquilibrium(result);
    
    // 计算中国市场影响
    if (this.config.includeChinaImpact) {
      result.chinaImpact = await this.computeChinaImpact(result, scenario);
    }
    
    // 生成结论
    result.conclusion = await this.generateConclusion(result);
    
    // 计算置信度
    result.confidence = this.computeConfidence(result);
    
    result.endTime = new Date().toISOString();
    
    console.log(`[GameSimulation] Simulation ${simulationId} completed`);
    
    return result;
  }
  
  /**
   * 执行单轮博弈
   */
  private async executeRound(
    roundNumber: number,
    scenario: string,
    personas: PersonaProfile[],
    previousDecisions: PersonaDecision[]
  ): Promise<GameRound> {
    const decisions: PersonaDecision[] = [];
    const keyEvents: string[] = [];
    
    // 构建上一轮的决策摘要
    const previousRoundDecisions = previousDecisions.length > 0
      ? this.summarizePreviousDecisions(previousDecisions, personas.length)
      : undefined;
    
    // 每个人格依次决策
    for (const persona of personas) {
      // 获取当前轮其他人已做出的决策
      const currentRoundDecisions = decisions.filter(d => d.personaId !== persona.id);
      
      // 合并所有已知决策
      const knownDecisions = [...currentRoundDecisions];
      if (previousRoundDecisions) {
        knownDecisions.push(...previousRoundDecisions.filter(d => d.personaId !== persona.id));
      }
      
      console.log(`[GameSimulation] Round ${roundNumber}: ${persona.name} making decision...`);
      
      // 执行人格决策
      const decision = await personaAgentNode(persona, scenario, {
        llmClient: this.llmClient,
        previousDecisions: knownDecisions.length > 0 ? knownDecisions : undefined,
        additionalContext: roundNumber > 1 
          ? `这是第 ${roundNumber} 轮博弈，请根据之前的互动调整你的决策。`
          : undefined
      });
      
      decisions.push(decision);
      
      // 记录关键事件
      if (decision.confidence > 0.7 || decision.action.includes('关键') || decision.action.includes('重要')) {
        keyEvents.push(`${persona.name}: ${decision.action}`);
      }
    }
    
    // 生成轮次摘要
    const summary = await this.summarizeRound(decisions, roundNumber);
    
    return {
      round: roundNumber,
      timestamp: new Date().toISOString(),
      decisions,
      summary,
      keyEvents
    };
  }
  
  /**
   * 总结上一轮决策
   */
  private summarizePreviousDecisions(
    decisions: PersonaDecision[],
    participantsCount: number
  ): PersonaDecision[] {
    // 按轮次分组，取最近的决策
    const latestDecisions = new Map<string, PersonaDecision>();
    
    for (const decision of decisions.reverse()) {
      if (!latestDecisions.has(decision.personaId)) {
        latestDecisions.set(decision.personaId, decision);
      }
    }
    
    return Array.from(latestDecisions.values());
  }
  
  /**
   * 总结单轮博弈
   */
  private async summarizeRound(
    decisions: PersonaDecision[],
    roundNumber: number
  ): Promise<string> {
    const decisionsSummary = decisions.map(d => 
      `${d.personaName}: ${d.action}`
    ).join('; ');
    
    // 使用LLM生成总结
    const prompt = `请用100-150字总结以下第${roundNumber}轮博弈的主要动态：

${decisionsSummary}

关注：主要冲突点、合作可能性、关键决策`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });
      
      return response.content || decisionsSummary;
    } catch {
      return decisionsSummary;
    }
  }
  
  /**
   * 检查收敛性
   */
  private checkConvergence(
    previousRound: GameRound,
    currentRound: GameRound
  ): {
    reached: boolean;
    turningPoint?: string;
    impact?: string;
  } {
    // 比较两轮决策的相似度
    let similarityScore = 0;
    let turningPoint: string | undefined;
    
    for (const currentDecision of currentRound.decisions) {
      const previousDecision = previousRound.decisions.find(
        d => d.personaId === currentDecision.personaId
      );
      
      if (previousDecision) {
        // 计算行动相似度
        const actionSimilarity = this.textSimilarity(
          currentDecision.action,
          previousDecision.action
        );
        
        // 计算理由相似度
        const reasoningSimilarity = this.textSimilarity(
          currentDecision.reasoning,
          previousDecision.reasoning
        );
        
        similarityScore += (actionSimilarity * 0.6 + reasoningSimilarity * 0.4);
        
        // 检测重大转变
        if (actionSimilarity < 0.3) {
          turningPoint = `${currentDecision.personaName}的策略发生重大转变`;
        }
      }
    }
    
    const avgSimilarity = similarityScore / currentRound.decisions.length;
    const reached = avgSimilarity >= this.config.convergenceThreshold;
    
    return {
      reached,
      turningPoint,
      impact: turningPoint ? '可能导致博弈走向变化' : undefined
    };
  }
  
  /**
   * 计算均衡结果
   */
  private async computeEquilibrium(
    result: GameSimulationResult
  ): Promise<GameSimulationResult['equilibrium']> {
    const lastRound = result.rounds[result.rounds.length - 1];
    
    // 构建均衡分析提示
    const decisionsContext = lastRound.decisions.map(d => 
      `${d.personaName}: ${d.action} (理由: ${d.reasoning.substring(0, 100)}...)`
    ).join('\n');
    
    const prompt = `基于以下博弈最终状态，分析是否达到均衡以及各方结果：

${decisionsContext}

请分析：
1. 是否达到博弈均衡？（各方策略是否稳定）
2. 各参与者的最终结果如何？
3. 均衡描述（50-100字）

请按以下JSON格式输出：
{
  "reached": true/false,
  "description": "均衡描述",
  "outcomes": [
    {
      "participant": "参与者名称",
      "outcome": "结果描述",
      "satisfaction": 0.8
    }
  ]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.4
      });
      
      const parsed = JSON.parse(response.content?.replace(/```json\n?|\n?```/g, '') || '{}');
      
      return {
        reached: parsed.reached ?? false,
        roundReached: result.equilibrium.roundReached,
        description: parsed.description || '',
        outcomes: parsed.outcomes || []
      };
    } catch {
      return {
        reached: false,
        description: '无法确定均衡状态',
        outcomes: lastRound.decisions.map(d => ({
          participant: d.personaName,
          outcome: d.action,
          satisfaction: d.confidence
        }))
      };
    }
  }
  
  /**
   * 计算中国市场影响
   */
  private async computeChinaImpact(
    result: GameSimulationResult,
    scenario: string
  ): Promise<GameSimulationResult['chinaImpact']> {
    const decisionsContext = result.rounds.flatMap(r => r.decisions).map(d =>
      `${d.personaName}: ${d.action}`
    ).join('\n');
    
    const prompt = `基于以下博弈推演结果，分析对中国市场的影响：

场景：${scenario}

关键决策：
${decisionsContext}

请分析对中国的影响，按以下JSON格式输出：
{
  "overallAssessment": "整体影响评估（50-100字）",
  "affectedSectors": ["受影响行业1", "受影响行业2"],
  "riskLevel": "low/medium/high",
  "opportunities": ["机遇1", "机遇2"],
  "challenges": ["挑战1", "挑战2"]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是中国宏观经济分析师，专门分析国际局势对中国的影响。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });
      
      const parsed = JSON.parse(response.content?.replace(/```json\n?|\n?```/g, '') || '{}');
      
      return {
        overallAssessment: parsed.overallAssessment || '',
        affectedSectors: parsed.affectedSectors || [],
        riskLevel: parsed.riskLevel || 'medium',
        opportunities: parsed.opportunities || [],
        challenges: parsed.challenges || []
      };
    } catch {
      return {
        overallAssessment: '需要进一步分析',
        affectedSectors: [],
        riskLevel: 'medium',
        opportunities: [],
        challenges: []
      };
    }
  }
  
  /**
   * 生成结论
   */
  private async generateConclusion(result: GameSimulationResult): Promise<string> {
    const prompt = `基于以下博弈推演结果，生成综合结论（150-250字）：

场景：${result.scenario}

参与者：${result.participants.join('、')}

轮次：${result.rounds.length}轮

均衡状态：${result.equilibrium.reached ? '已达到均衡' : '未达到均衡'}

${result.chinaImpact ? `中国影响：${result.chinaImpact.overallAssessment}` : ''}

关键转折：
${result.turningPoints.map(t => `第${t.round}轮: ${t.description}`).join('\n')}

请生成简洁有力的结论，包含：主要发现、关键洞察、预测方向。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });
      
      return response.content || '';
    } catch {
      return '博弈推演完成，建议进一步分析具体情境。';
    }
  }
  
  /**
   * 计算置信度
   */
  private computeConfidence(result: GameSimulationResult): number {
    let confidence = 0.5;
    
    // 轮次越多，置信度越高
    confidence += Math.min(result.rounds.length * 0.05, 0.15);
    
    // 达到均衡提高置信度
    if (result.equilibrium.reached) {
      confidence += 0.1;
    }
    
    // 决策一致性
    const avgDecisionConfidence = result.rounds.flatMap(r => r.decisions)
      .reduce((sum, d) => sum + d.confidence, 0) / 
      (result.rounds.length * result.participants.length);
    confidence += avgDecisionConfidence * 0.2;
    
    return Math.min(confidence, 0.95);
  }
  
  /**
   * 文本相似度计算
   */
  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+|[,，。？！]/));
    const words2 = new Set(text2.toLowerCase().split(/\s+|[,，。？！]/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建博弈仿真引擎
 */
export function createGameSimulationEngine(
  config?: Partial<GameSimulationConfig>
): GameSimulationEngine {
  return new GameSimulationEngine(config);
}

/**
 * 快速仿真
 */
export async function quickSimulate(
  scenario: string,
  personaIds: string[]
): Promise<GameSimulationResult> {
  const engine = new GameSimulationEngine();
  return engine.simulate(scenario, personaIds);
}

// ============================================================================
// 预设仿真场景
// ============================================================================

/**
 * 美联储加息影响仿真
 */
export async function simulateFedRateHike(): Promise<GameSimulationResult> {
  const scenario = `美联储宣布加息50个基点，联邦基金利率目标区间上调至5.25%-5.5%。
这是本轮加息周期的第11次加息，市场关注：
1. 美联储后续政策路径
2. 中国央行应对策略
3. 全球资本流动变化
4. 新兴市场影响`;

  return quickSimulate(scenario, [
    'fed_chair_powell',
    'pboc_governor',
    'institutional_investor'
  ]);
}

/**
 * 地缘政治危机仿真
 */
export async function simulateGeopoliticalCrisis(): Promise<GameSimulationResult> {
  const scenario = `某地区突发地缘政治危机，涉及多方利益：
1. 美国考虑介入
2. 俄罗斯可能支持对立面
3. 中国呼吁和平解决
4. 全球能源市场波动`;

  return quickSimulate(scenario, [
    'us_president',
    'russian_president',
    'institutional_investor'
  ]);
}

/**
 * 中美贸易摩擦仿真
 */
export async function simulateTradeTension(): Promise<GameSimulationResult> {
  const scenario = `美国宣布对华新一轮关税措施，涉及高科技产品。
中国可能采取反制措施。
跨国企业面临供应链调整压力。
全球产业链格局可能重塑。`;

  return quickSimulate(scenario, [
    'us_president',
    'corporate_ceo',
    'institutional_investor'
  ]);
}
