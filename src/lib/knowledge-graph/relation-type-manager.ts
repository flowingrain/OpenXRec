/**
 * 关系类型管理系统
 * 
 * 支持：
 * 1. 预定义基础关系类型
 * 2. 动态抽取新关系类型
 * 3. 关系类型合并聚类
 * 4. 关系类型层级管理
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import { getChatModelId } from '@/lib/llm/chat-model';

// ==================== 预定义关系类型 ====================

/** 预定义关系类型配置 */
export const PREDEFINED_RELATION_TYPES = {
  // 资本关系
  '投资': { category: '资本', synonyms: ['参股', '入股', '出资'], description: '投资关系' },
  '控股': { category: '资本', synonyms: ['控股', '绝对控股', '相对控股'], description: '控股关系' },
  
  // 商业关系
  '合作': { category: '商业', synonyms: ['合作', '伙伴', '协作', '联手'], description: '合作关系' },
  '竞争': { category: '商业', synonyms: ['竞争', '竞争对手', '对标'], description: '竞争关系' },
  '供应': { category: '商业', synonyms: ['供应', '供货', '采购', '采购商'], description: '供应链关系' },
  
  // 组织关系
  '监管': { category: '组织', synonyms: ['监管', '管辖', '主管'], description: '监管关系' },
  '隶属': { category: '组织', synonyms: ['隶属', '归属', '下属'], description: '隶属关系' },
  '任职': { category: '组织', synonyms: ['任职', '担任', '挂职'], description: '任职关系' },
  
  // 业务关系
  '生产': { category: '业务', synonyms: ['生产', '制造', '代工'], description: '生产关系' },
  '销售': { category: '业务', synonyms: ['销售', '代理', '分销'], description: '销售关系' },
  '采购': { category: '业务', synonyms: ['采购', '供应商'], description: '采购关系' },
  
  // 影响关系
  '影响': { category: '影响', synonyms: ['影响', '作用于', '带动'], description: '影响关系' },
  '关联': { category: '影响', synonyms: ['关联', '相关', '涉及'], description: '关联关系' },
  
  // 通用
  '其他': { category: '通用', synonyms: [], description: '其他关系' },
} as const;

/** 关系类别 */
export type RelationCategory = '资本' | '商业' | '组织' | '业务' | '影响' | '通用';

/** 预定义关系类型 */
export type PredefinedRelationType = keyof typeof PREDEFINED_RELATION_TYPES;

// ==================== 动态关系类型 ====================

/** 关系类型条目（数据库存储格式） */
export interface RelationTypeEntry {
  id: string;
  name: string;                    // 关系类型名称
  normalizedName: string;          // 标准化名称
  category: RelationCategory;     // 所属类别
  parentId?: string;              // 父类型ID
  synonyms: string[];              // 同义词
  isPredefined: boolean;            // 是否预定义
  isVerified: boolean;            // 是否已验证
  confidence: number;              // 置信度
  usageCount: number;              // 使用次数
  description?: string;             // 描述
  embedding?: number[];            // 向量表示
  source?: string;                 // 来源（从哪个文本抽取）
  metadata?: Record<string, any>;  // 元数据
  createdAt: number;
  updatedAt: number;
}

/** 抽取请求 */
export interface RelationExtractionRequest {
  text: string;
  existingTypes?: RelationTypeEntry[];  // 已有类型
  minConfidence?: number;
}

/** 抽取结果 */
export interface RelationExtractionResult {
  extractedTypes: ExtractedRelationType[];
  mergedTypes: MergedRelationType[];
  suggestions: RelationTypeSuggestion[];
}

/** 抽取出的关系类型 */
export interface ExtractedRelationType {
  name: string;
  originalText: string;
  confidence: number;
  synonyms: string[];
  context: string;
  evidence: string;
}

/** 合并后的关系类型 */
export interface MergedRelationType {
  targetType: string;
  sourceTypes: string[];
  similarity: number;
  reason: string;
}

/** 关系类型建议 */
export interface RelationTypeSuggestion {
  action: 'add' | 'merge' | 'update';
  typeName: string;
  reason: string;
  confidence: number;
}

// ==================== 关系类型合并器 ====================

/** 相似度计算结果 */
export interface SimilarityResult {
  type1: string;
  type2: string;
  similarity: number;
  reason: string;
}

/**
 * 关系类型管理器
 */
export class RelationTypeManager {
  private llmClient?: LLMClient;
  private types: Map<string, RelationTypeEntry> = new Map();
  private nameIndex: Map<string, string> = new Map(); // name -> id

