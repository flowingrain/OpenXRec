/**
 * 管理员审核仪表盘
 * 
 * 知识审核、用户管理等管理员功能
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Users,
  BarChart3,
  Filter,
  RefreshCw,
  Loader2,
  Eye,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  User,
  Settings,
  Brain,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  full_name?: string;
  avatar_url?: string;
}

interface PermissionCheck {
  canAddKnowledge: boolean;
  canEditKnowledge: boolean;
  canDeleteKnowledge: boolean;
  canReviewKnowledge: boolean;
  canManageUsers: boolean;
  canViewAdminPanel: boolean;
}

interface ReviewItem {
  id: string;
  type: 'entity' | 'relation';
  data: Record<string, any>;
  source: string;
  confidence: number;
  submittedBy?: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  conflicts?: ConflictInfo[];
}

interface ConflictInfo {
  type: 'duplicate' | 'contradiction' | 'low_confidence';
  description: string;
  relatedItems?: string[];
}

interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
  byType: {
    entities: number;
    relations: number;
  };
  avgConfidence: number;
  recentApproved: number;
  recentRejected: number;
}

interface FeedbackEventLibraryItem {
  id: string;
  feedbackType: string;
  comment: string | null;
  caseId: string | null;
  userId: string | null;
  createdAt: string;
}

interface StrategyLearningLibraryItem {
  versionId: string;
  version: number;
  source: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  avgReward: number | null;
}

interface KnowledgeCandidateLibraryItem {
  id: string;
  name: string;
  patternType: string;
  confidence: number | null;
  isVerified: boolean;
  createdAt: string;
  source: string | null;
}

interface CapabilityLibraryState {
  feedbackEvents: FeedbackEventLibraryItem[];
  strategyLibrary: StrategyLearningLibraryItem[];
  knowledgeCandidates: KnowledgeCandidateLibraryItem[];
  stats: {
    feedbackEvents: number;
    strategyLearning: number;
    strategyVersions: number;
    strategyTrainingHistory: number;
    knowledgeCandidates: number;
  };
}

// ==================== 组件 ====================

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<PermissionCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);

  // 审核队列
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'entity' | 'relation'>('all');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [capabilityLibraries, setCapabilityLibraries] = useState<CapabilityLibraryState | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [capabilityWindowDays, setCapabilityWindowDays] = useState<'7' | '30' | 'all'>('30');

  // 审核对话框
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [itemConflicts, setItemConflicts] = useState<ConflictInfo[]>([]);

  // 检查登录状态
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data.user) {
          setUser(data.data.user);
          setPermissions(data.data.permissions);

          // 检查管理员权限
          if (!data.data.permissions.canViewAdminPanel) {
            router.push('/');
            return;
          }
        } else {
          // 未登录，跳转到首页
          router.push('/');
          return;
        }
      }
    } catch (e) {
      console.error('Auth check failed:', e);
      router.push('/');
    } finally {
      setAuthChecking(false);
    }
  }, [router]);

  // 加载审核队列
  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('action', 'queue');
      if (filterType !== 'all') params.append('type', filterType);
      params.append('status', filterStatus);

      const res = await fetch(`/api/admin/review?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setQueue(data.data.queue || []);
        }
      }
    } catch (e) {
      console.error('Load queue failed:', e);
    } finally {
      setQueueLoading(false);
    }
  }, [filterType, filterStatus]);

  // 加载统计
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/review?action=stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.data.stats);
        }
      }
    } catch (e) {
      console.error('Load stats failed:', e);
    }
  }, []);

  // 加载能力积累库（仅管理员查看）
  const loadCapabilityLibraries = useCallback(async () => {
    setCapabilityLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('windowDays', capabilityWindowDays);
      const res = await fetch(`/api/admin/capability-libraries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCapabilityLibraries(data.data as CapabilityLibraryState);
        }
      }
    } catch (e) {
      console.error('Load capability libraries failed:', e);
    } finally {
      setCapabilityLoading(false);
    }
  }, [capabilityWindowDays]);

  // 初始化
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authChecking && user && permissions?.canViewAdminPanel) {
      loadQueue();
      loadStats();
      loadCapabilityLibraries();
    }
  }, [authChecking, user, permissions, loadQueue, loadStats, loadCapabilityLibraries]);

  // 审核操作
  const handleReview = async (approved: boolean) => {
    if (!selectedItem) return;
    setReviewing(true);

    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          type: selectedItem.type,
          id: selectedItem.id,
          approved,
          note: reviewNote,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReviewDialogOpen(false);
          setSelectedItem(null);
          setReviewNote('');
          loadQueue();
          loadStats();
        }
      }
    } catch (e) {
      console.error('Review failed:', e);
    } finally {
      setReviewing(false);
    }
  };

  // 查看详情并检测冲突
  const handleViewItem = async (item: ReviewItem) => {
    setSelectedItem(item);
    setReviewDialogOpen(true);
    setReviewNote('');

    // 获取冲突检测
    try {
      const params = new URLSearchParams();
      params.append('action', 'conflicts');
      params.append('id', item.id);
      params.append('itemType', item.type);

      const res = await fetch(`/api/admin/review?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setItemConflicts(data.data.conflicts || []);
        }
      }
    } catch (e) {
      console.error('Conflict detection failed:', e);
      setItemConflicts([]);
    }
  };

  // 批量操作
  const handleBatchApprove = async () => {
    const pendingItems = queue.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) return;

    if (!confirm(`确定要批量通过 ${pendingItems.length} 条待审核项吗？`)) return;

    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch-review',
          items: pendingItems.map(i => ({ type: i.type, id: i.id })),
          approved: true,
        }),
      });

      if (res.ok) {
        loadQueue();
        loadStats();
      }
    } catch (e) {
      console.error('Batch approve failed:', e);
    }
  };

  // 加载中
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">验证权限中...</p>
        </div>
      </div>
    );
  }

  // 无权限
  if (!user || !permissions?.canViewAdminPanel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">需要管理员权限</h2>
            <p className="text-muted-foreground mb-4">您没有权限访问此页面</p>
            <Button onClick={() => router.push('/')}>返回首页</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部导航 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              返回首页
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h1 className="font-semibold">管理员仪表盘</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1.5">
              <User className="w-3 h-3" />
              {user.username}
            </Badge>
            <Badge className="bg-blue-100 text-blue-700">
              {user.role === 'admin' ? '管理员' : '用户'}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">待审核</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-200" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">已通过</p>
                    <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-200" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">已拒绝</p>
                    <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-200" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">平均置信度</p>
                    <p className="text-2xl font-bold">{(stats.avgConfidence * 100).toFixed(0)}%</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 主内容 */}
        <Tabs defaultValue="review" className="space-y-4">
          <TabsList>
            <TabsTrigger value="review" className="gap-1.5">
              <Clock className="w-4 h-4" />
              知识审核
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <Database className="w-4 h-4" />
              审核历史
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="w-4 h-4" />
              系统设置
            </TabsTrigger>
            <TabsTrigger value="capability-libraries" className="gap-1.5">
              <Database className="w-4 h-4" />
              能力积累库
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="space-y-4">
            {/* 筛选和操作 */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex gap-3">
                    <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="类型筛选" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部类型</SelectItem>
                        <SelectItem value="entity">实体</SelectItem>
                        <SelectItem value="relation">关系</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="状态筛选" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">待审核</SelectItem>
                        <SelectItem value="approved">已通过</SelectItem>
                        <SelectItem value="rejected">已拒绝</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" onClick={() => { loadQueue(); loadStats(); }}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  {filterStatus === 'pending' && queue.length > 0 && (
                    <Button variant="default" onClick={handleBatchApprove}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      批量通过
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 队列列表 */}
            {queueLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                </CardContent>
              </Card>
            ) : queue.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">暂无待审核项</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-3 pr-4">
                  {queue.map((item) => (
                    <Card key={`${item.type}-${item.id}`} className="hover:shadow-md transition-shadow">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">
                                {item.type === 'entity' ? '实体' : '关系'}
                              </Badge>
                              <Badge className={
                                item.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                item.status === 'approved' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              }>
                                {item.status === 'pending' ? '待审核' :
                                 item.status === 'approved' ? '已通过' : '已拒绝'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                置信度: {(item.confidence * 100).toFixed(0)}%
                              </span>
                            </div>

                            {item.type === 'entity' ? (
                              <div>
                                <h4 className="font-medium">{item.data.name}</h4>
                                <p className="text-sm text-muted-foreground truncate">
                                  {item.data.description || '无描述'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  类型: {item.data.type} | 来源: {item.source}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <h4 className="font-medium">
                                  {item.data.source_name} → {item.data.target_name}
                                </h4>
                                <p className="text-sm text-muted-foreground truncate">
                                  {item.data.evidence || '无证据'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  关系: {item.data.type} | 来源: {item.source}
                                </p>
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground mt-2">
                              提交于 {new Date(item.submittedAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewItem(item)}>
                              <Eye className="w-4 h-4 mr-1" />
                              审核
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>审核历史</CardTitle>
                <CardDescription>查看最近的审核记录</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  功能开发中...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>系统设置</CardTitle>
                <CardDescription>配置审核规则和系统参数</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  功能开发中...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capability-libraries" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>能力积累库（管理员）</CardTitle>
                    <CardDescription>
                      用户侧无感，仅用于查看系统沉淀：反馈事件、策略学习、知识候选
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={capabilityWindowDays}
                      onValueChange={(v) => setCapabilityWindowDays(v as '7' | '30' | 'all')}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="时间范围" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">近7天</SelectItem>
                        <SelectItem value="30">近30天</SelectItem>
                        <SelectItem value="all">全部</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={loadCapabilityLibraries} disabled={capabilityLoading}>
                      {capabilityLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {capabilityLoading && !capabilityLibraries ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : !capabilityLibraries ? (
                  <p className="text-sm text-muted-foreground">暂无数据</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">反馈事件库</p>
                              <p className="text-2xl font-bold">{capabilityLibraries.stats.feedbackEvents}</p>
                            </div>
                            <MessageSquare className="w-6 h-6 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">策略学习库</p>
                              <p className="text-2xl font-bold">{capabilityLibraries.stats.strategyLearning}</p>
                              <p className="text-xs text-muted-foreground">
                                版本 {capabilityLibraries.stats.strategyVersions} / 训练 {capabilityLibraries.stats.strategyTrainingHistory}
                              </p>
                            </div>
                            <Brain className="w-6 h-6 text-purple-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">知识候选库</p>
                              <p className="text-2xl font-bold">{capabilityLibraries.stats.knowledgeCandidates}</p>
                            </div>
                            <BookOpen className="w-6 h-6 text-green-600" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">反馈事件库</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[320px] pr-2">
                            <div className="space-y-2">
                              {capabilityLibraries.feedbackEvents.length === 0 ? (
                                <p className="text-sm text-muted-foreground">暂无反馈事件</p>
                              ) : (
                                capabilityLibraries.feedbackEvents.map((item) => (
                                  <div key={item.id} className="rounded-md border p-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <Badge variant="outline">{item.feedbackType}</Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(item.createdAt).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-xs mt-1 text-muted-foreground line-clamp-2">
                                      {item.comment || '（无文本反馈）'}
                                    </p>
                                    <p className="text-[11px] mt-1 text-muted-foreground">
                                      case={item.caseId || '-'} user={item.userId || '-'}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">策略学习库</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[320px] pr-2">
                            <div className="space-y-2">
                              {capabilityLibraries.strategyLibrary.length === 0 ? (
                                <p className="text-sm text-muted-foreground">暂无策略版本记录</p>
                              ) : (
                                capabilityLibraries.strategyLibrary.map((item) => (
                                  <div key={item.versionId} className="rounded-md border p-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline">v{item.version}</Badge>
                                      {item.isActive && <Badge className="bg-green-100 text-green-700">active</Badge>}
                                      {item.isVerified && <Badge className="bg-blue-100 text-blue-700">verified</Badge>}
                                      {item.source && <Badge variant="secondary">{item.source}</Badge>}
                                    </div>
                                    <p className="text-xs mt-1 text-muted-foreground">
                                      avgReward: {typeof item.avgReward === 'number' ? item.avgReward.toFixed(3) : 'N/A'}
                                    </p>
                                    <p className="text-[11px] mt-1 text-muted-foreground">
                                      {new Date(item.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">知识候选库</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[320px] pr-2">
                            <div className="space-y-2">
                              {capabilityLibraries.knowledgeCandidates.length === 0 ? (
                                <p className="text-sm text-muted-foreground">暂无候选知识</p>
                              ) : (
                                capabilityLibraries.knowledgeCandidates.map((item) => (
                                  <div key={item.id} className="rounded-md border p-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline">{item.patternType}</Badge>
                                      <Badge className={item.isVerified ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                                        {item.isVerified ? '已验证' : '待验证'}
                                      </Badge>
                                    </div>
                                    <p className="text-xs mt-1 font-medium line-clamp-1">{item.name}</p>
                                    <p className="text-[11px] mt-1 text-muted-foreground">
                                      confidence={typeof item.confidence === 'number' ? item.confidence.toFixed(2) : 'N/A'}
                                      {item.source ? ` · source=${item.source}` : ''}
                                    </p>
                                    <p className="text-[11px] mt-1 text-muted-foreground">
                                      {new Date(item.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* 审核对话框 */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.type === 'entity' ? '审核实体' : '审核关系'}
            </DialogTitle>
            <DialogDescription>
              请仔细检查后决定是否通过
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              {/* 冲突警告 */}
              {itemConflicts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    检测到潜在问题
                  </div>
                  <ul className="text-sm text-amber-600 space-y-1">
                    {itemConflicts.map((conflict, i) => (
                      <li key={i}>• {conflict.description}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 详情 */}
              <div className="bg-muted/50 rounded-lg p-3">
                {selectedItem.type === 'entity' ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground text-sm">名称：</span>
                      <span className="font-medium">{selectedItem.data.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">类型：</span>
                      <span>{selectedItem.data.type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">描述：</span>
                      <p className="text-sm">{selectedItem.data.description || '无'}</p>
                    </div>
                    {selectedItem.data.aliases?.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-sm">别名：</span>
                        <span>{selectedItem.data.aliases.join(', ')}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <span className="text-muted-foreground text-sm">源实体：</span>
                      <span className="font-medium">{selectedItem.data.source_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">目标实体：</span>
                      <span className="font-medium">{selectedItem.data.target_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">关系类型：</span>
                      <span>{selectedItem.data.type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">证据：</span>
                      <p className="text-sm">{selectedItem.data.evidence || '无'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 审核备注 */}
              <div>
                <label className="text-sm font-medium">审核备注（可选）</label>
                <Textarea
                  placeholder="填写审核意见..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview(false)}
              disabled={reviewing}
            >
              {reviewing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              拒绝
            </Button>
            <Button
              onClick={() => handleReview(true)}
              disabled={reviewing}
            >
              {reviewing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
