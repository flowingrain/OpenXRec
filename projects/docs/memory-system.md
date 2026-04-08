# 记忆系统文档

## 概述

记忆系统是宏观态势感知平台的核心组件，提供会话记忆、长期记忆和Agent状态管理能力。

## 架构设计

```
┌─────────────────────────────────────────────────┐
│                  MemoryManager                  │
│  ┌───────────────┐  ┌──────────────────────┐  │
│  │ 短期记忆      │  │ 长期记忆             │  │
│  │ (Conversation)│  │ (MemoryEntry)        │  │
│  │ - 会话消息    │  │ - 事实/偏好/结果     │  │
│  │ - 当前上下文  │  │ - 语义检索           │  │
│  └───────────────┘  └──────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │         AgentStateManager                │  │
│  │  - 状态持久化                             │  │
│  │  - 中间结果存储                           │  │
│  │  - 错误恢复                               │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│            IMemoryStore (存储抽象层)            │
│  ┌──────────────┐  ┌────────────────────┐      │
│  │ InMemoryStore│  │ FileSystemStore    │      │
│  │ (开发环境)   │  │ (生产环境)         │      │
│  └──────────────┘  └────────────────────┘      │
│                     ┌────────────────────┐      │
│                     │ SupabaseStore      │      │
│                     │ (推荐生产环境)     │      │
│                     └────────────────────┘      │
└─────────────────────────────────────────────────┘
```

## 核心概念

### 1. 会话记忆 (ConversationMemory)

存储当前会话的所有信息：

```typescript
interface ConversationMemory {
  sessionId: string;           // 会话ID
  userId?: string;             // 用户ID
  messages: Message[];         // 消息历史
  context: {                   // 会话上下文
    topic?: string;            // 当前主题
    entities: string[];        // 已识别实体
    preferences: Record<string, any>; // 用户偏好
  };
  createdAt: number;           // 创建时间
  updatedAt: number;           // 更新时间
}
```

### 2. 长期记忆 (MemoryEntry)

持久化存储重要信息：

```typescript
interface MemoryEntry {
  id: string;
  type: 'conversation' | 'fact' | 'preference' | 'context' | 'result';
  content: string;
  metadata: {
    agentId?: string;
    timestamp: number;
    importance: number;      // 0-1, 用于记忆衰减
    accessCount: number;     // 访问次数
    lastAccessed: number;    // 最后访问时间
  };
  embedding?: number[];      // 语义向量(可选)
}
```

### 3. Agent状态 (AgentState)

跟踪Agent执行状态：

```typescript
interface AgentState {
  agentId: string;
  sessionId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentTask?: string;
  intermediateResults: Record<string, any>;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}
```

## 使用指南

### 初始化

```typescript
import { MemoryManager, FileSystemStore } from '@/lib/memory';

// 开发环境：使用内存存储
const memoryManager = new MemoryManager();

// 生产环境：使用文件系统存储
const store = new FileSystemStore();
const memoryManager = new MemoryManager(store);
```

### 会话管理

```typescript
// 创建新会话
const sessionId = await memoryManager.createSession(userId);

// 加载历史会话
await memoryManager.loadSession(sessionId);

// 获取当前会话
const session = memoryManager.getCurrentSession();
```

### 消息交互

```typescript
// 添加用户消息
await memoryManager.addMessage('user', '分析当前经济形势');

// 添加Agent响应
await memoryManager.addMessage('assistant', '分析结果...', agentId);

// 获取历史摘要
const history = memoryManager.getHistorySummary(10);
```

### 长期记忆

```typescript
// 添加事实记忆
await memoryManager.addMemory({
  type: 'fact',
  content: '2024年GDP增长率为5.2%',
  metadata: {
    timestamp: Date.now(),
    importance: 0.9,
    accessCount: 1,
    lastAccessed: Date.now()
  }
});

// 搜索相关记忆
const results = await memoryManager.recall('GDP增长', 5);

results.forEach(r => {
  console.log(`内容: ${r.entry.content}`);
  console.log(`相关性: ${r.relevance}`);
});
```

### 用户偏好

```typescript
// 学习用户偏好
await memoryManager.learnPreference('language', 'zh-CN');
await memoryManager.learnPreference('detail_level', 'high');

// 获取偏好
const language = memoryManager.getPreference('language');
```

### 上下文管理

```typescript
// 更新会话上下文
await memoryManager.updateContext({
  topic: '经济形势分析',
  entities: ['GDP', 'CPI', 'PMI']
});

// 获取上下文增强的提示
const prompt = memoryManager.getContextualPrompt('分析趋势');
```

## 存储实现

### InMemoryStore

适用于开发环境和测试：

```typescript
const store = new InMemoryStore();
```

特点：
- 快速访问
- 重启后数据丢失
- 适合原型开发

### FileSystemStore

适用于单机生产环境：

```typescript
import { FileSystemStore } from '@/lib/memory/persistent-store';

const store = new FileSystemStore();
```

特点：
- 数据持久化
- 支持记忆衰减
- 自动清理过期记忆
- 存储位置：
  - 开发环境：`data/memory-store/`
  - 生产环境：`/tmp/memory-store/`

### SupabaseStore（推荐）

