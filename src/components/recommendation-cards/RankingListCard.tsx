'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Trophy,
  Star,
  ExternalLink,
  TrendingUp,
  Users,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { RankingListOutput } from '@/lib/recommendation/response-templates/types';

interface RankingListCardProps {
  data: RankingListOutput;
  config?: {
    showScoreBadge?: boolean;
    showComparisonTable?: boolean;
    expandableDetails?: boolean;
    itemsPerPage?: number;
  };
}

/**
 * 排序列表卡片
 * 
 * 用于展示多选项推荐和排名结果
 */
export function RankingListCard({ data, config = {} }: RankingListCardProps) {
  const {
    showScoreBadge = true,
    showComparisonTable = true,
    expandableDetails = true,
    itemsPerPage = 5,
  } = config;

  const items = data.items?.slice(0, itemsPerPage) || [];
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(new Set());

  const toggleExpand = (rank: number) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rank)) {
        newSet.delete(rank);
      } else {
        newSet.add(rank);
      }
      return newSet;
    });
  };

  // 获取排名对应的颜色
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-400 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // 获取排名图标
  const getRankIcon = (rank: number) => {
    if (rank <= 3) {
      return <Trophy className="h-3.5 w-3.5" />;
    }
    return null;
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          {data.category || '推荐列表'}
        </CardTitle>
        {items.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            为您精选 {items.length} 个推荐选项
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* 排名列表 */}
        <div className="space-y-3">
          {items.map((item) => {
            const isExpanded = expandedItems.has(item.rank);
            const scorePercent = item.maxScore ? (item.score / item.maxScore) * 100 : item.score * 10;

            return (
              <div
                key={item.rank}
                className={`border rounded-lg overflow-hidden transition-all ${
                  item.rank === 1
                    ? 'border-yellow-400 dark:border-yellow-600 bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-950/30'
                    : 'border-border'
                }`}
              >
                {/* 主信息行 */}
                <div
                  className={`p-4 ${expandableDetails ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                  onClick={() => expandableDetails && toggleExpand(item.rank)}
                >
                  <div className="flex items-start gap-4">
                    {/* 排名徽章 */}
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${getRankColor(item.rank)}`}
                    >
                      {getRankIcon(item.rank) ? (
                        getRankIcon(item.rank)
                      ) : (
                        <span className="font-bold">{item.rank}</span>
                      )}
                    </div>

                    {/* 主要内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold truncate">{item.title}</h4>
                        {showScoreBadge && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 flex items-center gap-1"
                          >
                            <Star className="h-3 w-3 text-yellow-500" />
                            {item.score.toFixed(1)}
                          </Badge>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* 快速信息 */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {item.targetUsers && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {item.targetUsers}
                          </span>
                        )}
                        {item.priceRange && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {item.priceRange}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 评分进度条 */}
                    {showScoreBadge && (
                      <div className="hidden sm:block w-24 shrink-0">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              item.rank === 1
                                ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                                : 'bg-primary'
                            }`}
                            style={{ width: `${scorePercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-1">
                          {item.score.toFixed(1)} / {item.maxScore || 10}
                        </p>
                      </div>
                    )}

                    {/* 展开/折叠图标 */}
                    {expandableDetails && (
                      <div className="shrink-0 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* 优势 */}
                      {item.advantages && item.advantages.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                            核心优势
                          </h5>
                          <ul className="space-y-1">
                            {item.advantages.map((adv, index) => (
                              <li
                                key={index}
                                className="text-sm text-muted-foreground flex items-start gap-2"
                              >
                                <span className="text-green-500 mt-0.5">✓</span>
                                {adv}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 劣势 */}
                      {item.disadvantages && item.disadvantages.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-red-700 dark:text-red-400 mb-2">
                            注意事项
                          </h5>
                          <ul className="space-y-1">
                            {item.disadvantages.map((dis, index) => (
                              <li
                                key={index}
                                className="text-sm text-muted-foreground flex items-start gap-2"
                              >
                                <span className="text-red-500 mt-0.5">✗</span>
                                {dis}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* 推荐理由 */}
                    {item.reasoning && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <h5 className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                          推荐理由
                        </h5>
                        <p className="text-sm text-muted-foreground">{item.reasoning}</p>
                      </div>
                    )}

                    {/* 来源 */}
                    {item.source && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        <span>来源：{item.source}</span>
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:underline inline-flex items-center gap-0.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            查看详情
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 对比表格 */}
        {showComparisonTable && data.comparisonTable && data.comparisonTable.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">快速对比</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(data.comparisonTable[0] || {}).map((key) => (
                        <TableHead key={key} className="whitespace-nowrap">
                          {key}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.comparisonTable.map((row, index) => (
                      <TableRow key={index}>
                        {Object.values(row).map((value, cellIndex) => (
                          <TableCell key={cellIndex} className="whitespace-nowrap">
                            {String(value)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}

        {/* 选择指南 */}
        {data.selectionGuide && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">选择指南</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {data.selectionGuide.highBudget && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">预算充足</p>
                    <p className="text-sm font-medium">{data.selectionGuide.highBudget}</p>
                  </div>
                )}
                {data.selectionGuide.valueForMoney && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">性价比之选</p>
                    <p className="text-sm font-medium">{data.selectionGuide.valueForMoney}</p>
                  </div>
                )}
                {data.selectionGuide.entryLevel && (
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">入门首选</p>
                    <p className="text-sm font-medium">{data.selectionGuide.entryLevel}</p>
                  </div>
                )}
              </div>
              {data.selectionGuide.custom && data.selectionGuide.custom.length > 0 && (
                <div className="space-y-2 mt-3">
                  {data.selectionGuide.custom.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-muted-foreground">{item.scenario}:</span>
                      <Badge variant="outline">{item.recommendation}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* 信息来源 */}
        {data.sources && data.sources.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">信息来源</h3>
              <div className="flex flex-wrap gap-2">
                {data.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {source.title}
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default RankingListCard;
