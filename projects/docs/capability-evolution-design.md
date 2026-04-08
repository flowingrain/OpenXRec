# 复盘进化能力设计文档

## 概述

**复盘进化能力**是智弈全域风险态势感知平台的第5个标准能力，实现"越用越智能"的持续优化闭环。

## 五大标准能力体系

| 序号 | 能力名称 | 核心功能 | 对应层级 |
|-----|---------|---------|---------|
| 1 | 预警哨兵 | 信息质量评估、异常检测 | 感知体 |
| 2 | 风险传导路径发现 | 动态发现传导网络 | 认知体 |
| 3 | 探秘分析 | 深度假设验证分析 | 认知体 |
| 4 | 重大课题推演 | 多场景仿真模拟 | 决策体 |
| **5** | **复盘进化** | **记忆存储、复盘优化、策略迭代** | **进化体** |

---

## 一、能力架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    复盘进化能力架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   分析任务执行                           │   │
│  │   感知体 → 认知体 → 决策体 → 行动体                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 进化体层 (Evolution)                     │   │
│  │                                                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │记忆智能体   │──▶│复盘智能体   │──▶│策略优化器   │     │   │
│  │  │memory_agent │  │review_agent │  │rl_trainer   │     │   │
│  │  │             │  │             │  │ (优化机制)  │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │         │                │                 │            │   │
│  │         ▼                ▼                 ▼            │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │              案例记忆存储                       │    │   │
│  │  │  • 案例存储    • 相似检索    • 模式提取        │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│                    ┌─────────────────┐                          │
│                    │ 优化后的分析配置 │                          │
│                    │ • 更精准的阈值  │                          │
│                    │ • 更优的流程    │                          │
│                    │ • 更好的提示词  │                          │
│                    └─────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、核心组件

### 2.1 记忆智能体 (memory_agent)

**职责**：
- 存储分析案例到案例库
- 检索相似历史案例
- 召回可复用的分析模式
- 为当前分析提供上下文增强

**输入**：
```typescript
{
  query: string;           // 分析主题
  searchResults: any[];    // 搜索结果
  conclusion: string;      // 分析结论
  // ... 其他分析结果
}
```

**输出**：
```typescript
{
  caseId: string;          // 存储的案例ID
  similarCases: Array<{    // 相似案例
    case: AnalysisCase;
    similarity: number;
    matchedAspects: string[];
  }>;
  recalledPatterns: string[]; // 召回的模式
  contextEnriched: boolean;   // 是否增强上下文
}
```

**核心算法**：
1. **案例存储**：将分析过程和结果结构化存储
2. **向量嵌入**：生成案例的语义向量表示
3. **相似度检索**：基于向量相似度查找历史案例
4. **模式提取**：从相似案例中提取可复用模式

---

### 2.2 复盘智能体 (review_agent)

**职责**：
- 分析案例的成败原因
- 提取经验教训
- 识别可复用模式
- 生成改进建议

**复盘框架**：

