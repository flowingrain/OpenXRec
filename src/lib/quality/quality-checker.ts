/**
 * 自动质量检测服务
 * 
 * 功能：
 * 1. 分析完成后自动检测质量问题
 * 2. 生成质量报告和改进建议
 * 3. 支持多维度质量评估
 */

import type { AnalysisStateType } from '@/lib/langgraph/state';

// ==================== 类型定义 ====================

/**
 * 质量维度
 */
export type QualityDimension = 
  | 'information_quality'    // 信息源质量
  | 'causal_chain_depth'     // 因果链深度
  | 'scenario_reasonability' // 场景合理性
  | 'knowledge_richness'     // 知识丰富度
  | 'timeline_coherence'     // 时间线连贯性
  | 'report_quality';        // 报告质量

/**
 * 质量问题严重程度
 */
export type Severity = 'critical' | 'warning' | 'info';

/**
 * 质量问题类型
 */
export type QualityIssueType = 
  | 'insufficient_sources'       // 信息源不足
  | 'low_authority_sources'      // 权威来源占比低
  | 'stale_information'          // 信息过时
  | 'shallow_causal_chain'       // 因果链过浅
  | 'missing_transmission'       // 缺少传导机制
  | 'unbalanced_scenarios'       // 场景分布不均衡
  | 'missing_triggers'           // 缺少触发条件
  | 'sparse_knowledge_graph'     // 知识图谱稀疏
  | 'incomplete_timeline'        // 时间线不完整
  | 'short_report'               // 报告过短
  | 'low_confidence'             // 置信度过低
  | 'contradictory_information'; // 信息矛盾

/**
 * 质量问题
 */
export interface QualityIssue {
  id: string;
  type: QualityIssueType;
  dimension: QualityDimension;
  severity: Severity;
  title: string;
  description: string;
  suggestion: string;
  autoFixable: boolean;  // 是否可自动修复
  affectedData?: string[]; // 受影响的数据
  metrics?: Record<string, number>; // 相关指标
}

/**
 * 维度评分
 */
export interface DimensionScore {
  dimension: QualityDimension;
  score: number;           // 0-100
  weight: number;          // 权重
  issues: QualityIssue[];  // 该维度的问题
  strengths: string[];     // 该维度的优点
}

/**
 * 质量检测报告
 */
export interface QualityReport {
  id: string;
  caseId?: string;
  query: string;
  overallScore: number;           // 综合评分 0-100
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  dimensionScores: DimensionScore[];
  issues: QualityIssue[];
  criticalIssues: QualityIssue[];
  improvementPriority: string[];  // 改进优先级列表
  detectedAt: string;
  analysisMetadata: {
    searchResultCount: number;
    timelineEventCount: number;
    causalChainCount: number;
    keyFactorCount: number;
    scenarioCount: number;
    knowledgeEntityCount: number;
    knowledgeRelationCount: number;
    reportLength: number;
    modelConfidence: number;
  };
}

/**
 * 质量检测配置
 */
export interface QualityCheckConfig {
  // 信息源阈值
  minSourceCount: number;           // 最少信息源数量
  minAuthorityRatio: number;        // 最小权威来源占比
  maxStaleDays: number;             // 信息最大过期天数
  
  // 因果链阈值
  minCausalChainLength: number;     // 最小因果链长度
  minCausalStrength: number;        // 最小因果强度
  
  // 场景阈值
  minScenarioCount: number;         // 最少场景数量
  maxScenarioImbalance: number;     // 最大场景概率不平衡度
  
  // 知识图谱阈值
  minEntityCount: number;           // 最少实体数量
  minRelationCount: number;         // 最少关系数量
  
  // 时间线阈值
  minTimelineEvents: number;        // 最少时间线事件
  
  // 报告阈值
  minReportLength: number;          // 最小报告长度
  minConfidence: number;            // 最小置信度
}

