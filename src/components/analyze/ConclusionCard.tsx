'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertCircle } from 'lucide-react';

interface ConclusionCardProps {
  conclusion: any;
}

export function ConclusionCard({ conclusion }: ConclusionCardProps) {
  if (!conclusion?.conclusion) return null;

  const data = conclusion.conclusion;

  return (
    <Card className="mt-6 border-2 border-primary/30 bg-gradient-to-r from-purple-50 to-pink-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Target className="w-6 h-6 text-primary" />
          核心结论
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold mb-4">
          {data.mainConclusion}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Probability Distribution */}
          {data.probabilityDistribution && (
            <div>
              <h4 className="font-semibold mb-2">概率分布</h4>
              <div className="space-y-2">
                {data.probabilityDistribution.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${p.probability * 100}%` }}
                      />
                    </div>
                    <span className="text-sm w-12 text-right">{(p.probability * 100).toFixed(0)}%</span>
                    <span className="text-xs text-muted-foreground">{p.outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence & Risk */}
          <div className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">置信度: </span>
              <Badge variant={
                data.confidenceLevel === 'high' ? 'default' :
                data.confidenceLevel === 'medium' ? 'secondary' : 'outline'
              }>
                {data.confidenceLevel === 'high' ? '高' :
                 data.confidenceLevel === 'medium' ? '中' : '低'}
              </Badge>
            </div>

            {data.risks && (
              <div>
                <h5 className="text-sm font-semibold mb-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  风险提示
                </h5>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {data.risks.map((r: string, i: number) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        {data.recommendations && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-semibold mb-3">💡 决策建议</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.recommendations.map((rec: any, i: number) => (
                <div key={i} className="bg-white rounded p-3 border">
                  <h5 className="font-medium text-sm mb-2">{rec.timeframe}</h5>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {rec.actions.map((a: string, j: number) => (
                      <li key={j}>• {a}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
