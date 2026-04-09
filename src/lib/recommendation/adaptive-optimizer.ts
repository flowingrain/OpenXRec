/**
 * 自适应优化智能体系统
 * 
 * 核心功能：
 * 1. 规则精细化：根据实际反馈动态优化关键词列表
 * 2. 置信度校准：收集数据调整规则置信度
 * 3. 多级兜底：管理多层级兜底策略
 * 
 * 设计理念：
 * - 智能体分析反馈 → 识别问题 → 动态调整
 * - 反馈循环学习 → 持续优化
 * - 支持专家审核 → 安全可控
 */

import { LLMClient } from 'coze-coding-dev-sdk';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 关键词类型
 */
export type KeywordCategory = 'search' | 'no_search' | 'ambiguous';

/**
 * 关键词规则
 */
export interface KeywordRule {
  keyword: string;
  category: KeywordCategory;
  confidence: number;           // 规则置信度
  matchCount: number;           // 匹配次数
  correctCount: number;         // 正确次数（用户反馈验证）
  lastUpdated: number;          // 最后更新时间
  source: 'initial' | 'learned' | 'expert';  // 来源
}

/**
 * 用户反馈记录
 */
export interface IntentFeedback {
  query: string;
  predictedNeedsSearch: boolean;
  predictedConfidence: number;
  actualNeedsSearch: boolean;   // 真实结果（通过用户行为推断）
  matchedKeywords: string[];    // 匹配的关键词
  source: 'llm' | 'rule_fallback' | 'history_fallback';
  timestamp: number;
}

/**
 * 兜底策略层级
 */
export interface FallbackLevel {
  name: string;
  priority: number;             // 优先级，数字越小越优先
  enabled: boolean;
  successRate: number;          // 历史成功率
  avgResponseTime: number;      // 平均响应时间(ms)
  lastUsed: number;
}

/**
 * 兜底策略配置
 */
export interface FallbackConfig {
  levels: FallbackLevel[];
  currentLevel: number;         // 当前生效层级
  escalateThreshold: number;    // 连续失败多少次后升级
  deEscalateAfter: number;      // 连续成功多少次后降级
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

/**
 * 置信度校准数据
 */
export interface ConfidenceCalibrationData {
  binStart: number;             // 区间起始
  binEnd: number;               // 区间结束
  predictedCount: number;       // 预测在该区间的次数
  actualAccuracy: number;       // 实际准确率
  samples: IntentFeedback[];    // 样本数据
}

/**
 * 自适应优化状态
 */
export interface AdaptiveOptimizerState {
  keywords: Map<string, KeywordRule>;
  fallbackConfig: FallbackConfig;
  calibrationData: ConfidenceCalibrationData[];
  feedbackHistory: IntentFeedback[];
  lastOptimizationTime: number;
  optimizationCount: number;
}

// ============================================================================
// 自适应优化智能体
// ============================================================================

/**
 * 自适应优化智能体
 * 
 * 职责：
 * 1. 分析反馈数据，识别规则问题
 * 2. 动态调整关键词列表
 * 3. 校准置信度阈值
 * 4. 管理兜底策略层级
 */
export class AdaptiveOptimizerAgent {
  private llmClient: LLMClient;
  private state: AdaptiveOptimizerState;
  private pendingKeywordUpdates: Array<{
    keyword: string;
    suggestedCategory: KeywordCategory;
    reasoning: string;
    confidence: number;
  }> = [];

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
    this.state = this.initializeState();
  }

