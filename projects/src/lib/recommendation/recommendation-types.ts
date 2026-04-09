/**
 * 推荐类型与追问机制
 * 
 * 解决问题：
 * 1. 区分推荐类型：对比型 vs 排序型
 * 2. 信息不足时主动追问
 * 3. 综合排序展示
 */

import type { LLMClient } from 'coze-coding-dev-sdk';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 推荐类型
 */
export type RecommendationType = 
  | 'comparison'   // 对比型：多个方案供选择（如商品推荐）
  | 'ranking'      // 排序型：综合排名（如选址推荐）
  | 'single'       // 单一型：最佳答案（如问答）
  | 'clarification'; // 追问型：需要更多信息

/**
 * 信息充足性评估
 */
export interface InformationSufficiency {
  isSufficient: boolean;
  score: number;           // 0-1，信息充足度
  missingFields: string[]; // 缺失的关键信息
  suggestedQuestions: string[]; // 建议追问的问题（简短文本，向后兼容）
  clarificationQuestions?: ClarificationQuestion[]; // 完整追问问题结构
  confidence: number;      // 评估置信度
  extractedInfo?: string[]; // 已提取的关键信息（用于保存到会话上下文）
}

/**
 * 推荐类型识别结果
 */
export interface RecommendationTypeResult {
  type: RecommendationType;
  reason: string;
  confidence: number;
  suggestedOutput: 'items' | 'ranking' | 'single' | 'questions';
}

/**
 * 追问问题
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'text' | 'range';
  options?: string[];      // 选择题选项
  placeholder?: string;    // 文本输入提示
  required: boolean;       // 是否必须回答
  priority: 'high' | 'medium' | 'low';
  fieldId?: string;        // 对应 missingFields 中的字段名
}

/**
 * 排序型推荐结果
 */
export interface RankingRecommendation {
  id: string;
  rank: number;
  title: string;
  overallScore: number;    // 综合得分
  scores: {                // 分项得分
    name: string;
    score: number;
    weight: number;
    description?: string;
  }[];
  advantages: string[];    // 优势
  disadvantages: string[]; // 劣势
  reasoning: string;       // 推荐理由
  source: string;          // 信息来源
}

/**
 * 追问响应
 */
export interface ClarificationResponse {
  needsClarification: boolean;
  questions: ClarificationQuestion[];
  message: string;         // 友好的提示语
  progress: number;        // 信息收集进度 0-100%
}

// ============================================================================
// 推荐类型识别器
// ============================================================================

/**
 * 推荐类型识别器
 * 
 * 根据查询内容判断最适合的推荐类型
 */
export class RecommendationTypeDetector {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * 识别推荐类型
   */
  async detectType(query: string): Promise<RecommendationTypeResult> {
    // 快速规则匹配（减少LLM调用）
    const quickResult = this.quickDetect(query);
    if (quickResult.confidence > 0.8) {
      return quickResult;
    }

    // LLM深度分析
    return await this.llmDetect(query);
  }

  /**
   * 快速规则检测
   */
  private quickDetect(query: string): RecommendationTypeResult {
    const queryLower = query.toLowerCase();

    // 排序型关键词
    const rankingKeywords = [
      '选址', '位置推荐', '排名', '排序', '优先', '哪个好', '哪里好',
      '最佳', '最优', '推荐顺序', '对比分析', '综合评估', '哪个城市',
      '投资哪个', '去哪里'
    ];

    // 对比型关键词
    const comparisonKeywords = [
      '对比', '比较', '区别', '选择', '哪个', '买哪个', '推荐几个',
      '有什么', '有哪些', '给我一些', '几个方案'
    ];

    // 单一答案型关键词
    const singleKeywords = [
      '是什么', '为什么', '怎么', '如何', '解释', '定义', '说明',
      '是什么意思', '告诉我'
    ];

    // 检测排序型
    for (const keyword of rankingKeywords) {
      if (queryLower.includes(keyword)) {
        return {
          type: 'ranking',
          reason: `检测到排序型关键词: "${keyword}"`,
          confidence: 0.85,
          suggestedOutput: 'ranking',
        };
      }
    }

    // 检测对比型
    for (const keyword of comparisonKeywords) {
      if (queryLower.includes(keyword)) {
        return {
          type: 'comparison',
          reason: `检测到对比型关键词: "${keyword}"`,
          confidence: 0.75,
          suggestedOutput: 'items',
        };
      }
    }

    // 检测单一答案型
    for (const keyword of singleKeywords) {
      if (queryLower.includes(keyword)) {
        return {
          type: 'single',
          reason: `检测到单一答案型关键词: "${keyword}"`,
          confidence: 0.7,
          suggestedOutput: 'single',
        };
      }
    }

    return {
      type: 'comparison', // 默认对比型
      reason: '无法确定类型，使用默认对比型',
      confidence: 0.5,
      suggestedOutput: 'items',
    };
  }

