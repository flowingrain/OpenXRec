/**
 * 知识库浮动面板组件
 * 
 * 在当前页面右上角弹出，不跳转路由
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  X,
  BookOpen,
  Search,
  Plus,
  Upload,
  Trash2,
  Edit,
  RefreshCw,
  Loader2,
  FileText,
  Tag,
  Clock,
  Shield,
  Database,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/LoginDialog';
import Link from 'next/link';

// ==================== 类型定义 ====================

interface KnowledgeEntry {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: {
    source: string;
    confidence: number;
    timestamp: number;
    tags: string[];
    relatedEntities: string[];
  };
  created_at?: string;
  updated_at?: string;
}

interface KnowledgeStats {
  totalEntries: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  averageConfidence: number;
}

// 知识类型配置
const KNOWLEDGE_TYPES = [
  { value: 'fact', label: '事实知识' },
  { value: 'rule', label: '规则知识' },
  { value: 'concept', label: '概念知识' },
  { value: 'procedure', label: '流程知识' },
  { value: 'case', label: '案例知识' },
  { value: 'market', label: '市场知识' },
  { value: 'policy', label: '政策知识' },
  { value: 'other', label: '其他' },
];

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  fact: { label: '事实知识', color: 'bg-blue-100 text-blue-700' },
  rule: { label: '规则知识', color: 'bg-purple-100 text-purple-700' },
  concept: { label: '概念知识', color: 'bg-green-100 text-green-700' },
  procedure: { label: '流程知识', color: 'bg-orange-100 text-orange-700' },
  case: { label: '案例知识', color: 'bg-cyan-100 text-cyan-700' },
  market: { label: '市场知识', color: 'bg-pink-100 text-pink-700' },
  policy: { label: '政策知识', color: 'bg-yellow-100 text-yellow-700' },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700' },
};

// ==================== 组件 Props ====================

interface KnowledgeBasePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ==================== 组件 ====================

export default function KnowledgeBasePanel({ isOpen, onClose }: KnowledgeBasePanelProps) {
  const { user, permissions } = useAuth();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('list');

  // 添加/编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    type: 'fact',
    tags: '',
    source: 'manual',
  });
  const [saving, setSaving] = useState(false);

  // 加载知识条目
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      params.append('limit', '50');

      const res = await fetch(`/api/knowledge?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data?.results?.map((r: any) => r.entry) || data.entries || []);
        
        // 计算统计
        if (data.data?.results || data.entries) {
          const items = data.data?.results?.map((r: any) => r.entry) || data.entries || [];
          const byType: Record<string, number> = {};
          const bySource: Record<string, number> = {};
          let totalConfidence = 0;
          
          items.forEach((item: KnowledgeEntry) => {
            byType[item.type] = (byType[item.type] || 0) + 1;
            bySource[item.metadata?.source || 'unknown'] = (bySource[item.metadata?.source || 'unknown'] || 0) + 1;
            totalConfidence += item.metadata?.confidence || 0.5;
          });
          
          setStats({
            totalEntries: items.length,
            byType,
            bySource,
            averageConfidence: items.length > 0 ? totalConfidence / items.length : 0,
          });
        }
      }
    } catch (e) {
      console.error('Failed to load entries:', e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, typeFilter]);

  useEffect(() => {
    if (isOpen) {
      loadEntries();
    }
  }, [loadEntries, isOpen]);

  // 添加知识
  const handleAddEntry = async () => {
    if (!newEntry.title.trim() || !newEntry.content.trim()) return;
    setSaving(true);

    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newEntry.type,
          title: newEntry.title,
          content: newEntry.content,
          metadata: {
            source: newEntry.source,
            confidence: 0.8,
            tags: newEntry.tags.split(',').map(s => s.trim()).filter(Boolean),
            relatedEntities: [],
          },
        }),
      });

      if (res.ok) {
        setNewEntry({ title: '', content: '', type: 'fact', tags: '', source: 'manual' });
        setEditDialogOpen(false);
        loadEntries();
      }
    } catch (e) {
      console.error('Failed to add entry:', e);
    } finally {
      setSaving(false);
    }
  };

  // 删除知识
  const handleDeleteEntry = async (id: string) => {
    if (!confirm('确定要删除这条知识吗？')) return;

    try {
      const res = await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadEntries();
      }
    } catch (e) {
      console.error('Failed to delete entry:', e);
    }
  };

  // 过滤条目
  const filteredEntries = entries.filter(entry => {
    if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.title.toLowerCase().includes(query) ||
        entry.content.toLowerCase().includes(query) ||
        entry.metadata?.tags?.some((t: string) => t.toLowerCase().includes(query))
      );
    }
    return true;
  });

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
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">知识库</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/knowledge-base" target="_blank">
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
                <TabsTrigger value="list" className="gap-1">
                  <Database className="w-4 h-4" />
                  知识列表
                </TabsTrigger>
                <TabsTrigger value="stats" className="gap-1">
                  <Shield className="w-4 h-4" />
                  统计信息
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="list" className="flex-1 overflow-hidden m-0">
              <div className="h-full flex flex-col p-4 gap-3">
                {/* 搜索和过滤 */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索知识..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      {KNOWLEDGE_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="icon" 
                    variant="outline"
                    onClick={() => setEditDialogOpen(true)}
                    title="添加知识"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="outline"
                    onClick={loadEntries}
                    title="刷新"
                  >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                  </Button>
                </div>

                {/* 列表 */}
                <ScrollArea className="flex-1">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <FileText className="w-8 h-8 mb-2" />
                      <p>暂无知识条目</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-2">
                      {filteredEntries.map((entry) => (
                        <Card key={entry.id} className="overflow-hidden">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={cn("text-xs", TYPE_CONFIG[entry.type]?.color || TYPE_CONFIG.other.color)}>
                                    {TYPE_CONFIG[entry.type]?.label || entry.type}
                                  </Badge>
                                  <span className="font-medium text-sm truncate">{entry.title}</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {entry.content}
                                </p>
                                {entry.metadata?.tags && entry.metadata.tags.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {entry.metadata.tags.slice(0, 3).map((tag, i) => (
                                      <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {entry.metadata.tags.length > 3 && (
                                      <span className="text-[10px] text-muted-foreground">
                                        +{entry.metadata.tags.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteEntry(entry.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full p-4">
                {stats && (
                  <div className="space-y-4">
                    {/* 总览 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">总览</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-2xl font-bold">{stats.totalEntries}</p>
                            <p className="text-xs text-muted-foreground">知识条目</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{(stats.averageConfidence * 100).toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">平均置信度</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 按类型分布 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">按类型分布</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(stats.byType).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between">
                              <Badge className={cn("text-xs", TYPE_CONFIG[type]?.color || TYPE_CONFIG.other.color)}>
                                {TYPE_CONFIG[type]?.label || type}
                              </Badge>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* 按来源分布 */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">按来源分布</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(stats.bySource).map(([source, count]) => (
                            <div key={source} className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">{source}</span>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 添加知识对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加知识</DialogTitle>
            <DialogDescription>
              添加新的知识条目到知识库
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">标题</label>
              <Input
                value={newEntry.title}
                onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                placeholder="知识标题"
              />
            </div>
            <div>
              <label className="text-sm font-medium">类型</label>
              <Select value={newEntry.type} onValueChange={(v) => setNewEntry({ ...newEntry, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KNOWLEDGE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">内容</label>
              <Textarea
                value={newEntry.content}
                onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                placeholder="知识内容"
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium">标签（逗号分隔）</label>
              <Input
                value={newEntry.tags}
                onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                placeholder="标签1, 标签2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddEntry} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