  constructor(llmClient?: LLMClient, initialTypes?: RelationTypeEntry[]) {
    this.llmClient = llmClient;
    
    // 初始化预定义类型
    this.initializePredefinedTypes();
    
    // 添加初始类型
    if (initialTypes) {
      for (const type of initialTypes) {
        this.addType(type);
      }
    }
  }

  /**
   * 初始化预定义类型
   */
  private initializePredefinedTypes(): void {
    const now = Date.now();
    
    for (const [name, config] of Object.entries(PREDEFINED_RELATION_TYPES)) {
      const entry: RelationTypeEntry = {
        id: `predefined_${name}`,
        name,
        normalizedName: this.normalize(name),
        category: config.category as RelationCategory,
        synonyms: config.synonyms,
        isPredefined: true,
        isVerified: true,
        confidence: 1.0,
        usageCount: 0,
        description: config.description,
        createdAt: now,
        updatedAt: now,
      };
      
      this.addType(entry);
    }
  }

  /**
   * 添加关系类型
   */
  addType(entry: RelationTypeEntry): void {
    this.types.set(entry.id, entry);
    this.nameIndex.set(entry.normalizedName, entry.id);
    
    // 添加同义词索引
    for (const synonym of entry.synonyms) {
      this.nameIndex.set(this.normalize(synonym), entry.id);
    }
  }

  /**
   * 获取类型
   */
  getType(idOrName: string): RelationTypeEntry | undefined {
    // 先尝试ID查找
    if (this.types.has(idOrName)) {
      return this.types.get(idOrName);
    }
    
    // 再尝试名称查找
    const id = this.nameIndex.get(this.normalize(idOrName));
    return id ? this.types.get(id) : undefined;
  }

  /**
   * 获取所有类型
   */
  getAllTypes(): RelationTypeEntry[] {
    return Array.from(this.types.values());
  }

  /**
   * 按类别获取类型
   */
  getTypesByCategory(category: RelationCategory): RelationTypeEntry[] {
    return Array.from(this.types.values())
      .filter(t => t.category === category);
  }

  /**
   * 更新类型
   */
  updateType(id: string, updates: Partial<RelationTypeEntry>): void {
    const entry = this.types.get(id);
    if (!entry) return;
    
    const updated = {
      ...entry,
      ...updates,
      updatedAt: Date.now(),
    };
    
    this.types.set(id, updated);
  }

  /**
   * 删除类型
   */
  deleteType(id: string): boolean {
    const entry = this.types.get(id);
    if (!entry || entry.isPredefined) return false;
    
    // 清理索引
    this.nameIndex.delete(entry.normalizedName);
    for (const synonym of entry.synonyms) {
      this.nameIndex.delete(this.normalize(synonym));
    }
    
    return this.types.delete(id);
  }

