/**
 * 规则发现引擎
 * 
 * 从训练历史中自动发现有用的规则和模式
 * 支持：
 * 1. 关联规则挖掘 (Apriori 算法)
 * 2. 因果规则发现
 * 3. 规则置信度评估
 * 4. 规则冲突检测与合并
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 训练历史记录
 */
export interface TrainingHistory {
  id: string;
  epoch: number;
  hyperparams: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
  };
  metrics: {
    avgReward: number;
    avgPolicyLoss: number;
    avgValueLoss: number;
    kl: number;
  };
  timestamp: number;
}

/**
 * 关联规则
 */
export interface AssociationRule {
  id: string;
  antecedent: Condition[];     // 前件
  consequent: Condition[];     // 后件
  support: number;             // 支持度
  confidence: number;          // 置信度
  lift: number;                // 提升度
  type: 'positive' | 'negative';
  createdAt: number;
}

/**
 * 条件
 */
export interface Condition {
  param: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | 'between';
  value: number | [number, number];
}

/**
 * 因果规则
 */
export interface CausalRule {
  id: string;
  cause: string;
  effect: string;
  strength: number;            // 因果强度 [-1, 1]
  evidence: string[];          // 证据
  confidence: number;
  createdAt: number;
}

/**
 * 规则冲突
 */
export interface RuleConflict {
  rule1: AssociationRule;
  rule2: AssociationRule;
  conflictType: 'contradiction' | 'overlap' | 'subset';
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

/**
 * 规则评估结果
 */
export interface RuleEvaluation {
  rule: AssociationRule;
  accuracy: number;            // 预测准确率
  coverage: number;            // 覆盖率
  stability: number;           // 稳定性
  usefulness: number;          // 有用性评分
  recommendation: 'adopt' | 'monitor' | 'discard';
}

/**
 * 规则发现配置
 */
export interface RuleDiscoveryConfig {
  /** 最小支持度 */
  minSupport: number;
  /** 最小置信度 */
  minConfidence: number;
  /** 最小提升度 */
  minLift: number;
  /** 最大规则长度 */
  maxRuleLength: number;
  /** 是否启用因果发现 */
  enableCausalDiscovery: boolean;
}

const DEFAULT_CONFIG: RuleDiscoveryConfig = {
  minSupport: 0.1,
  minConfidence: 0.5,
  minLift: 1.0,
  maxRuleLength: 3,
  enableCausalDiscovery: true,
};

// ============================================================================
// 关联规则挖掘 (Apriori 算法)
// ============================================================================

/**
 * Apriori 算法实现
 */
export class AprioriMiner {
  private config: RuleDiscoveryConfig;

