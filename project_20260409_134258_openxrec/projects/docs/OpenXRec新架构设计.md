# OpenXRec 新架构设计

## 一、架构概述

OpenXRec 采用**无数据库架构**，完全基于以下四个核心组件：

```
┌─────────────────────────────────────────────────────────┐
│                    OpenXRec 系统架构                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    数据层     │  │   知识库     │  │   向量库     │ │
│  │    Data      │  │  Knowledge   │  │   Vector     │ │
│  │   Storage    │  │    Base      │  │    Store     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                 │                 │           │
│         └─────────────────┼─────────────────┘           │
│                           │                             │
│                  ┌────────▼────────┐                     │
│                  │     记忆系统     │                     │
│                  │    Memory       │                     │
│                  └────────┬────────┘                     │
│                           │                             │
│                  ┌────────▼────────┐                     │
│                  │   推荐引擎      │                     │
│                  │  Rec Engine    │                     │
│                  └────────┬────────┘                     │
│                           │                             │
│                  ┌────────▼────────┐                     │
│                  │   API/前端      │                     │
│                  │   Frontend     │                     │
│                  └─────────────────┘                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 二、核心组件设计

### 2.1 数据层（Data Storage）

**职责**：存储结构化数据和配置

**实现方式**：
- JSON 文件存储
- 对象存储（用于大文件）
- 内存缓存

**存储结构**：
```
/data
├── users.json                    # 用户数据
├── items.json                    # 推荐物品数据
├── scenarios.json                # 推荐场景配置
├── algorithms.json               # 算法配置
└── config.json                   # 系统配置
```

**数据格式示例**：
```json
{
  "users": {
    "user-123": {
      "id": "user-123",
      "username": "demo_user",
      "email": "demo@example.com",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  },
  "items": {
    "item-456": {
      "id": "item-456",
      "title": "推荐系统基础知识",
      "type": "knowledge",
      "tags": ["推荐系统", "基础"],
      "metadata": {}
    }
  }
}
```

**优势**：
- 简单易用，无需数据库
- 易于备份和迁移
- 支持版本控制
- 适合中小规模应用

---

### 2.2 知识库（Knowledge Base）

**职责**：存储和管理知识文档

**实现方式**：
- 使用 embedding 技能生成向量
- 存储到向量库
- 支持文档导入、更新、删除

**知识库结构**：
```
/knowledge
├── documents/
│   ├── doc-001.json
│   ├── doc-002.json
│   └── ...
└── index.json                    # 文档索引
```

**文档格式**：
```json
{
  "id": "doc-001",
  "title": "推荐系统基础知识",
  "content": "推荐系统是信息过滤系统的一种...",
  "type": "knowledge",
  "tags": ["推荐系统", "基础"],
  "metadata": {
    "author": "AI",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "embedding": [0.1, 0.2, ...]  // 2048维向量
}
```

**功能**：
- 文档导入（文本/URL/文件）
- 向量化生成
- 语义搜索
- 文档管理

---

### 2.3 向量库（Vector Store）

**职责**：存储和搜索向量嵌入

**实现方式**：
- 使用 coze-coding-dev-sdk 的 embedding 技能
- 内存向量存储
- 支持相似度搜索

**向量存储结构**：
```
/vectors
├── users/
│   ├── user-123.json           # 用户向量
│   └── user-456.json
├── items/
│   ├── item-789.json           # 物品向量
│   └── item-012.json
└── embeddings/
    ├── embedding-001.json
    └── ...
```

**向量格式**：
```json
{
  "id": "emb-001",
  "type": "user",
  "targetId": "user-123",
  "vector": [0.1, 0.2, ...],  // 2048维
  "model": "doubao-embedding-vision-251215",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**搜索功能**：
- 余弦相似度搜索
- 欧氏距离搜索
- 批量搜索
- 阈值过滤

---

### 2.4 记忆系统（Memory System）

**职责**：存储用户交互历史和上下文

**实现方式**：
- 时间序列存储
- 分区存储（按用户/时间）
- 支持检索和聚合

**记忆结构**：
```
/memory
├── users/
│   ├── user-123/
│   │   ├── interactions.json
│   │   ├── preferences.json
│   │   ├── profile.json
│   │   └── context.json
│   └── user-456/
│       └── ...
└── sessions/
    ├── session-001.json
    └── ...
```

**交互记录格式**：
```json
{
  "id": "interaction-001",
  "userId": "user-123",
  "type": "click",
  "itemId": "item-456",
  "itemType": "knowledge",
  "context": {
    "scenario": "homepage_discover",
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "metadata": {}
}
```

**用户画像格式**：
```json
{
  "userId": "user-123",
  "interests": ["推荐系统", "机器学习"],
  "preferredCategories": ["technology", "algorithm"],
  "behavior": {
    "clickRate": 0.32,
    "avgDwellTime": 45,
    "diversityPreference": 0.8
  },
  "stats": {
    "totalInteractions": 156,
    "totalViews": 89,
    "totalClicks": 45
  },
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**功能**：
- 记录交互历史
- 生成用户画像
- 上下文检索
- 行为分析

---

## 三、推荐引擎设计

### 3.1 推荐流程

```
1. 用户请求推荐
   ↓
2. 加载用户画像（记忆系统）
   ↓
3. 生成用户向量（向量库）
   ↓
4. 从知识库检索候选集（向量搜索）
   ↓
5. 多样性优化
   ↓
6. 排序打分
   ↓
7. 生成推荐解释
   ↓
8. 返回推荐结果
   ↓
9. 记录交互（记忆系统）
   ↓
10. 更新用户画像
```

### 3.2 推荐算法

#### 协同过滤
- 基于用户的相似度搜索
- 基于物品的相似度搜索
- 使用向量库实现

#### 内容推荐
- 基于内容相似度
- 使用知识库向量搜索
- 结合标签和元数据

#### 混合推荐
- 加权融合多种算法
- 自适应权重调整
- 基于用户反馈优化

---

## 四、技术实现

### 4.1 技术栈

- **前端**：Next.js 16 + React 19 + TypeScript 5
- **存储**：JSON 文件 + 对象存储
- **向量**：coze-coding-dev-sdk embedding
- **记忆**：文件存储 + 内存缓存

### 4.2 目录结构

```
/src
├── lib/
│   ├── storage/                 # 数据存储层
│   │   ├── data-store.ts
│   │   ├── file-storage.ts
│   │   └── index.ts
│   ├── knowledge/               # 知识库系统
│   │   ├── knowledge-base.ts
│   │   ├── document-manager.ts
│   │   └── index.ts
│   ├── vector/                  # 向量库系统
│   │   ├── vector-store.ts
│   │   ├── embedding-service.ts
│   │   └── index.ts
│   ├── memory/                  # 记忆系统
│   │   ├── memory-system.ts
│   │   ├── user-profile.ts
│   │   ├── interaction-logger.ts
│   │   └── index.ts
│   └── recommendation/          # 推荐引擎
│       ├── engine.ts
│       ├── algorithms/
│       │   ├── collaborative-filtering.ts
│       │   ├── content-based.ts
│       │   ├── hybrid.ts
│       │   └── index.ts
│       └── index.ts
├── types/                       # 类型定义
│   ├── storage.ts
│   ├── knowledge.ts
│   ├── vector.ts
│   ├── memory.ts
│   └── recommendation.ts
└── data/                        # 数据文件
    ├── users.json
    ├── items.json
    ├── scenarios.json
    └── algorithms.json
```

---

## 五、数据流

### 5.1 推荐请求流程

```
用户请求推荐
    ↓
前端调用 /api/recommendations
    ↓
推荐引擎处理
    ├─ 从记忆系统加载用户画像
    ├─ 从向量库获取用户向量
    ├─ 从知识库检索候选集
    ├─ 应用推荐算法
    └─ 生成推荐结果
    ↓
返回推荐结果
    ↓
前端展示
    ↓
用户交互（点击/点赞/收藏）
    ↓
记录到记忆系统
    ↓
更新用户画像
```

### 5.2 知识库更新流程

```
导入文档
    ↓
调用 embedding 技能生成向量
    ↓
存储到向量库
    ↓
更新知识库索引
    ↓
推荐引擎可搜索
```

---

## 六、优势分析

### 6.1 无数据库架构的优势

1. **简化部署**：无需配置数据库服务
2. **易于迁移**：数据以文件形式存储，易于备份和迁移
3. **版本控制**：数据可以纳入版本控制系统
4. **降低成本**：无需数据库许可证和维护成本
5. **快速启动**：适合原型开发和快速迭代

### 6.2 适用场景

- 中小规模应用（< 100万条数据）
- 原型开发和验证
- 单体应用部署
- 边缘计算场景

### 6.3 不适用场景

- 大规模数据（> 1000万条数据）
- 高并发写入（> 1000 TPS）
- 复杂事务处理
- 多节点分布式部署

---

## 七、扩展性

### 7.1 未来可扩展方向

1. **引入向量数据库**：Qdrant、Weaviate、Milvus
2. **分布式存储**：MongoDB、Cassandra
3. **缓存层**：Redis、Memcached
4. **消息队列**：Kafka、RabbitMQ

### 7.2 迁移路径

```
当前架构（文件存储）
    ↓
引入 Redis 缓存
    ↓
引入向量数据库
    ↓
引入关系数据库（PostgreSQL）
    ↓
完全迁移到数据库架构
```

---

## 八、总结

OpenXRec 新架构采用无数据库设计，完全基于：

1. **数据层**：JSON 文件存储结构化数据
2. **知识库**：向量存储知识文档
3. **向量库**：embedding + 向量搜索
4. **记忆系统**：存储用户交互和上下文

这种架构适合中小规模应用，具有简单、快速、易部署的优势，同时保持了足够的扩展性。