```
┌─────────────────────────────────────────────────────────────────┐
│                      复盘分析框架                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 成功要素分析                                                │
│     • 哪些分析方法有效？                                        │
│     • 哪些信息来源关键？                                        │
│     • 哪些推理路径正确？                                        │
│                                                                 │
│  2. 失败教训提取                                                │
│     • 哪些假设错误？                                            │
│     • 哪些信息遗漏？                                            │
│     • 哪些推理有偏差？                                          │
│                                                                 │
│  3. 改进建议                                                    │
│     • 针对智能体的优化建议                                      │
│     • 针对流程的优化建议                                        │
│     • 针对工具的优化建议                                        │
│                                                                 │
│  4. 模式识别                                                    │
│     • 可复用的成功模式                                          │
│     • 需要避免的反模式                                          │
│                                                                 │
│  5. 知识沉淀                                                    │
│     • 领域知识洞察                                              │
│     • 因果规律发现                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**输出结构**：
```typescript
{
  successFactors: string[];      // 成功要素
  failureLessons: string[];      // 失败教训
  improvements: Array<{          // 改进建议
    target: string;              // 目标智能体
    suggestion: string;          // 改进建议
    priority: 'high' | 'medium' | 'low';
    expectedImpact: string;      // 预期效果
  }>;
  reusablePatterns: Array<{      // 可复用模式
    patternName: string;
    patternDescription: string;
    applicableScenarios: string[];
    implementation: string;
  }>;
  antiPatterns: Array<{          // 反模式
    patternName: string;
    description: string;
    avoidanceStrategy: string;
  }>;
  knowledgeNuggets: Array<{      // 知识沉淀
    domain: string;
    insight: string;
    evidence: string;
    confidence: number;
  }>;
}
```

---

### 2.3 策略优化器（StrategyOptimizer）

> **重要说明**：策略优化器是一个**优化机制**，不是智能体。它被复盘智能体调用，用于从反馈中学习和优化策略。

**优化维度**：

| 维度 | 说明 | 示例 |
|-----|------|------|
| **Prompt 优化** | 优化智能体的提示词 | 增加领域特定指导 |
| **参数优化** | 调整模型参数 | temperature、阈值调整 |
| **工作流优化** | 调整执行流程 | 并行/串行策略调整 |
| **工具优化** | 改进工具调用 | 数据源配置优化 |

**输出结构**：
```typescript
{
  optimizations: Array<{
    optimizationId: string;
    targetAgent: string;         // 目标智能体
    optimizationType: 'prompt' | 'parameter' | 'workflow' | 'tool';
    beforeConfig: Record<string, any>;  // 优化前配置
    afterConfig: Record<string, any>;   // 优化后配置
    reasoning: string;           // 优化理由
    expectedImprovement: string; // 预期效果
    validationStatus: 'pending' | 'validated' | 'rejected';
  }>;
  appliedOptimizations: string[];    // 已应用的优化ID
  pendingValidations: string[];      // 待验证的优化ID
}
```

---

## 三、案例存储设计

### 3.1 案例结构

```typescript
interface AnalysisCase {
  id: string;                    // 案例唯一ID
  timestamp: string;             // 创建时间
  
  // 输入信息
  query: string;                 // 分析主题
  domain: DomainType;            // 领域类型
  scenario: ScenarioType;        // 场景类型
  complexity: TaskComplexity;    // 复杂度
  
  // 分析结果
  timeline: TimelineEvent[];     // 时间线
  causalChains: CausalChain[];   // 因果链
  keyFactors: KeyFactor[];       // 关键因素
  scenarios: Scenario[];         // 场景预测
  conclusion: string;            // 结论
  report: string;                // 完整报告
  
  // 执行元数据
  agentSequence: string[];       // 执行的智能体序列
  executionTime: number;         // 执行时长
  tokenUsage: number;            // Token消耗
  
  // 反馈信息
  feedback?: CaseFeedback;       // 用户反馈
  
  // 向量嵌入
  embedding?: number[];          // 语义向量
  
  // 标签
  tags: string[];                // 分类标签
}
```

### 3.2 反馈机制

```typescript
interface CaseFeedback {
  // 用户评分 (1-5)
  userRating?: number;
  
  // 用户评价
  userComments?: string;
  
  // 用户采纳的结论
  adoptedConclusions?: string[];
  
  // 用户修改的内容
  modifications?: Array<{
    section: string;
    original: string;
    modified: string;
  }>;
  