// 默认配置
const DEFAULT_CONFIG: QualityCheckConfig = {
  minSourceCount: 5,
  minAuthorityRatio: 0.3,
  maxStaleDays: 30,
  minCausalChainLength: 2,
  minCausalStrength: 0.5,
  minScenarioCount: 2,
  maxScenarioImbalance: 0.6,
  minEntityCount: 3,
  minRelationCount: 2,
  minTimelineEvents: 3,
  minReportLength: 500,
  minConfidence: 0.5,
};

// 维度权重配置
const DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  information_quality: 0.20,
  causal_chain_depth: 0.20,
  scenario_reasonability: 0.15,
  knowledge_richness: 0.15,
  timeline_coherence: 0.10,
  report_quality: 0.20,
};

// 维度中文名称
const DIMENSION_NAMES: Record<QualityDimension, string> = {
  information_quality: '信息源质量',
  causal_chain_depth: '因果链深度',
  scenario_reasonability: '场景合理性',
  knowledge_richness: '知识丰富度',
  timeline_coherence: '时间线连贯性',
  report_quality: '报告质量',
};

/**
 * 质量检测器类
 */
export class QualityChecker {
  private config: QualityCheckConfig;
  
  constructor(config: Partial<QualityCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 执行完整的质量检测
   */
  async check(state: AnalysisStateType): Promise<QualityReport> {
    const issues: QualityIssue[] = [];
    const dimensionScores: DimensionScore[] = [];
    
    // 1. 检测各维度
    const infoResult = this.checkInformationQuality(state);
    const causalResult = this.checkCausalChainDepth(state);
    const scenarioResult = this.checkScenarioReasonability(state);
    const knowledgeResult = this.checkKnowledgeRichness(state);
    const timelineResult = this.checkTimelineCoherence(state);
    const reportResult = this.checkReportQuality(state);
    
    dimensionScores.push(infoResult, causalResult, scenarioResult, knowledgeResult, timelineResult, reportResult);
    
    // 收集所有问题
    dimensionScores.forEach(ds => issues.push(...ds.issues));
    
    // 2. 计算综合评分
    const overallScore = this.calculateOverallScore(dimensionScores);
    
    // 3. 确定等级
    const grade = this.determineGrade(overallScore);
    
    // 4. 确定关键问题
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    
    // 5. 生成改进优先级
    const improvementPriority = this.generateImprovementPriority(dimensionScores);
    
    // 6. 构建报告
    const report: QualityReport = {
      id: `quality_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      query: state.query,
      overallScore,
      grade,
      dimensionScores,
      issues,
      criticalIssues,
      improvementPriority,
      detectedAt: new Date().toISOString(),
      analysisMetadata: {
        searchResultCount: state.searchResults?.length || 0,
        timelineEventCount: state.timeline?.length || 0,
        causalChainCount: state.causalChain?.length || 0,
        keyFactorCount: state.keyFactors?.length || 0,
        scenarioCount: state.scenarios?.length || 0,
        knowledgeEntityCount: state.knowledgeGraph?.entities?.length || 0,
        knowledgeRelationCount: state.knowledgeGraph?.relations?.length || 0,
        reportLength: state.finalReport?.length || 0,
        modelConfidence: this.calculateModelConfidence(state),
      },
    };
    
    console.log(`[QualityChecker] 质量检测完成: 综合评分 ${overallScore}, 等级 ${grade}, 发现 ${issues.length} 个问题`);
    
    return report;
  }
  
  /**
   * 检测信息源质量
   */
  private checkInformationQuality(state: AnalysisStateType): DimensionScore {
    const issues: QualityIssue[] = [];
    const strengths: string[] = [];
    const sources = state.searchResults || [];
    
    // 计算指标
    const sourceCount = sources.length;
    const authorityCount = sources.filter(s => 
      s.authorityLevel && s.authorityLevel >= 4
    ).length;
    const authorityRatio = sourceCount > 0 ? authorityCount / sourceCount : 0;
    
    // 检查信息源数量
    if (sourceCount < this.config.minSourceCount) {
      issues.push({
        id: `issue_${Date.now()}_src_count`,
        type: 'insufficient_sources',
        dimension: 'information_quality',
        severity: sourceCount < 3 ? 'critical' : 'warning',
        title: '信息源数量不足',
        description: `当前仅有 ${sourceCount} 条信息源，建议至少 ${this.config.minSourceCount} 条`,
        suggestion: '增加搜索关键词或扩大搜索范围，获取更多相关信息',
        autoFixable: false,
        metrics: { sourceCount, minRequired: this.config.minSourceCount },
      });
    } else if (sourceCount >= 10) {
      strengths.push(`信息源充足 (${sourceCount}条)`);
    }
    
    // 检查权威来源占比
    if (authorityRatio < this.config.minAuthorityRatio && sourceCount > 0) {
      issues.push({
        id: `issue_${Date.now()}_authority`,
        type: 'low_authority_sources',
        dimension: 'information_quality',
        severity: 'warning',
        title: '权威来源占比偏低',
        description: `权威来源占比 ${(authorityRatio * 100).toFixed(0)}%，低于建议的 ${(this.config.minAuthorityRatio * 100).toFixed(0)}%`,
        suggestion: '优先引用官方媒体、权威机构、学术研究等高质量来源',
        autoFixable: false,
        metrics: { authorityRatio, minRequired: this.config.minAuthorityRatio },
      });
    } else if (authorityRatio >= 0.5) {
      strengths.push(`权威来源占比高 (${(authorityRatio * 100).toFixed(0)}%)`);
    }
    
    // 检查信息时效性
    const now = Date.now();
    const staleSources = sources.filter(s => {
      if (!s.publishTime) return false;
      const publishDate = new Date(s.publishTime).getTime();
      const daysDiff = (now - publishDate) / (1000 * 60 * 60 * 24);
      return daysDiff > this.config.maxStaleDays;
    });
    
    if (staleSources.length > sourceCount * 0.5 && sourceCount > 0) {
      issues.push({
        id: `issue_${Date.now()}_stale`,
        type: 'stale_information',
        dimension: 'information_quality',
        severity: 'info',
        title: '部分信息可能过时',
        description: `${staleSources.length} 条信息源超过 ${this.config.maxStaleDays} 天`,
        suggestion: '关注最新动态，优先使用近期信息',
        autoFixable: false,
        metrics: { staleCount: staleSources.length, staleRatio: staleSources.length / sourceCount },
      });
    }
    
    // 计算得分
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 15;
      else score -= 5;
    });
    score = Math.max(0, Math.min(100, score));
    
    return {
      dimension: 'information_quality',
      score,
      weight: DIMENSION_WEIGHTS.information_quality,
      issues,
      strengths,
    };
  }
  
  /**
   * 检测因果链深度
   */
  private checkCausalChainDepth(state: AnalysisStateType): DimensionScore {
    const issues: QualityIssue[] = [];
    const strengths: string[] = [];
    const causalChain = state.causalChain || [];
    
    const chainLength = causalChain.length;
    const avgStrength = causalChain.length > 0 
      ? causalChain.reduce((sum, c) => sum + (c.strength || 0.5), 0) / causalChain.length 
      : 0;
    
    // 检查因果链长度
    if (chainLength < this.config.minCausalChainLength) {
      issues.push({
        id: `issue_${Date.now()}_causal_len`,
        type: 'shallow_causal_chain',
        dimension: 'causal_chain_depth',
        severity: chainLength === 0 ? 'critical' : 'warning',
        title: '因果链深度不足',
        description: `当前因果链仅有 ${chainLength} 层，分析深度有限`,
        suggestion: '深入挖掘事件之间的因果关系，构建完整的传导路径',
        autoFixable: false,
        metrics: { chainLength, minRequired: this.config.minCausalChainLength },
      });
    } else if (chainLength >= 4) {
      strengths.push(`因果链完整 (${chainLength}层)`);
    }
    
    // 检查因果强度
    if (avgStrength < this.config.minCausalStrength && chainLength > 0) {
      issues.push({
        id: `issue_${Date.now()}_causal_str`,
        type: 'missing_transmission',
        dimension: 'causal_chain_depth',
        severity: 'warning',
        title: '因果关系强度较弱',
        description: `平均因果强度 ${(avgStrength * 100).toFixed(0)}%，部分因果关系缺乏充分依据`,
        suggestion: '补充更多证据支撑因果关系，提高因果推理的可信度',
        autoFixable: false,
        metrics: { avgStrength, minRequired: this.config.minCausalStrength },
      });
    } else if (avgStrength >= 0.7) {
      strengths.push(`因果关系明确 (强度${(avgStrength * 100).toFixed(0)}%)`);
    }
    
    // 检查因果类型分布
    const causeTypes = causalChain.filter(c => c.type === 'cause').length;
    const intermediaryTypes = causalChain.filter(c => c.type === 'intermediary').length;
    const resultTypes = causalChain.filter(c => c.type === 'result').length;
    
    if (intermediaryTypes === 0 && chainLength > 0) {
      issues.push({
        id: `issue_${Date.now()}_transmission`,
        type: 'missing_transmission',
        dimension: 'causal_chain_depth',
        severity: 'info',
        title: '缺少中间传导机制',
        description: '因果链缺少中间传导环节，可能影响分析的完整性',
        suggestion: '补充原因到结果之间的传导路径和机制',
        autoFixable: false,
      });
    }
    
    // 计算得分
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 35;
      else if (issue.severity === 'warning') score -= 20;
      else score -= 10;
    });
    score = Math.max(0, Math.min(100, score));
    
    return {
      dimension: 'causal_chain_depth',
      score,
      weight: DIMENSION_WEIGHTS.causal_chain_depth,
      issues,
      strengths,
    };
  }
  
  /**
   * 检测场景合理性
   */
  private checkScenarioReasonability(state: AnalysisStateType): DimensionScore {
    const issues: QualityIssue[] = [];
    const strengths: string[] = [];
    const scenarios = state.scenarios || [];
    
    const scenarioCount = scenarios.length;
    
    // 检查场景数量
    if (scenarioCount < this.config.minScenarioCount) {
      issues.push({
        id: `issue_${Date.now()}_scenario_cnt`,
        type: 'unbalanced_scenarios',
        dimension: 'scenario_reasonability',
        severity: scenarioCount === 0 ? 'critical' : 'warning',
        title: '场景推演数量不足',
        description: `当前仅有 ${scenarioCount} 个场景，难以覆盖主要可能性`,
        suggestion: '构建多个可能的未来发展场景，提高分析的全面性',
        autoFixable: false,
        metrics: { scenarioCount, minRequired: this.config.minScenarioCount },
      });
    } else if (scenarioCount >= 3) {
      strengths.push(`场景覆盖完整 (${scenarioCount}个)`);
    }
    
    // 检查场景概率分布
    if (scenarioCount >= 2) {
      const probabilities = scenarios.map(s => s.probability || 0.33);
      const maxProb = Math.max(...probabilities);
      const minProb = Math.min(...probabilities);
      
      // 检查是否过于集中
      if (maxProb > this.config.maxScenarioImbalance) {
        issues.push({
          id: `issue_${Date.now()}_scenario_imb`,
          type: 'unbalanced_scenarios',
          dimension: 'scenario_reasonability',
          severity: 'info',
          title: '场景概率分布过于集中',
          description: `最高概率场景占比 ${(maxProb * 100).toFixed(0)}%，可能导致忽视其他可能性`,
          suggestion: '考虑更多不确定性因素，使场景概率分布更均衡',
          autoFixable: false,
          metrics: { maxProb, minProb, imbalance: maxProb - minProb },
        });
      }
      
      // 检查概率和是否为1
      const probSum = probabilities.reduce((a, b) => a + b, 0);
      if (Math.abs(probSum - 1) > 0.1) {
        issues.push({
          id: `issue_${Date.now()}_scenario_prob`,
          type: 'unbalanced_scenarios',
          dimension: 'scenario_reasonability',
          severity: 'warning',
          title: '场景概率和不等于100%',
          description: `场景概率总和为 ${(probSum * 100).toFixed(0)}%，不符合概率理论`,
          suggestion: '调整场景概率，使总和等于100%',
          autoFixable: true,
          metrics: { probSum },
        });
      }
    }
    
    // 检查触发条件
    const scenariosWithoutTriggers = scenarios.filter(s => !s.triggers || s.triggers.length === 0);
    if (scenariosWithoutTriggers.length > 0 && scenarioCount > 0) {
      issues.push({
        id: `issue_${Date.now()}_triggers`,
        type: 'missing_triggers',
        dimension: 'scenario_reasonability',
        severity: 'info',
        title: '部分场景缺少触发条件',
        description: `${scenariosWithoutTriggers.length} 个场景未定义触发条件`,
        suggestion: '为每个场景添加明确的触发条件，便于监测和验证',
        autoFixable: false,
        metrics: { missingTriggers: scenariosWithoutTriggers.length },
      });
    }
    
    // 计算得分
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 15;
      else score -= 5;
    });
    score = Math.max(0, Math.min(100, score));
    
    return {
      dimension: 'scenario_reasonability',
      score,
      weight: DIMENSION_WEIGHTS.scenario_reasonability,
      issues,
      strengths,
    };
  }
  
  /**
   * 检测知识丰富度
   */
  private checkKnowledgeRichness(state: AnalysisStateType): DimensionScore {
    const issues: QualityIssue[] = [];
    const strengths: string[] = [];
    const kg = state.knowledgeGraph;
    
    const entityCount = kg?.entities?.length || 0;
    const relationCount = kg?.relations?.length || 0;
    
    // 检查实体数量
    if (entityCount < this.config.minEntityCount) {
      issues.push({
        id: `issue_${Date.now()}_entity_cnt`,
        type: 'sparse_knowledge_graph',
        dimension: 'knowledge_richness',
        severity: entityCount === 0 ? 'critical' : 'warning',
        title: '知识图谱实体稀疏',
        description: `当前仅有 ${entityCount} 个实体，知识覆盖有限`,
        suggestion: '增强实体识别能力，从分析内容中提取更多关键实体',
        autoFixable: false,
        metrics: { entityCount, minRequired: this.config.minEntityCount },
      });
    } else if (entityCount >= 10) {
      strengths.push(`实体丰富 (${entityCount}个)`);
    }
    
    // 检查关系数量
    if (relationCount < this.config.minRelationCount && entityCount > 0) {
      issues.push({
        id: `issue_${Date.now()}_relation_cnt`,
        type: 'sparse_knowledge_graph',
        dimension: 'knowledge_richness',
        severity: 'warning',
        title: '知识图谱关系稀疏',
        description: `当前仅有 ${relationCount} 条关系，实体关联不足`,
        suggestion: '深入分析实体之间的关系，构建更完整的知识网络',
        autoFixable: false,
        metrics: { relationCount, minRequired: this.config.minRelationCount },
      });
    } else if (relationCount >= 8) {
      strengths.push(`关系完整 (${relationCount}条)`);
    }
    
    // 检查实体类型多样性
    if (entityCount > 0) {
      const entityTypes = new Set(kg?.entities?.map(e => e.type) || []);
      if (entityTypes.size < 3) {
        issues.push({
          id: `issue_${Date.now()}_entity_type`,
          type: 'sparse_knowledge_graph',
          dimension: 'knowledge_richness',
          severity: 'info',
          title: '实体类型单一',
          description: `当前仅有 ${entityTypes.size} 种实体类型`,
          suggestion: '识别更多类型的实体（如公司、人物、政策、地点等）',
          autoFixable: false,
          metrics: { typeCount: entityTypes.size },
        });
      } else {
        strengths.push(`实体类型多样 (${entityTypes.size}种)`);
      }
    }
    
    // 计算得分
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 15;
      else score -= 5;
    });
    score = Math.max(0, Math.min(100, score));
    
    return {
      dimension: 'knowledge_richness',
      score,
      weight: DIMENSION_WEIGHTS.knowledge_richness,
      issues,
      strengths,
    };
  }
  
  /**
   * 检测时间线连贯性
   */
  private checkTimelineCoherence(state: AnalysisStateType): DimensionScore {
    const issues: QualityIssue[] = [];
    const strengths: string[] = [];
    const timeline = state.timeline || [];
    
    const eventCount = timeline.length;
    
    // 检查事件数量
    if (eventCount < this.config.minTimelineEvents) {
      issues.push({
        id: `issue_${Date.now()}_timeline_cnt`,
        type: 'incomplete_timeline',
        dimension: 'timeline_coherence',
        severity: eventCount === 0 ? 'warning' : 'info',
        title: '时间线事件不足',
        description: `当前仅有 ${eventCount} 个事件，时间脉络不完整`,
        suggestion: '梳理事件发展脉络，补充关键时间节点',
        autoFixable: false,
        metrics: { eventCount, minRequired: this.config.minTimelineEvents },
      });
    } else if (eventCount >= 8) {
      strengths.push(`时间线完整 (${eventCount}个事件)`);
    }
    
    // 检查时间顺序
    if (eventCount >= 2) {
      const timestamps = timeline.map(e => new Date(e.timestamp || '').getTime()).filter(t => !isNaN(t));
      const isSorted = timestamps.every((t, i) => i === 0 || timestamps[i - 1] <= t);
      
      if (!isSorted) {
        issues.push({
          id: `issue_${Date.now()}_timeline_sort`,
          type: 'incomplete_timeline',
          dimension: 'timeline_coherence',
          severity: 'info',
          title: '时间线顺序不规范',
          description: '事件未按时间顺序排列',
          suggestion: '按时间顺序整理事件，便于理解发展脉络',
          autoFixable: true,
        });
      }
    }
    
    // 检查事件重要性标注
    const eventsWithSignificance = timeline.filter(e => e.significance).length;
    if (eventsWithSignificance < eventCount * 0.5 && eventCount > 0) {
      issues.push({
        id: `issue_${Date.now()}_timeline_sig`,
        type: 'incomplete_timeline',
        dimension: 'timeline_coherence',
        severity: 'info',
        title: '部分事件缺少重要性说明',
        description: `${eventCount - eventsWithSignificance} 个事件未标注重要性`,
        suggestion: '为每个事件添加重要性说明，突出关键节点',
        autoFixable: false,
        metrics: { withSignificance: eventsWithSignificance, total: eventCount },
      });
    } else if (eventsWithSignificance === eventCount && eventCount > 0) {
      strengths.push('所有事件均有重要性标注');
    }
    
    // 计算得分
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 15;
      else score -= 5;
    });
    score = Math.max(0, Math.min(100, score));
    
    return {
      dimension: 'timeline_coherence',
      score,
      weight: DIMENSION_WEIGHTS.timeline_coherence,
      issues,
      strengths,
    };
  }
  
  /**
   * 检测报告质量
   */
  private checkReportQuality(state: AnalysisStateType): DimensionScore {
    const issues: QualityIssue[] = [];
    const strengths: string[] = [];
    const report = state.finalReport || '';
    const confidence = this.calculateModelConfidence(state);
    
    const reportLength = report.length;
    
    // 检查报告长度
    if (reportLength < this.config.minReportLength) {
      issues.push({
        id: `issue_${Date.now()}_report_len`,
        type: 'short_report',
        dimension: 'report_quality',
        severity: 'warning',
        title: '分析报告内容简短',
        description: `报告仅 ${reportLength} 字，分析深度可能不足`,
        suggestion: '补充更详细的分析内容，包括数据支撑、逻辑推导等',
        autoFixable: false,
        metrics: { reportLength, minRequired: this.config.minReportLength },
      });
    } else if (reportLength >= 2000) {
      strengths.push(`报告详实 (${reportLength}字)`);
    }
    
    // 检查置信度
    if (confidence < this.config.minConfidence) {
      issues.push({
        id: `issue_${Date.now()}_confidence`,
        type: 'low_confidence',
        dimension: 'report_quality',
        severity: confidence < 0.4 ? 'critical' : 'warning',
        title: '分析置信度偏低',
        description: `当前置信度 ${(confidence * 100).toFixed(0)}%，结论可靠性有限`,
        suggestion: '增加信息源、深化因果分析，提高结论的可信度',
        autoFixable: false,
        metrics: { confidence, minRequired: this.config.minConfidence },
      });
    } else if (confidence >= 0.8) {
      strengths.push(`置信度高 (${(confidence * 100).toFixed(0)}%)`);
    }
    
    // 检查报告结构
    const hasSections = report.includes('##') || report.includes('**');
    if (!hasSections && reportLength > 500) {
      issues.push({
        id: `issue_${Date.now()}_report_struct`,
        type: 'short_report',
        dimension: 'report_quality',
        severity: 'info',
        title: '报告结构不清晰',
        description: '长报告缺少章节划分，阅读体验不佳',
        suggestion: '使用标题和分段组织报告结构',
        autoFixable: true,
      });
    } else if (hasSections) {
      strengths.push('报告结构清晰');
    }
    
    // 计算得分
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'warning') score -= 15;
      else score -= 5;
    });
    score = Math.max(0, Math.min(100, score));
    
    return {
      dimension: 'report_quality',
      score,
      weight: DIMENSION_WEIGHTS.report_quality,
      issues,
      strengths,
    };
  }
  
  /**
   * 计算综合评分
   */
  private calculateOverallScore(dimensionScores: DimensionScore[]): number {
    const totalWeight = dimensionScores.reduce((sum, ds) => sum + ds.weight, 0);
    const weightedSum = dimensionScores.reduce((sum, ds) => sum + ds.score * ds.weight, 0);
    return Math.round(weightedSum / totalWeight);
  }
  
  /**
   * 确定质量等级
   */
  private determineGrade(score: number): QualityReport['grade'] {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }
  
  /**
   * 生成改进优先级
   */
  private generateImprovementPriority(dimensionScores: DimensionScore[]): string[] {
    // 按得分排序，低分维度优先改进
    const sorted = [...dimensionScores].sort((a, b) => a.score - b.score);
    
    return sorted
      .filter(ds => ds.score < 80)
      .map(ds => {
        const criticalCount = ds.issues.filter(i => i.severity === 'critical').length;
        const warningCount = ds.issues.filter(i => i.severity === 'warning').length;
        
        if (criticalCount > 0) {
          return `【紧急】改进${DIMENSION_NAMES[ds.dimension]}：存在 ${criticalCount} 个严重问题`;
        } else if (warningCount > 0) {
          return `【重要】优化${DIMENSION_NAMES[ds.dimension]}：发现 ${warningCount} 个待改进项`;
        } else {
          return `【建议】提升${DIMENSION_NAMES[ds.dimension]}：当前得分 ${ds.score}分`;
        }
      });
  }
  
  /**
   * 计算模型置信度
   */
  private calculateModelConfidence(state: AnalysisStateType): number {
    const scenarios = state.scenarios || [];
    const searchResults = state.searchResults || [];
    
    const avgScenarioProb = scenarios.length > 0
      ? scenarios.reduce((sum, s) => sum + (s.probability || 0.33), 0) / scenarios.length
      : 0.5;
    const sourceBonus = Math.min(searchResults.length * 0.02, 0.1);
    
    return Math.min(0.95, avgScenarioProb * 0.5 + 0.4 + sourceBonus);
  }
  
  /**
   * 快速检测（仅返回关键指标，用于实时反馈）
   */
  async quickCheck(state: AnalysisStateType): Promise<{
    score: number;
    criticalIssueCount: number;
    warningIssueCount: number;
    topIssues: string[];
  }> {
    const report = await this.check(state);
    
    return {
      score: report.overallScore,
      criticalIssueCount: report.criticalIssues.length,
      warningIssueCount: report.issues.filter(i => i.severity === 'warning').length,
      topIssues: report.improvementPriority.slice(0, 3),
    };
  }
}

// 导出单例
export const qualityChecker = new QualityChecker();
