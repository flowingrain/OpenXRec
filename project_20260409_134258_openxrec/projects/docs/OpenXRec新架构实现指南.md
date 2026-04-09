# OpenXRec 新架构实现指南

## 一、快速开始

### 1.1 安装依赖

```bash
# 已安装的依赖
# - coze-coding-dev-sdk (用于 embedding)
```

### 1.2 初始化数据存储

```typescript
import { getDataStoreManager } from '@/lib/storage';

// 获取数据存储管理器
const dataStore = getDataStoreManager('./data');

// 添加用户
await dataStore.users.set('user-123', {
  id: 'user-123',
  username: 'demo_user',
  email: 'demo@example.com',
  role: 'user',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// 添加推荐物品
await dataStore.items.set('item-456', {
  id: 'item-456',
  title: '推荐系统基础知识',
  description: '推荐系统是信息过滤系统的一种...',
  type: 'knowledge',
  category: '基础知识',
  tags: ['推荐系统', '基础'],
  keywords: ['推荐系统', '基础知识'],
  qualityScore: 0.95,
  popularityScore: 0.88,
  freshnessScore: 0.5,
  viewCount: 0,
  clickCount: 0,
  likeCount: 0,
  bookmarkCount: 0,
  shareCount: 0,
  ratingCount: 0,
  status: 'active',
  featured: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});
```

### 1.3 使用知识库

```typescript
import { KnowledgeBase } from '@/lib/knowledge';
import { load_skill } from '@/utils/tool';

// 加载 embedding 技能
await load_skill({ skill: '/skills/public/prod/embedding' });

// 创建知识库
const knowledgeBase = new KnowledgeBase('./knowledge');

// 导入文档
const doc = await knowledgeBase.importDocument({
  id: 'doc-001',
  title: '推荐系统基础知识',
  content: '推荐系统是信息过滤系统的一种...',
  type: 'general',
  sourceType: 'manual',
  tags: ['推荐系统', '基础'],
  categories: ['基础知识'],
  generateEmbedding: true
});

// 搜索文档
const results = await knowledgeBase.search('推荐算法', {
  limit: 10,
  threshold: 0.6
});
```

### 1.4 使用向量库

```typescript
import { VectorStore } from '@/lib/vector';

// 创建向量库
const vectorStore = new VectorStore('./vectors');

// 生成向量并存储
const vector = await vectorStore.generateEmbedding('推荐系统基础知识');
await vectorStore.set('emb-001', {
  id: 'emb-001',
  type: 'item_content',
  targetId: 'item-456',
  vector: vector,
  modelName: 'doubao-embedding-vision-251215',
  embeddingDim: vector.length,
  updateFrequency: 0,
  lastUpdatedAt: new Date().toISOString(),
  usageCount: 0,
  createdAt: new Date().toISOString()
});

// 相似度搜索
const results = await vectorStore.search(vector, {
  type: 'item_content',
  limit: 10,
  threshold: 0.6
});
```

### 1.5 使用记忆系统

```typescript
import { MemorySystem } from '@/lib/memory';

// 创建记忆系统
const memory = new MemorySystem('./memory');

// 记录交互
await memory.logInteraction({
  id: 'interaction-001',
  userId: 'user-123',
  type: 'click',
  itemId: 'item-456',
  itemType: 'knowledge',
  context: {
    scenario: 'homepage_discover',
    timestamp: new Date().toISOString()
  },
  createdAt: new Date().toISOString()
});

// 获取用户画像
const profile = await memory.getUserProfile('user-123');

// 获取用户交互历史
const history = await memory.getInteractions('user-123', {
  limit: 50
});
```

---

## 二、API 端点实现

### 2.1 推荐接口

```typescript
// src/app/api/recommendations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDataStoreManager } from '@/lib/storage';
import { KnowledgeBase } from '@/lib/knowledge';
import { VectorStore } from '@/lib/vector';
import { MemorySystem } from '@/lib/memory';
import { RecommendationEngine } from '@/lib/recommendation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, scenario, limit = 10 } = body;

    // 初始化各组件
    const dataStore = getDataStoreManager();
    const knowledgeBase = new KnowledgeBase('./knowledge');
    const vectorStore = new VectorStore('./vectors');
    const memory = new MemorySystem('./memory');
    const engine = new RecommendationEngine({
      dataStore,
      knowledgeBase,
      vectorStore,
      memory
    });

    // 获取用户画像
    const profile = await memory.getUserProfile(userId);

    // 生成推荐
    const recommendations = await engine.recommend({
      userId,
      scenario,
      profile,
      limit
    });

    // 记录推荐请求
    await memory.logInteraction({
      id: `rec-${Date.now()}`,
      userId,
      type: 'recommendation_request',
      context: {
        scenario,
        timestamp: new Date().toISOString(),
        recommendationCount: recommendations.length
      },
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        metadata: {
          scenario,
          count: recommendations.length,
          profileVersion: profile?.profileVersion || 0
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
```

### 2.2 交互反馈接口

```typescript
// src/app/api/interactions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { MemorySystem } from '@/lib/memory';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, itemId, itemType, scenario } = body;

    const memory = new MemorySystem('./memory');

    // 记录交互
    await memory.logInteraction({
      id: `interaction-${Date.now()}`,
      userId,
      type,
      itemId,
      itemType,
      context: {
        scenario,
        timestamp: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    });

    // 更新用户画像
    await memory.updateUserProfile(userId, { type, itemId });

    return NextResponse.json({
      success: true,
      message: 'Interaction recorded'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
```

---

## 三、前端集成

### 3.1 推荐列表组件

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Lightbulb, ThumbsUp, Bookmark } from 'lucide-react';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  relevanceScore: number;
  explanation: string;
}

