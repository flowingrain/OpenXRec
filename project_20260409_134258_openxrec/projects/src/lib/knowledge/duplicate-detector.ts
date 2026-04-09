/**
 * 实体重复检测服务
 * 
 * 功能：
 * 1. 检测相似实体（非完全相同）
 * 2. 支持多种相似度算法
 * 3. 提供合并建议
 */

// ==================== 类型定义 ====================

/**
 * 相似度检测方法
 */
export type SimilarityMethod = 
  | 'levenshtein'      // 编辑距离
  | 'jaccard'          // Jaccard相似度
  | 'soundex'          // 语音相似度
  | 'embedding';       // 向量相似度

/**
 * 重复类型
 */
export type DuplicateType = 
  | 'exact'            // 完全相同
  | 'alias'            // 别名/缩写
  | 'typo'             // 拼写错误
  | 'translation'      // 翻译差异
  | 'abbreviation'     // 简写
  | 'similar';         // 相似

/**
 * 重复实体对
 */
export interface DuplicatePair {
  id: string;
  entity1: {
    id: string;
    name: string;
    type: string;
    aliases?: string[];
  };
  entity2: {
    id: string;
    name: string;
    type: string;
    aliases?: string[];
  };
  similarity: number;        // 相似度 0-1
  duplicateType: DuplicateType;
  method: SimilarityMethod;
  suggestion: 'merge' | 'keep_separate' | 'review';
  reason: string;
  autoMergeable: boolean;    // 是否可自动合并
}

/**
 * 检测配置
 */
export interface DuplicateDetectionConfig {
  // 相似度阈值
  similarityThreshold: number;   // 低于此值不认为是重复
  highConfidenceThreshold: number; // 高于此值建议合并
  
  // 检测方法
  methods: SimilarityMethod[];
  
  // 是否跨类型检测
  crossTypeDetection: boolean;
  
  // 是否检测别名
  checkAliases: boolean;
  
  // 最小名称长度（过短的不检测）
  minNameLength: number;
}

// 默认配置
const DEFAULT_CONFIG: DuplicateDetectionConfig = {
  similarityThreshold: 0.7,
  highConfidenceThreshold: 0.9,
  methods: ['levenshtein', 'jaccard'],
  crossTypeDetection: false,
  checkAliases: true,
  minNameLength: 2,
};

/**
 * 实体数据
 */
interface EntityData {
  id: string;
  name: string;
  type: string;
  aliases?: string[];
  description?: string;
}

// ==================== 相似度算法 ====================

/**
 * 计算Levenshtein编辑距离
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  const dp: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 删除
        dp[i][j - 1] + 1,      // 插入
        dp[i - 1][j - 1] + cost // 替换
      );
    }
  }
  
  return dp[len1][len2];
}

/**
 * 计算Levenshtein相似度
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * 计算Jaccard相似度（基于字符n-gram）
 */
