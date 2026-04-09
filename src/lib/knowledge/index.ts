/**
 * 领域知识库系统
 * 
 * 功能：
 * - 知识存储：经济数据、事件、实体关系
 * - 向量检索：语义相似度搜索
 * - 知识注入：将相关知识注入分析上下文
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';

// ==================== 类型定义 ====================

/**
 * 知识条目类型
 */
export type KnowledgeType = 
  | 'economic_indicator'  // 经济指标（GDP、CPI等）
  | 'event'               // 历史事件
  | 'entity'              // 实体（机构、人物）
  | 'policy'              // 政策法规
  | 'relationship'        // 实体关系
  | 'market_data';        // 市场数据

/**
 * 知识条目
 */
export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  metadata: {
    source: string;           // 来源
    confidence: number;       // 可信度 0-1
    timestamp: number;        // 时间戳
    tags: string[];           // 标签
    relatedEntities: string[]; // 相关实体
    impact?: string;          // 影响描述
    region?: string;          // 地区
    sector?: string;          // 行业
    isPreset?: boolean;       // 是否为预置知识
  };
  embedding?: number[];       // 向量嵌入
}

/**
 * 知识检索结果
 */
export interface KnowledgeSearchResult {
  entry: KnowledgeEntry;
  relevance: number;          // 相关度 0-1
  matchedFields: string[];    // 匹配的字段
}

/**
 * 知识上下文
 */
export interface KnowledgeContext {
  entries: KnowledgeSearchResult[];
  summary: string;            // 知识摘要
  entities: string[];         // 识别的实体
  suggestedQueries: string[]; // 建议的进一步查询
}

// ==================== 预置知识库 ====================

/**
 * 预置的经济领域知识
 */