  /**
   * 初始化状态
   */
  private initializeState(): AdaptiveOptimizerState {
    // 初始关键词规则
    const initialKeywords = new Map<string, KeywordRule>();
    
    const searchKeywords = [
      '今天', '昨天', '本周', '本月', '今年', '最近', '最新', '当前',
      '新闻', '消息', '动态', '事件', '情况',
      '天气', '股价', '汇率', '价格', '行情',
      '2024', '2025', '2026',
      '比分', '比赛', '赛况',
      '排行榜', '排名',
    ];

    const noSearchKeywords = [
      '什么是', '是什么', '定义', '概念', '原理', '原理是',
      '如何', '怎么', '怎样', '方法', '步骤', '做法',
      '为什么', '原因', '由于',
      '区别', '差异', '比较', '对比',
      '历史', '由来', '起源',
      '建议', '推荐', '想法', '创意', '点子',
    ];

    searchKeywords.forEach(keyword => {
      initialKeywords.set(keyword, {
        keyword,
        category: 'search',
        confidence: 0.85,
        matchCount: 0,
        correctCount: 0,
        lastUpdated: Date.now(),
        source: 'initial'
      });
    });

    noSearchKeywords.forEach(keyword => {
      initialKeywords.set(keyword, {
        keyword,
        category: 'no_search',
        confidence: 0.80,
        matchCount: 0,
        correctCount: 0,
        lastUpdated: Date.now(),
        source: 'initial'
      });
    });

    // 初始兜底配置
    const fallbackConfig: FallbackConfig = {
      levels: [
        { name: 'llm', priority: 1, enabled: true, successRate: 0.95, avgResponseTime: 800, lastUsed: 0 },
        { name: 'rule', priority: 2, enabled: true, successRate: 0.75, avgResponseTime: 5, lastUsed: 0 },
        { name: 'history', priority: 3, enabled: true, successRate: 0.60, avgResponseTime: 50, lastUsed: 0 },
        { name: 'popular', priority: 4, enabled: true, successRate: 0.40, avgResponseTime: 10, lastUsed: 0 },
        { name: 'random', priority: 5, enabled: false, successRate: 0.10, avgResponseTime: 1, lastUsed: 0 },
      ],
      currentLevel: 1,
      escalateThreshold: 3,
      deEscalateAfter: 10,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    };

    // 初始置信度校准数据（10个区间）
    const calibrationData: ConfidenceCalibrationData[] = [];
    for (let i = 0; i < 10; i++) {
      calibrationData.push({
        binStart: i * 0.1,
        binEnd: (i + 1) * 0.1,
        predictedCount: 0,
        actualAccuracy: 0,
        samples: []
      });
    }

    return {
      keywords: initialKeywords,
      fallbackConfig,
      calibrationData,
      feedbackHistory: [],
      lastOptimizationTime: 0,
      optimizationCount: 0
    };
  }

  // ===========================================================================
  // 1. 规则精细化：动态优化关键词列表
  // ===========================================================================

  /**
   * 记录反馈并更新关键词规则
   */
  async recordFeedbackAndLearn(feedback: IntentFeedback): Promise<void> {
    // 添加到历史记录
    this.state.feedbackHistory.push(feedback);
    if (this.state.feedbackHistory.length > 10000) {
      this.state.feedbackHistory = this.state.feedbackHistory.slice(-10000);
    }

    // 更新匹配关键词的统计
    for (const keyword of feedback.matchedKeywords) {
      const rule = this.state.keywords.get(keyword);
      if (rule) {
        rule.matchCount++;
        
        // 判断预测是否正确
        const predictedCorrect = 
          (feedback.predictedNeedsSearch === feedback.actualNeedsSearch);
        
        if (predictedCorrect) {
          rule.correctCount++;
        }

        // 动态调整置信度
        rule.confidence = rule.correctCount / Math.max(rule.matchCount, 1);
        rule.lastUpdated = Date.now();
      }
    }

    // 更新置信度校准数据
    this.updateCalibrationData(feedback);

    // 更新兜底策略统计
    this.updateFallbackStats(feedback);

    // 定期触发智能分析
    if (this.shouldTriggerOptimization()) {
      await this.runOptimization();
    }
  }