  /**
   * LLM深度分析
   */
  private async llmDetect(query: string): Promise<RecommendationTypeResult> {
    const systemPrompt = `你是一个推荐类型识别专家。分析用户查询，判断最适合的推荐输出类型。

**推荐类型说明**：
1. **ranking（排序型）**：需要综合多因素给出排名
   - 特征：选址、位置、排名、最优选择
   - 输出：按综合得分排序的列表
   - 例：咖啡店选址推荐、投资城市排名

2. **comparison（对比型）**：提供多个选项供对比选择
   - 特征：对比、比较、推荐几个、有什么
   - 输出：多个并列的方案
   - 例：推荐几款咖啡机、有什么好的营销策略

3. **single（单一型）**：给出一个最佳答案
   - 特征：是什么、为什么、如何、解释
   - 输出：单一答案或解释
   - 例：什么是SWOT分析、如何制定营销计划

**输出格式**（JSON）：
{
  "type": "ranking|comparison|single",
  "reason": "判断理由",
  "confidence": 0.9,
  "suggestedOutput": "ranking|items|single"
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `分析查询：${query}` },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'comparison',
          reason: parsed.reason || '',
          confidence: parsed.confidence || 0.7,
          suggestedOutput: parsed.suggestedOutput || 'items',
        };
      }
    } catch (e) {
      console.error('[TypeDetector] LLM detection failed:', e);
    }

    return {
      type: 'comparison',
      reason: 'LLM分析失败，使用默认类型',
      confidence: 0.5,
      suggestedOutput: 'items',
    };
  }
}

// ============================================================================
// 信息充足性评估器
// ============================================================================

/**
 * 将 API 传入的 sessionContext（对象或字符串）规范为字符串，供领域识别与历史提取使用。
 */
export function normalizeSessionContextForSufficiency(sessionContext?: unknown): string | undefined {
  if (sessionContext == null || sessionContext === '') return undefined;
  if (typeof sessionContext === 'string') return sessionContext;
  if (typeof sessionContext === 'object') {
    try {
      return JSON.stringify(sessionContext).slice(0, 8000);
    } catch {
      return String(sessionContext);
    }
  }
  return String(sessionContext);
}

/**
 * 信息充足性评估器
 * 
 * 评估用户输入信息是否足够给出高质量推荐
 */
export class InformationSufficiencyEvaluator {
  private llmClient: LLMClient;

  // 领域关键词模板
  private readonly domainKeywords: Record<string, {
    required: string[];
    optional: string[];
    clarificationQuestions: ClarificationQuestion[];
  }> = {
    coffee_shop: {
      required: ['城市', '预算'],
      optional: ['目标客群', '定位', '规模', '经验'],
      clarificationQuestions: [
        {
          id: 'city',
          question: '您计划在哪个城市开店？',
          type: 'text',
          placeholder: '例如：北京、上海、深圳...',
          required: true,
          priority: 'high',
          fieldId: '城市',  // 对应 required 中的字段名
        },
        {
          id: 'budget',
          question: '您的预算范围是多少？',
          type: 'single_choice',
          options: ['10万以下', '10-30万', '30-50万', '50-100万', '100万以上'],
          required: true,
          priority: 'high',
          fieldId: '预算',
        },
        {
          id: 'target',
          question: '您的目标客群是？',
          type: 'multiple_choice',
          options: ['办公白领', '社区居民', '学生', '游客', '商务人士'],
          required: false,
          priority: 'medium',
          fieldId: '目标客群',
        },
        {
          id: 'positioning',
          question: '咖啡店定位是？',
          type: 'single_choice',
          options: ['精品咖啡', '平价快咖啡', '特色主题', '连锁加盟'],
          required: false,
          priority: 'medium',
          fieldId: '定位',
        },
      ],
    },
    investment: {
      required: ['投资金额', '投资期限'],
      optional: ['风险偏好', '投资目标', '流动性需求'],
      clarificationQuestions: [
        {
          id: 'amount',
          question: '您的投资金额是多少？',
          type: 'single_choice',
          options: ['1万以下', '1-5万', '5-10万', '10-50万', '50万以上'],
          required: true,
          priority: 'high',
          fieldId: '投资金额',
        },
        {
          id: 'duration',
          question: '您计划投资多长时间？',
          type: 'single_choice',
          options: ['1年内', '1-3年', '3-5年', '5年以上'],
          required: true,
          priority: 'high',
          fieldId: '投资期限',
        },
        {
          id: 'risk',
          question: '您的风险偏好是？',
          type: 'single_choice',
          options: ['保守型', '稳健型', '平衡型', '进取型'],
          required: false,
          priority: 'medium',
          fieldId: '风险偏好',
        },
      ],
    },
    travel: {
      required: ['目的地', '出行时间'],
      optional: ['预算', '同行人数', '旅行偏好', '住宿要求'],
      clarificationQuestions: [
        {
          id: 'destination',
          question: '您计划去哪里旅行？',
          type: 'text',
          placeholder: '例如：云南、日本、欧洲...',
          required: true,
          priority: 'high',
          fieldId: '目的地',
        },
        {
          id: 'duration',
          question: '计划旅行几天？',
          type: 'single_choice',
          options: ['1-3天', '4-7天', '8-14天', '15天以上'],
          required: true,
          priority: 'high',
          fieldId: '出行时间',
        },
        {
          id: 'budget',
          question: '人均预算是多少？',
          type: 'single_choice',
          options: ['3000以下', '3000-5000', '5000-10000', '10000以上'],
          required: false,
          priority: 'medium',
          fieldId: '预算',
        },
      ],
    },
  };

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * 评估信息充足性
   * @param query 当前查询
   * @param sessionContext 会话历史上下文（可选，字符串或对象）
   */
  async evaluate(query: string, sessionContext?: unknown): Promise<InformationSufficiency> {
    const ctxStr = normalizeSessionContextForSufficiency(sessionContext);

    // 1. 识别领域（传入会话上下文以处理追问场景）
    const domain = await this.detectDomain(query, ctxStr);
    
    // 2. 提取已有信息（包括历史上下文）
    const extractedInfo = await this.extractInformation(query);
    
    // 2.1 如果有历史上下文，也从中提取信息
    if (ctxStr) {
      const historyInfo = await this.extractInformation(ctxStr);
      // 合并并去重
      extractedInfo.push(...historyInfo.filter(info => !extractedInfo.includes(info)));
      console.log(`[SufficiencyEvaluator] Extracted from history: ${historyInfo.length}, total: ${extractedInfo.length}`);
    }
    
    // 3. 对比领域要求
    const domainConfig = this.domainKeywords[domain] || this.getDefaultDomainConfig();
    
    console.log(`[SufficiencyEvaluator] Domain: ${domain}, Required: ${domainConfig.required.join(',')}, Optional: ${domainConfig.optional.join(',')}`);
    console.log(`[SufficiencyEvaluator] Extracted info: ${JSON.stringify(extractedInfo)}`);
    
    const missingRequired = domainConfig.required.filter(
      field => !extractedInfo.some(info => this.fieldMatches(info, field))
    );
    
    const missingOptional = domainConfig.optional.filter(
      field => !extractedInfo.some(info => this.fieldMatches(info, field))
    );
    
    console.log(`[SufficiencyEvaluator] Missing required: ${missingRequired.join(',')}, Missing optional: ${missingOptional.join(',')}`);

    // 4. 计算充足度
    const requiredScore = domainConfig.required.length > 0 
      ? (domainConfig.required.length - missingRequired.length) / domainConfig.required.length 
      : 1;
    const optionalScore = domainConfig.optional.length > 0 
      ? (domainConfig.optional.length - missingOptional.length) / domainConfig.optional.length 
      : 1;
    
    const score = requiredScore * 0.7 + optionalScore * 0.3;

    // 5. 动态生成追问问题（LLM驱动），传入已回答的信息
    const dynamicQuestions = await this.generateDynamicQuestions(
      query, 
      domain, 
      missingRequired, 
      missingOptional,
      extractedInfo,
      ctxStr
    );

    return {
      isSufficient: missingRequired.length === 0,
      score,
      missingFields: [...missingRequired, ...missingOptional],
      suggestedQuestions: dynamicQuestions.map(q => q.question),
      clarificationQuestions: dynamicQuestions, // 完整追问问题结构
      confidence: 0.85,
      extractedInfo, // 返回提取的信息，用于保存到会话上下文
    };
  }

  /**
   * LLM 动态生成追问问题
   * 
   * 根据用户具体查询，智能生成针对性的追问问题
   */
  private async generateDynamicQuestions(
    query: string,
    domain: string,
    missingRequired: string[],
    missingOptional: string[],
    extractedInfo: string[],
    sessionContext?: string
  ): Promise<ClarificationQuestion[]> {
    // 如果没有缺失字段，返回空
    if (missingRequired.length === 0 && missingOptional.length === 0) {
      return [];
    }

    // 获取预定义问题作为参考
    const domainConfig = this.domainKeywords[domain];
    const predefinedQuestions = domainConfig?.clarificationQuestions || [];

    // 尝试用 LLM 动态生成
    try {
      // 构建严格的问题生成 prompt
      const missingFieldsList = [...missingRequired, ...missingOptional];
      
      const response = await this.llmClient.invoke([
        {
          role: 'system',
          content: `你是一个智能追问助手。根据缺失信息生成追问问题。

**严格规则**：
1. **只针对以下缺失字段生成问题**：${missingFieldsList.join('、')}
2. **绝对不要生成其他字段的问题**
3. **每个字段只生成一个问题**
4. 问题要友好、自然
5. 如果能用选择题，提供2-4个选项

**禁止的行为**：
- 不要问不在缺失字段列表中的问题
- 不要重复生成同一字段的问题
- 不要问意图确认类问题（如"你是来开店还是旅游"）

**输出格式**（JSON数组，每个缺失字段最多一个问题）：
[
  {
    "id": "字段名",
    "question": "友好的问题文本？",
    "type": "single_choice",
    "options": ["选项1", "选项2"],
    "required": true,
    "priority": "high"
  }
]`
        },
        {
          role: 'user',
          content: `用户查询：${query}

已识别的信息：${extractedInfo.join('、') || '无'}
缺失字段（只针对这些生成问题）：${missingFieldsList.join('、')}

请只针对上述缺失字段生成追问问题：`
        }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.2,
      });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 验证并过滤：只保留针对缺失字段的问题
          const missingFieldsSet = new Set([...missingRequired, ...missingOptional]);
          const seenFields = new Set<string>();
          
          const validQuestions = parsed.filter(q => {
            const fieldId = q.id || q.fieldId;
            // 检查是否是缺失字段
            if (!missingFieldsSet.has(fieldId)) {
              console.log(`[SufficiencyEvaluator] Filtered out question for non-missing field: ${fieldId}`);
              return false;
            }
            // 检查是否重复
            if (seenFields.has(fieldId)) {
              console.log(`[SufficiencyEvaluator] Filtered out duplicate question for field: ${fieldId}`);
              return false;
            }
            seenFields.add(fieldId);
            return true;
          }).map(q => ({
            ...q,
            fieldId: q.id || q.fieldId,
            priority: q.priority || (missingRequired.includes(q.id) ? 'high' : 'medium'),
            required: missingRequired.includes(q.id),
          }));
          
          console.log(`[SufficiencyEvaluator] Generated ${validQuestions.length} valid questions for fields: ${Array.from(seenFields).join(', ')}`);
          
          return validQuestions;
        }
      }
    } catch (e) {
      console.error('[SufficiencyEvaluator] LLM question generation failed:', e);
    }

    // LLM 失败时，使用预定义问题
    const relevantQuestions = predefinedQuestions.filter(
      q => q.fieldId && (missingRequired.includes(q.fieldId) || missingOptional.includes(q.fieldId))
    );
    
    return relevantQuestions;
  }

  /**
   * 检测领域（LLM + 规则混合）
   * @param query 当前查询
   * @param sessionContext 会话历史上下文（用于识别追问场景的领域）
   */
  private async detectDomain(query: string, sessionContext?: string): Promise<string> {
    // 快速规则匹配（高频场景优化）
    const quickResult = this.quickDetectDomain(query);
    if (quickResult.confidence > 0.9) {
      return quickResult.domain;
    }

    // 构建上下文感知的 prompt
    const contextPrompt = sessionContext 
      ? `用户历史对话：
${(typeof sessionContext === 'string' ? sessionContext : String(sessionContext)).slice(0, 500)}

当前用户输入：${query}

请根据历史对话和当前输入判断领域。`
      : `用户输入：${query}`;

    // LLM 深度理解
    try {
      const response = await this.llmClient.invoke([
        {
          role: 'system',
          content: `你是领域识别专家。判断用户查询属于哪个领域。

领域列表：
- coffee_shop: 咖啡店、奶茶店、餐饮开店相关
- investment: 投资、理财、股票、基金相关
- travel: 旅游、旅行、景点相关
- general: 其他通用场景

只返回领域名称，不要其他内容。`
        },
        { role: 'user', content: contextPrompt }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.1,
      });

      const domain = response.content.trim().toLowerCase();
      if (['coffee_shop', 'investment', 'travel', 'general'].includes(domain)) {
        return domain;
      }
    } catch (e) {
      console.error('[DomainDetector] LLM failed:', e);
    }

    return 'general';
  }

  /**
   * 快速领域检测（规则匹配）
   */
  private quickDetectDomain(query: string): { domain: string; confidence: number } {
    const queryLower = query.toLowerCase();
    
    // 高置信度关键词
    if (queryLower.includes('咖啡') || queryLower.includes('咖啡店')) {
      return { domain: 'coffee_shop', confidence: 0.95 };
    }
    if (queryLower.includes('股票') || queryLower.includes('基金') || queryLower.includes('理财')) {
      return { domain: 'investment', confidence: 0.95 };
    }
    if (queryLower.includes('旅游') || queryLower.includes('景点') || queryLower.includes('旅行')) {
      return { domain: 'travel', confidence: 0.95 };
    }

    // 中等置信度关键词
    if (queryLower.includes('开店') || queryLower.includes('选址')) {
      return { domain: 'coffee_shop', confidence: 0.7 };
    }
    if (queryLower.includes('投资') || queryLower.includes('收益')) {
      return { domain: 'investment', confidence: 0.7 };
    }

    return { domain: 'general', confidence: 0.5 };
  }

  /**
   * 提取已有信息（LLM + 规则混合）
   */
  private async extractInformation(query: string): Promise<string[]> {
    // 先用规则快速提取（高频场景）
    const ruleBasedInfo = this.quickExtractInformation(query);
    
    // 再用 LLM 深度提取
    try {
      const response = await this.llmClient.invoke([
        {
          role: 'system',
          content: `你是信息提取专家。从用户查询中提取关键信息。

提取规则：
1. 提取城市、预算、定位、客群、时间、金额等信息
2. 格式：字段名:值（如"城市:北京"）
3. 每行一个信息
4. 没有信息则返回空

示例：
输入：我想在北京开一家精品咖啡店，预算50万
输出：
城市:北京
定位:精品
预算:50万`
        },
        { role: 'user', content: query }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.1,
      });

      const llmInfo = response.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes(':'));
      
      // 合并结果（去重）
      const allInfo = [...new Set([...ruleBasedInfo, ...llmInfo])];
      return allInfo;
    } catch (e) {
      console.error('[InfoExtractor] LLM failed:', e);
      return ruleBasedInfo;
    }
  }

  /**
   * 快速信息提取（规则匹配）
   */
  private quickExtractInformation(query: string): string[] {
    const info: string[] = [];
    const queryLower = query.toLowerCase();

    // 城市检测 - 扩展城市列表
    const cities = [
      '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '苏州',
      '重庆', '天津', '长沙', '郑州', '青岛', '厦门', '宁波', '无锡', '福州', '济南',
      '大连', '沈阳', '哈尔滨', '长春', '昆明', '南宁', '海口', '三亚', '贵阳', '兰州',
      '西塘', '乌镇', '周庄', '丽江', '大理', '桂林', '阳朔', '凤凰', '拉萨', '敦煌',
      '苏州', '扬州', '绍兴', '嘉兴', '湖州', '镇江', '常州', '南通', '台州', '温州',
    ];
    for (const city of cities) {
      if (queryLower.includes(city.toLowerCase())) {
        info.push(`城市:${city}`);
      }
    }

    // 预算检测（增强）
    const budgetPatterns = [
      /(\d+)万/,
      /(\d+)元/,
      /(\d+)块/,
      /预算[：:]?\s*(\d+)/,
      /(\d+)万左右/,
      /大概[：:]?\s*(\d+)万/,
    ];
    for (const pattern of budgetPatterns) {
      const match = queryLower.match(pattern);
      if (match) {
        info.push(`预算:${match[0]}`);
        break;
      }
    }
    
    // 定位检测
    if (queryLower.includes('精品') || queryLower.includes('高端')) {
      info.push('定位:精品咖啡');
    }
    if (queryLower.includes('平价') || queryLower.includes('快')) {
      info.push('定位:平价快咖啡');
    }
    if (queryLower.includes('主题') || queryLower.includes('特色')) {
      info.push('定位:特色主题');
    }
    
    // 目标客群检测
    if (queryLower.includes('白领') || queryLower.includes('办公')) {
      info.push('目标客群:办公白领');
    }
    if (queryLower.includes('社区') || queryLower.includes('居民')) {
      info.push('目标客群:社区居民');
    }
    if (queryLower.includes('游客') || queryLower.includes('旅游')) {
      info.push('目标客群:游客');
    }

    return info;
  }

  /**
   * 字段匹配
   */
  private fieldMatches(info: string, field: string): boolean {
    // 提取信息格式为 "字段名:值"，如 "城市:西塘"
    const parts = info.split(':');
    if (parts.length >= 2) {
      const extractedField = parts[0].trim();
      // 字段名匹配（忽略大小写）
      if (extractedField.toLowerCase() === field.toLowerCase()) {
        return true;
      }
      // 同义词匹配
      const synonyms: Record<string, string[]> = {
        '城市': ['地点', '位置', '所在地'],
        '预算': ['资金', '投资额', '开店成本'],
        '规模': ['面积', '大小', '店面大小'],
        '定位': ['类型', '风格', '店铺类型'],
        '目标客群': ['客群', '客户', '目标客户'],
      };
      const fieldSynonyms = synonyms[field] || [];
      if (fieldSynonyms.some(s => s === extractedField)) {
        return true;
      }
    }
    // 回退：检查 info 是否包含 field
    return info.toLowerCase().includes(field.toLowerCase());
  }

  /**
   * 获取相关追问
   */
  private getRelevantQuestions(
    domain: string, 
    missingRequired: string[], 
    missingOptional: string[]
  ): string[] {
    const domainConfig = this.domainKeywords[domain];
    if (!domainConfig) return [];

    const questions: string[] = [];
    
    for (const q of domainConfig.clarificationQuestions) {
      const fieldName = q.id;
      if (missingRequired.includes(fieldName) || missingOptional.includes(fieldName)) {
        questions.push(q.question);
      }
    }

    return questions;
  }

  /**
   * 默认领域配置
   */
  private getDefaultDomainConfig() {
    return {
      required: [],
      optional: [],
      clarificationQuestions: [],
    };
  }

  /**
   * 获取追问配置
   */
  getClarificationConfig(domain: string): ClarificationQuestion[] {
    return this.domainKeywords[domain]?.clarificationQuestions || [];
  }
}

// ============================================================================
// 导出
// ============================================================================

export function createTypeDetector(llmClient: LLMClient): RecommendationTypeDetector {
  return new RecommendationTypeDetector(llmClient);
}

export function createSufficiencyEvaluator(llmClient: LLMClient): InformationSufficiencyEvaluator {
  return new InformationSufficiencyEvaluator(llmClient);
}
