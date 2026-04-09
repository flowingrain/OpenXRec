/**
 * 调度器集成示例 - 推荐系统
 * 
 * 展示如何将调度器集成到推荐系统中
 */

import {
  createScheduler,
  Task,
  TaskType,
  TaskPriority,
  TaskStatus,
  SchedulerEvent,
  AgentScheduler,
} from './index';

/**
 * 推荐系统任务执行器
 */
export function createRecommendationTaskExecutor(
  llmClient: any,
  knowledgeManager: any
) {
  return async function executeRecommendationTask(task: Task, agentId: string): Promise<any> {
    console.log(`[TaskExecutor] Executing task ${task.id} (${task.type}) on agent ${agentId}`);
    
    const { type, payload } = task;
    
    switch (type) {
      case 'intent_analysis':
        return executeIntentAnalysis(payload, llmClient);
      
      case 'candidate_generation':
        return executeCandidateGeneration(payload, knowledgeManager);
      
      case 'feature_extraction':
        return executeFeatureExtraction(payload);
      
      case 'similarity_calculation':
        return executeSimilarityCalculation(payload);
      
      case 'causal_reasoning':
        return executeCausalReasoning(payload, llmClient);
      
      case 'kg_reasoning':
        return executeKGReasoning(payload, knowledgeManager);
      
      case 'ranking':
        return executeRanking(payload);
      
      case 'explanation':
        return executeExplanation(payload, llmClient);
      
      case 'diversity_optimize':
        return executeDiversityOptimize(payload);
      
      default:
        return { status: 'unknown_task_type', taskType: type };
    }
  };
}

// ==================== 各任务执行器实现 ====================

/**
 * 意图分析
 */
async function executeIntentAnalysis(payload: any, llmClient: any): Promise<any> {
  const { query } = payload;
  
  // 使用LLM分析意图
  const response = await llmClient.invoke([
    { role: 'user', content: `分析用户查询意图：${query}` }
  ], { model: 'doubao-seed-2-0-mini-260215', temperature: 0.3 });
  
  return {
    query,
    intent: response.content,
    timestamp: Date.now(),
  };
}

/**
 * 候选生成
 */
async function executeCandidateGeneration(payload: any, knowledgeManager: any): Promise<any> {
  const { query } = payload;
  
  // 从知识库检索候选
  const candidates = await knowledgeManager.search(query, { limit: 10 });
  
  return {
    candidates,
    count: candidates.length,
    timestamp: Date.now(),
  };
}

/**
 * 特征提取
 */
async function executeFeatureExtraction(payload: any): Promise<any> {
  const { candidates } = payload;
  
  // 提取特征
  const features = candidates?.map((c: any) => ({
    id: c.id,
    features: {
      category: c.category,
      price: c.price,
      rating: c.rating,
    }
  })) || [];
  
  return {
    features,
    count: features.length,
    timestamp: Date.now(),
  };
}

/**
 * 相似度计算
 */
async function executeSimilarityCalculation(payload: any): Promise<any> {
  const { userProfile, candidates } = payload;
  
  // 计算相似度
  const similarities = candidates?.map((c: any) => ({
    id: c.id,
    score: Math.random(), // 模拟相似度
  })) || [];
  
  return {
    similarities,
    timestamp: Date.now(),
  };
}

/**
 * 因果推理
 */
async function executeCausalReasoning(payload: any, llmClient: any): Promise<any> {
  const { query } = payload;
  
  const response = await llmClient.invoke([
    { role: 'user', content: `分析因果关系：${query}` }
  ], { model: 'doubao-seed-2-0-mini-260215', temperature: 0.3 });
  
  return {
    causalChain: response.content,
    timestamp: Date.now(),
  };
}

/**
 * 知识图谱推理
 */
async function executeKGReasoning(payload: any, knowledgeManager: any): Promise<any> {
  const { entities } = payload;
  
  // 知识图谱推理
  const reasoning = await knowledgeManager.getRelations(entities);
  
  return {
    relations: reasoning,
    timestamp: Date.now(),
  };
}

