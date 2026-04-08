/**
 * 专家审核仪表盘页面
 * 
 * 功能：
 * 1. 超参数版本审核
 * 2. A/B 测试结果可视化
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Tooltip,
} from 'recharts';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  GitBranch,
  Play,
  Pause,
  BarChart3,
  LineChartIcon,
  Layers,
  Download,
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface PendingVersion {
  id: string;
  version: number;
  config: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
  };
  performance?: {
    avgReward?: number;
    trend?: 'improving' | 'stable' | 'degrading';
    sampleCount?: number;
  };
  source: 'auto' | 'manual' | 'rollback';
  tags: string[];
  notes?: string;
  createdBy?: string;
  createdAt: string;
  recommendation: {
    score: number;
    reason: string;
  };
}

interface ABTestResult {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed';
  startTime?: string;
  endTime?: string;
  variantA: {
    hyperparams?: {
      learningRate: number;
      clipEpsilon: number;
      entropyCoef: number;
      gaeLambda: number;
    };
    metrics: {
      sampleCount: number;
      avgReward: number;
      avgLoss?: number;
      convergenceRate?: number;
      stability?: number;
    };
  };
  variantB: {
    hyperparams?: {
      learningRate: number;
      clipEpsilon: number;
      entropyCoef: number;
      gaeLambda: number;
    };
    metrics: {
      sampleCount: number;
      avgReward: number;
      avgLoss?: number;
      convergenceRate?: number;
      stability?: number;
    };
  };
  statisticalTest?: {
    pValue: number;
    effectSize: number;
    significance: 'significant' | 'not_significant';
  };
  recommendation?: {
    winner: 'A' | 'B' | 'inconclusive';
    confidence: number;
    reason: string;
  };
}

// ============================================================================
// 版本审核组件
// ============================================================================

function VersionReviewPanel() {
  const [versions, setVersions] = useState<PendingVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PendingVersion | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve');

  // 加载待审核版本
  const loadPendingVersions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/recommendation/ppo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'version-pending' }),
      });

      const data = await response.json();
      if (data.success) {
        setVersions(data.data.versions);
        setError(null);
      } else {
        setError(data.error?.message || '加载失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingVersions();
  }, [loadPendingVersions]);

  // 提交审核
  const submitReview = async () => {
    if (!selectedVersion) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/recommendation/ppo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'version-verify',
          data: {
            versionId: selectedVersion.id,
            approved: dialogAction === 'approve',
            notes: reviewNotes,
            activate: dialogAction === 'approve',
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDialogOpen(false);
        setReviewNotes('');
        loadPendingVersions();
      } else {
        setError(data.error?.message || '审核失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  const openDialog = (version: PendingVersion, action: 'approve' | 'reject') => {
    setSelectedVersion(version);
    setDialogAction(action);
    setDialogOpen(true);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      auto: 'bg-blue-100 text-blue-800',
      manual: 'bg-green-100 text-green-800',
      rollback: 'bg-orange-100 text-orange-800',
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'degrading') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>错误</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-lg font-medium">暂无待审核版本</p>
          <p className="text-sm text-muted-foreground">所有版本都已审核完毕</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">待审核版本 ({versions.length})</h3>
        <Button variant="outline" onClick={loadPendingVersions}>
          刷新
        </Button>
      </div>

      <div className="grid gap-4">
        {versions.map((version) => (
          <Card key={version.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">v{version.version}</Badge>
                  <Badge className={getSourceBadge(version.source)}>
                    {version.source === 'auto' ? '自动' : version.source === 'manual' ? '手动' : '回滚'}
                  </Badge>
                  {version.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-medium ${getScoreColor(version.recommendation.score)}`}>
                    推荐分数: {version.recommendation.score}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">学习率</p>
                  <p className="font-mono">{version.config.learningRate.toExponential(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">裁剪参数</p>
                  <p className="font-mono">{version.config.clipEpsilon}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">熵系数</p>
                  <p className="font-mono">{version.config.entropyCoef}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">GAE Lambda</p>
                  <p className="font-mono">{version.config.gaeLambda}</p>
                </div>
              </div>

              {version.performance && (
                <div className="flex items-center gap-6 mb-4 text-sm">
                  <div className="flex items-center gap-1">
                    {getTrendIcon(version.performance.trend)}
                    <span>
                      平均奖励: {version.performance.avgReward?.toFixed(3) || 'N/A'}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    样本数: {version.performance.sampleCount || 0}
                  </span>
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-4">
                {version.recommendation.reason}
              </p>

              {version.notes && (
                <p className="text-sm bg-muted p-2 rounded mb-4">{version.notes}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  创建于 {new Date(version.createdAt).toLocaleString()}
                  {version.createdBy && ` by ${version.createdBy}`}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => openDialog(version, 'reject')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    拒绝
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => openDialog(version, 'approve')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    通过
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 审核确认对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'approve' ? '审核通过' : '审核拒绝'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'approve'
                ? `确认通过版本 v${selectedVersion?.version}？通过后将自动激活该配置。`
                : `确认拒绝版本 v${selectedVersion?.version}？拒绝后该版本将不会生效。`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">审核备注</Label>
              <Textarea
                id="notes"
                placeholder="输入审核意见（可选）"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={submitReview}
              disabled={submitting}
              className={
                dialogAction === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {submitting ? '处理中...' : dialogAction === 'approve' ? '确认通过' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// A/B 测试可视化组件
// ============================================================================

function ABTestVisualizationPanel() {
  const [experiments, setExperiments] = useState<ABTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExp, setSelectedExp] = useState<ABTestResult | null>(null);

  // 加载 A/B 测试列表
  const loadExperiments = useCallback(async () => {
    try {
      setLoading(true);

      // 获取实验列表
      const listResponse = await fetch('/api/recommendation/ppo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'ab-list' }),
      });

      const listData = await listResponse.json();
      if (!listData.success) {
        setError(listData.error?.message || '加载失败');
        return;
      }

      // 获取每个实验的详细结果
      const expWithResults = await Promise.all(
        (listData.data.experiments || []).map(async (exp: any) => {
          try {
            const resultResponse = await fetch('/api/recommendation/ppo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation: 'ab-results',
                data: { experimentId: exp.id },
              }),
            });

            const resultData = await resultResponse.json();
            const data = resultData.data || {};
            
            return {
              id: exp.id,
              name: exp.experiment_name || exp.name,
              status: exp.status,
              startTime: exp.start_time,
              endTime: exp.end_time,
              variantA: {
                hyperparams: data.variantA?.hyperparams || exp.variant_a?.config || {},
                metrics: data.variantA?.metrics || { sampleCount: 0, avgReward: 0 },
              },
              variantB: {
                hyperparams: data.variantB?.hyperparams || exp.variant_b?.config || {},
                metrics: data.variantB?.metrics || { sampleCount: 0, avgReward: 0 },
              },
              statisticalTest: data.statisticalTest,
              recommendation: data.recommendation,
            };
          } catch {
            return {
              id: exp.id,
              name: exp.experiment_name || exp.name,
              status: exp.status,
              variantA: { hyperparams: {}, metrics: { sampleCount: 0, avgReward: 0 } },
              variantB: { hyperparams: {}, metrics: { sampleCount: 0, avgReward: 0 } },
            };
          }
        })
      );

      setExperiments(expWithResults);
      if (expWithResults.length > 0) {
        setSelectedExp(expWithResults[0]);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'running') return <Play className="h-3 w-3" />;
    if (status === 'completed') return <CheckCircle className="h-3 w-3" />;
    return <Pause className="h-3 w-3" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>错误</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (experiments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">暂无 A/B 测试</p>
          <p className="text-sm text-muted-foreground">
            可以通过 PPO API 创建新的超参数对比实验
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig: ChartConfig = {
    variantA: {
      label: '变体 A',
      color: 'hsl(var(--chart-1))',
    },
    variantB: {
      label: '变体 B',
      color: 'hsl(var(--chart-2))',
    },
  };

  // 准备图表数据
  const comparisonData = experiments.map((exp) => ({
    name: exp.name.length > 10 ? exp.name.substring(0, 10) + '...' : exp.name,
    '变体A平均奖励': exp.variantA.metrics.avgReward * 100,
    '变体B平均奖励': exp.variantB.metrics.avgReward * 100,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">A/B 测试结果</h3>
        <Button variant="outline" onClick={loadExperiments}>
          刷新
        </Button>
      </div>

      {/* 实验列表 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {experiments.map((exp) => (
          <Card
            key={exp.id}
            className={`cursor-pointer transition-all ${
              selectedExp?.id === exp.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedExp(exp)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{exp.name}</CardTitle>
                <Badge className={getStatusBadge(exp.status)}>
                  {getStatusIcon(exp.status)}
                  <span className="ml-1">{exp.status}</span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">变体A</p>
                  <p className="font-medium">
                    {(exp.variantA.metrics.avgReward * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">变体B</p>
                  <p className="font-medium">
                    {(exp.variantB.metrics.avgReward * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              {exp.recommendation?.winner && exp.recommendation.winner !== 'inconclusive' && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">获胜者: </span>
                  <Badge variant={exp.recommendation.winner === 'A' ? 'default' : 'secondary'}>
                    变体 {exp.recommendation.winner}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 详细对比 */}
      {selectedExp && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedExp.name} - 详细对比</CardTitle>
            <CardDescription>
              {selectedExp.statisticalTest && (
                <>
                  <span>p值: {selectedExp.statisticalTest.pValue.toFixed(4)}</span>
                  <span className="mx-2">|</span>
                  <span>效应量: {selectedExp.statisticalTest.effectSize.toFixed(3)}</span>
                  {selectedExp.statisticalTest.significance === 'significant' && (
                    <Badge className="ml-2 bg-green-100 text-green-800">统计显著</Badge>
                  )}
                </>
              )}
              {selectedExp.recommendation?.reason && (
                <p className="mt-2 text-sm">{selectedExp.recommendation.reason}</p>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 变体 A */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
                  <span className="font-medium">变体 A</span>
                  {selectedExp.recommendation?.winner === 'A' && (
                    <Badge className="bg-green-100 text-green-800">获胜</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>平均奖励</span>
                      <span>{selectedExp.variantA.metrics.avgReward.toFixed(3)}</span>
                    </div>
                    <Progress value={selectedExp.variantA.metrics.avgReward * 100} />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>样本数</span>
                      <span>{selectedExp.variantA.metrics.sampleCount}</span>
                    </div>
                  </div>

                  {selectedExp.variantA.metrics.convergenceRate !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>收敛率</span>
                        <span>{(selectedExp.variantA.metrics.convergenceRate * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  {selectedExp.variantA.metrics.stability !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>稳定性</span>
                        <span>{selectedExp.variantA.metrics.stability.toFixed(3)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {selectedExp.variantA.hyperparams && (
                  <div className="bg-muted p-3 rounded text-sm">
                    <p className="font-medium mb-2">超参数配置</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(selectedExp.variantA.hyperparams, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* 变体 B */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]" />
                  <span className="font-medium">变体 B</span>
                  {selectedExp.recommendation?.winner === 'B' && (
                    <Badge className="bg-green-100 text-green-800">获胜</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>平均奖励</span>
                      <span>{selectedExp.variantB.metrics.avgReward.toFixed(3)}</span>
                    </div>
                    <Progress value={selectedExp.variantB.metrics.avgReward * 100} className="[&>div]:bg-[hsl(var(--chart-2))]" />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>样本数</span>
                      <span>{selectedExp.variantB.metrics.sampleCount}</span>
                    </div>
                  </div>

                  {selectedExp.variantB.metrics.convergenceRate !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>收敛率</span>
                        <span>{(selectedExp.variantB.metrics.convergenceRate * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  {selectedExp.variantB.metrics.stability !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>稳定性</span>
                        <span>{selectedExp.variantB.metrics.stability.toFixed(3)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {selectedExp.variantB.hyperparams && (
                  <div className="bg-muted p-3 rounded text-sm">
                    <p className="font-medium mb-2">超参数配置</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(selectedExp.variantB.hyperparams, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* 对比图表 */}
            <Separator className="my-6" />

            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={comparisonData.filter(d => d.name.includes(selectedExp.name.substring(0, 10)))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="变体A平均奖励" fill="var(--color-variantA)" name="变体A" />
                <Bar dataKey="变体B平均奖励" fill="var(--color-variantB)" name="变体B" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* 整体对比图表 */}
      {experiments.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>所有实验对比</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="变体A平均奖励" fill="var(--color-variantA)" name="变体A" />
                <Bar dataKey="变体B平均奖励" fill="var(--color-variantB)" name="变体B" />
                <Bar dataKey="变体B准确率" fill="var(--color-variantB)" name="变体B" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// 数据分析面板
// ============================================================================

interface TrainingHistoryItem {
  id: string;
  sessionId: string;
  epoch: number;
  hyperparams: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
  };
  metrics: {
    avgReward?: number;
    avgPolicyLoss?: number;
    avgValueLoss?: number;
    kl?: number;
  };
  createdAt: string;
}

interface VersionItem {
  id: string;
  version: number;
  config: {
    learningRate: number;
    clipEpsilon: number;
    entropyCoef: number;
    gaeLambda: number;
  };
  performance?: {
    avgReward?: number;
    trend?: string;
    sampleCount?: number;
  };
  isActive: boolean;
  isVerified: boolean;
  source: string;
  tags: string[];
  createdAt: string;
}

function DataAnalysisPanel() {
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistoryItem[]>([]);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // 并行加载训练历史和版本列表
      const [historyRes, versionsRes] = await Promise.all([
        fetch('/api/recommendation/ppo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'training-history', data: { limit: 100 } }),
        }),
        fetch('/api/recommendation/ppo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'version-list', data: { limit: 50, includeInactive: true } }),
        }),
      ]);

      const historyData = await historyRes.json();
      const versionsData = await versionsRes.json();

      if (historyData.success) {
        setTrainingHistory(historyData.data.history || []);
      }

      if (versionsData.success) {
        setVersions(versionsData.data.versions || []);
      }

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 计算超参数趋势数据
  const trendData = trainingHistory.slice(-30).map((item, index) => ({
    epoch: item.epoch,
    index: index + 1,
    learningRate: item.hyperparams?.learningRate || 0,
    clipEpsilon: item.hyperparams?.clipEpsilon || 0,
    entropyCoef: item.hyperparams?.entropyCoef || 0,
    avgReward: item.metrics?.avgReward || 0,
  }));

  // 计算相关性数据
  const correlationData = calculateCorrelations(trainingHistory);

  // 版本对比数据
  const versionCompareData = versions.slice(0, 10).map((v) => ({
    version: `v${v.version}`,
    learningRate: v.config?.learningRate || 0,
    clipEpsilon: v.config?.clipEpsilon || 0,
    entropyCoef: v.config?.entropyCoef || 0,
    gaeLambda: v.config?.gaeLambda || 0,
    avgReward: v.performance?.avgReward || 0,
    isActive: v.isActive,
  }));

  // 超参数分布散点图数据
  const scatterData = trainingHistory.map((item) => ({
    learningRate: item.hyperparams?.learningRate || 0,
    avgReward: item.metrics?.avgReward || 0,
    epoch: item.epoch,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>错误</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const trendChartConfig: ChartConfig = {
    learningRate: { label: '学习率', color: 'hsl(var(--chart-1))' },
    avgReward: { label: '平均奖励', color: 'hsl(var(--chart-2))' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">数据分析</h3>
        <Button variant="outline" onClick={loadData}>
          刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">训练记录</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{trainingHistory.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">版本总数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{versions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">已激活版本</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {versions.filter(v => v.isActive).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">平均奖励</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {trendData.length > 0
                ? (trendData.reduce((sum, d) => sum + d.avgReward, 0) / trendData.length).toFixed(3)
                : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 超参数趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5" />
            超参数趋势图
          </CardTitle>
          <CardDescription>最近 {trendData.length} 次训练的超参数和奖励变化</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendChartConfig} className="h-[350px]">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" label={{ value: '训练序号', position: 'bottom' }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="learningRate"
                stroke="var(--color-learningRate)"
                name="学习率 (×10⁴)"
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgReward"
                stroke="var(--color-avgReward)"
                name="平均奖励"
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 相关性热力图 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              超参数-性能相关性
            </CardTitle>
            <CardDescription>超参数与性能指标的相关系数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {correlationData.map((item) => (
                <div key={item.param} className="flex items-center gap-3">
                  <span className="w-24 text-sm">{item.param}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        item.correlation > 0 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{
                        width: `${Math.abs(item.correlation) * 100}%`,
                        marginLeft: item.correlation < 0 ? 'auto' : 0,
                      }}
                    />
                  </div>
                  <span className={`w-16 text-sm text-right ${
                    item.correlation > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.correlation.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              正值表示正相关，负值表示负相关，绝对值越大相关性越强
            </div>
          </CardContent>
        </Card>

        {/* 超参数-奖励散点图 */}
        <Card>
          <CardHeader>
            <CardTitle>学习率 vs 平均奖励</CardTitle>
            <CardDescription>探索学习率对奖励的影响</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendChartConfig} className="h-[250px]">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="learningRate"
                  name="学习率"
                  type="number"
                  tickFormatter={(v) => v.toExponential(1)}
                />
                <YAxis dataKey="avgReward" name="平均奖励" type="number" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  name="训练点"
                  data={scatterData}
                  fill="var(--color-learningRate)"
                />
              </ScatterChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* 版本对比图 */}
      <Card>
        <CardHeader>
          <CardTitle>版本超参数对比</CardTitle>
          <CardDescription>最近版本的超参数配置对比</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            lr: { label: '学习率 (×10⁴)', color: 'hsl(var(--chart-1))' },
            clip: { label: '裁剪参数 (×10)', color: 'hsl(var(--chart-2))' },
            entropy: { label: '熵系数 (×100)', color: 'hsl(var(--chart-3))' },
          }} className="h-[300px]">
            <BarChart data={versionCompareData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="version" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar
                dataKey={(d) => d.learningRate * 10000}
                fill="hsl(var(--chart-1))"
                name="学习率 (×10⁴)"
              />
              <Bar
                dataKey={(d) => d.clipEpsilon * 10}
                fill="hsl(var(--chart-2))"
                name="裁剪参数 (×10)"
              />
              <Bar
                dataKey={(d) => d.entropyCoef * 100}
                fill="hsl(var(--chart-3))"
                name="熵系数 (×100)"
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// 计算相关性
function calculateCorrelations(history: TrainingHistoryItem[]) {
  if (history.length < 5) {
    return [
      { param: '学习率', correlation: 0 },
      { param: '裁剪参数', correlation: 0 },
      { param: '熵系数', correlation: 0 },
      { param: 'GAE Lambda', correlation: 0 },
    ];
  }

  const rewards = history.map(h => h.metrics?.avgReward || 0);
  const mean = rewards.reduce((a, b) => a + b, 0) / rewards.length;

  const calcCorrelation = (values: number[]) => {
    const valueMean = values.reduce((a, b) => a + b, 0) / values.length;
    let numerator = 0;
    let denomReward = 0;
    let denomValue = 0;

    for (let i = 0; i < rewards.length; i++) {
      const diffReward = rewards[i] - mean;
      const diffValue = values[i] - valueMean;
      numerator += diffReward * diffValue;
      denomReward += diffReward * diffReward;
      denomValue += diffValue * diffValue;
    }

    const denom = Math.sqrt(denomReward * denomValue);
    return denom === 0 ? 0 : numerator / denom;
  };

  return [
    { param: '学习率', correlation: calcCorrelation(history.map(h => h.hyperparams?.learningRate || 0)) },
    { param: '裁剪参数', correlation: calcCorrelation(history.map(h => h.hyperparams?.clipEpsilon || 0)) },
    { param: '熵系数', correlation: calcCorrelation(history.map(h => h.hyperparams?.entropyCoef || 0)) },
    { param: 'GAE Lambda', correlation: calcCorrelation(history.map(h => h.hyperparams?.gaeLambda || 0)) },
  ];
}

// ============================================================================
// 主页面组件
// ============================================================================

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">专家审核仪表盘</h1>
        <p className="text-muted-foreground">
          审核超参数版本变更，查看 A/B 测试结果和数据分析
        </p>
      </div>

      <Tabs defaultValue="review" className="space-y-4">
        <TabsList>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            版本审核
          </TabsTrigger>
          <TabsTrigger value="ab-testing" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            A/B 测试结果
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4" />
            数据分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <VersionReviewPanel />
        </TabsContent>

        <TabsContent value="ab-testing">
          <ABTestVisualizationPanel />
        </TabsContent>

        <TabsContent value="analysis">
          <DataAnalysisPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
