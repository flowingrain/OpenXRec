'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock,
  Target,
  Loader2,
  TrendingUp,
  TrendingDown,
 Minus,
  ExternalLink,
  GitBranch,
  Newspaper
} from 'lucide-react';
import CausalChainFlow from './CausalChainFlow';

interface AnalysisResultsProps {
  topic: string;
  completeData: any;
  graphData: any;
  isAnalyzing?: boolean;
}

// 空状态占位组件
function EmptyPlaceholder({ 
  title, 
  description, 
  icon,
  isLoading = false
}: { 
  title: string; 
  description: string; 
  icon: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      {isLoading ? (
        <Loader2 className="w-8 h-8 mb-4 animate-spin text-primary" />
      ) : (
        <div className="mb-4 opacity-50">{icon}</div>
      )}
      <div className="text-lg font-medium mb-2">{title}</div>
      <div className="text-sm text-center max-w-md">{description}</div>
    </div>
  );
}

export function AnalysisResults({ topic, completeData, graphData, isAnalyzing }: AnalysisResultsProps) {
  // 从多个数据源提取时间线数据
  // 支持格式：
  // 1. completeData.timeline 直接是数组
  // 2. completeData.timeline.timeline 嵌套数组
  // 3. completeData.timeline.events 嵌套数组
  let timelineData: any[] = [];
  
  if (Array.isArray(completeData?.timeline)) {
    // 直接是数组
    timelineData = completeData.timeline;
  } else if (completeData?.timeline?.timeline && Array.isArray(completeData.timeline.timeline)) {
    // timeline.timeline 嵌套
    timelineData = completeData.timeline.timeline;
  } else if (completeData?.timeline?.events && Array.isArray(completeData.timeline.events)) {
    // timeline.events 嵌套
    timelineData = completeData.timeline.events;
  } else if (completeData?.eventGraph?.timeline) {
    // 从事件图谱提取
    timelineData = completeData.eventGraph.timeline;
  } else if (graphData?.nodes) {
    // 从图谱节点提取
    timelineData = graphData.nodes
      .filter((n: any) => n.type === 'timeline')
      .map((n: any) => ({
        timestamp: n.data?.date,
        event: n.data?.label,
        situation: n.data?.description
      }));
  }
  
  // 调试时间线数据结构
  console.log('[AnalysisResults] 时间线数据结构:', {
    hasTimelineData: timelineData.length > 0,
    timelineDataLength: timelineData.length,
    firstEvent: timelineData[0] ? {
      keys: Object.keys(timelineData[0]),
      timestamp: timelineData[0].timestamp,
      event: timelineData[0].event,
    } : null,
    completeDataTimelineType: typeof completeData?.timeline,
    completeDataTimelineIsArray: Array.isArray(completeData?.timeline),
  });
  
  // 从多个数据源提取因果链数据
  const causalChainData = completeData?.causal_chains?.causalChain ||
                          completeData?.causal_chains ||
                          completeData?.causalChain?.causalChain ||
                          completeData?.eventGraph?.causalChain ||
                          completeData?.eventGraph?.causal_chains?.map((c: any) => ({
                            type: 'intermediary',
                            factor: c.cause || c.factor,
                            description: c.effect || c.description,
                            strength: c.confidence || 0.7
                          }));
  
  // 调试日志
  console.log('[AnalysisResults] completeData:', completeData);
  console.log('[AnalysisResults] causalChainData:', causalChainData);
  console.log('[AnalysisResults] graphData nodes:', graphData?.nodes?.map((n: any) => n.type));
  
  // 从多个数据源提取关键因素数据
  const keyFactorsData = completeData?.key_factors?.factors ||
                         completeData?.key_factors ||
                         completeData?.keyFactors?.factors ||
                         completeData?.keyFactors?.keyFactors ||
                         completeData?.eventGraph?.keyFactors ||
                         graphData?.nodes?.filter((n: any) => n.type === 'factor').map((n: any) => ({
                           factor: n.data?.label,
                           description: n.data?.description,
                           dimension: '综合',
                           impact: 'neutral',
                           weight: 0.5
                         }));
  
  // 从多个数据源提取场景数据
  const scenariosData = completeData?.scenarios?.scenarios ||
                        completeData?.scenarios ||
                        completeData?.eventGraph?.scenarios ||
                        graphData?.nodes?.filter((n: any) => n.type === 'scenario').map((n: any) => ({
                          name: n.data?.label,
                          type: n.data?.type || 'neutral',
                          probability: n.data?.probability || 0.33,
                          description: n.data?.description,
                          triggers: [],
                          predictions: [],
                          impacts: []
                        }));

  return (
    <Tabs defaultValue="timeline" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="timeline">
          {isAnalyzing && !timelineData?.length && (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          )}
          时间线
        </TabsTrigger>
        <TabsTrigger value="factors">
          {isAnalyzing && !keyFactorsData?.length && (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          )}
          归因分析
        </TabsTrigger>
        <TabsTrigger value="scenarios">
          {isAnalyzing && !scenariosData?.length && (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          )}
          趋势研判
        </TabsTrigger>
      </TabsList>

      {/* Timeline Tab */}
      <TabsContent value="timeline">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              时间线演化
            </CardTitle>
            <CardDescription>
              关键事件的时间序列与态势评估
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timelineData && timelineData.length > 0 ? (
              <div className="space-y-4">
                {timelineData.map((event: any, i: number) => (
                  <div key={i} className="flex gap-4 items-start border-l-2 border-primary/30 pl-4 py-2">
                    <div className="flex-shrink-0 w-24 text-sm text-muted-foreground">
                      {event.timestamp?.substring(0, 10) || event.date || '未知时间'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{event.event || event.label}</span>
                        {event.trendChange && (
                          <Badge variant={
                            event.trendChange === 'up' ? 'default' :
                            event.trendChange === 'down' ? 'destructive' : 'secondary'
                          } className="text-xs">
                            {event.trendChange === 'up' ? '↑ 上升' :
                             event.trendChange === 'down' ? '↓ 下降' : '→ 平稳'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{event.situation || event.description}</p>
                    </div>
                    {event.heatIndex && (
                      <div className="text-xs text-muted-foreground">
                        热度: {event.heatIndex}%
                      </div>
                    )}
                  </div>
                ))}
                {completeData?.timeline?.evolutionSummary && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2">演化总结</h4>
                    <p className="text-sm text-muted-foreground">
                      {completeData.timeline.evolutionSummary}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyPlaceholder 
                icon={<Clock className="w-12 h-12" />}
                title="时间线演化"
                description={isAnalyzing ? "正在构建时间线，请稍候..." : "输入分析主题后，将展示关键事件的时间序列与态势评估"}
                isLoading={isAnalyzing}
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Factors Tab */}
      <TabsContent value="factors">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Causal Chain */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                因果链
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-auto max-h-[500px]">
              <CausalChainFlow nodes={causalChainData} isAnalyzing={isAnalyzing} />
            </CardContent>
          </Card>

          {/* Key Factors */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5" />
                关键影响因素
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-auto max-h-[500px]">
              {keyFactorsData && keyFactorsData.length > 0 ? (
                <div className="space-y-3">
                  {keyFactorsData.map((factor: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{factor.factor || factor.name}</span>
                        <Badge variant={factor.impact === 'positive' ? 'default' : factor.impact === 'negative' ? 'destructive' : 'secondary'}>
                          {factor.impact === 'positive' ? '正面' : factor.impact === 'negative' ? '负面' : '中性'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{factor.description}</p>
                      {factor.dimension && factor.weight && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">维度: {factor.dimension}</span>
                          <span className="font-medium">权重: {(factor.weight * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPlaceholder 
                  icon={<Newspaper className="w-12 h-12" />}
                  title="关键因素"
                  description={isAnalyzing ? "正在识别关键因素..." : "分析后将展示影响态势的关键驱动因素"}
                  isLoading={isAnalyzing}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Scenarios Tab */}
      <TabsContent value="scenarios">
        {scenariosData && scenariosData.length > 0 ? (
          <>
            {/* 概率计算说明 */}
            {completeData?.scenarios?.scenarioProbabilityAnalysis && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">📊 概率计算分析</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-2">
                      <h5 className="font-semibold">历史基准概率 (30%)</h5>
                      <div className="space-y-1 text-muted-foreground">
                        <div className="flex justify-between">
                          <span>乐观</span>
                          <span>{(completeData.scenarios.scenarioProbabilityAnalysis.historicalBaseRate?.optimistic * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>中性</span>
                          <span>{(completeData.scenarios.scenarioProbabilityAnalysis.historicalBaseRate?.neutral * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>悲观</span>
                          <span>{(completeData.scenarios.scenarioProbabilityAnalysis.historicalBaseRate?.pessimistic * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-semibold">当前信号强度 (40%)</h5>
                      <div className="space-y-1 text-muted-foreground">
                        <div className="flex justify-between">
                          <span>信号强度</span>
                          <span>{(completeData.scenarios.scenarioProbabilityAnalysis.currentSignals?.signalStrength * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-green-600">
                          正面: {completeData.scenarios.scenarioProbabilityAnalysis.currentSignals?.positiveSignals?.length || 0} 项
                        </div>
                        <div className="text-red-600">
                          负面: {completeData.scenarios.scenarioProbabilityAnalysis.currentSignals?.negativeSignals?.length || 0} 项
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-semibold">因素趋势 (30%)</h5>
                      <div className="text-muted-foreground">
                        <div className="flex justify-between">
                          <span>趋势方向</span>
                          <span className={
                            completeData.scenarios.scenarioProbabilityAnalysis.factorTrends?.trendDirection === 'positive' ? 'text-green-600' :
                            completeData.scenarios.scenarioProbabilityAnalysis.factorTrends?.trendDirection === 'negative' ? 'text-red-600' : 'text-gray-600'
                          }>
                            {completeData.scenarios.scenarioProbabilityAnalysis.factorTrends?.trendDirection === 'positive' ? '向好' :
                             completeData.scenarios.scenarioProbabilityAnalysis.factorTrends?.trendDirection === 'negative' ? '恶化' : '中性'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>不确定性</span>
                          <span>{completeData.scenarios.scenarioProbabilityAnalysis.factorTrends?.uncertainty === 'high' ? '高' :
                                 completeData.scenarios.scenarioProbabilityAnalysis.factorTrends?.uncertainty === 'medium' ? '中' : '低'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {scenariosData.map((scenario: any, i: number) => (
                <Card key={i} className={`${
                  scenario.type === 'optimistic' ? 'border-green-500/50' :
                  scenario.type === 'pessimistic' ? 'border-red-500/50' : 'border-blue-500/50'
                }`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{scenario.name}</span>
                      <span className="text-2xl font-bold">
                        {(scenario.probability * 100).toFixed(0)}%
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {scenario.type === 'optimistic' ? '🌟 乐观场景' :
                       scenario.type === 'pessimistic' ? '⚠️ 悲观场景' : '➡️ 基准场景'}
                    </CardDescription>
                    {scenario.probabilityReasoning && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                        💡 {scenario.probabilityReasoning}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{scenario.description}</p>
                    
                    {/* 关键影响因素 */}
                    {scenario.driverFactors && scenario.driverFactors.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
                          📊 关键影响因素
                        </h5>
                        <div className="flex flex-wrap gap-1.5">
                          {scenario.driverFactors.map((factor: string, j: number) => (
                            <Badge key={j} variant="outline" className="text-xs">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {scenario.triggers && scenario.triggers.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold mb-2">触发条件</h5>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {scenario.triggers.map((t: string, j: number) => (
                            <li key={j}>• {t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {scenario.predictions && scenario.predictions.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold mb-2">预测结果</h5>
                        <div className="space-y-2">
                          {scenario.predictions.map((p: any, j: number) => (
                            <div key={j} className="flex justify-between text-xs border-b pb-1">
                              <span className="text-muted-foreground">{p.timeframe}</span>
                              <span>{p.result}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 中国市场影响 */}
                    {scenario.impacts && scenario.impacts.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
                          🇨🇳 中国市场影响
                        </h5>
                        <div className="space-y-2">
                          {scenario.impacts.map((imp: any, j: number) => (
                            <div key={j} className="border rounded p-2 text-xs">
                              <div className="flex items-center justify-between font-medium">
                                <span>{imp.market}</span>
                                <span className={
                                  imp.direction === 'up' || imp.direction === 'inflow' ? 'text-green-600' :
                                  imp.direction === 'down' || imp.direction === 'outflow' ? 'text-red-600' : 'text-gray-600'
                                }>
                                  {imp.direction === 'up' ? '↑' : 
                                   imp.direction === 'down' ? '↓' : 
                                   imp.direction === 'inflow' ? '↓流入' :
                                   imp.direction === 'outflow' ? '↑流出' : '→'}
                                  {' '}{imp.magnitude}
                                </span>
                              </div>
                              {imp.confidence && (
                                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                                  <span>置信度:</span>
                                  <span className={
                                    imp.confidence === 'high' ? 'text-green-600' :
                                    imp.confidence === 'medium' ? 'text-yellow-600' : 'text-gray-400'
                                  }>
                                    {imp.confidence === 'high' ? '高' : 
                                     imp.confidence === 'medium' ? '中' : '低'}
                                  </span>
                                </div>
                              )}
                              {imp.reasoning && (
                                <div className="mt-1 text-muted-foreground">
                                  {imp.reasoning}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 场景总结 */}
            {completeData?.scenarios?.scenarioSummary && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>场景总结与建议</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{completeData.scenarios.scenarioSummary}</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12">
              <EmptyPlaceholder 
                icon={<Target className="w-12 h-12" />}
                title="趋势研判"
                description={isAnalyzing ? "正在进行多场景模拟..." : "分析后将根据实际情况生成多个可能的发展场景"}
                isLoading={isAnalyzing}
              />
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
