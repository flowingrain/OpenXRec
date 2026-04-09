# 五层混合架构设计文档

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           态势感知分析平台                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        调度层（独立协调器）                            │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ 意图解析器 (intent_parser)                                       │ │ │
│  │  │ - 理解用户意图                                                   │ │ │
│  │  │ - 判断任务复杂度                                                 │ │ │
│  │  │ - 确定执行策略                                                   │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    ↓                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 感知体   │  │ 认知体   │  │ 决策体   │  │ 行动体   │  │ 进化体   │     │
│  │Perception│→ │Cognition │→ │ Decision │→ │ Action   │→ │ Evolution│     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│       ↓             ↓             ↓             ↓             ↓            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         分层调度器 (Layer Scheduler)                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        智能底座 (Intelligent Base)                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ 指挥中枢    │  │ 模型库      │  │ 知识库      │                  │   │
│  │  │ - 指挥官    │  │ - 因果推理  │  │ - 因果模式  │                  │   │
│  │  │ - 黑板系统  │  │ - 风险传导库│  │ - FEMA库    │                  │   │
│  │  │ - 事件总线  │  │ - 风险指纹  │  │             │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        外部服务 (External Services)                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ LLM服务     │  │ 搜索服务    │  │ 向量存储    │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 二、智能体架构设计

### 2.1 设计原则

| 原则 | 说明 |
|-----|------|
| **职责单一** | 每个智能体只负责一个明确的功能 |
| **链路完整** | 每层都有完整的执行链路，确保环节无缺失 |
| **避免重叠** | 智能体之间职责边界清晰，无功能重叠 |
| **无兼容设计** | 不保留历史兼容ID，架构清晰简洁 |

### 2.2 智能体总览（共18个）

```
┌─────────────────────────────────────────────────────────────┐
│                      调度层（独立协调器）                    │
│           意图解析器：理解意图、判断复杂度、确定执行策略      │
│           注：任务调度由 LangGraph 框架和 LayerScheduler 负责 │
└─────────────────────────────────────────────────────────────┘
                              ↓ 调度
┌─────────────────────────────────────────────────────────────┐
│                      五类智能体（共18个）                    │
├─────────────────────────────────────────────────────────────┤
│ 感知体（4个）：侦察兵集群、事件抽取器、质量评估器、地理抽取器│
│ 认知体（4个）：时序分析师、因果分析师、知识抽取器、结果验证器│
│ 决策体（3个）：场景推演器、敏感性分析师、行动建议器          │
│ 行动体（4个）：报告生成器、文档执行器、质量控制器、执行监控器│
│ 进化体（2个）：知识管理器、复盘分析师                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 各层智能体详细设计

#### 调度层 (Scheduler)

| ID | 名称 | 职责 |
|----|------|------|
| `intent_parser` | 意图解析器 | 理解用户意图、判断任务复杂度、确定执行策略 |

**特点**：独立于五类智能体，是"指挥官"角色

#### 感知体层 (Perception) - 完整链路：采集 → 抽取 → 评估

| ID | 名称 | 职责 |
|----|------|------|
| `scout_cluster` | 侦察兵集群 | 多源信息采集、实时数据抓取 |
| `event_extractor` | 事件抽取器 | 从非结构化文本中抽取结构化事件 |
| `quality_evaluator` | 质量评估器 | 信息可信度评估、来源可靠性分析 |
| `geo_extractor` | 地理抽取器 | 地理位置抽取、空间关系分析 |

**数据流**：
```
用户查询 → scout_cluster(搜索) → event_extractor(抽取) → quality_evaluator(评估)
                                    ↓
                              geo_extractor(地理)
```

#### 认知体层 (Cognition) - 完整链路：时序 → 因果 → 知识 → 验证

| ID | 名称 | 职责 |
|----|------|------|
| `timeline_analyst` | 时序分析师 | 事件时间线构建、发展脉络梳理 |
| `causal_analyst` | 因果分析师 | 因果链识别、风险传导路径分析 |
| `knowledge_extractor` | 知识抽取器 | 关键因素识别、领域知识提取 |
| `result_validator` | 结果验证器 | 分析结果验证、逻辑一致性检查 |

**数据流**：
```
searchResults → timeline_analyst(时序) → causal_analyst(因果) → knowledge_extractor(知识)
                                              ↓
                                       result_validator(验证)
