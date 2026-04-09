/**
 * 交互历史记录页面
 * 
 * 功能：
 * 1. 展示用户交互历史列表
 * 2. 支持按类型、时间筛选
 * 3. 支持分页
 * 4. 支持导出数据
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  History,
  AlertTriangle,
  Filter,
  Download,
  Eye,
  MousePointer,
  Heart,
  ShoppingCart,
  Star,
  Clock,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface Interaction {
  id: string;
  user_id: string;
  item_id: string;
  item_type: string;
  interaction_type: 'view' | 'click' | 'like' | 'purchase' | 'rating' | 'skip';
  interaction_value?: number;
  context?: Record<string, any>;
  created_at: string;
}

interface InteractionStats {
  total: number;
  byType: Record<string, number>;
  byItemType: Record<string, number>;
}

interface InteractionResponse {
  success: boolean;
  data?: {
    interactions: Interaction[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats?: InteractionStats;
  error?: string;
}

// ============================================================================
// 交互类型图标和颜色
// ============================================================================

const interactionConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  view: { icon: <Eye className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800', label: '浏览' },
  click: { icon: <MousePointer className="h-4 w-4" />, color: 'bg-gray-100 text-gray-800', label: '点击' },
  like: { icon: <Heart className="h-4 w-4" />, color: 'bg-red-100 text-red-800', label: '点赞' },
  purchase: { icon: <ShoppingCart className="h-4 w-4" />, color: 'bg-green-100 text-green-800', label: '购买' },
  rating: { icon: <Star className="h-4 w-4" />, color: 'bg-yellow-100 text-yellow-800', label: '评分' },
  skip: { icon: <Clock className="h-4 w-4" />, color: 'bg-gray-100 text-gray-600', label: '跳过' },
};

// ============================================================================
// 主组件
// ============================================================================

export default function InteractionHistoryPage() {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [stats, setStats] = useState<InteractionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 筛选条件
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterItemType, setFilterItemType] = useState<string>('all');
  
  // 详情弹窗
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 加载数据
  const loadInteractions = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (filterType !== 'all') {
        params.append('interaction_type', filterType);
      }
      if (filterItemType !== 'all') {
        params.append('item_type', filterItemType);
      }

      // 模拟数据（实际应调用 API）
      // const response = await fetch(`/api/interactions?${params}`);
      // const data: InteractionResponse = await response.json();
      
      // 使用模拟数据
      const mockInteractions: Interaction[] = generateMockInteractions(100);
      const filtered = mockInteractions.filter(i => {
        if (filterType !== 'all' && i.interaction_type !== filterType) return false;
        if (filterItemType !== 'all' && i.item_type !== filterItemType) return false;
        return true;
      });
      
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + limit);
      
      setInteractions(paginated);
      setStats({
        total: filtered.length,
        byType: {
          view: 45,
          click: 30,
          like: 15,
          purchase: 5,
          rating: 3,
          skip: 2,
        },
        byItemType: {
          product: 50,
          article: 30,
          video: 20,
        },
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterType, filterItemType]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  // 导出数据
  const handleExport = () => {
    const csv = [
      ['ID', '用户ID', '物品ID', '物品类型', '交互类型', '交互值', '时间'].join(','),
      ...interactions.map(i => [
        i.id,
        i.user_id,
        i.item_id,
        i.item_type,
        i.interaction_type,
        i.interaction_value || '',
        i.created_at,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 查看详情
  const handleViewDetail = (interaction: Interaction) => {
    setSelectedInteraction(interaction);
    setDetailOpen(true);
  };

  const totalPages = stats ? Math.ceil(stats.total / limit) : 1;

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          交互历史记录
        </h1>
        <p className="text-muted-foreground">
          查看和管理您的交互历史数据
        </p>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">总交互数</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">浏览</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.byType.view || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">购买</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.byType.purchase || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">点赞</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{stats.byType.like || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选和操作 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm">交互类型:</span>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="view">浏览</SelectItem>
                  <SelectItem value="click">点击</SelectItem>
                  <SelectItem value="like">点赞</SelectItem>
                  <SelectItem value="purchase">购买</SelectItem>
                  <SelectItem value="rating">评分</SelectItem>
                  <SelectItem value="skip">跳过</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">物品类型:</span>
              <Select value={filterItemType} onValueChange={setFilterItemType}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="product">商品</SelectItem>
                  <SelectItem value="article">文章</SelectItem>
                  <SelectItem value="video">视频</SelectItem>
                  <SelectItem value="service">服务</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">每页显示:</span>
              <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            <Button variant="outline" onClick={loadInteractions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>

            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 交互列表 */}
      <Card>
        <CardHeader>
          <CardTitle>交互列表</CardTitle>
          <CardDescription>
            共 {stats?.total || 0} 条记录，当前第 {page} 页
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : interactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">暂无交互记录</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>交互类型</TableHead>
                    <TableHead>物品类型</TableHead>
                    <TableHead>物品ID</TableHead>
                    <TableHead>交互值</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interactions.map((interaction) => {
                    const config = interactionConfig[interaction.interaction_type] || {
                      icon: null,
                      color: 'bg-gray-100 text-gray-800',
                      label: interaction.interaction_type,
                    };
                    return (
                      <TableRow key={interaction.id}>
                        <TableCell className="text-sm">
                          {new Date(interaction.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={config.color}>
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{interaction.item_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {interaction.item_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {interaction.interaction_value !== undefined
                            ? interaction.interaction_value
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(interaction)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* 分页 */}
              <Separator className="my-4" />
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage(Math.max(1, page - 1))}
                      className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, page - 2) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={pageNum === page}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </>
          )}
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>交互详情</DialogTitle>
            <DialogDescription>
              查看交互的详细信息
            </DialogDescription>
          </DialogHeader>
          {selectedInteraction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">交互ID</p>
                  <p className="font-mono">{selectedInteraction.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">用户ID</p>
                  <p className="font-mono">{selectedInteraction.user_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">物品ID</p>
                  <p className="font-mono">{selectedInteraction.item_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">时间</p>
                  <p>{new Date(selectedInteraction.created_at).toLocaleString()}</p>
                </div>
              </div>
              <Separator />
              {selectedInteraction.context && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">上下文信息</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedInteraction.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// 模拟数据生成
// ============================================================================

function generateMockInteractions(count: number): Interaction[] {
  const types: Interaction['interaction_type'][] = ['view', 'click', 'like', 'purchase', 'rating', 'skip'];
  const itemTypes = ['product', 'article', 'video', 'service'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `int_${i.toString().padStart(6, '0')}`,
    user_id: 'user_001',
    item_id: `item_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
    item_type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
    interaction_type: types[Math.floor(Math.random() * types.length)],
    interaction_value: Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : undefined,
    context: {
      source: ['homepage', 'search', 'recommendation', 'category'][Math.floor(Math.random() * 4)],
      device: ['mobile', 'desktop', 'tablet'][Math.floor(Math.random() * 3)],
    },
    created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}
