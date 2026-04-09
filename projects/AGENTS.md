# OpenXRec 项目上下文

## 项目概述

**OpenXRec** - 开放、透明、可解释的多智能体推荐框架

### 核心定位

**"OpenXRec" 的含义：开放(Open) + 可解释(eXplainable) + 推荐(Recommendation)

```
OpenXRec = 开放的推荐算法
         + 可解释的推荐结果
         + 用户可参与配置
```

**核心价值**：
- **Open（开放）**：推荐算法透明可见，用户可参与配置和调优
- **eXplainable（可解释）**：每个推荐都有清晰的解释和推理路径
- **Recommendation（推荐）**：基于多智能体协作的混合推荐策略

**典型场景**：
- 商品推荐 → 展示"为什么推荐这个商品"
- 内容推荐 → 解释"因为你浏览过相关内容"
- 服务推荐 → 说明"基于你的偏好匹配"
- 投资推荐 → 提供风险评估和因果分析

### 技术栈

- **Framework**: Next.js 16.2.2 (App Router)
- **Core**: React 19.2.3
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **智能体编排**: LangGraph JS
- **LLM**: doubao-seed-2-0-pro-260215
- **嵌入模型**: doubao-embedding-vision-251215
- **数据库**: Supabase (Coze 托管，含 pgvector 扩展)

### 关键配置文件

- **next.config.ts**: 包含 `reactStrictMode: false` 以减少开发环境警告

## 推荐智能体架构

OpenXRec 继承五层智能体架构，针对推荐场景进行了特化：

```
感知层 → 认知层 → 决策层 → 优化层 → 进化层
   ↓        ↓        ↓        ↓        ↓
画像构建   特征提取   排序决策   多样性优化   反馈学习
```

### 智能体层级定义

```
┌─────────────────────────────────────────────────────────────┐
│                      感知层（画像构建）                      │
│  用户画像智能体：提取用户兴趣、偏好、行为模式                 │
│  物品画像智能体：提取物品特征、构建物品表示                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      认知层（特征分析）                      │
│  特征提取智能体：从用户和物品中提取特征                       │
│  相似度计算智能体：计算用户-物品、物品-物品相似度             │
│  因果推理智能体：基于因果推断分析推荐影响                     │
│  知识图谱推理智能体：利用知识图谱发现隐式关联                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      决策层（排序决策）                      │
│  排序智能体：多因素排序，考虑多样性、新颖性                   │
│  解释生成智能体：生成推荐结果的自然语言解释                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      优化层（结果优化）                      │
│  多样性优化智能体：优化推荐结果的多样性                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      进化层（持续学习）                      │
│  反馈收集智能体：收集用户反馈，分析偏好变化                   │
│  配置优化智能体：基于反馈动态调整推荐配置                     │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | 智能体 | 职责 | 完整链路 |
|-----|-------|------|---------|
| **感知层** | 用户画像智能体、物品画像智能体 | 画像构建、特征提取 | 用户画像 → 物品画像 |
| **认知层** | 特征提取智能体、相似度计算智能体、因果推理智能体、知识图谱推理智能体 | 特征分析、相似度计算、因果推理、知识推理 | 特征 → 相似度 → 推理 |
| **决策层** | 排序智能体、解释生成智能体 | 排序决策、解释生成 | 排序 → 解释 |
| **优化层** | 多样性优化智能体 | 结果优化 | 多样性 → 新颖性 → 惊喜性 |
| **进化层** | 反馈收集智能体、配置优化智能体 | 反馈学习、配置优化 | 收集 → 分析 → 优化 |

## 推荐策略类型

OpenXRec 支持多种推荐策略的灵活组合：

| 策略 | 类型标识 | 说明 |
|------|---------|------|
| 基于内容 | `content_based` | 基于物品特征的相似度匹配 |
| 协同过滤 | `collaborative` | 基于用户行为的协同推荐 |
| 知识图谱驱动 | `knowledge_based` | 利用知识图谱发现隐式关联 |
| 智能体驱动 | `agent_based` | 多智能体协作决策推荐 |
| 因果推断驱动 | `causal_based` | 基于因果推断的推荐分析 |

### 策略权重配置

```typescript
strategyWeights: {
  content_based: 0.3,    // 基于内容
  collaborative: 0.3,    // 协同过滤
  knowledge_based: 0.2,  // 知识图谱
  agent_based: 0.1,      // 智能体驱动
  causal_based: 0.1      // 因果推断
}
```

## 可解释性系统

### 解释类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `feature_similarity` | 特征相似度 | "该商品与你浏览过的商品在价格、品牌上相似" |
| `behavioral` | 行为模式 | "购买过此类商品的用户通常也喜欢这个" |
| `causal` | 因果推理 | "因为近期价格下降，推荐此时购买" |
| `knowledge_graph` | 知识图谱 | "该商品与你收藏的商品属于同一品牌系列" |
| `collaborative` | 协同过滤 | "与你兴趣相似的用户都给了好评" |
| `rule_based` | 规则匹配 | "符合你设置的偏好条件" |

### 解释因素结构

```typescript
interface ExplanationFactor {
  name: string;        // 因素名称
  value: any;          // 因素值
  importance: number;  // 重要程度（0-1）
  category: 'user' | 'item' | 'context' | 'knowledge';
}
```

## 反馈闭环系统

### 设计理念

通过智能体完成动态配置，反馈循环机制自动学习：

```
用户行为 → 反馈收集 → 效果分析 → 配置优化 → 推荐调整
    ↓         ↓           ↓           ↓           ↓
 click      缓冲聚合    LLM分析     权重更新     实时生效
 like       批量触发    统计计算    阈值调整
 purchase   持续积累    趋势识别    策略切换
```

### 核心组件

| 组件 | 类名 | 功能 |
|-----|------|------|
| 反馈循环管理器 | `FeedbackLoopManager` | 收集、聚合用户反馈 |
| 配置智能体 | `ConfigurationAgent` | 分析效果、生成优化配置 |
| 动态配置管理器 | `DynamicConfigManager` | 管理场景级配置 |
| 自适应优化智能体 | `AdaptiveOptimizerAgent` | 动态规则优化、置信度校准、多级兜底 |

### 三阶段演进

```
阶段1：保留架构（静态配置）
    ↓
阶段2：场景差异化（场景级配置）
    ↓
阶段3：动态学习（智能体驱动）
```

## 自适应优化系统

### 设计理念

通过智能体动态完成三项核心优化：

1. **规则精细化**：根据实际反馈优化关键词列表
2. **置信度校准**：收集数据调整规则置信度
3. **多级兜底**：管理多层级兜底策略

### 工作流程

```
意图判断 → 规则匹配(动态关键词) → 加权评分 → 校准置信度
    ↓           ↓                    ↓           ↓
  反馈收集    关键词统计           准确率计算    阈值调整
    ↓           ↓                    ↓           ↓
  智能分析    问题识别             新词发现     规则更新
```

### 多级兜底策略

| 层级 | 名称 | 说明 | 成功率 |
|------|------|------|--------|
| 1 | LLM | 大模型意图分析 | 95% |
| 2 | Rule | 关键词规则匹配 | 75% |
| 3 | History | 历史相似查询 | 60% |
| 4 | Popular | 热门策略（保守） | 40% |
| 5 | Random | 随机兜底（禁用） | 10% |

### 自适应学习机制

```typescript
// 反馈记录
interface IntentFeedback {
  query: string;
  predictedNeedsSearch: boolean;  // 预测是否需要搜索
  predictedConfidence: number;    // 预测置信度
  actualNeedsSearch: boolean;     // 实际是否需要搜索
  matchedKeywords: string[];      // 匹配的关键词
  source: 'llm' | 'rule_fallback' | 'history_fallback';
  timestamp: number;
}

// 自动优化触发条件
- 距离上次优化超过1小时
- 新增反馈超过100条
- 手动触发优化API
```

## PPO策略优化服务

### 设计理念

PPO作为**独立的策略优化服务**，后台训练优化推荐策略权重，与反馈闭环智能体协同工作：

```
┌─────────────────────────────────────────────────────────────┐
│                    推荐流程                                 │
│  用户请求 → 意图分析 → 推荐生成 → 结果展示                   │
└─────────────────────────────────────────────────────────────┘
      ↓                                    ↓
┌──────────────────┐              ┌────────────────────┐
│ 自适应优化智能体  │ ←──反馈───→ │ 反馈收集器          │
│ - 规则精细化      │              │ - 用户行为记录      │
│ - 置信度校准      │              │ - 奖励信号计算      │
│ - 多级兜底        │              └────────────────────┘
└──────────────────┘                      ↓
      ↓                           ┌────────────────────┐
