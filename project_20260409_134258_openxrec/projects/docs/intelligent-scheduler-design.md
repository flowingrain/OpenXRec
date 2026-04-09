# 智能调度器设计文档

## 背景

原调度器（`LayerScheduler`）采用静态策略，无法根据任务动态调整执行计划。需要设计智能调度器实现真正的"按需调度"。

## 新旧对比

### 原调度器（LayerScheduler）

```
用户输入 → 判断复杂度 → 查表获取策略 → 按层级顺序执行
                ↓
        simple/moderate/complex
                ↓
        ┌──────────────────────┐
        │ EXECUTION_STRATEGIES │ ← 静态配置
        │ simple: 2层          │
        │ moderate: 4层        │
        │ complex: 5层         │
        └──────────────────────┘
```

**问题**：
1. 策略是静态预设的，无法根据任务内容动态调整
2. 只能"跳过"某些智能体，不能"增加"
3. 层级顺序固定，无法灵活组合
4. 无运行时调整能力

### 新调度器（IntelligentScheduler）

```
用户输入
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: 任务需求分析                                        │
│                                                             │
│   LLM 分析：这个任务需要哪些能力？                            │
│   输出：agentsToExecute, parallelGroups, reasoning          │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: 依赖图构建                                          │
│                                                             │
│   分析智能体间的数据依赖关系                                   │
│   输出：dependencyGraph { nodes, edges }                    │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: 执行计划生成                                        │
│                                                             │
│   拓扑排序 + 并行分组                                        │
│   输出：ExecutionPlan { stages, checkpoints }               │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: 执行 + 动态调整                                     │
│                                                             │
│   按阶段执行，在检查点判断是否需要调整                         │
│   可能调整：增加智能体、跳过智能体、提前终止                   │
└─────────────────────────────────────────────────────────────┘
```

## 核心能力

### 1. 任务需求分析

根据任务内容，动态决定需要哪些智能体：

```typescript
// 示例：分析"美联储降息对中国股市的影响"
{
  "agentsToExecute": [
    "intent_parser",     // 理解意图
    "scout_cluster",     // 搜索美联储政策、中国股市信息
    "analyst",           // 分析传导机制
    "cik_expert",        // 识别关键因素
    "simulation",        // 多场景推演
    "instruction_parser" // 生成报告
  ],
  "skippedAgents": [
    { "agentId": "geo_extractor", "reason": "不涉及地理信息" },
    { "agentId": "arbitrator", "reason": "无冲突信息" }
  ],
  "reasoning": "货币政策传导分析，需要因果推理和场景推演"
}
```

### 2. 依赖感知调度

自动识别依赖关系，最大化并行度：

```
Stage 1: [intent_parser]          ← 必须先执行
    ↓
Stage 2: [scout_cluster]          ← 等待 intent_parser
    ↓
Stage 3: [analyst, geo_extractor, alert_sentinel]  ← 三者并行（都依赖 scout_cluster）
    ↓
Stage 4: [cik_expert, validator]  ← 并行（都依赖 analyst）
    ↓
Stage 5: [simulation]             ← 等待 analyst, cik_expert
    ↓
Stage 6: [instruction_parser]
    ↓
Stage 7: [execution_monitor]
```

### 3. 动态调整

在检查点判断是否需要调整：

```
执行到 analyst 后检查：
- 发现信息不足 → 增加 scout_cluster 二次搜索
- 发现矛盾信息 → 增加 arbitrator
- 发现地理关联 → 增加 geo_extractor
- 因果链清晰 → 跳过 validator
```

### 4. 备选路径

预设备选执行路径：

```typescript
{
  "alternativePaths": [
    {
      "condition": "信息不足",
      "path": ["scout_cluster", "analyst"]
    },
    {
      "condition": "发现冲突信息",
      "path": ["validator", "arbitrator"]
    },
    {
      "condition": "结果质量低",
      "path": ["analyst", "simulation"]
    }
  ]
}
```

## 使用示例

```typescript
// 创建智能调度器
const scheduler = new IntelligentScheduler({
  llmClient,
  maxParallelism: 5,
  enableDynamicScheduling: true
});

// 注册智能体函数
scheduler.registerNodeFunction('scout_cluster', scoutClusterNode);
scheduler.registerNodeFunction('analyst', analystNode);
// ... 注册其他智能体

// 执行
const result = await scheduler.execute(initialState, {
  onStageStart: (stage) => console.log(`开始阶段: ${stage.agents}`),
  onAgentStart: (agentId) => console.log(`启动: ${agentId}`),
  onAgentComplete: (agentId, result) => console.log(`完成: ${agentId}`),
  onPlanAdjust: (reason) => console.log(`调整计划: ${reason}`)
});
```

## 与原调度器共存

两套调度器可以并存：

| 场景 | 使用调度器 |
|------|-----------|
| 简单查询、快速响应 | LayerScheduler（静态策略） |
| 复杂分析、需要深度调度 | IntelligentScheduler |
| 用户指定执行路径 | LayerScheduler（自定义策略） |
| 学习模式、探索模式 | IntelligentScheduler |

## 实现状态

| 功能 | 状态 |
|------|------|
| 任务需求分析 | ✅ 已实现 |
| 依赖图构建 | ✅ 已实现 |
| 执行计划生成 | ✅ 已实现 |
| 动态调整 | ✅ 已实现（框架） |
| 与智能体工厂集成 | 📝 待集成 |
| 与前端集成 | 📝 待集成 |
