'use client';

/**
 * 导航主页
 * 提供所有功能模块的快速入口
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Database, 
  Sparkles, 
  GitBranch, 
  MessageSquare,
  Activity,
  Layers,
  Network,
  BookOpen,
  Lightbulb
} from 'lucide-react';

export default function NavigationPage() {
  const modules = [
    {
      title: '智弈全域风险态势感知平台',
      description: '基于 AI 大模型的多智能体协作分析系统',
      icon: <Activity className="w-8 h-8" />,
      path: '/',
      status: 'active',
      features: ['态势分析', '事件模拟', '因果推理', '知识图谱']
    },
    {
      title: '可解释推荐系统',
      description: 'OpenXRec - 多策略推荐与解释生成',
      icon: <Sparkles className="w-8 h-8" />,
      path: '/recommendation',
      status: 'active',
      features: ['内容推荐', '协同过滤', '推荐解释', 'A/B测试']
    },

    {
      title: '知识库浏览',
      description: '浏览和搜索知识库内容',
      icon: <BookOpen className="w-8 h-8" />,
      path: '/knowledge-browser',
      status: 'active',
      features: ['知识搜索', '分类浏览', '知识详情']
    },
    {
      title: '交互演示',
      description: '展示系统的交互功能',
      icon: <MessageSquare className="w-8 h-8" />,
      path: '/interaction-demo',
      status: 'demo',
      features: ['对话交互', '实时反馈']
    },
    {
      title: '质量分析演示',
      description: '展示质量评估和分析功能',
      icon: <BarChart3 className="w-8 h-8" />,
      path: '/quality-demo',
      status: 'demo',
      features: ['质量评估', '数据分析']
    },

  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* 头部 */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                智弈全域
              </h1>
              <p className="text-muted-foreground mt-1">
                风险态势感知与可解释推荐系统平台
              </p>
            </div>
            <Badge variant="outline" className="px-4 py-2">
              v2.0
            </Badge>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="container mx-auto px-4 py-12">
        {/* 欢迎区域 */}
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold mb-4">
            欢迎来到智弈全域平台
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            基于 AI 大模型的多智能体协作系统，提供风险态势感知、可解释推荐、知识管理等功能
          </p>
        </div>

        {/* 核心功能 */}
        <div className="mb-8">
          <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Network className="w-6 h-6" />
            核心功能
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modules.slice(0, 2).map((module, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <div className="text-primary">{module.icon}</div>
                    </div>
                    <Badge variant={module.status === 'active' ? 'default' : 'secondary'}>
                      {module.status === 'active' ? '核心功能' : '演示'}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4 text-xl">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {module.features.map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <Link href={module.path}>
                    <Button className="w-full group-hover:bg-primary/90">
                      进入系统
                      <Network className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 集成演示 */}
        <div className="mb-8">
          <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Layers className="w-6 h-6" />
            集成演示
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.slice(2, 4).map((module, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-secondary/10 rounded-lg group-hover:bg-secondary/20 transition-colors">
                      <div className="text-secondary-foreground">{module.icon}</div>
                    </div>
                    <Badge variant="outline">集成</Badge>
                  </div>
                  <CardTitle className="mt-4 text-lg">{module.title}</CardTitle>
                  <CardDescription className="text-sm">{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {module.features.map((feature, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <Link href={module.path}>
                    <Button variant="outline" className="w-full">
                      查看演示
                      <Network className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 其他功能 */}
        <div>
          <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            其他功能
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modules.slice(4).map((module, index) => (
              <Card key={index} className="group hover:shadow-md transition-all duration-300">
                <CardHeader>
                  <div className="p-2 bg-muted/50 rounded-lg group-hover:bg-muted transition-colors inline-block mb-2">
                    <div className="text-muted-foreground w-6 h-6">{module.icon}</div>
                  </div>
                  <CardTitle className="text-base">{module.title}</CardTitle>
                  <CardDescription className="text-xs">{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={module.path}>
                    <Button variant="ghost" size="sm" className="w-full">
                      进入
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-6 bg-primary/5 rounded-lg border border-primary/10">
            <div className="text-3xl font-bold text-primary">9+</div>
            <div className="text-sm text-muted-foreground mt-1">功能模块</div>
          </div>
          <div className="p-6 bg-secondary/50 rounded-lg">
            <div className="text-3xl font-bold">2</div>
            <div className="text-sm text-muted-foreground mt-1">核心系统</div>
          </div>
          <div className="p-6 bg-muted rounded-lg">
            <div className="text-3xl font-bold">5+</div>
            <div className="text-sm text-muted-foreground mt-1">集成演示</div>
          </div>
          <div className="p-6 bg-accent/50 rounded-lg">
            <div className="text-3xl font-bold">100%</div>
            <div className="text-sm text-muted-foreground mt-1">开源</div>
          </div>
        </div>

        {/* 快速开始 */}
        <div className="mt-16 p-8 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl border">
          <h3 className="text-2xl font-semibold mb-4">快速开始</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center gap-2">
                <Activity className="w-6 h-6" />
                <span>风险分析平台</span>
              </Button>
            </Link>
            <Link href="/recommendation">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center gap-2">
                <Sparkles className="w-6 h-6" />
                <span>推荐系统</span>
              </Button>
            </Link>

          </div>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground text-sm">
            <p>智弈全域风险态势感知平台 · 基于 AI 大模型的多智能体协作系统</p>
            <p className="mt-2">Powered by Coze Coding SDK</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