const PRESET_KNOWLEDGE: KnowledgeEntry[] = [
  // 经济指标
  {
    id: 'indicator_gdp',
    type: 'economic_indicator',
    title: 'GDP（国内生产总值）',
    content: 'GDP是衡量一个国家或地区经济规模和经济增长的核心指标。GDP增速反映经济景气程度，增速下降通常预示经济放缓，可能触发刺激政策。中国GDP增速目标通常在5%-6%左右，美国在2%-3%。',
    metadata: {
      source: '宏观经济基础',
      confidence: 0.95,
      timestamp: Date.now(),
      tags: ['宏观经济', '增长指标', '核心指标'],
      relatedEntities: ['国家统计局', 'BEA'],
      region: '全球',
      isPreset: true,
    }
  },
  {
    id: 'indicator_cpi',
    type: 'economic_indicator',
    title: 'CPI（消费者物价指数）',
    content: 'CPI是衡量通货膨胀的核心指标。CPI同比涨幅超过3%通常被视为通胀压力，央行可能加息；低于1%则可能面临通缩风险。美联储通胀目标为2%，中国CPI涨幅通常控制在3%以内。',
    metadata: {
      source: '宏观经济基础',
      confidence: 0.95,
      timestamp: Date.now(),
      tags: ['通胀指标', '货币政策', '核心指标'],
      relatedEntities: ['美联储', '央行', 'BLS'],
      region: '全球',
    }
  },
  {
    id: 'indicator_pmi',
    type: 'economic_indicator',
    title: 'PMI（采购经理指数）',
    content: 'PMI是衡量制造业和服务业景气度的先行指标。PMI高于50表示扩张，低于50表示收缩。制造业PMI通常被视为经济晴雨表，连续低于50预示经济衰退风险。',
    metadata: {
      source: '宏观经济基础',
      confidence: 0.9,
      timestamp: Date.now(),
      tags: ['先行指标', '制造业', '景气度'],
      relatedEntities: ['ISM', '国家统计局'],
      region: '全球',
    }
  },
  {
    id: 'indicator_interest_rate',
    type: 'economic_indicator',
    title: '基准利率',
    content: '基准利率是央行的核心货币政策工具。降息通常刺激经济但可能引发通胀，加息抑制通胀但可能减缓增长。美联储联邦基金利率是全球最重要的基准利率，影响全球资本流动。',
    metadata: {
      source: '货币政策基础',
      confidence: 0.95,
      timestamp: Date.now(),
      tags: ['货币政策', '利率', '核心指标'],
      relatedEntities: ['美联储', '央行', 'FOMC'],
      region: '全球',
    }
  },
  {
    id: 'indicator_exchange_rate',
    type: 'economic_indicator',
    title: '汇率',
    content: '汇率反映货币相对价值。人民币对美元汇率是最重要的双边汇率之一。汇率贬值利好出口但不利于资本流入，升值则相反。央行通过外汇市场干预和货币政策影响汇率。',
    metadata: {
      source: '国际金融基础',
      confidence: 0.9,
      timestamp: Date.now(),
      tags: ['汇率', '外汇', '国际金融'],
      relatedEntities: ['央行', '外汇局', '美联储'],
      region: '中国',
    }
  },
  
  // 关键实体
  {
    id: 'entity_fed',
    type: 'entity',
    title: '美联储（Federal Reserve）',
    content: '美联储是美国的中央银行，负责制定货币政策、监管银行体系和维护金融稳定。FOMC（联邦公开市场委员会）是美联储的决策机构，每年召开8次会议决定利率政策。美联储政策对全球金融市场有重大影响。',
    metadata: {
      source: '机构介绍',
      confidence: 0.95,
      timestamp: Date.now(),
      tags: ['央行', '货币政策', '美国'],
      relatedEntities: ['FOMC', '鲍威尔', '美国财政部'],
      region: '美国',
    }
  },
  {
    id: 'entity_pbc',
    type: 'entity',
    title: '中国人民银行',
    content: '中国人民银行是中国的中央银行，负责制定和执行货币政策、维护金融稳定。主要政策工具包括存款准备金率、贷款市场报价利率（LPR）、公开市场操作等。货币政策取向通常表述为"稳健"、"稳健偏松"或"稳健偏紧"。',
    metadata: {
      source: '机构介绍',
      confidence: 0.95,
      timestamp: Date.now(),
      tags: ['央行', '货币政策', '中国'],
      relatedEntities: ['国务院', '外汇局', '银保监会'],
      region: '中国',
    }
  },
  
  // 政策法规
  {
    id: 'policy_fed_rate',
    type: 'policy',
    title: '美联储利率决策机制',
    content: '美联储通过FOMC会议决定联邦基金利率目标区间。决策依据包括通胀率（PCE）、就业数据、经济增长等"双重使命"。2022-2023年美联储进行了历史性的快速加息周期，将利率从接近零提升至5.25%-5.5%。市场通常关注"点阵图"预测未来利率路径。',
    metadata: {
      source: '政策解读',
      confidence: 0.9,
      timestamp: Date.now(),
      tags: ['货币政策', '利率', 'FOMC'],
      relatedEntities: ['美联储', 'FOMC', '鲍威尔'],
      region: '美国',
    }
  },
  {
    id: 'policy_china_monetary',
    type: 'policy',
    title: '中国货币政策框架',
    content: '中国货币政策以"稳健"为主基调，通过存款准备金率、LPR利率、MLF等工具调节。央行强调"精准有力"，注重结构性工具支持实体经济。货币政策目标包括稳定物价、促进增长、保持汇率稳定、防范金融风险等多重目标。',
    metadata: {
      source: '政策解读',
      confidence: 0.9,
      timestamp: Date.now(),
      tags: ['货币政策', '中国', '央行'],
      relatedEntities: ['中国人民银行', '国务院', '银保监会'],
      region: '中国',
    }
  },
  
  // 实体关系
  {
    id: 'relation_us_china_trade',
    type: 'relationship',
    title: '中美贸易关系',
    content: '中美是全球最大的两个经济体，贸易关系密切但存在摩擦。关税、贸易壁垒、技术出口管制等政策变化对两国经济和全球供应链有重大影响。市场关注中美贸易谈判进展和政策变化。',
    metadata: {
      source: '国际关系',
      confidence: 0.85,
      timestamp: Date.now(),
      tags: ['贸易', '中美关系', '地缘政治'],
      relatedEntities: ['美国贸易代表办公室', '商务部', '海关'],
      region: '全球',
    }
  },
  {
    id: 'relation_oil_price',
    type: 'relationship',
    title: '油价与经济关系',
    content: '原油价格与全球经济密切相关。油价上涨增加通胀压力，影响央行政策；同时增加企业成本，影响盈利。OPEC+产量决策、地缘政治、美元汇率是影响油价的主要因素。油价与股市通常呈负相关。',
    metadata: {
      source: '市场分析',
      confidence: 0.85,
      timestamp: Date.now(),
      tags: ['大宗商品', '能源', '通胀'],
      relatedEntities: ['OPEC', '沙特', '俄罗斯'],
      region: '全球',
    }
  },
  
  // 市场数据
  {
    id: 'market_stock_indices',
    type: 'market_data',
    title: '全球主要股指',
    content: '道琼斯工业指数、标普500、纳斯达克是美国三大股指。上证指数、深证成指、创业板指数是中国主要股指。MSCI新兴市场指数反映新兴市场整体表现。股指期货是重要的风险管理工具。',
    metadata: {
      source: '市场数据',
      confidence: 0.95,
      timestamp: Date.now(),
      tags: ['股市', '指数', '投资'],
      relatedEntities: ['纽交所', '纳斯达克', '上交所'],
      region: '全球',
    }
  },
  {
    id: 'market_bond',
    type: 'market_data',
    title: '债券市场',
    content: '国债收益率是债券市场的核心指标。美国10年期国债收益率被视为全球资产定价的锚。收益率曲线倒挂（短期利率高于长期）通常预示经济衰退。中国10年期国债收益率反映国内经济预期和货币政策取向。',
    metadata: {
      source: '市场数据',
      confidence: 0.9,
      timestamp: Date.now(),
      tags: ['债券', '收益率', '利率'],
      relatedEntities: ['财政部', '美联储', '央行'],
      region: '全球',
    }
  },
];