└───────────────→ PPO策略优化服务 ←│ 训练样本生成        │
                  - 后台训练       └────────────────────┘
                  - 策略权重优化
                  - 定期更新配置
```

### 核心功能

| 功能 | 说明 |
|------|------|
| 策略权重优化 | 动态调整5种推荐策略的权重配比 |
| 后台训练 | 定期从用户反馈中学习最优策略 |
| 动作输出 | 根据当前状态输出最优动作（策略配置） |
| 离线训练 | 支持从历史数据批量训练 |

### 奖励信号来源

| 行为 | 奖励值 | 说明 |
|------|--------|------|
| click | +1.0 | 用户点击推荐项 |
| like | +2.0 | 用户点赞/收藏 |
| purchase | +5.0 | 用户购买/转化 |
| dislike | -2.0 | 用户明确不喜欢 |
| skip | -0.5 | 用户跳过推荐 |
| dwell | +0.1/秒 | 停留时长奖励 |

### 与反馈闭环的协同

```typescript
// 1. 推荐请求时获取最优策略
const optimalPolicy = ppoService.getOptimalPolicy(currentState);

// 2. 用户行为记录
feedbackCollector.record(userId, {
  type: 'click',
  itemId: recommendation.id,
  position: recommendation.rank,
});

// 3. 定期训练优化
await ppoService.train();

// 4. 同步到自适应优化智能体
adaptiveOptimizer.recordFeedbackAndLearn(feedback);
```

### 训练触发条件

- 缓冲区样本数 >= 256
- 距离上次训练 >= 1小时
- 手动调用训练API

### 自适应超参数调整

PPO优化器支持自适应超参数调整，根据训练过程中的性能指标动态调整学习率和其他超参数。

#### 调整策略

| 策略 | 说明 |
|------|------|
| `linear_decay` | 线性衰减 |
| `cosine_annealing` | 余弦退火 |
| `performance_based` | 性能驱动 |
| `kl_adaptive` | KL散度自适应 |
| `hybrid` | 混合策略（推荐） |

#### 调整的超参数

| 超参数 | 初始值 | 范围 | 调整依据 |
|--------|--------|------|----------|
| learningRate | 3e-4 | [1e-6, 1e-3] | 性能改进、KL散度 |
| clipEpsilon | 0.2 | [0.05, 0.3] | KL散度 |
| entropyCoef | 0.01 | [0.001, 0.1] | 熵值 |
| gaeLambda | 0.95 | [0.9, 0.99] | 奖励方差 |

#### 使用示例

```typescript
import { createPPOOptimizer, AdaptationStrategy } from '@/lib/recommendation/ppo';

// 创建带自适应调整的PPO优化器
const optimizer = createPPOOptimizer(
  { stateDim: 32, hiddenDims: [128, 64, 32] },
  { strategy: AdaptationStrategy.HYBRID }
);

// 获取当前超参数
const params = optimizer.getCurrentHyperparams();
console.log('学习率:', params.learningRate);
console.log('裁剪参数:', params.clipEpsilon);

// 获取性能统计
const perfStats = optimizer.getPerformanceStats();
console.log('趋势:', perfStats.trend);  // 'improving' | 'stable' | 'degrading'
console.log('是否应早停:', perfStats.shouldStop);

// 启用/禁用自适应调整
optimizer.setAdaptiveEnabled(false);
```

### 超参数版本管理

PPO优化器支持超参数版本持久化，实现跨会话学习和回滚能力。

#### 功能特性

| 功能 | 说明 |
|------|------|
| 版本保存 | 自动/手动保存超参数配置 |
| 版本激活 | 激活历史版本作为当前配置 |
| 版本回滚 | 回滚到指定版本并创建新版本记录 |
| 训练历史 | 记录每次训练的超参数快照和性能指标 |
| 状态导出 | 导出完整的版本和训练历史 |

#### 数据库表结构

```sql
-- 超参数版本表
CREATE TABLE ppo_hyperparam_versions (
  id UUID PRIMARY KEY,
  version INT NOT NULL,
  config JSONB NOT NULL,           -- 超参数配置
  performance JSONB,               -- 性能指标
  is_active BOOLEAN DEFAULT false, -- 是否当前生效
  is_verified BOOLEAN DEFAULT false, -- 专家审核通过
  source VARCHAR(20),              -- 'auto' | 'manual' | 'rollback'
  parent_version INT,              -- 父版本号
  tags TEXT[],                     -- 标签
  notes TEXT,                      -- 备注
  created_by TEXT,                 -- 创建者
  created_at TIMESTAMPTZ
);

-- 训练历史表
CREATE TABLE ppo_training_history (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  epoch INT NOT NULL,
  hyperparams JSONB NOT NULL,      -- 超参数快照
  metrics JSONB NOT NULL,          -- 训练指标
  adaptation JSONB,                -- 调整信息
  created_at TIMESTAMPTZ
);
```

#### API端点

| 操作 | 方法 | 说明 |
|------|------|------|
| `version-list` | POST | 获取版本列表 |
| `version-active` | POST | 获取当前激活版本 |
| `version-activate` | POST | 激活指定版本 |
| `version-rollback` | POST | 回滚到指定版本 |
| `version-save` | POST | 保存当前配置为新版本 |
| `training-history` | POST | 获取训练历史 |
| `recent-stats` | POST | 获取最近统计 |
| `export` | POST | 导出完整状态 |

#### 使用示例

```typescript
// 获取版本列表
const response = await fetch('/api/v1/ppo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ operation: 'version-list' })
});

// 保存当前配置
await fetch('/api/v1/ppo', {
  method: 'POST',
  body: JSON.stringify({
    operation: 'version-save',
    data: { tags: ['stable'], notes: '性能稳定的配置' }
  })
});

// 回滚到指定版本
await fetch('/api/v1/ppo', {
  method: 'POST',
  body: JSON.stringify({
    operation: 'version-rollback',
    data: { versionId: 'xxx' }
  })
});
```

#### API端点

| 操作 | 方法 | 说明 |
|------|------|------|
| `GET /api/v1/ppo` | GET | 获取PPO状态（含自适应信息） |
| `adaptive-status` | POST | 获取自适应超参数状态 |
| `adaptive-history` | POST | 获取调整历史 |
| `adaptive-enable` | POST | 启用/禁用自适应调整 |
| `adaptive-reset` | POST | 重置自适应调整器 |

## 持久化与在线学习系统

### 设计理念

1. **持久化存储**：反馈数据持久化到 Supabase，支持跨会话学习
2. **在线学习**：增量校准，无需等待大量样本即可开始
3. **A/B测试**：对比不同校准方法的效果
4. **可视化仪表盘**：实时展示校准曲线、阈值调整历史

### 数据库表结构

| 表名 | 功能 |
|------|------|
| `adaptive_intent_feedbacks` | 意图判断反馈记录 |
| `adaptive_keyword_rules` | 动态关键词规则 |
| `adaptive_calibration_bins` | 置信度校准数据 |
| `adaptive_fallback_states` | 兜底策略状态 |
| `ab_experiments` | A/B测试实验 |
| `ab_events` | A/B测试事件 |
| `adaptive_optimization_history` | 优化历史记录 |

### 在线增量校准

```typescript
// 配置
const config = {
  enableIncrementalUpdate: true,  // 启用增量更新
  updateIntervalMs: 5000,         // 5秒更新一次
  minSamplesForUpdate: 5,         // 5个样本即可开始
  forgettingFactor: 0.95,         // 遗忘因子
  adaptiveLearningRate: true,     // 自适应学习率
  coldStartStrategy: 'prior',     // 贝叶斯先验冷启动
};

// 使用
const calibrationService = getOnlineCalibrationService(config);

// 记录样本（立即更新）
await calibrationService.recordSample(0.75, true, true);

// 获取校准后的置信度
const calibrated = calibrationService.getCalibratedConfidence(0.75);
```

### A/B测试框架

```typescript
// 创建实验
const abTesting = getABTestingManager();
await abTesting.createExperiment({
  name: 'calibration_comparison',
  variantA: { type: 'calibration_method', config: { method: 'histogram' } },
  variantB: { type: 'calibration_method', config: { method: 'bayesian' } },
});

// 获取用户分组
const variant = abTesting.getUserVariant(userId, experimentId);

