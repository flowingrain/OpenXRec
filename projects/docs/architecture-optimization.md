# True Agent 架构优化方案

## 问题总结

### 1. 五层架构设计问题
❌ 粒度不匹配（过于抽象）
❌ 流水线刚性（固定顺序）
❌ 进化层无实际作用（单次分析无法学习）
❌ 缺少核心功能Agent（因果链、场景推演、信源评估）

### 2. 技术栈选择问题
❌ TypeScript在Agent领域生态薄弱
❌ 没有成熟的Agent框架支持
❌ 需要手动实现大量功能

### 3. 协调器问题
❌ 当前是硬编码的编排器，不是真正的协调器
❌ Agent无法自主决策
❌ 无法根据任务动态调整工作流

### 4. 平台命名
✅ 推荐使用：**态势智联 (Strategic Agent Nexus)**

---

## 改进方案：三层混合架构 + 真正的协调器

### 架构图

```
┌──────────────────────────────────────────────────────────┐
│                      协调器 Agent                         │
│          (任务理解 → 工作流规划 → 动态调度 → 结果整合)     │
└──────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   感知层       │   │   认知层       │   │   行动层       │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ • 信息搜索Agent│   │ • 因果推理Agent│   │ • 报告生成Agent│
│ • 信源评估Agent│   │ • 场景推演Agent│   │ • 质量检查Agent│
│ • 时间线Agent  │   │ • 关键因素Agent│   │ • 可视化Agent  │
└───────────────┘   └───────────────┘   └───────────────┘
```

### 协调器工作流程

```python
# Python伪代码（推荐后端实现）

class CoordinatorAgent:
    async def analyze(self, task: str):
        # 1. 理解任务
        understanding = await self.llm.think(
            f"分析任务需求：{task}"
        )
        
        # 2. 动态规划工作流（根据任务复杂度）
        if understanding.complexity == "simple":
            workflow = ["perception", "action"]
        elif understanding.complexity == "medium":
            workflow = ["perception", "cognition", "action"]
        else:  # complex
            workflow = [
                ("perception", "search"),
                ("perception", "evaluate"),
                ("cognition", "causal"),
                ("cognition", "scenario"),
                ("action", "report"),
                ("action", "quality_check")
            ]
        
        # 3. 执行工作流（支持并行）
        results = {}
        for step in self.parallel_scheduler(workflow):
            results[step.agent] = await self.dispatch(
                step.agent, 
                step.task, 
                results
            )
        
        # 4. 整合结果
        return await self.synthesize(results)
```

### 动态工作流示例

**简单任务**："今天美元汇率"
```json
{
  "workflow": [
    {"agent": "perception", "task": "search", "parallel": false},
    {"agent": "action", "task": "brief_report", "parallel": false}
  ]
}
```

**复杂任务**："未来3个月美联储降息概率及影响"
```json
{
  "workflow": [
    {"agent": "perception", "task": "deep_search", "parallel": false},
    {"agent": "perception", "task": "source_eval", "parallel": true},
    {"agent": "cognition", "task": "causal_chain", "parallel": false},
    {"agent": "cognition", "task": "scenario_sim", "parallel": true},
    {"agent": "action", "task": "detailed_report", "parallel": false},
    {"agent": "action", "task": "quality_check", "parallel": true}
  ]
}
```

---

## 技术栈重构方案

### 推荐：前后端分离

```
┌────────────────────────────────────────────┐
│         前端 (Next.js + TypeScript)         │
│  • UI展示                                   │
│  • Agent状态可视化                          │
│  • 图谱可视化 (ReactFlow)                   │
│  • SSE流式接收                              │
└────────────────────────────────────────────┘
                    ↓ REST API / SSE
┌────────────────────────────────────────────┐
│         后端 (Python + FastAPI)             │
│  • True Agent框架                           │
│  • 协调器实现                               │
│  • LLM调用 (LangChain / CrewAI)            │
│  • 数据持久化 (PostgreSQL + Redis)         │
└────────────────────────────────────────────┘
```

### Python后端实现示例

```python
# main.py (FastAPI)
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain.agents import AgentExecutor
from crewai import Agent, Task, Crew, Process

app = FastAPI(title="态势智联 API")

# 定义Agent
searcher = Agent(
    role='信息搜索专家',
    goal='搜索并评估信息源',
    backstory='专业的信息采集Agent',
    tools=[search_tool, evaluate_tool]
)

analyst = Agent(
    role='态势分析师',
    goal='构建因果链、推演场景',
    backstory='深度分析Agent',
    tools=[causal_tool, scenario_tool]
)

writer = Agent(
    role='报告撰写专家',
    goal='生成高质量分析报告',
    backstory='专业报告Agent',
    tools=[report_tool, quality_check_tool]
)

coordinator = Agent(
    role='协调器',
    goal='任务规划、Agent调度、结果整合',
    backstory='中央协调Agent',
    allow_delegation=True,
    tools=[dispatch_tool]
)

@app.post("/api/analyze")
async def analyze(topic: str):
    async def event_stream():
        # 创建Crew（多Agent协作）
        crew = Crew(
            agents=[coordinator, searcher, analyst, writer],
            process=Process.hierarchical,  # 层级协作模式
            manager_llm=coordinator.llm
        )
        
        # 流式输出
        async for event in crew.run_stream(topic):
            yield f"data: {event.json()}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )
```

---

## 新命名：态势智联

### 品牌体系

**中文名称**：态势智联
**英文名称**：Strategic Agent Nexus
**简称**：SAN
**Slogan**：多智体协作，洞见未来态势

### 版本规划

| 版本 | 目标 | 核心改进 |
|------|------|---------|
| v0.4 | 当前 | True Agent基础架构 |
| v0.5 | 近期 | 真正的协调器模式 |
| v0.6 | 中期 | Python后端重构 |
| v0.7 | 中期 | 三层混合架构 |
| v0.8 | 中期 | Agent并行执行 |
| v1.0 | 远期 | 生产级发布 |

---

## 实施建议

### 第一阶段：架构优化（v0.5）
1. 实现真正的协调器Agent
2. 支持动态工作流规划
3. 允许Agent间主动通信
4. 实现简单的并行执行

### 第二阶段：后端重构（v0.6）
1. 使用Python重写Agent核心逻辑
2. 集成CrewAI或LangChain
3. 实现真正的记忆系统（Redis）
4. 实现Agent持久化（PostgreSQL）

### 第三阶段：功能完善（v0.7）
1. 实现三层混合架构
2. 为每层添加专业Agent
3. 优化Agent协作效率
4. 完善可观测性

---

## 总结

| 问题 | 现状 | 改进方向 |
|------|------|---------|
| 架构设计 | 五层抽象，粒度不匹配 | 三层混合，职责清晰 |
| 技术栈 | TS生态薄弱 | 前端TS + 后端Python |
| 协调器 | 硬编码编排器 | 真正的动态协调器 |
| 命名 | v0.3版本描述 | 态势智联 (Strategic Agent Nexus) |
