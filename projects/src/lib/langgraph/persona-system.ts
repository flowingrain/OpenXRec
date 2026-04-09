/**
 * 人格智能体系统
 * 实现关键角色的模拟仿真推演
 * 支持多方博弈分析和决策预测
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import { getChatModelId } from '@/lib/llm/chat-model';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 决策风格
 */
export type DecisionStyle = 'data_driven' | 'intuition' | 'consensus' | 'authoritarian';

/**
 * 风险偏好
 */
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

/**
 * 时间视野
 */
export type TimeHorizon = 'short' | 'medium' | 'long';

/**
 * 人格画像
 */
export interface PersonaProfile {
  // 基础信息
  id: string;
  name: string;
  nameEn?: string;
  role: string;
  organization: string;
  avatar?: string;
  
  // 人格特征
  personality: {
    decisionStyle: DecisionStyle;
    riskTolerance: RiskTolerance;
    timeHorizon: TimeHorizon;
    valueSystem: string[];        // 价值观优先级
    communicationStyle: string;    // 沟通风格
    keyConcerns: string[];         // 核心关切
  };
  
  // 历史行为模式
  behaviorPatterns: BehaviorPattern[];
  
  // 知识背景
  expertise: {
    domains: string[];             // 专业领域
    biases: string[];              // 已知偏见/倾向
    constraints: string[];         // 决策约束
  };
  
  // 行为约束
  constraints: {
    institutionalLimits: string[];  // 制度限制
    politicalFactors: string[];     // 政治因素
    resourceLimits: string[];       // 资源限制
    stakeholderInterests: string[]; // 利益相关者
  };
  
  // 决策记录（用于学习）
  decisionHistory?: DecisionRecord[];
}

/**
 * 行为模式
 */
export interface BehaviorPattern {
  scenario: string;      // 历史场景描述
  context: string;       // 场景背景
  action: string;        // 采取的行动
  reasoning: string;     // 决策理由
  outcome: string;       // 结果
  lessons?: string;      // 经验教训
}

/**
 * 决策记录
 */
export interface DecisionRecord {
  timestamp: string;
  scenario: string;
  decision: PersonaDecision;
  actualOutcome?: string;
  accuracy?: 'accurate' | 'partial' | 'inaccurate';
}

/**
 * 人格决策输出
 */
export interface PersonaDecision {
  personaId: string;
  personaName: string;
  
  // 对局势的解读
  interpretation: string;
  
  // 决策行动
  action: string;
  
  // 决策理由
  reasoning: string;
  
  // 决策依据
  evidence: string[];
  
  // 预期其他方的反应
  expectedReactions: Array<{
    actor: string;
    expectedAction: string;
    confidence: number;
  }>;
  
  // 决策置信度
  confidence: number;
  
  // 决策条件
  conditions?: string[];
  
  // 备选方案
  alternatives?: string[];
}

/**
 * 博弈轮次
 */
export interface GameRound {
  round: number;
  timestamp: string;
  decisions: PersonaDecision[];
  summary: string;
  keyEvents: string[];
}

/**
 * 博弈仿真结果
 */
export interface GameSimulationResult {
  simulationId: string;
  scenario: string;
  participants: string[];
  startTime: string;
  endTime: string;
  
  // 博弈轮次
  rounds: GameRound[];
  
  // 均衡结果
  equilibrium: {
    reached: boolean;
    roundReached?: number;
    description: string;
    outcomes: Array<{
      participant: string;
      outcome: string;
      satisfaction: number;
    }>;
  };
  
  // 关键转折点
  turningPoints: Array<{
    round: number;
    description: string;
    impact: string;
  }>;
  
  // 中国市场影响
  chinaImpact?: {
    overallAssessment: string;
    affectedSectors: string[];
    riskLevel: 'low' | 'medium' | 'high';
    opportunities: string[];
    challenges: string[];
  };
  
  // 置信度
  confidence: number;
  
  // 结论
  conclusion: string;
}

/**
 * 博弈仿真配置
 */
export interface GameSimulationConfig {
  maxRounds: number;
  convergenceThreshold: number;
  includeChinaImpact: boolean;
  decisionDelay?: number;
}