// 记录事件
await abTesting.recordEvent({
  experimentId,
  userId,
  eventType: 'outcome',
  eventData: { isCorrect: true },
});
```

### 可视化仪表盘

```
GET /api/v1/dashboard
返回：
- 校准曲线数据
- 期望校准误差(ECE)
- 准确率趋势
- 关键词效果排名
- A/B测试结果
```

## 核心模块

### 推荐引擎

位于 `src/lib/recommendation/` 目录：

| 文件 | 功能 |
|-----|------|
| `engine.ts` | 通用推荐引擎核心实现 |
| `agents.ts` | 推荐智能体系统（LangGraph编排） |
| `types.ts` | 核心类型定义 |
| `evaluation.ts` | 推荐质量评估（Precision/Recall/NDCG/MAP） |
| `domain-config.ts` | 领域适配配置 |
| `dynamic-config.ts` | 动态配置系统 |
| `adaptive-optimizer.ts` | 自适应优化智能体（规则精细化、置信度校准、多级兜底） |
| `persistence/` | 持久化与在线学习系统 |
| `ppo/` | PPO强化学习优化器 |
| `ppo-integration.ts` | PPO策略优化服务（与反馈闭环集成） |
| `sequential-agent.ts` | 序列推荐智能体 |
| `advanced-strategies.ts` | 高级推荐策略 |
| `supabase-memory-integration.ts` | Supabase记忆系统集成 |
| `supabase-knowledge-integration.ts` | Supabase知识库集成 |
| `calibration/` | 置信度校准系统 |
| `reflection/` | 反思机制（元认知能力） |

### 可视化组件

| 组件 | 文件 | 功能 |
|-----|------|------|
| `RecommendationHome` | `src/components/RecommendationHome.tsx` | 推荐首页 |
| `RecommendationChatPanel` | `src/components/RecommendationChatPanel.tsx` | 推荐交互面板 |
| `RecommendationExplanationPanel` | `src/components/RecommendationExplanationPanel.tsx` | 解释展示面板 |
| `OpenXRecInteractionDemo` | `src/components/OpenXRecInteractionDemo.tsx` | 交互设计演示 |

### 反思机制（Reflection Mechanism）

### 设计理念

反思机制为推荐系统引入"元认知"能力，使系统在决策后能够：
1. **自我评估**：对决策质量进行量化评估
2. **反事实推理**：思考"如果选择不同会怎样"
3. **改进建议**：基于分析生成可执行的建议
4. **可解释性增强**：提供推理链和关键因素解释

### 反思触发时机

| 触发点 | 说明 | 作用 |
|--------|------|------|
| `after_intent_analysis` | 意图分析后 | 评估判断合理性，调整置信度 |
| `after_recommendation` | 推荐生成后 | 评估推荐质量，过滤低质结果 |
| `before_rule_update` | 规则更新前 | 评估变更风险，批准/拒绝 |
| `after_ppo_training` | PPO训练后 | 评估策略改进，采纳/回滚 |
| `low_confidence` | 低置信度时 | 强制反思，触发额外验证 |

### 使用示例

```typescript
import { getReflectionService } from '@/lib/recommendation/reflection';

const reflectionService = getReflectionService();

// 意图分析后反思
const reflection = await reflectionService.reflectOnIntentAnalysis({
  query: '2024年最新的AI发展趋势',
  scenario: 'tech_trend',
  predictedNeedsSearch: true,
  predictedConfidence: 0.85,
  reasoning: '查询包含时间词和"最新"关键词',
  matchedKeywords: ['2024', '最新'],
  source: 'llm',
});

// 根据反思调整决策
if (reflection.selfEvaluation.score < 0.6) {
  confidence *= 0.7;  // 降低置信度
}

// 规则更新前反思
const result = await reflectionService.reflectOnRuleUpdate({
  updateType: 'keyword_add',
  beforeState: { keyword: null },
  afterState: { keyword: '如何' },
  triggerReason: '新发现的高频关键词',
  sampleEvidence: [...],
});

if (!result.shouldProceed) {
  console.log('反思分析不建议执行此更新');
  return;
}
```

### 反思结果结构

```typescript
interface ReflectionResult {
  // 自我评估
  selfEvaluation: {
    score: number;               // 自评分数 0-1
    strengths: string[];         // 优点
    weaknesses: string[];        // 不足
  };
  
  // 反事实推理
  counterfactualAnalysis?: {
    alternativeDecisions: Array<{
      decision: string;
      expectedOutcome: string;
      probability: number;
    }>;
    bestAlternative?: string;
    reasoning: string;
  };
  
  // 改进建议
  improvements: Array<{
    area: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
    implementable: boolean;
  }>;
  
  // 可解释性
  explainability: {
    reasoningChain: string[];
    keyFactors: string[];
    confidenceExplanation: string;
  };
}
```

### 与现有系统的集成

```
决策层 → 执行层 → 反思层 → 优化层
   ↓        ↓        ↓        ↓
 意图判断  推荐生成  质量评估  参数调整
          执行变更  风险评估  回滚决策
          训练模型  效果评估  采纳决策
```

## API接口

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/v1/recommend` | POST | 生成推荐（含自适应优化反馈） |
| `/api/v1/adaptive-optimizer` | GET | 获取优化状态报告 |
| `/api/v1/adaptive-optimizer` | POST | 触发手动优化/导入导出状态 |
| `/api/v1/ppo` | GET | 获取PPO模型状态 |
| `/api/v1/ppo` | POST | PPO操作（action/train/store/offline-train/版本管理/A/B测试） |
| `/api/v1/calibration` | GET/POST | 置信度校准服务 |
| `/api/v1/dashboard` | GET | 可视化仪表盘数据 |
| `/api/v1/dashboard` | POST | 导出报告 |
| `/api/v1/ab-testing` | GET | 获取A/B测试列表 |
| `/api/v1/ab-testing` | POST | 创建/管理A/B测试 |
| `/api/v1/reflection` | GET | 获取反思历史和报告 |
| `/api/v1/reflection` | POST | 触发反思分析 |
| `/api/recommendation/sequential` | POST | 序列推荐 |
| `/api/recommendation/dynamic-config` | GET/POST | 动态配置管理 |
| `/api/v1/knowledge-analysis` | GET | 获取知识库分析报告 |
| `/api/v1/knowledge-analysis` | POST | 执行分析操作（相关性/范围/建议/冲突检测） |
| `/api/v1/recommendation/network` | GET | 获取协同过滤网络数据 |
| `/api/v1/recommendation/network` | POST | 网络操作（导出/高亮路径/统计） |

## 可视化页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 专家审核仪表盘 | `/dashboard` | 版本审核、A/B测试结果可视化 |
| 网络可视化 | `/network-visualization` | 协同过滤网络图可视化 |

### 专家审核仪表盘

访问 `/dashboard` 页面可进行以下操作：

#### 1. 版本审核
- 查看待审核的超参数版本列表
- 查看每个版本的配置详情、性能指标、推荐分数
- 通过/拒绝版本，支持添加审核备注
- 通过后可自动激活该版本

#### 2. A/B 测试结果可视化
- 查看所有 A/B 测试实验列表
- 对比变体 A 和变体 B 的性能指标
- 查看统计显著性检验结果
- 查看推荐获胜者及原因

### PPO API 操作类型

| 操作 | 说明 |
|------|------|
| `action` | 获取推荐动作（策略权重建议） |
| `train` | 触发训练 |
| `store` | 存储经验 |
| `offline-train` | 离线训练 |
| `adaptive-status` | 获取自适应超参数状态 |
| `adaptive-history` | 获取调整历史 |
| `adaptive-enable` | 启用/禁用自适应调整 |
| `adaptive-reset` | 重置自适应调整器 |
| `version-list` | 获取版本列表 |
| `version-active` | 获取当前激活版本 |
| `version-activate` | 激活指定版本 |
| `version-rollback` | 回滚到指定版本 |
| `version-save` | 保存当前配置为新版本 |
| `training-history` | 获取训练历史 |
| `recent-stats` | 获取最近统计 |
| `export` | 导出完整状态 |
| `ab-create` | 创建超参数A/B测试实验 |
| `ab-start` | 启动A/B测试实验 |
| `ab-results` | 获取A/B测试结果分析 |
| `ab-end` | 结束A/B测试实验 |
| `ab-record` | 记录A/B测试事件 |
| `ab-list` | 获取活跃A/B测试列表 |
| `version-pending` | 获取待审核版本列表 |
| `version-verify` | 审核版本（通过/拒绝） |
| `batch-save-versions` | 批量保存版本 |
| `batch-update-knowledge` | 批量更新知识 |
| `batch-import-history` | 批量导入训练历史 |
| `batch-store-experiences` | 批量存储经验 |
| `strategy-generate` | 生成推荐策略 |
| `strategy-list` | 获取策略列表 |
| `strategy-combine` | 组合多个策略 |
| `strategy-predict` | 预测策略性能 |

