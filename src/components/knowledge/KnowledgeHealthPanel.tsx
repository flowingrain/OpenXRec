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
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Database,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Activity,
  Circle,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

interface KnowledgeHealthStatus {
  totalEntities: number;
  totalRelations: number;
  verifiedEntities: number;
  verifiedRelations: number;
  expiredRelations: number;
  pendingConflicts: number;
  healthScore: number;
  lastCleanupAt: string | null;
}

interface CleanupResult {
  expiredRelations: number;
  expiredConfirmations: number;
  unverifiedEntities: number;
  totalCleaned: number;
  errors: string[];
}

interface KnowledgeHealthPanelProps {
  className?: string;
  onRefresh?: () => void;
}

// ==================== 辅助函数 ====================

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function getHealthLabel(score: number): string {
  if (score >= 80) return '健康';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '需优化';
}

function getHealthProgressColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

// ==================== 主组件 ====================

export function KnowledgeHealthPanel({
  className,
  onRefresh,
}: KnowledgeHealthPanelProps) {
  const [health, setHealth] = useState<KnowledgeHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  // 加载健康状态
  const loadHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge/cleanup');
      const data = await response.json();
      if (data.success) {
        setHealth(data.data);
      }
    } catch (error) {
      console.error('加载健康状态失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // 执行清理
  const handleCleanup = async (dryRun: boolean = false) => {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const response = await fetch('/api/knowledge/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await response.json();
      if (data.success) {
        setCleanupResult(data.data);
        loadHealth();
        onRefresh?.();
      }
    } catch (error) {
      console.error('执行清理失败:', error);
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <Card className={cn('h-full', className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            知识库健康状态
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadHealth} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 健康分数 */}
        <div className="text-center py-4">
          <div className={cn('text-5xl font-bold', health && getHealthColor(health.healthScore))}>
            {health?.healthScore ?? 0}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {health && getHealthLabel(health.healthScore)}
          </p>
          <Progress
            value={health?.healthScore ?? 0}
            className="h-2 mt-3"
          />
        </div>

        {/* 统计指标 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Circle className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">实体总数</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">{health?.totalEntities ?? 0}</span>
              {health && health.totalEntities > 0 && (
                <span className="text-xs text-green-600">
                  {Math.round((health.verifiedEntities / health.totalEntities) * 100)}% 已验证
                </span>
              )}
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">关系总数</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">{health?.totalRelations ?? 0}</span>
              {health && health.totalRelations > 0 && (
                <span className="text-xs text-green-600">
                  {Math.round((health.verifiedRelations / health.totalRelations) * 100)}% 已验证
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 问题提示 */}
        <div className="space-y-2">
          {health?.expiredRelations && health.expiredRelations > 0 && (
            <div className="flex items-center justify-between bg-orange-50 text-orange-700 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>过期关系</span>
              </div>
              <Badge variant="secondary">{health.expiredRelations}</Badge>
            </div>
          )}

          {health?.pendingConflicts && health.pendingConflicts > 0 && (
            <div className="flex items-center justify-between bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>待处理冲突</span>
              </div>
              <Badge variant="destructive">{health.pendingConflicts}</Badge>
            </div>
          )}

          {health?.lastCleanupAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              上次清理: {new Date(health.lastCleanupAt).toLocaleString('zh-CN')}
            </div>
          )}
        </div>

        {/* 清理结果 */}
        {cleanupResult && (
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
              <CheckCircle className="w-4 h-4" />
              清理完成
            </div>
            <div className="text-xs text-green-600 space-y-1">
              {cleanupResult.expiredRelations > 0 && (
                <p>• 清理过期关系: {cleanupResult.expiredRelations} 条</p>
              )}
              {cleanupResult.expiredConfirmations > 0 && (
                <p>• 清理过期确认: {cleanupResult.expiredConfirmations} 条</p>
              )}
              {cleanupResult.unverifiedEntities > 0 && (
                <p>• 清理未验证实体: {cleanupResult.unverifiedEntities} 个</p>
              )}
              {cleanupResult.totalCleaned === 0 && (
                <p>• 无需清理的数据</p>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Database className="w-4 h-4 mr-1" />
                预览清理
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>预览清理内容</AlertDialogTitle>
                <AlertDialogDescription>
                  将预览需要清理的数据，不会实际删除。是否继续？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleCleanup(true)}>
                  确认预览
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={cleaning}
              >
                {cleaning ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                执行清理
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清理</AlertDialogTitle>
                <AlertDialogDescription>
                  将清理过期关系、过期确认请求等数据。此操作不可撤销，是否确认执行？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleCleanup(false)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  确认清理
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default KnowledgeHealthPanel;