  constructor(config: Partial<RuleDiscoveryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 从训练历史中发现关联规则
   */
  mine(history: TrainingHistory[]): AssociationRule[] {
    if (history.length < 10) {
      console.warn('[AprioriMiner] Not enough data for rule mining');
      return [];
    }

    // 1. 数据预处理 - 转换为事务格式
    const transactions = this.preprocess(history);

    // 2. 生成频繁项集
    const frequentItemsets = this.generateFrequentItemsets(transactions);

    // 3. 从频繁项集生成规则
    const rules = this.generateRules(frequentItemsets, transactions);

    return rules;
  }

  /**
   * 数据预处理
   */
  private preprocess(history: TrainingHistory[]): Map<string, Set<string>>[] {
    return history.map(record => {
      const items = new Map<string, Set<string>>();

      // 离散化连续变量
      const discretize = (value: number, bins: number, prefix: string): string => {
        const bin = Math.floor(value * bins);
        return `${prefix}_${bin}`;
      };

      // 超参数项
      items.set('hyperparams', new Set([
        `lr_${this.discretizeLog(record.hyperparams.learningRate, 5)}`,
        `clip_${discretize(record.hyperparams.clipEpsilon, 5, 'c')}`,
        `entropy_${this.discretizeLog(record.hyperparams.entropyCoef, 5)}`,
        `gae_${discretize(record.hyperparams.gaeLambda, 5, 'g')}`,
      ]));

      // 性能项
      items.set('performance', new Set([
        record.metrics.avgReward > 0.5 ? 'high_reward' : 'low_reward',
        record.metrics.kl < 0.1 ? 'low_kl' : 'high_kl',
        record.metrics.avgPolicyLoss < 0.5 ? 'low_policy_loss' : 'high_policy_loss',
      ]));

      return items;
    });
  }

  /**
   * 对数离散化
   */
  private discretizeLog(value: number, bins: number): number {
    const logValue = Math.log10(Math.abs(value) + 1e-10);
    return Math.min(bins - 1, Math.max(0, Math.floor((logValue + 5) / 10 * bins)));
  }

  /**
   * 生成频繁项集
   */
  private generateFrequentItemsets(
    transactions: Map<string, Set<string>>[]
  ): Set<string>[] {
    const frequentItemsets: Set<string>[] = [];
    const totalCount = transactions.length;

    // 生成 1-项集
    const itemCounts = new Map<string, number>();
    transactions.forEach(trans => {
      trans.forEach(items => {
        items.forEach(item => {
          itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
        });
      });
    });

    // 筛选频繁 1-项集
    const frequent1 = new Set<string>();
    itemCounts.forEach((count, item) => {
      if (count / totalCount >= this.config.minSupport) {
        frequent1.add(item);
      }
    });

    frequentItemsets.push(frequent1);

    // 生成 k-项集
    let k = 2;
    while (k <= this.config.maxRuleLength) {
      const prevItemsets = frequentItemsets[k - 2];
      if (prevItemsets.size === 0) break;

      // 生成候选项集
      const candidates = this.generateCandidates(prevItemsets, k);
      
      // 计算支持度并筛选
      const frequentK = new Set<string>();
      candidates.forEach(candidate => {
        const items = candidate.split(',');
        const support = this.calculateSupport(transactions, items);
        if (support >= this.config.minSupport) {
          frequentK.add(candidate);
        }
      });

      if (frequentK.size === 0) break;
      frequentItemsets.push(frequentK);
      k++;
    }

    return frequentItemsets;
  }

  /**
   * 生成候选项集
   */
  private generateCandidates(itemset: Set<string>, k: number): Set<string> {
    const items = Array.from(itemset);
    const candidates = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const combined = new Set([...items[i].split(','), ...items[j].split(',')]);
        if (combined.size === k) {
          candidates.add(Array.from(combined).sort().join(','));
        }
      }
    }

    return candidates;
  }

  /**
   * 计算支持度
   */
  private calculateSupport(
    transactions: Map<string, Set<string>>[],
    items: string[]
  ): number {
    let count = 0;
    transactions.forEach(trans => {
      const allItems = new Set<string>();
      trans.forEach(set => set.forEach(item => allItems.add(item)));
      if (items.every(item => allItems.has(item))) {
        count++;
      }
    });
    return count / transactions.length;
  }

  /**
   * 生成关联规则
   */
  private generateRules(
    frequentItemsets: Set<string>[],
    transactions: Map<string, Set<string>>[]
  ): AssociationRule[] {
    const rules: AssociationRule[] = [];
    const totalCount = transactions.length;

    frequentItemsets.forEach((itemset, k) => {
      if (k === 0) return; // 跳过 1-项集

      itemset.forEach(itemsetStr => {
        const items = itemsetStr.split(',');
        
        // 生成所有可能的前件-后件组合
        for (let i = 1; i < items.length; i++) {
          const antecedentItems = items.slice(0, i);
          const consequentItems = items.slice(i);

          const support = this.calculateSupport(transactions, items);
          const antecedentSupport = this.calculateSupport(transactions, antecedentItems);
          const confidence = antecedentSupport > 0 ? support / antecedentSupport : 0;
          const consequentSupport = this.calculateSupport(transactions, consequentItems);
          const lift = consequentSupport > 0 ? confidence / consequentSupport : 0;

          // 检查是否满足最小阈值
          if (
            support >= this.config.minSupport &&
            confidence >= this.config.minConfidence &&
            lift >= this.config.minLift
          ) {
            rules.push({
              id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              antecedent: this.itemsToConditions(antecedentItems),
              consequent: this.itemsToConditions(consequentItems),
              support,
              confidence,
              lift,
              type: lift > 1 ? 'positive' : 'negative',
              createdAt: Date.now(),
            });
          }
        }
      });
    });

    return rules;
  }