// ============================================================================
// 预置人格库
// ============================================================================

/**
 * 金融决策者人格库
 */
export const FINANCE_PERSONAS: PersonaProfile[] = [
  {
    id: 'fed_chair_powell',
    name: '杰罗姆·鲍威尔',
    nameEn: 'Jerome Powell',
    role: '美联储主席',
    organization: '美国联邦储备系统',
    personality: {
      decisionStyle: 'data_driven',
      riskTolerance: 'moderate',
      timeHorizon: 'medium',
      valueSystem: ['通胀控制', '就业最大化', '金融稳定', '独立性'],
      communicationStyle: '谨慎透明，渐进式沟通',
      keyConcerns: ['通胀预期', '劳动力市场', '金融市场稳定', '政策可信度']
    },
    behaviorPatterns: [
      {
        scenario: '2022年高通胀应对',
        context: '通胀率突破9%，创40年新高',
        action: '启动激进加息周期，连续大幅加息75个基点',
        reasoning: '通胀失控风险高于衰退风险，必须果断行动重建价格稳定',
        outcome: '通胀逐步回落，但经济软着陆难度增加'
      },
      {
        scenario: '2023年银行业危机',
        context: '硅谷银行等区域性银行倒闭',
        action: '快速提供流动性支持，同时维持加息立场',
        reasoning: '区分货币政策与金融稳定工具，避免道德风险',
        outcome: '银行业企稳，通胀治理继续推进'
      }
    ],
    expertise: {
      domains: ['货币政策', '金融市场', '宏观经济', '银行监管'],
      biases: ['偏好渐进主义', '重视市场预期管理'],
      constraints: ['国会授权', '数据依赖', 'FOMC共识']
    },
    constraints: {
      institutionalLimits: ['美联储独立性', '双重使命', '国会监督'],
      politicalFactors: ['白宫压力', '国会听证', '公众舆论'],
      resourceLimits: ['政策工具有限', '传导时滞'],
      stakeholderInterests: ['华尔街', '中小企业', '消费者']
    }
  },
  {
    id: 'pboc_governor',
    name: '中国央行行长',
    role: '中国人民银行行长',
    organization: '中国人民银行',
    personality: {
      decisionStyle: 'consensus',
      riskTolerance: 'conservative',
      timeHorizon: 'long',
      valueSystem: ['金融稳定', '经济增长', '汇率稳定', '服务实体经济'],
      communicationStyle: '稳健务实，注重预期引导',
      keyConcerns: ['系统性风险', '资本流动', '房地产风险', '地方政府债务']
    },
    behaviorPatterns: [
      {
        scenario: '美联储加息周期',
        context: '美联储快速加息，中美利差倒挂',
        action: '降准降息对冲，同时加强资本流动管理',
        reasoning: '以我为主，兼顾内外平衡，维护经济稳定',
        outcome: '人民币有序贬值，经济保持韧性'
      },
      {
        scenario: '房地产市场下行',
        context: '房企债务风险暴露，房价下跌',
        action: '降低房贷利率，提供融资支持，"保交楼"',
        reasoning: '防范系统性风险，维护社会稳定',
        outcome: '市场逐步企稳，风险可控'
      }
    ],
    expertise: {
      domains: ['货币政策', '金融监管', '外汇管理', '宏观审慎'],
      biases: ['稳增长优先', '防风险导向'],
      constraints: ['国务院领导', '党委会决策', '多目标平衡']
    },
    constraints: {
      institutionalLimits: ['货币政策委员会', '国务院授权'],
      politicalFactors: ['党中央决策', '国务院部署', '地方协调'],
      resourceLimits: ['外汇储备管理', '政策空间约束'],
      stakeholderInterests: ['国有企业', '商业银行', '地方政府']
    }
  },
  {
    id: 'ecb_president',
    name: '克里斯蒂娜·拉加德',
    nameEn: 'Christine Lagarde',
    role: '欧洲央行行长',
    organization: '欧洲中央银行',
    personality: {
      decisionStyle: 'consensus',
      riskTolerance: 'moderate',
      timeHorizon: 'medium',
      valueSystem: ['价格稳定', '经济增长', '金融一体化', '社会公正'],
      communicationStyle: '外交辞令，多边协调',
      keyConcerns: ['通胀压力', '成员国差异', '能源安全', '地缘风险']
    },
    behaviorPatterns: [
      {
        scenario: '俄乌冲突能源危机',
        context: '能源价格飙升，通胀创历史新高',
        action: '结束负利率政策，但节奏谨慎以避免分化',
        reasoning: '平衡通胀治理与成员国差异，避免债务危机重演',
        outcome: '通胀回落，经济避免了深度衰退'
      }
    ],
    expertise: {
      domains: ['货币政策', '国际金融', '多边外交', '结构性改革'],
      biases: ['多边主义倾向', '注重社会维度'],
      constraints: ['欧元区共识', '德国立场', '南欧诉求']
    },
    constraints: {
      institutionalLimits: ['欧盟条约', '成员国协调'],
      politicalFactors: ['德法博弈', '南北分歧', '欧盟委员会'],
      resourceLimits: ['财政能力有限', '银行联盟不完整'],
      stakeholderInterests: ['德国', '法国', '意大利', '南欧国家']
    }
  }
];

