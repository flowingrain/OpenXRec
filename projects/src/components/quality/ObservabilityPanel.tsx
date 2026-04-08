/**
 * 可观测性面板组件
 * 
 * 展示：
 * 1. 当前指标状态
 * 2. 历史趋势图表
 * 3. 异常预警
 * 4. 控制按钮
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Play,
  Pause,
  Clock,
  BarChart3
} from 'lucide-react';
import { Observable, ObservabilitySnapshot } from '@/hooks/useObservability';

interface ObservabilityPanelProps {
  current: ObservabilitySnapshot | null;
  history: ObservabilitySnapshot[];
  isMonitoring: boolean;
  updateCount: number;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
  getTrendAnalysis: () => any;
}

/**
 * 状态图标
 */
function StatusIcon({ status }: { status: '正常' | '警告' | '危险' }) {
  if (status === '正常') {
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  } else if (status === '警告') {
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  } else {
    return <XCircle className="w-5 h-5 text-red-500" />;
  }
}

/**
 * 趋势图标
 */
function TrendIcon({ trend }: { trend: string }) {
  if (trend.includes('上升') || trend.includes('向好') || trend.includes('新鲜')) {
    return <TrendingUp className="w-4 h-4 text-green-500" />;
  } else if (trend.includes('下降') || trend.includes('承压') || trend.includes('陈旧')) {
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  } else {
    return <Minus className="w-4 h-4 text-gray-500" />;
  }
}

/**
 * 单个指标卡片
 */
function MetricCard({ observable }: { observable: Observable }) {
  const statusColor = 
    observable.status === '正常' ? 'border-green-200 bg-green-50' :
    observable.status === '警告' ? 'border-yellow-200 bg-yellow-50' :
    'border-red-200 bg-red-50';

  return (
    <div className={`border rounded-lg p-4 ${statusColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <StatusIcon status={observable.status} />
          <div className="font-medium text-sm">{observable.label}</div>
        </div>
        <TrendIcon trend={observable.trend} />
      </div>
      
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">指标：</span>
          <span className="font-medium">{observable.metric}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">当前值：</span>
          <span className="font-bold">{observable.currentValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">阈值：</span>
          <span>{observable.threshold}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">趋势：</span>
          <span className="flex items-center gap-1">
            {observable.trend}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 历史趋势图表（简化版）
 */
function TrendChart({ history }: { history: ObservabilitySnapshot[] }) {
  if (history.length < 2) {
    return (
      <div className="text-center text-gray-500 text-sm py-8">
        需要至少 2 次更新才能显示趋势
      </div>
    );
  }

  const recent = history.slice(0, 10).reverse();

  return (
    <div className="space-y-4">
      {/* 状态时间线 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {recent.map((snapshot, i) => (
          <div key={snapshot.timestamp} className="flex flex-col items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                snapshot.status === 'normal' ? 'bg-green-100' :
                snapshot.status === 'warning' ? 'bg-yellow-100' :
                'bg-red-100'
              }`}
            >
              <StatusIcon status={
                snapshot.status === 'normal' ? '正常' :
                snapshot.status === 'warning' ? '警告' :
                '危险'
              } />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(snapshot.timestamp).toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 统计摘要 */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {recent.filter(s => s.status === 'normal').length}
          </div>
          <div className="text-gray-600">正常</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {recent.filter(s => s.status === 'warning').length}
          </div>
          <div className="text-gray-600">警告</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {recent.filter(s => s.status === 'danger').length}
          </div>
          <div className="text-gray-600">危险</div>
        </div>
      </div>
    </div>
  );
}

export default function ObservabilityPanel({
  current,
  history,
  isMonitoring,
  updateCount,
  onStart,
  onStop,
  onRefresh,
  getTrendAnalysis
}: ObservabilityPanelProps) {
  const trendAnalysis = getTrendAnalysis();

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                可观测性监控
              </CardTitle>
              <CardDescription>
                持续监测事件发展态势，自动触发更新
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isMonitoring ? 'default' : 'outline'}>
                {isMonitoring ? '监控中' : '已暂停'}
              </Badge>
              <Badge variant="outline">
                更新次数: {updateCount}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {!isMonitoring ? (
              <Button onClick={onStart} className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                开始监控
              </Button>
            ) : (
              <Button onClick={onStop} variant="outline" className="flex items-center gap-2">
                <Pause className="w-4 h-4" />
                停止监控
              </Button>
            )}
            <Button onClick={onRefresh} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              手动刷新
            </Button>
            {current && (
              <div className="text-sm text-gray-600 flex items-center gap-1 ml-auto">
                <Clock className="w-4 h-4" />
                上次更新: {new Date(current.timestamp).toLocaleString('zh-CN')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 异常预警 */}
      {trendAnalysis?.isDegrading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <div className="font-bold text-red-900 mb-1">态势恶化预警</div>
                <div className="text-sm text-red-700">
                  检测到可观测性指标持续恶化，建议立即重新分析以获取最新态势。
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 当前指标 */}
      {current && current.observables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">当前指标</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {current.observables.map((obs, i) => (
                <MetricCard key={i} observable={obs} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 历史趋势 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5" />
            历史趋势
          </CardTitle>
          <CardDescription>
            最近 {Math.min(history.length, 10)} 次更新的状态变化
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart history={history} />
        </CardContent>
      </Card>

      {/* 空状态 */}
      {!current && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <div className="text-lg font-medium mb-2">暂无可观测性数据</div>
              <div className="text-sm">完成分析后，点击"开始监控"以持续监测态势发展</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
