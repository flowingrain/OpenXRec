# 数据存储架构设计

## 概述

智弈全域风险态势感知平台采用多层次存储架构，支持结构化数据、非结构化文件和向量嵌入的统一管理。

## 存储层级

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层                                  │
│         API Routes / Components / Services                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Supabase    │    │  对象存储     │    │  嵌入模型     │
│   (Postgres)  │    │   (S3)        │    │  (Vector)     │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ • 结构化数据   │    │ • 文件存储    │    │ • 文本向量化  │
│ • 关系查询     │    │ • 报告存档    │    │ • 语义搜索    │
│ • RLS 安全     │    │ • 图片/文档   │    │ • 相似度计算  │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Supabase 数据库

### Coze 托管配置

项目使用 Coze 平台托管的 Supabase，环境变量自动注入：

```typescript
// 无需手动配置，平台自动注入
// COZE_SUPABASE_URL
// COZE_SUPABASE_ANON_KEY
```

### 客户端使用

```typescript
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取客户端
const supabase = getSupabaseClient();

// 查询数据
const { data, error } = await supabase
  .from('kg_entities')
  .select('id, name, type')
  .eq('type', '机构');

if (error) throw new Error(`查询失败: ${error.message}`);
```

### 数据库表结构

#### 核心业务表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `analysis_cases` | 分析案例 | id, query, domain, conclusion, confidence |
| `kg_entities` | 知识图谱实体 | id, name, type, description, importance |
| `kg_relations` | 知识图谱关系 | source_entity_id, target_entity_id, type |
| `knowledge_docs` | 知识库文档 | title, content, file_type, metadata |

#### 辅助功能表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `kg_corrections` | 修正历史 | entity_id, change_type, old_value, new_value |
| `kg_snapshots` | 知识图谱快照 | name, entities, relations |
| `report_versions` | 报告版本 | case_id, version, storage_key |
| `user_preferences` | 用户偏好 | user_id, preferences |

#### 进化系统表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `case_embeddings` | 案例嵌入向量 | case_id, embedding_type, embedding |
| `user_feedbacks` | 用户反馈 | case_id, feedback_type, rating |
| `knowledge_patterns` | 知识模式 | pattern_type, pattern_data, occurrence_count |

### 表结构管理

```bash
# 从远端同步表结构到本地 schema.ts
coze-coding-ai db generate-models

# 将本地 schema.ts 同步到远端数据库
coze-coding-ai db upgrade
```

## 对象存储

### 配置

使用 Coze 提供的 S3 兼容对象存储：

```typescript
import { uploadReport, uploadKnowledgeDoc, getFileUrl } from '@/lib/storage/object-storage';

// 上传报告
const result = await uploadReport(caseId, {
  content: reportContent,
  filename: 'report.md',
  format: 'markdown',
});

// 获取文件 URL
const url = await getFileUrl(result.key);
```

### 存储结构

```
bucket/
├── reports/              # 分析报告
│   └── {caseId}/
│       └── {year}{month}/
│           └── {filename}
├── knowledge/            # 知识文档
│   └── {documentId}/
│       └── {filename}
└── uploads/              # 用户上传
    └── {userId}/
        └── {filename}
```

## 向量嵌入服务

### 服务接口

```typescript
import { embeddingService } from '@/lib/embedding/service';

// 文本向量化
const embedding = await embeddingService.embedText("美联储降息");

// 批量向量化
const embeddings = await embeddingService.embedTexts([
  "文本1",
  "文本2"
]);

// 余弦相似度计算
const similarity = embeddingService.cosineSimilarity(emb1, emb2);

// 语义搜索
const results = await embeddingService.searchKnowledge(query, {
  limit: 10,
  threshold: 0.5,
});
```

### 搜索类型

| 类型 | 方法 | 说明 |
|------|------|------|
| 知识库 | `searchKnowledge()` | 搜索知识库文档 |
| 案例 | `searchSimilarCases()` | 搜索相似分析案例 |
| 实体 | `searchSimilarEntities()` | 搜索知识图谱实体 |

## API 端点

### 语义搜索

```http
POST /api/search/semantic
Content-Type: application/json

{
  "query": "美联储降息",
  "type": "all",
  "limit": 10,
  "threshold": 0.3
}
```

### 知识复用

```http
POST /api/knowledge/reuse
Content-Type: application/json

{
  "topic": "美联储降息对中国市场的影响",
  "maxCases": 5
}
```

### 报告版本

```http
POST /api/reports/versions
Content-Type: application/json

{
  "caseId": "case-001",
  "topic": "分析报告",
  "content": "...",
  "format": "markdown"
}
```

### 健康检查

```http
GET /api/supabase/health
```

## 数据安全

### RLS 策略

所有表启用行级安全策略：

```sql
ALTER TABLE kg_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON kg_entities 
FOR ALL USING (true) WITH CHECK (true);
```

### 最佳实践

1. **错误处理**：所有 Supabase 调用必须检查 error
2. **类型安全**：使用类型断言或接口定义
3. **批量操作**：避免循环单条操作
4. **分页查询**：大数据量使用 `.range()` 或游标分页

```typescript
// ✅ 正确示例
const { data, error } = await supabase
  .from('kg_entities')
  .select('*')
  .limit(10);

if (error) throw new Error(`查询失败: ${error.message}`);

// ❌ 错误示例
const { data } = await supabase.from('kg_entities').select('*');
// 未检查 error
```

## 文件位置

| 文件 | 说明 |
|------|------|
| `src/storage/database/supabase-client.ts` | Supabase 客户端 |
| `src/storage/database/shared/schema.ts` | Drizzle 表结构 |
| `src/lib/embedding/service.ts` | 嵌入服务 |
| `src/lib/storage/object-storage.ts` | 对象存储服务 |
| `supabase/init.sql` | 数据库初始化脚本 |
