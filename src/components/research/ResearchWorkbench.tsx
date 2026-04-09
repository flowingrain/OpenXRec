'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  Search,
  Plus,
  FileText,
  Brain,
  Clock,
  Tag,
  Link2,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Save,
  Download,
  Share2,
  MoreHorizontal,
  Star,
  Bookmark,
  Eye,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  RefreshCw,
  Filter,
  SortAsc,
  Layout,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// ============================================================================
// 类型定义
// ============================================================================

interface SourceItem {
  id: string;
  type: 'news' | 'report' | 'data' | 'social';
  title: string;
  source: string;
  url?: string;
  summary: string;
  content?: string;
  timestamp: string;
  relevance: number;
  tags: string[];
  isRead: boolean;
  isStarred: boolean;
}

interface AnalysisNote {
  id: string;
  type: 'observation' | 'hypothesis' | 'evidence' | 'conclusion';
  title: string;
  content: string;
  sources: string[]; // source ids
  tags: string[];
  createdAt: string;
  updatedAt: string;
  confidence?: number;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  sourceId?: string;
  noteId?: string;
}

interface Workspace {
  id: string;
  name: string;
  topic: string;
  createdAt: string;
  sources: SourceItem[];
  notes: AnalysisNote[];
  timeline: TimelineEvent[];
  tags: string[];
}

// ============================================================================
// 子组件
// ============================================================================

/**
 * 信息源卡片
 */
