'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Globe,
  Target,
  Lightbulb,
  Newspaper,
  GitBranch,
  Activity,
  Circle,
  TrendingUp,
  Filter,
  ShieldCheck,
  MapPin,
  Clock,
  Save,
  Monitor,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AnalysisState, agentNameMap, layerColorMap, layerBgMap } from '@/app/types';
import { useState } from 'react';

interface AgentProgressProps {
  analysis: AnalysisState;
  currentAgent: string;
  agentOutputs: Record<string, string>;
}

// 五层架构 + 独立调度层 Agent 列表定义
const AGENT_LIST = [
  // ========== 调度层 (Scheduler) - 独立协调器 ==========
  { 
    id: 'intent_parser', 
    name: '意图解析器', 
    description: '理解用户意图、判断任务复杂度、确定执行策略',
    icon: Target,
    layer: '调度层',
    order: 0
  },
  
  // ========== 感知体层 (Perception) ==========
  // 完整链路：采集 → 抽取 → 评估
  { 
    id: 'scout_cluster', 
    name: '侦察兵集群', 
    description: '多源信息采集、实时数据抓取',
    icon: Globe,
    layer: '感知体',
    order: 1
  },
  { 
    id: 'event_extractor', 
    name: '事件抽取器', 
    description: '从非结构化文本中抽取结构化事件',
    icon: Filter,
    layer: '感知体',
    order: 2
  },
  { 
    id: 'quality_evaluator', 
    name: '质量评估器', 
    description: '信息可信度评估、来源可靠性分析',
    icon: ShieldCheck,
    layer: '感知体',
    order: 3
  },
  { 
    id: 'geo_extractor', 
    name: '地理抽取器', 
    description: '地理位置抽取、空间关系分析',
    icon: MapPin,
    layer: '感知体',
    order: 4
  },
  
  // ========== 认知体层 (Cognition) ==========
  // 完整链路：时序 → 因果 → 知识 → 验证
  { 
    id: 'timeline_analyst', 
    name: '时序分析师', 
    description: '事件时间线构建、发展脉络梳理',
    icon: Clock,
    layer: '认知体',
    order: 5
  },
  { 
    id: 'causal_analyst', 
    name: '因果分析师', 
    description: '因果链识别、风险传导路径分析',
    icon: GitBranch,
    layer: '认知体',
    order: 6
  },
  { 
    id: 'knowledge_extractor', 
    name: '知识抽取器', 
    description: '关键因素识别、领域知识提取',
    icon: Lightbulb,
    layer: '认知体',
    order: 7
  },
  { 
    id: 'result_validator', 
    name: '结果验证器', 
    description: '分析结果验证、逻辑一致性检查',
    icon: CheckCircle2,
    layer: '认知体',
    order: 8
  },
  
  // ========== 决策体层 (Decision) ==========
  // 完整链路：推演 → 分析 → 建议
  { 
    id: 'scenario_simulator', 
    name: '场景推演器', 
    description: '多场景模拟、概率预测、路径规划',
    icon: TrendingUp,
    layer: '决策体',
    order: 9
  },
  { 
    id: 'sensitivity_analyst', 
    name: '敏感性分析师', 
    description: '关键变量敏感性、脆弱点识别',
    icon: Activity,
    layer: '决策体',
    order: 10
  },
  { 
    id: 'action_advisor', 
    name: '行动建议器', 
    description: '基于分析结果的策略建议',
    icon: Target,
    layer: '决策体',
    order: 11
  },
  
  // ========== 行动体层 (Action) ==========
  // 完整链路：生成 → 执行 → 控制 → 监控
  { 
    id: 'report_generator', 
    name: '报告生成器', 
    description: '生成结构化报告和分析文档',
    icon: Newspaper,
    layer: '行动体',
    order: 12
  },
  { 
    id: 'document_executor', 
    name: '文档执行器', 
    description: '写入存储（对象存储/数据库）',
    icon: Save,
    layer: '行动体',
    order: 13
  },
  { 
    id: 'quality_controller', 
    name: '质量控制器', 
    description: '风险边界控制、合规性检查、异常拦截',
    icon: AlertCircle,
    layer: '行动体',
    order: 14
  },
  { 
    id: 'execution_monitor', 
    name: '执行监控器', 
    description: '执行状态监控、完整性检查',
    icon: Monitor,
    layer: '行动体',
    order: 15
  },
  
  // ========== 进化体层 (Evolution) ==========
  // 完整链路：存储 → 检索 → 复盘
  { 
    id: 'knowledge_manager', 
    name: '知识管理器', 
    description: '知识图谱维护、案例存储检索',
    icon: Database,
    layer: '进化体',
    order: 16
  },
  { 
    id: 'review_analyst', 
    name: '复盘分析师', 
    description: '分析成败原因、提取经验教训',
    icon: RefreshCw,
    layer: '进化体',
    order: 17
  }
];

// 五层架构 + 独立调度层 层级样式
const getLayerStyle = (layer: string) => {
  const styles: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    '调度层': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300', badge: 'bg-slate-100 text-slate-700' },
    '感知体': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-700' },
    '认知体': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', badge: 'bg-purple-100 text-purple-700' },
    '决策体': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700' },
    '行动体': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', badge: 'bg-green-100 text-green-700' },
    '进化体': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-300', badge: 'bg-pink-100 text-pink-700' },
    // 兼容旧系统
    '协调层': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', badge: 'bg-purple-100 text-purple-700' },
    '感知层': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-700' },
    '认知层': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700' },
    '行动层': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', badge: 'bg-green-100 text-green-700' }
  };
  return styles[layer] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300', badge: 'bg-gray-100 text-gray-700' };
};

