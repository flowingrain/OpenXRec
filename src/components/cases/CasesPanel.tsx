/**
 * 案例库浮动面板组件
 * 
 * 在当前页面右上角弹出，不跳转路由
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  X,
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
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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

interface CaseRecommendationItem {
  id?: string;
  title?: string;
  description?: string;
  explanation?: string;
  score?: number;
  confidence?: number;
  source?: string;
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
];

// ==================== 组件 Props ====================

interface CasesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (query: string) => void;
}

// ==================== 组件 ====================

export default function CasesPanel({ isOpen, onClose, onSelectTemplate }: CasesPanelProps) {
  const [cases, setCases] = useState<AnalysisCase[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'rating' | 'recent' | 'quality'>('recent');
  const [activeTab, setActiveTab] = useState('cases');
  const [selectedCase, setSelectedCase] = useState<AnalysisCase | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // 加载案例
  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '30');
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

  useEffect(() => {
    if (isOpen) {
      loadCases();
    }
  }, [loadCases, isOpen]);

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

  // 使用模板
  const handleUseTemplate = (template: typeof CASE_TEMPLATES[0]) => {
    if (onSelectTemplate) {
      onSelectTemplate(template.example_query);
    }
    onClose();
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

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 浮动面板 */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-lg shadow-2xl bg-white border-l animate-in slide-in-from-right duration-300">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">案例库</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/cases" target="_blank">
              <Button variant="ghost" size="sm" className="gap-1">
                <ExternalLink className="w-4 h-4" />
                完整页面
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex flex-col h-[calc(100%-60px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 pt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cases" className="gap-1">
                  <Database className="w-4 h-4" />
                  案例列表
                </TabsTrigger>
                <TabsTrigger value="templates" className="gap-1">
                  <Lightbulb className="w-4 h-4" />
                  快速模板
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="cases" className="flex-1 overflow-hidden m-0">
              <div className="h-full flex flex-col p-4 gap-3">
                {/* 搜索和过滤 */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索案例..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={domainFilter} onValueChange={setDomainFilter}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部领域</SelectItem>
                      {Object.entries(DOMAIN_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">最新</SelectItem>
                      <SelectItem value="rating">评分</SelectItem>
                      <SelectItem value="quality">质量</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 统计概览 */}
                {stats && (
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Database className="w-3 h-3" />
                      {stats.totalCases} 个案例
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Star className="w-3 h-3" />
                      均分 {stats.avgRating?.toFixed(1) || '-'}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {stats.highQualityCases} 高质量
                    </Badge>
                  </div>
                )}

                {/* 列表 */}
                <ScrollArea className="flex-1">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : cases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <Database className="w-8 h-8 mb-2" />
                      <p>暂无案例</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-2">
                      {cases.map((caseItem) => (
                        <Card key={caseItem.id} className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => handleViewDetail(caseItem)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={cn("text-xs", DOMAIN_CONFIG[caseItem.domain]?.color || DOMAIN_CONFIG.general.color)}>
                                    {DOMAIN_CONFIG[caseItem.domain]?.label || caseItem.domain}
                                  </Badge>
                                  {caseItem.status && (
                                    <Badge className={cn("text-xs", STATUS_CONFIG[caseItem.status]?.color)}>
                                      {STATUS_CONFIG[caseItem.status]?.label}
                                    </Badge>
                                  )}
                                  {caseItem.user_rating && (
                                    <div className="flex items-center gap-0.5 text-yellow-500">
                                      <Star className="w-3 h-3 fill-current" />
                                      <span className="text-xs">{caseItem.user_rating}</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm font-medium line-clamp-2 mb-1">
                                  {caseItem.query}
                                </p>
                                {caseItem.conclusion?.summary && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {caseItem.conclusion.summary}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  {caseItem.created_at && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {new Date(caseItem.created_at).toLocaleDateString()}
                                    </span>
                                  )}
                                  {caseItem.quality_score && (
                                    <span className="flex items-center gap-1">
                                      <Target className="w-3 h-3" />
                                      质量 {caseItem.quality_score.toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button size="sm" variant="ghost" className="shrink-0">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full p-4">
                <div className="space-y-3">
                  {CASE_TEMPLATES.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleUseTemplate(template)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={cn("text-xs", DOMAIN_CONFIG[template.domain]?.color)}>
                                {template.category}
                              </Badge>
                              <span className="font-medium text-sm">{template.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {template.description}
                            </p>
                            <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground italic">
                              "{template.example_query}"
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.key_factors.map((factor, i) => (
                                <Badge key={i} variant="outline" className="text-[10px]">
                                  {factor}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 案例详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              案例详情
            </DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              {(() => {
                const recItems = ((selectedCase.agent_outputs as any)?.recommendationResponse?.items || []) as CaseRecommendationItem[];
                if (!Array.isArray(recItems) || recItems.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-sm font-medium mb-2">历史推荐内容（来自该案例）</h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {recItems.slice(0, 10).map((rec, idx) => {
                        const score = typeof rec.score === 'number'
                          ? rec.score
                          : (typeof rec.confidence === 'number' ? rec.confidence : 0);
                        return (
                          <div key={rec.id || `case-rec-${idx}`} className="rounded-md border bg-muted/20 p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-[10px]">{idx + 1}</Badge>
                              <span className="text-sm font-medium truncate">{rec.title || '未命名推荐'}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{(score * 100).toFixed(0)}%</span>
                            </div>
                            {rec.description ? (
                              <p className="text-xs text-muted-foreground line-clamp-2">{rec.description}</p>
                            ) : null}
                            {rec.explanation ? (
                              <p className="text-xs mt-1 whitespace-pre-wrap break-words">{rec.explanation}</p>
                            ) : null}
                            {rec.source ? (
                              <div className="mt-1 text-[11px] text-muted-foreground">来源：{rec.source}</div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 基本信息 */}
              <div>
                <h4 className="text-sm font-medium mb-2">查询内容</h4>
                <p className="text-sm bg-muted/50 p-3 rounded">{selectedCase.query}</p>
              </div>
              
              {/* 标签 */}
              <div className="flex flex-wrap gap-2">
                <Badge className={DOMAIN_CONFIG[selectedCase.domain]?.color || DOMAIN_CONFIG.general.color}>
                  {DOMAIN_CONFIG[selectedCase.domain]?.label || selectedCase.domain}
                </Badge>
                {selectedCase.tags?.map((tag, i) => (
                  <Badge key={i} variant="outline">{tag}</Badge>
                ))}
              </div>

              {/* 结论 */}
              {selectedCase.conclusion?.summary && (
                <div>
                  <h4 className="text-sm font-medium mb-2">分析结论</h4>
                  <p className="text-sm bg-green-50 p-3 rounded border border-green-200">
                    {selectedCase.conclusion.summary}
                  </p>
                </div>
              )}

              {/* 关键发现 */}
              {selectedCase.conclusion?.key_findings && selectedCase.conclusion.key_findings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">关键发现</h4>
                  <ul className="text-sm space-y-1">
                    {selectedCase.conclusion.key_findings.map((finding, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 详细报告 */}
              {selectedCase.final_report && (
                <div>
                  <h4 className="text-sm font-medium mb-2">详细报告</h4>
                  <div className="text-sm bg-muted/30 p-3 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {selectedCase.final_report}
                  </div>
                </div>
              )}

              {/* 元信息 */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                {selectedCase.created_at && (
                  <span>创建于 {new Date(selectedCase.created_at).toLocaleString()}</span>
                )}
                {selectedCase.confidence && (
                  <span>置信度 {(selectedCase.confidence * 100).toFixed(0)}%</span>
                )}
                {selectedCase.quality_score && (
                  <span>质量分 {selectedCase.quality_score.toFixed(0)}</span>
                )}
              </div>

              {/* 反馈 */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm text-muted-foreground">这个案例有帮助吗？</span>
                <Button size="sm" variant="outline" onClick={() => handleSubmitFeedback(selectedCase.id, 5)}>
                  <ThumbsUp className="w-4 h-4 mr-1" />
                  有用
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleSubmitFeedback(selectedCase.id, 2)}>
                  <ThumbsDown className="w-4 h-4 mr-1" />
                  无用
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
