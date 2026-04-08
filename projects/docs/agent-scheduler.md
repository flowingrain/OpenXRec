# 智能体调度器 (Agent Scheduler)

## 概述

智能体调度器是 OpenXRec 推荐系统的核心组件，负责协调多个智能体的任务执行。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     AgentScheduler                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ TaskQueue   │  │ AgentPool   │  │ SchedulerDecisionMaker│  │
│  │  - 入队     │  │  - 注册     │  │  - 优先级调度       │  │
│  │  - 出队     │  │  - 状态     │  │  - 能力匹配         │  │
│  │  - 依赖管理 │  │  - 负载均衡 │  │  - 负载均衡         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      推荐智能体池                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ IntentAgent  │ │ RankingAgent │ │ExplanationAgent│     │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ CausalAgent  │ │ KGAgent      │ │ DiversityAgent│       │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. TaskQueue (任务队列)

```typescript
interface TaskQueue {
  enqueue(options: TaskOptions): Task;
  dequeue(): Task | null;
  get(taskId: string): Task | undefined;
  getExecutableTasks(): Task[];
  cancel(taskId: string): boolean;
}
```

**功能**:
- 任务优先级管理
- 依赖关系追踪
- 状态流转控制
- 超时检测

### 2. AgentPool (智能体池)

```typescript
interface AgentPool {
  register(agent: Agent): Agent;
  getAvailableAgents(capabilities: Capability[]): Agent[];
  assignTask(agentId: string, taskId: string): void;
  completeTask(agentId: string, success: boolean): void;
}
```

**预定义智能体**:
- Intent Analyzer Agent (意图分析)
- Candidate Generator Agent (候选生成)
- Feature Extractor Agent (特征提取)
- Similarity Calculator Agent (相似度计算)
- Causal Reasoning Agent (因果推理)
- Knowledge Graph Agent (知识图谱推理)
- Ranking Agent (排序决策)
- Explanation Agent (解释生成)
- Diversity Optimizer Agent (多样性优化)
- Config Optimizer Agent (配置优化)

### 3. SchedulingStrategy (调度策略)

| 策略 | 说明 |
|------|------|
| `priority` | 基于任务优先级分配 |
| `capability_match` | 基于能力匹配度分配 |
| `load_balance` | 基于负载均衡分配 |
| `dependency_based` | 基于依赖历史分配 |
| `hybrid` | 综合多种策略（默认） |

## 文件结构

```
src/lib/scheduler/
├── types.ts                    # 类型定义
├── task-queue.ts               # 任务队列实现
├── agent-pool.ts               # 智能体池实现
├── strategy.ts                 # 调度策略引擎
├── scheduler.ts                # 主调度器
├── index.ts                    # 模块导出
└── recommendation-integration.ts # 推荐系统集成示例
```

## 使用示例

### 基础用法

```typescript
import { createScheduler } from '@/lib/scheduler';

// 创建调度器
const scheduler = createScheduler({
  maxQueueSize: 1000,
  defaultStrategy: 'hybrid',
  enableMetrics: true,
});

// 启动调度器
scheduler.start();

// 入队任务
const task = scheduler.enqueue({
  type: 'intent_analysis',
  priority: TaskPriority.HIGH,
  payload: { query: '推荐系统学习资料' },
});

// 监听事件
scheduler.on('task:completed', (event) => {
  console.log('Task completed:', event.taskId);
});

// 获取指标
const metrics = scheduler.getMetrics();
```

### 创建推荐工作流

```typescript
import { createRecommendationScheduler } from '@/lib/scheduler/recommendation-integration';

// 创建推荐调度器
const scheduler = createRecommendationScheduler(llmClient, knowledgeManager);

// 创建工作流
const requestId = scheduler.createRecommendationWorkflow(
  'user_123',
  '推荐系统学习资料'
);

// 等待完成
const result = await runRecommendationWorkflow(scheduler, 'user_123', '推荐系统学习资料');
```

## 调度流程

```
1. 任务入队 (enqueue)
       ↓
2. 任务状态: PENDING → QUEUED
       ↓
3. 检查依赖是否满足
       ↓ (满足)
4. 调度决策 (selectAgent)
       ↓
5. 任务分配 (assignTask)
       ↓
6. 任务状态: ASSIGNED → RUNNING
       ↓
7. 执行任务 (executeTask)
       ↓
8. 任务状态: COMPLETED / FAILED
       ↓
9. 触发事件 (emit)
```

## 事件类型

| 事件 | 说明 |
|------|------|
| `task:enqueued` | 任务入队 |
| `task:dispatched` | 任务分配 |
| `task:started` | 任务开始执行 |
| `task:completed` | 任务完成 |
| `task:failed` | 任务失败 |
| `task:cancelled` | 任务取消 |
| `agent:registered` | 智能体注册 |
| `agent:unregistered` | 智能体注销 |
| `scheduler:error` | 调度器错误 |

## 指标收集

```typescript
interface SchedulerMetrics {
  totalTasksProcessed: number;      // 总处理任务数
  tasksByStatus: Record<TaskStatus, number>;  // 各状态任务数
  tasksByType: Record<TaskType, number>;      // 各类型任务数
  avgQueueWaitTime: number;         // 平均等待时间
  avgExecutionTime: number;          // 平均执行时间
  agentUtilization: number;          // 智能体利用率
  successRate: number;              // 成功率
  throughput: number;                // 吞吐量
}
```

## 配置选项

```typescript
interface SchedulerConfig {
  maxQueueSize: number;              // 最大队列大小
  taskTimeout: number;               // 任务超时时间
  defaultMaxRetries: number;         // 默认最大重试次数
  minAgents: number;                 // 最小智能体数
  maxAgents: number;                 // 最大智能体数
  agentIdleTimeout: number;          // 智能体空闲超时
  defaultStrategy: SchedulingStrategy; // 默认调度策略
  enableDependencyScheduling: boolean; // 启用依赖调度
  enableLoadBalancing: boolean;       // 启用负载均衡
  enableMetrics: boolean;             // 启用指标收集
  metricsInterval: number;            // 指标收集间隔
}
```