```

**设计决策**：
- 原来的"分析师"拆分为"时序分析师"和"因果分析师"，职责单一化
- 原来的"验证者"和"仲裁者"合并为"结果验证器"，避免功能重叠

#### 决策体层 (Decision) - 完整链路：推演 → 分析 → 建议

| ID | 名称 | 职责 |
|----|------|------|
| `scenario_simulator` | 场景推演器 | 多场景模拟、概率预测、路径规划 |
| `sensitivity_analyst` | 敏感性分析师 | 关键变量敏感性、脆弱点识别 |
| `action_advisor` | 行动建议器 | 基于分析结果的策略建议 |

**数据流**：
```
validationResults → scenario_simulator(推演) → sensitivity_analyst(分析)
                                                 ↓
                                          action_advisor(建议)
```

**设计决策**：
- 移除冗余的"战略规划器"，场景推演器已覆盖此职责
- 敏感性分析独立为"敏感性分析师"，职责更明确

#### 行动体层 (Action) - 完整链路：生成 → 执行 → 控制 → 监控

| ID | 名称 | 职责 |
|----|------|------|
| `report_generator` | 报告生成器 | 生成结构化报告和分析文档 |
| `document_executor` | 文档执行器 | 写入存储（对象存储/数据库） |
| `quality_controller` | 质量控制器 | 风险边界控制、合规性检查、异常拦截 |
| `execution_monitor` | 执行监控器 | 执行状态监控、完整性检查 |

**数据流**：
```
actionAdvice → report_generator(生成) → document_executor(执行)
                                              ↓
             quality_controller(控制) ←────────┘
                                              ↓
                                      execution_monitor(监控)