export function AgentProgress({ analysis, currentAgent, agentOutputs }: AgentProgressProps) {
  const totalAgents = AGENT_LIST.length;
  
  // 折叠状态：默认折叠（只显示概览）
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 计算已完成的 Agent 数量
  const completedCount = AGENT_LIST.filter(agent => 
    agentOutputs[agent.id] && agentOutputs[agent.id].includes('完成')
  ).length;
  
  // 获取当前 Agent 的顺序
  const currentOrder = AGENT_LIST.find(a => a.id === currentAgent)?.order || 0;
  
  // 是否正在执行
  const isRunning = analysis.stage !== 'complete' && analysis.stage !== 'error' && analysis.stage !== 'idle';

  return (
    <Card className="mb-8 shadow-md overflow-hidden">
      {/* 头部状态栏 */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {analysis.stage === 'complete' ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : analysis.stage === 'error' ? (
              <AlertCircle className="w-8 h-8" />
            ) : (
              <div className="w-8 h-8 rounded-full border-3 border-white border-t-transparent animate-spin" />
            )}
            <div>
              <div className="text-lg font-bold">
                {analysis.stage === 'complete' ? '分析完成' : 
                 analysis.stage === 'error' ? '分析失败' :
                 `${agentNameMap[analysis.stage] || analysis.stage} 正在工作...`}
              </div>
              <div className="text-sm opacity-90">{analysis.message}</div>
            </div>
          </div>
          
          {/* 进度统计 */}
          <div className="text-right">
            <div className="text-2xl font-bold">{completedCount}/{totalAgents}</div>
            <div className="text-xs opacity-80">Agent 完成</div>
          </div>
        </div>
      </div>
      
      <CardContent className="pt-6">
        {/* 工作流概览 - 横向流程图 */}
        <div className="mb-4 p-4 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">工作流程</div>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {AGENT_LIST.map((agent, index) => {
              const isCompleted = agentOutputs[agent.id]?.includes('完成');
              const isActive = currentAgent === agent.id;
              const Icon = agent.icon;
              const style = getLayerStyle(agent.layer);
              
              return (
                <div key={agent.id} className="flex items-center">
                  <div 
                    className={`flex flex-col items-center min-w-[60px] p-2 rounded-lg transition-all ${
                      isActive ? `${style.bg} ${style.border} border-2 scale-110 shadow-md` :
                      isCompleted ? 'bg-green-50 border border-green-200' :
                      'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? `${style.text} animate-pulse` :
                      isCompleted ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {isActive ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <span className={`text-[10px] mt-1 ${
                      isActive ? style.text : 
                      isCompleted ? 'text-green-700 font-medium' : 
                      'text-gray-500'
                    }`}>
                      {agent.name}
                    </span>
                  </div>
                  
                  {/* 连接线 */}
                  {index < AGENT_LIST.length - 1 && (
                    <div className={`w-4 h-0.5 mx-0.5 ${
                      isCompleted ? 'bg-green-400' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* 整体进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">整体进度</span>
            <span className="font-medium">{analysis.progress}%</span>
          </div>
          <Progress value={analysis.progress} className="h-3" />
        </div>
        
        {/* 展开/折叠按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mb-4 text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              收起详细状态
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              展开详细状态
            </>
          )}
        </Button>
        
        {/* Agent 详细状态 - 可折叠 */}
        {isExpanded && (
        <div className="space-y-4">
          {['调度层', '感知体', '认知体', '决策体', '行动体', '进化体'].map(layer => {
            const layerAgents = AGENT_LIST.filter(a => a.layer === layer);
            if (layerAgents.length === 0) return null;
            
            const style = getLayerStyle(layer);
            
            return (
              <div key={layer}>
                <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${style.badge}`}>
                  {layer}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {layerAgents.map(agent => {
                    const isActive = currentAgent === agent.id;
                    const hasOutput = agentOutputs[agent.id] && agentOutputs[agent.id].length > 0;
                    const isCompleted = hasOutput && agentOutputs[agent.id].includes('完成');
                    const Icon = agent.icon;
                    
                    return (
                      <div 
                        key={agent.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isActive 
                            ? `${style.bg} ${style.border} border-2 shadow-md` 
                            : isCompleted 
                              ? 'bg-green-50 border-green-200' 
                              : hasOutput 
                                ? 'bg-blue-50 border-blue-200' 
                                : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* 状态图标 */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isActive 
                              ? `bg-gradient-to-br ${layerColorMap[layer]} text-white animate-pulse shadow` 
                              : isCompleted 
                                ? 'bg-green-500 text-white shadow' 
                                : hasOutput
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isActive ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isCompleted ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : hasOutput ? (
                              <Circle className="w-4 h-4 fill-current" />
                            ) : (
                              <Icon className="w-4 h-4" />
                            )}
                          </div>
                          
                          {/* Agent信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-sm ${
                                isActive ? style.text : 
                                isCompleted ? 'text-green-700' : 
                                hasOutput ? 'text-blue-700' :
                                'text-gray-500'
                              }`}>
                                {agent.name}
                              </span>
                              {isActive && (
                                <Badge className={`${style.badge} text-[9px] animate-pulse`}>
                                  工作中
                                </Badge>
                              )}
                              {isCompleted && (
                                <Badge className="bg-green-100 text-green-700 text-[9px]">
                                  完成
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {agent.description}
                            </p>
                            
                            {/* Agent输出内容（折叠） */}
                            {hasOutput && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  查看输出
                                </summary>
                                <div className="mt-1 p-2 bg-white/80 rounded border text-xs max-h-24 overflow-y-auto">
                                  <pre className="whitespace-pre-wrap font-sans text-gray-700">
                                    {agentOutputs[agent.id]}
                                  </pre>
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {analysis.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{analysis.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
