'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Users,
  Calendar,
  GitBranch,
  Target,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Lightbulb,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface KeyFigure {
  id: string;
  name: string;
  role: string;
  country: string;
  relevance: number;
  reasoning: string;
}

interface RecentEvent {
  title: string;
  date: string;
  summary: string;
  impact: string;
  source: string;
}

interface SimulatedDecision {
  figureId: string;
  figureName: string;
  decision: string;
  reasoning: string;
  confidence: number;
  constraints: string[];
}

interface SimulationResult {
  topic: string;
  keyFigures: KeyFigure[];
  recentEvents: RecentEvent[];
  decisions: SimulatedDecision[];
  equilibrium: {
    type: 'stable' | 'unstable' | 'none';
    description: string;
    probability: number;
  };
  scenarios: {
    name: string;
    probability: number;
    description: string;
    chinaImpact: string;
  }[];
  recommendations: string[];
  createdAt: string;
}

// ============================================================================
// Props
// ============================================================================

interface EventSimulationPanelProps {
  topic?: string;
  searchResults?: any[];
  timeline?: any[];
  onSimulationComplete?: (result: SimulationResult) => void;
}

// ============================================================================
// 主组件
// ============================================================================

export function EventSimulationPanel({
  topic,
  searchResults,
  timeline,
  onSimulationComplete
}: EventSimulationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 折叠状态
  const [figuresExpanded, setFiguresExpanded] = useState(true);
  const [eventsExpanded, setEventsExpanded] = useState(true);
  const [decisionsExpanded, setDecisionsExpanded] = useState(true);
  
  // 执行推演
  const runSimulation = useCallback(async () => {
    if (!topic) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          context: {
            searchResults,
            timeline
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
        onSimulationComplete?.(data.data);
      } else {
        setError(data.error || '推演失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '推演失败');
    } finally {
      setLoading(false);
    }
  }, [topic, searchResults, timeline, onSimulationComplete]);
  
  // 渲染关键人物
  const renderKeyFigures = () => (
    <div className="space-y-3">
      {result?.keyFigures.map((figure) => (
        <Card key={figure.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium">{figure.name}</div>
                <div className="text-sm text-muted-foreground">
                  {figure.role} · {figure.country}
                </div>
              </div>
              <Badge variant="outline">
                相关度 {(figure.relevance * 100).toFixed(0)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{figure.reasoning}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
  
  // 渲染近期事件
  const renderRecentEvents = () => (
    <div className="space-y-2">
      {result?.recentEvents.map((event, i) => (
        <Card key={i}>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium text-sm">{event.title}</div>
                <p className="text-xs text-muted-foreground mt-1">{event.summary}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {event.date} · {event.source}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
  
  // 渲染决策模拟
  const renderDecisions = () => (
    <div className="space-y-3">
      {result?.decisions.map((decision) => (
        <Card key={decision.figureId}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{decision.figureName}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  置信度 {(decision.confidence * 100).toFixed(0)}%
                </span>
                <Progress value={decision.confidence * 100} className="w-16 h-2" />
              </div>
            </div>
            <div className="bg-muted/50 rounded p-2 mb-2">
              <p className="text-sm font-medium">{decision.decision}</p>
            </div>
            <p className="text-xs text-muted-foreground">{decision.reasoning}</p>
            {decision.constraints.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {decision.constraints.map((c, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
  
  // 渲染博弈均衡
  const renderEquilibrium = () => {
    if (!result?.equilibrium) return null;
    
    const { equilibrium } = result;
    
    const typeConfig = {
      stable: { icon: CheckCircle2, color: 'text-green-500', label: '稳定均衡' },
      unstable: { icon: AlertCircle, color: 'text-yellow-500', label: '不稳定' },
      none: { icon: AlertCircle, color: 'text-red-500', label: '无均衡' }
    };
    
    const config = typeConfig[equilibrium.type];
    const Icon = config.icon;
    
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            博弈均衡分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <span className="font-medium">{config.label}</span>
            <Badge variant="outline">
              {(equilibrium.probability * 100).toFixed(0)}% 概率
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{equilibrium.description}</p>
        </CardContent>
      </Card>
    );
  };
  
  // 渲染场景
  const renderScenarios = () => (
    <div className="space-y-3">
      {result?.scenarios.map((scenario, i) => {
        const isOptimistic = scenario.name.includes('乐观') || scenario.name.includes('上行');
        const isPessimistic = scenario.name.includes('悲观') || scenario.name.includes('下行');
        
        return (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isOptimistic && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {isPessimistic && <TrendingDown className="h-4 w-4 text-red-500" />}
                  {!isOptimistic && !isPessimistic && <Minus className="h-4 w-4 text-gray-500" />}
                  <span className="font-medium">{scenario.name}</span>
                </div>
                <Badge variant={isOptimistic ? 'default' : isPessimistic ? 'destructive' : 'secondary'}>
                  {(scenario.probability * 100).toFixed(0)}%
                </Badge>
              </div>
              <p className="text-sm mb-2">{scenario.description}</p>
              <div className="bg-muted/50 rounded p-2">
                <span className="text-xs text-muted-foreground">中国影响：</span>
                <span className="text-xs ml-1">{scenario.chinaImpact}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
  
  // 渲染建议
  const renderRecommendations = () => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          策略建议
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {result?.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Target className="h-4 w-4 mt-0.5 text-primary" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
  
  // 空状态
  if (!result && !loading) {
    return (
      <Card className="h-full flex items-center justify-center min-h-[400px]">
        <CardContent className="text-center">
          <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          {topic ? (
            <>
              <p className="text-muted-foreground mb-4">
                点击下方按钮开始事件推演
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                主题：{topic}
              </p>
              <Button onClick={runSimulation}>
                <RefreshCw className="h-4 w-4 mr-2" />
                开始推演
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">
              请先输入分析主题
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // 加载状态
  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center min-h-[400px]">
        <CardContent className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">正在执行事件推演...</p>
          <p className="text-sm text-muted-foreground mt-2">
            识别关键人物 → 注入近期信息 → 模拟决策 → 分析博弈
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // 错误状态
  if (error) {
    return (
      <Card className="h-full flex items-center justify-center min-h-[400px]">
        <CardContent className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={runSimulation}>
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // 结果展示
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="border-b p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">事件驱动推演</h3>
            <p className="text-sm text-muted-foreground">{result?.topic}</p>
          </div>
          <Button variant="outline" size="sm" onClick={runSimulation} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            重新推演
          </Button>
        </div>
      </div>
      
      {/* 主体 */}
      <ScrollArea className="flex-1 min-h-0 p-4">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧 */}
          <div className="space-y-4">
            {/* 关键人物 - 可折叠 */}
            <Collapsible open={figuresExpanded} onOpenChange={setFiguresExpanded}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                  <h4 className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    关键决策者
                    <Badge variant="secondary" className="text-xs">
                      {result?.keyFigures.length || 0}
                    </Badge>
                  </h4>
                  {figuresExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-2">
                {renderKeyFigures()}
              </CollapsibleContent>
            </Collapsible>
            
            {/* 近期事件 - 可折叠 */}
            <Collapsible open={eventsExpanded} onOpenChange={setEventsExpanded}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    近期事件
                    <Badge variant="secondary" className="text-xs">
                      {result?.recentEvents.length || 0}
                    </Badge>
                  </h4>
                  {eventsExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {renderRecentEvents()}
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          {/* 右侧 */}
          <div className="space-y-4">
            {/* 决策模拟 - 可折叠 */}
            <Collapsible open={decisionsExpanded} onOpenChange={setDecisionsExpanded}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                  <h4 className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    决策模拟
                    <Badge variant="secondary" className="text-xs">
                      {result?.decisions.length || 0}
                    </Badge>
                  </h4>
                  {decisionsExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-2">
                {renderDecisions()}
              </CollapsibleContent>
            </Collapsible>
            
            {/* 博弈均衡 */}
            {renderEquilibrium()}
            
            {/* 场景推演 */}
            <div>
              <h4 className="font-medium mb-3">推演场景</h4>
              {renderScenarios()}
            </div>
            
            {/* 建议 */}
            {renderRecommendations()}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