适用于生产环境多实例部署：

```typescript
import { SupabaseStore } from '@/lib/memory/supabase-store';

const store = new SupabaseStore({
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_KEY!
});
```

特点：
- 云端持久化
- 支持向量检索
- 高可用性
- 需要Supabase配置

## 记忆衰减算法

系统采用**时间衰减 + 访问频率**的混合策略：

```typescript
// 相关性计算
function calculateRelevance(entry: MemoryEntry): number {
  let score = entry.metadata.importance;
  
  // 时间衰减 (30天半衰期)
  const ageDays = (Date.now() - entry.metadata.timestamp) / (24 * 60 * 60 * 1000);
  score *= Math.exp(-ageDays / 30);
  
  // 访问频率加权
  score *= Math.log(1 + entry.metadata.accessCount) / 10;
  
  // 类型加权
  const typeWeights = {
    fact: 1.2,
    preference: 1.1,
    context: 1.0,
    conversation: 0.8,
    result: 0.9
  };
  score *= typeWeights[entry.type] || 1.0;
  
  return Math.min(1, Math.max(0, score));
}
```

清理规则：
- 相关性低于 0.05 的记忆将被删除
- 默认 30 天半衰期
- 高频访问的记忆衰减更慢

## API接口

### 会话API

```bash
# 创建会话
POST /api/sessions
Body: { "userId": "user123" }

# 获取会话列表
GET /api/sessions

# 获取单个会话
GET /api/sessions?sessionId=xxx

# 删除会话
DELETE /api/sessions?sessionId=xxx
```

### 记忆API

```bash
# 搜索记忆
GET /api/memory?action=search&query=关键词&limit=10

# 获取统计
GET /api/memory?action=stats

# 添加记忆
POST /api/memory
Body: {
  "type": "fact",
  "content": "重要信息",
  "importance": 0.8
}

# 学习偏好
PUT /api/memory
Body: {
  "key": "language",
  "value": "zh-CN"
}
```

## 最佳实践

### 1. 重要性分级

```typescript
const IMPORTANCE = {
  CRITICAL: 0.95,  // 关键决策信息
  HIGH: 0.8,       // 重要事实和结果
  MEDIUM: 0.6,     // 一般对话内容
  LOW: 0.3         // 临时信息
};
```

### 2. 定期清理

```typescript
// 每天执行一次清理
setInterval(async () => {
  await store.cleanup?.();
}, 24 * 60 * 60 * 1000);
```

### 3. 批量操作

```typescript
// 批量添加记忆
for (const fact of facts) {
  await memoryManager.addMemory({
    type: 'fact',
    content: fact,
    metadata: { ... }
  });
}
```

### 4. 错误处理

```typescript
try {
  await memoryManager.addMessage('user', input);
} catch (error) {
  console.error('Failed to save message:', error);
  // 不影响主流程，继续执行
}
```

## 监控与调试

### 查看存储统计

```bash
curl http://localhost:5000/api/memory?action=stats
```

响应示例：
```json
{
  "currentSession": {
    "sessionId": "session_xxx",
    "messageCount": 15,
    "entityCount": 5,
    "preferenceCount": 3
  },
  "storeType": "InMemoryStore"
}
```

### 文件系统存储统计

```typescript
const store = new FileSystemStore();
const stats = await store.getStats();

console.log(`会话数: ${stats.conversations}`);
console.log(`记忆数: ${stats.memories}`);
console.log(`总大小: ${stats.totalSize} bytes`);
```

## 扩展开发

### 自定义存储实现

```typescript
class CustomStore implements IMemoryStore {
  async saveConversation(memory: ConversationMemory): Promise<void> {
    // 实现存储逻辑
  }
  
  async loadConversation(sessionId: string): Promise<ConversationMemory | null> {
    // 实现加载逻辑
  }
  
  // ... 其他方法
}
```

### 添加向量检索

```typescript
// 使用嵌入模型生成向量
const embedding = await generateEmbedding(content);

await memoryManager.addMemory({
  type: 'fact',
  content,
  embedding, // 存储向量
  metadata: { ... }
});

// 向量相似度搜索
const results = await vectorSearch(queryEmbedding, 10);
```

## 性能优化

### 1. 记忆索引

FileSystemStore 自动维护索引文件 `_index.json`，加速检索。

### 2. 分页查询

```typescript
// 限制返回数量
const results = await memoryManager.recall(query, 5);
```

### 3. 异步写入

```typescript
// 不阻塞主流程
Promise.resolve().then(() => {
  memoryManager.addMemory({ ... });
});
```

## 故障恢复

### Agent状态恢复

```typescript
// 加载上次中断的状态
const state = await agentStateManager.loadState(agentId, sessionId);

if (state?.status === 'running') {
  // 从断点恢复
  const results = state.intermediateResults;
  // 继续执行...
}
```

## 安全考虑

1. **敏感信息**: 不要在记忆中存储密码、密钥等敏感信息
2. **用户隐私**: 遵守数据保护法规，提供数据删除功能
3. **访问控制**: 生产环境应实现用户级别的数据隔离

## 参考资料

- [Agent开发指南](./agent-development-guide.md)
- [TypeScript独立运行指南](./typescript-standalone.md)
