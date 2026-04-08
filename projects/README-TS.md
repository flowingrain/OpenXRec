# 智弈全域风险态势感知平台 (TypeScript版)

## 版本：v0.7

---

## 📋 版本历史

| 版本 | 特性 |
|-----|------|
| **v0.7** | Chat智能体、反馈循环、领域知识库、持久化Memory、Markdown渲染 |
| v0.6 | 循环修正、动态调度、反馈机制、LLM动态跳过决策 |
| v0.5 | LangGraph智能体编排、增量图谱构建、智能体节点可视化 |
| v0.4 | 事件图谱6层结构、节点标签优化 |
| v0.3 | 多智能体架构、协调器调度 |
| v0.2 | 流式SSE输出、React Flow可视化 |
| v0.1 | 基础分析框架 |

---

## 🎯 核心架构

### 多智能体协作架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户输入：分析主题                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   🎯 协调器 Agent                            │
│  • 动态任务分析：LLM根据任务特性决定执行策略                    │
│  • 跳过决策：独立判断每个智能体是否需要执行                     │
│  • 循环控制：支持修正和重新调度                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ 📊 感知层      │    │ 🔍 认知层      │    │ 📈 行动层      │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ • 搜索Agent    │    │ • 因果推理     │    │ • 报告生成     │
│ • 信源评估     │    │ • 场景推演     │    │ • 质量检查     │
│ • 时间线      │    │ • 关键因素     │    │ • Chat智能体   │
└───────────────┘    └───────────────┘    └───────────────┘
                              ↓
                    ┌───────────────┐
                    │ 🔄 反馈循环    │
                    ├───────────────┤
                    │ • Chat智能体   │
                    │ • 反馈类型识别  │
                    │ • 触发重新分析  │
                    └───────────────┘
```

---

## ✨ v0.7 核心特性

### 1. Chat 智能体

Chat智能体作为LangGraph工作流的一部分，负责处理用户问答和反馈：

```
┌─────────────────────────────────────────────────────────────┐
│                      Chat 智能体                             │
├─────────────────────────────────────────────────────────────┤
│  • 回答用户关于分析结果的问题                                 │
│  • 识别反馈类型（问询/纠正/补充/深入/重分析）                   │
│  • 判断是否需要重新分析                                       │
│  • 确定目标分析节点                                           │
└─────────────────────────────────────────────────────────────┘
```

**反馈类型**：

| 类型 | 说明 | 处理方式 |
|-----|------|---------|
| `question` | 普通问询 | 直接回答，不触发重新分析 |
| `correction` | 纠正错误 | 返回到目标节点重新执行 |
| `supplement` | 补充信息 | 结合新信息重新分析 |
| `deep_dive` | 深入分析 | 对特定方面深入探讨 |
| `rerun` | 完全重新分析 | 从搜索开始重新执行 |

### 2. 反馈循环机制

```
用户输入反馈
      ↓
┌─────────────────────┐
│   Chat 智能体分析    │
└─────────────────────┘
      ↓
