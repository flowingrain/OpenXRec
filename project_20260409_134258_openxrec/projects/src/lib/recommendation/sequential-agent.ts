/**
 * 智能体驱动的序列推荐系统
 *
 * 核心理念：
 * - 通过智能体分析行为序列，而非训练专门的深度学习模型
 * - 利用LLM的序列理解和推理能力
 * - 保持可解释性
 * - 专门算法（LSTM、Transformer等）作为基线或兜底
 */

import { LLMClient } from 'coze-coding-dev-sdk';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 行为序列
 */
export interface BehaviorSequence {
  userId: string;
  behaviors: Behavior[];
  patterns?: SequencePattern[];
}

/**
 * 行为
 */
export interface Behavior {
  itemId: string;
  itemTitle: string;
  itemType: string;
  action: string;
  timestamp: number;
  rating?: number;
  duration?: number;
  context?: Record<string, any>;
}

/**
 * 序列模式
 */
export interface SequencePattern {
  pattern: string[];           // 物品ID序列
  patternType: 'frequent' | 'sequential' | 'cyclic';
  frequency: number;           // 出现频率
  confidence: number;          // 置信度
  lastSeen: number;            // 最后出现时间
  nextPredictions: string[];   // 预测的下一个物品
}

/**
 * 序列分析结果
 */
export interface SequenceAnalysis {
  userId: string;
  totalBehaviors: number;
  uniqueItems: number;
  patterns: SequencePattern[];
  insights: string[];
  recommendations: SequenceRecommendation[];
}

/**
 * 序列推荐结果
 */
export interface SequenceRecommendation {
  item: {
    id: string;
    title: string;
    type: string;
  };
  score: number;
  reasoning: string;
  strategy: 'pattern_based' | 'llm_based' | 'hybrid';
  patternMatch?: SequencePattern;
  confidence: number;
}

// ============================================================================
// 序列分析智能体
// ============================================================================

/**
 * 序列分析智能体
 *
 * 职责：分析用户行为序列，识别模式，生成推荐
 */
class SequenceAnalysisAgent {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * 分析用户行为序列（主入口）
   */
  async analyzeSequence(
    userId: string,
    behaviors: Behavior[],
    candidateItems: Array<{ id: string; title: string; type: string }>,
    limit: number = 10
  ): Promise<SequenceAnalysis> {
    console.log(`[SequenceAgent] 开始分析用户 ${userId} 的行为序列...`);

    // 1. 识别序列模式
    const patterns = await this.identifyPatterns(behaviors);

    // 2. 生成序列洞察
    const insights = await this.generateInsights(behaviors, patterns);

    // 3. 基于模式生成推荐
    const patternBasedRecs = await this.generatePatternBasedRecommendations(
      patterns,
      candidateItems
    );

    // 4. 使用LLM理解序列并生成推荐
    const llmBasedRecs = await this.generateLLMBasedRecommendations(
      behaviors,
      candidateItems,
      patterns
    );

    // 5. 混合推荐
    const recommendations = this.mergeRecommendations(
      patternBasedRecs,
      llmBasedRecs,
      limit
    );

    return {
      userId,
      totalBehaviors: behaviors.length,
      uniqueItems: new Set(behaviors.map(b => b.itemId)).size,
      patterns,
      insights,
      recommendations
    };
  }

  /**
   * 识别序列模式
   */
  private async identifyPatterns(
    behaviors: Behavior[]
  ): Promise<SequencePattern[]> {
    const patterns: SequencePattern[] = [];

    // 1. 识别频繁模式（2-5个物品的序列）
    for (let patternLength = 2; patternLength <= 5; patternLength++) {
      const patternFreq = this.findFrequentPatterns(behaviors, patternLength, 3);

      for (const [pattern, frequency] of Object.entries(patternFreq)) {
        if (frequency >= 2) { // 至少出现2次
          const patternIds = pattern.split('→');
          const lastSeen = this.findLastOccurrence(behaviors, patternIds);

          patterns.push({
            pattern: patternIds,
            patternType: 'frequent',
            frequency,
            confidence: Math.min(frequency / behaviors.length, 1),
            lastSeen,
            nextPredictions: this.predictNextItems(behaviors, patternIds, 3)
          });
        }
      }
    }

    // 2. 识别顺序模式（A→B→C）
    const sequentialPatterns = this.findSequentialPatterns(behaviors);
    patterns.push(...sequentialPatterns);

    // 3. 识别周期模式（每天、每周重复）
    const cyclicPatterns = await this.findCyclicPatterns(behaviors, this.llmClient);
    patterns.push(...cyclicPatterns);

    // 按置信度排序
    patterns.sort((a, b) => b.confidence - a.confidence);

    return patterns.slice(0, 10); // 返回前10个模式
  }

