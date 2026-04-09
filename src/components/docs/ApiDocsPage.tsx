'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Code,
  BookOpen,
  Terminal,
  Copy,
  Check,
  Zap,
  Users,
  Settings,
  Activity,
  Brain,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

const API_BASE = '/api/v1';

const endpoints = [
  {
    name: '推荐接口',
    icon: Sparkles,
    path: '/recommend',
    method: 'POST',
    description: '获取个性化推荐结果',
    category: 'core',
  },
  {
    name: '反馈接口',
    icon: Zap,
    path: '/feedback',
    method: 'POST',
    description: '提交用户反馈数据',
    category: 'core',
  },
  {
    name: '用户画像',
    icon: Users,
    path: '/profile',
    method: 'GET/PUT',
    description: '获取或更新用户画像',
    category: 'core',
  },
  {
    name: '配置接口',
    icon: Settings,
    path: '/config',
    method: 'GET/PUT',
    description: '获取或更新推荐配置',
    category: 'config',
  },
  {
    name: 'PPO优化',
    icon: Brain,
    path: '/ppo',
    method: 'GET/POST',
    description: 'PPO强化学习策略优化',
    category: 'advanced',
  },
  {
    name: '健康检查',
    icon: Activity,
    path: '/health',
    method: 'GET',
    description: '检查服务健康状态',
    category: 'system',
  },
];

const codeExamples = {
  recommend: `// 推荐请求示例
const response = await fetch('/api/recommendation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    scenario: 'product_recommendation',
    context: {
      query: '智能手机',
      device: 'mobile',
      timeContext: {
        hour: 14,
        dayOfWeek: 3,
        isWeekend: false
      }
    },
    options: {
      topK: 10,
      withExplanation: true,
      enableDiversity: true,
      diversityWeight: 0.2
    }
  })
});

const data = await response.json();
// 返回: { success: true, data: { items: [...], strategy: '...', metadata: {...} } }`,

  feedback: `// 反馈请求示例
const response = await fetch('/api/chat-feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    itemId: 'item_456',
    feedbackType: 'click',
    rating: 5,
    context: {
      recommendationId: 'rec_789',
      position: 1,
      page: 'home'
    }
  })
});

const data = await response.json();
// 返回: { success: true, data: { feedbackId: '...', configUpdated: false } }`,

  profile: `// 获取用户画像
const profile = await fetch('/api/profile?userId=user_123');
const data = await profile.json();

// 更新用户画像
const updateResponse = await fetch('/api/profile', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    interests: ['科技', '数码', '摄影'],
    preferences: { priceRange: 'mid', brand: 'apple' }
  })
});`,

  config: `// 获取推荐配置
const config = await fetch('/api/recommendation/dynamic-config?scenario=product_recommendation');

// 更新配置
const updateResponse = await fetch('/api/recommendation/dynamic-config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scenario: 'product_recommendation',
    config: {
      strategyWeights: {
        content_based: 0.35,
        collaborative: 0.35,
        knowledge_based: 0.15,
        agent_based: 0.1,
        causal_based: 0.05
      },
      diversityWeight: 0.25,
      noveltyWeight: 0.1
    }
  })
});`,

  ppo: `// 获取PPO模型状态
const state = await fetch('/api/recommendation/ppo');

// 获取推荐动作
const actionResponse = await fetch('/api/recommendation/ppo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'action',
    data: {
      state: {
        userId: 'user_123',
        userFeatures: { activeLevel: 0.8 },
        scenarioFeatures: { scenarioType: 'product_recommendation' },
        currentConfig: { strategyWeights: {...} }
      }
    }
  })
});

// 触发训练
const trainResponse = await fetch('/api/recommendation/ppo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'train',
    data: { epochs: 10, batchSize: 64 }
  })
});`,

  health: `// 健康检查
const health = await fetch('/api/health');
const data = await health.json();

// 返回示例:
// {
//   success: true,
//   data: {
//     status: 'healthy',
//     version: 'v1.0.0',
//     components: {
//       database: { status: 'up', latency: 5 },
//       vectorStore: { status: 'up', latency: 2 },
//       llm: { status: 'up' },
//       ppo: { status: 'up' }
//     },
//     uptime: 86400
//   }
// }`,
};