/**
 * 排序
 */
async function executeRanking(payload: any): Promise<any> {
  const { similarities, causalChain } = payload;
  
  // 综合排序
  const ranked = similarities
    ?.sort((a: any, b: any) => b.score - a.score)
    .map((item: any, index: number) => ({
      ...item,
      rank: index + 1,
    })) || [];
  
  return {
    ranking: ranked,
    count: ranked.length,
    timestamp: Date.now(),
  };
}

/**
 * 解释生成
 */
async function executeExplanation(payload: any, llmClient: any): Promise<any> {
  const { query, recommendation } = payload;
  
  const response = await llmClient.invoke([
    { role: 'user', content: `为推荐结果生成解释：${JSON.stringify(recommendation)}` }
  ], { model: 'doubao-seed-2-0-mini-260215', temperature: 0.3 });
  
  return {
    explanation: response.content,
    timestamp: Date.now(),
  };
}

/**
 * 多样性优化
 */
async function executeDiversityOptimize(payload: any): Promise<any> {
  const { recommendations } = payload;
  
  // 优化多样性
  const optimized = recommendations?.map((r: any) => ({
    ...r,
    diversityScore: Math.random(),
  })) || [];
  
  return {
    optimized,
    timestamp: Date.now(),
  };
}

// ==================== 使用示例 ====================

/**
 * 创建推荐调度器
 */
export function createRecommendationScheduler(llmClient: any, knowledgeManager: any) {
  // 创建任务执行器
  const taskExecutor = createRecommendationTaskExecutor(llmClient, knowledgeManager);
  
  // 创建调度器
  const scheduler = createScheduler({
    maxQueueSize: 1000,
    defaultStrategy: 'hybrid',
    enableMetrics: true,
    metricsInterval: 10000,
  }, taskExecutor);
  
  return scheduler;
}

/**
 * 事件监听器工厂
 */
export function createSchedulerEventListeners() {
  return {
    onEnqueued: (callback: (task: Task) => void) => {
      return (event: SchedulerEvent) => {
        if (event.type === 'task:enqueued') {
          callback(event.data?.task);
        }
      };
    },
    
    onDispatched: (callback: (taskId: string, agentId: string) => void) => {
      return (event: SchedulerEvent) => {
        if (event.type === 'task:dispatched') {
          callback(event.taskId!, event.agentId!);
        }
      };
    },
    
    onCompleted: (callback: (taskId: string, result: any) => void) => {
      return (event: SchedulerEvent) => {
        if (event.type === 'task:completed') {
          callback(event.taskId!, event.data?.result);
        }
      };
    },
    
    onFailed: (callback: (taskId: string, error: string) => void) => {
      return (event: SchedulerEvent) => {
        if (event.type === 'task:failed') {
          callback(event.taskId!, event.data?.error);
        }
      };
    },
  };
}

/**
 * 创建推荐工作流并执行
 */
export async function runRecommendationWorkflow(
  scheduler: AgentScheduler,
  userId: string,
  query: string
): Promise<{ requestId: string; workflow: any }> {
  // 创建工作流
  const requestId = scheduler.createRecommendationWorkflow(userId, query);
  
  // 启动调度器（如果未启动）
  scheduler.start();
  
  // 等待工作流完成
  const maxWaitTime = 60000; // 60秒超时
  const startTime = Date.now();
  
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      const metrics = scheduler.getMetrics();
      const completedTasks = metrics.tasksByStatus[TaskStatus.COMPLETED];
      
      // 简单检查：等待一段时间后认为完成
      if (Date.now() - startTime > maxWaitTime || completedTasks >= 8) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });
  
  // 获取结果
  const context = scheduler.getContext();
  
  return {
    requestId,
    workflow: {
      context,
      metrics: scheduler.getMetrics(),
    },
  };
}
