'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Merge,
  RefreshCw,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

interface KnowledgeConflict {
  id: string;
  type: 'entity_conflict' | 'relation_conflict' | 'fact_conflict' | 'value_conflict';
  existingKnowledge: {
    id?: string;
    content?: string;
    source?: string;
    createdAt?: string;
  };
  newKnowledge: {
    content?: string;
    source?: string;
    sourceCaseId?: string;
  };
  conflictDescription: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected' | 'merged' | 'expired';
  createdAt: string;
}

interface ConflictResolutionPanelProps {
  className?: string;
  onConflictResolved?: () => void;
}

// ==================== 辅助函数 ====================

function getConflictTypeInfo(type: string) {
  switch (type) {
    case 'entity_conflict':
      return { label: '实体冲突', icon: AlertCircle, color: 'text-orange-600' };
    case 'relation_conflict':
      return { label: '关系冲突', icon: ChevronRight, color: 'text-blue-600' };
    case 'fact_conflict':
      return { label: '事实冲突', icon: AlertTriangle, color: 'text-red-600' };
    case 'value_conflict':
      return { label: '数值冲突', icon: Merge, color: 'text-purple-600' };
    default:
      return { label: '未知冲突', icon: AlertCircle, color: 'text-gray-600' };
  }
}

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'high':
      return { label: '高', variant: 'destructive' as const, color: 'bg-red-100 text-red-700' };
    case 'medium':
      return { label: '中', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-700' };
    case 'low':
      return { label: '低', variant: 'outline' as const, color: 'bg-green-100 text-green-700' };
    default:
      return { label: '未知', variant: 'outline' as const, color: 'bg-gray-100 text-gray-700' };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

// ==================== 主组件 ====================

export function ConflictResolutionPanel({
  className,
  onConflictResolved,
}: ConflictResolutionPanelProps) {
  const [conflicts, setConflicts] = useState<KnowledgeConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<KnowledgeConflict | null>(null);
  const [resolution, setResolution] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'merge' | null>(null);

  // 加载冲突列表
  const loadConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge/conflicts');
      const data = await response.json();
      if (data.success) {
        setConflicts(data.data || []);
      }
    } catch (error) {
      console.error('加载冲突列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 检测冲突
  const detectConflicts = useCallback(async () => {
    setDetecting(true);
    try {
      const response = await fetch('/api/knowledge/conflicts/detect', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        // 重新加载冲突列表
        await loadConflicts();
        alert(`检测完成：发现 ${data.detected} 个潜在冲突`);
      } else {
        alert('检测失败：' + data.error);
      }
    } catch (error) {
      console.error('检测冲突失败:', error);
      alert('检测冲突失败');
    } finally {
      setDetecting(false);
    }
  }, [loadConflicts]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  // 处理冲突
  const handleResolve = async () => {
    if (!selectedConflict || !actionType) return;

    setProcessing(true);
    try {
      const response = await fetch('/api/knowledge/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictId: selectedConflict.id,
          action: actionType,
          resolution,
          userId: 'expert_user',
        }),
      });

      const data = await response.json();
      if (data.success) {
        // 从列表中移除已处理的冲突
        setConflicts((prev) => prev.filter((c) => c.id !== selectedConflict.id));
        setSelectedConflict(null);
        setResolution('');
        setActionType(null);
        onConflictResolved?.();
      } else {
        console.error('处理冲突失败:', data.error);
      }
    } catch (error) {
      console.error('处理冲突失败:', error);
    } finally {
      setProcessing(false);
    }
  };

  // 打开处理对话框
  const openResolveDialog = (conflict: KnowledgeConflict, action: 'approve' | 'reject' | 'merge') => {
    setSelectedConflict(conflict);
    setActionType(action);
    setResolution('');
  };

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              知识冲突确认
            </CardTitle>
            <CardDescription>
              检测到 {conflicts.length} 条知识冲突需要专家确认
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadConflicts} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
            刷新
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={detectConflicts} 
            disabled={detecting}
            className="ml-2"
          >
            <Search className={cn('w-4 h-4 mr-1', detecting && 'animate-spin')} />
            检测冲突
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
            <p className="text-sm">暂无待处理的冲突</p>
            <p className="text-xs mt-1">所有知识已同步一致</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {conflicts.map((conflict) => {
                const typeInfo = getConflictTypeInfo(conflict.type);
                const severityConfig = getSeverityConfig(conflict.severity);
                const TypeIcon = typeInfo.icon;

                return (
                  <Card key={conflict.id} className="border-l-4 border-l-amber-400">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <TypeIcon className={cn('w-4 h-4', typeInfo.color)} />
                          <span className="font-medium text-sm">{typeInfo.label}</span>
                          <Badge variant={severityConfig.variant} className="text-xs">
                            严重性: {severityConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDate(conflict.createdAt)}
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {conflict.conflictDescription}
                      </p>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-muted/50 rounded p-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">已有知识</p>
                          <p className="text-xs line-clamp-2">
                            {conflict.existingKnowledge?.content || '无描述'}
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded p-2">
                          <p className="text-xs font-medium text-blue-600 mb-1">新提取知识</p>
                          <p className="text-xs line-clamp-2">
                            {conflict.newKnowledge?.content || '无描述'}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => openResolveDialog(conflict, 'reject')}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          拒绝
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-purple-600 hover:text-purple-700"
                          onClick={() => openResolveDialog(conflict, 'merge')}
                        >
                          <Merge className="w-4 h-4 mr-1" />
                          合并
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openResolveDialog(conflict, 'approve')}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          批准
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* 处理对话框 */}
      <Dialog open={!!selectedConflict} onOpenChange={() => setSelectedConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && '批准新知识'}
              {actionType === 'reject' && '拒绝新知识'}
              {actionType === 'merge' && '合并知识'}
            </DialogTitle>
            <DialogDescription>
              {selectedConflict?.conflictDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">已有知识</p>
                <p className="text-sm">{selectedConflict?.existingKnowledge?.content}</p>
              </div>
              <div className="bg-blue-50 rounded p-3">
                <p className="text-xs font-medium text-blue-600 mb-1">新提取知识</p>
                <p className="text-sm">{selectedConflict?.newKnowledge?.content}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">处理说明（可选）</label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="请输入处理原因或说明..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedConflict(null)}>
              取消
            </Button>
            <Button
              onClick={handleResolve}
              disabled={processing}
              className={
                actionType === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : actionType === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <>
                  {actionType === 'approve' && <CheckCircle className="w-4 h-4 mr-1" />}
                  {actionType === 'reject' && <XCircle className="w-4 h-4 mr-1" />}
                  {actionType === 'merge' && <Merge className="w-4 h-4 mr-1" />}
                </>
              )}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ConflictResolutionPanel;
