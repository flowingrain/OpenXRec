'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  GitBranch,
  AlertTriangle,
  Activity,
  Sparkles,
  Database,
  Clock,
  Plus,
  Upload,
  BookOpen,
  TrendingUp,
  FileText,
  Lightbulb,
  Loader2,
  Edit,
  Trash2,
  X,
  Save
} from 'lucide-react';
import { autoEvolutionManager, type KnowledgePattern } from '@/lib/evolution/auto-evolution';

// 知识类型配置
const KNOWLEDGE_TYPES = [
  { value: 'economic_indicator', label: '经济指标', icon: TrendingUp },
  { value: 'event', label: '历史事件', icon: FileText },
  { value: 'entity', label: '实体/机构', icon: Database },
  { value: 'policy', label: '政策法规', icon: FileText },
  { value: 'relationship', label: '实体关系', icon: GitBranch },
  { value: 'market_data', label: '市场数据', icon: TrendingUp },
];

// 知识条目接口
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
    isPreset?: boolean;
  };
}

interface KnowledgeBaseModalProps {
  onClose: () => void;
}

export function KnowledgeBaseModal({ onClose }: KnowledgeBaseModalProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'add' | 'upload'>('view');
  const [patterns, setPatterns] = useState<KnowledgePattern[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 编辑状态
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    type: 'entity',
    tags: '',
    confidence: 0.8
  });
  const [saving, setSaving] = useState(false);
  
  // 新知识表单
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    type: 'entity',
    tags: ''
  });
  
  // 文档上传
  const [uploadContent, setUploadContent] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // 编辑知识
  const handleEditClick = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      title: entry.title,
      content: entry.content,
      type: entry.type,
      tags: entry.metadata.tags.join(', '),
      confidence: entry.metadata.confidence
    });
  };
  
  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setSaving(true);
    
    try {
      const response = await fetch('/api/knowledge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEntry.id,
          data: {
            title: editForm.title,
            content: editForm.content,
            type: editForm.type,
            tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
            confidence: editForm.confidence
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setEditingEntry(null);
        loadKnowledge();
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      alert('保存失败: ' + String(error));
    } finally {
      setSaving(false);
    }
  };
  
  // 删除知识
  const handleDeleteKnowledge = async (id: string) => {
    if (!confirm('确定要删除这条知识吗？此操作不可撤销。')) return;
    
    try {
      const response = await fetch(`/api/knowledge?id=${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        loadKnowledge();
      } else {
        alert('删除失败: ' + result.error);
      }
    } catch (error) {
      alert('删除失败: ' + String(error));
    }
  };
  
  // 加载知识
  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge?limit=100');
      const data = await response.json();
      
      if (data.success) {
        setKnowledgeEntries(data.data.entries || []);
      }
      
      // 同时加载模式
      const allPatterns = autoEvolutionManager.getPatterns();
      setPatterns(allPatterns);
    } catch (error) {
      console.error('Failed to load knowledge:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);
  
  // 搜索知识
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadKnowledge();
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge?query=${encodeURIComponent(searchQuery)}&limit=50`);
      const data = await response.json();
      
      if (data.success) {
        setKnowledgeEntries(data.data.results?.map((r: any) => r.entry) || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 添加知识
  const handleAddKnowledge = async () => {
    if (!newEntry.title || !newEntry.content) {
      alert('请填写标题和内容');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          data: {
            title: newEntry.title,
            content: newEntry.content,
            type: newEntry.type,
            tags: newEntry.tags.split(',').map(t => t.trim()).filter(Boolean)
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('知识添加成功！');
        setNewEntry({ title: '', content: '', type: 'entity', tags: '' });
        setActiveTab('view');
        loadKnowledge();
      } else {
        alert('添加失败：' + data.error);
      }
    } catch (error) {
      console.error('Add knowledge failed:', error);
      alert('添加失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 上传文档
  const handleUploadDocument = async () => {
    if (!uploadContent.trim()) {
      alert('请提供文档内容');
      return;
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('content', uploadContent);
      formData.append('tags', uploadTags);
      formData.append('autoExtract', 'true');
      
      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        const count = data.data.extraction?.entriesCount || 0;
        alert(`文档上传成功！提取了 ${count} 条知识`);
        setUploadContent('');
        setUploadTags('');
        setActiveTab('view');
        loadKnowledge();
      } else {
        alert('上传失败：' + data.error);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  };
  
  // 获取类型图标
  const getTypeIcon = (type: string) => {
    const typeConfig = KNOWLEDGE_TYPES.find(t => t.value === type);
    const Icon = typeConfig?.icon || Database;
    return <Icon className="h-4 w-4" />;
  };
  
  // 获取类型标签
  const getTypeLabel = (type: string) => {
    const typeConfig = KNOWLEDGE_TYPES.find(t => t.value === type);
    return typeConfig?.label || type;
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            知识管理中心
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 w-full flex-shrink-0">
            <TabsTrigger value="view" className="text-xs">
              <BookOpen className="w-4 h-4 mr-1" />
              知识库
            </TabsTrigger>
            <TabsTrigger value="add" className="text-xs">
              <Plus className="w-4 h-4 mr-1" />
              添加知识
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs">
              <Upload className="w-4 h-4 mr-1" />
              上传文档
            </TabsTrigger>
          </TabsList>
          
          {/* 查看知识库 */}
          <TabsContent value="view" className="mt-4 flex-1 flex flex-col overflow-hidden">
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              {/* 搜索栏 */}
              <div className="flex gap-2 flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索知识..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading} size="icon">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              
              {/* 统计 */}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>预置知识: {knowledgeEntries.filter(e => e.metadata.isPreset === true).length}</span>
                <span>用户添加: {knowledgeEntries.filter(e => e.metadata.source === '用户输入').length}</span>
                <span>自动提取: {knowledgeEntries.filter(e => e.metadata.source === '自动提取').length}</span>
              </div>
              
              {/* 知识列表 */}
              <ScrollArea className="h-[400px]">
                {knowledgeEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Database className="h-12 w-12 mb-3 opacity-50" />
                    <p>暂无知识数据</p>
                    <p className="text-xs mt-1">点击"添加知识"或"上传文档"开始积累</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-4">
                    {knowledgeEntries.map((entry) => (
                      <Card key={entry.id} className="bg-slate-50 dark:bg-slate-900/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {getTypeIcon(entry.type)}
                                <span className="ml-1">{getTypeLabel(entry.type)}</span>
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {entry.metadata.source}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {(entry.metadata.confidence * 100).toFixed(0)}% 置信
                            </span>
                          </div>
                          <h4 className="text-sm font-medium mb-1">{entry.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{entry.content}</p>
                          {entry.metadata.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {entry.metadata.tags.slice(0, 4).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] h-4">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {/* 编辑和删除按钮 */}
                          <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-border/50">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(entry)}
                              className="h-7 px-2 text-xs"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKnowledge(entry.id)}
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              删除
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
          
          {/* 添加知识 */}
          <TabsContent value="add" className="mt-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">知识类型</label>
                <Select value={newEntry.type} onValueChange={(v) => setNewEntry({ ...newEntry, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWLEDGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">标题 *</label>
                <Input
                  placeholder="例如：美联储加息机制"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">内容 *</label>
                <Textarea
                  placeholder="详细描述知识内容..."
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                  rows={6}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">标签（逗号分隔）</label>
                <Input
                  placeholder="例如：货币政策, 利率, 美联储"
                  value={newEntry.tags}
                  onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                />
              </div>
              
              <Button onClick={handleAddKnowledge} className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    添加中...
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-4 h-4 mr-2" />
                    添加知识
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
          
          {/* 上传文档 */}
          <TabsContent value="upload" className="mt-4">
            <div className="space-y-4">
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    💡 支持 PDF、Word、Markdown、TXT 等格式。粘贴文档内容后，系统会自动提取知识点。
                  </p>
                </CardContent>
              </Card>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">文档内容</label>
                <Textarea
                  placeholder="粘贴文档内容..."
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  rows={10}
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">标签（可选）</label>
                <Input
                  placeholder="例如：研究报告, 行业分析"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                />
              </div>
              
              <Button onClick={handleUploadDocument} className="w-full" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    正在提取知识...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    上传并提取知识
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* 底部统计 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t mt-4">
          <span>共 {knowledgeEntries.length} 条知识</span>
          <span>系统预置 + 用户添加 + 自动提取</span>
        </div>
      </DialogContent>
      
      {/* 编辑对话框 */}
      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-500" />
              编辑知识
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">知识类型</label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KNOWLEDGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">标题</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">内容</label>
              <Textarea
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                rows={5}
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">标签（逗号分隔）</label>
              <Input
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">置信度: {(editForm.confidence * 100).toFixed(0)}%</label>
              <Input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={editForm.confidence}
                onChange={(e) => setEditForm({ ...editForm, confidence: parseFloat(e.target.value) })}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              <X className="w-4 h-4 mr-1" />
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  保存
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