  /**
   * 将项转换为条件
   */
  private itemsToConditions(items: string[]): Condition[] {
    return items.map(item => {
      const parts = item.split('_');
      const param = parts[0];
      const value = parseInt(parts[1]) || 0;
      
      return {
        param,
        operator: '==',
        value,
      };
    });
  }
}

// ============================================================================
// 因果规则发现
// ============================================================================

/**
 * 因果规则发现器
 */
export class CausalRuleDiscoverer {
  /**
   * 发现因果规则
   */
  discover(history: TrainingHistory[]): CausalRule[] {
    const rules: CausalRule[] = [];

    if (history.length < 20) {
      return rules;
    }

    // 分析超参数与性能的因果关系
    const params = ['learningRate', 'clipEpsilon', 'entropyCoef', 'gaeLambda'];
    
    params.forEach(param => {
      // 计算因果强度（使用 Granger 因果检验的简化版）
      const causalStrength = this.calculateCausalStrength(history, param);
      
      if (Math.abs(causalStrength.strength) > 0.3) {
        rules.push({
          id: `causal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          cause: param,
          effect: 'avgReward',
          strength: causalStrength.strength,
          evidence: causalStrength.evidence,
          confidence: Math.abs(causalStrength.strength),
          createdAt: Date.now(),
        });
      }
    });

    return rules;
  }

  /**
   * 计算因果强度
   */
  private calculateCausalStrength(
    history: TrainingHistory[],
    param: string
  ): { strength: number; evidence: string[] } {
    const values = history.map(h => (h.hyperparams as any)[param]);
    const rewards = history.map(h => h.metrics.avgReward);

    // 使用滞后相关性作为因果强度的代理
    const lag = 1;
    const laggedValues = values.slice(0, -lag);
    const futureRewards = rewards.slice(lag);

    // 计算相关系数
    const correlation = this.pearsonCorrelation(laggedValues, futureRewards);

    // 收集证据
    const evidence: string[] = [];
    
    if (correlation > 0.3) {
      evidence.push(`增加 ${param} 倾向于提高平均奖励`);
    } else if (correlation < -0.3) {
      evidence.push(`增加 ${param} 倾向于降低平均奖励`);
    }

    // 分析趋势
    const medianValue = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const highValueRecords = history.filter(h => (h.hyperparams as any)[param] > medianValue);
    const lowValueRecords = history.filter(h => (h.hyperparams as any)[param] <= medianValue);

    const avgRewardHigh = highValueRecords.reduce((sum, h) => sum + h.metrics.avgReward, 0) / highValueRecords.length;
    const avgRewardLow = lowValueRecords.reduce((sum, h) => sum + h.metrics.avgReward, 0) / lowValueRecords.length;

    if (avgRewardHigh > avgRewardLow * 1.2) {
      evidence.push(`高 ${param} 值时平均奖励高 ${(avgRewardHigh / avgRewardLow * 100 - 100).toFixed(1)}%`);
    } else if (avgRewardLow > avgRewardHigh * 1.2) {
      evidence.push(`低 ${param} 值时平均奖励高 ${(avgRewardLow / avgRewardHigh * 100 - 100).toFixed(1)}%`);
    }

    return {
      strength: correlation,
      evidence,
    };
  }

  /**
   * Pearson 相关系数
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const xSlice = x.slice(0, n);
    const ySlice = y.slice(0, n);

    const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
    const meanY = ySlice.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = xSlice[i] - meanX;
      const dy = ySlice[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    return denom === 0 ? 0 : numerator / denom;
  }
}

// ============================================================================
// 规则发现引擎
// ============================================================================

export class RuleDiscoveryEngine {
  private apriori: AprioriMiner;
  private causalDiscoverer: CausalRuleDiscoverer;
  private config: RuleDiscoveryConfig;
  private rules: AssociationRule[] = [];
  private causalRules: CausalRule[] = [];

  constructor(config: Partial<RuleDiscoveryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.apriori = new AprioriMiner(this.config);
    this.causalDiscoverer = new CausalRuleDiscoverer();
  }

  /**
   * 从历史数据发现规则
   */
  discoverRules(history: TrainingHistory[]): {
    associationRules: AssociationRule[];
    causalRules: CausalRule[];
  } {
    // 发现关联规则
    this.rules = this.apriori.mine(history);

    // 发现因果规则
    if (this.config.enableCausalDiscovery) {
      this.causalRules = this.causalDiscoverer.discover(history);
    }

    return {
      associationRules: this.rules,
      causalRules: this.causalRules,
    };
  }

  /**
   * 评估规则质量
   */
  evaluateRule(rule: AssociationRule): RuleEvaluation {
    // 简化评估
    const accuracy = rule.confidence;
    const coverage = rule.support;
    const stability = Math.min(1, rule.lift);
    const usefulness = (accuracy + coverage + stability) / 3;

    let recommendation: 'adopt' | 'monitor' | 'discard';
    if (usefulness > 0.7 && rule.lift > 1.2) {
      recommendation = 'adopt';
    } else if (usefulness > 0.5) {
      recommendation = 'monitor';
    } else {
      recommendation = 'discard';
    }

    return {
      rule,
      accuracy,
      coverage,
      stability,
      usefulness,
      recommendation,
    };
  }

  /**
   * 检测规则冲突
   */
  detectConflicts(rules: AssociationRule[]): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const conflict = this.checkConflict(rules[i], rules[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * 检查两条规则之间的冲突
   */
  private checkConflict(rule1: AssociationRule, rule2: AssociationRule): RuleConflict | null {
    // 检查是否有相同的前件但不同的后件
    const ant1 = new Set(rule1.antecedent.map(c => `${c.param}${c.operator}${c.value}`));
    const ant2 = new Set(rule2.antecedent.map(c => `${c.param}${c.operator}${c.value}`));
    
    const sameAntecedent = ant1.size === ant2.size && 
      [...ant1].every(item => ant2.has(item));

    if (sameAntecedent) {
      // 检查后件是否冲突
      const con1 = new Set(rule1.consequent.map(c => `${c.param}${c.operator}${c.value}`));
      const con2 = new Set(rule2.consequent.map(c => `${c.param}${c.operator}${c.value}`));
      
      const hasOverlap = [...con1].some(item => con2.has(item));
      
      if (rule1.type !== rule2.type && hasOverlap) {
        return {
          rule1,
          rule2,
          conflictType: 'contradiction',
          severity: 'high',
          suggestion: '规则相互矛盾，建议选择置信度更高的规则',
        };
      }
    }

    return null;
  }

  /**
   * 合并冲突规则
   */
  mergeConflictingRules(
    rule1: AssociationRule,
    rule2: AssociationRule
  ): AssociationRule {
    // 选择置信度更高的规则
    const better = rule1.confidence >= rule2.confidence ? rule1 : rule2;
    
    return {
      ...better,
      id: `merged_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      support: (rule1.support + rule2.support) / 2,
      confidence: Math.max(rule1.confidence, rule2.confidence),
      lift: Math.max(rule1.lift, rule2.lift),
    };
  }

  /**
   * 获取所有规则
   */
  getRules(): {
    associationRules: AssociationRule[];
    causalRules: CausalRule[];
  } {
    return {
      associationRules: this.rules,
      causalRules: this.causalRules,
    };
  }

  /**
   * 导出规则
   */
  exportRules(): string {
    return JSON.stringify({
      associationRules: this.rules,
      causalRules: this.causalRules,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createRuleDiscoveryEngine(
  config: Partial<RuleDiscoveryConfig> = {}
): RuleDiscoveryEngine {
  return new RuleDiscoveryEngine(config);
}
