'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch, ArrowRight, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CausalChainNode {
  type: 'cause' | 'intermediary' | 'conductor' | 'result';
  factor: string;
  description: string;
  strength: number;
  strengthReason?: string;
  relatedCoreEvents?: string[];
}

interface CausalChainFlowProps {
  nodes: CausalChainNode[];
  isAnalyzing?: boolean;
}

/**
 * 因果链链式可视化组件
 * 展示：原因 → 中介 → 传导 → 结果 的传导路径
 */
export default function CausalChainFlow({ nodes, isAnalyzing }: CausalChainFlowProps) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        {isAnalyzing ? (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
            <p className="text-sm">正在构建因果链...</p>
          </>
        ) : (
          <>
            <GitBranch className="w-12 h-12 opacity-30 mb-3" />
            <p className="text-sm">分析后将展示事件间的因果关系</p>
          </>
        )}
      </div>
    );
  }

  // 按类型排序：cause → intermediary → conductor → result
  const typeOrder = { cause: 0, intermediary: 1, conductor: 2, result: 3 };
  const sortedNodes = [...nodes].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

  // 获取节点样式配置
  const getNodeConfig = (type: string) => {
    switch (type) {
      case 'cause':
        return {
          label: '原因',
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
          badgeVariant: 'destructive' as const,
          icon: <AlertCircle className="w-4 h-4" />,
        };
      case 'intermediary':
        return {
          label: '中介',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 border-amber-200',
          badgeVariant: 'secondary' as const,
          icon: <Circle className="w-4 h-4" />,
        };
      case 'conductor':
        return {
          label: '传导',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          badgeVariant: 'default' as const,
          icon: <GitBranch className="w-4 h-4" />,
        };
      case 'result':
        return {
          label: '结果',
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          badgeVariant: 'outline' as const,
          icon: <Circle className="w-4 h-4 fill-current" />,
        };
      default:
        return {
          label: '未知',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          badgeVariant: 'outline' as const,
          icon: <Circle className="w-4 h-4" />,
        };
    }
  };

  // 获取强度颜色
  const getStrengthColor = (strength: number) => {
    if (strength >= 0.7) return 'bg-green-500';
    if (strength >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="relative">
      {/* 链式连接线（垂直） */}
      <div className="absolute left-6 top-16 bottom-16 w-0.5 bg-gradient-to-b from-red-300 via-amber-300 to-green-300 opacity-30" />

      <div className="space-y-0">
        {sortedNodes.map((node, index) => {
          const config = getNodeConfig(node.type);
          const isLast = index === sortedNodes.length - 1;

          return (
            <div key={index} className="relative flex items-start gap-4">
              {/* 节点序号 + 连接箭头 */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 shadow-sm',
                    config.bgColor,
                    config.color
                  )}
                >
                  {index + 1}
                </div>
                {!isLast && (
                  <div className="flex-1 flex flex-col items-center py-2">
                    <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90" />
                    <div className="h-8 w-0.5 bg-muted-foreground/20" />
                  </div>
                )}
              </div>

              {/* 节点内容卡片 */}
              <div
                className={cn(
                  'flex-1 min-w-0 border rounded-lg p-4 transition-all hover:shadow-md',
                  config.bgColor
                )}
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant={config.badgeVariant} className="text-xs shrink-0">
                    {config.icon}
                    <span className="ml-1">{config.label}</span>
                  </Badge>
                  <span className={cn('font-semibold break-words', config.color)}>
                    {node.factor}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-3 break-words">
                  {node.description}
                </p>

                {/* 因果强度 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">因果强度</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-white/50 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', getStrengthColor(node.strength))}
                          style={{ width: `${node.strength * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-10 text-right">
                        {(node.strength * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {node.strengthReason && (
                    <p className="text-xs text-muted-foreground bg-white/30 p-2 rounded border border-white/50 break-words">
                      💡 {node.strengthReason}
                    </p>
                  )}
                </div>

                {/* 相关事件 */}
                {node.relatedCoreEvents && node.relatedCoreEvents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/30">
                    <span className="text-xs text-muted-foreground">相关事件：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {node.relatedCoreEvents.slice(0, 3).map((event, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-white/50 max-w-full truncate">
                          {event.length > 30 ? event.substring(0, 30) + '...' : event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 传导路径总结 */}
      <div className="mt-6 p-4 bg-gradient-to-r from-red-50 via-amber-50 to-green-50 rounded-lg border">
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-red-600 font-medium">原因</span>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-amber-600 font-medium">中介</span>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-blue-600 font-medium">传导</span>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-green-600 font-medium">结果</span>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">
          因果传导链路：展示事件从起因到结果的完整传导路径
        </p>
      </div>
    </div>
  );
}
