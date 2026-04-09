/**
 * 知识图谱浏览页面
 * 
 * 用户可访问的知识图谱浏览界面，支持：
 * - 查看所有实体和关系
 * - 搜索和筛选
 * - 质量评分排序
 * - 添加新实体（需登录）
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  BookOpen,
  Search,
  Plus,
  Star,
  Database,
  Network,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  SortAsc,
  Building,
  Link2,
  Loader2,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  Shield,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/LoginDialog';

// ==================== 类型定义 ====================

interface KGEntity {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  description?: string;
  importance: number;
  source_type: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

interface KGRelation {
  id: string;
  source_entity_id: string;
  source_name?: string;
  target_entity_id: string;
  target_name?: string;
  type: string;
  confidence: number;
  evidence?: string;
  source_type: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

interface KnowledgeStats {
  totalEntities: number;
  totalRelations: number;
  verifiedEntities: number;
  verifiedRelations: number;
  entityTypeDistribution: Record<string, number>;
  relationTypeDistribution: Record<string, number>;
  avgConfidence: number;
  recentAdditions: number;
}

// ==================== 实体类型配置 ====================

const ENTITY_TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  company: { label: '公司', color: 'bg-blue-100 text-blue-700', icon: Building },
  person: { label: '人物', color: 'bg-purple-100 text-purple-700', icon: null },
  location: { label: '地点', color: 'bg-green-100 text-green-700', icon: null },
  policy: { label: '政策', color: 'bg-orange-100 text-orange-700', icon: null },
  product: { label: '产品', color: 'bg-cyan-100 text-cyan-700', icon: null },
  organization: { label: '机构', color: 'bg-indigo-100 text-indigo-700', icon: null },
  event: { label: '事件', color: 'bg-pink-100 text-pink-700', icon: null },
  industry: { label: '行业', color: 'bg-yellow-100 text-yellow-700', icon: null },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700', icon: null },
};

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  llm: { label: 'LLM提取', color: 'bg-purple-50 text-purple-600' },
  manual: { label: '手动添加', color: 'bg-blue-50 text-blue-600' },
  document: { label: '文档解析', color: 'bg-green-50 text-green-600' },
  preset: { label: '预置知识', color: 'bg-orange-50 text-orange-600' },
  feedback: { label: '反馈学习', color: 'bg-cyan-50 text-cyan-600' },
};

// ==================== 组件 ====================

export default function KnowledgePage() {
  const router = useRouter();
  const { user, permissions, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('entities');
  const [entities, setEntities] = useState<KGEntity[]>([]);
  const [relations, setRelations] = useState<KGRelation[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'importance' | 'recent' | 'confidence' | 'usage'>('importance');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [newEntity, setNewEntity] = useState({
    name: '',
    type: 'other',
    description: '',
    aliases: '',
  });

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'stats' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
        }
      }
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
  }, []);

  // 加载实体
  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('keyword', searchQuery);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      params.append('limit', '100');

      const res = await fetch(`/api/knowledge-graph?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let items = data.data?.entities || data.entities || [];
        
        // 排序
        items = sortItems(items, sortBy);
        setEntities(items);
      }
    } catch (e) {
      console.error('Failed to load entities:', e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, typeFilter, sortBy]);

  // 加载关系
  const loadRelations = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge-graph');
      if (res.ok) {
        const data = await res.json();
        setRelations(data.data?.relations || data.relations || []);
      }
    } catch (e) {
      console.error('Failed to load relations:', e);
    }
  }, []);

  // 排序函数
  const sortItems = <T extends KGEntity | KGRelation>(items: T[], sortBy: string): T[] => {
    switch (sortBy) {
      case 'importance':
        return [...items].sort((a, b) => ('importance' in a && 'importance' in b ? b.importance - a.importance : 0));
      case 'recent':
        return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'confidence':
        return [...items].sort((a, b) => ('confidence' in a && 'confidence' in b ? b.confidence - a.confidence : 0));
      case 'usage':
        return [...items].sort((a, b) => {
          const usageA = ((a as any).properties?.usage_count as number) || 0;
          const usageB = ((b as any).properties?.usage_count as number) || 0;
          return usageB - usageA;
        });
      default:
        return items;
    }
  };

  // 初始加载
  useEffect(() => {
    loadStats();
    loadEntities();
    loadRelations();
    loadTemplates();
  }, [loadStats, loadEntities, loadRelations]);

  // 加载模板
  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/knowledge/template');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTemplates(data.data.templates || []);
        }
      }
    } catch (e) {
      console.warn('Failed to load templates:', e);
    }
  };

  // 添加实体
  const handleAddEntity = async () => {
    if (!newEntity.name.trim()) return;

    try {
      const res = await fetch('/api/knowledge-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_entity',
          entity: {
            name: newEntity.name,
            type: newEntity.type,
            description: newEntity.description,
            aliases: newEntity.aliases.split(',').map(s => s.trim()).filter(Boolean),
            importance: 0.5,
            source_type: 'manual',
            verified: false,
          },
        }),
      });

      if (res.ok) {
        setNewEntity({ name: '', type: 'other', description: '', aliases: '' });
        setAddDialogOpen(false);
        loadEntities();
        loadStats();
      }
    } catch (e) {
      console.error('Failed to add entity:', e);
    }
  };

  // 从模板创建实体
  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const res = await fetch('/api/knowledge/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          values: templateValues,
        }),
      });

      if (res.ok) {
        setTemplateDialogOpen(false);
        setSelectedTemplate(null);
        setTemplateValues({});
        loadEntities();
        loadStats();
      }
    } catch (e) {
      console.error('Failed to create from template:', e);
    }
  };

  // 记录实体使用
  const recordEntityUsage = async (entityId: string, contextType: string) => {
    try {
      await fetch('/api/knowledge/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          entityType: 'entity',
          contextType,
        }),
      });
    } catch (e) {
      console.warn('Failed to record usage:', e);
    }
  };

  // 删除实体
  const handleDeleteEntity = async (entityId: string) => {
    if (!confirm('确定要删除这个实体吗？')) return;

    try {
      const res = await fetch(`/api/knowledge-graph?id=${entityId}`, { method: 'DELETE' });
      if (res.ok) {
        setEntities(prev => prev.filter(e => e.id !== entityId));
        loadStats();
      }
    } catch (e) {
      console.error('Failed to delete entity:', e);
    }
  };

  // 渲染质量评分星星
  const renderQualityStars = (score: number) => {
    const stars = Math.round(score * 5);
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={cn(
              'w-3.5 h-3.5',
              i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            )}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">{(score * 100).toFixed(0)}%</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold">知识图谱</h1>
                <p className="text-xs text-muted-foreground">浏览和编辑实体关系</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/knowledge-base">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  知识库
                </Button>
              </Link>
              <Link href="/cases">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Database className="h-4 w-4" />
                  案例库
                </Button>
              </Link>
              {permissions?.canViewAdminPanel && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Shield className="h-4 w-4" />
                    管理后台
                  </Button>
                </Link>
              )}
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
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats?.totalEntities || entities.length}</div>
                  <div className="text-xs text-muted-foreground">实体总数</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Link2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats?.totalRelations || relations.length}</div>
                  <div className="text-xs text-muted-foreground">关系总数</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats?.verifiedEntities || 0}</div>
                  <div className="text-xs text-muted-foreground">已验证</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats?.avgConfidence ? (stats.avgConfidence * 100).toFixed(0) + '%' : '-'}</div>
                  <div className="text-xs text-muted-foreground">平均置信度</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索和筛选 */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索实体名称、别名..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="类型筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(ENTITY_TYPE_CONFIG).map(([key, { label }]) => (
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
                  <SelectItem value="importance">质量评分</SelectItem>
                  <SelectItem value="recent">最新添加</SelectItem>
                  <SelectItem value="confidence">置信度</SelectItem>
                  <SelectItem value="usage">使用频率</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setTemplateDialogOpen(true)}
                disabled={!user}
              >
                <BookOpen className="h-4 w-4" />
                从模板添加
              </Button>

              {user ? (
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-1.5">
                      <Plus className="h-4 w-4" />
                      添加知识
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>添加新知识</DialogTitle>
                    <DialogDescription>
                      添加新的实体到知识库，提交后将进入审核队列
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">实体名称 *</label>
                      <Input
                        value={newEntity.name}
                        onChange={(e) => setNewEntity(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="输入实体名称"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">实体类型</label>
                      <Select
                        value={newEntity.type}
                        onValueChange={(v) => setNewEntity(prev => ({ ...prev, type: v }))}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ENTITY_TYPE_CONFIG).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">描述</label>
                      <Textarea
                        value={newEntity.description}
                        onChange={(e) => setNewEntity(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="输入实体描述"
                        className="mt-1.5"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">别名（用逗号分隔）</label>
                      <Input
                        value={newEntity.aliases}
                        onChange={(e) => setNewEntity(prev => ({ ...prev, aliases: e.target.value }))}
                        placeholder="别名1, 别名2, ..."
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleAddEntity} disabled={!newEntity.name.trim()}>
                      提交
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              ) : (
                <Button className="gap-1.5" variant="outline" onClick={() => router.push('/')}>
                  <LogIn className="h-4 w-4" />
                  登录后添加
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 主要内容 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="entities" className="gap-1.5">
              <Building className="h-4 w-4" />
              实体 ({entities.length})
            </TabsTrigger>
            <TabsTrigger value="relations" className="gap-1.5">
              <Link2 className="h-4 w-4" />
              关系 ({relations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entities">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : entities.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">暂无实体数据</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    点击"添加知识"按钮贡献您的知识
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="grid gap-3 pr-4">
                  {entities.map((entity) => {
                    const typeConfig = ENTITY_TYPE_CONFIG[entity.type] || ENTITY_TYPE_CONFIG.other;
                    const sourceConfig = SOURCE_TYPE_CONFIG[entity.source_type] || { label: entity.source_type, color: 'bg-gray-50 text-gray-600' };
                    
                    return (
                      <Card key={entity.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{entity.name}</span>
                                <Badge className={cn('text-xs', typeConfig.color)}>
                                  {typeConfig.label}
                                </Badge>
                                {entity.verified ? (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    已验证
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                    <Clock className="w-3 h-3 mr-1" />
                                    待审核
                                  </Badge>
                                )}
                                <Badge variant="outline" className={cn('text-xs', sourceConfig.color)}>
                                  {sourceConfig.label}
                                </Badge>
                              </div>
                              
                              {entity.description && (
                                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                                  {entity.description}
                                </p>
                              )}
                              
                              {entity.aliases && entity.aliases.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">别名:</span>
                                  {entity.aliases.map((alias, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {alias}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              {renderQualityStars(entity.importance)}
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="relations">
            {relations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Network className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">暂无关系数据</p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="grid gap-3 pr-4">
                  {relations.map((relation) => (
                    <Card key={relation.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="font-medium truncate">{relation.source_name || relation.source_entity_id}</span>
                            <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                            <Badge variant="outline" className="shrink-0">{relation.type}</Badge>
                            <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                            <span className="font-medium truncate">{relation.target_name || relation.target_entity_id}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            {renderQualityStars(relation.confidence)}
                            {relation.verified ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                已验证
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                <Clock className="w-3 h-3 mr-1" />
                                待审核
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {relation.evidence && (
                          <p className="text-sm text-muted-foreground mt-2 pl-1">
                            证据: {relation.evidence}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

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
                <h4 className="font-medium mb-2">浏览知识</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• 使用搜索框查找特定实体</li>
                  <li>• 使用类型筛选器过滤结果</li>
                  <li>• 点击排序方式切换排序</li>
                  <li>• 质量评分反映知识重要性</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">添加知识</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• 点击"添加知识"提交新实体</li>
                  <li>• 填写必填信息后提交</li>
                  <li>• 提交后进入审核队列</li>
                  <li>• 审核通过后标记为"已验证"</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">知识来源</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• LLM提取：从对话中自动提取</li>
                  <li>• 手动添加：用户主动贡献</li>
                  <li>• 文档解析：从上传文档提取</li>
                  <li>• 反馈学习：从用户反馈学习</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 模板选择对话框 */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>从模板添加知识</DialogTitle>
            <DialogDescription>
              选择一个预置模板，快速创建结构化的知识实体
            </DialogDescription>
          </DialogHeader>
          
          {!selectedTemplate ? (
            <div className="py-4">
              <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                {templates.map((template) => (
                  <Card 
                    key={template.id} 
                    className="cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => {
                      setSelectedTemplate(template);
                      // 初始化模板值
                      const initialValues: Record<string, string> = {};
                      template.fields?.forEach((f: any) => {
                        if (f.defaultValue) initialValues[f.name] = f.defaultValue;
                      });
                      setTemplateValues(initialValues);
                    }}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </div>
                        </div>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSelectedTemplate(null);
                  setTemplateValues({});
                }}
              >
                ← 返回选择模板
              </Button>
              
              <div className="space-y-3">
                {selectedTemplate.fields?.map((field: any) => (
                  <div key={field.name}>
                    <label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.type === 'text' && (
                      <Input
                        value={templateValues[field.name] || ''}
                        onChange={(e) => setTemplateValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="mt-1.5"
                      />
                    )}
                    {field.type === 'textarea' && (
                      <Textarea
                        value={templateValues[field.name] || ''}
                        onChange={(e) => setTemplateValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="mt-1.5"
                        rows={3}
                      />
                    )}
                    {field.type === 'select' && (
                      <Select
                        value={templateValues[field.name] || ''}
                        onValueChange={(v) => setTemplateValues(prev => ({ ...prev, [field.name]: v }))}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={field.placeholder || '请选择'} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt: string) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                  取消
                </Button>
                <Button 
                  onClick={handleCreateFromTemplate}
                  disabled={!templateValues.name}
                >
                  创建实体
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