function jaccardSimilarity(str1: string, str2: string, n: number = 2): number {
  const getNGrams = (str: string): Set<string> => {
    const grams = new Set<string>();
    for (let i = 0; i <= str.length - n; i++) {
      grams.add(str.slice(i, i + n));
    }
    return grams;
  };
  
  const set1 = getNGrams(str1);
  const set2 = getNGrams(str2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * 简单的Soundex编码（用于语音相似度）
 */
function soundex(str: string): string {
  const codes: Record<string, string> = {
    'b': '1', 'f': '1', 'p': '1', 'v': '1',
    'c': '2', 'g': '2', 'j': '2', 'k': '2', 'q': '2', 's': '2', 'x': '2', 'z': '2',
    'd': '3', 't': '3',
    'l': '4',
    'm': '5', 'n': '5',
    'r': '6',
  };
  
  const s = str.toLowerCase();
  if (s.length === 0) return '';
  
  let result = s[0].toUpperCase();
  let prevCode = codes[s[0]] || '';
  
  for (let i = 1; i < s.length; i++) {
    const code = codes[s[i]] || '';
    if (code && code !== prevCode) {
      result += code;
    }
    prevCode = code;
  }
  
  return (result + '000').slice(0, 4);
}

/**
 * 计算语音相似度
 */
function soundexSimilarity(str1: string, str2: string): number {
  const s1 = soundex(str1);
  const s2 = soundex(str2);
  
  if (s1 === s2) return 0.95;
  if (s1.slice(0, 3) === s2.slice(0, 3)) return 0.8;
  if (s1.slice(0, 2) === s2.slice(0, 2)) return 0.6;
  return 0;
}

/**
 * 判断重复类型
 */
function determineDuplicateType(
  name1: string,
  name2: string,
  similarity: number,
  levenshteinSim: number,
  jaccardSim: number,
  soundexSim: number
): DuplicateType {
  // 完全相同
  if (name1 === name2) return 'exact';
  
  // 拼写错误（编辑距离小）
  if (levenshteinSim >= 0.9 && name1.length === name2.length) {
    return 'typo';
  }
  
  // 语音相似
  if (soundexSim >= 0.8) {
    return 'similar';
  }
  
  // 一个是另一个的子串（缩写）
  const shorter = name1.length < name2.length ? name1 : name2;
  const longer = name1.length < name2.length ? name2 : name1;
  if (longer.includes(shorter)) {
    return 'abbreviation';
  }
  
  // 其他相似
  return 'similar';
}

/**
 * 判断是否可自动合并
 */
function isAutoMergeable(
  duplicateType: DuplicateType,
  similarity: number,
  config: DuplicateDetectionConfig
): boolean {
  if (duplicateType === 'exact') return true;
  if (duplicateType === 'alias') return similarity >= config.highConfidenceThreshold;
  if (duplicateType === 'typo') return similarity >= 0.95;
  return false;
}

/**
 * 生成建议
 */
function generateSuggestion(
  duplicateType: DuplicateType,
  similarity: number,
  config: DuplicateDetectionConfig
): 'merge' | 'keep_separate' | 'review' {
  if (similarity >= config.highConfidenceThreshold) {
    if (duplicateType === 'exact' || duplicateType === 'alias' || duplicateType === 'typo') {
      return 'merge';
    }
  }
  
  if (similarity >= config.similarityThreshold) {
    return 'review';
  }
  
  return 'keep_separate';
}

/**
 * 生成原因说明
 */
function generateReason(
  duplicateType: DuplicateType,
  similarity: number,
  method: SimilarityMethod
): string {
  const similarityPercent = (similarity * 100).toFixed(0);
  
  switch (duplicateType) {
    case 'exact':
      return '名称完全相同';
    case 'alias':
      return `可能是别名或缩写，相似度 ${similarityPercent}%`;
    case 'typo':
      return `可能是拼写差异，相似度 ${similarityPercent}%`;
    case 'abbreviation':
      return '一个是另一个的缩写或简写';
    case 'translation':
      return '可能是不同语言的翻译';
    case 'similar':
      return `名称相似，相似度 ${similarityPercent}%`;
    default:
      return `相似度 ${similarityPercent}%`;
  }
}

// ==================== 检测器类 ====================

/**
 * 重复检测器
 */
export class DuplicateDetector {
  private config: DuplicateDetectionConfig;
  
  constructor(config: Partial<DuplicateDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 检测重复实体
   */
  async detect(entities: EntityData[]): Promise<DuplicatePair[]> {
    console.log(`[DuplicateDetector] 开始检测 ${entities.length} 个实体的重复...`);
    
    const duplicates: DuplicatePair[] = [];
    const checked = new Set<string>();
    
    // 过滤过短的名称
    const validEntities = entities.filter(
      e => e.name.length >= this.config.minNameLength
    );
    
    // 两两比较
    for (let i = 0; i < validEntities.length; i++) {
      for (let j = i + 1; j < validEntities.length; j++) {
        const e1 = validEntities[i];
        const e2 = validEntities[j];
        
        // 跳过不同类型（如果配置不允许跨类型检测）
        if (!this.config.crossTypeDetection && e1.type !== e2.type) {
          continue;
        }
        
        // 检查是否已经比较过
        const key1 = `${e1.id}-${e2.id}`;
        const key2 = `${e2.id}-${e1.id}`;
        if (checked.has(key1) || checked.has(key2)) continue;
        checked.add(key1);
        
        // 计算相似度
        const result = this.calculateSimilarity(e1, e2);
        
        if (result.maxSimilarity >= this.config.similarityThreshold) {
          duplicates.push({
            id: `dup_${Date.now()}_${i}_${j}`,
            entity1: { id: e1.id, name: e1.name, type: e1.type, aliases: e1.aliases },
            entity2: { id: e2.id, name: e2.name, type: e2.type, aliases: e2.aliases },
            similarity: result.maxSimilarity,
            duplicateType: result.duplicateType,
            method: result.bestMethod,
            suggestion: result.suggestion,
            reason: result.reason,
            autoMergeable: result.autoMergeable,
          });
        }
      }
    }
    
    // 按相似度排序
    duplicates.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`[DuplicateDetector] 检测完成，发现 ${duplicates.length} 对相似实体`);
    
    return duplicates;
  }
  
  /**
   * 计算两个实体的相似度
   */
  private calculateSimilarity(e1: EntityData, e2: EntityData): {
    maxSimilarity: number;
    duplicateType: DuplicateType;
    bestMethod: SimilarityMethod;
    suggestion: 'merge' | 'keep_separate' | 'review';
    reason: string;
    autoMergeable: boolean;
  } {
    const names1 = [e1.name, ...(e1.aliases || [])];
    const names2 = [e2.name, ...(e2.aliases || [])];
    
    let maxSim = 0;
    let bestMethod: SimilarityMethod = 'levenshtein';
    let bestPair = { n1: e1.name, n2: e2.name, levSim: 0, jacSim: 0, souSim: 0 };
    
    // 比较所有名称组合
    for (const n1 of names1) {
      for (const n2 of names2) {
        const levSim = this.config.methods.includes('levenshtein') 
          ? levenshteinSimilarity(n1, n2) : 0;
        const jacSim = this.config.methods.includes('jaccard')
          ? jaccardSimilarity(n1, n2) : 0;
        const souSim = this.config.methods.includes('soundex')
          ? soundexSimilarity(n1, n2) : 0;
        
        const maxMethodSim = Math.max(levSim, jacSim, souSim);
        
        if (maxMethodSim > maxSim) {
          maxSim = maxMethodSim;
          bestPair = { n1, n2, levSim, jacSim, souSim };
          
          if (levSim >= jacSim && levSim >= souSim) {
            bestMethod = 'levenshtein';
          } else if (jacSim >= souSim) {
            bestMethod = 'jaccard';
          } else {
            bestMethod = 'soundex';
          }
        }
      }
    }
    
    const duplicateType = determineDuplicateType(
      bestPair.n1,
      bestPair.n2,
      maxSim,
      bestPair.levSim,
      bestPair.jacSim,
      bestPair.souSim
    );
    
    const suggestion = generateSuggestion(duplicateType, maxSim, this.config);
    const reason = generateReason(duplicateType, maxSim, bestMethod);
    const autoMergeable = isAutoMergeable(duplicateType, maxSim, this.config);
    
    return {
      maxSimilarity: maxSim,
      duplicateType,
      bestMethod,
      suggestion,
      reason,
      autoMergeable,
    };
  }
  
  /**
   * 快速检测（仅检测完全相同）
   */
  async quickDetect(entities: EntityData[]): Promise<DuplicatePair[]> {
    const nameMap = new Map<string, EntityData[]>();
    
    // 按名称分组
    for (const entity of entities) {
      const key = entity.name.toLowerCase();
      if (!nameMap.has(key)) {
        nameMap.set(key, []);
      }
      nameMap.get(key)!.push(entity);
    }
    
    // 找出重复
    const duplicates: DuplicatePair[] = [];
    
    for (const [, group] of nameMap) {
      if (group.length > 1) {
        for (let i = 1; i < group.length; i++) {
          duplicates.push({
            id: `dup_${Date.now()}_${i}`,
            entity1: { id: group[0].id, name: group[0].name, type: group[0].type },
            entity2: { id: group[i].id, name: group[i].name, type: group[i].type },
            similarity: 1,
            duplicateType: 'exact',
            method: 'levenshtein',
            suggestion: 'merge',
            reason: '名称完全相同',
            autoMergeable: true,
          });
        }
      }
    }
    
    return duplicates;
  }
  
  /**
   * 获取合并建议
   */
  getMergeSuggestion(pair: DuplicatePair): {
    primaryEntity: string;
    entitiesToMerge: string[];
    newAliases: string[];
  } {
    // 选择名称更长的作为主实体
    const primaryEntity = pair.entity1.name.length >= pair.entity2.name.length
      ? pair.entity1.id
      : pair.entity2.id;
    
    const entitiesToMerge = primaryEntity === pair.entity1.id
      ? [pair.entity2.id]
      : [pair.entity1.id];
    
    // 添加为别名
    const newAliases = primaryEntity === pair.entity1.id
      ? [pair.entity2.name, ...(pair.entity2.aliases || [])]
      : [pair.entity1.name, ...(pair.entity1.aliases || [])];
    
    return { primaryEntity, entitiesToMerge, newAliases };
  }
}

// 导出单例
export const duplicateDetector = new DuplicateDetector();
