'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Database,
  Search,
  Star,
  Trash2,
  Download,
  Upload,
  Clock,
  Tag,
  FlaskConical,
  Compass,
  GitBranch,
  RotateCcw,
  AlertCircle,
  Check,
  X,
  FileText,
  BarChart3
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface StoredSession {
  id: string;
  type: 'exploration' | 'sandbox' | 'scenario' | 'review';
  name: string;
  description?: string;
  data: any;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
    tags: string[];
    isFavorite: boolean;
  };
  statistics?: {
    hypothesesCount?: number;
    evidenceCount?: number;
    confidence?: number;
    status?: string;
  };
}

interface StorageStats {
  totalSessions: number;
  byType: Record<string, number>;
  favorites: number;
  totalSize: number;
}

// ============================================================================
// 主组件
// ============================================================================

interface SessionManagerProps {
  onLoadSession?: (session: StoredSession) => void;
  currentSessionId?: string;
}

export function SessionManager({ onLoadSession, currentSessionId }: SessionManagerProps) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [selectedSession, setSelectedSession] = useState<StoredSession | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  // 加载会话列表
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('query', searchQuery);
      if (filterType !== 'all') params.set('type', filterType);
      if (filterFavorite) params.set('isFavorite', 'true');
      
      const response = await fetch(`/api/storage?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setSessions(result.data);
      }
    } catch (error) {
      console.error('Load sessions error:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterType, filterFavorite]);
  
  // 加载统计
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/storage?action=statistics');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    }
  }, []);
  
  // 初始加载
  useEffect(() => {
    loadSessions();
    loadStats();
  }, [loadSessions, loadStats]);
  
  // 切换收藏
  const toggleFavorite = async (id: string) => {
    try {
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleFavorite',
          data: { id }
        })
      });
      
      loadSessions();
      loadStats();
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };
  
  // 删除会话
  const deleteSession = async (id: string) => {
    if (!confirm('确定要删除此会话吗？此操作不可撤销。')) return;
    
    try {
      await fetch(`/api/storage?id=${id}`, { method: 'DELETE' });
      loadSessions();
      loadStats();
    } catch (error) {
      console.error('Delete session error:', error);
    }
  };
  
  // 导出数据
  const handleExport = async () => {
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' })
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `分析数据导出_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };
  
  // 导入数据
  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', data })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`成功导入 ${result.data.imported} 条记录`);
        loadSessions();
        loadStats();
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('导入失败，请检查文件格式');
    }
  };
  
  // 清空所有数据
  const handleClearAll = async () => {
    if (!confirm('确定要清空所有数据吗？此操作不可撤销！')) return;
    
    try {
      await fetch('/api/storage?action=clear', { method: 'DELETE' });
      loadSessions();
      loadStats();
    } catch (error) {
      console.error('Clear error:', error);
    }
  };
  
  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 格式化大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  
  // 类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'exploration': return <Compass className="h-4 w-4" />;
      case 'sandbox': return <FlaskConical className="h-4 w-4" />;
      case 'scenario': return <GitBranch className="h-4 w-4" />;
      case 'review': return <RotateCcw className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };
  
  // 类型标签
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'exploration': return '探秘分析';
      case 'sandbox': return '假设沙盒';
      case 'scenario': return '场景推演';
      case 'review': return '复盘进化';
      default: return '未知';
    }
  };
  
  // 渲染会话卡片
  const renderSessionCard = (session: StoredSession) => {
    const isActive = session.id === currentSessionId;
    
    return (
      <Card 
        key={session.id}
        className={`cursor-pointer transition-all hover:shadow-md ${
          isActive ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => {
          setSelectedSession(session);
          setShowDetail(true);
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getTypeIcon(session.type)}
              <CardTitle className="text-sm font-medium truncate">
                {session.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(session.id);
                      }}
                    >
                      <Star className={`h-4 w-4 ${
                        session.metadata.isFavorite 
                          ? 'text-yellow-500 fill-yellow-500' 
                          : 'text-gray-400'
                      }`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {session.metadata.isFavorite ? '取消收藏' : '收藏'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>删除</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {getTypeLabel(session.type)}
            </Badge>
            {session.metadata.isFavorite && (
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {session.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {session.description}
            </p>
          )}
          
          {/* 统计信息 */}
          {session.statistics && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              {session.statistics.hypothesesCount !== undefined && (
                <span>{session.statistics.hypothesesCount} 假设</span>
              )}
              {session.statistics.evidenceCount !== undefined && (
                <span>{session.statistics.evidenceCount} 证据</span>
              )}
              {session.statistics.confidence !== undefined && (
                <span className="text-green-500">
                  {(session.statistics.confidence * 100).toFixed(0)}% 置信度
                </span>
              )}
            </div>
          )}
          
          {/* 标签 */}
          {session.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {session.metadata.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {session.metadata.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{session.metadata.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
          
          {/* 时间 */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(session.metadata.updatedAt)}
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* 头部统计 */}
      {stats && (
        <div className="border-b p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalSessions}</div>
              <div className="text-xs text-muted-foreground">总会话</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">{stats.favorites}</div>
              <div className="text-xs text-muted-foreground">收藏</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatSize(stats.totalSize)}</div>
              <div className="text-xs text-muted-foreground">存储大小</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.byType['exploration'] || 0}</div>
              <div className="text-xs text-muted-foreground">探秘分析</div>
            </div>
          </div>
        </div>
      )}
      
      {/* 搜索和过滤 */}
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索会话..."
              className="pl-8"
            />
          </div>
          
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="exploration">探秘分析</SelectItem>
              <SelectItem value="sandbox">假设沙盒</SelectItem>
              <SelectItem value="scenario">场景推演</SelectItem>
              <SelectItem value="review">复盘进化</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant={filterFavorite ? 'default' : 'outline'}
            size="icon"
            onClick={() => setFilterFavorite(!filterFavorite)}
          >
            <Star className={`h-4 w-4 ${filterFavorite ? 'fill-current' : ''}`} />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <label className="cursor-pointer">
            <Button variant="outline" size="icon" asChild>
              <span>
                <Upload className="h-4 w-4" />
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
          </label>
        </div>
      </div>
      
      {/* 会话列表 */}
      <ScrollArea className="flex-1 p-4">
        {sessions.length > 0 ? (
          <div className="grid gap-3">
            {sessions.map(renderSessionCard)}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无保存的会话</p>
            <p className="text-xs mt-1">开始分析后，会话将自动保存</p>
          </div>
        )}
      </ScrollArea>
      
      {/* 详情对话框 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getTypeIcon(selectedSession.type)}
                  {selectedSession.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedSession.description || '无描述'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">类型：</span>
                    {getTypeLabel(selectedSession.type)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">创建时间：</span>
                    {formatDate(selectedSession.metadata.createdAt)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">更新时间：</span>
                    {formatDate(selectedSession.metadata.updatedAt)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">版本：</span>
                    {selectedSession.metadata.version}
                  </div>
                </div>
                
                {/* 标签 */}
                {selectedSession.metadata.tags.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">标签</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedSession.metadata.tags.map(tag => (
                        <Badge key={tag} variant="secondary">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 统计 */}
                {selectedSession.statistics && (
                  <div>
                    <div className="text-sm font-medium mb-2">统计</div>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedSession.statistics.hypothesesCount !== undefined && (
                        <div className="bg-accent rounded p-2 text-center">
                          <div className="text-lg font-bold">
                            {selectedSession.statistics.hypothesesCount}
                          </div>
                          <div className="text-xs text-muted-foreground">假设</div>
                        </div>
                      )}
                      {selectedSession.statistics.evidenceCount !== undefined && (
                        <div className="bg-accent rounded p-2 text-center">
                          <div className="text-lg font-bold">
                            {selectedSession.statistics.evidenceCount}
                          </div>
                          <div className="text-xs text-muted-foreground">证据</div>
                        </div>
                      )}
                      {selectedSession.statistics.confidence !== undefined && (
                        <div className="bg-accent rounded p-2 text-center">
                          <div className="text-lg font-bold text-green-500">
                            {(selectedSession.statistics.confidence * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted-foreground">置信度</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 数据预览 */}
                <div>
                  <div className="text-sm font-medium mb-2">数据预览</div>
                  <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-48">
                    {JSON.stringify(selectedSession.data, null, 2).substring(0, 2000)}
                    {JSON.stringify(selectedSession.data).length > 2000 && '...'}
                  </pre>
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => deleteSession(selectedSession.id)}
                  className="text-red-500"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </Button>
                <Button onClick={() => {
                  onLoadSession?.(selectedSession);
                  setShowDetail(false);
                }}>
                  加载此会话
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* 底部操作 */}
      <div className="border-t p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          className="text-red-500 w-full"
        >
          <AlertCircle className="h-4 w-4 mr-1" />
          清空所有数据
        </Button>
      </div>
    </div>
  );
}
