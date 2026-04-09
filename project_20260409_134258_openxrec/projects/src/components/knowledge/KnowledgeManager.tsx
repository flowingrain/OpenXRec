/**
 * 知识管理面板
 * 
 * 功能：
 * 1. 查看知识库
 * 2. 手动添加知识
 * 3. 上传文档
 * 4. 查看案例库
 * 5. 提交反馈
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Upload,
  Plus,
  Search,
  FileText,
  Database,
  Star,
  Trash2,
  Brain,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  Edit,
  X,
  Save,
  AlertTriangle,
} from 'lucide-react';

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
}

interface KnowledgeStats {
  totalEntries: number;
  byType: Record<string, number>;
  bySource?: Record<string, number>;
  recentAdditions?: number;
  averageConfidence?: number;
}

// ==================== 案例类型定义 ====================

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
}

// ==================== 知识类型配置 ====================

const KNOWLEDGE_TYPES = [
  { value: 'economic_indicator', label: '经济指标', icon: TrendingUp },
  { value: 'event', label: '历史事件', icon: FileText },
  { value: 'entity', label: '实体/机构', icon: Database },
  { value: 'policy', label: '政策法规', icon: FileText },
  { value: 'relationship', label: '实体关系', icon: AlertCircle },
  { value: 'market_data', label: '市场数据', icon: TrendingUp },
];

// ==================== 知识管理组件 ====================

interface KnowledgeManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KnowledgeManager({ isOpen, onClose }: KnowledgeManagerProps) {
  const [activeTab, setActiveTab] = useState('view');
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 新知识表单
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    type: 'entity' as string,
    tags: '',
    relatedEntities: ''
  });
  
  // 文档上传
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadContent, setUploadContent] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [extracting, setExtracting] = useState(false);
  
  // 编辑状态
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    type: 'entity' as string,
    tags: '',
    relatedEntities: '',
    confidence: 0.8
  });
  
  // 案例库状态
  const [cases, setCases] = useState<AnalysisCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState<AnalysisCase | null>(null);
  
  // 加载知识库
  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge?limit=100');
      const data = await response.json();
      
      if (data.success) {
        setEntries(data.data.entries || []);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Failed to load knowledge:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      loadKnowledge();
      loadCases();
    }
  }, [isOpen, loadKnowledge]);
  
  // 加载案例库
  const loadCases = async () => {
    setCasesLoading(true);
    try {
      const response = await fetch('/api/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'searchCases', data: { limit: 100 } })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCases(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setCasesLoading(false);
    }
  };
  
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
        setEntries(data.data.results?.map((r: any) => r.entry) || []);
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
            tags: newEntry.tags.split(',').map(t => t.trim()).filter(Boolean),
            relatedEntities: newEntry.relatedEntities.split(',').map(e => e.trim()).filter(Boolean)
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('知识添加成功！');
        setNewEntry({ title: '', content: '', type: 'entity', tags: '', relatedEntities: '' });
        loadKnowledge();
      } else {
        alert('添加失败：' + data.error);
      }
    } catch (error) {
      console.error('Add knowledge failed:', error);
      alert('添加失败');
    }
  };
  
  // 上传文档
  const handleUploadDocument = async () => {
    if (!uploadContent && !uploadFile) {
      alert('请提供文档内容或上传文件');
      return;
    }
    
    setExtracting(true);
    
    try {
      const formData = new FormData();
      
      if (uploadFile) {
        formData.append('file', uploadFile);
        
        // 如果是文本文件，读取内容
        if (uploadFile.type.startsWith('text/') || 
            uploadFile.name.endsWith('.md') || 
            uploadFile.name.endsWith('.txt')) {
          const text = await uploadFile.text();
          formData.append('content', text);
        }
      } else {
        formData.append('content', uploadContent);
      }
      
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
        setUploadFile(null);
        setUploadContent('');
        setUploadTags('');
        loadKnowledge();
      } else {
        alert('上传失败：' + data.error);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('上传失败');
    } finally {
      setExtracting(false);
    }
  };
  
  // 编辑知识
  const handleEditClick = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      title: entry.title,
      content: entry.content,
      type: entry.type,
      tags: entry.metadata.tags.join(', '),
      relatedEntities: entry.metadata.relatedEntities?.join(', ') || '',
      confidence: entry.metadata.confidence
    });
  };
  
  const handleEditKnowledge = async () => {
    if (!editingEntry) return;
    
    if (!editForm.title || !editForm.content) {
      alert('标题和内容不能为空');
      return;
    }
    
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
            relatedEntities: editForm.relatedEntities.split(',').map(e => e.trim()).filter(Boolean),
            confidence: editForm.confidence
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('知识更新成功！');
        setEditingEntry(null);
        loadKnowledge();
      } else {
        alert('更新失败：' + data.error);
      }
    } catch (error) {
      console.error('Edit knowledge failed:', error);
      alert('更新失败');
    }
  };
  
  // 删除知识
  const handleDeleteKnowledge = async (id: string) => {
    if (!confirm('确定要删除这条知识吗？此操作不可恢复。')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/knowledge?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('知识删除成功！');
        loadKnowledge();
      } else {
        alert('删除失败：' + data.error);
      }
    } catch (error) {
      console.error('Delete knowledge failed:', error);
      alert('删除失败');
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            知识管理中心
          </DialogTitle>
        </DialogHeader>
        
        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Card className="bg-slate-800/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.totalEntries}</div>
                <div className="text-xs text-slate-400">知识总数</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.bySource?.user_input || 0}</div>
                <div className="text-xs text-slate-400">用户添加</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{stats.bySource?.document_upload || 0}</div>
                <div className="text-xs text-slate-400">文档提取</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {stats.averageConfidence ? (stats.averageConfidence * 100).toFixed(0) : 0}%
                </div>
                <div className="text-xs text-slate-400">平均置信度</div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="view">
              <BookOpen className="w-4 h-4 mr-2" />
              知识库
            </TabsTrigger>
            <TabsTrigger value="add">
              <Plus className="w-4 h-4 mr-2" />
              添加知识
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="w-4 h-4 mr-2" />
              上传文档
            </TabsTrigger>
            <TabsTrigger value="conflicts">
              <AlertTriangle className="w-4 h-4 mr-2" />
              冲突处理
            </TabsTrigger>
            <TabsTrigger value="cases">
              <Database className="w-4 h-4 mr-2" />
              案例库
            </TabsTrigger>
          </TabsList>
          
          {/* 知识库视图 */}
          <TabsContent value="view" className="h-[400px] overflow-auto">
            {/* 搜索栏 */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="搜索知识..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
            
            {/* 知识列表 */}
            <div className="space-y-3">
              {entries.map((entry) => (
                <Card key={entry.id} className="bg-slate-800/50 hover:bg-slate-700/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {KNOWLEDGE_TYPES.find(t => t.value === entry.type)?.label || entry.type}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            来源：{entry.metadata.source}
                          </span>
                          <span className="text-xs text-slate-400">
                            置信度：{(entry.metadata.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <h4 className="font-medium text-white mb-1">{entry.title}</h4>
                        <p className="text-sm text-slate-300 line-clamp-2">{entry.content}</p>
                        {entry.metadata.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {entry.metadata.tags.slice(0, 5).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(entry)}
                          title="编辑"
                        >
                          <Edit className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteKnowledge(entry.id)}
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {entries.length === 0 && !loading && (
                <div className="text-center text-slate-400 py-8">
                  暂无知识数据，请添加或上传文档
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* 添加知识 */}
          <TabsContent value="add" className="h-[400px] overflow-auto">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-1 block">知识类型</label>
                <Select value={newEntry.type} onValueChange={(v) => setNewEntry({ ...newEntry, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWLEDGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-slate-300 mb-1 block">标题 *</label>
                <Input
                  placeholder="例如：美联储加息机制"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-300 mb-1 block">内容 *</label>
                <Textarea
                  placeholder="详细描述知识内容..."
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                  rows={6}
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-300 mb-1 block">标签（逗号分隔）</label>
                <Input
                  placeholder="例如：货币政策, 利率, 美联储"
                  value={newEntry.tags}
                  onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-300 mb-1 block">相关实体（逗号分隔）</label>
                <Input
                  placeholder="例如：美联储, FOMC, 鲍威尔"
                  value={newEntry.relatedEntities}
                  onChange={(e) => setNewEntry({ ...newEntry, relatedEntities: e.target.value })}
                />
              </div>
              
              <Button onClick={handleAddKnowledge} className="w-full">
                <Lightbulb className="w-4 h-4 mr-2" />
                添加知识
              </Button>
            </div>
          </TabsContent>
          
          {/* 上传文档 */}
          <TabsContent value="upload" className="h-[400px] overflow-auto">
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">支持的文档格式</h4>
                <div className="flex flex-wrap gap-2">
                  {['PDF', 'Word', 'Markdown', 'TXT', 'HTML'].map((format) => (
                    <Badge key={format} variant="outline">{format}</Badge>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  PDF/Word 文档需要在前端预处理为文本后提交
                </p>
              </div>
              
              <div>
                <label className="text-sm text-slate-300 mb-1 block">上传文件</label>
                <Input
                  type="file"
                  accept=".txt,.md,.markdown,.html,.pdf,.docx,.doc"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
              
              <div className="text-center text-slate-400">或</div>
              
              <div>
                <label className="text-sm text-slate-300 mb-1 block">直接粘贴内容</label>
                <Textarea
                  placeholder="粘贴文档内容..."
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  rows={8}
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-300 mb-1 block">标签（可选）</label>
                <Input
                  placeholder="例如：研究报告, 行业分析"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleUploadDocument} 
                className="w-full"
                disabled={extracting}
              >
                {extracting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
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
          
          {/* 冲突处理 */}
          <TabsContent value="conflicts" className="h-[400px] overflow-auto">
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">知识冲突检测机制</h4>
                <p className="text-sm text-slate-300 mb-2">
                  当新提取的知识与现有知识库存在潜在冲突时，系统会自动标记并等待专家确认。
                </p>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• 实体描述冲突：同一实体的描述存在矛盾</li>
                  <li>• 关系方向冲突：实体间关系方向相反</li>
                  <li>• 事实矛盾：核心事实与已有知识不一致</li>
                </ul>
              </div>
              
              {/* 冲突列表 */}
              <div className="space-y-3">
                {/* 示例冲突卡片 */}
                <Card className="bg-orange-900/20 border-orange-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        <Badge variant="outline" className="border-orange-400 text-orange-400">
                          实体冲突
                        </Badge>
                        <span className="text-xs text-slate-400">中等严重程度</span>
                      </div>
                      <span className="text-xs text-slate-400">2024-03-20 14:30</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-800/50 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">现有知识</div>
                        <p className="text-sm text-white">美联储是美国的中央银行...</p>
                        <div className="text-xs text-slate-400 mt-1">来源：预置知识</div>
                      </div>
                      <div className="bg-slate-800/50 rounded p-3">
                        <div className="text-xs text-slate-400 mb-1">新知识</div>
                        <p className="text-sm text-white">美联储是美国的商业银行...</p>
                        <div className="text-xs text-slate-400 mt-1">来源：案例分析</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm">
                        <X className="w-4 h-4 mr-1" />
                        忽略新知识
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-1" />
                        手动编辑
                      </Button>
                      <Button size="sm">
                        <Save className="w-4 h-4 mr-1" />
                        接受新知识
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="text-center text-slate-400 py-8">
                暂无待处理的冲突
              </div>
            </div>
          </TabsContent>
          
          {/* 案例库 */}
          <TabsContent value="cases" className="h-[400px] overflow-auto">
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">案例积累机制</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• 每次分析完成后自动保存为案例</li>
                  <li>• 可对案例进行评分和评价</li>
                  <li>• 可验证预测准确性</li>
                  <li>• 高质量案例会被提取为知识</li>
                </ul>
              </div>
              
              {/* 案例列表 */}
              <div className="space-y-3">
                {casesLoading ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-slate-400">加载案例中...</p>
                  </div>
                ) : cases.length > 0 ? (
                  cases.map((caseItem) => (
                    <Card 
                      key={caseItem.id} 
                      className="bg-slate-800/50 hover:bg-slate-700/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedCase(caseItem)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {caseItem.domain || '通用'}
                              </Badge>
                              {caseItem.quality_score && (
                                <span className="text-xs text-green-400">
                                  质量：{(caseItem.quality_score * 100).toFixed(0)}%
                                </span>
                              )}
                              {caseItem.user_rating && (
                                <span className="text-xs text-yellow-400 flex items-center">
                                  <Star className="w-3 h-3 mr-1" />
                                  {caseItem.user_rating}/5
                                </span>
                              )}
                            </div>
                            <h4 className="font-medium text-white mb-1 line-clamp-1">
                              {caseItem.query}
                            </h4>
                            {caseItem.conclusion?.summary && (
                              <p className="text-sm text-slate-300 line-clamp-2">
                                {caseItem.conclusion.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                              <span>
                                {caseItem.analyzed_at 
                                  ? new Date(caseItem.analyzed_at).toLocaleDateString()
                                  : '未知时间'}
                              </span>
                              {caseItem.feedback_count && caseItem.feedback_count > 0 && (
                                <span>{caseItem.feedback_count} 条反馈</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center text-slate-400 py-8">
                    暂无案例数据，完成分析后将自动积累
                  </div>
                )}
              </div>
              
              <Card className="bg-yellow-900/20 border-yellow-500/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <Star className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-200">手动添加专家案例</h4>
                      <p className="text-sm text-slate-300 mt-1">
                        您可以手动添加历史分析案例或专家经验，帮助系统更快学习
                      </p>
                      <Button variant="outline" size="sm" className="mt-2">
                        <Plus className="w-4 h-4 mr-1" />
                        添加专家案例
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* 案例详情对话框 */}
        {selectedCase && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">案例详情</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCase(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">分析问题</label>
                  <p className="text-white font-medium mt-1">{selectedCase.query}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded p-3">
                    <div className="text-xs text-slate-400">领域</div>
                    <div className="text-white font-medium">{selectedCase.domain || '通用'}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded p-3">
                    <div className="text-xs text-slate-400">置信度</div>
                    <div className="text-white font-medium">
                      {selectedCase.confidence ? `${(selectedCase.confidence * 100).toFixed(0)}%` : '-'}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded p-3">
                    <div className="text-xs text-slate-400">质量评分</div>
                    <div className="text-white font-medium">
                      {selectedCase.quality_score ? `${(selectedCase.quality_score * 100).toFixed(0)}%` : '未评分'}
                    </div>
                  </div>
                </div>
                
                {selectedCase.conclusion?.summary && (
                  <div>
                    <label className="text-sm text-slate-400">结论摘要</label>
                    <p className="text-slate-200 mt-1">{selectedCase.conclusion.summary}</p>
                  </div>
                )}
                
                {selectedCase.final_report && (
                  <div>
                    <label className="text-sm text-slate-400">完整报告</label>
                    <div className="bg-slate-800/50 rounded p-3 mt-1 max-h-60 overflow-auto">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">
                        {selectedCase.final_report}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      // 提交反馈
                      setSelectedCase(null);
                    }}
                  >
                    提交反馈
                  </Button>
                  <Button onClick={() => setSelectedCase(null)}>
                    关闭
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 编辑对话框 */}
        {editingEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">编辑知识</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditingEntry(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-300 mb-1 block">知识类型</label>
                  <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KNOWLEDGE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm text-slate-300 mb-1 block">标题</label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-slate-300 mb-1 block">内容</label>
                  <Textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    rows={6}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-slate-300 mb-1 block">标签（逗号分隔）</label>
                  <Input
                    value={editForm.tags}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-slate-300 mb-1 block">相关实体（逗号分隔）</label>
                  <Input
                    value={editForm.relatedEntities}
                    onChange={(e) => setEditForm({ ...editForm, relatedEntities: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-slate-300 mb-1 block">
                    置信度：{(editForm.confidence * 100).toFixed(0)}%
                  </label>
                  <Input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={editForm.confidence}
                    onChange={(e) => setEditForm({ ...editForm, confidence: parseFloat(e.target.value) })}
                  />
                </div>
                
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditingEntry(null)}>
                    取消
                  </Button>
                  <Button onClick={handleEditKnowledge}>
                    <Save className="w-4 h-4 mr-2" />
                    保存修改
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== 导出快捷按钮 ====================

export function KnowledgeManagerButton() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Brain className="w-4 h-4" />
        知识管理
      </Button>
      
      <KnowledgeManager isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