## 智能策略生成器

### 设计理念

智能策略生成器基于场景上下文自动生成推荐策略配置：

```
场景上下文 → 模板匹配 → 业务目标调整 → 上下文微调 → 性能预测
     ↓           ↓             ↓             ↓           ↓
  场景类型   策略权重模板    目标导向优化   实时性/可解释性  预期效果
```

### 核心功能

| 功能 | 说明 |
|------|------|
| 场景感知 | 根据场景类型（商品/内容/服务/风险/投资推荐）自动选择模板 |
| 业务目标优化 | 根据目标（参与度/转化率/多样性/探索发现）调整权重 |
| 多维度预测 | 预测准确率、多样性、新颖性、惊喜性 |
| 策略组合 | 支持多个策略加权组合 |

### 场景上下文结构

```typescript
interface ScenarioContext {
  scenarioType: 'product_recommendation' | 'content_recommendation' | 'service_recommendation' | 
                'risk_recommendation' | 'investment_recommendation' | 'travel_recommendation' | 
                'career_recommendation' | 'general_recommendation';
  userActivityLevel: 'low' | 'medium' | 'high';
  itemPoolSize: 'small' | 'medium' | 'large';
  realtimeRequirement: 'low' | 'medium' | 'high';
  explainabilityRequirement: 'low' | 'medium' | 'high';
  userDataRichness: 'sparse' | 'moderate' | 'rich';
  businessGoals: ('engagement' | 'conversion' | 'diversity' | 'discovery')[];
}
```

### 预定义策略

| 策略ID | 名称 | 特点 | 适用场景 |
|--------|------|------|----------|
| `strategy_balanced` | 均衡策略 | 平衡各项指标 | 通用、商品推荐 |
| `strategy_accuracy` | 精准推荐策略 | 优先准确度 | 商品、服务推荐 |
| `strategy_discovery` | 探索发现策略 | 侧重新颖性和惊喜性 | 内容、旅游推荐 |
| `strategy_explainable` | 可解释策略 | 强调解释性 | 风险、投资推荐 |

### 使用示例

```typescript
import { getStrategyGenerator } from '@/lib/recommendation/ppo/strategy-generator';

const generator = getStrategyGenerator();

// 生成场景化策略
const strategy = generator.generateStrategy({
  scenarioType: 'product_recommendation',
  userActivityLevel: 'high',
  itemPoolSize: 'large',
  realtimeRequirement: 'medium',
  explainabilityRequirement: 'high',
  userDataRichness: 'rich',
  businessGoals: ['engagement', 'conversion'],
});

// 组合多个策略
const combined = generator.combineStrategies(
  [strategy1, strategy2],
  [0.6, 0.4]  // 权重
);

// 预测性能
const prediction = generator.predictPerformance(config, context);
```

### API调用示例

```bash
# 生成策略
curl -X POST -H 'Content-Type: application/json' -d '{
  "operation": "strategy-generate",
  "data": {
    "context": {
      "scenarioType": "product_recommendation",
      "userActivityLevel": "high",
      "itemPoolSize": "large",
      "realtimeRequirement": "medium",
      "explainabilityRequirement": "high",
      "userDataRichness": "rich",
      "businessGoals": ["engagement", "conversion"]
    }
  }
}' http://localhost:5000/api/v1/ppo

# 获取策略列表
curl -X POST -H 'Content-Type: application/json' -d '{
  "operation": "strategy-list",
  "data": { "scenario": "product_recommendation" }
}' http://localhost:5000/api/v1/ppo

# 组合策略
curl -X POST -H 'Content-Type: application/json' -d '{
  "operation": "strategy-combine",
  "data": {
    "strategyIds": ["strategy_balanced", "strategy_accuracy"],
    "weights": [0.6, 0.4]
  }
}' http://localhost:5000/api/v1/ppo

# 预测性能
curl -X POST -H 'Content-Type: application/json' -d '{
  "operation": "strategy-predict",
  "data": {
    "config": { ... },
    "context": { ... }
  }
}' http://localhost:5000/api/v1/ppo
```

## 贝叶斯优化器

### 设计理念

贝叶斯优化器使用高斯过程作为代理模型，智能探索超参数空间：

```
超参数空间 → 高斯过程代理模型 → 采集函数 → 下一个评估点
      ↓              ↓                ↓            ↓
   参数范围      后验分布估计      探索/利用平衡    最优参数
```

### 核心组件

| 组件 | 类名 | 功能 |
|------|------|------|
| 高斯过程 | `GaussianProcess` | 代理模型，估计目标函数分布 |
| 核函数 | `RBFKernel`, `MaternKernel` | 计算参数间相似度 |
| 采集函数 | `ExpectedImprovement`, `UCB`, `ProbabilityOfImprovement` | 选择下一个评估点 |
| 优化器 | `BayesianOptimizer` | 主优化器，管理优化流程 |

### 采集函数类型

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| EI (Expected Improvement) | 期望改进 | 平衡探索与利用 |
| UCB (Upper Confidence Bound) | 上置信界 | 乐观策略 |
| PI (Probability of Improvement) | 改进概率 | 保守策略 |

### 使用示例

```typescript
import { createBayesianOptimizer, AcquisitionFunctionType } from '@/lib/recommendation/ppo/bayesian-optimizer';

// 创建优化器
const optimizer = createBayesianOptimizer({
  parameterSpace: [
    { name: 'learningRate', type: 'continuous', bounds: [1e-6, 1e-3] },
    { name: 'clipEpsilon', type: 'continuous', bounds: [0.05, 0.3] },
    { name: 'entropyCoef', type: 'continuous', bounds: [0.001, 0.1] },
  ],
  acquisitionFunction: AcquisitionFunctionType.EI,
  explorationWeight: 0.1,
});

// 添加观察点
optimizer.addObservation(
  { learningRate: 3e-4, clipEpsilon: 0.2, entropyCoef: 0.01 },
  0.75  // 目标值
);

// 获取下一个建议点
const suggestion = optimizer.suggestNext();
console.log('建议参数:', suggestion.parameters);
console.log('预期改进:', suggestion.expectedImprovement);

// 获取最佳参数
const best = optimizer.getBestParameters();
console.log('最佳参数:', best.parameters);
console.log('最佳值:', best.value);
```

## 规则发现引擎

### 设计理念

规则发现引擎从历史数据中自动发现有用的规则：

```
历史数据 → Apriori算法 → 关联规则 → Granger因果检验 → 因果规则
     ↓           ↓            ↓              ↓             ↓
  交易记录   频繁项集挖掘   相关性规则     时间序列分析   因果性规则
```

### 核心功能

| 功能 | 类名 | 说明 |
|------|------|------|
| 关联规则挖掘 | `AprioriMiner` | 发现项集间的关联关系 |
| 因果规则发现 | `CausalRuleDiscoverer` | 基于Granger检验发现因果关系 |
| 规则管理 | `RuleDiscoveryEngine` | 统一管理规则生命周期 |

### 关联规则类型

| 类型 | 说明 |
|------|------|
| `keyword_intent` | 关键词-意图关联 |
| `behavior_reward` | 行为-奖励关联 |
| `feature_similarity` | 特征-相似度关联 |
| `context_performance` | 上下文-性能关联 |

### 使用示例

```typescript
import { createRuleDiscoveryEngine } from '@/lib/recommendation/ppo/rule-discovery';

const engine = createRuleDiscoveryEngine();

// 添加交易数据
engine.addTransactions([
  { items: ['keyword_最新', 'intent_search'], metadata: { source: 'query' } },
  { items: ['behavior_click', 'reward_positive'], metadata: { source: 'feedback' } },
]);

// 挖掘关联规则
const associationRules = engine.mineAssociationRules({
  minSupport: 0.05,
  minConfidence: 0.6,
});

console.log('发现的关联规则:', associationRules.length);
for (const rule of associationRules) {
  console.log(`${rule.antecedent} → ${rule.consequent} (置信度: ${rule.confidence})`);
}

// 发现因果规则
const causalRules = await engine.discoverCausalRules(
  timeSeriesData,
  { significanceLevel: 0.05, maxLag: 5 }
);

console.log('发现的因果规则:', causalRules.length);
for (const rule of causalRules) {
  console.log(`${rule.cause} → ${rule.effect} (p值: ${rule.pValue})`);
}

// 导出规则知识
const knowledge = engine.exportKnowledge();
```