```

**设计决策**：
- 新增"文档执行器"，实现真正的存储执行动作
- 原来的"红线控制"重命名为"质量控制器"，职责更清晰

#### 进化体层 (Evolution) - 完整链路：存储 → 检索 → 复盘

| ID | 名称 | 职责 |
|----|------|------|
| `knowledge_manager` | 知识管理器 | 知识图谱维护、案例存储检索 |
| `review_analyst` | 复盘分析师 | 分析成败原因、提取经验教训 |

**数据流**：
```
executionResult → knowledge_manager(存储/检索) → review_analyst(复盘)
```

**设计决策**：
- 原来的"记忆智能体"重命名为"知识管理器"，更准确反映职责
- 移除"策略优化器"，优化机制由复盘分析师触发

## 三、分层调度器 (Layer Scheduler)

### 3.1 调度原则

| 原则 | 说明 |
|-----|------|
| **层级顺序** | 调度层 → 感知体 → 认知体 → 决策体 → 行动体 → 进化体 |
| **层内并行** | 同一层级的智能体可并行执行 |
| **动态跳过** | 根据任务复杂度和中间结果跳过不必要的智能体 |
| **循环修正** | 质量检查未通过时，返回指定层级重新执行 |
| **反馈驱动** | 用户反馈可触发特定层级的重新执行 |

### 3.2 调度流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     分层调度流程                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 调度层 (Scheduler)                                        │  │
│  │                                                          │  │
│  │  ┌─────────────┐                                         │  │
│  │  │ 意图解析器  │ ─→ 理解意图、判断复杂度、确定策略        │  │
│  │  └─────────────┘                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 第1层：感知体 (Perception)                                │  │
│  │                                                          │  │
│  │  ┌─────────────┐                                         │  │
│  │  │ 侦察兵集群  │ ─→ 多源信息采集                          │  │
│  │  └─────────────┘                                         │  │
│  │         ↓                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │ 事件抽取器  │  │ 质量评估器  │  │ 地理抽取器  │ 并行  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 第2层：认知体 (Cognition)                                │  │
│  │                                                          │  │
│  │  ┌─────────────┐                                         │  │
│  │  │ 时序分析师  │ ─→ 构建时间线、梳理脉络                  │  │
│  │  └─────────────┘                                         │  │
│  │         ↓                                                │  │
│  │  ┌─────────────┐                                         │  │
│  │  │ 因果分析师  │ ─→ 识别因果链、分析风险传导              │  │
│  │  └─────────────┘                                         │  │
│  │         ↓                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐                       │  │
│  │  │ 知识抽取器  │  │ 结果验证器  │ 并行                   │  │
│  │  └─────────────┘  └─────────────┘                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 第3层：决策体 (Decision)                                 │  │
│  │                                                          │  │
│  │  ┌─────────────┐                                         │  │
│  │  │ 场景推演器  │ ─→ 多场景概率预测                        │  │
│  │  └─────────────┘                                         │  │
│  │         ↓                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐                       │  │
│  │  │敏感性分析师 │  │ 行动建议器  │ 并行                   │  │
│  │  └─────────────┘  └─────────────┘                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 第4层：行动体 (Action)                                   │  │
│  │                                                          │  │
│  │  ┌─────────────┐                                         │  │
│  │  │ 报告生成器  │ ─→ 生成结构化报告                        │  │
│  │  └─────────────┘                                         │  │
│  │         ↓                                                │  │
│  │  ┌─────────────┐                                         │  │
│  │  │ 文档执行器  │ ─→ 写入存储                              │  │
│  │  └─────────────┘                                         │  │
│  │         ↓                                                │  │
│  │  ┌─────────────┐  ┌─────────────┐                       │  │
│  │  │ 质量控制器  │  │ 执行监控器  │ 并行                   │  │
│  │  └─────────────┘  └─────────────┘                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                     │
│                    ┌───────────┐                              │
│                    │ 通过检查? │                              │
│                    └───────────┘                              │
│                      ↓       ↓                                │
│                    否        是                                │
│                     ↓         ↓                               │
│            ┌────────────┐  ┌──────────────────────────────┐  │
│            │ 循环修正    │  │ 第5层：进化体 (Evolution)    │  │
│            │ 返回指定层  │  │                              │  │
│            └────────────┘  │  ┌─────────────┐             │  │
│                            │  │ 知识管理器  │ ─→ 存储/检索 │  │
│                            │  └─────────────┘             │  │
│                            │         ↓                    │  │
│                            │  ┌─────────────┐             │  │
│                            │  │ 复盘分析师  │ ─→ 经验总结  │  │
│                            │  └─────────────┘             │  │
│                            └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 动态调度策略

```typescript
// 任务复杂度 → 执行策略映射
const EXECUTION_STRATEGIES: Record<TaskComplexity, ExecutionStrategy> = {
  // 简单任务：跳过深度分析
  simple: {
    layers: ['scheduler', 'perception', 'action'],
    skipAgents: ['sensitivity_analyst', 'result_validator', 'geo_extractor'],
    parallelWithinLayer: true,
    maxIterations: 1
  },
  
  // 中等任务：标准流程
  moderate: {
    layers: ['scheduler', 'perception', 'cognition', 'decision', 'action'],
    skipAgents: ['geo_extractor'],
    parallelWithinLayer: true,
    maxIterations: 2
  },
  
  // 复杂任务：完整流程 + 进化
  complex: {
    layers: ['scheduler', 'perception', 'cognition', 'decision', 'action', 'evolution'],
    skipAgents: [],
    parallelWithinLayer: true,
    maxIterations: 3
  }
};
```

## 四、智能体能力配置

### 4.1 能力注册表

```typescript
interface AgentCapability {
  id: string;              // 智能体ID
  layer: AgentLayer;       // 所属层级
  capabilities: string[];  // 能力标签
  dependencies: string[];  // 依赖的其他智能体
  inputSchema: any;        // 输入数据结构
  outputSchema: any;       // 输出数据结构
}
```

### 4.2 各层智能体能力定义

```typescript
// 调度层
const LAYER_AGENTS = {
  scheduler: [
    {
      id: 'intent_parser',
      layer: 'scheduler',
      capabilities: ['intent_understanding', 'complexity_judgment', 'scheduling'],
      dependencies: [],
      inputSchema: { query: 'string' },
      outputSchema: { taskComplexity: 'TaskComplexity', skipDecision: 'SkipDecision' }
    }
  ],
  
  // 感知体层
  perception: [
    {
      id: 'scout_cluster',
      layer: 'perception',
      capabilities: ['search', 'data_collection'],
      dependencies: [],
      inputSchema: { query: 'string' },
      outputSchema: { searchResults: 'SearchItem[]' }
    },
    {
      id: 'event_extractor',
      layer: 'perception',
      capabilities: ['event_extraction', 'structuration'],
      dependencies: ['scout_cluster'],
      inputSchema: { searchResults: 'SearchItem[]' },
      outputSchema: { extractedEvents: 'ExtractedEvent[]' }
    },
    {
      id: 'quality_evaluator',
      layer: 'perception',
      capabilities: ['quality_assessment', 'source_evaluation'],
      dependencies: ['scout_cluster'],
      inputSchema: { searchResults: 'SearchItem[]' },
      outputSchema: { qualityScore: 'number', reliabilityAnalysis: 'string' }
    },
    {
      id: 'geo_extractor',
      layer: 'perception',
      capabilities: ['geo_extraction', 'spatial_analysis'],
      dependencies: ['scout_cluster'],
      inputSchema: { searchResults: 'SearchItem[]' },
      outputSchema: { geoLocations: 'GeoLocation[]' }
    }
  ],
  
  // 认知体层
  cognition: [
    {
      id: 'timeline_analyst',
      layer: 'cognition',
      capabilities: ['timeline_construction', 'event_sequence'],
      dependencies: ['scout_cluster'],
      inputSchema: { searchResults: 'SearchItem[]' },
      outputSchema: { timeline: 'TimelineEvent[]' }
    },
    {
      id: 'causal_analyst',
      layer: 'cognition',
      capabilities: ['causal_analysis', 'risk_propagation'],
      dependencies: ['timeline_analyst'],
      inputSchema: { timeline: 'TimelineEvent[]' },
      outputSchema: { causalChain: 'CausalChainNode[]' }
    },
    {
      id: 'knowledge_extractor',
      layer: 'cognition',
      capabilities: ['domain_knowledge', 'key_factors_analysis'],
      dependencies: ['causal_analyst'],
      inputSchema: { causalChain: 'CausalChainNode[]' },
      outputSchema: { keyFactors: 'KeyFactor[]' }
    },
    {
      id: 'result_validator',
      layer: 'cognition',
      capabilities: ['fact_check', 'logic_validation', 'conflict_resolution'],
      dependencies: ['causal_analyst', 'knowledge_extractor'],
      inputSchema: { causalChain: 'CausalChainNode[]', keyFactors: 'KeyFactor[]' },
      outputSchema: { validationResults: 'any' }
    }
  ],
  
  // 决策体层
  decision: [
    {
      id: 'scenario_simulator',
      layer: 'decision',
      capabilities: ['scenario_simulation', 'probability_prediction', 'china_market_impact'],
      dependencies: ['result_validator'],
      inputSchema: { validationResults: 'any' },
      outputSchema: { scenarios: 'ScenarioNode[]' }
    },
    {
      id: 'sensitivity_analyst',
      layer: 'decision',
      capabilities: ['sensitivity_analysis', 'vulnerability_identification'],
      dependencies: ['scenario_simulator'],
      inputSchema: { scenarios: 'ScenarioNode[]' },
      outputSchema: { sensitivityAnalysis: 'SensitivityAnalysis' }
    },
    {
      id: 'action_advisor',
      layer: 'decision',
      capabilities: ['action_recommendation', 'decision_support'],
      dependencies: ['scenario_simulator', 'sensitivity_analyst'],
      inputSchema: { scenarios: 'ScenarioNode[]', sensitivityAnalysis: 'SensitivityAnalysis' },
      outputSchema: { actionAdvice: 'ActionAdvice' }
    }
  ],
  
  // 行动体层
  action: [
    {
      id: 'report_generator',
      layer: 'action',
      capabilities: ['report_generation', 'result_structuring'],
      dependencies: ['action_advisor'],
      inputSchema: { actionAdvice: 'ActionAdvice' },
      outputSchema: { finalReport: 'string' }
    },
    {
      id: 'document_executor',
      layer: 'action',
      capabilities: ['document_storage', 'persistence'],
      dependencies: ['report_generator'],
      inputSchema: { finalReport: 'string' },
      outputSchema: { documentStored: 'boolean', storagePath: 'string' }
    },
    {
      id: 'quality_controller',
      layer: 'action',
      capabilities: ['risk_boundary_control', 'compliance_check', 'exception_interception'],
      dependencies: [],
      inputSchema: {},
      outputSchema: { riskControl: 'any' }
    },
    {
      id: 'execution_monitor',
      layer: 'action',
      capabilities: ['quality_audit', 'completeness_check'],
      dependencies: ['document_executor'],
      inputSchema: { documentStored: 'boolean' },
      outputSchema: { qualityCheck: 'any' }
    }
  ],
  
  // 进化体层
  evolution: [
    {
      id: 'knowledge_manager',
      layer: 'evolution',
      capabilities: ['knowledge_storage', 'case_retrieval', 'context_recall'],
      dependencies: ['execution_monitor'],
      inputSchema: {},
      outputSchema: { knowledgeStored: 'boolean' }
    },
    {
      id: 'review_analyst',
      layer: 'evolution',
      capabilities: ['result_reflection', 'experience_summary'],
      dependencies: ['knowledge_manager'],
      inputSchema: {},
      outputSchema: { reviewResults: 'any' }
    }
  ]
};
```

## 五、数据流转

```
┌─────────────────────────────────────────────────────────────────┐
│                        数据流转示意                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户输入                                                       │
│     │                                                          │
│     ▼                                                          │
│  ┌─────────────┐                                               │
│  │ 调度层      │                                               │
│  │ - 意图解析  │                                               │
│  │ - 复杂度    │                                               │
│  │   评估      │                                               │
│  └─────────────┘                                               │
│     │                                                          │
│     ▼  state = { query, taskComplexity, executionStrategy }     │
│  ┌─────────────┐                                               │
│  │ 感知体层    │                                               │
│  │ - 搜索结果  │ ─→ state.searchResults                        │
│  │ - 抽取事件  │ ─→ state.extractedEvents                      │
│  │ - 质量评估  │ ─→ state.qualityScore                         │
│  │ - 地理信息  │ ─→ state.geoLocations                         │
│  └─────────────┘                                               │
│     │                                                          │
│     ▼  state = { ...state, searchResults, extractedEvents, ... }│
│  ┌─────────────┐                                               │
│  │ 认知体层    │                                               │
│  │ - 时间线    │ ─→ state.timeline                             │
│  │ - 因果链    │ ─→ state.causalChain                          │
│  │ - 关键因素  │ ─→ state.keyFactors                           │
│  │ - 验证结果  │ ─→ state.validationResults                    │
│  └─────────────┘                                               │
│     │                                                          │
│     ▼  state = { ...state, timeline, causalChain, ... }        │
│  ┌─────────────┐                                               │
│  │ 决策体层    │                                               │
│  │ - 场景推演  │ ─→ state.scenarios                            │
│  │ - 敏感性    │ ─→ state.sensitivityAnalysis                  │
│  │ - 行动建议  │ ─→ state.actionAdvice                         │
│  └─────────────┘                                               │
│     │                                                          │
│     ▼                                                          │
│  ┌─────────────┐                                               │
│  │ 行动体层    │                                               │
│  │ - 报告生成  │ ─→ state.finalReport                          │
│  │ - 文档存储  │ ─→ state.documentStored                       │
│  │ - 质量控制  │ ─→ state.riskControl                          │
│  │ - 执行监控  │ ─→ state.qualityCheck                         │
│  └─────────────┘                                               │
│     │                                                          │
│     ▼  通过检查?                                                │
│     ├─ 否 ─→ 循环修正（返回指定层）                             │
│     │                                                          │
│     └─ 是 ─┐                                                   │
│            ▼                                                   │
│  ┌─────────────┐                                               │
│  │ 进化体层    │                                               │
│  │ - 知识存储  │ ─→ 保存到知识图谱                             │
│  │ - 复盘总结  │ ─→ state.reviewResults                        │
│  └─────────────┘                                               │
│     │                                                          │
│     ▼                                                          │
│  输出结果给用户                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 六、关键设计决策

