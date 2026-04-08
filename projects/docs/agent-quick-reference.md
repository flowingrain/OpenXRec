# 三层混合架构 - 快速参考卡

## 架构一览图

```
┌────────────────────────────────────────────────────────────┐
│                     🧠 协调器 Agent                         │
│          (任务理解 → 工作流规划 → 动态调度 → 结果整合)       │
└────────────────────────────────────────────────────────────┘
                              ↓
         ┌────────────────────┼────────────────────┐
         ↓                    ↓                    ↓
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   🔍 感知层      │  │   🧩 认知层      │  │   📝 行动层      │
│  Perception     │  │  Cognition      │  │  Action         │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│                 │  │                 │  │                 │
│ 🌐 搜索Agent    │  │ ⛓️ 因果Agent    │  │ 📄 报告Agent    │
│   多源采集      │──│   构建因果链    │──│   生成报告      │
│                 │  │                 │  │                 │
│ ⭐ 信源Agent    │  │ 📊 场景Agent    │  │ ✅ 质量Agent    │
│   可信度评估    │  │   多场景推演    │  │   审核检查      │
│                 │  │                 │  │                 │
│ 📅 时间线Agent  │  │ 🎯 关键因素Agent│  │ 📈 可视化Agent  │
│   事件脉络      │  │   驱动因素      │  │   图谱生成      │
│                 │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
      ↕ 可并行             ↕ 可并行             ↕ 可并行
```

---

## Agent快速索引

### 协调层

| Agent | 职责 | 核心能力 | 调度方式 |
|-------|------|---------|---------|
| **协调器** | 大脑中枢 | 任务理解、工作流规划、动态调度、结果整合 | 自主决策 |

### 感知层

| Agent | 职责 | 输入 | 输出 | 并行 |
|-------|------|------|------|------|
| **搜索Agent** | 多源信息采集 | 关键词 | 信息列表 | ✅ |
| **信源Agent** | 可信度评估 | 信息列表 | 评估结果 | ✅ |
| **时间线Agent** | 事件脉络构建 | 评估结果 | 时间线 | ❌ |

### 认知层

| Agent | 职责 | 输入 | 输出 | 并行 |
|-------|------|------|------|------|
| **因果Agent** | 构建因果链 | 时间线 | 因果图谱 | ❌ |
| **场景Agent** | 多场景推演 | 因果图谱 | 场景预测 | ✅ |
| **关键因素Agent** | 识别驱动因素 | 因果图谱 | 因素列表 | ✅ |

### 行动层

| Agent | 职责 | 输入 | 输出 | 并行 |
|-------|------|------|------|------|
| **报告Agent** | 生成分析报告 | 所有结果 | 结构化报告 | ❌ |
| **质量Agent** | 审核检查 | 分析报告 | 质量评分 | ✅ |
| **可视化Agent** | 生成图谱图表 | 因果图谱 | 可视化数据 | ✅ |

---

## 典型工作流

### 简单任务（单一事件查询）
```
用户查询: "今天美元汇率"

协调器规划: [搜索] → [报告]
         ↓          ↓
    搜索Agent    报告Agent
    
总耗时: ~15秒
```

### 中等任务（趋势分析）
```
用户查询: "最近油价走势分析"

协调器规划: [搜索, 信源] → [时间线] → [因果] → [报告]
           (并行)        (顺序)    (顺序)   (顺序)
            
总耗时: ~45秒
```

### 复杂任务（深度态势分析）
```
用户查询: "未来3个月美联储降息概率及影响分析"

协调器规划:
  Stage 1: [搜索, 信源] ←── 并行
     ↓
  Stage 2: [时间线] ←── 顺序
     ↓
  Stage 3: [因果]
     ↓
  Stage 4: [场景, 关键因素] ←── 并行
     ↓
  Stage 5: [报告]
     ↓
  Stage 6: [质量, 可视化] ←── 并行

总耗时: ~2分钟
```

---

## Agent创建速查

### TypeScript方式
```typescript
class SearchAgent extends BaseAgent {
  id = 'search';
  layer = 'perception';
  
  constructor(llmClient: LLMClient) {
    super(llmClient);
    this.registerTool(webSearchTool);
  }
  
  async execute(input: any): Promise<any> {
    return await this.executeTool('web_search', input);
  }
}
```

### Python + CrewAI方式
```python
searcher = Agent(
    role='信息搜索专家',
    goal='搜索并采集多源信息',
    tools=[web_search_tool],
    verbose=True
)

task = Task(
    description='搜索关于{topic}的信息',
    agent=searcher
)

crew = Crew(agents=[searcher], tasks=[task])
result = crew.run(topic='美联储降息')
```

### 配置驱动方式
```yaml
# agents/search.yaml
agent:
  id: search
  layer: perception
  tools:
    - web_search
  prompts:
    execute: "搜索关于{query}的信息"
```

---

## 关键设计原则

### 1. 单一职责原则
每个Agent只做一件事，做好一件事。

### 2. 明确的输入输出
```typescript
// ✅ 好的设计
SearchAgent: SearchResult ← execute({ query: string })

// ❌ 坏的设计
SearchAgent: any ← execute(anything)
```

### 3. 可组合性
Agent可以自由组合，形成不同的工作流。

### 4. 可并行性
同层Agent可以并行执行，提升效率。

### 5. 失败容错
Agent执行失败时，协调器可以：
- 重试
- 降级（跳过非关键Agent）
- 回滚（撤销已执行任务）

---

## 调试技巧

### 1. 单Agent测试
```typescript
const searchAgent = new SearchAgent(llmClient);
const result = await searchAgent.execute({ query: 'test' });
console.log(result);
```

### 2. 工作流测试
```typescript
const coordinator = new CoordinatorAgent();
coordinator.registerAgent('search', searchAgent);
coordinator.registerAgent('report', reportAgent);

const result = await coordinator.coordinate('test query');
```

### 3. 可观测性
每个Agent都记录：
- 执行时间
- Token消耗
- 输入输出
- 错误日志

---

## 性能优化建议

### 1. 并行化
```typescript
// ❌ 顺序执行 (15s)
await searchAgent.execute();
await evaluatorAgent.execute();

// ✅ 并行执行 (8s)
await Promise.all([
  searchAgent.execute(),
  evaluatorAgent.execute()
]);
```

### 2. 缓存
```typescript
// 缓存搜索结果
const cachedResults = await cache.get(`search:${query}`);
if (cachedResults) {
  return cachedResults;
}
```

### 3. 流式输出
```typescript
// 使用SSE实时推送Agent状态
yield { type: 'agent_status', agent: 'search', status: 'working' };
const result = await searchAgent.execute();
yield { type: 'agent_status', agent: 'search', status: 'completed' };
```

---

## 下一步行动

1. **实现协调器Agent** (v0.5)
   - 动态工作流规划
   - Agent调度机制
   - 并行执行支持

2. **实现核心Agent** (v0.5)
   - 搜索Agent
   - 因果推理Agent
   - 报告生成Agent

3. **完善三层架构** (v0.7)
   - 所有Agent实现
   - Agent协作优化
   - 质量检查机制

4. **Python重构** (v0.6)
   - 迁移到CrewAI
   - 实现记忆系统
   - Agent持久化
