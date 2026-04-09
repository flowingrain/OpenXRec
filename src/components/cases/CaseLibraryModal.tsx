'use client';

import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  Clock, 
  Star,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Plus,
  Edit,
  Trash2,
  X,
  Save
} from 'lucide-react';
import { autoEvolutionManager, type AnalysisCase } from '@/lib/evolution/auto-evolution';
import { AddCaseForm } from './AddCaseForm';

// 星级评分组件
function StarRating({ 
  value, 
  onChange, 
  readonly = false,
  size = 'sm' 
}: { 
  value: number; 
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}) {
  const [hovered, setHovered] = useState(0);
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} cursor-${readonly ? 'default' : 'pointer'} transition-colors ${
            star <= (hovered || value)
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300'
          }`}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          onClick={() => !readonly && onChange?.(star)}
        />
      ))}
    </div>
  );
}

interface CaseLibraryModalProps {
  onClose: () => void;
  onSelectCase: (caseData: AnalysisCase) => void;
}

// 数据库案例类型
interface DbCase {
  id: string;
  query: string;
  domain: string;
  conclusion?: {
    summary?: string;
    key_findings?: string[];
  } | string;
  final_report?: string;
  key_factors?: any[];
  tags?: string[];
  user_rating?: number;
  quality_score?: number;
  created_at?: string;
  analyzed_at?: string;
  timeline?: any[];
  scenarios?: any[];
}

export function CaseLibraryModal({ onClose, onSelectCase }: CaseLibraryModalProps) {
  const [cases, setCases] = useState<DbCase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'highly-rated' | 'recent'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCase, setEditingCase] = useState<DbCase | null>(null);
  const [editForm, setEditForm] = useState({
    query: '',
    conclusion: '',
    tags: ''
  });
  
  const loadCases = async () => {
    try {
      const response = await fetch('/api/cases?limit=100');
      const data = await response.json();
      if (data.success) {
        setCases(data.data.cases || []);
      } else {
        // 回退到内存存储
        const allCases = autoEvolutionManager.getCases();
        setCases(allCases.map(c => ({
          id: c.id,
          query: c.topic,
          domain: 'risk_analysis',
          conclusion: c.conclusion,
          final_report: c.finalReport,
          key_factors: c.keyFactors,
          tags: [],
          created_at: new Date(c.createdAt).toISOString(),
          timeline: c.timeline,
          scenarios: c.scenarios
        })));
      }
    } catch (error) {
      console.error('加载案例失败:', error);
      // 回退到内存存储
      const allCases = autoEvolutionManager.getCases();
      setCases(allCases.map(c => ({
        id: c.id,
        query: c.topic,
        domain: 'risk_analysis',
        conclusion: c.conclusion,
        final_report: c.finalReport,
        key_factors: c.keyFactors,
        tags: [],
        created_at: new Date(c.createdAt).toISOString(),
        timeline: c.timeline,
        scenarios: c.scenarios
      })));
    }
  };
  
  useEffect(() => {
    loadCases();
  }, []);
  
  const handleAddSuccess = () => {
    loadCases(); // 刷新列表
  };
  
  const handleDeleteCase = async (caseId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止触发 onSelectCase
    
    if (!confirm('确定要删除这个案例吗？此操作不可恢复。')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/cases?id=${caseId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('案例删除成功！');
        loadCases();
      } else {
        alert('删除失败：' + data.error);
      }
    } catch (error) {
      console.error('删除案例失败:', error);
      alert('删除失败');
    }
  };
  
  const handleEditClick = (caseItem: DbCase, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止触发 onSelectCase
    setEditingCase(caseItem);
    const conclusionText = typeof caseItem.conclusion === 'string' 
      ? caseItem.conclusion 
      : (caseItem.conclusion as any)?.summary || '';
    setEditForm({
      query: caseItem.query || '',
      conclusion: conclusionText,
      tags: Array.isArray(caseItem.tags) ? caseItem.tags.join(', ') : ''
    });
  };
  
  const handleEditSave = async () => {
    if (!editingCase) return;
    
    try {
      const response = await fetch('/api/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: editingCase.id,
          data: {
            query: editForm.query,
            conclusion: { summary: editForm.conclusion },
            tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('案例更新成功！');
        setEditingCase(null);
        loadCases();
      } else {
        alert('更新失败：' + data.error);
      }
    } catch (error) {
      console.error('更新案例失败:', error);
      alert('更新失败');
    }
  };
  
  // 提交评分
  const handleRateCase = async (caseId: string, rating: number) => {
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_feedback',
          caseId: caseId,
          data: { rating }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新本地状态
        setCases(prev => prev.map(c => 
          c.id === caseId ? { ...c, user_rating: rating } : c
        ));
      } else {
        console.error('评分失败:', data.error);
      }
    } catch (error) {
      console.error('评分失败:', error);
    }
  };
  
  const filteredCases = cases.filter(c => {
    const queryText = c.query || '';
    if (searchQuery) {
      return queryText.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (filter === 'highly-rated') {
      return c.user_rating && c.user_rating >= 4;
    }
    if (filter === 'recent') {
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const caseTime = c.created_at ? new Date(c.created_at).getTime() : 0;
      return caseTime > dayAgo;
    }
    return true;
  });
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getConclusionText = (conclusion: any) => {
    if (typeof conclusion === 'string') return conclusion;
    if (conclusion?.summary) return conclusion.summary;
    return '';
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              案例库
            </DialogTitle>
            <Button 
              size="sm" 
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              添加案例
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 搜索和筛选 */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索案例..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              <Button 
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                全部
              </Button>
              <Button 
                variant={filter === 'highly-rated' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('highly-rated')}
              >
                <Star className="h-3 w-3 mr-1" />
                高评分
              </Button>
              <Button 
                variant={filter === 'recent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('recent')}
              >
                <Clock className="h-3 w-3 mr-1" />
                近期
              </Button>
            </div>
          </div>
          
          {/* 案例列表 */}
          <ScrollArea className="h-[400px]">
            {filteredCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
                <p>暂无案例</p>
                <p className="text-xs mt-1">完成分析后案例会自动保存</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {filteredCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => onSelectCase({
                      id: caseItem.id,
                      topic: caseItem.query,
                      searchResults: [],
                      timeline: caseItem.timeline || [],
                      keyFactors: caseItem.key_factors || [],
                      scenarios: caseItem.scenarios || [],
                      conclusion: getConclusionText(caseItem.conclusion),
                      finalReport: caseItem.final_report,
                      createdAt: caseItem.created_at ? new Date(caseItem.created_at).getTime() : Date.now(),
                      userInteractions: []
                    })}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium flex-1 pr-2">{caseItem.query || '无主题'}</div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(caseItem.created_at)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {getConclusionText(caseItem.conclusion) || caseItem.final_report || '暂无结论'}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {Array.isArray(caseItem.key_factors) 
                            ? caseItem.key_factors.length 
                            : 0} 关键因素
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Array.isArray(caseItem.timeline) 
                            ? caseItem.timeline.length 
                            : 0} 时间节点
                        </span>
                        <span>
                          {Array.isArray(caseItem.scenarios) 
                            ? caseItem.scenarios.length 
                            : 0} 场景
                        </span>
                      </div>
                      
                      {/* 评分和操作按钮 */}
                      <div className="flex items-center gap-2">
                        <div 
                          className="flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StarRating 
                            value={caseItem.user_rating || 0}
                            onChange={(rating) => handleRateCase(caseItem.id, rating)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEditClick(caseItem, e)}
                          title="编辑"
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteCase(caseItem.id, e)}
                          title="删除"
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
      
      {/* 添加案例表单 */}
      <AddCaseForm 
        isOpen={showAddForm} 
        onClose={() => setShowAddForm(false)}
        onSuccess={handleAddSuccess}
      />
      
      {/* 编辑案例弹窗 */}
      <Dialog open={!!editingCase} onOpenChange={() => setEditingCase(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              编辑案例
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">主题</label>
              <Input
                value={editForm.query}
                onChange={(e) => setEditForm({ ...editForm, query: e.target.value })}
                placeholder="案例主题"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">结论</label>
              <Textarea
                value={editForm.conclusion}
                onChange={(e) => setEditForm({ ...editForm, conclusion: e.target.value })}
                placeholder="案例结论"
                rows={4}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">标签</label>
              <Input
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                placeholder="多个标签用逗号分隔"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingCase(null)}
              >
                <X className="h-4 w-4 mr-1" />
                取消
              </Button>
              <Button onClick={handleEditSave}>
                <Save className="h-4 w-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