// ==================== 知识库管理器 ====================

/**
 * 知识库管理器
 */
export class KnowledgeManager {
  private entries: Map<string, KnowledgeEntry> = new Map();
  private llmClient: LLMClient | null = null;
  
  constructor() {
    // 初始化预置知识，统一添加 isPreset 标识
    PRESET_KNOWLEDGE.forEach(entry => {
      this.entries.set(entry.id, {
        ...entry,
        metadata: {
          ...entry.metadata,
          isPreset: true
        }
      });
    });
    console.log(`[KnowledgeManager] Initialized with ${this.entries.size} preset entries`);
  }
  
  /**
   * 初始化LLM客户端
   */
  private async getLLMClient(customHeaders?: Record<string, string>): Promise<LLMClient> {
    if (!this.llmClient) {
      const config = new Config();
      this.llmClient = new LLMClient(config, customHeaders || {});
    }
    return this.llmClient;
  }
  
  /**
   * 添加知识
   */
  async addKnowledge(entry: KnowledgeEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }
  
  /**
   * 批量添加知识
   */
  async addKnowledgeBatch(entries: KnowledgeEntry[]): Promise<void> {
    entries.forEach(entry => this.entries.set(entry.id, entry));
  }
  
  /**
   * 获取知识
   */
  async getKnowledge(id: string): Promise<KnowledgeEntry | null> {
    return this.entries.get(id) || null;
  }
  