/**
 * 地缘政治决策者人格库
 */
export const GEOPOLITICS_PERSONAS: PersonaProfile[] = [
  {
    id: 'us_president',
    name: '美国总统',
    nameEn: 'US President',
    role: '美国总统',
    organization: '美国政府',
    personality: {
      decisionStyle: 'data_driven',
      riskTolerance: 'moderate',
      timeHorizon: 'medium',
      valueSystem: ['美国利益', '民主价值观', '盟友关系', '全球领导力'],
      communicationStyle: '直接强硬，价值观导向',
      keyConcerns: ['中国崛起', '俄罗斯威胁', '中东稳定', '国内政治']
    },
    behaviorPatterns: [
      {
        scenario: '中美贸易摩擦',
        context: '对华贸易逆差持续扩大',
        action: '加征关税，科技脱钩，强化盟友协调',
        reasoning: '维护美国经济优势，遏制中国技术追赶',
        outcome: '贸易格局重塑，但通胀压力上升'
      }
    ],
    expertise: {
      domains: ['外交政策', '国家安全', '经济政策', '军事战略'],
      biases: ['美国优先', '价值观外交'],
      constraints: ['国会审批', '中期选举', '媒体监督']
    },
    constraints: {
      institutionalLimits: ['三权分立', '国会授权', '司法审查'],
      politicalFactors: ['党派政治', '选举周期', '利益集团'],
      resourceLimits: ['国债上限', '军事资源'],
      stakeholderInterests: ['军工复合体', '华尔街', '工会', '科技巨头']
    }
  },
  {
    id: 'russian_president',
    name: '俄罗斯总统',
    role: '俄罗斯联邦总统',
    organization: '俄罗斯联邦政府',
    personality: {
      decisionStyle: 'authoritarian',
      riskTolerance: 'aggressive',
      timeHorizon: 'long',
      valueSystem: ['大国地位', '安全缓冲', '主权完整', '历史使命'],
      communicationStyle: '强硬直接，战略模糊',
      keyConcerns: ['北约东扩', '乌克兰问题', '能源地位', '政权稳定']
    },
    behaviorPatterns: [
      {
        scenario: '乌克兰危机',
        context: '北约东扩压力，乌克兰倒向西方',
        action: '军事行动，能源武器化，信息战',
        reasoning: '维护战略缓冲地带，阻止北约进一步东扩',
        outcome: '与西方全面对抗，转向东方'
      }
    ],
    expertise: {
      domains: ['军事战略', '能源外交', '情报工作', '地缘政治'],
      biases: ['零和思维', '势力范围观念'],
      constraints: ['经济实力有限', '技术落后']
    },
    constraints: {
      institutionalLimits: ['宪法限制', '精英共识'],
      politicalFactors: ['精英支持', '民众动员', '反对派压制'],
      resourceLimits: ['能源收入依赖', '技术制裁'],
      stakeholderInterests: ['能源寡头', '安全部门', '军工复合体']
    }
  }
];