export default function ApiDocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                <Code className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  OpenXRec API 文档
                </h1>
                <p className="text-xs text-muted-foreground">Version 1.0.0</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  返回首页
                </Button>
              </Link>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Activity className="w-3 h-3 mr-1" />
                服务正常
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* 概览 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">API 概览</h2>
          <p className="text-muted-foreground mb-6">
            OpenXRec 提供一套完整的 RESTful API，支持推荐生成、用户画像管理、反馈收集、配置管理等功能。
            所有 API 响应都采用统一的 JSON 格式。
          </p>
          
          {/* Base URL */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Base URL</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="bg-slate-100 px-3 py-2 rounded text-sm font-mono">
                {API_BASE}
              </code>
            </CardContent>
          </Card>

          {/* 响应格式 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">统一响应格式</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": 1699999999999,
    "requestId": "req_xxx",
    "version": "v1.0.0"
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* API 端点列表 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">API 端点</h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {endpoints.map((endpoint) => (
              <Card key={endpoint.path} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <endpoint.icon className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-base">{endpoint.name}</CardTitle>
                    </div>
                    <Badge variant={endpoint.method.includes('POST') ? 'default' : 'secondary'}>
                      {endpoint.method}
                    </Badge>
                  </div>
                  <CardDescription>{endpoint.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                    {API_BASE}{endpoint.path}
                  </code>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 详细文档 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">详细文档</h2>
          
          <Tabs defaultValue="recommend" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-4">
              <TabsTrigger value="recommend">推荐</TabsTrigger>
              <TabsTrigger value="feedback">反馈</TabsTrigger>
              <TabsTrigger value="profile">画像</TabsTrigger>
              <TabsTrigger value="config">配置</TabsTrigger>
              <TabsTrigger value="ppo">PPO</TabsTrigger>
              <TabsTrigger value="health">健康</TabsTrigger>
            </TabsList>

            {/* 推荐接口 */}
            <TabsContent value="recommend">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>POST /recommend</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(codeExamples.recommend, 'recommend')}
                    >
                      {copiedCode === 'recommend' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    获取个性化推荐结果，支持多种推荐场景和策略配置。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">请求参数</h4>
                    <div className="bg-slate-50 p-3 rounded text-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1">字段</th>
                            <th className="text-left py-1">类型</th>
                            <th className="text-left py-1">必填</th>
                            <th className="text-left py-1">说明</th>
                          </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                          <tr className="border-b">
                            <td className="py-1 font-mono text-black">userId</td>
                            <td>string</td>
                            <td>是</td>
                            <td>用户ID</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-1 font-mono text-black">scenario</td>
                            <td>string</td>
                            <td>是</td>
                            <td>推荐场景类型</td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-1 font-mono text-black">context</td>
                            <td>object</td>
                            <td>否</td>
                            <td>上下文信息</td>
                          </tr>
                          <tr>
                            <td className="py-1 font-mono text-black">options</td>
                            <td>object</td>
                            <td>否</td>
                            <td>推荐选项配置</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">代码示例</h4>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {codeExamples.recommend}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 反馈接口 */}
            <TabsContent value="feedback">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>POST /feedback</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(codeExamples.feedback, 'feedback')}
                    >
                      {copiedCode === 'feedback' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    提交用户反馈，用于优化推荐策略。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">反馈类型</h4>
                    <div className="flex flex-wrap gap-2">
                      {['view', 'click', 'like', 'dislike', 'purchase', 'share', 'rating'].map((type) => (
                        <Badge key={type} variant="outline">{type}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">代码示例</h4>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {codeExamples.feedback}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 用户画像 */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>GET/PUT /profile</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(codeExamples.profile, 'profile')}
                    >
                      {copiedCode === 'profile' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    获取或更新用户画像信息。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">代码示例</h4>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {codeExamples.profile}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 配置接口 */}
            <TabsContent value="config">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>GET/PUT /config</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(codeExamples.config, 'config')}
                    >
                      {copiedCode === 'config' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    获取或更新推荐策略配置。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">代码示例</h4>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {codeExamples.config}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PPO接口 */}
            <TabsContent value="ppo">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>GET/POST /ppo</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(codeExamples.ppo, 'ppo')}
                    >
                      {copiedCode === 'ppo' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    PPO强化学习策略优化接口。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">支持的操作</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge>action</Badge>
                        <span className="text-sm text-muted-foreground">获取推荐动作</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>train</Badge>
                        <span className="text-sm text-muted-foreground">触发模型训练</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>store</Badge>
                        <span className="text-sm text-muted-foreground">存储训练经验</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>offline-train</Badge>
                        <span className="text-sm text-muted-foreground">离线批量训练</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">代码示例</h4>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {codeExamples.ppo}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 健康检查 */}
            <TabsContent value="health">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>GET /health</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(codeExamples.health, 'health')}
                    >
                      {copiedCode === 'health' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    检查服务健康状态和组件可用性。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">代码示例</h4>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {codeExamples.health}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* 快速开始 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">快速开始</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-blue-600">1</span>
                  </div>
                  <h3 className="font-semibold mb-2">获取推荐</h3>
                  <p className="text-sm text-muted-foreground">
                    调用 /recommend 接口，传入用户ID和场景类型
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-purple-600">2</span>
                  </div>
                  <h3 className="font-semibold mb-2">收集反馈</h3>
                  <p className="text-sm text-muted-foreground">
                    用户与推荐结果交互后，调用 /feedback 接口记录
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-green-600">3</span>
                  </div>
                  <h3 className="font-semibold mb-2">持续优化</h3>
                  <p className="text-sm text-muted-foreground">
                    PPO自动学习优化策略，提升推荐效果
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SDK 支持 */}
        <div>
          <h2 className="text-2xl font-bold mb-4">SDK 支持</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">JavaScript/TypeScript</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`// 使用 fetch
const response = await fetch('/api/recommendation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, scenario })
});`}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Python</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`import requests

response = requests.post(
    '/api/recommendation',
    json={'userId': 'user_123', 'scenario': 'product_recommendation'}
)
data = response.json()`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>OpenXRec API v1.0.0</span>
            <span>© 2024 OpenXRec. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
