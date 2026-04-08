# 项目说明

## 📦 项目概览

**OpenXRec** - 开放、透明、可解释的多智能体推荐框架

基于 AI 大模型的多智能体协作推荐框架，通过智能体协作实现可解释、透明、开放的个性化推荐。

**技术栈**：纯 TypeScript（Next.js 16 + React 19 + LangGraph JS + Supabase）

**状态**：✅ 已完成，生产就绪

**访问地址**：https://your-domain.com

---

## 🎯 核心定位

### "OpenXRec" 的含义

**Open（开放）+ eXplainable（可解释）+ Recommendation（推荐）**

- **Open（开放）**：推荐算法透明可见，用户可参与配置和调优
- **eXplainable（可解释）**：每个推荐都有清晰的解释和推理路径
- **Recommendation（推荐）**：基于多智能体协作的混合推荐策略

### 典型应用场景

- **电商推荐** → 展示"为什么推荐这个商品"
- **内容推荐** → 解释"因为你浏览过相关内容"
- **服务推荐** → 说明"基于你的偏好匹配"
- **投资推荐** → 提供风险评估和因果分析

---

## 🏗️ 系统架构

### 推荐智能体分层

```
感知层 → 认知层 → 决策层 → 优化层 → 进化层
   ↓        ↓        ↓        ↓        ↓
画像构建   特征提取   排序决策   多样性优化   反馈学习
```

### 核心模块

| 模块 | 说明 |
|------|------|
| **推荐引擎** | 多策略推荐核心实现 |
| **智能体系统** | LangGraph 编排的推荐智能体 |
| **可解释性模块** | 生成自然语言解释 |
| **反馈闭环** | 持续学习与配置优化 |
| **评估系统** | 推荐质量评估指标 |

---

## 📁 目录结构

```
/workspace/projects/
├── src/
│   ├── app/                    # 页面路由
│   │   ├── api/recommendation/ # 推荐 API
│   │   ├── recommendation/     # 推荐页面
│   │   └── interaction-demo/   # 交互演示
│   ├── components/             # 组件
│   │   ├── RecommendationHome.tsx
│   │   ├── RecommendationChatPanel.tsx
│   │   └── RecommendationExplanationPanel.tsx
│   ├── lib/
│   │   ├── recommendation/     # 推荐核心模块
│   │   │   ├── engine.ts       # 推荐引擎
│   │   │   ├── agents.ts       # 推荐智能体
│   │   │   ├── types.ts        # 类型定义
│   │   │   ├── evaluation.ts   # 评估指标
│   │   │   └── dynamic-config.ts
│   │   └── langgraph/          # 智能体编排
│   └── storage/                # 数据存储
├── docs/                       # 文档
│   ├── OpenXRec新架构设计.md
│   ├── 推荐引擎实现详解.md
│   └── ...
└── package.json
```

---

## 🚀 快速开始

### 开发命令

```bash
# 安装依赖（必须使用 pnpm）
pnpm install

# 开发模式
pnpm dev

# 类型检查
pnpm ts-check

# 构建
pnpm build

# 生产运行
pnpm start
```

### 端口说明

- 服务运行在 **5000** 端口
- 热更新自动生效，无需重启

---

## 📊 功能清单

### ✅ 已完成功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 多策略推荐引擎 | ✅ | 内容/协同/知识图谱/因果推断 |
| 推荐智能体系统 | ✅ | 10+ 专业化智能体 |
| 可解释性生成 | ✅ | 6种解释类型 |
| 反馈闭环优化 | ✅ | 动态配置学习 |
| 序列推荐 | ✅ | 基于行为序列 |
| 评估指标系统 | ✅ | Precision/Recall/NDCG/MAP |
| A/B测试支持 | ✅ | 策略对比测试 |

### 📝 后续优化方向

| 方向 | 说明 |
|------|------|
| PPO 策略优化 | 强化学习优化推荐权重 |
| 多模态推荐 | 支持图片/视频等 |
| 实时流式推荐 | WebSocket 实时更新 |
| 跨域迁移学习 | 领域间知识迁移 |

---

## 📖 开发规范

### 包管理

**仅允许使用 pnpm**，严禁使用 npm 或 yarn。

### 代码规范

- TypeScript 严格模式
- Airbnb 编码规范
- 组件采用 shadcn/ui 风格

### 提交规范

遵循 Conventional Commits：
- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试

---

## 📚 相关文档

- [AGENTS.md](./AGENTS.md) - 项目上下文详情
- [README.md](./README.md) - 项目介绍
- [CONTRIBUTING.md](./CONTRIBUTING.md) - 贡献指南
