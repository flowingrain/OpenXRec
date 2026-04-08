# 自定义Agent开发指南

## 概述

本文档介绍如何在宏观态势感知平台中开发自定义Agent。

## Agent架构

平台采用**四层架构**设计：

```
感知层(Perception) → 认知层(Cognition) → 决策层(Decision) → 行动层(Action)
```

### 1. 感知层 (Perception)
- 理解用户输入
- 从记忆中检索相关信息
- 识别上下文和意图

### 2. 认知层 (Cognition)
- 深度分析输入内容
- 建立关联关系
- 推断潜在影响

### 3. 决策层 (Decision)
- 选择执行策略
- 确定能力调用
- 规划响应结构

### 4. 行动层 (Action)
- 执行具体任务
- 生成响应内容
- 保存记忆

## 快速开始

### 创建基础Agent

```typescript
import { BaseAgent, AgentContext, AgentConfig } from '@/lib/agents/memory-enhanced-agents';

export class MyCustomAgent extends BaseAgent {
  constructor(context: AgentContext) {
    super({
      id: 'my-custom-agent',
      name: '我的自定义Agent',
      description: 'Agent的功能描述',
      capabilities: [
        {
          name: 'analyze_data',
          description: '分析数据',
          parameters: { data: 'any' },
          execute: async (params, ctx) => {
            return `分析结果: ${params.data}`;
          }
        }
      ],
      personality: '你是一个专业的分析师...'  // Agent的个性化设定
    }, context);
  }
  
  // 可选：重写认知层逻辑
  protected async cognize(input: string, perception: AgentThought): Promise<AgentThought> {
    // 自定义认知逻辑
    const prompt = `基于感知：${perception.content}
    
请进行专业分析...`;

    const response = await this.context.llmClient.chat([
      { role: 'user', content: prompt }
    ]);
    
    return {
      type: 'cognition',
      content: response,
      confidence: 0.8,
      timestamp: Date.now()
    };
  }
}
```

### 注册Agent到工厂

```typescript
// 在 src/lib/agents/memory-enhanced-agents.ts 中
export class AgentFactory {
  createAgent(type: string): BaseAgent {
    switch (type) {
      case 'my-custom-agent':
        return new MyCustomAgent(this.context);
      // ... 其他Agent
    }
  }
  
  listAvailableAgents() {
    return [
      // 添加你的Agent
      {
        id: 'my-custom-agent',
        name: '我的自定义Agent',
        description: 'Agent的功能描述'
      }
    ];
  }
}
```

## 记忆系统集成

### 读取记忆

```typescript
// 搜索相关记忆
const memories = await this.context.memoryManager.recall(query, 5);

// 获取历史摘要
const history = this.context.memoryManager.getHistorySummary();
```

### 写入记忆

```typescript
// 添加长期记忆
await this.context.memoryManager.addMemory({
  type: 'fact',
  content: '重要信息',
  metadata: {
    timestamp: Date.now(),
    importance: 0.9,
    accessCount: 1,
    lastAccessed: Date.now()
  }
});

// 学习用户偏好
await this.context.memoryManager.learnPreference('language', 'zh-CN');
```

### 更新上下文

```typescript
await this.context.memoryManager.updateContext({
  topic: '当前分析主题',
  entities: ['实体1', '实体2']
});
```

## 能力定义

### 基本结构

```typescript
interface AgentCapability {
  name: string;           // 能力名称
  description: string;    // 能力描述
  parameters: Record<string, any>;  // 参数定义
  execute: (params: any, context: AgentContext) => Promise<any>;
}
```

### 示例：数据分析能力

```typescript
{
  name: 'analyze_data',
  description: '分析数据特征和趋势',
  parameters: {
    data: 'any[]',
    options: {
      method: 'string',
      period: 'number'
    }
  },
  execute: async (params, ctx) => {
    const { data, options } = params;
    
    // 1. 数据预处理
    const processed = preprocessData(data);
    
    // 2. 执行分析
    const result = await analyze(processed, options);
    
    // 3. 保存到记忆
    await ctx.memoryManager.addMemory({
      type: 'result',
      content: JSON.stringify(result),
      metadata: {
        timestamp: Date.now(),
        importance: 0.7,
        accessCount: 1,
        lastAccessed: Date.now()
      }
    });
    
    return result;
  }
}
```

## 最佳实践

### 1. 记忆重要性设计

```typescript
// 重要性分级
const importance = {
  critical: 0.95,   // 关键决策信息
  high: 0.8,        // 重要事实和结果
  medium: 0.6,      // 一般对话内容
  low: 0.3          // 临时信息
};

await this.context.memoryManager.addMemory({
  type: 'fact',
  content: '重要事实',
  metadata: {
    importance: importance.high,
    // ...
  }
});
```

### 2. 错误处理

```typescript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  await this.handleError(error.message);
  throw error;
}
```

### 3. 状态持久化

```typescript
// 保存中间状态
await this.context.agentStateManager.saveState({
  agentId: this.config.id,
  sessionId: this.context.sessionId,
  status: 'running',
  currentTask: '数据预处理',
  intermediateResults: {
    step1: result1,
    step2: result2
  }
});

// 恢复状态
const savedState = await this.context.agentStateManager.loadState(
  this.config.id,
  this.context.sessionId
);
```

### 4. 流式输出

```typescript
// 在API路由中实现流式响应
const stream = new ReadableStream({
  async start(controller) {
    const send = (data: any) => {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
      );
    };
    
    await send({ type: 'progress', message: '开始分析...' });
    
    const result = await agent.process(query);
    
    await send({ type: 'complete', result });
    controller.close();
  }
});
```

## 完整示例

参考 `src/lib/custom-agents-example.ts` 中的完整实现：

1. **数据可视化Agent** - 自动生成图表配置
2. **风险评估Agent** - 多维度风险分析
3. **舆情分析Agent** - 社交媒体情感分析
4. **知识图谱Agent** - 实体关系抽取

## 调试技巧

### 1. 查看记忆状态

```bash
curl http://localhost:5000/api/memory?action=stats
```

### 2. 搜索记忆

```bash
curl "http://localhost:5000/api/memory?action=search&query=关键词"
```

### 3. 查看会话历史

```bash
curl http://localhost:5000/api/sessions
```

## 性能优化

### 1. 记忆衰减

系统会自动清理过期记忆：

```typescript
// 超过30天且访问次数少的记忆会被清理
await store.cleanup();
```

### 2. 检索优化

- 使用关键词匹配
- 设置合理的limit值
- 优先检索高重要性记忆

### 3. 并行执行

```typescript
// 并行执行多个Agent
const results = await Promise.all(
  agents.map(agent => agent.process(query))
);
```

## 扩展阅读

- [记忆系统文档](./memory-system.md)
- [三层架构设计](../README.md#架构设计)
- [TypeScript独立运行指南](./typescript-standalone.md)
