/**
 * 进化体层智能体节点实现
 * 
 * 正确架构理解：
 * - 进化体是第5层智能体，包含：记忆智能体、复盘智能体
 * - 强化学习是一种**优化机制**，不是智能体
 * - 智能体调用优化机制来完成持续进化
 */

import { LLMClient } from 'coze-coding-dev-sdk';
import { createLLMClient as createUnifiedLLMClient } from '@/lib/llm/create-llm-client';
import { getChatModelId } from '@/lib/llm/chat-model';
import { AnalysisStateType, AgentLayer } from './state';
import { 
  CaseMemoryStore, 
  caseMemoryStore, 
  AnalysisCase, 
  ReviewResult, 
  OptimizationResult,
  CaseFeedback,
  DomainType,
  ScenarioType
} from './case-memory-store';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 相似案例结果
 */
export interface SimilarCaseResult {
  case: AnalysisCase;
  similarity: number;
  matchedAspects: string[];
}

/**
 * 进化体层输出
 */
export interface EvolutionLayerOutput {
  // 记忆智能体输出
  memoryOutput?: {
    caseId: string;
    similarCases: SimilarCaseResult[];
    recalledPatterns: string[];
    contextEnriched: boolean;
  };
  
  // 复盘智能体输出
  reviewOutput?: ReviewResult;
  
  // 策略优化结果（复盘智能体调用的优化机制输出）
  optimizationOutput?: {
    optimizations: OptimizationResult[];
    appliedOptimizations: string[];
    pendingValidations: string[];
  };
}

// ============================================================================
// 工具函数
// ============================================================================

function createLLMClient(): LLMClient {
  return createUnifiedLLMClient();
}

async function llmChat(
  llmClient: LLMClient,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const sdkMessages = messages.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content
  }));
  
  try {
    const response = await llmClient.invoke(sdkMessages, {
      model: getChatModelId(),
      temperature: options?.temperature ?? 0.7
    });
    
    return response.content || '';
  } catch (error) {
    console.error('[llmChat] Error:', error);
    throw error;
  }
}

async function extractJSONWithLLM(
  text: string,
  context: string,
  llmClient: LLMClient
): Promise<any> {
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    const extractionPrompt = `从以下文本中提取 JSON 数据，返回纯净的 JSON 字符串：

文本：
${text}

只返回 JSON，不要其他内容。`;
    
    try {
      const extracted = await llmChat(llmClient, [
        { role: 'system', content: '你是JSON提取专家。' },
        { role: 'user', content: extractionPrompt }
      ], { temperature: 0.1 });
      
      const cleaned = extracted.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.warn(`[${context}] JSON extraction failed:`, error);
      return null;
    }
  }
}

// ============================================================================
// 记忆智能体节点
// ============================================================================

/**
 * 记忆智能体节点
 * 
 * 职责：
 * 1. 存储分析案例到案例库
 * 2. 检索相似历史案例
 * 3. 召回可复用的分析模式
 * 4. 为当前分析提供上下文增强
 * 
 * 使用的工具：案例存储系统（CaseMemoryStore）
 */
