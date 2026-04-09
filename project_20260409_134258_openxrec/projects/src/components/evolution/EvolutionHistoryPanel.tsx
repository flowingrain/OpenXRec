'use client';

import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History,
  TrendingUp,
  ArrowRight,
  Plus,
  RefreshCw,
  Trash2,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
  Calendar
} from 'lucide-react';

// 演化类型
type EvolutionType = 'create' | 'update' | 'replace' | 'expire' | 'delete';

// 演化记录
interface EvolutionRecord {
  id: string;
  relation_id?: string;
  entity_id?: string;
  evolution_type: EvolutionType;
  old_value?: any;
  new_value?: any;
  reason: string;
  triggered_by: 'auto' | 'manual' | 'system';
  created_at: string;
}

// 统计数据
interface EvolutionStats {
  totalEvolutions: number;
  recentEvolutions: number;
  byType: Record<EvolutionType, number>;
  byTrigger: Record<string, number>;
}

// 演化类型配置
const EVOLUTION_TYPE_CONFIG: Record<EvolutionType, { label: string; color: string; icon: any }> = {
  create: { label: '创建', color: 'bg-green-500', icon: Plus },
  update: { label: '更新', color: 'bg-blue-500', icon: RefreshCw },
  replace: { label: '替换', color: 'bg-yellow-500', icon: ArrowRight },
  expire: { label: '过期', color: 'bg-orange-500', icon: Clock },
  delete: { label: '删除', color: 'bg-red-500', icon: Trash2 },
};

interface EvolutionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entityId?: string;
  relationId?: string;
}

export function EvolutionHistoryPanel({ 
  isOpen, 
  onClose, 
  entityId, 
  relationId 
}: EvolutionHistoryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<EvolutionStats | null>(null);
  const [history, setHistory] = useState<EvolutionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'history'>('stats');

  // 加载统计数据
  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge/evolution?action=stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载历史记录
  const loadHistory = async () => {
    if (!entityId && !relationId) {
      // 如果没有指定实体或关系，加载最近的演化记录
      // 这里可以通过 stats 接口获取概览
      return;
    }
    
    setLoading(true);
    try {
      let url = '/api/knowledge/evolution?action=';
      if (entityId) {
        url += `entity_history&entityId=${entityId}`;
      } else if (relationId) {
        url += `relation_timeline&relationId=${relationId}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        if (Array.isArray(data.data)) {
          setHistory(data.data);
        } else if (data.data.history) {
          setHistory(data.data.history);
        }
      }
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
      loadHistory();
    }
  }, [isOpen, entityId, relationId]);

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-500" />
            知识演化历史
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stats">演化统计</TabsTrigger>
            <TabsTrigger value="history">历史记录</TabsTrigger>
          </TabsList>

          {/* 统计视图 */}
          <TabsContent value="stats" className="mt-4">
            {loading && !stats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* 概览卡片 */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.totalEvolutions}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        总演化次数
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {stats.recentEvolutions}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        近7天演化
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.byType.replace || 0}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        关系替换
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 按类型统计 */}
                <div>
                  <h3 className="text-sm font-medium mb-3">按类型分布</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.byType).map(([type, count]) => {
                      const config = EVOLUTION_TYPE_CONFIG[type as EvolutionType];
                      const Icon = config.icon;
                      const percentage = stats.totalEvolutions > 0 
                        ? (count / stats.totalEvolutions * 100).toFixed(0) 
                        : 0;
                      
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <div className={`p-1.5 rounded ${config.color}`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-sm flex-1">{config.label}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${config.color}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 按触发来源统计 */}
                <div>
                  <h3 className="text-sm font-medium mb-3">按触发来源</h3>
                  <div className="flex gap-4">
                    {Object.entries(stats.byTrigger).map(([trigger, count]) => (
                      <Badge 
                        key={trigger} 
                        variant={trigger === 'auto' ? 'default' : 'secondary'}
                        className="px-3 py-1"
                      >
                        {trigger === 'auto' ? '自动' : trigger === 'manual' ? '手动' : '系统'}
                        : {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 过期策略说明 */}
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      自动过期策略
                    </h3>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• 手动添加知识：有效期 1 年</p>
                      <p>• 文档提取知识：有效期 180 天</p>
                      <p>• LLM 提取知识：有效期 90 天</p>
                      <p>• 高置信度 (&gt;0.8)：有效期延长 50%</p>
                      <p>• 低置信度 (&lt;0.5)：有效期缩短 50%</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无演化数据</p>
              </div>
            )}
          </TabsContent>

          {/* 历史记录视图 */}
          <TabsContent value="history" className="mt-4">
            {loading && history.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="relative pl-6 pr-4">
                  {/* 时间线 */}
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
                  
                  <div className="space-y-4">
                    {history.map((record, index) => {
                      const config = EVOLUTION_TYPE_CONFIG[record.evolution_type];
                      const Icon = config.icon;
                      
                      return (
                        <div key={record.id} className="relative">
                          {/* 时间线节点 */}
                          <div className={`absolute -left-4 p-1.5 rounded-full ${config.color}`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          
                          {/* 内容卡片 */}
                          <Card className="ml-4">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {config.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(record.created_at)}
                                </span>
                              </div>
                              
                              <p className="text-sm mb-2">{record.reason}</p>
                              
                              {/* 值变化对比 */}
                              {record.old_value && record.new_value && (
                                <div className="flex items-center gap-2 text-xs bg-muted/50 rounded p-2">
                                  <div className="flex-1">
                                    <span className="text-muted-foreground">旧值：</span>
                                    <span className="font-mono">
                                      {JSON.stringify(record.old_value).slice(0, 50)}
                                    </span>
                                  </div>
                                  <ChevronRight className="h-3 w-3" />
                                  <div className="flex-1">
                                    <span className="text-muted-foreground">新值：</span>
                                    <span className="font-mono">
                                      {JSON.stringify(record.new_value).slice(0, 50)}
                                    </span>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="text-[10px]">
                                  {record.triggered_by === 'auto' ? '自动' : 
                                   record.triggered_by === 'manual' ? '手动' : '系统'}
                                </Badge>
                                {record.relation_id && (
                                  <span className="truncate">关系: {record.relation_id.slice(0, 8)}...</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无演化历史</p>
                <p className="text-xs mt-1">
                  {entityId || relationId 
                    ? '该实体/关系暂无演化记录'
                    : '选择实体或关系查看演化历史'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 底部操作 */}
        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-xs text-muted-foreground">
            知识演化自动追踪关系变化
          </span>
          <Button variant="outline" size="sm" onClick={loadStats}>
            <RefreshCw className="h-3 w-3 mr-1" />
            刷新
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