## 评估指标系统

### 核心指标

| 指标 | 计算方法 | 说明 |
|------|---------|------|
| Precision@K | 相关数/K | 前K个推荐的精确率 |
| Recall@K | 相关数/总数 | 前K个推荐的召回率 |
| NDCG@K | DCG/IDCG | 考虑排序位置的归一化指标 |
| MAP | AP均值 | 平均精确率均值 |
| Diversity | 1-平均相似度 | 推荐结果多样性 |
| Novelty | 1-流行度 | 推荐结果新颖性 |
| Serendipity | 意外相关度 | 推荐结果惊喜性 |

## 关系类型管理系统

### 设计理念

关系类型管理系统支持动态抽取和合并知识图谱中的关系类型：

```
文本输入 → LLM抽取 → 相似度匹配 → 类型合并 → 层级管理
    ↓          ↓          ↓          ↓          ↓
  原始文本   新类型发现   已有类型    聚类合并    父子关系
```

### 核心功能

| 功能 | 说明 |
|------|------|
| 预定义基础类型 | 15+种预定义关系类型（资本、商业、组织、业务、影响） |
| 动态抽取 | LLM从文本中自动发现新的关系类型 |
| 相似度匹配 | 基于编辑距离的相似度计算 |
| 类型合并聚类 | 将相似关系类型归类合并 |
| 层级管理 | 支持父子类型层级关系 |
| 同义词管理 | 支持类型同义词列表 |

### 预定义关系类型

| 类别 | 类型 | 同义词 |
|------|------|--------|
| **资本** | 投资 | 参股、入股、出资 |
| | 控股 | 控股、绝对控股、相对控股 |
| **商业** | 合作 | 合作、伙伴、协作、联手 |
| | 竞争 | 竞争、竞争对手、对标 |
| | 供应 | 供应、供货、采购、采购商 |
| **组织** | 监管 | 监管、管辖、主管 |
| | 隶属 | 隶属、归属、下属 |
| | 任职 | 任职、担任、挂职 |
| **业务** | 生产 | 生产、制造、代工 |
| | 销售 | 销售、代理、分销 |
| | 采购 | 采购、供应商 |
| **影响** | 影响 | 影响、作用于、带动 |
| | 关联 | 关联、相关、涉及 |

### API 接口

| 操作 | 方法 | 说明 |
|------|------|------|
| `GET /api/knowledge-graph/relation-types` | GET | 获取所有关系类型 |
| `POST /api/knowledge-graph/relation-types` | POST | 关系类型操作 |

### 操作类型

| 操作 | 参数 | 说明 |
|------|------|------|
| `extract` | text, minConfidence | 从文本动态抽取关系类型 |
| `add` | name, category, synonyms | 添加自定义关系类型 |
| `merge` | sourceIds, targetId, reason | 合并多个关系类型 |
| `createHierarchy` | parentId, childName | 创建层级关系 |
| `findSimilar` | name, threshold | 查找相似类型 |
| `update` | id, ...updates | 更新关系类型 |
| `delete` | id | 删除关系类型 |
| `export` | - | 导出所有类型 |
| `import` | types[] | 批量导入类型 |
| `stats` | - | 获取统计信息 |

### 抽取结果结构

```typescript
interface RelationExtractionResult {
  extractedTypes: ExtractedRelationType[];   // 抽取出的新类型
  mergedTypes: MergedRelationType[];         // 建议合并的类型
  suggestions: RelationTypeSuggestion[];      // 操作建议
}
```

### 使用示例

```typescript
import { createRelationTypeManager } from '@/lib/knowledge-graph/relation-type-manager';

// 创建管理器
const manager = createRelationTypeManager(llmClient);

// 动态抽取
const result = await manager.extractRelationTypes({
  text: '腾讯收购了京东15%的股份，成为其第二大股东',
  minConfidence: 0.5,
});

// 查找相似类型
const similar = manager.findSimilarTypes('投资', 0.7);

// 合并类型
manager.mergeTypes(['source1', 'source2'], 'target1', '语义相同');

// 创建层级
manager.createHierarchy('parent_id', '子类型名称');
```

## 工具调用系统

### 设计理念

工具系统将知识图谱、事件图谱、地理位置等功能封装为可被 LLM 调用的工具，实现对话式数据查询和可视化。

```
用户问题 → LLM意图识别 → 工具调用决策 → 执行工具 → 返回结果
                              ↓
                    ┌─────────────────┐
                    │   工具列表      │
                    ├─────────────────┤
                    │ 知识图谱查询    │
                    │ 事件图谱生成    │
                    │ 地理位置可视化  │
                    └─────────────────┘
```

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tools` | 获取可用工具列表 |
| POST | `/api/v1/tools` | 执行工具调用 |

### 工具分类

#### 知识图谱工具 (knowledge)

| 工具名称 | 说明 | 必需参数 |
|---------|------|---------|
| `kg_search_entities` | 搜索知识图谱实体 | query |
| `kg_get_entity` | 获取实体详情 | entityId 或 entityName |
| `kg_find_path` | 查找实体间路径 | fromEntity, toEntity |
| `kg_get_network` | 获取实体关系网络 | centerEntity |
| `kg_analyze_influence` | 分析实体影响范围 | entityName |

#### 事件图谱工具 (event)

| 工具名称 | 说明 | 必需参数 |
|---------|------|---------|
| `eg_generate` | 生成事件图谱 | topic |
| `eg_get_history` | 查询历史事件图谱 | topic (可选) |
| `eg_analyze_causality` | 分析事件因果关系 | event |
| `eg_build_timeline` | 构建事件时间线 | events |
| `eg_find_path` | 查找事件关联路径 | fromEvent, toEvent |

#### 地理地图工具 (geo)

| 工具名称 | 说明 | 必需参数 |
|---------|------|---------|
| `geo_geocode` | 解析地理位置 | location |
| `geo_batch_geocode` | 批量解析地理位置 | locations |
| `geo_calculate_distance` | 计算两地距离 | from, to |
| `geo_generate_map` | 生成地图可视化数据 | locations |
| `geo_analyze_region` | 区域分析 | region |
| `geo_plan_route` | 地理路径规划 | waypoints |

### 调用示例

```bash
# 获取工具列表
curl -s http://localhost:5000/api/v1/tools

# 搜索知识图谱
curl -X POST -H 'Content-Type: application/json' -d '{
  "tool": "kg_search_entities",
  "parameters": { "query": "腾讯", "limit": 5 }
}' http://localhost:5000/api/v1/tools

# 查找实体间路径
curl -X POST -H 'Content-Type: application/json' -d '{
  "tool": "kg_find_path",
  "parameters": { "fromEntity": "腾讯", "toEntity": "京东" }
}' http://localhost:5000/api/v1/tools

# 计算地理距离
curl -X POST -H 'Content-Type: application/json' -d '{
  "tool": "geo_calculate_distance",
  "parameters": { "from": "北京", "to": "上海" }
}' http://localhost:5000/api/v1/tools

# 分析事件因果关系
curl -X POST -H 'Content-Type: application/json' -d '{
  "tool": "eg_analyze_causality",
  "parameters": { "event": "芯片短缺", "direction": "both" }
}' http://localhost:5000/api/v1/tools
```

### 返回结构

```typescript
interface ToolCallResult {
  success: boolean;           // 是否成功
  data?: any;                 // 返回数据
  error?: string;             // 错误信息
  summary?: string;           // 结果描述
  visualization?: {           // 可视化数据
    type: 'knowledge_graph' | 'event_graph' | 'map' | 'chart' | 'table' | 'text';
    data: any;
  };
  duration?: number;          // 调用耗时（毫秒）
}
```

### 可视化类型

| 类型 | 说明 | 支持的工具 |
|------|------|-----------|
| `knowledge_graph` | 知识图谱可视化 | kg_* 工具 |
| `event_graph` | 事件图谱可视化 | eg_* 工具 |
| `map` | 地图可视化 | geo_* 工具 |
| `chart` | 图表可视化 | 分析类工具 |
| `table` | 表格展示 | 列表类查询 |
| `text` | 纯文本 | 文本类结果 |

## 交互历史记录系统

### 页面路径
`/interaction-history`

### 功能特性
- 按用户ID、时间范围、事件类型筛选
- 分页展示详细的交互历史
- 每条记录可查看完整上下文和结果
- 支持导出为JSON/CSV

### API接口
```
GET /api/interactions - 获取交互历史列表
GET /api/interactions/stats - 获取交互统计
```

## 数据导出系统

### API接口
`POST /api/v1/data-export`

### 支持的导出类型
| 类型 | 说明 | 字段 |
|------|------|------|
| `interaction_history` | 交互历史 | userId, eventType, query, result, timestamp |
| `user_profile` | 用户画像 | userId, interests, preferences, history |
| `feedback_data` | 反馈数据 | userId, itemId, actionType, value, timestamp |

### 导出格式
- **JSON**: 完整结构化数据
- **CSV**: 表格格式，便于Excel处理

### 调用示例
```bash
curl -X POST -H 'Content-Type: application/json' -d '{
  "type": "interaction_history",
  "format": "json",
  "userId": "user123",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}' http://localhost:5000/api/v1/data-export