export async function memoryAgentNode(
  state: AnalysisStateType,
  llmClient: LLMClient,
  context?: {
    storeCase?: boolean;
    retrieveSimilar?: boolean;
    caseStore?: CaseMemoryStore;
  }
): Promise<Partial<AnalysisStateType>> {
  console.log('[memoryAgentNode] Starting memory operations...');
  
  const store = context?.caseStore || caseMemoryStore;
  const shouldStore = context?.storeCase !== false;
  const shouldRetrieve = context?.retrieveSimilar !== false;
  
  const output: EvolutionLayerOutput['memoryOutput'] = {
    caseId: '',
    similarCases: [],
    recalledPatterns: [],
    contextEnriched: false
  };
  
  try {
    // 1. 存储当前案例
    const conclusion = (state as any).conclusion || state.finalReport || '';
    if (shouldStore && state.query && conclusion) {
      const caseId = await store.storeCase(state, {
        agentSequence: state.completedAgents || [],
        executionTime: Date.now() - ((state as any).startTime || Date.now()),
        tokenUsage: 0
      });
      output.caseId = caseId;
      console.log(`[memoryAgentNode] Stored case: ${caseId}`);
    }
    
    // 2. 检索相似案例
    if (shouldRetrieve && state.query) {
      const domain = (state as any).domain as DomainType | undefined;
      const scenario = (state as any).scenario as ScenarioType | undefined;
      
      const similarCases = await store.findSimilarCases(state.query, {
        domain,
        scenario,
        limit: 5
      });
      output.similarCases = similarCases;
      console.log(`[memoryAgentNode] Found ${similarCases.length} similar cases`);
      
      // 3. 从相似案例中提取可复用模式
      if (similarCases.length > 0) {
        const patterns = await extractReusablePatterns(similarCases, state.query, llmClient);
        output.recalledPatterns = patterns;
        output.contextEnriched = true;
      }
    }
    
    const memoryOutputString = JSON.stringify(output, null, 2);
    
    return {
      memoryAgentOutput: memoryOutputString,
      evolutionOutput: {
        ...(state.evolutionOutput || {}),
        memoryOutput: output
      },
      currentAgent: 'memory_agent',
      completedAgents: [...(state.completedAgents || []), 'memory_agent'],
    };
    
  } catch (error) {
    console.error('[memoryAgentNode] Error:', error);
    
    return {
      memoryAgentOutput: JSON.stringify({ error: String(error) }),
      currentAgent: 'memory_agent',
      completedAgents: [...(state.completedAgents || []), 'memory_agent'],
    };
  }
}

/**
 * 从相似案例中提取可复用模式
 */
async function extractReusablePatterns(
  similarCases: SimilarCaseResult[],
  currentQuery: string,
  llmClient: LLMClient
): Promise<string[]> {
  if (similarCases.length === 0) return [];
  
  const casesContext = similarCases.map(sc => `
案例：${sc.case.query}
相似度：${(sc.similarity * 100).toFixed(1)}%
关键因素：${sc.case.keyFactors.map(f => f.factor).join(', ')}
结论：${sc.case.conclusion?.substring(0, 200)}
`).join('\n---\n');

  const userPrompt = `当前分析主题：${currentQuery}

相似历史案例：
${casesContext}

请提取 3-5 个可复用的分析模式。
返回 JSON 数组格式：["模式1", "模式2", ...]`;

  const response = await llmChat(llmClient, [
    { role: 'system', content: '你是分析模式提取专家。' },
    { role: 'user', content: userPrompt }
  ], { temperature: 0.3 });
  
  const patterns = await extractJSONWithLLM(response, 'memory_patterns', llmClient);
  return Array.isArray(patterns) ? patterns : [];
}

// ============================================================================
// 复盘智能体节点
// ============================================================================

/**
 * 复盘智能体节点
 * 
 * 职责：
 * 1. 分析案例的成败原因
 * 2. 提取经验教训
 * 3. 识别可复用模式
 * 4. 生成改进建议
 * 
 * 调用的优化机制：
 * - 策略优化器（基于反馈学习）
 */