  /**
   * 查找频繁模式
   */
  private findFrequentPatterns(
    behaviors: Behavior[],
    length: number,
    minFrequency: number
  ): Record<string, number> {
    const patternFreq: Record<string, number> = {};

    for (let i = 0; i <= behaviors.length - length; i++) {
      const pattern = behaviors
        .slice(i, i + length)
        .map(b => b.itemId)
        .join('→');
      patternFreq[pattern] = (patternFreq[pattern] || 0) + 1;
    }

    // 过滤低频模式
    return Object.fromEntries(
      Object.entries(patternFreq).filter(([_, freq]) => freq >= minFrequency)
    );
  }

  /**
   * 查找顺序模式（A→B→C）
   */
  private findSequentialPatterns(behaviors: Behavior[]): SequencePattern[] {
    const patterns: SequencePattern[] = [];
    const transitions: Map<string, Set<string>> = new Map();

    // 构建转移图
    for (let i = 0; i < behaviors.length - 1; i++) {
      const from = behaviors[i].itemId;
      const to = behaviors[i + 1].itemId;

      if (!transitions.has(from)) {
        transitions.set(from, new Set());
      }
      transitions.get(from)!.add(to);
    }

    // 提取3步顺序模式
    for (const [from, toSet] of transitions.entries()) {
      for (const to of toSet) {
        if (transitions.has(to)) {
          for (const next of transitions.get(to)!) {
            const pattern = [from, to, next];
            const frequency = this.countPattern(behaviors, pattern);

            if (frequency >= 2) {
              patterns.push({
                pattern,
                patternType: 'sequential',
                frequency,
                confidence: frequency / (behaviors.length - 2),
                lastSeen: this.findLastOccurrence(behaviors, pattern),
                nextPredictions: this.predictNextItems(behaviors, pattern, 2)
              });
            }
          }
        }
      }
    }

    return patterns;
  }