  /**
   * 标准化名称
   */
  private normalize(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, '');
  }

  /**
   * 查找相似类型
   */
  findSimilarTypes(typeName: string, threshold: number = 0.7): RelationTypeEntry[] {
    const normalized = this.normalize(typeName);
    const results: RelationTypeEntry[] = [];
    
    for (const entry of this.types.values()) {
      // 计算相似度
      const similarity = this.calculateSimilarity(normalized, entry.normalizedName);
      if (similarity >= threshold) {
        results.push(entry);
      }
    }
    
    return results.sort((a, b) => {
      const simA = this.calculateSimilarity(normalized, a.normalizedName);
      const simB = this.calculateSimilarity(normalized, b.normalizedName);
      return simB - simA;
    });
  }

  /**
   * 计算相似度
   */
  private calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    
    // 编辑距离
    const levenshtein = this.levenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    return 1 - levenshtein / maxLen;
  }

  /**
   * 编辑距离
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + 1
          );
        }
      }
    }
    
    return dp[m][n];
  }

  /**
   * 动态抽取关系类型
   */
  async extractRelationTypes(request: RelationExtractionRequest): Promise<RelationExtractionResult> {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }

    const { text, existingTypes, minConfidence = 0.5 } = request;
    
    // 构建已有类型列表
    const existingTypesList = existingTypes 
      ? existingTypes.map(t => `${t.name} (${t.synonyms.join(', ')})`).join('\n')
      : this.getAllTypes().map(t => `${t.name} (${t.synonyms.join(', ')})`).join('\n');
    
    // 调用LLM抽取
    const prompt = `你是一个关系抽取专家。请从以下文本中抽取实体之间的关系类型。

## 待分析文本
${text}

## 已有关系类型（优先使用）
${existingTypesList}

## 任务
1. 识别文本中描述的关系类型
2. 如果有新的关系类型，提出建议
3. 如果发现相似但不完全相同的关系类型，建议合并

## 输出格式（严格JSON）
{
  "extractedTypes": [
    {
      "name": "关系类型名称",
      "originalText": "原始文本片段",
      "confidence": 0.85,
      "synonyms": ["同义词1", "同义词2"],
      "context": "上下文描述",
      "evidence": "证据"
    }
  ],
  "mergedTypes": [
    {
      "targetType": "目标类型名称",
      "sourceTypes": ["类型1", "类型2"],
      "similarity": 0.9,
      "reason": "合并理由"
    }
  ],
  "suggestions": [
    {
      "action": "add|merge|update",
      "typeName": "类型名称",
      "reason": "建议理由",
      "confidence": 0.8
    }
  ]
}

请只输出JSON，不要输出其他内容。`;

    const response = await this.llmClient.invoke([
      { role: 'system', content: '你是一个专业的关系抽取专家。' },
      { role: 'user', content: prompt },
    ], {
      model: getChatModelId(),
      temperature: 0.3,
    });

    // 解析结果
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { extractedTypes: [], mergedTypes: [], suggestions: [] };
    }

    const result = JSON.parse(jsonMatch[0]) as RelationExtractionResult;
    
    // 过滤低置信度
    result.extractedTypes = result.extractedTypes.filter(t => t.confidence >= minConfidence);
    
    return result;
  }

  /**
   * 合并关系类型
   */
  mergeTypes(sourceIds: string[], targetId: string, reason: string): boolean {
    const target = this.types.get(targetId);
    if (!target) return false;

    // 更新目标类型
    const allSynonyms = new Set(target.synonyms);
    for (const sourceId of sourceIds) {
      const source = this.types.get(sourceId);
      if (!source || source.isPredefined) continue;
      
      // 合并同义词
      for (const synonym of source.synonyms) {
        allSynonyms.add(synonym);
      }
      
      // 更新使用次数
      target.usageCount += source.usageCount;
      
      // 删除源类型
      this.deleteType(sourceId);
    }
    
    target.synonyms = Array.from(allSynonyms);
    target.updatedAt = Date.now();
    
    return true;
  }

  /**
   * 创建层级关系
   */
  createHierarchy(parentId: string, childName: string, description?: string): RelationTypeEntry | null {
    const parent = this.types.get(parentId);
    if (!parent) return null;

    const now = Date.now();
    const entry: RelationTypeEntry = {
      id: `custom_${now}_${Math.random().toString(36).substring(2, 7)}`,
      name: childName,
      normalizedName: this.normalize(childName),
      category: parent.category,
      parentId,
      synonyms: [],
      isPredefined: false,
      isVerified: false,
      confidence: 0.5,
      usageCount: 0,
      description,
      createdAt: now,
      updatedAt: now,
    };

    this.addType(entry);
    return entry;
  }

  /**
   * 获取类型统计
   */
  getStats(): {
    total: number;
    predefined: number;
    custom: number;
    verified: number;
    byCategory: Record<RelationCategory, number>;
  } {
    const stats = {
      total: this.types.size,
      predefined: 0,
      custom: 0,
      verified: 0,
      byCategory: {
        '资本': 0,
        '商业': 0,
        '组织': 0,
        '业务': 0,
        '影响': 0,
        '通用': 0,
      } as Record<RelationCategory, number>,
    };

    for (const entry of this.types.values()) {
      if (entry.isPredefined) {
        stats.predefined++;
      } else {
        stats.custom++;
      }
      if (entry.isVerified) {
        stats.verified++;
      }
      stats.byCategory[entry.category]++;
    }

    return stats;
  }

  /**
   * 导出所有类型
   */
  exportTypes(): RelationTypeEntry[] {
    return this.getAllTypes();
  }

  /**
   * 导入类型
   */
  importTypes(types: RelationTypeEntry[]): number {
    let imported = 0;
    for (const type of types) {
      if (!this.types.has(type.id)) {
        this.addType(type);
        imported++;
      }
    }
    return imported;
  }
}

/**
 * 创建关系类型管理器
 */
export function createRelationTypeManager(
  llmClient?: LLMClient,
  initialTypes?: RelationTypeEntry[]
): RelationTypeManager {
  return new RelationTypeManager(llmClient, initialTypes);
}