```

## 隐私设置系统

### 页面路径
`/privacy-settings`

### 功能特性
- 数据使用偏好设置
- 数据导出请求
- 数据删除请求
- 隐私政策展示

### 数据使用偏好
```typescript
interface PrivacyPreferences {
  allowPersonalization: boolean;   // 允许个性化推荐
  allowDataCollection: boolean;    // 允许数据收集
  allowThirdPartySharing: boolean; // 允许第三方共享
  dataRetentionDays: number;       // 数据保留天数
}
```

## 网络可视化系统

### 页面路径
`/network-visualization`

### 功能特性
- 协同过滤网络图可视化
- 用户-物品关系展示
- 交互式节点操作
- 路径高亮显示

### API接口
```
GET /api/v1/recommendation/network - 获取网络数据
POST /api/v1/recommendation/network - 网络操作（导出/高亮/统计）
```

### 可视化配置
```typescript
interface NetworkVisualizationConfig {
  nodeTypes: ('user' | 'item' | 'category')[];
  edgeTypes: ('interact' | 'similar' | 'belong')[];
  layout: 'force' | 'circular' | 'hierarchical';
  filters: {
    minWeight?: number;
    nodeLimit?: number;
    timeRange?: [number, number];
  };
}
```

### A/B测试支持

```typescript
interface ABTestConfig {
  testId: string;
  testName: string;
  variantA: RecommendationConfig;
  variantB: RecommendationConfig;
  trafficSplit: number;  // 流量分配比例
  metrics: string[];     // 评估指标
  startDate: number;
  endDate?: number;
}
```

### PPO 反馈循环集成

PPO 反馈循环集成模块实现了超参数优化与反馈循环的协同工作：

| 功能 | 说明 |
|------|------|
| 超参数评估 | 定期评估当前超参数效果，生成优化建议 |
| 自动优化 | 基于评估结果自动应用优化配置 |
| A/B 测试集成 | 创建和管理超参数对比实验 |
| 知识提取 | 从训练历史中提取超参数-性能相关性知识 |
| 效果追踪 | 追踪配置使用效果，记录反馈 |

```typescript
import { getPPOFeedbackLoopIntegration } from '@/lib/recommendation/persistence/ppo-integration';

const integration = getPPOFeedbackLoopIntegration();

// 评估超参数效果
const evaluation = await integration.evaluateHyperparams({
  ppoOptimizer,
  trainingHistory,
});

// 自动应用优化建议
if (evaluation.shouldUpdate && evaluation.suggestedConfig) {
  await integration.applyOptimization({
    ppoOptimizer,
    suggestedConfig: evaluation.suggestedConfig,
  });
}

// 创建 A/B 测试
const experiment = await integration.createABTest({
  name: 'learning_rate_comparison',
  variantA: { learningRate: 3e-4, clipEpsilon: 0.2, entropyCoef: 0.01, gaeLambda: 0.95 },
  variantB: { learningRate: 1e-4, clipEpsilon: 0.15, entropyCoef: 0.02, gaeLambda: 0.98 },
});
```

### 统计显著性检验

支持三种统计检验方法：

| 方法 | 适用场景 |
|------|----------|
| `t_test` | 正态分布数据，大样本 |
| `mann_whitney` | 非正态分布，非参数检验 |
| `bootstrap` | 小样本，无分布假设 |

```typescript
import { StatisticalTester } from '@/lib/recommendation/persistence/ab-testing';

// t 检验
const tResult = StatisticalTester.tTest(sampleA, sampleB, 0.05);

// Mann-Whitney U 检验
const uResult = StatisticalTester.mannWhitneyUTest(sampleA, sampleB, 0.05);

// Bootstrap 检验
const bResult = StatisticalTester.bootstrapTest(sampleA, sampleB, { alpha: 0.05, bootstrapSamples: 1000 });

console.log(`显著性: ${tResult.isSignificant}, p值: ${tResult.pValue}, 效应量: ${tResult.effectSize}`);
```

## 目录结构

```
src/
├── app/                        # 页面路由（Next.js App Router）
│   ├── api/                    # API 路由
│   │   ├── admin/review/       # 管理员审核
│   │   ├── analyze*/           # 分析相关 API
│   │   ├── auth/              # 认证 API
│   │   ├── cases/             # 案例 API
│   │   ├── causal/            # 因果推理 API
│   │   ├── chat/              # 聊天 API
│   │   ├── embedding/         # 嵌入 API
│   │   ├── evolution/         # 演化分析 API
│   │   ├── export/            # 导出 API
│   │   ├── interactions/      # 交互记录 API
│   │   ├── knowledge-graph/   # 知识图谱 API
│   │   │   ├── entities/      # 实体管理
│   │   │   ├── conflicts/     # 冲突检测
│   │   │   ├── extract/       # 抽取
│   │   │   ├── relation-types/# 关系类型
│   │   │   └── snapshot/      # 快照
│   │   ├── knowledge/         # 知识管理 API
│   │   │   ├── accumulate/    # 积累
│   │   │   ├── cleanup/       # 清理
│   │   │   ├── evolution/     # 演化
│   │   │   ├── reuse/         # 复用
│   │   │   ├── template/      # 模板
│   │   │   ├── upload/        # 上传
│   │   │   └── usage/         # 使用统计
│   │   ├── memory/            # 记忆 API
│   │   ├── profile/           # 用户画像 API
│   │   ├── quality/           # 质量评估 API
│   │   │   ├── ab-testing/    # A/B 测试
│   │   │   ├── calibration/   # 置信度校准
│   │   │   ├── feedback-loop/  # 反馈闭环
│   │   │   └── reflection/    # 反思机制
│   │   ├── recommendation/    # 推荐 API
│   │   │   ├── dynamic-config/# 动态配置
│   │   │   ├── ppo/          # PPO 优化
│   │   │   └── sequential/    # 序列推荐
│   │   ├── report/            # 报告 API
│   │   ├── search/            # 搜索 API
│   │   ├── storage/           # 存储 API
│   │   └── ...
│   ├── admin/                 # 管理员页面
│   ├── cases/                 # 案例库页面
│   ├── dashboard/             # 仪表盘页面
│   ├── data-management/       # 数据管理页面
│   ├── interaction-history/   # 交互历史页面
│   ├── knowledge/             # 知识管理页面
│   ├── nav/                   # 导航组件
│   ├── network-visualization/ # 网络可视化页面
│   ├── privacy-settings/     # 隐私设置页面
│   └── recommendation/        # 推荐页面
│
├── components/                 # 共享组件
│   ├── ui/                    # shadcn/ui 基础组件
│   ├── auth/                   # 认证相关组件
│   ├── knowledge/             # 知识相关组件
│   ├── quality/               # 质量相关组件
│   ├── recommendation-cards/  # 推荐卡片组件
│   ├── memory/               # 记忆组件
│   ├── user/                 # 用户组件
│   ├── chat/                 # 聊天组件
│   ├── analyze/              # 分析组件
│   ├── evolution/            # 演化组件
│   ├── graph/               # 图谱组件
│   ├── simulation/           # 模拟组件
│   ├── research/            # 研究组件
│   ├── cases/               # 案例组件
│   └── docs/                # 文档组件
│
├── hooks/                     # 自定义 Hooks
│
├── lib/                       # 工具库
│   ├── agents/               # 智能体
│   ├── api/                  # API 客户端
│   ├── auth/                 # 认证
│   ├── causal/               # 因果推理
│   ├── embedding/            # 嵌入
│   ├── evolution/            # 演化
│   ├── graph/                # 图谱构建
│   ├── knowledge/            # 知识管理
│   │   ├── builder/          # 知识构建器
│   │   └── persistence/      # 持久化
│   ├── knowledge-graph/       # 知识图谱
│   ├── langgraph/            # LangGraph 编排
│   ├── memory/               # 记忆系统
│   ├── quality/              # 质量评估
│   ├── recommendation/       # 推荐引擎
│   │   ├── calibration/      # 校准
│   │   ├── persistence/      # 持久化
│   │   ├── ppo/             # PPO 优化
│   │   └── reflection/      # 反思
│   ├── scheduler/           # 调度器
│   ├── storage/             # 存储层
│   ├── tools/               # 工具系统
│   ├── user/                # 用户服务
│   ├── vector/              # 向量存储
│   └── utils.ts
│
├── contexts/                 # React Context
├── storage/database/         # 数据库配置
└── types/                    # 类型定义
```

### 目录设计原则

| 原则 | 说明 |
|------|------|
| **分层清晰** | 页面 / 组件 / 库 / 类型 分离 |
| **API 聚合** | 同类 API 放在同一父目录下 |
| **组件分组** | 按功能领域组织组件（auth/knowledge/quality） |
| **无重复** | 避免功能重复的目录或文件 |
| **命名一致** | 使用 kebab-case 命名目录 |
└── tsconfig.json
```

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- **项目理解加速**：初始可以依赖项目下 `package.json` 文件理解项目类型
- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 `typeof window`、`Date.now()`、`Math.random()` 等动态数据
- **UI 设计规范**：采用 shadcn/ui 组件、风格和规范
- **后台新功能语言偏好**：后续新增**后台能力**（独立服务、批处理、训练/推理管线、重型算法、数据科学脚本等）时，**优先使用 Python** 实现；Next.js `app/api` 保留为 BFF、鉴权、聚合与轻量编排，通过 HTTP/gRPC 等调用 Python 服务。现有 TypeScript 模块若无迁移必要可继续维护，避免无谓重写。