  /**
   * 使用LLM识别周期模式
   */
  private async findCyclicPatterns(
    behaviors: Behavior[],
    llmClient: LLMClient
  ): Promise<SequencePattern[]> {
    const patterns: SequencePattern[] = [];

    // 构建LLM提示
    const recentBehaviors = behaviors.slice(-20);
    const prompt = `分析以下用户行为序列，识别周期性模式：

行为序列：
${recentBehaviors.map((b, i) =>
  `${i + 1}. [${new Date(b.timestamp).toLocaleString()}] ${b.action} ${b.itemTitle}`
).join('\n')}

请识别：
1. 是否有每天、每周、每月的固定模式？
2. 是否有重复的行为序列？
3. 下一次最可能的行为是什么？

以JSON格式返回：
{
  "hasCyclicPattern": true/false,
  "patterns": [
    {
      "pattern": ["物品ID1", "物品ID2"],
      "type": "daily/weekly/monthly",
      "frequency": 出现次数,
      "description": "模式描述"
    }
  ],
  "nextPredictions": ["预测的物品ID1", "预测的物品ID2"]
}`;

    try {
      const response = await llmClient.invoke([
        { role: 'system', content: '你是序列分析专家，擅长识别行为模式。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });

      const result = JSON.parse(response.content || '{}');

      if (result.patterns && result.patterns.length > 0) {
        for (const p of result.patterns) {
          patterns.push({
            pattern: p.pattern,
            patternType: 'cyclic',
            frequency: p.frequency,
            confidence: 0.8, // LLM给出的置信度
            lastSeen: Date.now(),
            nextPredictions: result.nextPredictions || []
          });
        }
      }
    } catch (error) {
      console.error('[SequenceAgent] LLM识别周期模式失败:', error);
    }

    return patterns;
  }

  /**
   * 生成序列洞察
   */
  private async generateInsights(
    behaviors: Behavior[],
    patterns: SequencePattern[]
  ): Promise<string[]> {
    const insights: string[] = [];

    // 1. 基础统计洞察
    const avgDailyBehaviors = behaviors.length / 30; // 假设30天
    insights.push(`用户平均每天有 ${avgDailyBehaviors.toFixed(1)} 个行为`);

    // 2. 行为类型分布
    const actionCounts = behaviors.reduce((acc, b) => {
      acc[b.action] = (acc[b.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    insights.push(`最常见的行为：${topActions.map(([a, c]) => `${a}(${c}次)`).join('、')}`);

    // 3. 模式洞察
    if (patterns.length > 0) {
      insights.push(`识别到 ${patterns.length} 个行为模式`);
      insights.push(`最强模式：${patterns[0].pattern.join('→')}（置信度 ${(patterns[0].confidence * 100).toFixed(0)}%）`);
    }

    // 4. 时间模式
    const hourCounts = behaviors.reduce((acc, b) => {
      const hour = new Date(b.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    if (peakHour) {
      insights.push(`活跃时间段：${peakHour[0]}:00-${parseInt(peakHour[0]) + 1}:00`);
    }

    return insights;
  }

  /**
   * 基于模式生成推荐
   */
  private async generatePatternBasedRecommendations(
    patterns: SequencePattern[],
    candidateItems: Array<{ id: string; title: string; type: string }>
  ): Promise<SequenceRecommendation[]> {
    const recommendations: SequenceRecommendation[] = [];

    for (const pattern of patterns) {
      for (const predictedId of pattern.nextPredictions) {
        const candidate = candidateItems.find(item => item.id === predictedId);
        if (candidate) {
          recommendations.push({
            item: candidate,
            score: pattern.confidence * 0.9,
            reasoning: `基于模式 "${pattern.pattern.join('→')}" 的预测`,
            strategy: 'pattern_based',
            patternMatch: pattern,
            confidence: pattern.confidence
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * 使用LLM理解序列并生成推荐
   */
  private async generateLLMBasedRecommendations(
    behaviors: Behavior[],
    candidateItems: Array<{ id: string; title: string; type: string }>,
    patterns: SequencePattern[]
  ): Promise<SequenceRecommendation[]> {
    const recommendations: SequenceRecommendation[] = [];

    // 构建LLM提示
    const recentBehaviors = behaviors.slice(-10); // 最近10个行为
    const topPatterns = patterns.slice(0, 5); // 前5个模式

    const prompt = `你是一个序列推荐专家。基于用户行为历史和识别的模式，推荐最合适的物品。

用户最近的10个行为：
${recentBehaviors.map((b, i) =>
  `${i + 1}. [${new Date(b.timestamp).toLocaleString()}] ${b.action} ${b.itemTitle}`
).join('\n')}

识别到的模式：
${topPatterns.map((p, i) =>
  `${i + 1}. ${p.pattern.join('→')}（置信度：${(p.confidence * 100).toFixed(0)}%，类型：${p.patternType}）`
).join('\n')}

候选物品：
${candidateItems.map((item, i) =>
  `${i + 1}. [${item.id}] ${item.title}（类型：${item.type}）`
).join('\n')}

请分析用户的序列行为模式，推荐最可能感兴趣的物品（最多5个）。

以JSON格式返回：
{
  "recommendations": [
    {
      "itemId": "物品ID",
      "reasoning": "推荐理由（1-2句话）",
      "score": 0.85,
      "confidence": 0.8
    }
  ],
  "analysis": "对用户序列行为的简要分析"
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是序列推荐专家，擅长从行为序列中发现规律。' },
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5
      });

      const result = JSON.parse(response.content || '{}');

      if (result.recommendations && result.recommendations.length > 0) {
        for (const rec of result.recommendations) {
          const candidate = candidateItems.find(item => item.id === rec.itemId);
          if (candidate) {
            recommendations.push({
              item: candidate,
              score: rec.score,
              reasoning: rec.reasoning,
              strategy: 'llm_based',
              confidence: rec.confidence
            });
          }
        }
      }
    } catch (error) {
      console.error('[SequenceAgent] LLM生成推荐失败:', error);
    }

    return recommendations;
  }

  /**
   * 合并推荐（模式 + LLM）
   */
  private mergeRecommendations(
    patternRecs: SequenceRecommendation[],
    llmRecs: SequenceRecommendation[],
    limit: number
  ): SequenceRecommendation[] {
    // 合并并去重
    const merged = new Map<string, SequenceRecommendation>();

    // 添加模式推荐
    for (const rec of patternRecs) {
      const key = rec.item.id;
      if (!merged.has(key)) {
        merged.set(key, rec);
      } else {
        // 混合策略
        const existing = merged.get(key)!;
        existing.score = Math.max(existing.score, rec.score);
        existing.reasoning = `${existing.reasoning} | ${rec.reasoning}`;
      }
    }

    // 添加LLM推荐
    for (const rec of llmRecs) {
      const key = rec.item.id;
      if (!merged.has(key)) {
        merged.set(key, rec);
      } else {
        const existing = merged.get(key)!;
        existing.score = (existing.score + rec.score) / 2;
        existing.reasoning = `${existing.reasoning} | ${rec.reasoning}`;
        existing.strategy = 'hybrid';
      }
    }

    // 按分数排序并限制数量
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * 辅助方法：计算模式出现次数
   */
  private countPattern(behaviors: Behavior[], pattern: string[]): number {
    let count = 0;
    for (let i = 0; i <= behaviors.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (behaviors[i + j].itemId !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) count++;
    }
    return count;
  }

  /**
   * 辅助方法：查找模式最后一次出现位置
   */
  private findLastOccurrence(behaviors: Behavior[], pattern: string[]): number {
    for (let i = behaviors.length - pattern.length; i >= 0; i--) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (behaviors[i + j].itemId !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return behaviors[i + pattern.length - 1].timestamp;
    }
    return 0;
  }

  /**
   * 辅助方法：预测下一个物品
   */
  private predictNextItems(
    behaviors: Behavior[],
    pattern: string[],
    count: number
  ): string[] {
    const predictions: string[] = [];

    for (let i = 0; i <= behaviors.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (behaviors[i + j].itemId !== pattern[j]) {
          match = false;
          break;
        }
      }

      if (match && i + pattern.length < behaviors.length) {
        const nextItem = behaviors[i + pattern.length].itemId;
        if (!predictions.includes(nextItem)) {
          predictions.push(nextItem);
          if (predictions.length >= count) break;
        }
      }
    }

    return predictions;
  }
}

// ============================================================================
// 基线算法（兜底方案）
// ============================================================================

/**
 * 基线序列推荐算法（马尔可夫链）
 *
 * 作为兜底方案，当智能体失败时使用
 */
class BaselineSequenceRecommender {
  private transitionMatrix: Map<string, Map<string, number>> = new Map();

  /**
   * 训练转移矩阵
   */
  train(behaviors: Behavior[]): void {
    this.transitionMatrix.clear();

    for (let i = 0; i < behaviors.length - 1; i++) {
      const from = behaviors[i].itemId;
      const to = behaviors[i + 1].itemId;

      if (!this.transitionMatrix.has(from)) {
        this.transitionMatrix.set(from, new Map());
      }

      const transitions = this.transitionMatrix.get(from)!;
      transitions.set(to, (transitions.get(to) || 0) + 1);
    }

    // 归一化
    for (const [from, transitions] of this.transitionMatrix) {
      const total = Array.from(transitions.values()).reduce((sum, v) => sum + v, 0);
      for (const [to, count] of transitions) {
        transitions.set(to, count / total);
      }
    }
  }

  /**
   * 预测下一个物品
   */
  predict(lastItemId: string, topK: number = 5): Array<{ itemId: string; probability: number }> {
    const transitions = this.transitionMatrix.get(lastItemId);
    if (!transitions) return [];

    return Array.from(transitions.entries())
      .map(([itemId, probability]) => ({ itemId, probability }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, topK);
  }

  /**
   * 生成推荐
   */
  recommend(
    behaviors: Behavior[],
    candidateItems: Array<{ id: string; title: string; type: string }>,
    limit: number = 10
  ): SequenceRecommendation[] {
    if (behaviors.length === 0) return [];

    // 训练
    this.train(behaviors);

    // 预测
    const lastItemId = behaviors[behaviors.length - 1].itemId;
    const predictions = this.predict(lastItemId, limit * 2);

    // 映射到候选物品
    const recommendations: SequenceRecommendation[] = [];

    for (const pred of predictions) {
      const candidate = candidateItems.find(item => item.id === pred.itemId);
      if (candidate) {
        recommendations.push({
          item: candidate,
          score: pred.probability,
          reasoning: `基于马尔可夫链转移概率预测`,
          strategy: 'pattern_based',
          confidence: pred.probability
        });

        if (recommendations.length >= limit) break;
      }
    }

    return recommendations;
  }
}

// ============================================================================
// 导出
// ============================================================================

export {
  SequenceAnalysisAgent,
  BaselineSequenceRecommender
};