### 6.1 为什么拆分"分析师"为"时序分析师"和"因果分析师"？

| 方案 | 优点 | 缺点 |
|-----|------|------|
| **合并（原方案）** | 智能体数量少 | 职责过重、难以调优、prompt过长 |
| **拆分（新方案）** | 职责单一、可并行、易调优 | 智能体数量增加 |

**选择拆分**的原因：
1. 时序分析和因果分析是两个独立的认知过程
2. 拆分后可以并行执行，提高效率
3. 单一职责使得每个智能体的prompt更精准

### 6.2 为什么合并"验证者"和"仲裁者"为"结果验证器"？

| 方案 | 优点 | 缺点 |
|-----|------|------|
| **分离（原方案）** | 流程更细 | 职责重叠、冗余调度 |
| **合并（新方案）** | 简洁高效、职责清晰 | 流程步骤减少 |

**选择合并**的原因：
1. 验证和仲裁本质都是质量把关，合并更高效
2. 减少冗余的智能体调度开销
3. "结果验证器"更能准确反映职责

### 6.3 为什么新增"事件抽取器"和"文档执行器"？

**原问题**：
- 感知体缺少"事件抽取"环节，采集→评估链路不完整
- 行动体缺少"执行"环节，只有生成没有存储

**解决方案**：
- 新增"事件抽取器"：补全感知体"采集→抽取→评估"链路
- 新增"文档执行器"：实现行动体"生成→执行→控制→监控"链路

