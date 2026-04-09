# Supabase 数据库配置指南

## 当前状态

项目使用 **Coze 托管的 Supabase**，无需手动配置环境变量，平台自动注入。

## 数据库表

| 表名 | 说明 | 状态 |
|------|------|------|
| `analysis_cases` | 分析案例 | ✅ 已创建 |
| `kg_entities` | 知识图谱实体 | ✅ 已创建 |
| `kg_relations` | 知识图谱关系 | ✅ 已创建 |
| `kg_corrections` | 修正历史 | ✅ 已创建 |
| `kg_snapshots` | 知识图谱快照 | ✅ 已创建 |
| `knowledge_docs` | 知识库文档 | ✅ 已创建 |
| `report_versions` | 报告版本 | ✅ 已创建 |
| `user_preferences` | 用户偏好 | ✅ 已创建 |

## 使用方式

### 获取客户端

```typescript
import { getSupabaseClient } from '@/storage/database/supabase-client';

const supabase = getSupabaseClient();
```

### 查询示例

```typescript
// 查询知识图谱实体
const { data, error } = await supabase
  .from('kg_entities')
  .select('id, name, type, description')
  .eq('type', '机构')
  .order('importance', { ascending: false });

if (error) throw new Error(`查询失败: ${error.message}`);
```

### 插入示例

```typescript
// 插入分析案例
const { data, error } = await supabase
  .from('analysis_cases')
  .insert({
    query: '美联储降息概率分析',
    domain: '货币政策',
    conclusion: { summary: '...' },
    confidence: 0.85,
  })
  .select()
  .maybeSingle();

if (error) throw new Error(`插入失败: ${error.message}`);
```

## 表结构管理

### 同步远端表结构

```bash
coze-coding-ai db generate-models
```

这会将远端数据库的表结构同步到 `src/storage/database/shared/schema.ts`。

### 同步本地表结构到远端

```bash
coze-coding-ai db upgrade
```

这会将 `schema.ts` 中的表结构同步到远端数据库。

## 健康检查

```bash
# API 检查
curl http://localhost:5000/api/supabase/health

# 预期响应
{
  "success": true,
  "connection": "ok",
  "type": "Coze 托管 Supabase",
  "tables": { ... },
  "summary": { "healthy": true }
}
```

## 常见问题

### 1. 环境变量未设置

**错误信息**：`COZE_SUPABASE_URL is not set`

**解决方案**：确保项目已开通 Coze 托管的 Supabase 服务。在 Coze 平台的项目设置中检查是否已启用。

### 2. 表不存在

**错误信息**：`Could not find the table 'public.xxx'`

**解决方案**：
1. 检查 `schema.ts` 中是否定义了该表
2. 执行 `coze-coding-ai db upgrade` 同步表结构

### 3. RLS 权限错误

**错误信息**：`42501` 或权限不足

**解决方案**：检查表是否配置了正确的 RLS 策略。参考 `supabase/init.sql` 中的策略配置。

## 文件位置

```
src/storage/database/
├── supabase-client.ts     # Supabase 客户端
└── shared/
    └── schema.ts          # Drizzle 表结构定义

supabase/
├── init.sql               # 数据库初始化脚本（参考用）
└── README.md              # 本文档
```

## 相关文档

- [数据存储架构设计](../docs/data-storage-architecture.md)
- [AGENTS.md](../AGENTS.md) - 项目完整文档
