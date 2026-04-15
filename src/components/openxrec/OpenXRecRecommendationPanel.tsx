'use client';

import {
  Sparkles,
  RefreshCw,
  ChevronRight,
  Info,
  Activity,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  type Message,
  type RankingItem,
  VECTOR_REUSE_RECOMPUTE_THRESHOLD,
} from '@/components/openxrec/types';

type OpenXRecRecommendationPanelProps = {
  lastRecMessage?: Message;
  isLoading: boolean;
  expandedRecId: string | null;
  feedbackByItem: Record<string, 'like' | 'dislike'>;
  feedbackPending: Record<string, boolean>;
  onExpandedRecChange: (id: string | null) => void;
  onRerunFullRecommendation: () => void;
  onSendFeedback: (itemId: string, feedbackType: 'like' | 'dislike') => void;
};

export function OpenXRecRecommendationPanel({
  lastRecMessage,
  isLoading,
  expandedRecId,
  feedbackByItem,
  feedbackPending,
  onExpandedRecChange,
  onRerunFullRecommendation,
  onSendFeedback,
}: OpenXRecRecommendationPanelProps) {
  if (!lastRecMessage || !lastRecMessage.recommendations) return null;

  return (
    <div className="border rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold mb-4">
        <Sparkles className="w-4 h-4 text-blue-600" />
        推荐结果
        <Badge variant="secondary" className="text-xs ml-auto bg-blue-100 text-blue-700 hover:bg-blue-100">
          {lastRecMessage.recommendations.length} 项
        </Badge>
      </div>
      {lastRecMessage.responseMeta?.cacheHit && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-3">
          <div className="text-xs text-amber-800">
            命中{lastRecMessage.responseMeta.cacheType === 'vector_reuse' ? '向量复用' : '短时缓存'}
            {typeof lastRecMessage.responseMeta.similarity === 'number'
              ? `（相似度 ${(lastRecMessage.responseMeta.similarity * 100).toFixed(0)}%）`
              : ''}
            {lastRecMessage.responseMeta.cacheType === 'vector_reuse' &&
            typeof lastRecMessage.responseMeta.similarity === 'number' &&
            lastRecMessage.responseMeta.similarity < VECTOR_REUSE_RECOMPUTE_THRESHOLD
              ? '，建议完整重算以获取最新结果'
              : ''}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onRerunFullRecommendation}
            disabled={isLoading}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            完整重算
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {lastRecMessage.recommendations.slice(0, 5).map((rec, index) => {
          const rankingRec = rec as RankingItem;
          const score = rankingRec?.overallScore ?? (rec.score ?? 0) * 100;
          const isExpanded = expandedRecId === rec.id;

          return (
            <Card key={rec.id || index} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div
                className={cn(
                  'cursor-pointer transition-colors',
                  isExpanded ? 'bg-gradient-to-r from-blue-50 to-white' : 'hover:bg-slate-50'
                )}
                onClick={() => onExpandedRecChange(isExpanded ? null : rec.id || String(index))}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 truncate">{String(rec.title || '')}</h3>
                        <Badge
                          variant={score >= 90 ? 'default' : 'secondary'}
                          className="text-xs bg-green-100 text-green-700 hover:bg-green-100"
                        >
                          {score.toFixed(0)}% 匹配
                        </Badge>
                      </div>
                      {rec.description && (
                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                          {String(rec.description || '')}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 text-slate-400 flex-shrink-0 mt-1 transition-transform',
                        isExpanded && 'rotate-90 text-blue-600'
                      )}
                    />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t bg-gradient-to-b from-slate-50 to-white">
                  <CardContent className="pt-4 pb-4">
                    {rec.explanation && (
                      <div className="mb-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-2">
                          <Info className="w-4 h-4" />
                          推荐理由
                        </div>
                        {(() => {
                          const text = String(rec.explanation || '');
                          const [evidenceRaw, summaryRaw] = text.split('【推荐说明】');
                          const evidenceText = evidenceRaw.replace(/^【证据链】/, '').trim();
                          const summaryText = (summaryRaw || '').trim();
                          const evidenceParts = evidenceText
                            .split('|')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          return (
                            <div className="space-y-2">
                              {evidenceParts.length > 0 && (
                                <div className="rounded-md border border-blue-100 bg-white/70 p-2">
                                  <div className="text-xs font-medium text-blue-700 mb-1">证据链</div>
                                  <div className="space-y-1">
                                    {evidenceParts.map((part, i) => (
                                      <p key={i} className="text-xs text-slate-600 leading-relaxed break-words">
                                        {part}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                {summaryText || text}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {rec.factors && rec.factors.length > 0 && (
                      <div className="mb-4 p-3 bg-slate-50/50 border border-slate-100 rounded-lg">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                          <Activity className="w-4 h-4" />
                          匹配因素分析
                        </div>
                        <div className="space-y-3">
                          {rec.factors.map((factor, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="text-slate-600 font-medium">{factor.name}</span>
                                <span className="text-slate-500 font-semibold">
                                  {(factor.importance * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                                  style={{ width: `${factor.importance * 100}%` }}
                                />
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{String(factor.value ?? '')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      {rec.sourceUrl && (
                        <a
                          href={rec.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4" />
                          查看详情
                        </a>
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        {(() => {
                          const itemId = rec.id || String(index);
                          const liked = feedbackByItem[itemId] === 'like';
                          const disliked = feedbackByItem[itemId] === 'dislike';
                          const pending = !!feedbackPending[itemId];
                          return (
                            <>
                              <Button
                                variant={liked ? 'secondary' : 'ghost'}
                                size="sm"
                                className={cn(
                                  'h-8 px-2 text-xs hover:bg-green-50 hover:text-green-700 gap-1',
                                  liked && 'bg-green-100 text-green-700'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSendFeedback(itemId, 'like');
                                }}
                                disabled={pending}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                有帮助
                              </Button>
                              <Button
                                variant={disliked ? 'secondary' : 'ghost'}
                                size="sm"
                                className={cn(
                                  'h-8 px-2 text-xs hover:bg-red-50 hover:text-red-700 gap-1',
                                  disliked && 'bg-red-100 text-red-700'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSendFeedback(itemId, 'dislike');
                                }}
                                disabled={pending}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                不相关
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