export function RecommendationList({ userId, scenario }: { userId: string; scenario: string }) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [userId, scenario]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, scenario, limit: 10 })
      });
      const result = await response.json();
      if (result.success) {
        setRecommendations(result.data.recommendations);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInteraction = async (type: 'like' | 'click' | 'bookmark', itemId: string) => {
    await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type, itemId, itemType: 'knowledge', scenario })
    });
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <Card key={rec.id}>
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{rec.title}</h3>
                <p className="text-sm text-muted-foreground">{rec.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm">{Math.round(rec.relevanceScore * 100)}%</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600"
              >
                <Lightbulb className="w-4 h-4 mr-1" />
                查看解释
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInteraction('like', rec.id)}
                >
                  <ThumbsUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInteraction('bookmark', rec.id)}
                >
                  <Bookmark className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

---

## 四、数据初始化

### 4.1 创建初始化脚本

```typescript
// scripts/initialize-data.ts

import { getDataStoreManager } from '@/lib/storage';
import { KnowledgeBase } from '@/lib/knowledge';
import { VectorStore } from '@/lib/vector';
import { MemorySystem } from '@/lib/memory';
import { load_skill } from '@/utils/tool';

async function initializeData() {
  console.log('开始初始化数据...');

  // 初始化数据存储
  const dataStore = getDataStoreManager('./data');

  // 添加示例用户
  await dataStore.users.set('user-demo', {
    id: 'user-demo',
    username: 'demo_user',
    email: 'demo@example.com',
    role: 'user',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 添加示例物品
  await dataStore.items.set('item-001', {
    id: 'item-001',
    title: '推荐系统基础知识',
    description: '推荐系统是信息过滤系统的一种...',
    type: 'knowledge',
    category: '基础知识',
    tags: ['推荐系统', '基础'],
    keywords: ['推荐系统', '基础知识'],
    qualityScore: 0.95,
    popularityScore: 0.88,
    freshnessScore: 0.5,
    viewCount: 0,
    clickCount: 0,
    likeCount: 0,
    bookmarkCount: 0,
    shareCount: 0,
    ratingCount: 0,
    status: 'active',
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 初始化知识库
  const knowledgeBase = new KnowledgeBase('./knowledge');

  // 加载 embedding 技能
  await load_skill({ skill: '/skills/public/prod/embedding' });

  // 导入示例文档
  await knowledgeBase.importDocument({
    id: 'doc-001',
    title: '推荐系统基础知识',
    content: '推荐系统是信息过滤系统的一种，旨在预测用户对物品的偏好...',
    type: 'general',
    sourceType: 'manual',
    tags: ['推荐系统', '基础'],
    categories: ['基础知识'],
    generateEmbedding: true
  });

  console.log('数据初始化完成！');
}

// 运行初始化
initializeData().catch(console.error);
```

### 4.2 运行初始化

```bash
# 在项目根目录运行
node -r esbuild-register scripts/initialize-data.ts
```

---

## 五、部署说明

### 5.1 目录结构

```
/workspace/projects/
├── data/                          # 数据文件目录
│   ├── users.json
│   ├── items.json
│   ├── scenarios.json
│   ├── algorithms.json
│   └── config.json
├── knowledge/                     # 知识库目录
│   ├── documents/
│   │   ├── doc-001.json
│   │   └── ...
│   └── index.json
├── vectors/                       # 向量库目录
│   ├── users/
│   ├── items/
│   └── embeddings/
└── memory/                        # 记忆系统目录
    ├── users/
    │   ├── user-demo/
    │   │   ├── interactions.json
    │   │   ├── preferences.json
    │   │   ├── profile.json
    │   │   └── context.json
    │   └── ...
    └── sessions/
```

### 5.2 环境变量

```env
# 无需额外环境变量
# 数据存储路径可通过代码配置
```

### 5.3 数据备份

```bash
# 备份数据
tar -czf backup-$(date +%Y%m%d).tar.gz data/ knowledge/ vectors/ memory/

# 恢复数据
tar -xzf backup-20240101.tar.gz
```

---

## 六、性能优化

### 6.1 内存缓存

```typescript
// 使用 LRU 缓存
import LRU from 'lru-cache';

const recommendationCache = new LRU<string, any>({
  max: 100,
  ttl: 5 * 60 * 1000 // 5分钟
});

export async function getRecommendations(userId: string, scenario: string) {
  const cacheKey = `${userId}:${scenario}`;
  const cached = recommendationCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const recommendations = await fetchRecommendationsFromEngine(userId, scenario);
  recommendationCache.set(cacheKey, recommendations);

  return recommendations;
}
```

### 6.2 批量处理

```typescript
// 批量生成向量
async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  const batchSize = 10;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    results.push(...embeddings);
  }

  return results;
}
```

---

## 七、故障排查

### 7.1 常见问题

**Q: 数据文件损坏怎么办？**
```bash
# 检查 JSON 文件格式
cat data/users.json | jq .

# 恢复备份
tar -xzf backup-20240101.tar.gz
```

**Q: 向量搜索结果不准确？**
- 检查向量维度是否一致
- 检查相似度阈值设置
- 尝试调整 embedding 模型

**Q: 内存系统性能问题？**
- 定期清理过期数据
- 使用分区存储
- 增加内存缓存

---

## 八、总结

OpenXRec 新架构完全基于文件存储，无需数据库，具有以下优势：

✅ **简单易用**：无需配置数据库服务
✅ **易于部署**：单文件部署，支持容器化
✅ **易于迁移**：数据以文件形式存储，易于备份和迁移
✅ **成本控制**：无需数据库许可证和维护成本
✅ **快速开发**：适合原型开发和快速迭代

同时保持了足够的扩展性，未来可以平滑迁移到向量数据库和分布式存储。