/**
 * 市场参与者人格库
 */
export const MARKET_PERSONAS: PersonaProfile[] = [
  {
    id: 'institutional_investor',
    name: '机构投资者',
    role: '全球基金经理',
    organization: '大型资产管理公司',
    personality: {
      decisionStyle: 'data_driven',
      riskTolerance: 'moderate',
      timeHorizon: 'medium',
      valueSystem: ['投资回报', '风险控制', '流动性', '声誉'],
      communicationStyle: '专业谨慎，合规导向',
      keyConcerns: ['市场波动', '政策变化', '流动性风险', 'ESG合规']
    },
    behaviorPatterns: [
      {
        scenario: '美联储加息周期',
        context: '利率快速上升，债券收益率攀升',
        action: '减持新兴市场资产，增持美元资产和短期债券',
        reasoning: '利率上升增加新兴市场风险，美元资产相对吸引力提高',
        outcome: '资本从新兴市场流出，美元走强'
      }
    ],
    expertise: {
      domains: ['资产配置', '风险管理', '宏观经济', '行业研究'],
      biases: ['趋势跟随', '从众心理'],
      constraints: ['投资指引', '监管合规', '赎回压力']
    },
    constraints: {
      institutionalLimits: ['投资限制', '风险预算', '合规要求'],
      politicalFactors: ['监管环境', '税收政策'],
      resourceLimits: ['流动性管理', '杠杆限制'],
      stakeholderInterests: ['LP/投资者', '基金经理', '监管机构']
    }
  },
  {
    id: 'hedge_fund_manager',
    name: '对冲基金经理',
    role: '对冲基金经理',
    organization: '量化对冲基金',
    personality: {
      decisionStyle: 'data_driven',
      riskTolerance: 'aggressive',
      timeHorizon: 'short',
      valueSystem: ['绝对收益', '信息优势', '杠杆效率', '竞争优势'],
      communicationStyle: '低调神秘，结果导向',
      keyConcerns: ['市场效率', '信号识别', '风险敞口', '竞争态势']
    },
    behaviorPatterns: [
      {
        scenario: '市场剧烈波动',
        context: '黑天鹅事件导致市场恐慌',
        action: '加大杠杆，逆向投资或趋势跟踪',
        reasoning: '波动率上升创造机会，利用市场过度反应',
        outcome: '高收益但高风险'
      }
    ],
    expertise: {
      domains: ['量化交易', '衍生品', '风险管理', '市场微观结构'],
      biases: ['过度自信', '模型依赖'],
      constraints: ['杠杆限制', '流动性风险', '赎回条款']
    },
    constraints: {
      institutionalLimits: ['基金章程', '风险限额'],
      politicalFactors: ['监管审查', '税收变化'],
      resourceLimits: ['融资成本', '对手方风险'],
      stakeholderInterests: ['投资者', '合伙人', '员工']
    }
  },
  {
    id: 'corporate_ceo',
    name: '企业CEO',
    role: '跨国公司首席执行官',
    organization: '全球500强企业',
    personality: {
      decisionStyle: 'data_driven',
      riskTolerance: 'moderate',
      timeHorizon: 'long',
      valueSystem: ['股东价值', '战略增长', '品牌声誉', '员工利益'],
      communicationStyle: '愿景驱动，利益相关者平衡',
      keyConcerns: ['市场增长', '成本控制', '供应链', '数字化转型']
    },
    behaviorPatterns: [
      {
        scenario: '中美贸易摩擦',
        context: '关税上升，供应链风险增加',
        action: '供应链多元化，"中国+1"策略，本土化生产',
        reasoning: '降低地缘风险，保持市场准入',
        outcome: '成本短期上升，但韧性增强'
      }
    ],
    expertise: {
      domains: ['企业战略', '运营管理', '财务规划', '人才管理'],
      biases: ['增长偏好', '风险规避'],
      constraints: ['董事会', '股东预期', 'ESG要求']
    },
    constraints: {
      institutionalLimits: ['公司治理', '董事会决议'],
      politicalFactors: ['监管合规', '政府关系', '公众舆论'],
      resourceLimits: ['资本预算', '人才供给', '技术能力'],
      stakeholderInterests: ['股东', '员工', '客户', '供应商', '社区']
    }
  }
];

