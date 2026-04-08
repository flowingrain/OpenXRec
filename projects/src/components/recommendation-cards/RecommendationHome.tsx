'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Search,
  TrendingUp,
  Target,
  Users,
  BookOpen,
  Lightbulb,
  BarChart3,
  ArrowRight,
  ChevronRight,
  Star,
  Clock,
  ThumbsUp,
  Heart,
  Bookmark,
  MessageSquare,
  User,
  LogIn,
  LogOut,
  Settings,
  Bell,
  Filter,
  Sliders,
  Zap,
  Brain,
  Network,
  Layers,
  GitBranch,
  Database,
  Shield,
  CheckCircle2,
  ArrowUpRight,
  Eye,
  MousePointer
} from 'lucide-react';

// 类型定义
interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  itemCount: number;
}

interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  qualityScore: number;
  popularityScore: number;
  relevanceScore: number;
  tags: string[];
  thumbnail?: string;
}

interface UserProfile {
  interests: string[];
  preferredCategories: string[];
  stats: {
    totalInteractions: number;
    totalViews: number;
    totalClicks: number;
    totalLikes: number;
  };
}

// 模拟数据
const mockScenarios: Scenario[] = [
  {
    id: 'homepage_discover',
    name: '首页发现',
    description: '根据您的兴趣推荐可能感兴趣的内容',
    category: 'discovery',
    icon: <Sparkles className="w-5 h-5" />,
    itemCount: 120
  },
  {
    id: 'related_knowledge',
    name: '相关知识推荐',
    description: '基于当前内容推荐相关知识文档',
    category: 'contextual',
    icon: <BookOpen className="w-5 h-5" />,
    itemCount: 85
  },
  {
    id: 'trending_items',
    name: '热门趋势',
    description: '展示当前最热门的内容和趋势',
    category: 'trending',
    icon: <TrendingUp className="w-5 h-5" />,
    itemCount: 200
  },
  {
    id: 'personalized_feed',
    name: '个性化推荐',
    description: '基于用户画像的深度个性化推荐',
    category: 'personalization',
    icon: <Target className="w-5 h-5" />,
    itemCount: 150
  }
];

const mockRecommendations: RecommendationItem[] = [
  {
    id: '1',
    title: '推荐系统基础知识',
    description: '推荐系统是信息过滤系统的一种，旨在预测用户对物品的偏好...',
    category: 'general',
    type: 'knowledge',
    qualityScore: 0.95,
    popularityScore: 0.88,
    relevanceScore: 0.92,
    tags: ['推荐系统', '基础', '入门']
  },
  {
    id: '2',
    title: '协同过滤算法原理',
    description: '协同过滤是一种基于用户行为数据进行推荐的算法...',
    category: 'algorithm',
    type: 'knowledge',
    qualityScore: 0.92,
    popularityScore: 0.85,
    relevanceScore: 0.88,
    tags: ['协同过滤', '算法', '机器学习']
  },
  {
    id: '3',
    title: '多样性推荐策略',
    description: '多样性是衡量推荐系统质量的重要指标...',
    category: 'strategy',
    type: 'knowledge',
    qualityScore: 0.88,
    popularityScore: 0.78,
    relevanceScore: 0.85,
    tags: ['多样性', '策略', '优化']
  },
  {
    id: '4',
    title: '新颖性推荐技术',
    description: '新颖性指推荐用户未曾接触过的新物品...',
    category: 'strategy',
    type: 'knowledge',
    qualityScore: 0.90,
    popularityScore: 0.82,
    relevanceScore: 0.87,
    tags: ['新颖性', '探索', '长尾']
  },
  {
    id: '5',
    title: '深度学习在推荐系统中的应用',
    description: '深度学习技术在推荐系统中的创新应用...',
    category: 'technology',
    type: 'knowledge',
    qualityScore: 0.93,
    popularityScore: 0.90,
    relevanceScore: 0.91,
    tags: ['深度学习', '神经网络', 'AI']
  },
  {
    id: '6',
    title: '知识图谱推荐系统',
    description: '利用知识图谱增强推荐系统的可解释性...',
    category: 'technology',
    type: 'knowledge',
    qualityScore: 0.91,
    popularityScore: 0.87,
    relevanceScore: 0.89,
    tags: ['知识图谱', '可解释性', '语义']
  }
];

const mockUserProfile: UserProfile = {
  interests: ['推荐系统', '机器学习', '数据挖掘', '人工智能'],
  preferredCategories: ['technology', 'algorithm', 'strategy'],
  stats: {
    totalInteractions: 156,
    totalViews: 89,
    totalClicks: 45,
    totalLikes: 22
  }
};

