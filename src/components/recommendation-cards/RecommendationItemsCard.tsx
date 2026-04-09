'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ExternalLink,
  Sparkles,
  Star,
  Layers,
  ChevronRight,
} from 'lucide-react';
import type { RecommendationItemsOutput } from '@/lib/recommendation/response-templates/types';

interface RecommendationItemsCardProps {
  data: RecommendationItemsOutput;
  config?: {
    showExplanations?: boolean;
    showSourceLinks?: boolean;
    gridLayout?: boolean;
  };
}

/**
 * 推荐列表卡片
 * 
 * 用于展示通用推荐项列表
 */
export function RecommendationItemsCard({ data, config = {} }: RecommendationItemsCardProps) {
  const {
    showExplanations = true,
    showSourceLinks = true,
    gridLayout = false,
  } = config;

  const items = data.items || [];

  // 计算置信度颜色
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          推荐结果
        </CardTitle>
        {data.explanation && (
          <p className="text-sm text-muted-foreground mt-2">{data.explanation}</p>
        )}
        {data.strategy && (
          <Badge variant="outline" className="w-fit mt-2">
            <Layers className="h-3 w-3 mr-1" />
            {data.strategy}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-6">
        <div className={gridLayout ? 'grid gap-4 sm:grid-cols-2' : 'space-y-4'}>
          {items.map((item, index) => (
            <div
              key={item.id || index}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* 主体内容 */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold line-clamp-1">{item.title}</h4>
                  {item.score && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-medium">{item.score.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {item.description}
                </p>

                {/* 快速指标 */}
                <div className="flex items-center gap-3 text-xs">
                  {item.confidence !== undefined && (
                    <span className={getConfidenceColor(item.confidence)}>
                      置信度 {(item.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  {showSourceLinks && item.source && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      来源: {item.source}
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* 推荐理由 */}
              {showExplanations && item.explanations && item.explanations.length > 0 && (
                <div className="px-4 pb-4">
                  <Separator className="mb-3" />
                  <div className="space-y-2">
                    {item.explanations.slice(0, 2).map((explanation, expIndex) => (
                      <div key={expIndex} className="text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                          <ChevronRight className="h-3 w-3" />
                          <span className="font-medium">{explanation.type}</span>
                        </div>
                        <p className="text-muted-foreground pl-4">{explanation.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 信息来源汇总 */}
        {showSourceLinks && items.some((item) => item.source) && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">信息来源</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(items.map((item) => item.source).filter(Boolean))).map(
                  (source, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {source}
                    </Badge>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default RecommendationItemsCard;