/**
 * 获取所有预置人格
 */
export function getAllPersonas(): PersonaProfile[] {
  return [
    ...FINANCE_PERSONAS,
    ...GEOPOLITICS_PERSONAS,
    ...MARKET_PERSONAS
  ];
}

/**
 * 根据ID获取人格
 */
export function getPersonaById(id: string): PersonaProfile | undefined {
  return getAllPersonas().find(p => p.id === id);
}

/**
 * 根据角色类型获取人格列表
 */
export function getPersonasByRole(role: 'finance' | 'geopolitics' | 'market'): PersonaProfile[] {
  switch (role) {
    case 'finance':
      return FINANCE_PERSONAS;
    case 'geopolitics':
      return GEOPOLITICS_PERSONAS;
    case 'market':
      return MARKET_PERSONAS;
    default:
      return [];
  }
}

// ============================================================================
// 人格智能体节点
// ============================================================================

/**
 * 人格智能体节点
 * 模拟特定角色的决策行为
 */
export async function personaAgentNode(
  persona: PersonaProfile,
  scenario: string,
  context: {
    llmClient: LLMClient;
    previousDecisions?: PersonaDecision[];
    additionalContext?: string;
  }
): Promise<PersonaDecision> {
  const { llmClient, previousDecisions, additionalContext } = context;
  
  // 构建人格上下文
  const personaContext = buildPersonaContext(persona);
  
  // 构建场景提示
  const scenarioPrompt = buildScenarioPrompt(scenario, previousDecisions, additionalContext);
  
  // 调用LLM进行角色扮演
  const response = await llmClient.invoke([
    { role: 'system', content: personaContext },
    { role: 'user', content: scenarioPrompt }
  ], {
    model: getChatModelId(),
    temperature: 0.7
  });
  
  // 解析决策结果
  const decision = await parseDecisionResponse(response.content || '', persona);
  
  return decision;
}

/**
 * 构建人格上下文
 */
function buildPersonaContext(persona: PersonaProfile): string {
  return `## 你正在模拟的角色

**姓名**: ${persona.name}${persona.nameEn ? ` (${persona.nameEn})` : ''}
**职位**: ${persona.role}
**机构**: ${persona.organization}

## 人格特征

### 决策风格
- 决策方式: ${getDecisionStyleDescription(persona.personality.decisionStyle)}
- 风险偏好: ${getRiskToleranceDescription(persona.personality.riskTolerance)}
- 时间视野: ${getTimeHorizonDescription(persona.personality.timeHorizon)}
- 价值观优先级: ${persona.personality.valueSystem.join(' > ')}

### 核心关切
${persona.personality.keyConcerns.map(c => `• ${c}`).join('\n')}

### 沟通风格
${persona.personality.communicationStyle}

## 专业背景

### 专业领域
${persona.expertise.domains.map(d => `• ${d}`).join('\n')}

### 已知倾向
${persona.expertise.biases.map(b => `• ${b}`).join('\n')}

### 决策约束
${persona.expertise.constraints.map(c => `• ${c}`).join('\n')}

## 制度与资源约束

### 制度限制
${persona.constraints.institutionalLimits.map(l => `• ${l}`).join('\n')}

### 政治因素
${persona.constraints.politicalFactors.map(f => `• ${f}`).join('\n')}

### 资源限制
${persona.constraints.resourceLimits.map(l => `• ${l}`).join('\n')}

### 利益相关者
${persona.constraints.stakeholderInterests.map(i => `• ${i}`).join('\n')}

## 历史行为参考

${persona.behaviorPatterns.map((p, i) => `
### 案例${i + 1}: ${p.scenario}
**背景**: ${p.context}
**行动**: ${p.action}
**理由**: ${p.reasoning}
**结果**: ${p.outcome}
${p.lessons ? `**经验**: ${p.lessons}` : ''}
`).join('\n---\n')}

## 角色扮演指导

1. 始终以${persona.name}的身份思考和表达
2. 决策要符合其人格特征和约束条件
3. 参考历史行为模式，但要适应当前情境
4. 考虑其他参与者可能的反应
5. 提供清晰的决策理由和证据`;
}