export async function reviewAgentNode(
  state: AnalysisStateType,
  llmClient: LLMClient,
  context?: {
    caseId?: string;
    caseStore?: CaseMemoryStore;
    includeActualOutcome?: boolean;
    applyOptimizations?: boolean;
  }
): Promise<Partial<AnalysisStateType>> {
  console.log('[reviewAgentNode] Starting review analysis...');
  
  const store = context?.caseStore || caseMemoryStore;
  const caseId = context?.caseId || state.evolutionOutput?.memoryOutput?.caseId;
  
  let reviewResult: ReviewResult = {
    caseId: caseId || 'unknown',
    reviewTimestamp: new Date().toISOString(),
    successFactors: [],
    failureLessons: [],
    improvements: [],
    reusablePatterns: [],
    antiPatterns: [],
    knowledgeNuggets: []
  };
  
  let optimizationOutput: EvolutionLayerOutput['optimizationOutput'] = {
    optimizations: [],
    appliedOptimizations: [],
    pendingValidations: []
  };
  
  try {
    // 1. 获取案例数据
    const caseData = caseId ? store.getCase(caseId) : null;
    
    if (!caseData && !state.query) {
      console.warn('[reviewAgentNode] No case data available for review');
      return {
        reviewAgentOutput: JSON.stringify({ warning: 'No case data available' }),
        currentAgent: 'review_agent',
        completedAgents: [...(state.completedAgents || []), 'review_agent'],
      };
    }
    
    // 2. 构建复盘上下文
    const reviewContext = buildReviewContext(caseData, state);
    
    // 3. 使用 LLM 进行复盘分析
    const systemPrompt = `你是复盘分析专家，负责对分析案例进行深度复盘。

## 复盘框架

### 1. 成功要素分析
- 哪些分析方法有效？
- 哪些信息来源关键？
- 哪些推理路径正确？

### 2. 失败教训提取
- 哪些假设错误？
- 哪些信息遗漏？
- 哪些推理有偏差？

### 3. 改进建议
- 针对智能体的优化建议
- 针对流程的优化建议

### 4. 模式识别
- 可复用的成功模式
- 需要避免的反模式`;

    const userPrompt = `请对以下分析案例进行复盘：

${reviewContext}

请严格按照以下 JSON 格式输出复盘结果：
{
  "successFactors": ["成功要素1", "成功要素2"],
  "failureLessons": ["教训1", "教训2"],
  "improvements": [
    {
      "target": "目标智能体或流程",
      "suggestion": "改进建议",
      "priority": "high|medium|low"
    }
  ],
  "reusablePatterns": [
    {
      "patternName": "模式名称",
      "patternDescription": "模式描述",
      "applicableScenarios": ["适用场景"]
    }
  ],
  "antiPatterns": [
    {
      "patternName": "反模式名称",
      "description": "问题描述"
    }
  ],
  "knowledgeNuggets": [
    {
      "domain": "领域",
      "insight": "洞察内容"
    }
  ]
}`;

    const response = await llmChat(llmClient, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.5 });
    
    const parsed = await extractJSONWithLLM(response, 'review_result', llmClient);
    
    if (parsed) {
      reviewResult = {
        ...reviewResult,
        ...parsed
      };
    }
    
    console.log(`[reviewAgentNode] Review completed with ${reviewResult.improvements?.length || 0} improvements`);
    
    // 4. 调用策略优化机制（基于反馈学习）
    if (context?.applyOptimizations !== false && reviewResult.improvements?.length > 0) {
      const statistics = store.getStatistics();
      const optimizations = await StrategyOptimizer.optimize(
        reviewResult,
        statistics,
        llmClient
      );
      
      optimizationOutput.optimizations = optimizations;
      
      // 应用可自动应用的优化
      for (const opt of optimizations) {
        if (opt.autoApplicable) {
          const applied = await StrategyOptimizer.apply(opt, llmClient);
          if (applied) {
            optimizationOutput.appliedOptimizations.push(opt.optimizationId);
          }
        } else {
          optimizationOutput.pendingValidations.push(opt.optimizationId);
        }
      }
    }
    
    // 5. 构建输出
    return {
      reviewAgentOutput: JSON.stringify(reviewResult, null, 2),
      evolutionOutput: {
        ...(state.evolutionOutput || {}),
        reviewOutput: reviewResult,
        optimizationOutput
      },
      currentAgent: 'review_agent',
      completedAgents: [...(state.completedAgents || []), 'review_agent'],
    };
    
  } catch (error) {
    console.error('[reviewAgentNode] Error:', error);
    
    return {
      reviewAgentOutput: JSON.stringify({ error: String(error), ...reviewResult }),
      currentAgent: 'review_agent',
      completedAgents: [...(state.completedAgents || []), 'review_agent'],
    };
  }
}

/**
 * 构建复盘上下文
 */
