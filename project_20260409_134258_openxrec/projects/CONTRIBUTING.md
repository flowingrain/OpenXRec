# 贡献指南

感谢您对智弈全域风险态势感知平台的关注！

我们欢迎任何形式的贡献，包括但不限于：修复 Bug、新功能开发、文档改进、性能优化等。

---

## 📋 开始之前

### 行为准则

- 尊重他人
- 建设性反馈
- 遵循开源社区规范
- 提交前确保代码通过测试

### 先沟通再开发

如果您计划开发较大的新功能或进行重大修改，建议先通过 Issue 讨论或联系维护者，避免重复劳动。

---

## 🔧 开发环境搭建

### 环境要求

- Node.js 18+ （推荐 20+）
- pnpm 9+
- Supabase 项目（用于数据库和存储）

### 克隆仓库

```bash
git clone https://github.com/your-org/your-repo.git
cd your-repo
```

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

1. 复制环境变量示例文件：
```bash
cp .env.example .env.local
```

2. 编辑 `.env.local` 文件，填写实际配置：
```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# 大语言模型配置
LLM_MODEL=gpt-4
```

### 初始化数据库

```bash
# 执行数据库迁移脚本
psql -h db.your-project.supabase.co -U postgres -d postgres -f supabase/init.sql
```

### 启动开发服务

```bash
pnpm dev
```

访问 `http://localhost:5000` 查看应用。

---

## 📝 代码规范

### TypeScript

- 使用 TypeScript 5+
- 严格模式已启用
- 所有函数参数必须标注类型
- 禁止使用 `any` 类型

### 代码风格

- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 提交前运行 `pnpm run lint`

```bash
# 代码检查
pnpm run lint

# 代码格式化
pnpm run format
```

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**：
```
feat(causal): 添加因果推断引擎的反事实推断能力

实现了基于 do-calculus 的反事实推断，支持"如果...会怎样"分析场景。

Closes #123
```

---

## 🐛 报告 Bug

### Bug 报告模板

提交 Issue 时请使用以下模板：

```markdown
**Bug 描述**
简洁描述 Bug 是什么

**复现步骤**
1. 进入 '...'
2. 点击 '...'
3. 滚动到 '...'
4. 看到错误

**预期行为**
描述应该发生什么

**截图**
如果适用，添加截图

**环境**
- OS: [e.g. Windows 10]
- Browser: [e.g. Chrome 120]
- Node.js 版本: [e.g. 20.0.0]

**其他信息**
添加其他关于问题的上下文
```

---

## ✨ 新功能请求

### 功能请求模板

提交 Issue 时请使用以下模板：

```markdown
**功能描述**
清晰简洁地描述你希望的功能

**问题背景**
你遇到了什么问题？这个功能如何帮助你解决问题？

**期望方案**
详细描述你希望的功能如何工作

**替代方案**
描述你考虑过的替代方案或功能

**其他信息**
添加其他关于功能请求的上下文或截图
```

---

## 🔄 提交 Pull Request

### 流程

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'feat: add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 开启 Pull Request

### PR 模板

开启 PR 时请填写以下信息：

```markdown
**描述**
简要描述此 PR 的更改

**相关 Issue**
Closes #(issue_number)

**更改类型**
- [ ] Bug 修复
- [ ] 新功能
- [ ] 破坏性更改
- [ ] 文档更新

**检查清单**
- [ ] 代码遵循项目规范
- [ ] 已添加或更新测试
- [ ] 已更新文档
- [ ] 通过所有测试
- [ ] 无 ESLint 错误

**截图**
如果适用，添加截图说明更改
```

---

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test filename.test.ts

# 测试覆盖率
pnpm test:coverage
```

### 编写测试

- 使用 Jest 作为测试框架
- 测试文件放在 `__tests__` 目录下
- 测试文件命名：`filename.test.ts`

**示例**：
```typescript
import { causalInference } from '@/lib/causal/inference-engine';

describe('CausalInference', () => {
  it('should perform counterfactual inference', async () => {
    const result = await causalInference.performCounterfactual(scm, config);
    expect(result).toBeDefined();
    expect(result.counterfactualOutcome).toBeGreaterThan(0);
  });
});
```

---

## 📚 文档

### 文档结构

```
docs/
├── architecture-five-layer.md      # 五层架构设计
├── causal-analysis-design.md       # 因果分析设计
├── knowledge-system-design.md      # 知识系统设计
├── api-reference.md                # API 参考
└── development-guide.md            # 开发指南
```

### 编写文档

- 使用 Markdown 格式
- 添加代码示例
- 更新相关 API 文档
- 保持文档简洁清晰

---

## 🚀 发布流程

1. 更新版本号：`pnpm version patch/minor/major`
2. 更新 CHANGELOG.md
3. 创建发布分支：`git checkout -b release/vX.X.X`
4. 运行测试和构建：`pnpm test && pnpm build`
5. 合并到 main 分支
6. 创建 Git 标签：`git tag vX.X.X`
7. 推送标签：`git push origin vX.X.X`

---

## 📖 获取帮助

- 查看 [文档](./docs/)
- 在 [GitHub Issues](https://github.com/your-org/your-repo/issues) 搜索问题
- 创建新的 Issue 报告问题

---

## 🙏 致谢

感谢所有贡献者！您的贡献让这个项目变得更好。

---

**有任何问题？欢迎联系我们：contact@your-domain.com**