## 七、通用性与领域适配性设计

### 7.1 核心思路

通过 **配置化 + 插件化** 实现通用性和领域适配性的兼顾：

```
┌─────────────────────────────────────────────────────────────────┐
│                     通用核心 (不变)                              │
│  - 五层架构（18个智能体）                                        │
│  - 分层调度器                                                    │
│  - 智能体工厂                                                    │
└─────────────────────────────────────────────────────────────────┘
                           ↓ 配置注入
┌─────────────────────────────────────────────────────────────────┐
│                     领域适配层 (可变)                            │
│  - 领域配置系统 (DomainConfig)                                   │
│  - 场景配置系统 (ScenarioConfig)                                 │
│  - 智能体增强配置 (AgentEnhancement)                             │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 适配机制

```typescript
// 领域识别
detectDomain('美联储降息概率') → 'finance'
detectDomain('俄乌冲突影响') → 'geopolitics'

// 场景识别
detectScenario('最新事件影响') → 'event_analysis'
detectScenario('未来趋势预测') → 'trend_prediction'

// 智能体增强
const enhancedAnalyst = factory.getNodeFunction('causal_analyst');
// → 包含金融领域因果模式、中国市场分析要求等
```

详细设计见：`docs/domain-adaptation-design.md`

## 八、实现状态

### 已实现模块

| 模块 | 文件 | 状态 |
|-----|------|------|
| 智能体配置 | `src/lib/langgraph/agent-config.ts` | ✅ 已更新 |
| 智能体状态 | `src/lib/langgraph/state.ts` | ✅ 已更新 |
| 分层调度器 | `src/lib/langgraph/layer-scheduler.ts` | ✅ 已更新 |
| 图谱生成 | `src/lib/langgraph/graph.ts` | ✅ 已更新 |
| 前端组件 | `src/app/components/AgentProgress.tsx` | ✅ 已更新 |
| 类型定义 | `src/app/types.ts` | ✅ 已更新 |

### 智能体清单

| 层级 | 智能体ID | 名称 | 状态 |
|------|---------|------|------|
| 调度层 | `intent_parser` | 意图解析器 | ✅ |
| 感知体 | `scout_cluster` | 侦察兵集群 | ✅ |
| 感知体 | `event_extractor` | 事件抽取器 | ✅ 新增 |
| 感知体 | `quality_evaluator` | 质量评估器 | ✅ |
| 感知体 | `geo_extractor` | 地理抽取器 | ✅ |
| 认知体 | `timeline_analyst` | 时序分析师 | ✅ 拆分 |
| 认知体 | `causal_analyst` | 因果分析师 | ✅ 拆分 |
| 认知体 | `knowledge_extractor` | 知识抽取器 | ✅ |
| 认知体 | `result_validator` | 结果验证器 | ✅ 合并 |
| 决策体 | `scenario_simulator` | 场景推演器 | ✅ |
| 决策体 | `sensitivity_analyst` | 敏感性分析师 | ✅ |
| 决策体 | `action_advisor` | 行动建议器 | ✅ |
| 行动体 | `report_generator` | 报告生成器 | ✅ |
| 行动体 | `document_executor` | 文档执行器 | ✅ 新增 |
| 行动体 | `quality_controller` | 质量控制器 | ✅ |
| 行动体 | `execution_monitor` | 执行监控器 | ✅ |
| 进化体 | `knowledge_manager` | 知识管理器 | ✅ |
| 进化体 | `review_analyst` | 复盘分析师 | ✅ |
