/**
 * 案例库浏览页面
 * 
 * 用户可访问的案例库浏览界面，支持：
 * - 查看推荐案例
 * - 按类型、评分筛选
 * - 查看案例详情
 * - 用户反馈
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Database,
  Search,
  Filter,
  SortAsc,
  Star,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Calendar,
  Tag,
  User,
  Target,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Loader2,
  MessageSquare,
  Lightbulb,
  Zap,
  Sparkles,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

interface AnalysisCase {
  id: string;
  query: string;
  domain: string;
  final_report?: string;
  conclusion?: {
    summary?: string;
    key_findings?: string[];
  };
  confidence?: number;
  quality_score?: number;
  user_rating?: number;
  feedback_count?: number;
  tags?: string[];
  status?: string;
  analyzed_at?: string;
  created_at?: string;
  key_factors?: string[];
  agent_outputs?: Record<string, any>;
}

interface CaseStats {
  totalCases: number;
  avgRating: number;
  highQualityCases: number;
  domainDistribution: Record<string, number>;
}

// ==================== 领域配置 ====================

const DOMAIN_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  tech_trend: { label: '科技趋势', color: 'bg-blue-100 text-blue-700', icon: TrendingUp },
  market_analysis: { label: '市场分析', color: 'bg-green-100 text-green-700', icon: Target },
  product_recommendation: { label: '产品推荐', color: 'bg-purple-100 text-purple-700', icon: Zap },
  general: { label: '综合', color: 'bg-gray-100 text-gray-700', icon: Database },
  content_recommendation: { label: '内容推荐', color: 'bg-orange-100 text-orange-700', icon: BookOpen },
  service_recommendation: { label: '服务推荐', color: 'bg-cyan-100 text-cyan-700', icon: Star },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: '已完成', color: 'bg-green-50 text-green-700' },
  running: { label: '进行中', color: 'bg-blue-50 text-blue-700' },
  draft: { label: '草稿', color: 'bg-gray-50 text-gray-700' },
  failed: { label: '失败', color: 'bg-red-50 text-red-700' },
};

// ==================== 案例模板 ====================

const CASE_TEMPLATES = [
  {
    id: 'tech_trend',
    name: '科技趋势分析',
    category: '热门模板',
    description: '分析最新科技趋势、技术发展和行业动态',
    domain: 'tech_trend',
    example_query: '2024年人工智能领域有哪些重要突破？',
    key_factors: ['技术突破', '市场影响', '应用场景', '投资动态'],
  },
  {
    id: 'market_analysis',
    name: '市场分析报告',
    category: '常用模板',
    description: '深入分析市场现状、竞争格局和发展机会',
    domain: 'market_analysis',
    example_query: '中国新能源汽车市场现状及发展趋势如何？',
    key_factors: ['市场规模', '竞争格局', '增长趋势', '政策影响'],
  },
  {
    id: 'product_recommendation',
    name: '产品推荐场景',
    category: '热门模板',
    description: '基于用户需求推荐合适的产品或服务',
    domain: 'product_recommendation',
    example_query: '推荐几款适合程序员的机械键盘',
    key_factors: ['产品特性', '用户评价', '性价比', '适用场景'],
  },
  {
    id: 'investment_analysis',
    name: '投资机会分析',
    category: '高级模板',
    description: '评估投资标的，分析风险与收益',
    domain: 'market_analysis',
    example_query: '比亚迪股票值得投资吗？',
    key_factors: ['财务状况', '行业前景', '估值水平', '风险因素'],
  },
  {
    id: 'content_discovery',
    name: '内容发现推荐',
    category: '常用模板',
    description: '发现优质内容和知识资源',
    domain: 'content_recommendation',
    example_query: '推荐一些学习机器学习的优质资源',
    key_factors: ['内容质量', '学习价值', '更新频率', '受众评价'],
  },
  {
    id: 'service_matching',
    name: '服务匹配推荐',
    category: '常用模板',
    description: '根据需求匹配合适的服务提供商',
    domain: 'service_recommendation',
    example_query: '推荐北京地区靠谱的装修公司',
    key_factors: ['服务质量', '价格区间', '用户口碑', '服务范围'],
  },
];

// ==================== 组件 ====================

export default function CasesPage() {
  const [cases, setCases] = useState<AnalysisCase[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'rating' | 'recent' | 'quality'>('recent');
  const [selectedCase, setSelectedCase] = useState<AnalysisCase | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [caseTemplates, setCaseTemplates] = useState<any[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

  // 加载案例
  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (domainFilter !== 'all') params.append('domain', domainFilter);

      const res = await fetch(`/api/cases?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let items = data.data?.cases || [];
        
        // 搜索过滤
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          items = items.filter((c: AnalysisCase) => 
            c.query.toLowerCase().includes(query) ||
            c.tags?.some(t => t.toLowerCase().includes(query))
          );
        }
        
        // 排序
        items = sortItems(items, sortBy);
        setCases(items);
        
        // 统计
        if (data.data?.stats) {
          setStats(data.data.stats);
        }
      }
    } catch (e) {
      console.error('Failed to load cases:', e);
    } finally {
      setLoading(false);
    }
  }, [domainFilter, searchQuery, sortBy]);

  // 初始加载
  useEffect(() => {
    loadCases();
    loadCaseTemplates();
  }, [loadCases]);

  // 加载案例模板
  const loadCaseTemplates = async () => {
    try {
      const res = await fetch('/api/case-template');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCaseTemplates(data.data.templates || []);
        }
      }
    } catch (e) {
      console.warn('Failed to load case templates:', e);
    }
  };

  // 使用模板 - 跳转到首页并预填内容
  const handleUseTemplate = (template: typeof CASE_TEMPLATES[0]) => {
    // 将模板信息存储到 sessionStorage，首页会读取并预填
    sessionStorage.setItem('caseTemplate', JSON.stringify({
      query: template.example_query,
      domain: template.domain,
      keyFactors: template.key_factors,
    }));
    // 关闭对话框并跳转到首页
    setTemplateDialogOpen(false);
    window.location.href = '/';
  };

  // 排序函数
  const sortItems = (items: AnalysisCase[], sortBy: string): AnalysisCase[] => {
    switch (sortBy) {
      case 'rating':
        return [...items].sort((a, b) => (b.user_rating || 0) - (a.user_rating || 0));
      case 'recent':
        return [...items].sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      case 'quality':
        return [...items].sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
      default:
        return items;
    }
  };

  // 查看详情
  const handleViewDetail = (caseItem: AnalysisCase) => {
    setSelectedCase(caseItem);
    setDetailDialogOpen(true);
  };

  // 提交反馈
  const handleSubmitFeedback = async (caseId: string, rating: number) => {
    try {
      await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_feedback',
          caseId,
          data: { rating },
        }),
      });
      loadCases();
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    }
  };

  // 从模板创建案例
  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const res = await fetch('/api/case-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          templateId: selectedTemplate.id,
          values: templateValues,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // 可以跳转到首页进行对话，或者直接显示生成的案例
          setTemplateDialogOpen(false);
          setSelectedTemplate(null);
          setTemplateValues({});
          // 刷新案例列表
          loadCases();
        }
      }
    } catch (e) {
      console.error('Failed to apply template:', e);
    }
  };

  // 从高质量案例创建模板
  const handleCreateTemplateFromCase = async (caseId: string) => {
    try {
      const res = await fetch('/api/case-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          caseId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          alert('模板创建成功！');
          loadCaseTemplates();
        }
      }
    } catch (e) {
      console.error('Failed to create template:', e);
    }
  };

  // 渲染评分星星
  const renderRating = (rating?: number) => {
    const stars = rating ? Math.round(rating) : 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={cn(
              'w-4 h-4',
              i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            )}
          />
        ))}
        {rating && <span className="text-sm text-muted-foreground ml-1">{rating.toFixed(1)}</span>}
      </div>
    );
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  返回首页
                </Button>
              </Link>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold">案例库</h1>
                <p className="text-xs text-muted-foreground">推荐案例与场景</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/knowledge-base">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  知识库
                </Button>
              </Link>
              <Link href="/knowledge">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Network className="h-4 w-4" />
                  知识图谱
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* 统计概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Database className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats?.totalCases || cases.length}</div>
                  <div className="text-xs text-muted-foreground">案例总数</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {stats?.avgRating ? stats.avgRating.toFixed(1) : '-'}
                  </div>
                  <div className="text-xs text-muted-foreground">平均评分</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats?.highQualityCases || 0}</div>
                  <div className="text-xs text-muted-foreground">高质量案例</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Tag className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">
                    {Object.keys(stats?.domainDistribution || {}).length}
                  </div>
                  <div className="text-xs text-muted-foreground">覆盖领域</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 领域分布 */}
        {stats?.domainDistribution && Object.keys(stats.domainDistribution).length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">领域分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.domainDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([domain, count]) => {
                    const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.general;
                    return (
                      <Badge key={domain} variant="outline" className="px-3 py-1">
                        {config.label}: {count}
                      </Badge>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 搜索和筛选 */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索案例主题、标签..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="领域筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部领域</SelectItem>
                  {Object.entries(DOMAIN_CONFIG).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SortAsc className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">最新</SelectItem>
                  <SelectItem value="rating">评分最高</SelectItem>
                  <SelectItem value="quality">质量最高</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setTemplateDialogOpen(true)}
              >
                <Lightbulb className="h-4 w-4" />
                使用模板
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 案例列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : cases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">暂无案例数据</p>
              <p className="text-sm text-muted-foreground mt-1">
                在首页进行推荐对话，系统会自动保存案例
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="grid gap-4 pr-4">
              {cases.map((caseItem) => {
                const domainConfig = DOMAIN_CONFIG[caseItem.domain] || DOMAIN_CONFIG.general;
                const statusConfig = STATUS_CONFIG[caseItem.status || 'completed'] || STATUS_CONFIG.completed;
                
                return (
                  <Card key={caseItem.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base line-clamp-2">{caseItem.query}</CardTitle>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge className={cn('text-xs', domainConfig.color)}>
                              {domainConfig.label}
                            </Badge>
                            <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
                              {statusConfig.label}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {formatDate(caseItem.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {renderRating(caseItem.user_rating)}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleViewDetail(caseItem)}
                          >
                            <Eye className="h-4 w-4" />
                            详情
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {/* 结论摘要 */}
                      {caseItem.conclusion?.summary && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {caseItem.conclusion.summary}
                        </p>
                      )}
                      
                      {/* 关键因素 */}
                      {caseItem.key_factors && caseItem.key_factors.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-3">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                          {caseItem.key_factors.slice(0, 4).map((factor, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {factor}
                            </Badge>
                          ))}
                          {caseItem.key_factors.length > 4 && (
                            <span className="text-xs text-muted-foreground">
                              +{caseItem.key_factors.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* 标签 */}
                      {caseItem.tags && caseItem.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                          {caseItem.tags.slice(0, 5).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* 质量评分 */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>置信度: {((caseItem.confidence || 0) * 100).toFixed(0)}%</span>
                          <span>质量分: {((caseItem.quality_score || 0) * 100).toFixed(0)}%</span>
                          {caseItem.feedback_count !== undefined && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {caseItem.feedback_count} 反馈
                            </span>
                          )}
                        </div>
                        
                        {/* 快速反馈 */}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleSubmitFeedback(caseItem.id, 5)}
                          >
                            <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                            有帮助
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* 使用说明 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              使用说明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-2">浏览案例</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• 案例来自用户推荐对话</li>
                  <li>• 使用搜索查找特定案例</li>
                  <li>• 按领域筛选相关案例</li>
                  <li>• 点击查看详细分析过程</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">案例来源</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• 推荐对话自动保存</li>
                  <li>• 系统自动提取关键因素</li>
                  <li>• 用户反馈更新评分</li>
                  <li>• 高质量案例可复用</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">反馈机制</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• 对有帮助的案例点赞</li>
                  <li>• 反馈帮助系统学习</li>
                  <li>• 高评分案例提升权重</li>
                  <li>• 反馈会更新知识库</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>案例详情</DialogTitle>
            <DialogDescription>
              {selectedCase?.query}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCase && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={DOMAIN_CONFIG[selectedCase.domain]?.color || 'bg-gray-100 text-gray-700'}>
                  {DOMAIN_CONFIG[selectedCase.domain]?.label || selectedCase.domain}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {formatDate(selectedCase.created_at)}
                </div>
                {renderRating(selectedCase.user_rating)}
              </div>
              
              {/* 结论 */}
              {selectedCase.conclusion?.summary && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    分析结论
                  </h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {selectedCase.conclusion.summary}
                  </p>
                </div>
              )}
              
              {/* 关键发现 */}
              {selectedCase.conclusion?.key_findings && selectedCase.conclusion.key_findings.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    关键发现
                  </h4>
                  <ul className="space-y-1">
                    {selectedCase.conclusion.key_findings.map((finding, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 关键因素 */}
              {selectedCase.key_factors && selectedCase.key_factors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    关键因素
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCase.key_factors.map((factor, i) => (
                      <Badge key={i} variant="secondary">{factor}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 完整报告 */}
              {selectedCase.final_report && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    完整报告
                  </h4>
                  <ScrollArea className="h-[200px] w-full border rounded-lg p-3">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {selectedCase.final_report}
                    </pre>
                  </ScrollArea>
                </div>
              )}
              
              {/* 反馈 */}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">这个案例对您有帮助吗？</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSubmitFeedback(selectedCase.id, 5)}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    有帮助
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSubmitFeedback(selectedCase.id, 2)}
                  >
                    <ThumbsDown className="w-4 h-4 mr-1" />
                    无帮助
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 使用模板对话框 */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              推荐案例模板
            </DialogTitle>
            <DialogDescription>
              选择一个模板快速开始，降低分析门槛
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="grid gap-4 py-4">
              {CASE_TEMPLATES.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleUseTemplate(template)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-amber-50">
                          <Sparkles className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {template.description}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">示例问题</h5>
                      <p className="text-sm bg-muted/50 p-2 rounded">{template.example_query}</p>
                    </div>
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">关注要素</h5>
                      <div className="flex flex-wrap gap-1">
                        {template.key_factors.map((factor, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{factor}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>推荐领域: {DOMAIN_CONFIG[template.domain]?.label || template.domain}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
