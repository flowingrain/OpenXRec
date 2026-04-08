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
  CheckCircle2,
  XCircle,
  ExternalLink,
  TrendingUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { ComparisonAnalysisOutput } from '@/lib/recommendation/response-templates/types';

interface ComparisonAnalysisCardProps {
  data: ComparisonAnalysisOutput;
  config?: {
    showScoreChart?: boolean;
    showDimensionTable?: boolean;
    expandableDetails?: boolean;
    highlightWinner?: boolean;
  };
}

/**
 * 对比分析卡片
 * 
 * 用于展示两个或多个选项的对比分析结果
 */
export function ComparisonAnalysisCard({ data, config = {} }: ComparisonAnalysisCardProps) {
  const {
    showScoreChart = true,
    showDimensionTable = true,
    highlightWinner = true,
  } = config;

  const entities = data.entities || [];
  
  // 找出最高分的实体
  const highestScoreEntity = entities.reduce(
    (max, entity) => (entity.score && (!max.score || entity.score > max.score) ? entity : max),
    entities[0]
  );

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          对比分析
        </CardTitle>
        {data.summary && (
          <p className="text-sm text-muted-foreground mt-2">{data.summary}</p>
        )}
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* 评分对比图 */}
        {showScoreChart && entities.some((e) => e.score) && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">综合评分</h3>
            <div className="flex items-end gap-4 justify-center">
              {entities.map((entity) => {
                const isWinner = highlightWinner && entity === highestScoreEntity;
                return (
                  <div
                    key={entity.name}
                    className={`flex flex-col items-center p-4 rounded-lg transition-all ${
                      isWinner
                        ? 'bg-gradient-to-b from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 ring-2 ring-yellow-400'
                        : 'bg-muted/50'
                    }`}
                  >
                    <span className="text-sm font-medium mb-2">{entity.name}</span>
                    <span
                      className={`text-3xl font-bold ${
                        isWinner ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'
                      }`}
                    >
                      {entity.score?.toFixed(1) || '-'}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">/ 10</span>
                    {isWinner && (
                      <Badge variant="secondary" className="mt-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        <Sparkles className="h-3 w-3 mr-1" />
                        推荐
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 对比维度表格 */}
        {showDimensionTable && data.dimensions && data.dimensions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">维度对比</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">对比维度</TableHead>
                  {entities.map((entity) => (
                    <TableHead key={entity.name} className="text-center">
                      {entity.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dimensions.map((dimension, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{dimension.name}</TableCell>
                    {entities.map((entity) => (
                      <TableCell key={entity.name} className="text-center">
                        {dimension.values[entity.name] || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 优缺点详细分析 */}
        <div className="grid gap-4 md:grid-cols-2">
          {entities.map((entity) => (
            <div
              key={entity.name}
              className={`p-4 rounded-lg border ${
                highlightWinner && entity === highestScoreEntity
                  ? 'border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/30'
                  : 'border-border'
              }`}
            >
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                {entity.name}
                {entity.type && (
                  <Badge variant="outline" className="text-xs">
                    {entity.type}
                  </Badge>
                )}
              </h4>

              {/* 优点 */}
              {entity.pros && entity.pros.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-xs font-medium text-green-700 dark:text-green-400 mb-1.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    优点
                  </h5>
                  <ul className="space-y-1">
                    {entity.pros.map((pro, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-green-500 mt-1">•</span>
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 缺点 */}
              {entity.cons && entity.cons.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    缺点
                  </h5>
                  <ul className="space-y-1">
                    {entity.cons.map((con, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-red-500 mt-1">•</span>
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 综合结论 */}
        {data.conclusion && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              综合结论
            </h3>
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm leading-relaxed">{data.conclusion}</p>
            </div>
          </div>
        )}

        {/* 选择建议 */}
        {data.recommendation && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">选择建议</h3>
            <div className="space-y-2">
              {data.recommendation.conditions ? (
                data.recommendation.conditions.map((condition, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <span className="text-sm text-muted-foreground flex-1">
                      {condition.condition}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Badge variant="secondary" className="shrink-0">
                      {condition.recommendation}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {data.recommendation.reason}
                </p>
              )}
            </div>
          </div>
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

export default ComparisonAnalysisCard;
