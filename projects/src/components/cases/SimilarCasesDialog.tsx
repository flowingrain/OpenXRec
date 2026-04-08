/**
 * 相似案例提示组件
 * 在分析前检测相似案例，提示用户选择查看历史或重新分析
 */

'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  RefreshCw, 
  Clock, 
  TrendingUp,
  FileText,
  AlertCircle
} from 'lucide-react';

// 相似案例类型
export interface SimilarCase {
  id: string;
  topic: string;
  similarity: number;
  conclusion?: string | Record<string, unknown>;
  confidence?: string;
  createdAt?: string;
  analyzedAt?: string;
}

interface SimilarCasesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
  cases: SimilarCase[];
  onViewHistory: (caseId: string) => void;
  onRerunAnalysis: () => void;
}

/**
 * 格式化时间
 */
function formatTime(dateStr?: string): string {
  if (!dateStr) return '未知时间';
  
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  } catch {
    return dateStr;
  }
}

/**
 * 获取结论摘要
 */
function getConclusionSummary(conclusion?: string | Record<string, unknown>): string {
  if (!conclusion) return '无结论';
  
  if (typeof conclusion === 'string') {
    return conclusion.slice(0, 150) + (conclusion.length > 150 ? '...' : '');
  }
  
  if (typeof conclusion === 'object') {
    const summary = (conclusion as Record<string, unknown>).summary;
    if (summary && typeof summary === 'string') {
      return summary.slice(0, 150) + (summary.length > 150 ? '...' : '');
    }
    return JSON.stringify(conclusion).slice(0, 150) + '...';
  }
  
  return '无结论';
}

/**
 * 获取相似度标签
 */
function getSimilarityBadge(similarity: number): { label: string; className: string } {
  if (similarity >= 0.9) {
    return { label: '高度相似', className: 'bg-green-500 text-white' };
  }
  if (similarity >= 0.75) {
    return { label: '较为相似', className: 'bg-blue-500 text-white' };
  }
  if (similarity >= 0.6) {
    return { label: '部分相似', className: 'bg-yellow-500 text-white' };
  }
  return { label: '略有相似', className: 'bg-gray-500 text-white' };
}

export function SimilarCasesDialog({
  open,
  onOpenChange,
  topic,
  cases,
  onViewHistory,
  onRerunAnalysis,
}: SimilarCasesDialogProps) {
  // 找到最相似的案例
  const mostSimilarCase = cases.length > 0 ? cases[0] : null;
  const similarityBadge = mostSimilarCase 
    ? getSimilarityBadge(mostSimilarCase.similarity) 
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            发现相似案例
          </DialogTitle>
          <DialogDescription>
            您要分析的「{topic}」与历史案例存在相似性，请选择操作
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* 提示信息 */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">
                已找到 {cases.length} 个相似案例
              </p>
              <p className="text-blue-600">
                您可以直接查看历史分析结果，或重新获取最新信息进行分析
              </p>
            </div>
          </div>

          {/* 相似案例列表 */}
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {cases.map((c, index) => {
                const badge = getSimilarityBadge(c.similarity);
                
                return (
                  <Card 
                    key={c.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      index === 0 ? 'border-blue-300 bg-blue-50/50' : ''
                    }`}
                    onClick={() => onViewHistory(c.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{c.topic}</span>
                        </div>
                        <Badge className={badge.className}>
                          {badge.label}
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {getConclusionSummary(c.conclusion)}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(c.createdAt || c.analyzedAt)}
                        </div>
                        {c.confidence && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            置信度: {Math.round(parseFloat(c.confidence) * 100)}%
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          相似度: {Math.round(c.similarity * 100)}%
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            取消
          </Button>
          
          {mostSimilarCase && (
            <Button
              variant="secondary"
              onClick={() => onViewHistory(mostSimilarCase.id)}
              className="w-full sm:w-auto"
            >
              <History className="w-4 h-4 mr-2" />
              查看历史分析
            </Button>
          )}
          
          <Button
            onClick={() => {
              onOpenChange(false);
              onRerunAnalysis();
            }}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            重新分析最新情况
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SimilarCasesDialog;
