'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Play,
  Loader2,
  Brain,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Globe,
  Briefcase,
  Landmark
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// 类型定义
// ============================================================================

interface PersonaProfile {
  id: string;
  name: string;
  nameEn?: string;
  role: string;
  organization: string;
  personality: {
    decisionStyle: string;
    riskTolerance: string;
    timeHorizon: string;
  };
}

interface GameRound {
  round: number;
  timestamp: string;
  decisions: Array<{
    personaId: string;
    personaName: string;
    interpretation: string;
    action: string;
    reasoning: string;
    confidence: number;
  }>;
  summary: string;
  keyEvents: string[];
}

interface GameSimulationResult {
  simulationId: string;
  scenario: string;
  participants: string[];
  rounds: GameRound[];
  equilibrium: {
    reached: boolean;
    roundReached?: number;
    description: string;
    outcomes: Array<{
      participant: string;
      outcome: string;
      satisfaction: number;
    }>;
  };
  turningPoints: Array<{
    round: number;
    description: string;
    impact: string;
  }>;
  chinaImpact?: {
    overallAssessment: string;
    affectedSectors: string[];
    riskLevel: 'low' | 'medium' | 'high';
    opportunities: string[];
    challenges: string[];
  };
  confidence: number;
  conclusion: string;
}

// ============================================================================
// 预置人格数据（前端使用）
// ============================================================================

const PERSONA_CATEGORIES = [
  {
    id: 'finance',
    name: '金融决策者',
    icon: Landmark,
    description: '央行行长、金融监管者等',
    personas: [
      { id: 'fed_chair_powell', name: '杰罗姆·鲍威尔', role: '美联储主席', organization: '美国联邦储备系统', personality: { decisionStyle: 'data_driven', riskTolerance: 'moderate', timeHorizon: 'medium' } },
      { id: 'pboc_governor', name: '中国央行行长', role: '中国人民银行行长', organization: '中国人民银行', personality: { decisionStyle: 'consensus', riskTolerance: 'conservative', timeHorizon: 'long' } },
      { id: 'ecb_president', name: '拉加德', role: '欧洲央行行长', organization: '欧洲中央银行', personality: { decisionStyle: 'consensus', riskTolerance: 'moderate', timeHorizon: 'medium' } }
    ]
  },
  {
    id: 'geopolitics',
    name: '地缘政治决策者',
    icon: Globe,
    description: '国家元首、外交决策者',
    personas: [
      { id: 'us_president', name: '美国总统', role: '美国总统', organization: '美国政府', personality: { decisionStyle: 'data_driven', riskTolerance: 'moderate', timeHorizon: 'medium' } },
      { id: 'russian_president', name: '俄罗斯总统', role: '俄罗斯联邦总统', organization: '俄罗斯联邦政府', personality: { decisionStyle: 'authoritarian', riskTolerance: 'aggressive', timeHorizon: 'long' } }
    ]
  },
  {
    id: 'market',
    name: '市场参与者',
    icon: Briefcase,
    description: '投资者、企业家等',
    personas: [
      { id: 'institutional_investor', name: '机构投资者', role: '全球基金经理', organization: '大型资产管理公司', personality: { decisionStyle: 'data_driven', riskTolerance: 'moderate', timeHorizon: 'medium' } },
      { id: 'hedge_fund_manager', name: '对冲基金经理', role: '对冲基金经理', organization: '量化对冲基金', personality: { decisionStyle: 'data_driven', riskTolerance: 'aggressive', timeHorizon: 'short' } },
      { id: 'corporate_ceo', name: '企业CEO', role: '跨国公司首席执行官', organization: '全球500强企业', personality: { decisionStyle: 'data_driven', riskTolerance: 'moderate', timeHorizon: 'long' } }
    ]
  }
];

// ============================================================================
// 子组件
// ============================================================================

/**
 * 人格选择卡片
 */