  /**
   * 搜索知识（关键词匹配 + 语义相似度）
   */
  async searchKnowledge(
    query: string,
    options: {
      limit?: number;
      types?: KnowledgeType[];
      tags?: string[];
      customHeaders?: Record<string, string>;
    } = {}
  ): Promise<KnowledgeSearchResult[]> {
    const { limit = 10, types, tags } = options;
    const queryLower = query.toLowerCase();
    const results: KnowledgeSearchResult[] = [];
    
    console.log(`[KnowledgeManager] Searching for: "${query}" (entries: ${this.entries.size})`);
    
    // 关键词匹配
    // 将查询拆分为关键词（支持中英文混合）
    // 对于中文，按字符拆分；对于英文，按单词拆分
    const queryKeywords: string[] = [];
    
    // 提取英文单词（连续字母）
    const englishWords = queryLower.match(/[a-z]+/g) || [];
    queryKeywords.push(...englishWords);
    
    // 提取中文词汇（连续中文字符，每2-4个字符作为一个词）
    const chineseText = queryLower.replace(/[a-z]+/g, ' ').trim();
    if (chineseText) {
      // 简单的中文分词：生成所有可能的2-4字组合
      const chars = chineseText.split('');
      for (let len = 4; len >= 2; len--) {
        for (let i = 0; i <= chars.length - len; i++) {
          const word = chars.slice(i, i + len).join('').trim();
          if (word.length === len) {
            queryKeywords.push(word);
          }
        }
      }
      // 同时保留单个字符作为最后的匹配手段
      chars.forEach(c => {
        if (c.trim()) queryKeywords.push(c.trim());
      });
    }
    
    // 如果没有任何关键词，使用原始查询
    if (queryKeywords.length === 0) {
      queryKeywords.push(queryLower);
    }
    
    console.log(`[KnowledgeManager] Keywords extracted: ${queryKeywords.join(', ')}`);
    
    for (const entry of this.entries.values()) {
      // 类型过滤
      if (types && !types.includes(entry.type)) continue;
      
      // 标签过滤
      if (tags && !tags.some(t => entry.metadata.tags.includes(t))) continue;
      
      // 计算相关度
      const matchedFields: string[] = [];
      let relevance = 0;
      
      // 对每个关键词进行匹配
      for (const keyword of queryKeywords) {
        // 标题匹配
        if (entry.title.toLowerCase().includes(keyword)) {
          if (!matchedFields.includes('title')) matchedFields.push('title');
          relevance += 0.4;
        }
        
        // 内容匹配
        if (entry.content.toLowerCase().includes(keyword)) {
          if (!matchedFields.includes('content')) matchedFields.push('content');
          relevance += 0.3;
        }
        
        // 标签匹配
        const matchedTags = entry.metadata.tags.filter(
          t => t.toLowerCase().includes(keyword)
        );
        if (matchedTags.length > 0) {
          if (!matchedFields.includes('tags')) matchedFields.push('tags');
          relevance += 0.2 * Math.min(matchedTags.length, 3) / 3;
        }
        
        // 实体匹配
        const matchedEntities = entry.metadata.relatedEntities.filter(
          e => e.toLowerCase().includes(keyword)
        );
        if (matchedEntities.length > 0) {
          if (!matchedFields.includes('entities')) matchedFields.push('entities');
          relevance += 0.1 * Math.min(matchedEntities.length, 3) / 3;
        }
      }
      
      if (relevance > 0) {
        // 加入置信度因子
        relevance *= entry.metadata.confidence;
        
        results.push({
          entry,
          relevance: Math.min(relevance, 1),
          matchedFields
        });
      }
    }
    
    // 按相关度排序
    results.sort((a, b) => b.relevance - a.relevance);
    
    return results.slice(0, limit);
  }
  
  /**
   * 获取知识上下文（用于分析增强）
   */
  async getKnowledgeContext(
    query: string,
    options: {
      maxEntries?: number;
      customHeaders?: Record<string, string>;
    } = {}
  ): Promise<KnowledgeContext> {
    const { maxEntries = 5 } = options;
    
    // 搜索相关知识
    const searchResults = await this.searchKnowledge(query, {
      limit: maxEntries,
      customHeaders: options.customHeaders
    });
    
    // 生成摘要
    const summary = this.generateSummary(searchResults);
    
    // 提取实体
    const entities = this.extractEntities(searchResults);
    
    // 生成建议查询
    const suggestedQueries = this.generateSuggestedQueries(query, searchResults);
    
    return {
      entries: searchResults,
      summary,
      entities,
      suggestedQueries
    };
  }
  