## 用户满意度度量与升级闭环系统

OpenXRec 实现了完整的用户满意度度量和升级闭环系统，通过多层次、多机制的协同优化，确保推荐质量持续提升。

### 一、用户满意度度量机制

#### 1. 多维度反馈收集

系统支持多种反馈类型，全面度量用户满意度：

```typescript
interface RecommendationFeedbackEvent {
  // 直接满意度指标
  satisfied: boolean | null;           // 用户是否满意（综合评价）
  rating: number | null;               // 用户评分（1-5星）

  // 行为数据（隐式满意度）
  clickedItems: string[];             // 点击的推荐项
  likedItems: string[];               // 点赞的推荐项
  converted: boolean;                 // 是否购买/转化
  dwellTime: number | null;           // 停留时间（秒）

  // 质量评估
  relevanceScore: number | null;      // 相关性评分（1-5）
  searchUseful: boolean | null;       // 搜索结果是否有用

  // 场景信息
  scenario: string;
  query: string;
}
```

#### 2. 反馈API接口

**POST /api/v1/feedback**

支持收集的反馈包括：
- **满意度评分**：1-5分制
- **点赞/点踩**：二值反馈
- **点击行为**：追踪用户点击哪些推荐项
- **停留时长**：衡量推荐吸引力
- **转化行为**：是否产生实际价值
- **相关性评分**：推荐结果与需求匹配度

#### 3. 多维度质量评估

系统通过5个维度衡量推荐质量：

| 维度 | 说明 | 评估方式 |
|------|------|----------|
| `comprehensiveness` | 全面性 | 推荐覆盖面是否完整 |
| `accuracy` | 准确性 | 推荐是否准确匹配需求 |
| `timeliness` | 时效性 | 推荐内容是否及时 |
| `clarity` | 清晰度 | 解释是否清晰易懂 |
| `actionability` | 可操作性 | 推荐是否可执行 |

### 二、升级闭环工作流程

OpenXRec 的升级闭环采用**多层次、多机制的协同优化架构**：

#### 架构总览

```
用户请求 → 推荐生成 → 用户反馈
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
[校准系统]    [配置优化]    [自适应优化]
    ↓               ↓               ↓
置信度校准    策略权重调整    关键词优化
阈值调整      规则精细化      置信度校准
    ↓               ↓               ↓
    └───────────────┼───────────────┘
                    ↓
              [PPO强化学习]
                    ↓
            超参数优化
            策略进化训练
                    ↓
              [反馈优化服务]
                    ↓
            多维度策略调整
            学习模式挖掘
                    ↓
              └─────┬─────┘
                    ↓
            下一轮推荐请求
                    ↓
            （质量提升）
```

### 三、五大升级闭环详解

#### 🔵 闭环1：置信度校准系统（Calibration System）

**核心文件**：
- `src/lib/recommendation/calibration/`
- `src/app/api/v1/feedback/route.ts`

**工作流程**：

```
用户反馈 → 校准曲线生成 → 置信度校准 → 阈值调整 → 提升预测准确性
```

**核心机制**：

1. **反馈收集**
   - 记录预测置信度与实际结果的对应关系
   - 按置信度区间（0-0.1, 0.1-0.2, ...）分组统计

2. **校准曲线生成**
   ```typescript
   interface CalibrationPoint {
     confidenceBin: [number, number];  // 置信度区间
     count: number;                    // 该区间样本数
     actualAccuracy: number;           // 实际准确率
     calibrationError: number;        // 校准误差（预测-实际）
   }
   ```

3. **动态阈值调整**
   - **高置信度阈值**：默认0.8，根据实际准确率调整
   - **低置信度阈值**：默认0.5，根据准确率调整
   - 调整策略：`adaptive`，24小时评估一次
   - 调整幅度：单次最大0.05

4. **校准方法**
   - `histogram_binning`：直方图分箱（默认）
   - `isotonic_regression`：保序回归
   - `platt_scaling`：Platt缩放
   - `beta_scaling`：Beta缩放

**优化效果**：
- 期望校准误差（ECE）：持续降低
- 高置信度预测的准确率：目标≥85%
- 决策准确性：提升15-20%

#### 🟢 闭环2：配置优化智能体（ConfigurationAgent）

**核心文件**：
- `src/lib/recommendation/dynamic-config.ts`

**工作流程**：

```
用户行为反馈 → LLM分析 → 策略权重调整 → 场景级优化 → 个性化推荐
```

**核心机制**：

1. **反馈收集**
   - 收集用户行为：点击、点赞、购买、分享、评分
   - 按策略类型统计性能
   - 计算CTR、转化率、停留时长

2. **LLM智能分析**
   - 识别场景特征
   - 分析用户偏好
   - 生成优化建议

3. **策略权重动态调整**
   ```typescript
   interface StrategyWeights {
     content_based: number;    // 基于内容
     collaborative: number;    // 协同过滤
     knowledge_based: number;  // 知识图谱
     agent_based: number;      // 智能体驱动
     causal_based: number;     // 因果推断
     sequential: number;       // 序列推荐
     multi_behavior: number;   // 多行为推荐
   }
   ```

4. **三阶段演进**
   - **阶段1（Static）**：保留现有领域适配架构
   - **阶段2（Scenario Differentiated）**：场景级差异化配置
   - **阶段3（Dynamic Learning）**：智能体驱动的动态学习

**优化效果**：
- 策略权重：根据效果自动调整
- 个性化程度：用户级配置
- 响应速度：实时调整

#### 🟠 闭环3：自适应优化智能体（AdaptiveOptimizerAgent）

**核心文件**：
- `src/lib/recommendation/adaptive-optimizer.ts`

**工作流程**：

```
意图判断反馈 → 关键词优化 → 置信度校准 → 兜底策略升级
```

**核心机制**：

1. **规则精细化**
   - 动态优化关键词列表
   - 使用LLM分析错误案例
   - 发现新的高价值关键词

   ```typescript
   interface KeywordRule {
     keyword: string;
     category: 'search' | 'no_search' | 'ambiguous';
     confidence: number;        // 规则置信度（基于历史准确率）
     matchCount: number;        // 匹配次数
     correctCount: number;      // 正确次数
   }
   ```

2. **置信度校准**
   - 收集意图判断反馈
   - 按置信度区间校准
   - 动态调整规则置信度

3. **多级兜底管理**
   ```
   L1: LLM (95% 成功率)
   L2: Rule (75% 成功率)
   L3: History (60% 成功率)
   L4: Popular (40% 成功率)
   L5: Random (10% 成功率，默认禁用)
   ```
   - 连续失败3次 → 升级
   - 连续成功10次 → 降级

4. **自动优化触发条件**
   - 新增反馈 ≥ 100条
   - 距离上次优化 ≥ 1小时
   - 手动触发优化API

**优化效果**：
- 意图识别准确率：提升20-30%
- 关键词规则：从预定义100+扩展到动态学习
- 兜底成功率：自动调整层级