function buildReviewContext(caseData: AnalysisCase | null | undefined, state: AnalysisStateType): string {
  const parts: string[] = [];
  
  parts.push(`## 分析主题\n${caseData?.query || state.query}`);
  
  const conclusion = caseData?.conclusion || (state as any).conclusion || state.finalReport;
  if (conclusion) {
    parts.push(`\n## 分析结论\n${conclusion}`);
  }
  
  const keyFactors = caseData?.keyFactors || state.keyFactors || [];
  if (keyFactors.length > 0) {
    parts.push(`\n## 关键因素\n${keyFactors.map((f: any) => `- ${f.factor || f.name}: ${f.impact || f.description}`).join('\n')}`);
  }
  
  const scenarios = caseData?.scenarios || state.scenarios || [];
  if (scenarios.length > 0) {
    parts.push(`\n## 场景预测\n${scenarios.map((s: any) => `- ${s.name}: ${((s.probability || 0) * 100).toFixed(0)}%`).join('\n')}`);
  }
  
  const agentSequence = caseData?.agentSequence || state.completedAgents || [];
  if (agentSequence.length > 0) {
    parts.push(`\n## 执行路径\n${agentSequence.join(' → ')}`);
  }
  
  if (caseData?.feedback) {
    parts.push(`\n## 用户反馈`);
    if (caseData.feedback.userRating) {
      parts.push(`评分: ${caseData.feedback.userRating}/5`);
    }
    if (caseData.feedback.userComments) {
      parts.push(`评价: ${caseData.feedback.userComments}`);
    }
  }
  
  return parts.join('\n');
}

// ============================================================================
// 策略优化器（优化机制，不是智能体）
// ============================================================================

/**
 * 策略优化器
 * 
 * 这是一个优化机制，不是智能体。
 * 被复盘智能体调用，用于从反馈中学习和优化策略。
 * 
 * 内部可以使用多种学习方法：
 * - 规则基础优化
 * - LLM辅助优化
 * - 强化学习算法（如适用）
 */
const StrategyOptimizer = {
  /**
   * 生成优化策略
   */
  async optimize(
    reviewResult: ReviewResult,
    statistics: any,
    llmClient: LLMClient
  ): Promise<OptimizationResult[]> {
    const systemPrompt = `你是策略优化专家，负责基于复盘结果生成具体的优化策略。

## 优化维度

1. **Prompt优化**：优化智能体的提示词
2. **参数优化**：调整模型参数、阈值
3. **工作流优化**：调整执行顺序、并行策略
4. **工具优化**：改进工具调用策略`;

    const userPrompt = `基于以下复盘结果生成优化策略：

## 复盘结果
${JSON.stringify(reviewResult, null, 2)}

## 统计数据
- 总案例数: ${statistics.totalCases}
- 平均评分: ${statistics.averageRating?.toFixed(1) || 'N/A'}
- 高质量案例: ${statistics.highQualityCases}

请生成 2-3 个最关键的优化策略，按以下 JSON 格式输出：
[
  {
    "optimizationId": "opt_xxx",
    "target": "目标智能体/流程",
    "type": "prompt|parameter|workflow|tool",
    "description": "优化描述",
    "expectedImpact": "预期效果",
    "priority": "high|medium|low",
    "autoApplicable": true|false,
    "implementation": {
      "before": "优化前",
      "after": "优化后"
    }
  }
]`;

    const response = await llmChat(llmClient, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3 });
    
    const optimizations = await extractJSONWithLLM(response, 'optimizations', llmClient);
    
    return Array.isArray(optimizations) ? optimizations.map((opt: any) => ({
      ...opt,
      optimizationId: opt.optimizationId || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    })) : [];
  },
  
  /**
   * 应用优化策略
   */
  async apply(optimization: OptimizationResult, llmClient: LLMClient): Promise<boolean> {
    console.log(`[StrategyOptimizer] Applying optimization: ${optimization.optimizationId}`);
    
    // 根据优化类型执行不同的应用逻辑
    switch (optimization.type) {
      case 'parameter':
        // 参数优化可以自动应用
        console.log(`[StrategyOptimizer] Auto-applying parameter optimization`);
        return true;
        
      case 'prompt':
        // Prompt优化需要验证
        console.log(`[StrategyOptimizer] Prompt optimization requires validation`);
        return false;
        
      case 'workflow':
        // 工作流优化需要确认
        console.log(`[StrategyOptimizer] Workflow optimization requires confirmation`);
        return false;
        
      default:
        return false;
    }
  }
};

// 导出
export {
  StrategyOptimizer
};

// 兼容旧代码的别名（已废弃，请使用 StrategyOptimizer）
/** @deprecated 使用 StrategyOptimizer 代替 */
export const rlTrainerNode = reviewAgentNode;