  /**
   * 生成知识摘要
   */
  private generateSummary(results: KnowledgeSearchResult[]): string {
    if (results.length === 0) {
      return '未找到相关知识';
    }
    
    const topResults = results.slice(0, 3);
    const summaries = topResults.map(r => 
      `【${r.entry.title}】${r.entry.content.substring(0, 100)}...`
    );
    
    return `相关领域知识：\n${summaries.join('\n')}`;
  }
  
  /**
   * 提取实体
   */
  private extractEntities(results: KnowledgeSearchResult[]): string[] {
    const entitySet = new Set<string>();
    
    results.forEach(r => {
      r.entry.metadata.relatedEntities.forEach(e => entitySet.add(e));
    });
    
    return Array.from(entitySet).slice(0, 10);
  }
  
  /**
   * 生成建议查询
   */
  private generateSuggestedQueries(
    originalQuery: string,
    results: KnowledgeSearchResult[]
  ): string[] {
    const suggestions: string[] = [];
    const tags = new Set<string>();
    
    results.forEach(r => {
      r.entry.metadata.tags.forEach(t => tags.add(t));
    });
    
    // 基于标签生成建议
    Array.from(tags).slice(0, 3).forEach(tag => {
      suggestions.push(`${originalQuery} 与 ${tag}`);
    });
    
    return suggestions;
  }
  
  /**
   * 获取所有知识条目
   */
  getAllKnowledge(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }
  
  /**
   * 更新知识
   */
  updateKnowledge(
    id: string, 
    updates: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'type'> & {
      metadata?: Partial<KnowledgeEntry['metadata']>;
    }>
  ): KnowledgeEntry | null {
    const existing = this.entries.get(id);
    if (!existing) {
      return null;
    }
    
    const updated: KnowledgeEntry = {
      ...existing,
      ...(updates.title && { title: updates.title }),
      ...(updates.content && { content: updates.content }),
      ...(updates.type && { type: updates.type }),
      metadata: {
        ...existing.metadata,
        ...(updates.metadata?.tags && { tags: updates.metadata.tags }),
        ...(updates.metadata?.relatedEntities && { relatedEntities: updates.metadata.relatedEntities }),
        ...(updates.metadata?.confidence !== undefined && { confidence: updates.metadata.confidence }),
        timestamp: Date.now(), // 更新时间戳
      }
    };
    
    this.entries.set(id, updated);
    return updated;
  }
  
  /**
   * 删除知识
   */
  deleteKnowledge(id: string): boolean {
    return this.entries.delete(id);
  }
  
  /**
   * 批量删除知识
   */
  deleteKnowledgeBatch(ids: string[]): number {
    let deleted = 0;
    ids.forEach(id => {
      if (this.entries.delete(id)) {
        deleted++;
      }
    });
    return deleted;
  }
  
  /**
   * 获取统计数据
   */
  getStats(): {
    total: number;
    byType: Record<KnowledgeType, number>;
  } {
    const byType: Record<KnowledgeType, number> = {
      economic_indicator: 0,
      event: 0,
      entity: 0,
      policy: 0,
      relationship: 0,
      market_data: 0,
    };
    
    this.entries.forEach(entry => {
      byType[entry.type]++;
    });
    
    return {
      total: this.entries.size,
      byType
    };
  }
}

// ==================== 单例导出 ====================

let knowledgeManagerInstance: KnowledgeManager | null = null;

export function getKnowledgeManager(): KnowledgeManager {
  if (!knowledgeManagerInstance) {
    knowledgeManagerInstance = new KnowledgeManager();
  }
  return knowledgeManagerInstance;
}

export { PRESET_KNOWLEDGE };

// 导出知识积累系统
export * from './knowledge-accumulator';

// 导出知识更新服务
export * from './knowledge-update-service';
export { getKnowledgeAccumulator } from './knowledge-accumulator';
