'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Lightbulb, BookOpen, HelpCircle } from 'lucide-react';
import type { SingleAnswerOutput } from '@/lib/recommendation/response-templates/types';

interface AnswerCardProps {
  data: SingleAnswerOutput;
  config?: {
    highlightAnswer?: boolean;
    collapsibleDetails?: boolean;
    showRelatedConcepts?: boolean;
  };
}

/**
 * 单一答案卡片
 * 
 * 用于展示问答型查询的结果
 */
export function AnswerCard({ data, config = {} }: AnswerCardProps) {
  const {
    highlightAnswer = true,
    collapsibleDetails = true,
    showRelatedConcepts = true,
  } = config;

  const [isExpanded, setIsExpanded] = React.useState(!collapsibleDetails);

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-green-600" />
          答案
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {/* 核心答案 */}
        <div
          className={`p-4 rounded-lg ${
            highlightAnswer
              ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 border border-green-200 dark:border-green-800'
              : 'bg-muted/50'
          }`}
        >
          <p className="text-base leading-relaxed font-medium">{data.answer}</p>
        </div>

        {/* 展开详情 */}
        {collapsibleDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            {isExpanded ? '收起详情' : '查看详情'}
            <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
          </button>
        )}

        {isExpanded && (
          <>
            {/* 详细解释 */}
            {data.explanation && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  详细解释
                </h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {data.explanation}
                  </p>
                </div>
              </div>
            )}

            {/* 示例说明 */}
            {data.examples && data.examples.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  示例说明
                </h3>
                <div className="space-y-3">
                  {data.examples.map((example, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg bg-muted/20"
                    >
                      <h4 className="text-sm font-medium mb-1">{example.title}</h4>
                      <p className="text-sm text-muted-foreground">{example.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 相关概念 */}
            {showRelatedConcepts && data.relatedConcepts && data.relatedConcepts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">相关概念</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.relatedConcepts.map((concept, index) => (
                      <div
                        key={index}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full text-sm"
                      >
                        <span className="font-medium">{concept.term}</span>
                        <span className="text-muted-foreground text-xs">
                          {concept.definition}
                        </span>
                      </div>
                    ))}
                  </div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AnswerCard;