  /**
   * 使用LLM分析反馈，识别问题关键词和新关键词
   */
  async analyzeFeedbackPatterns(): Promise<{
    problematicKeywords: Array<{ keyword: string; issue: string; suggestedAction: string }>;
    newKeywordSuggestions: Array<{ keyword: string; category: KeywordCategory; reasoning: string }>;
    overallInsights: string;
  }> {
    const recentFeedbacks = this.state.feedbackHistory.slice(-200);
    
    if (recentFeedbacks.length < 20) {
      return {
        problematicKeywords: [],
        newKeywordSuggestions: [],
        overallInsights: '反馈数据不足，暂不分析'
      };
    }

    // 准备分析数据
    const errorPatterns = recentFeedbacks
      .filter(f => f.predictedNeedsSearch !== f.actualNeedsSearch)
      .slice(-50)
      .map(f => ({
        query: f.query,
        predicted: f.predictedNeedsSearch ? '需要搜索' : '不需要搜索',
        actual: f.actualNeedsSearch ? '实际需要搜索' : '实际不需要搜索',
        matchedKeywords: f.matchedKeywords,
        source: f.source
      }));

    const prompt = `你是一个推荐系统的规则优化专家。请分析以下意图判断错误案例，识别问题并提出改进建议。

## 错误案例分析
${JSON.stringify(errorPatterns, null, 2)}

## 当前关键词规则
搜索类关键词: ${Array.from(this.state.keywords.values())
  .filter(r => r.category === 'search')
  .map(r => `${r.keyword}(${(r.confidence * 100).toFixed(0)}%)`)
  .join(', ')}

非搜索类关键词: ${Array.from(this.state.keywords.values())
  .filter(r => r.category === 'no_search')
  .map(r => `${r.keyword}(${(r.confidence * 100).toFixed(0)}%)`)
  .join(', ')}

## 分析任务
1. 识别问题关键词：找出导致错误判断的关键词，说明问题所在
2. 建议新关键词：从错误案例中提取可能遗漏的有价值关键词
3. 给出整体洞察

## 返回格式（JSON）
{
  "problematicKeywords": [
    {
      "keyword": "关键词",
      "issue": "问题描述",
      "suggestedAction": "remove/change_category/adjust_confidence"
    }
  ],
  "newKeywordSuggestions": [
    {
      "keyword": "新关键词",
      "category": "search/no_search",
      "reasoning": "添加理由"
    }
  ],
  "overallInsights": "整体分析结论和建议"
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[AdaptiveOptimizer] LLM分析失败:', e);
    }

    return {
      problematicKeywords: [],
      newKeywordSuggestions: [],
      overallInsights: '分析失败'
    };
  }

  /**
   * 应用关键词优化
   */
  async applyKeywordOptimization(
    problematicKeywords: Array<{ keyword: string; issue: string; suggestedAction: string }>,
    newKeywordSuggestions: Array<{ keyword: string; category: KeywordCategory; reasoning: string }>
  ): Promise<{ applied: number; pending: number }> {
    let applied = 0;
    let pending = 0;

    // 处理问题关键词
    for (const item of problematicKeywords) {
      const rule = this.state.keywords.get(item.keyword);
      
      if (!rule) continue;

      switch (item.suggestedAction) {
        case 'remove':
          // 低置信度关键词可直接移除
          if (rule.confidence < 0.5 && rule.matchCount > 10) {
            this.state.keywords.delete(item.keyword);
            applied++;
          } else {
            // 需要专家确认
            pending++;
          }
          break;

        case 'change_category':
          // 高置信度变更可直接应用
          if (rule.matchCount > 20 && rule.confidence < 0.3) {
            rule.category = rule.category === 'search' ? 'no_search' : 'search';
            rule.confidence = 0.5;
            rule.source = 'learned';
            rule.lastUpdated = Date.now();
            applied++;
          } else {
            pending++;
          }
          break;

        case 'adjust_confidence':
          // 根据准确率调整
          rule.confidence = Math.max(0.1, Math.min(0.95, rule.confidence - 0.1));
          applied++;
          break;
      }
    }

    // 处理新关键词建议
    for (const suggestion of newKeywordSuggestions) {
      if (!this.state.keywords.has(suggestion.keyword)) {
        // 添加新关键词
        this.state.keywords.set(suggestion.keyword, {
          keyword: suggestion.keyword,
          category: suggestion.category,
          confidence: 0.7,  // 初始置信度适中
          matchCount: 0,
          correctCount: 0,
          lastUpdated: Date.now(),
          source: 'learned'
        });
        applied++;
      }
    }

    return { applied, pending };
  }

  // ===========================================================================
  // 2. 置信度校准：动态调整置信度
  // ===========================================================================

  /**
   * 更新置信度校准数据
   */
  private updateCalibrationData(feedback: IntentFeedback): void {
    const binIndex = Math.min(
      Math.floor(feedback.predictedConfidence * 10),
      9
    );
    
    const bin = this.state.calibrationData[binIndex];
    bin.predictedCount++;
    
    const isCorrect = feedback.predictedNeedsSearch === feedback.actualNeedsSearch;
    bin.samples.push(feedback);
    
    // 保留最近100个样本
    if (bin.samples.length > 100) {
      bin.samples = bin.samples.slice(-100);
    }
    
    // 更新实际准确率
    bin.actualAccuracy = bin.samples.filter(s => 
      s.predictedNeedsSearch === s.actualNeedsSearch
    ).length / bin.samples.length;
  }

  /**
   * 获取校准后的置信度
   */
  getCalibratedConfidence(originalConfidence: number): number {
    const binIndex = Math.min(
      Math.floor(originalConfidence * 10),
      9
    );
    
    const bin = this.state.calibrationData[binIndex];
    
    // 如果有足够样本，使用实际准确率作为校准
    if (bin.samples.length >= 20) {
      // 使用Platt Scaling风格的校准
      return bin.actualAccuracy;
    }
    
    // 样本不足时，保持原始值
    return originalConfidence;
  }

  /**
   * 获取置信度校准报告
   */
  getCalibrationReport(): {
    bins: Array<{
      range: string;
      predictedCount: number;
      actualAccuracy: number;
      calibrationError: number;
    }>;
    expectedCalibrationError: number;
    recommendation: string;
  } {
    const bins = this.state.calibrationData.map(bin => ({
      range: `${(bin.binStart * 100).toFixed(0)}%-${(bin.binEnd * 100).toFixed(0)}%`,
      predictedCount: bin.predictedCount,
      actualAccuracy: bin.actualAccuracy,
      calibrationError: Math.abs(
        (bin.binStart + bin.binEnd) / 2 - bin.actualAccuracy
      )
    }));

    // 计算期望校准误差 (ECE)
    const totalCount = this.state.calibrationData.reduce(
      (sum, bin) => sum + bin.predictedCount, 0
    );
    
    const ece = this.state.calibrationData.reduce((sum, bin) => {
      const weight = bin.predictedCount / Math.max(totalCount, 1);
      const error = Math.abs(
        (bin.binStart + bin.binEnd) / 2 - bin.actualAccuracy
      );
      return sum + weight * error;
    }, 0);

    // 生成建议
    let recommendation = '';
    if (ece > 0.15) {
      recommendation = '校准误差较大，建议启用置信度校准功能';
    } else if (ece > 0.08) {
      recommendation = '校准误差适中，可考虑启用置信度校准';
    } else {
      recommendation = '校准良好，当前置信度可信';
    }

    return { bins, expectedCalibrationError: ece, recommendation };
  }

  // ===========================================================================
  // 3. 多级兜底：管理兜底策略
  // ===========================================================================

  /**
   * 更新兜底策略统计
   */
  private updateFallbackStats(feedback: IntentFeedback): void {
    const config = this.state.fallbackConfig;
    
    const isSuccess = feedback.predictedNeedsSearch === feedback.actualNeedsSearch;
    
    if (isSuccess) {
      config.consecutiveSuccesses++;
      config.consecutiveFailures = 0;
      
      // 连续成功足够次数，考虑降级（使用更优化的策略）
      if (config.consecutiveSuccesses >= config.deEscalateAfter && 
          config.currentLevel > 1) {
        config.currentLevel--;
        config.consecutiveSuccesses = 0;
        console.log(`[AdaptiveOptimizer] 策略降级到第 ${config.currentLevel} 级`);
      }
    } else {
      config.consecutiveFailures++;
      config.consecutiveSuccesses = 0;
      
      // 连续失败达到阈值，升级兜底策略
      if (config.consecutiveFailures >= config.escalateThreshold) {
        const nextLevel = config.levels.find(
          l => l.priority > config.currentLevel && l.enabled
        );
        
        if (nextLevel) {
          config.currentLevel = nextLevel.priority;
          config.consecutiveFailures = 0;
          console.log(`[AdaptiveOptimizer] 策略升级到第 ${config.currentLevel} 级 (${nextLevel.name})`);
        }
      }
    }
  }

  /**
   * 获取当前兜底策略
   */
  getCurrentFallbackStrategy(): FallbackLevel {
    const config = this.state.fallbackConfig;
    return config.levels.find(l => l.priority === config.currentLevel) || config.levels[0];
  }

  /**
   * 执行多级兜底
   */
  async executeFallback(
    query: string,
    context: {
      llmResult?: { needsSearch: boolean; confidence: number };
      ruleResult?: { needsSearch: boolean; confidence: number };
      historyResult?: { needsSearch: boolean; confidence: number };
    }
  ): Promise<{
    result: { needsSearch: boolean; confidence: number };
    level: string;
    reasoning: string;
  }> {
    const config = this.state.fallbackConfig;

    // 按优先级尝试各级策略
    for (const level of config.levels) {
      if (!level.enabled) continue;

      let result: { needsSearch: boolean; confidence: number } | null = null;
      let reasoning = '';

      switch (level.name) {
        case 'llm':
          if (context.llmResult && context.llmResult.confidence >= 0.5) {
            result = context.llmResult;
            reasoning = '使用LLM意图分析结果';
          }
          break;

        case 'rule':
          if (context.ruleResult) {
            result = context.ruleResult;
            reasoning = '使用规则关键词匹配结果';
          }
          break;

        case 'history':
          if (context.historyResult) {
            result = context.historyResult;
            reasoning = '使用历史相似查询结果';
          }
          break;

        case 'popular':
          // 热门策略：保守判断，倾向于搜索
          result = { needsSearch: true, confidence: 0.3 };
          reasoning = '使用热门策略：保守选择搜索';
          break;
      }

      if (result) {
        level.lastUsed = Date.now();
        return { result, level: level.name, reasoning };
      }
    }

    // 最终兜底：默认搜索
    return {
      result: { needsSearch: true, confidence: 0.1 },
      level: 'default',
      reasoning: '所有策略失效，默认执行搜索'
    };
  }

  // ===========================================================================
  // 综合优化流程
  // ===========================================================================

  /**
   * 判断是否应该触发优化
   */
  private shouldTriggerOptimization(): boolean {
    const now = Date.now();
    const timeSinceLastOptimization = now - this.state.lastOptimizationTime;
    const feedbackCount = this.state.feedbackHistory.length;

    // 条件1：距离上次优化超过1小时
    // 条件2：新增反馈超过100条
    return timeSinceLastOptimization > 3600000 || feedbackCount % 100 === 0;
  }

  /**
   * 运行综合优化
   */
  async runOptimization(): Promise<{
    keywordsUpdated: number;
    calibrationImproved: boolean;
    fallbackAdjusted: boolean;
    insights: string;
  }> {
    console.log('[AdaptiveOptimizer] 开始智能优化...');
    this.state.optimizationCount++;
    this.state.lastOptimizationTime = Date.now();

    // 1. 分析反馈模式
    const analysis = await this.analyzeFeedbackPatterns();

    // 2. 应用关键词优化
    const { applied: keywordsUpdated } = await this.applyKeywordOptimization(
      analysis.problematicKeywords,
      analysis.newKeywordSuggestions
    );

    // 3. 检查校准效果
    const calibrationReport = this.getCalibrationReport();
    const calibrationImproved = calibrationReport.expectedCalibrationError < 0.1;

    // 4. 评估兜底策略效果
    const fallbackStrategy = this.getCurrentFallbackStrategy();
    const fallbackAdjusted = fallbackStrategy.successRate > 0.7;

    return {
      keywordsUpdated,
      calibrationImproved,
      fallbackAdjusted,
      insights: analysis.overallInsights
    };
  }

  // ===========================================================================
  // 状态管理
  // ===========================================================================

  /**
   * 获取关键词规则（供意图分析使用）
   */
  getKeywordRules(): {
    searchKeywords: string[];
    noSearchKeywords: string[];
    keywordConfidences: Map<string, number>;
  } {
    const searchKeywords: string[] = [];
    const noSearchKeywords: string[] = [];
    const keywordConfidences = new Map<string, number>();

    this.state.keywords.forEach((rule, keyword) => {
      keywordConfidences.set(keyword, rule.confidence);
      
      if (rule.category === 'search' && rule.confidence >= 0.5) {
        searchKeywords.push(keyword);
      } else if (rule.category === 'no_search' && rule.confidence >= 0.5) {
        noSearchKeywords.push(keyword);
      }
    });

    return { searchKeywords, noSearchKeywords, keywordConfidences };
  }

  /**
   * 获取优化状态报告
   */
  getOptimizationReport(): {
    keywordsTotal: number;
    keywordsLearned: number;
    feedbackCount: number;
    optimizationCount: number;
    calibrationError: number;
    currentFallbackLevel: string;
    recentAccuracy: number;
  } {
    const keywords = Array.from(this.state.keywords.values());
    const recentFeedbacks = this.state.feedbackHistory.slice(-100);
    const recentAccuracy = recentFeedbacks.filter(
      f => f.predictedNeedsSearch === f.actualNeedsSearch
    ).length / Math.max(recentFeedbacks.length, 1);

    return {
      keywordsTotal: keywords.length,
      keywordsLearned: keywords.filter(k => k.source === 'learned').length,
      feedbackCount: this.state.feedbackHistory.length,
      optimizationCount: this.state.optimizationCount,
      calibrationError: this.getCalibrationReport().expectedCalibrationError,
      currentFallbackLevel: this.getCurrentFallbackStrategy().name,
      recentAccuracy
    };
  }

  /**
   * 导出状态（用于持久化）
   */
  exportState(): string {
    return JSON.stringify({
      keywords: Array.from(this.state.keywords.entries()),
      fallbackConfig: this.state.fallbackConfig,
      calibrationData: this.state.calibrationData.map(bin => ({
        ...bin,
        samples: bin.samples.slice(-20)  // 只保留最近20个样本
      })),
      lastOptimizationTime: this.state.lastOptimizationTime,
      optimizationCount: this.state.optimizationCount
    });
  }

  /**
   * 导入状态（用于恢复）
   */
  importState(stateJson: string): void {
    try {
      const parsed = JSON.parse(stateJson);
      
      this.state.keywords = new Map(parsed.keywords);
      this.state.fallbackConfig = parsed.fallbackConfig;
      this.state.calibrationData = parsed.calibrationData;
      this.state.lastOptimizationTime = parsed.lastOptimizationTime;
      this.state.optimizationCount = parsed.optimizationCount;
    } catch (e) {
      console.error('[AdaptiveOptimizer] 状态导入失败:', e);
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

export default AdaptiveOptimizerAgent;
