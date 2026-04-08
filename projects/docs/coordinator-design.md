# True Coordinator 设计

## 当前问题

当前的 `AgentOrchestrator` 是硬编码的顺序调用，不是真正的协调器：

```typescript
// ❌ 当前实现（编排器模式）
await perception.perceive(...)
await cognition.cognize(...)
await decision.decide(...)
await action.execute(...)
await evolution.evolve(...)
```

## 真正的协调器设计

### 1. 协调器Agent（CoordinatorAgent）

```typescript
class CoordinatorAgent extends TrueAgent {
  constructor(llmClient: LLMClient) {
    super({
      id: 'coordinator',
      name: '协调器',
      layer: 'decision',  // 协调器属于决策层
      description: '任务理解、Agent调度、结果整合'
    });
    
    // 注册工具
    this.registerTool({
      name: 'dispatch_agent',
      description: '调度指定Agent执行任务',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', enum: ['perception', 'cognition', 'decision', 'action', 'evolution'] },
          task: { type: 'string' },
          input: { type: 'object' }
        }
      },
      execute: async (params) => {
        const agent = this.getAgent(params.agent_id);
        return await agent.execute(params.task, params.input);
      }
    });
    
    this.registerTool({
      name: 'plan_workflow',
      description: '根据任务特点规划Agent工作流',
      parameters: {
        type: 'object',
        properties: {
          workflow: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                agent: { type: 'string' },
                task: { type: 'string' },
                dependencies: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      execute: async (params) => {
        return params.workflow;
      }
    });
  }
  
  async coordinate(task: string): Promise<any> {
    // 1. 理解任务
    const understanding = await this.think(
      `分析以下任务，理解需要完成什么：${task}`
    );
    
    // 2. 规划工作流（动态决策需要哪些Agent）
    const workflow = await this.decide(
      '根据任务特点，规划需要哪些Agent参与，以及执行顺序',
      this.tools.get('plan_workflow')
    );
    
    // 3. 执行工作流
    const results = {};
    for (const step of workflow) {
      // 检查依赖是否完成
      if (step.dependencies) {
        const depsCompleted = step.dependencies.every(dep => results[dep]);
        if (!depsCompleted) {
          continue; // 跳过依赖未完成的步骤
        }
      }
      
      // 调度Agent执行
      results[step.agent] = await this.executeTool('dispatch_agent', {
        agent_id: step.agent,
        task: step.task,
        input: results
      });
    }
    
    return results;
  }
}
```

### 2. 动态工作流示例

**简单任务**（仅需感知+行动）：
```json
{
  "workflow": [
    {
      "agent": "perception",
      "task": "搜索相关信息",
      "dependencies": []
    },
    {
      "agent": "action",
      "task": "生成简要报告",
      "dependencies": ["perception"]
    }
  ]
}
```

**复杂任务**（全流程）：
```json
{
  "workflow": [
    {
      "agent": "perception",
      "task": "深度搜索多源信息",
      "dependencies": []
    },
    {
      "agent": "cognition",
      "task": "构建因果链、识别关键因素",
      "dependencies": ["perception"]
    },
    {
      "agent": "decision",
      "task": "多场景推演、概率评估",
      "dependencies": ["cognition"]
    },
    {
      "agent": "action",
      "task": "生成详细分析报告",
      "dependencies": ["decision"]
    },
    {
      "agent": "evolution",
      "task": "质量检查、反馈优化",
      "dependencies": ["action"]
    }
  ]
}
```

### 3. Agent自主决策

每个Agent可以根据需要请求其他Agent协助：

```typescript
class PerceptionAgent extends TrueAgent {
  async perceive(topic: string): Promise<any> {
    // 1. 初步搜索
    const initialResults = await this.search(topic);
    
    // 2. 自主判断：信息是否充足？
    const sufficiency = await this.think(
      '当前信息是否充足？是否需要更多信息？',
      { results: initialResults }
    );
    
    if (!sufficiency.isSufficient) {
      // 3. 自主决策：请求认知Agent协助理解
      const help = await this.sendMessage(
        'cognition',
        'request',
        {
          need: '理解复杂信息',
          context: initialResults
        }
      );
      
      return { ...initialResults, ...help };
    }
    
    return initialResults;
  }
}
```

## 关键改进

| 特性 | 当前实现 | 改进后 |
|------|---------|--------|
| 工作流 | 硬编码固定顺序 | 协调器动态规划 |
| Agent调度 | 编排器直接调用 | 协调器通过工具调用 |
| Agent自主性 | 被动执行任务 | 可主动请求协作 |
| 并行执行 | ❌ 不支持 | ✅ 支持无依赖的Agent并行 |
| 任务适配 | 所有任务相同流程 | 根据任务特点调整 |

## 实施步骤

1. 创建 `CoordinatorAgent` 类
2. 实现工作流规划能力（基于LLM）
3. 实现Agent调度工具
4. 允许Agent间主动通信
5. 支持并行执行（无依赖的Agent）