function SourceCard({
  source,
  onView,
  onStar,
  onAddNote
}: {
  source: SourceItem;
  onView: () => void;
  onStar: () => void;
  onAddNote: () => void;
}) {
  const typeConfig = {
    news: { label: '新闻', color: 'bg-blue-100 text-blue-700' },
    report: { label: '报告', color: 'bg-purple-100 text-purple-700' },
    data: { label: '数据', color: 'bg-green-100 text-green-700' },
    social: { label: '社交', color: 'bg-orange-100 text-orange-700' }
  };

  const config = typeConfig[source.type];

  return (
    <Card className={cn(
      "transition-all hover:shadow-md cursor-pointer",
      source.isRead && "opacity-75"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge variant="secondary" className={cn("text-xs shrink-0", config.color)}>
              {config.label}
            </Badge>
            <CardTitle className="text-sm font-medium truncate">
              {source.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onStar(); }}
            >
              <Star className={cn("w-3 h-3", source.isStarred && "fill-yellow-400 text-yellow-400")} />
            </Button>
            {!source.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
          </div>
        </div>
        <CardDescription className="text-xs mt-1">
          {source.source} · {formatDistanceToNow(new Date(source.timestamp), { addSuffix: true, locale: zhCN })}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
          {source.summary}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {source.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              相关度: {(source.relevance * 100).toFixed(0)}%
            </Badge>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={onView}>
                <Eye className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onAddNote}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 笔记卡片
 */
function NoteCard({
  note,
  onEdit,
  onDelete,
  onLinkSource
}: {
  note: AnalysisNote;
  onEdit: () => void;
  onDelete: () => void;
  onLinkSource: () => void;
}) {
  const typeConfig = {
    observation: { label: '观察', color: 'bg-blue-100 text-blue-700', icon: Eye },
    hypothesis: { label: '假设', color: 'bg-yellow-100 text-yellow-700', icon: Lightbulb },
    evidence: { label: '证据', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    conclusion: { label: '结论', color: 'bg-purple-100 text-purple-700', icon: Brain }
  };

  const config = typeConfig[note.type];
  const Icon = config.icon;

  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", config.color)}>
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            {note.confidence !== undefined && (
              <Badge variant="outline" className="text-xs">
                置信度: {(note.confidence * 100).toFixed(0)}%
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit3 className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onLinkSource}>
              <Link2 className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <CardTitle className="text-sm mt-2">{note.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {note.content}
        </p>
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: zhCN })}
          </span>
          {note.sources.length > 0 && (
            <span>{note.sources.length} 个关联来源</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 时间线事件组件
 */
function TimelineEventItem({
  event,
  onClick
}: {
  event: TimelineEvent;
  onClick: () => void;
}) {
  const importanceConfig = {
    high: { color: 'bg-red-500', ring: 'ring-red-500/30' },
    medium: { color: 'bg-amber-500', ring: 'ring-amber-500/30' },
    low: { color: 'bg-blue-500', ring: 'ring-blue-500/30' }
  };

  const config = importanceConfig[event.importance];

  return (
    <div 
      className="relative pl-6 pb-4 cursor-pointer group"
      onClick={onClick}
    >
      {/* 连接线 */}
      <div className="absolute left-[7px] top-3 bottom-0 w-px bg-border group-last:hidden" />
      
      {/* 时间点 */}
      <div className={cn(
        "absolute left-0 top-1 w-3.5 h-3.5 rounded-full ring-4",
        config.color,
        config.ring
      )} />
      
      {/* 内容 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {new Date(event.timestamp).toLocaleString('zh-CN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {event.importance === 'high' && (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          )}
        </div>
        <p className="text-sm font-medium">{event.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {event.description}
        </p>
      </div>
    </div>
  );
}

/**
 * AI 助手面板
 */
function AIAssistantPanel({
  topic,
  notes,
  onSuggestion
}: {
  topic: string;
  notes: AnalysisNote[];
  onSuggestion: (suggestion: string) => void;
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const generateSuggestions = useCallback(async () => {
    setIsAnalyzing(true);
    
    // 模拟AI分析
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newSuggestions = [
      '建议关注美联储官员的最新讲话，可能影响市场预期',
      '注意追踪美国就业数据，这是降息决策的关键指标',
      '建议补充中国央行的应对策略分析',
      '可以对比历史类似情境下的市场反应'
    ];
    
    setSuggestions(newSuggestions);
    setIsAnalyzing(false);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4" />
          AI 分析助手
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={generateSuggestions}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Lightbulb className="w-3 h-3 mr-2" />
              生成分析建议
            </>
          )}
        </Button>
        
        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((suggestion, i) => (
              <div
                key={i}
                className="p-2 bg-muted/50 rounded-lg text-xs cursor-pointer hover:bg-muted transition-colors"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
        
        <Separator />
        
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">快速操作</Label>
          <div className="grid grid-cols-2 gap-1">
            <Button variant="ghost" size="sm" className="text-xs justify-start">
              <TrendingUp className="w-3 h-3 mr-1" />
              趋势分析
            </Button>
            <Button variant="ghost" size="sm" className="text-xs justify-start">
              <AlertTriangle className="w-3 h-3 mr-1" />
              风险评估
            </Button>
            <Button variant="ghost" size="sm" className="text-xs justify-start">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              验证假设
            </Button>
            <Button variant="ghost" size="sm" className="text-xs justify-start">
              <FileText className="w-3 h-3 mr-1" />
              生成报告
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 新建笔记对话框
 */
function CreateNoteDialog({
  open,
  onOpenChange,
  onCreate,
  sources
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (note: Omit<AnalysisNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  sources: SourceItem[];
}) {
  const [type, setType] = useState<AnalysisNote['type']>('observation');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | undefined>();
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) return;

    onCreate({
      type,
      title,
      content,
      tags,
      sources: selectedSources,
      confidence
    });

    // 重置表单
    setType('observation');
    setTitle('');
    setContent('');
    setTags([]);
    setConfidence(undefined);
    setSelectedSources([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建分析笔记</DialogTitle>
          <DialogDescription>
            记录你的观察、假设、证据或结论
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-4 gap-2">
            {(['observation', 'hypothesis', 'evidence', 'conclusion'] as const).map(t => {
              const config = {
                observation: { label: '观察', icon: Eye },
                hypothesis: { label: '假设', icon: Lightbulb },
                evidence: { label: '证据', icon: CheckCircle2 },
                conclusion: { label: '结论', icon: Brain }
              };
              return (
                <Button
                  key={t}
                  variant={type === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setType(t)}
                  className="justify-start"
                >
                  {(() => { const Icon = config[t].icon; return <Icon className="w-3 h-3 mr-1" /> })()}
                  {config[t].label}
                </Button>
              );
            })}
          </div>
          
          <div>
            <Label>标题</Label>
            <Input
              placeholder="简要概括你的分析..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div>
            <Label>内容</Label>
            <Textarea
              placeholder="详细描述你的分析..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>标签（逗号分隔）</Label>
              <Input
                placeholder="标签1, 标签2"
                value={tags.join(', ')}
                onChange={(e) => setTags(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </div>
            {(type === 'hypothesis' || type === 'conclusion') && (
              <div>
                <Label>置信度</Label>
                <Select
                  value={confidence?.toString()}
                  onValueChange={(v) => setConfidence(v ? parseFloat(v) : undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择置信度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.9">90% - 非常确定</SelectItem>
                    <SelectItem value="0.75">75% - 比较确定</SelectItem>
                    <SelectItem value="0.6">60% - 有一定把握</SelectItem>
                    <SelectItem value="0.4">40% - 需要更多证据</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {sources.length > 0 && (
            <div>
              <Label>关联信息源</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {sources.map(s => (
                  <Badge
                    key={s.id}
                    variant={selectedSources.includes(s.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedSources(prev =>
                        prev.includes(s.id)
                          ? prev.filter(id => id !== s.id)
                          : [...prev, s.id]
                      );
                    }}
                  >
                    {s.title.substring(0, 20)}...
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim() || !content.trim()}>
            创建笔记
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function ResearchWorkbench() {
  // 状态管理
  const [topic, setTopic] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('sources');
  
  // 工作区数据
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [notes, setNotes] = useState<AnalysisNote[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  
  // 对话框状态
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [viewSource, setViewSource] = useState<SourceItem | null>(null);
  
  // 搜索信息源
  const handleSearch = useCallback(async () => {
    if (!topic.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: topic })
      });
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      
      // 转换搜索结果
      const newSources: SourceItem[] = (data.results || []).map((item: any, index: number) => ({
        id: `source_${Date.now()}_${index}`,
        type: item.type || 'news',
        title: item.title || item.name || '未知标题',
        source: item.source || item.site || '未知来源',
        url: item.url || item.link,
        summary: item.summary || item.snippet || item.content?.substring(0, 200) || '',
        content: item.content,
        timestamp: item.timestamp || item.publishTime || new Date().toISOString(),
        relevance: item.relevance || item.score || 0.8,
        tags: item.tags || [topic],
        isRead: false,
        isStarred: false
      }));
      
      setSources(prev => [...newSources, ...prev.filter(s => !newSources.some(n => n.id === s.id))]);
      
      // 生成时间线事件
      const newEvents: TimelineEvent[] = newSources.slice(0, 5).map((s, i) => ({
        id: `event_${Date.now()}_${i}`,
        timestamp: s.timestamp,
        title: s.title,
        description: s.summary,
        importance: s.relevance > 0.85 ? 'high' : s.relevance > 0.7 ? 'medium' : 'low',
        sourceId: s.id
      }));
      
      setTimeline(prev => [...newEvents, ...prev]);
      
    } catch (error) {
      console.error('Search error:', error);
      // 使用模拟数据
      const mockSources: SourceItem[] = [
        {
          id: `source_${Date.now()}_1`,
          type: 'news',
          title: `${topic} - 最新市场动态`,
          source: '财经新闻',
          summary: '市场分析师认为当前形势存在多重不确定性因素...',
          timestamp: new Date().toISOString(),
          relevance: 0.85,
          tags: [topic, '市场分析'],
          isRead: false,
          isStarred: false
        }
      ];
      setSources(prev => [...mockSources, ...prev]);
    } finally {
      setIsSearching(false);
    }
  }, [topic]);
  
  // 创建笔记
  const handleCreateNote = useCallback((note: Omit<AnalysisNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote: AnalysisNote = {
      ...note,
      id: `note_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setNotes(prev => [newNote, ...prev]);
    
    // 添加到时间线
    const event: TimelineEvent = {
      id: `event_${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: `添加${note.type === 'observation' ? '观察' : note.type === 'hypothesis' ? '假设' : note.type === 'evidence' ? '证据' : '结论'}`,
      description: note.title,
      importance: note.type === 'conclusion' ? 'high' : note.type === 'evidence' ? 'medium' : 'low',
      noteId: newNote.id
    };
    
    setTimeline(prev => [event, ...prev]);
  }, []);
  
  // 标记已读
  const markAsRead = useCallback((sourceId: string) => {
    setSources(prev => prev.map(s =>
      s.id === sourceId ? { ...s, isRead: true } : s
    ));
  }, []);
  
  // 收藏
  const toggleStar = useCallback((sourceId: string) => {
    setSources(prev => prev.map(s =>
      s.id === sourceId ? { ...s, isStarred: !s.isStarred } : s
    ));
  }, []);
  
  // 统计数据
  const stats = useMemo(() => ({
    totalSources: sources.length,
    unreadSources: sources.filter(s => !s.isRead).length,
    starredSources: sources.filter(s => s.isStarred).length,
    totalNotes: notes.length,
    byType: {
      observations: notes.filter(n => n.type === 'observation').length,
      hypotheses: notes.filter(n => n.type === 'hypothesis').length,
      evidence: notes.filter(n => n.type === 'evidence').length,
      conclusions: notes.filter(n => n.type === 'conclusion').length
    }
  }), [sources, notes]);

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <ResizablePanelGroup orientation="horizontal" className="rounded-lg border">
        {/* 左侧面板 - 信息源 */}
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="h-full flex flex-col">
            <div className="p-3 border-b bg-muted/30">
              <div className="flex gap-2">
                <Input
                  placeholder="搜索信息源..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button size="icon" onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mx-3 mt-2">
                <TabsTrigger value="sources" className="text-xs">
                  信息源 ({sources.length})
                </TabsTrigger>
                <TabsTrigger value="starred" className="text-xs">
                  收藏 ({stats.starredSources})
                </TabsTrigger>
              </TabsList>
              
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  <TabsContent value="sources" className="mt-0 space-y-2">
                    {sources.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        输入主题并搜索，开始收集信息源
                      </div>
                    ) : (
                      sources.map(source => (
                        <SourceCard
                          key={source.id}
                          source={source}
                          onView={() => {
                            markAsRead(source.id);
                            setViewSource(source);
                          }}
                          onStar={() => toggleStar(source.id)}
                          onAddNote={() => setCreateNoteOpen(true)}
                        />
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="starred" className="mt-0 space-y-2">
                    {sources.filter(s => s.isStarred).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无收藏的信息源
                      </div>
                    ) : (
                      sources.filter(s => s.isStarred).map(source => (
                        <SourceCard
                          key={source.id}
                          source={source}
                          onView={() => {
                            markAsRead(source.id);
                            setViewSource(source);
                          }}
                          onStar={() => toggleStar(source.id)}
                          onAddNote={() => setCreateNoteOpen(true)}
                        />
                      ))
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        {/* 中间面板 - 工作区 */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <div className="h-full flex flex-col">
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4" />
                <span className="font-medium text-sm">研判工作台</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Save className="w-3 h-3 mr-1" />
                  保存
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-3 h-3 mr-1" />
                  导出
                </Button>
                <Button size="sm" onClick={() => setCreateNoteOpen(true)}>
                  <Plus className="w-3 h-3 mr-1" />
                  新建笔记
                </Button>
              </div>
            </div>
            
            <Tabs defaultValue="notes" className="flex-1 flex flex-col">
              <TabsList className="mx-3 mt-2 grid w-[calc(100%-24px)] grid-cols-4">
                <TabsTrigger value="notes" className="text-xs">
                  <FileText className="w-3 h-3 mr-1" />
                  笔记 ({notes.length})
                </TabsTrigger>
                <TabsTrigger value="hypotheses" className="text-xs">
                  <Lightbulb className="w-3 h-3 mr-1" />
                  假设 ({stats.byType.hypotheses})
                </TabsTrigger>
                <TabsTrigger value="evidence" className="text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  证据 ({stats.byType.evidence})
                </TabsTrigger>
                <TabsTrigger value="conclusions" className="text-xs">
                  <Brain className="w-3 h-3 mr-1" />
                  结论 ({stats.byType.conclusions})
                </TabsTrigger>
              </TabsList>
              
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  <TabsContent value="notes" className="mt-0 space-y-2">
                    {notes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        开始记录你的分析笔记
                      </div>
                    ) : (
                      notes.map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onEdit={() => {}}
                          onDelete={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                          onLinkSource={() => {}}
                        />
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="hypotheses" className="mt-0 space-y-2">
                    {notes.filter(n => n.type === 'hypothesis').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无假设
                      </div>
                    ) : (
                      notes.filter(n => n.type === 'hypothesis').map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onEdit={() => {}}
                          onDelete={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                          onLinkSource={() => {}}
                        />
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="evidence" className="mt-0 space-y-2">
                    {notes.filter(n => n.type === 'evidence').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无证据
                      </div>
                    ) : (
                      notes.filter(n => n.type === 'evidence').map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onEdit={() => {}}
                          onDelete={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                          onLinkSource={() => {}}
                        />
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="conclusions" className="mt-0 space-y-2">
                    {notes.filter(n => n.type === 'conclusion').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无结论
                      </div>
                    ) : (
                      notes.filter(n => n.type === 'conclusion').map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onEdit={() => {}}
                          onDelete={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                          onLinkSource={() => {}}
                        />
                      ))
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        {/* 右侧面板 - 时间线和AI助手 */}
        <ResizablePanel defaultSize={25} minSize={15}>
          <div className="h-full flex flex-col">
            <Tabs defaultValue="timeline" className="flex-1 flex flex-col">
              <TabsList className="mx-3 mt-2 grid w-[calc(100%-24px)] grid-cols-2">
                <TabsTrigger value="timeline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  时间线
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs">
                  <Brain className="w-3 h-3 mr-1" />
                  AI助手
                </TabsTrigger>
              </TabsList>
              
              <ScrollArea className="flex-1">
                <div className="p-3">
                  <TabsContent value="timeline" className="mt-0">
                    {timeline.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        时间线为空
                      </div>
                    ) : (
                      timeline.map(event => (
                        <TimelineEventItem
                          key={event.id}
                          event={event}
                          onClick={() => {}}
                        />
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="ai" className="mt-0">
                    <AIAssistantPanel
                      topic={topic}
                      notes={notes}
                      onSuggestion={(s) => {
                        handleCreateNote({
                          type: 'observation',
                          title: 'AI建议',
                          content: s,
                          tags: ['AI辅助'],
                          sources: []
                        });
                      }}
                    />
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
            
            {/* 统计面板 */}
            <div className="p-3 border-t bg-muted/30">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">信息源</span>
                  <span className="font-medium">{stats.totalSources}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">未读</span>
                  <span className="font-medium text-primary">{stats.unreadSources}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">笔记</span>
                  <span className="font-medium">{stats.totalNotes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">时间线</span>
                  <span className="font-medium">{timeline.length}</span>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      
      {/* 新建笔记对话框 */}
      <CreateNoteDialog
        open={createNoteOpen}
        onOpenChange={setCreateNoteOpen}
        onCreate={handleCreateNote}
        sources={sources}
      />
      
      {/* 查看来源对话框 */}
      <Dialog open={!!viewSource} onOpenChange={() => setViewSource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewSource && (
            <>
              <DialogHeader>
                <DialogTitle>{viewSource.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Badge variant="secondary">{viewSource.source}</Badge>
                  <span>{formatDistanceToNow(new Date(viewSource.timestamp), { addSuffix: true, locale: zhCN })}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm whitespace-pre-wrap">
                  {viewSource.content || viewSource.summary}
                </p>
              </div>
              <DialogFooter>
                {viewSource.url && (
                  <Button variant="outline" onClick={() => window.open(viewSource.url, '_blank')}>
                    <ExternalLink className="w-3 h-3 mr-2" />
                    查看原文
                  </Button>
                )}
                <Button onClick={() => {
                  setCreateNoteOpen(true);
                  setViewSource(null);
                }}>
                  添加笔记
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ResearchWorkbench;