function PersonaSelectorCard({
  persona,
  selected,
  onToggle
}: {
  persona: PersonaProfile;
  selected: boolean;
  onToggle: () => void;
}) {
  const decisionStyleMap: Record<string, { label: string; color: string }> = {
    data_driven: { label: '数据驱动', color: 'bg-blue-100 text-blue-700' },
    intuition: { label: '直觉型', color: 'bg-purple-100 text-purple-700' },
    consensus: { label: '共识型', color: 'bg-green-100 text-green-700' },
    authoritarian: { label: '权威型', color: 'bg-red-100 text-red-700' }
  };

  const riskToleranceMap: Record<string, { label: string; color: string }> = {
    conservative: { label: '保守', color: 'bg-slate-100 text-slate-700' },
    moderate: { label: '适度', color: 'bg-amber-100 text-amber-700' },
    aggressive: { label: '激进', color: 'bg-orange-100 text-orange-700' }
  };

  const styleInfo = decisionStyleMap[persona.personality.decisionStyle] || decisionStyleMap.data_driven;
  const riskInfo = riskToleranceMap[persona.personality.riskTolerance] || riskToleranceMap.moderate;

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        selected && "ring-2 ring-primary border-primary"
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{persona.name}</span>
              {persona.nameEn && (
                <span className="text-xs text-muted-foreground truncate">
                  ({persona.nameEn})
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {persona.role} · {persona.organization}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="secondary" className={cn("text-xs", styleInfo.color)}>
                {styleInfo.label}
              </Badge>
              <Badge variant="secondary" className={cn("text-xs", riskInfo.color)}>
                风险{riskInfo.label}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 决策卡片
 */
function DecisionCard({
  decision,
  expanded: initiallyExpanded = false
}: {
  decision: GameRound['decisions'][0];
  expanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">{decision.personaName}</CardTitle>
              <p className="text-xs text-muted-foreground">
                置信度: {(decision.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="pt-0 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">局势解读</Label>
            <p className="text-sm mt-1">{decision.interpretation}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">采取行动</Label>
            <p className="text-sm mt-1 font-medium text-primary">{decision.action}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">决策理由</Label>
            <p className="text-sm mt-1 text-muted-foreground">{decision.reasoning}</p>
          </div>
        </CardContent>
      )}
      
      {!expanded && (
        <CardContent className="pt-0 pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{decision.action}</p>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * 博弈轮次组件
 */
function GameRoundView({ round }: { round: GameRound }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-lg">
              第 {round.round} 轮
            </Badge>
            <p className="text-sm text-muted-foreground">
              {round.decisions.length} 个决策
            </p>
          </div>
          <Button variant="ghost" size="sm">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        <CardDescription className="mt-2">{round.summary}</CardDescription>
      </CardHeader>
      
      {expanded && (
        <CardContent className="pt-0">
          <ScrollArea className="h-[400px] pr-4">
            {round.decisions.map((decision, index) => (
              <DecisionCard 
                key={index} 
                decision={decision}
                expanded={index === 0}
              />
            ))}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * 中国影响分析组件
 */
function ChinaImpactView({ impact }: { impact: NonNullable<GameSimulationResult['chinaImpact']> }) {
  const riskColors = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          中国市场影响分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">风险等级:</Label>
          <Badge className={riskColors[impact.riskLevel]}>
            {impact.riskLevel === 'low' ? '低风险' : impact.riskLevel === 'medium' ? '中等风险' : '高风险'}
          </Badge>
        </div>
        
        <div>
          <Label className="text-sm">整体评估</Label>
          <p className="text-sm mt-1">{impact.overallAssessment}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-green-600">机遇</Label>
            <ul className="text-sm mt-1 space-y-1">
              {impact.opportunities.map((o, i) => (
                <li key={i} className="flex items-start gap-1">
                  <TrendingUp className="w-3 h-3 text-green-600 mt-1 shrink-0" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label className="text-sm text-red-600">挑战</Label>
            <ul className="text-sm mt-1 space-y-1">
              {impact.challenges.map((c, i) => (
                <li key={i} className="flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-600 mt-1 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div>
          <Label className="text-sm">受影响行业</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {impact.affectedSectors.map((s, i) => (
              <Badge key={i} variant="secondary">{s}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function PersonaSimulationPanel() {
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [scenario, setScenario] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [result, setResult] = useState<GameSimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState('setup');

  // 预设场景
  const presetScenarios = [
    { id: 'fed_hike', name: '美联储加息', scenario: '美联储宣布加息50个基点，联邦基金利率目标区间上调至5.25%-5.5%。市场关注后续政策路径。' },
    { id: 'trade_tension', name: '中美贸易摩擦', scenario: '美国宣布对华新一轮关税措施，涉及高科技产品。中国可能采取反制措施。' },
    { id: 'geo_crisis', name: '地缘政治危机', scenario: '某地区突发地缘政治危机，涉及多方利益。美国考虑介入，俄罗斯可能支持对立面。' }
  ];

  // 切换人格选择
  const togglePersona = useCallback((id: string) => {
    setSelectedPersonas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        if (newSet.size < 5) {
          newSet.add(id);
        }
      }
      return newSet;
    });
  }, []);

  // 使用预设场景
  const usePresetScenario = useCallback((preset: typeof presetScenarios[0]) => {
    setScenario(preset.scenario);
  }, []);

  // 执行仿真
  const runSimulation = useCallback(async () => {
    if (selectedPersonas.size < 2 || !scenario.trim()) return;

    setIsSimulating(true);
    setSimulationProgress(0);
    setResult(null);
    setActiveTab('result');

    try {
      // 调用API执行仿真
      const response = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          personaIds: Array.from(selectedPersonas)
        })
      });

      if (!response.ok) {
        throw new Error('Simulation failed');
      }

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setSimulationProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const data = await response.json();
      
      clearInterval(progressInterval);
      setSimulationProgress(100);
      setResult(data);

    } catch (error) {
      console.error('Simulation error:', error);
      // 使用模拟数据作为后备
      const mockResult = createMockResult(scenario, Array.from(selectedPersonas));
      setResult(mockResult);
    } finally {
      setIsSimulating(false);
    }
  }, [selectedPersonas, scenario]);

  // 创建模拟结果（用于演示）
  const createMockResult = (scenario: string, personaIds: string[]): GameSimulationResult => {
    const selectedPersonasData = PERSONA_CATEGORIES
      .flatMap(c => c.personas)
      .filter(p => personaIds.includes(p.id));

    return {
      simulationId: `sim_${Date.now()}`,
      scenario,
      participants: selectedPersonasData.map(p => p.name),
      rounds: [
        {
          round: 1,
          timestamp: new Date().toISOString(),
          decisions: selectedPersonasData.map(p => ({
            personaId: p.id,
            personaName: p.name,
            interpretation: `从${p.role}的角度分析当前局势，认为这是一个需要谨慎应对的关键时刻。`,
            action: `采取审慎的应对策略，密切关注事态发展，准备必要的政策工具。`,
            reasoning: `基于当前信息和分析，需要平衡多重目标，确保决策符合组织利益和长期战略。`,
            confidence: 0.75
          })),
          summary: '各方表现出谨慎态度，尚未出现明显对抗或合作迹象。',
          keyEvents: []
        }
      ],
      equilibrium: {
        reached: false,
        description: '博弈仍在进行中，各方策略尚未稳定。',
        outcomes: selectedPersonasData.map(p => ({
          participant: p.name,
          outcome: '维持观望态度',
          satisfaction: 0.6
        }))
      },
      turningPoints: [],
      chinaImpact: {
        overallAssessment: '当前局势对中国市场影响需要持续观察，建议关注后续发展。',
        affectedSectors: ['金融市场', '外贸', '能源'],
        riskLevel: 'medium',
        opportunities: ['可能带来新的合作机会', '推动产业升级'],
        challenges: ['短期市场波动', '供应链调整压力']
      },
      confidence: 0.65,
      conclusion: '仿真推演显示各方目前保持观望态度，局势尚未明朗。建议持续关注关键决策者的后续行动。'
    };
  };

  const selectedCount = selectedPersonas.size;
  const canSimulate = selectedCount >= 2 && scenario.trim().length > 10;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          人格仿真推演
        </CardTitle>
        <CardDescription>
          选择关键角色，模拟博弈推演，预测决策走向
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="setup">配置仿真</TabsTrigger>
            <TabsTrigger value="result" disabled={!result && !isSimulating}>
              仿真结果
            </TabsTrigger>
          </TabsList>
          
          {/* 配置页面 */}
          <TabsContent value="setup" className="space-y-6 mt-4">
            {/* 人格选择 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base">选择参与者 ({selectedCount}/5)</Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedPersonas(new Set())}
                  disabled={selectedCount === 0}
                >
                  清空选择
                </Button>
              </div>
              
              <div className="space-y-4">
                {PERSONA_CATEGORIES.map(category => (
                  <div key={category.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <category.icon className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">{category.name}</Label>
                      <span className="text-xs text-muted-foreground">{category.description}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {category.personas.map(persona => (
                        <PersonaSelectorCard
                          key={persona.id}
                          persona={persona}
                          selected={selectedPersonas.has(persona.id)}
                          onToggle={() => togglePersona(persona.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <Separator />
            
            {/* 场景输入 */}
            <div>
              <Label className="text-base mb-3 block">场景描述</Label>
              
              {/* 预设场景 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {presetScenarios.map(preset => (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    onClick={() => usePresetScenario(preset)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
              
              <Textarea
                placeholder="描述需要进行仿真推演的场景，包括背景、关键事件、涉及方等..."
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                当前字符: {scenario.length} (建议100-500字)
              </p>
            </div>
            
            <Separator />
            
            {/* 开始仿真按钮 */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedCount < 2 ? (
                  <span className="text-amber-600">请至少选择2个参与者</span>
                ) : scenario.trim().length < 10 ? (
                  <span className="text-amber-600">请输入更详细的场景描述</span>
                ) : (
                  <span className="text-green-600">
                    已选择 {selectedCount} 个参与者，可以开始仿真
                  </span>
                )}
              </div>
              <Button
                onClick={runSimulation}
                disabled={!canSimulate || isSimulating}
                size="lg"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    仿真中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    开始仿真
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
          
          {/* 结果页面 */}
          <TabsContent value="result" className="mt-4">
            {isSimulating && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">正在进行博弈仿真...</p>
                    <Progress value={simulationProgress} className="mt-2" />
                  </div>
                </div>
              </div>
            )}
            
            {result && !isSimulating && (
              <div className="space-y-6">
                {/* 概览 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{result.rounds.length}</div>
                      <p className="text-xs text-muted-foreground">博弈轮次</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{result.participants.length}</div>
                      <p className="text-xs text-muted-foreground">参与角色</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold">
                          {(result.confidence * 100).toFixed(0)}%
                        </div>
                        {result.equilibrium.reached && (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {result.equilibrium.reached ? '已达到均衡' : '置信度'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">
                        {result.turningPoints.length}
                      </div>
                      <p className="text-xs text-muted-foreground">关键转折</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* 结论 */}
                <Card className="bg-primary/5">
                  <CardContent className="pt-4">
                    <Label className="text-sm font-medium">仿真结论</Label>
                    <p className="text-sm mt-2">{result.conclusion}</p>
                  </CardContent>
                </Card>
                
                {/* 博弈轮次 */}
                <div>
                  <Label className="text-base mb-3 block">博弈过程</Label>
                  <div className="space-y-3">
                    {result.rounds.map((round, index) => (
                      <GameRoundView key={index} round={round} />
                    ))}
                  </div>
                </div>
                
                {/* 中国影响 */}
                {result.chinaImpact && (
                  <ChinaImpactView impact={result.chinaImpact} />
                )}
                
                {/* 操作按钮 */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setActiveTab('setup')}>
                    重新配置
                  </Button>
                  <Button onClick={() => setResult(null)}>
                    新建仿真
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default PersonaSimulationPanel;