export default function RecommendationHome() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');

  // 模拟登录状态检查
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // 实际应用中应该从API获取用户信息
      setCurrentUser({
        id: 'user-1',
        username: 'demo_user',
        email: 'demo@example.com',
        role: 'user'
      });
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = () => {
    // 实际应用中跳转到登录页
    window.location.href = '/auth';
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  const handleRecommendationClick = (item: RecommendationItem) => {
    console.log('点击推荐项:', item);
    // 记录交互历史
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  可解释推荐系统
                </h1>
                <p className="text-xs text-muted-foreground">Explainable Recommendation System</p>
              </div>
            </div>

            {/* 搜索框 */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索知识、算法、策略..."
                  className="pl-10 pr-4"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* 用户操作 */}
            <div className="flex items-center space-x-4">
              {/* API文档入口 */}
              <Link href="/api-docs">
                <Button variant="ghost" size="sm" className="gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden md:inline">API 文档</span>
                </Button>
              </Link>
              {isLoggedIn ? (
                <>
                  <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5" />
                  </Button>
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                      {currentUser?.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium hidden md:inline">
                      {currentUser?.username}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => window.location.href = '/auth'}>
                    登录
                  </Button>
                  <Button onClick={() => window.location.href = '/auth'}>
                    注册
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero 区域 */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 opacity-50" />
        <div className="container mx-auto relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="w-3 h-3 mr-1" />
              AI 驱动的智能推荐
            </Badge>
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              可解释的个性化推荐
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              基于知识图谱、向量搜索和深度学习的混合推荐系统，提供透明、可理解、高质量的个性化推荐服务
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="group">
                开始探索
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline">
                了解更多
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 核心功能特性 */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">核心功能特性</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              采用先进的推荐算法和可解释AI技术，为您提供精准、透明、可信的推荐服务
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Brain className="h-8 w-8" />,
                title: '智能推荐',
                description: '基于深度学习和知识图谱的混合推荐算法'
              },
              {
                icon: <Layers className="h-8 w-8" />,
                title: '可解释性',
                description: '每个推荐都提供清晰的解释和推理过程'
              },
              {
                icon: <Network className="h-8 w-8" />,
                title: '知识增强',
                description: '利用知识图谱提升推荐的相关性和多样性'
              },
              {
                icon: <Shield className="h-8 w-8" />,
                title: '隐私保护',
                description: '用户数据加密存储，严格的访问控制'
              }
            ].map((feature, index) => (
              <Card key={index} className="border-2 hover:border-blue-500 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white mb-3">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 推荐场景和内容 */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container mx-auto">
          <Tabs defaultValue="discover" className="w-full">
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8">
              <TabsTrigger value="discover">发现推荐</TabsTrigger>
              <TabsTrigger value="trending">热门趋势</TabsTrigger>
              <TabsTrigger value="profile">用户画像</TabsTrigger>
              <TabsTrigger value="history">交互历史</TabsTrigger>
            </TabsList>

            {/* 发现推荐 */}
            <TabsContent value="discover" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左侧：推荐场景 */}
                <div className="lg:col-span-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>推荐场景</CardTitle>
                      <CardDescription>选择不同场景获取个性化推荐</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {mockScenarios.map((scenario) => (
                          <button
                            key={scenario.id}
                            className="w-full text-left p-3 rounded-lg hover:bg-blue-50 transition-colors border hover:border-blue-200"
                            onClick={() => setActiveTab(scenario.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="h-8 w-8 rounded bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-blue-600">
                                  {scenario.icon}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{scenario.name}</p>
                                  <p className="text-xs text-muted-foreground">{scenario.itemCount} 个项目</p>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 右侧：推荐内容 */}
                <div className="lg:col-span-2">
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold mb-2">为您推荐</h4>
                    <p className="text-sm text-muted-foreground">
                      基于您的兴趣和行为偏好生成的个性化推荐
                    </p>
                  </div>
                  <div className="grid gap-4">
                    {mockRecommendations.map((item) => (
                      <Card
                        key={item.id}
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleRecommendationClick(item)}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{item.type}</Badge>
                                <Badge variant="secondary">{item.category}</Badge>
                              </div>
                              <CardTitle className="text-lg">{item.title}</CardTitle>
                              <CardDescription className="mt-2">{item.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span>{(item.qualityScore * 100).toFixed(0)}%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                <span>{(item.popularityScore * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="mt-6 text-center">
                    <Button variant="outline">
                      加载更多
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 热门趋势 */}
            <TabsContent value="trending">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockRecommendations.map((item, index) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span>+{Math.floor(Math.random() * 20)}%</span>
                        </div>
                      </div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">热度</span>
                          <div className="flex items-center gap-1">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                style={{ width: `${item.popularityScore * 100}%` }}
                              />
                            </div>
                            <span>{(item.popularityScore * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* 用户画像 */}
            <TabsContent value="profile">
              {isLoggedIn ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>用户画像</CardTitle>
                      <CardDescription>基于您的行为和偏好生成的个性化画像</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 兴趣偏好 */}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Heart className="h-4 w-4 text-red-500" />
                            兴趣偏好
                          </h4>
                          <div className="space-y-2">
                            {mockUserProfile.interests.map((interest) => (
                              <Badge key={interest} variant="secondary">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* 偏好分类 */}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4 text-blue-500" />
                            偏好分类
                          </h4>
                          <div className="space-y-2">
                            {mockUserProfile.preferredCategories.map((category) => (
                              <div key={category} className="flex items-center justify-between text-sm">
                                <span className="capitalize">{category}</span>
                                <div className="flex items-center gap-1">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                      style={{ width: `${Math.random() * 40 + 60}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {(Math.random() * 40 + 60).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 交互统计 */}
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-green-500" />
                            交互统计
                          </h4>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">总交互</span>
                              <span className="font-medium">{mockUserProfile.stats.totalInteractions}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">浏览</span>
                              <span className="font-medium">{mockUserProfile.stats.totalViews}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">点击</span>
                              <span className="font-medium">{mockUserProfile.stats.totalClicks}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">点赞</span>
                              <span className="font-medium">{mockUserProfile.stats.totalLikes}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>推荐偏好设置</CardTitle>
                      <CardDescription>调整推荐算法的权重和策略</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium">多样性</label>
                            <span className="text-sm text-muted-foreground">30%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="30"
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium">新颖性</label>
                            <span className="text-sm text-muted-foreground">30%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="30"
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium">相关性</label>
                            <span className="text-sm text-muted-foreground">40%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            defaultValue="40"
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <Button className="w-full">
                          保存设置
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="max-w-md mx-auto">
                  <CardHeader className="text-center">
                    <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                    <CardTitle>登录查看您的画像</CardTitle>
                    <CardDescription>
                      登录后可以查看您的个性化画像、调整推荐偏好设置
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={handleLogin}>
                      立即登录
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* 交互历史 */}
            <TabsContent value="history">
              {isLoggedIn ? (
                <Card>
                  <CardHeader>
                    <CardTitle>交互历史</CardTitle>
                    <CardDescription>您最近的浏览、点击、点赞等交互记录</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { action: '浏览', item: '推荐系统基础知识', time: '2分钟前', icon: <Eye className="h-4 w-4" /> },
                        { action: '点赞', item: '协同过滤算法原理', time: '15分钟前', icon: <ThumbsUp className="h-4 w-4" /> },
                        { action: '收藏', item: '多样性推荐策略', time: '1小时前', icon: <Bookmark className="h-4 w-4" /> },
                        { action: '点击', item: '新颖性推荐技术', time: '3小时前', icon: <MousePointer className="h-4 w-4" /> },
                      ].map((history, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                              {history.icon}
                            </div>
                            <div>
                              <p className="font-medium">{history.action}了</p>
                              <p className="text-sm text-muted-foreground">{history.item}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{history.time}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="max-w-md mx-auto">
                  <CardHeader className="text-center">
                    <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-gray-400" />
                    </div>
                    <CardTitle>登录查看历史记录</CardTitle>
                    <CardDescription>
                      登录后可以查看您的完整交互历史记录
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={handleLogin}>
                      立即登录
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="border-t bg-white py-8 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="font-bold">可解释推荐系统</span>
              </div>
              <p className="text-sm text-muted-foreground">
                基于AI的智能推荐平台，提供透明、可理解、高质量的个性化推荐服务
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">产品</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-blue-600">功能特性</Link></li>
                <li><Link href="/interaction-demo" className="hover:text-blue-600">交互演示</Link></li>
                <li><Link href="/api-docs" className="hover:text-blue-600">API 文档</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">资源</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-blue-600">帮助中心</Link></li>
                <li><Link href="#" className="hover:text-blue-600">博客</Link></li>
                <li><Link href="#" className="hover:text-blue-600">社区</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">关于</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-blue-600">关于我们</Link></li>
                <li><Link href="#" className="hover:text-blue-600">隐私政策</Link></li>
                <li><Link href="#" className="hover:text-blue-600">服务条款</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; 2024 可解释推荐系统. 保留所有权利.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