#### 🟣 闭环4：PPO强化学习优化器

**核心文件**：
- `src/lib/recommendation/ppo/`
- `src/app/api/v1/ppo/route.ts`

**工作流程**：

```
用户行为 → 奖励信号计算 → 策略网络训练 → 动作输出 → 策略权重优化
```

**核心机制**：

1. **奖励信号定义**
   ```typescript
   const REWARDS = {
     click:    +1.0,   // 点击
     like:     +2.0,   // 点赞
     purchase: +5.0,   // 购买
     dislike:  -2.0,   // 不喜欢
     skip:     -0.5,   // 跳过
     dwell:    +0.1/秒 // 停留时长
   };
   ```

2. **PPO训练**
   - **状态编码**：用户画像、历史行为、当前上下文
   - **策略网络**：输出策略权重动作
   - **价值网络**：评估状态价值
   - **损失函数**：策略损失 + 价值损失 + 熵损失

3. **自适应超参数调整**
   - 学习率：自适应调整（线性衰减、余弦退火）
   - 裁剪参数（clipEpsilon）：基于KL散度
   - 熵系数：基于熵值

4. **版本管理**
   - 保存超参数版本
   - 专家审核通过
   - 支持回滚到历史版本

5. **训练触发条件**
   - 缓冲区样本 ≥ 256
   - 距离上次训练 ≥ 1小时
   - 手动调用训练API

**优化效果**：
- 策略权重：基于实际效果优化
- 奖励累积：最大化长期奖励
- 泛化能力：适应不同用户群体

#### 🔴 闭环5：反馈驱动优化服务（FeedbackOptimizer）

**核心文件**：
- `src/lib/quality/feedback-optimizer.ts`

**工作流程**：

```
多维度反馈 → 策略调整 → 学习模式 → 个性化配置
```

**核心机制**：

1. **反馈类型处理**
   - **评分反馈**：根据1-5分调整分析深度
   - **点赞/点踩**：调整置信度阈值
   - **维度评分**：针对性优化5个维度
   - **错误纠正**：修复实体、关系、因果等错误
   - **改进建议**：根据优先级调整策略
   - **偏好设置**：个性化分析深度、广度、速度

2. **策略调整规则**
   ```typescript
   // 低分反馈（≤2分）
   if (rating <= 2) {
     searchDepth += 1;      // 增加搜索深度
     searchBreadth += 1;    // 增加搜索广度
     causalDepth += 1;      // 增加因果深度
     scenarioCount += 1;    // 增加场景数量
   }

   // 高分反馈（≥4分）
   else if (rating >= 4) {
     searchDepth -= 0.5;    // 降低成本
   }
   ```

3. **学习模式挖掘**
   - 分析历史反馈模式
   - 识别负面模式（低分、纠正）
   - 自动生成学习规则
   - 持续学习优化

4. **用户偏好管理**
   - 分析偏好：深度、广度、速度、信息源
   - 个性化策略：用户级配置
   - 持续更新：基于反馈迭代

**优化效果**：
- 分析质量：根据反馈持续提升
- 个性化程度：用户级偏好配置
- 响应速度：实时调整策略

### 四、关键特性总结

#### 1. 多维度反馈
- **显式反馈**：评分、点赞、评论
- **隐式反馈**：点击、停留、转化
- **质量反馈**：5维度评估

#### 2. 多层次优化
- **实时层**：置信度校准
- **策略层**：配置优化、规则精细化
- **模型层**：PPO强化学习
- **个性化层**：用户偏好

#### 3. 自动化学习
- 智能体分析
- 规则自动生成
- 权重动态调整
- 持续迭代优化

#### 4. 安全可控
- 专家审核机制
- 版本管理
- 回滚能力
- 阈值保护

#### 5. 数据驱动
- 基于真实用户反馈
- A/B测试验证
- 统计显著性检验
- 效果持续追踪

### 五、使用示例

#### 提交反馈

```bash
curl -X POST -H 'Content-Type: application/json' -d '{
  "userId": "user123",
  "requestId": "req_123",
  "intentConfidence": 0.85,
  "decision": "high_confidence_skip_search",
  "predictionSource": "llm",
  "searchExecuted": false,
  "satisfied": true,
  "rating": 4,
  "clickedItems": ["rec_1", "rec_2"],
  "scenario": "learning",
  "query": "推荐Python学习资源"
}' http://localhost:5000/api/v1/feedback
```

#### 获取反馈统计

```bash
curl http://localhost:5000/api/v1/feedback?windowDays=7
```

#### 触发PPO训练

```bash
curl -X POST -H 'Content-Type: application/json' -d '{
  "operation": "train"
}' http://localhost:5000/api/v1/ppo
```

### 六、监控与可视化

#### 关键指标

| 指标 | 说明 | 目标值 |
|------|------|--------|
| ECE | 期望校准误差 | < 0.1 |
| 高置信度准确率 | >0.8 置信度的实际准确率 | ≥ 85% |
| 意图识别准确率 | 意图判断准确性 | ≥ 90% |
| CTR | 点击率 | ≥ 5% |
| 转化率 | 购买/转化比例 | ≥ 2% |
| 平均评分 | 用户平均满意度 | ≥ 4.0 |

#### 可视化仪表盘

访问 `/dashboard` 页面可查看：
- 置信度校准曲线
- 策略权重趋势
- 反馈统计
- A/B测试结果
- 训练历史

---

## 版本更新历史

### V1.4 (当前版本)

**升级与修复**
1. **Next.js 升级到 16.2.2** - 升级后修复了开发环境中的 "Functions are not valid as a React child" 错误
2. **保留之前所有修复** - ClientTabs 组件、类型安全修复、Next.js 配置优化

**升级验证**
- 服务正常运行于 `http://localhost:5000` ✅
- API 接口正常工作 ✅
- 开发环境错误已修复 ✅
- 控制台无异常日志 ✅

### V1.3

**修复与优化**
1. **移除 react-dev-inspector 依赖** - 解决开发环境中的组件渲染问题
2. **创建 ClientTabs 组件** - 解决 Radix UI Tabs SSR/客户端 hydration 不匹配问题
3. **类型安全修复** - 修复 `factor.value` 和 `rec.description` 的类型安全问题，使用 `String()` 包装确保渲染安全
4. **Next.js 配置优化** - 禁用 React 严格模式，减少开发环境警告

**已知问题**
- "Functions are not valid as a React child" 是 Next.js 16 + React 19 的框架级开发模式已知问题，仅影响开发环境，不影响生产环境功能

### V1.2

**新增功能**
1. **关系类型管理系统** - 支持动态抽取、合并聚类、层级管理
   - 15+种预定义关系类型（资本、商业、组织、业务、影响）
   - LLM动态抽取新关系类型
   - 基于编辑距离的相似度匹配
   - 关系类型合并聚类
   - 父子层级关系管理
   - 同义词自动管理

### V1.1

**新增功能**
1. **可视化仪表盘增强** - 超参数趋势图、相关性热力图、版本对比图、散点图矩阵
2. **交互历史记录页面** - 支持筛选、分页、详情查看、数据导出
3. **数据导出功能** - 支持JSON/CSV格式，导出交互历史、用户画像、反馈数据
4. **隐私设置页面** - 数据使用偏好设置、数据导出、数据删除请求
5. **贝叶斯优化器** - 高斯过程代理模型、RBF/Matérn核函数、EI/UCB/PI采集函数
6. **规则发现引擎** - Apriori关联规则挖掘、Granger因果检验、规则冲突检测
7. **批量操作支持** - 批量保存版本、更新知识、导入历史、存储经验
8. **智能策略生成器** - 基于场景的策略推荐、性能预测、策略组合
9. **工具调用系统** - 知识图谱、事件图谱、地理地图工具封装

**工具系统**
- 16个可调用工具（知识图谱5个、事件图谱5个、地理地图6个）
- 统一的工具定义和调用接口
- 支持可视化数据返回

### V1.0

**核心功能**
1. **多智能体推荐引擎** - 支持内容、协同、知识图谱、因果推断等多种策略
2. **可解释性生成** - 每个推荐结果附带自然语言解释
3. **反馈闭环优化** - 基于用户反馈的动态配置学习
4. **序列推荐智能体** - 基于行为序列的智能推荐
5. **评估指标系统** - 完整的推荐质量评估框架
6. **A/B测试支持** - 支持推荐策略的对比测试

**架构特点**
- 继承五层智能体架构，针对推荐场景特化
- 支持多策略灵活组合与动态权重调整
- 完全透明的推荐过程，可审计可追溯