┌─────────────────┐    ┌──────────────────────┐
│  普通问询        │    │  需要重新分析          │
│  → 返回回复      │    │  → 返回目标节点重新执行 │
└─────────────────┘    └──────────────────────┘
```

**工作流图支持**：
- 质量检查后可进入chat节点处理用户反馈
- Chat节点根据反馈类型决定下一步：
  - 普通问询 → 结束，等待下次输入
  - 需要重新分析 → 返回到目标节点

### 3. 领域知识库

**位置**：`src/lib/knowledge/index.ts`

**预置知识类型**：
- 经济指标：GDP、CPI、PMI、利率、汇率
- 关键实体：美联储、中国人民银行
- 政策法规：利率决策机制、货币政策框架
- 市场数据：全球股指、债券市场

**检索能力**：
- 关键词匹配
- 类型过滤（经济指标/实体/政策/关系）
- 标签过滤
- 知识上下文生成

```typescript
// 使用示例
const knowledgeManager = getKnowledgeManager();
const context = await knowledgeManager.getKnowledgeContext('美联储降息', {
  maxEntries: 5
});
// 返回：{ entries, summary, entities, suggestedQueries }
```

### 4. 持久化Memory

**位置**：`src/lib/memory/index.ts`

**记忆类型**：
- **短期记忆**：当前会话上下文
- **长期记忆**：跨会话持久化
- **工作记忆**：Agent执行中间状态

**已集成到LangGraph状态**：
```typescript
// AnalysisState 中新增的字段
sessionId: string;           // 会话ID
chatMessages: ChatMessage[]; // 聊天消息历史
userFeedback: string;        // 用户反馈
feedbackType: FeedbackType;  // 反馈类型
```

### 5. Markdown渲染

**位置**：`src/components/MarkdownRenderer.tsx`

**支持格式**：
- 标题 (### 等)
- 列表 (有序和无序)
- 加粗 (**)、斜体 (*)
- 代码块 (```)、行内代码 (`)
- 链接、表格、引用

### 6. 事件图谱可视化

**6层图谱结构**：
```
智能体层 → 信息源 → 时间线 → 因果链 → 关键因素 → 场景推演 → 结论输出
```

**节点颜色规范**：

| 节点类型 | 颜色 | 说明 |
|---------|------|------|
| 信息源 | #5c6bc0 (蓝紫色) | 数据来源 |
| 时间线 | #ff9800 (橙色) | 事件时序 |
| 因果链 | #e53935 (红色) | 因果关系 |
| 关键因素 | #00acc1 (青色) | 驱动因素 |
| 场景推演 | #7b1fa2 (紫色) | 未来场景 |
| 结论输出 | #db2777 (粉色) | 分析结论 |
| 智能体 | #4a5568 (深灰色) | 处理器节点 |

---

## 📁 项目结构

```
src/
├── app/
│   ├── page.tsx                  # 主页面
│   ├── components/
│   │   ├── AnalysisResults.tsx   # 分析结果展示
│   │   ├── AgentProgress.tsx     # Agent进度
│   │   └── ConclusionCard.tsx    # 结论卡片
│   ├── api/
│   │   ├── analyze-langgraph/    # LangGraph分析API (SSE)
│   │   ├── chat-feedback/        # Chat智能体反馈API
│   │   └── chat/                 # 聊天API (备用)
│   └── hooks/
│       ├── useAnalysis.ts        # 分析Hook
│       └── useObservability.ts   # 可观测性Hook
├── lib/
│   ├── langgraph/
│   │   ├── graph.ts              # 工作流图定义
│   │   ├── nodes.ts              # 智能体节点 (含chatNode)
│   │   └── state.ts              # 状态定义 (含Chat状态)
│   ├── memory/
│   │   └── index.ts              # 记忆系统核心
│   └── knowledge/
│       └── index.ts              # 领域知识库
└── components/
    ├── EventGraph.tsx            # 事件图谱组件
    ├── ChatPanel.tsx             # 聊天面板组件
    ├── MarkdownRenderer.tsx      # Markdown渲染组件
    └── ObservabilityPanel.tsx    # 可观测性面板
```

---

## 🛠 技术栈

### 后端
- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript 5
- **智能体编排**: LangGraph JS (@langchain/langgraph)
- **LLM**: doubao-seed-2-0-pro-260215
- **搜索**: coze-coding-dev-sdk (Coze Web Search)

### 前端
- **框架**: Next.js 16, React 19
- **UI组件**: shadcn/ui (Radix UI)
- **样式**: Tailwind CSS 4
- **可视化**: React Flow
- **Markdown**: react-markdown, remark-gfm

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
# Coze API配置
COZE_API_KEY=your_api_key_here
COZE_MODEL=doubao-seed-2-0-pro-260215
```

### 3. 启动开发服务器

```bash
pnpm dev
```

访问 `http://localhost:5000`

---

## 📊 API文档

### 分析接口

```bash
POST /api/analyze-langgraph
Content-Type: application/json

{
  "topic": "美联储降息概率"
}
```

**响应**：SSE流式事件

```
data: {"type":"agent_start","agentId":"coordinator"}
data: {"type":"agent_thinking","agentId":"search","message":"正在搜索..."}
data: {"type":"incremental_graph","nodes":[...],"edges":[...]}
data: {"type":"agent_complete","agentId":"scenario"}
data: {"type":"complete","report":"..."}
```

### 聊天反馈接口

```bash
POST /api/chat-feedback
Content-Type: application/json

{
  "message": "这个分析的时间线不完整，能重新分析吗？",
  "analysisContext": {
    "query": "美联储降息概率",
    "timeline": [...],
    "causalChain": [...],
    "keyFactors": [...],
    "scenarios": [...]
  },
  "chatHistory": []
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "reply": "非常抱歉您发现了时间线不完整的问题...",
    "feedbackType": "correction",
    "needsReanalysis": true,
    "feedbackTarget": "timeline",
    "suggestions": ["重新分析这个方面", "查看原始数据来源"]
  }
}
```

---

## 🔄 反馈循环使用示例

### 前端集成

```tsx
import { ChatPanel } from '@/components/ChatPanel';

function AnalysisPage() {
  const handleReanalysis = (targetNode: string) => {
    // 触发重新分析
    console.log('重新分析节点:', targetNode);
    // 可以调用分析API，传入 targetNode 作为起点
  };

  return (
    <ChatPanel 
      analysisContext={{
        query: '美联储降息概率',
        timeline: analysisData.timeline,
        // ...其他分析结果
      }}
      onReanalysis={handleReanalysis}
    />
  );
}
```

### 反馈类型识别

Chat智能体会自动识别用户反馈类型：

```
用户输入: "时间线不完整"
→ 识别为 correction
→ needsReanalysis: true
→ feedbackTarget: timeline

用户输入: "能详细解释一下这个因果链吗？"
→ 识别为 deep_dive
→ needsReanalysis: false
→ 直接返回详细解释

用户输入: "补充一个信息：鲍威尔最新讲话"
→ 识别为 supplement
→ needsReanalysis: true
→ feedbackTarget: search (重新搜索)
```

---

## 📈 性能优化

### 1. 增量图谱构建
- 每个Agent完成后立即推送更新
- 前端实时渲染，无需等待全部完成

### 2. 智能跳过
- LLM动态判断是否需要执行
- 避免不必要的分析步骤

### 3. 知识库检索
- 预置知识快速检索
- 无需外部API调用

---

## 🔮 Roadmap

### v0.8 规划
- [ ] 多用户支持
- [ ] 分析历史管理
- [ ] 自定义Agent扩展
- [ ] 流式Chat响应

### v0.9 规划
- [ ] 实时数据订阅
- [ ] 预警推送
- [ ] 移动端适配

---

## 📄 许可证

MIT