  // 实际结果跟踪
  actualOutcome?: {
    verifiedAt: string;
    accuracy: 'accurate' | 'partial' | 'inaccurate';
    deviation?: string;
    lessons: string;
  };
}
```

### 3.3 相似度检索

**检索流程**：
1. 生成查询文本的向量嵌入
2. 与案例库中的向量进行余弦相似度计算
3. 返回相似度超过阈值的案例
4. 按相似度排序返回 Top N

**相似度计算**：
```
similarity = cos(v_query, v_case) = (v_query · v_case) / (||v_query|| * ||v_case||)
```

---

## 四、优化闭环

### 4.1 反馈收集流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    反馈收集流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  分析完成 ──▶ 用户评分 ──▶ 用户评价 ──▶ 采纳跟踪              │
│      │           │           │              │                   │
│      ▼           ▼           ▼              ▼                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    案例存储                              │   │
│  │  • 分析过程    • 评分    • 评价    • 采纳情况           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│                      ┌───────────────┐                          │
│                      │ 实际结果跟踪  │                          │
│                      │ (可选,后期)   │                          │
│                      └───────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 优化应用流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    优化应用流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  复盘结果 ──▶ 优化策略生成 ──▶ 配置验证 ──▶ 沙箱测试          │
│      │              │               │             │              │
│      ▼              ▼               ▼             ▼              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 优化策略队列                             │   │
│  │  • Prompt优化    • 参数调整    • 流程变更              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 A/B 测试验证                             │   │
│  │  • 对照组: 原配置                                       │   │
│  │  • 实验组: 新配置                                       │   │
│  │  • 指标: 准确率、效率、满意度                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│                      ┌───────────────┐                          │
│                      │ 效果评估      │                          │
│                      │ • 提升 > 阈值 │──▶ 全面推广              │
│                      │ • 提升 < 阈值 │──▶ 继续优化              │
│                      │ • 效果负面    │──▶ 回滚配置              │
│                      └───────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 五、能力服务化接口

### 5.1 API 设计

```typescript
// 存储案例
POST /api/evolution/case
{
  query: string;
  analysisResult: AnalysisResult;
  executionMetadata: ExecutionMetadata;
}

// 获取相似案例
GET /api/evolution/cases/similar?query=xxx&limit=5

// 提交反馈
POST /api/evolution/case/{caseId}/feedback
{
  rating: number;
  comments: string;
  adoptedConclusions: string[];
}

// 触发复盘
POST /api/evolution/review
{
  caseId: string;
}

// 获取优化建议
GET /api/evolution/optimizations?agentId=xxx

// 应用优化
POST /api/evolution/optimization/{optimizationId}/apply
```

### 5.2 状态集成

进化体层状态已集成到 `AnalysisState`：

```typescript
// 进化体层状态字段
memoryAgentOutput: string;      // 记忆智能体输出
reviewAgentOutput: string;      // 复盘智能体输出
rlTrainerOutput: string;        // 强化学习输出
evolutionOutput: EvolutionOutput; // 综合输出
caseId: string;                 // 案例ID
userRating: number;             // 用户评分
```

---

## 六、实现清单

| 组件 | 文件 | 状态 |
|-----|------|------|
| 案例存储 | `src/lib/langgraph/case-memory-store.ts` | ✅ 已实现 |
| 记忆智能体 | `src/lib/langgraph/evolution-nodes.ts` | ✅ 已实现 |
| 复盘智能体 | `src/lib/langgraph/evolution-nodes.ts` | ✅ 已实现 |
| 策略优化器 | `src/lib/langgraph/evolution-nodes.ts` | ✅ 已实现（优化机制） |
| 状态定义 | `src/lib/langgraph/state.ts` | ✅ 已更新 |
| 智能体工厂 | `src/lib/langgraph/agent-factory.ts` | ✅ 已更新 |
| 模块导出 | `src/lib/langgraph/index.ts` | ✅ 已更新 |

---

## 七、后续优化方向

### 7.1 持久化存储
- 集成数据库（PostgreSQL/MongoDB）
- 支持大规模案例存储
- 高效的向量索引（如 Milvus）

### 7.2 嵌入模型
- 集成专业嵌入模型（如 text-embedding-ada-002）
- 提高相似度检索精度

### 7.3 A/B 测试框架
- 构建配置管理平台
- 自动化 A/B 测试
- 效果评估仪表板

### 7.4 知识图谱
- 构建领域知识图谱
- 与案例库联动
- 增强推理能力

---

## 八、使用示例

```typescript
// 在分析完成后自动触发复盘进化
const result = await executeAnalysis(query);

// 用户提交反馈
await caseMemoryStore.updateFeedback(result.caseId, {
  userRating: 4,
  userComments: '分析全面，但场景预测可以更详细',
  adoptedConclusions: ['场景1', '场景2']
});

// 后台自动触发复盘和优化
// 下一轮分析将受益于优化后的配置
```

---

**文档版本**: v1.0
**更新日期**: 2024-03-28
**作者**: AI Agent Team