/**
 * 构建场景提示
 */
function buildScenarioPrompt(
  scenario: string,
  previousDecisions?: PersonaDecision[],
  additionalContext?: string
): string {
  let prompt = `## 当前场景

${scenario}

`;

  if (additionalContext) {
    prompt += `## 补充信息

${additionalContext}

`;
  }

  if (previousDecisions && previousDecisions.length > 0) {
    prompt += `## 其他参与者的已知行动

${previousDecisions.map(d => `
**${d.personaName}**:
- 解读: ${d.interpretation}
- 行动: ${d.action}
- 理由: ${d.reasoning}
- 置信度: ${(d.confidence * 100).toFixed(0)}%
`).join('\n')}

`;
  }

  prompt += `## 请做出决策

请以该角色的身份，基于其人格特征和约束条件，回答以下问题：

1. 你如何解读这个局势？
2. 你会采取什么行动？
3. 你的决策理由是什么？
4. 你预期其他相关方会如何反应？

请严格按照以下JSON格式输出：
{
  "interpretation": "对局势的解读（100-200字）",
  "action": "将采取的行动（明确具体的行动描述）",
  "reasoning": "决策理由（150-250字，解释为什么做出这个决策）",
  "evidence": ["支撑决策的证据1", "支撑决策的证据2"],
  "expectedReactions": [
    {
      "actor": "其他方名称",
      "expectedAction": "预期反应",
      "confidence": 0.75
    }
  ],
  "conditions": ["触发条件1", "触发条件2"],
  "alternatives": ["备选方案1", "备选方案2"],
  "confidence": 0.8
}`;

  return prompt;
}

/**
 * 解析决策响应
 */
async function parseDecisionResponse(
  response: string,
  persona: PersonaProfile
): Promise<PersonaDecision> {
  // 尝试提取JSON
  let parsed: any = null;
  
  try {
    // 移除可能的markdown标记
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // 如果解析失败，使用默认结构
    parsed = {
      interpretation: response.substring(0, 200),
      action: '需要进一步分析',
      reasoning: response,
      evidence: [],
      expectedReactions: [],
      confidence: 0.5
    };
  }
  
  return {
    personaId: persona.id,
    personaName: persona.name,
    interpretation: parsed.interpretation || '',
    action: parsed.action || '',
    reasoning: parsed.reasoning || '',
    evidence: parsed.evidence || [],
    expectedReactions: parsed.expectedReactions || [],
    conditions: parsed.conditions,
    alternatives: parsed.alternatives,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6
  };
}

// ============================================================================
// 辅助函数
// ============================================================================

function getDecisionStyleDescription(style: DecisionStyle): string {
  const descriptions: Record<DecisionStyle, string> = {
    data_driven: '数据驱动型 - 依赖数据和分析做决策',
    intuition: '直觉型 - 依赖经验和直觉判断',
    consensus: '共识型 - 寻求多方意见和妥协',
    authoritarian: '权威型 - 独断决策，强调执行'
  };
  return descriptions[style];
}

function getRiskToleranceDescription(tolerance: RiskTolerance): string {
  const descriptions: Record<RiskTolerance, string> = {
    conservative: '保守型 - 偏好稳定和确定性',
    moderate: '适度型 - 平衡风险与收益',
    aggressive: '激进型 - 愿意承担高风险追求高收益'
  };
  return descriptions[tolerance];
}

function getTimeHorizonDescription(horizon: TimeHorizon): string {
  const descriptions: Record<TimeHorizon, string> = {
    short: '短期导向 - 关注近期结果',
    medium: '中期导向 - 平衡短期与长期',
    long: '长期导向 - 关注长远战略目标'
  };
  return descriptions[horizon];
}

// ============================================================================
// LLM客户端创建
// ============================================================================

export function createLLMClientForPersona(): LLMClient {
  return createLLMClient();
}
