'use client';

import { useEffect, memo, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
  NodeProps,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  ExternalLink,
  Clock,
  Newspaper,
  Zap,
  Target,
  AlertTriangle,
  X,
  ChevronRight,
  Bot,
  Search,
  Brain,
  TrendingUp,
  GitBranch,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Users,
  Lightbulb,
  Shield,
  Compass,
  ListTodo,
  AlertOctagon,
  Activity,
  Database,
  RefreshCw,
  Scale,
  MapPin,
  Share2
} from 'lucide-react';

/**
 * 五层架构智能体配置
 * 
 * 设计原则：
 * 1. 调度器独立于智能体之外，负责协调所有智能体
 * 2. 只显示真正执行的智能体，不显示兼容ID
 * 3. 所有智能体使用统一的深灰色，与数据节点区分
 */
import { 
  AGENT_LAYERS, 
  SCHEDULER_CONFIG, 
  getAgentDisplayConfig,
  getCanonicalAgentId,
  ALL_AGENTS
} from '@/lib/langgraph/agent-config';

/**
 * 智能体节点状态类型
 */
type AgentStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'error';

interface EventGraphProps {
  topic: string;
  analysisData: any;
  graphData?: any;
}

// ==================== 统一的信息源节点 ====================
// 数据节点使用较浅的颜色（亮度 55%），与智能体（亮度 45%）区分
const SourceNode = memo(({ data }: NodeProps) => {
  // 可信度等级显示 - 明确标注含义
  const credibilityColor = data.credibility >= 4 ? 'text-green-200' : 
                           data.credibility >= 3 ? 'text-yellow-200' : 'text-red-200';
  const credibilityLabel = data.credibility >= 4 ? '可信度高' : 
                           data.credibility >= 3 ? '可信度中' : '待验证';
  
  return (
    <div className="px-3 py-2 rounded-lg bg-[#5c6bc0] text-white shadow-md w-[240px] cursor-pointer text-xs border-l-4 border-[#7986cb]">
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
      
      <div className="font-medium truncate mb-1" title={data.title}>
        {data.label || data.title?.substring(0, 25) || '信息源'}
      </div>
      
      <div className="flex items-center justify-between text-[10px] opacity-90 mb-1">
        {data.siteName ? (
          <span className="truncate flex-1" title={data.siteName}>{data.siteName}</span>
        ) : (
          <span className="truncate flex-1 opacity-70">网络来源</span>
        )}
        <span className={`ml-2 px-1.5 py-0.5 rounded bg-white/15 ${credibilityColor}`} title="信息来源可信度评估">
          {credibilityLabel}
        </span>
      </div>
      
      {data.publishTime && (
        <div className="text-[10px] opacity-75 flex items-center gap-1 mb-1">
          <Clock className="w-3 h-3" />
          {data.publishTime.substring(0, 10)}
        </div>
      )}
      
      {data.snippet && (
        <div className="text-[10px] opacity-80 line-clamp-2" title={data.snippet}>
          {data.snippet.substring(0, 60)}...
        </div>
      )}
      
      {data.url && (
        <a 
          href={data.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-1.5 text-[10px] text-blue-200 hover:text-white flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          查看原文 <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
});
SourceNode.displayName = 'SourceNode';

// ==================== 核心事件节点 ====================
const CoreEventNode = memo(({ data, onClick }: NodeProps & { onClick?: () => void }) => {
  return (
    <div 
      className="px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg w-[280px] cursor-pointer border-2 border-white/30 hover:border-white/60 transition-all hover:scale-105"
      onClick={onClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-white !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-white !w-3 !h-3" />
      
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider opacity-90 mb-1">核心事件</div>
        <div className="font-bold text-sm">{data.description || data.title}</div>
        {data.sourceCount && (
          <div className="mt-2 text-xs opacity-80">
            基于 {data.sourceCount} 条实时信息
          </div>
        )}
        <div className="mt-2 text-xs text-purple-200 flex items-center justify-center gap-1">
          点击查看详情 <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
});
CoreEventNode.displayName = 'CoreEventNode';

// ==================== 因素节点 ====================
const FactorNode = memo(({ data }: NodeProps) => {
  const impactColor = data.impact === 'positive' ? 'text-green-200' : 
                      data.impact === 'negative' ? 'text-red-200' : 'text-yellow-200';
  const impactLabel = data.impact === 'positive' ? '正面影响' : 
                      data.impact === 'negative' ? '负面影响' : '中性影响';
  
  return (
    <div className="px-3 py-2 rounded-lg bg-[#00acc1] text-white shadow-md w-[200px] cursor-pointer text-xs border-l-4 border-[#26c6da]">
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
      
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold">{data.label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/15 ${impactColor}`} title="因素影响方向">
          {impactLabel}
        </span>
      </div>
      <div className="text-[10px] opacity-85 line-clamp-2">{data.description}</div>
      {data.weight && (
        <div className="mt-1 text-[10px] opacity-70">权重: {(data.weight * 100).toFixed(0)}%</div>
      )}
    </div>
  );
});
FactorNode.displayName = 'FactorNode';

// ==================== 结果节点 ====================
const ResultNode = memo(({ data }: NodeProps) => {
  const probability = data.probability ? (data.probability * 100).toFixed(0) : '?';
  const probColor = data.probability >= 0.6 ? 'text-green-200' : 
                    data.probability >= 0.3 ? 'text-yellow-200' : 'text-red-200';
  const probDesc = data.probability >= 0.6 ? '高概率' : 
                   data.probability >= 0.3 ? '中概率' : '低概率';
  
  return (
    <div className="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md w-[180px] cursor-pointer text-xs">
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      
      <div className="font-medium">{data.label}</div>
      <div className="text-[10px] opacity-90 mt-1">{data.description}</div>
      <div className="mt-1 text-xs font-bold flex items-center justify-between" title="场景发生概率评估">
        <span className="opacity-70">发生概率</span>
        <span className={probColor}>{probability}% ({probDesc})</span>
      </div>
    </div>
  );
});
ResultNode.displayName = 'ResultNode';

// ==================== 时间线节点 ====================
const TimelineNode = memo(({ data }: NodeProps) => {
  // 权重显示 - 明确标注为重要性
  const weightColor = data.weight >= 0.7 ? 'text-red-200' : 
                      data.weight >= 0.4 ? 'text-yellow-200' : 'text-white/70';
  const weightLabel = data.weight >= 0.7 ? '高重要性' : 
                      data.weight >= 0.4 ? '中等重要' : '低重要性';
  
  return (
    <div className="px-3 py-2 rounded-lg bg-[#ff9800] text-white shadow-md w-[220px] cursor-pointer text-xs border-l-4 border-[#ffb74d]">
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
      
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 opacity-80" />
          <span className="font-bold opacity-90">{data.timestamp || data.date || '待定'}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/15 ${weightColor}`} title="事件重要性评估">
          {weightLabel}
        </span>
      </div>
      <div className="font-medium mb-1">{data.label}</div>
      {data.description && (
        <div className="text-[10px] opacity-85 line-clamp-2">{data.description.substring(0, 60)}...</div>
      )}
    </div>
  );
});
TimelineNode.displayName = 'TimelineNode';

// ==================== 因果链节点 ====================
const CausalNode = memo(({ data }: NodeProps) => {
  const confidencePercent = data.confidence ? (data.confidence * 100).toFixed(0) : '?';
  const confidenceColor = data.confidence >= 0.7 ? 'text-green-200' : 
                          data.confidence >= 0.4 ? 'text-yellow-200' : 'text-red-200';
  const confidenceDesc = data.confidence >= 0.7 ? '高置信度' : 
                         data.confidence >= 0.4 ? '中等置信度' : '低置信度';
  
  return (
    <div className="px-3 py-2 rounded-lg bg-[#e53935] text-white shadow-md w-[220px] cursor-pointer text-xs border-l-4 border-[#ef5350]">
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
      
      <div className="flex items-center gap-1 mb-1">
        <Zap className="w-3 h-3 opacity-80" />
        <span className="font-bold">{data.label}</span>
      </div>
      
      <div className="text-[10px] opacity-90 space-y-1">
        <div className="flex items-start gap-1">
          <span className="opacity-70 shrink-0">原因:</span> 
          <span className="line-clamp-1">{data.cause}</span>
        </div>
        <div className="flex items-start gap-1">
          <span className="opacity-70 shrink-0">结果:</span> 
          <span className="line-clamp-1">{data.effect}</span>
        </div>
      </div>
      
      <div className="mt-1.5 text-[10px] flex items-center justify-between" title="因果关系成立的置信度评估">
        <span className="opacity-70">因果置信度</span>
        <span className={`font-bold ${confidenceColor}`}>{confidencePercent}% ({confidenceDesc})</span>
      </div>
    </div>
  );
});
CausalNode.displayName = 'CausalNode';

// ==================== 场景推演节点 ====================
const ScenarioNode = memo(({ data }: NodeProps) => {
  const probabilityPercent = data.probability ? (data.probability * 100).toFixed(0) : '?';
  
  // 基于概率确定颜色（而非乐观/悲观分类）
  const bgColor = data.probability >= 0.5 ? 'bg-[#7b1fa2]' : 
                  data.probability >= 0.3 ? 'bg-[#8e24aa]' : 'bg-[#9c27b0]';
  const borderColor = data.probability >= 0.5 ? 'border-[#ab47bc]' : 
                      data.probability >= 0.3 ? 'border-[#ba68c8]' : 'border-[#ce93d8]';
  const probabilityLabel = data.probability >= 0.5 ? '高概率' : 
                           data.probability >= 0.3 ? '中概率' : '低概率';
  
  return (
    <div className={`px-3 py-2 rounded-lg ${bgColor} text-white shadow-md w-[260px] cursor-pointer text-xs border-l-4 ${borderColor}`}>
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
      
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-sm flex-1 truncate" title={data.label}>{data.label}</span>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-bold ml-2">{probabilityPercent}%</span>
      </div>
      
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-white/15 ${probabilityLabel === '高概率' ? 'text-green-200' : probabilityLabel === '中概率' ? 'text-yellow-200' : 'text-gray-200'}`}>
          {probabilityLabel}
        </span>
      </div>
      
      {data.description && (
        <div className="text-[10px] opacity-85 mb-2 line-clamp-2">{data.description}</div>
      )}
      
      {/* 触发条件 */}
      {data.triggers && data.triggers.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-white/20">
          <div className="text-[10px] font-medium opacity-80 mb-1">触发条件:</div>
          <ul className="text-[10px] opacity-85 space-y-0.5">
            {data.triggers.slice(0, 2).map((trigger: string, i: number) => (
              <li key={i} className="truncate">• {trigger}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* 中国市场影响 */}
      {data.impacts && data.impacts.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-white/20">
          <div className="text-[10px] font-medium opacity-80 mb-1">中国市场影响:</div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {data.impacts.slice(0, 4).map((impact: any, i: number) => (
              <div key={i} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${impact.direction === 'up' ? 'bg-green-300' : impact.direction === 'down' ? 'bg-red-300' : 'bg-gray-300'}`} />
                <span className="truncate opacity-85">{impact.market}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
ScenarioNode.displayName = 'ScenarioNode';

// ==================== 结论输出节点 ====================
ScenarioNode.displayName = 'ScenarioNode';

// ==================== 结论输出节点 ====================
const ConclusionNode = memo(({ data }: NodeProps) => {
  return (
    <div className="px-4 py-3 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xl w-[300px] cursor-pointer text-xs border-2 border-white/40">
      <Handle type="target" position={Position.Left} className="!bg-white !w-3 !h-3" />
      
      <div className="text-center mb-2">
        <div className="text-lg font-bold flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {data.label || '态势结论'}
        </div>
      </div>
      
      {data.mainConclusion && (
        <div className="bg-white/10 rounded p-2 mb-2">
          <div className="text-[11px] leading-relaxed">{data.mainConclusion}</div>
        </div>
      )}
      
      {data.probabilityDistribution && (
        <div className="mb-2">
          <div className="text-[10px] font-medium text-white/80 mb-1">概率分布</div>
          <div className="text-[10px]">{data.probabilityDistribution}</div>
        </div>
      )}
      
      {data.confidenceLevel && (
        <div className="mb-2 text-[10px]">
          <span className="text-white/80">置信度: </span>
          <span className="font-bold">{data.confidenceLevel}</span>
        </div>
      )}
      
      {data.riskLevel && (
        <div className="mb-2">
          <span className="text-[10px] text-white/80">风险等级: </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            data.riskLevel === '较高' ? 'bg-red-500' : 
            data.riskLevel === '较低' ? 'bg-green-500' : 'bg-yellow-500'
          }`}>
            {data.riskLevel}
          </span>
        </div>
      )}
      
      {data.keyTrends && Array.isArray(data.keyTrends) && data.keyTrends.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] font-medium text-white/80 mb-1">关键趋势</div>
          <ul className="text-[10px] space-y-0.5">
            {data.keyTrends.slice(0, 3).map((trend: string, i: number) => (
              <li key={i} className="truncate">• {trend}</li>
            ))}
          </ul>
        </div>
      )}
      
      {data.earlyWarningIndicators && Array.isArray(data.earlyWarningIndicators) && data.earlyWarningIndicators.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] font-medium text-yellow-200 mb-1">⚠️ 预警指标</div>
          <ul className="text-[10px] space-y-0.5">
            {data.earlyWarningIndicators.slice(0, 3).map((warning: string, i: number) => (
              <li key={i} className="truncate">• {warning}</li>
            ))}
          </ul>
        </div>
      )}
      
      {data.recommendations && Array.isArray(data.recommendations) && data.recommendations.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-green-200 mb-1">💡 建议</div>
          <ul className="text-[10px] space-y-0.5">
            {data.recommendations.slice(0, 2).map((rec: string, i: number) => (
              <li key={i} className="truncate">• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
ConclusionNode.displayName = 'ConclusionNode';

// ==================== 可观测性节点 ====================
const ObservableNode = memo(({ data }: NodeProps) => {
  const statusColor = data.status === '正常' ? 'text-green-400' : 
                      data.status === '警告' ? 'text-yellow-400' : 'text-red-400';
  
  return (
    <div className="px-3 py-2 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md w-[200px] cursor-pointer text-xs border-l-4 border-cyan-400">
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
      
      <div className="flex items-center gap-1 mb-1">
        <Target className="w-3 h-3 text-cyan-300" />
        <span className="font-bold">{data.label}</span>
      </div>
      <div className="text-[10px] opacity-90">
        <div>指标: {data.metric}</div>
        <div className="flex items-center gap-2">
          <span>当前值: {data.currentValue}</span>
          <span className={statusColor}>● {data.status}</span>
        </div>
        <div>阈值: {data.threshold}</div>
        <div>趋势: {data.trend}</div>
      </div>
    </div>
  );
});
ObservableNode.displayName = 'ObservableNode';

// ==================== 智能体节点 ====================
const AgentNode = memo(({ data }: NodeProps) => {
  // 使用新的配置系统，自动处理兼容ID映射
  const config = getAgentDisplayConfig(data.agentId);
  // 根据层级选择图标
  const layerIconMap: Record<string, any> = {
    'perception': Target,
    'cognition': Brain,
    'decision': GitBranch,
    'action': FileText,
    'evolution': Database
  };
  const Icon = layerIconMap[config.layer] || Target;
  
  const statusStyles = {
    pending: 'opacity-50',
    running: 'ring-2 ring-yellow-400 ring-offset-1',
    completed: '',
    skipped: 'opacity-60 border-2 border-dashed border-white/40',
    error: 'ring-2 ring-red-400'
  };
  
  const statusIcons = {
    pending: null,
    running: <Loader2 className="w-3 h-3 animate-spin text-yellow-300" />,
    completed: <CheckCircle2 className="w-3 h-3 text-green-300" />,
    skipped: <span className="text-[10px] text-gray-300">跳过</span>,
    error: <AlertCircle className="w-3 h-3 text-red-300" />
  };
  
  return (
    <div 
      className={`px-3 py-2.5 rounded-lg text-white shadow-md w-[170px] cursor-pointer text-xs ${statusStyles[data.status as AgentStatus] || ''}`}
      style={{ backgroundColor: '#4a5568' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-white !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-white !w-2 !h-2" />
      
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 opacity-90" />
          <span className="font-bold">{config.name}</span>
        </div>
        {statusIcons[data.status as AgentStatus]}
      </div>
      
      <div className="text-[10px] opacity-80">{config.desc}</div>
    </div>
  );
});
AgentNode.displayName = 'AgentNode';

// ==================== 实体节点（用于信息源） ====================
const EntityNode = memo(({ data }: NodeProps) => {
  // 可信度等级显示
  const credibilityColor = data.credibility >= 4 ? 'text-green-200' : 
                           data.credibility >= 3 ? 'text-yellow-200' : 'text-red-200';
  const credibilityLabel = data.credibility >= 4 ? '高可信' : 
                           data.credibility >= 3 ? '中等' : '待验证';
  
  return (
    <div className="px-3 py-2 rounded-lg bg-[#5c6bc0] text-white shadow-md w-[240px] cursor-pointer text-xs border-l-4 border-[#7986cb]">
      <Handle type="target" position={Position.Left} className="!bg-white !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-white !w-2 !h-2" />
      
      <div className="font-medium truncate mb-1" title={data.title}>
        {data.label || data.title?.substring(0, 25) || '信息源'}
      </div>
      
      <div className="flex items-center justify-between text-[10px] opacity-90 mb-1">
        {data.siteName ? (
          <span className="truncate flex-1" title={data.siteName}>{data.siteName}</span>
        ) : (
          <span className="truncate flex-1 opacity-70">网络来源</span>
        )}
        <span className={`ml-2 px-1.5 py-0.5 rounded bg-white/15 ${credibilityColor}`}>
          {credibilityLabel}
        </span>
      </div>
      
      {data.publishTime && (
        <div className="text-[10px] opacity-75 flex items-center gap-1 mb-1">
          <Clock className="w-3 h-3" />
          {data.publishTime.substring(0, 10)}
        </div>
      )}
      
      {data.snippet && (
        <div className="text-[10px] opacity-80 line-clamp-2" title={data.snippet}>
          {data.snippet.substring(0, 60)}...
        </div>
      )}
      
      {data.url && (
        <a 
          href={data.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-1.5 text-[10px] text-blue-200 hover:text-white flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          查看原文 <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
});
EntityNode.displayName = 'EntityNode';

// 在组件外部定义节点类型（常量对象，保持引用稳定）
const nodeTypes = {
  source: SourceNode,
  entity: EntityNode,
  event: CoreEventNode,
  factor: FactorNode,
  result: ResultNode,
  timeline: TimelineNode,
  causal: CausalNode,
  scenario: ScenarioNode,
  conclusion: ConclusionNode,
  agent: AgentNode  // 新增智能体节点类型
};

// 在组件外部定义边类型
const edgeTypes = {};

// 节点类型映射函数
const typeMap: Record<string, string> = {
  'event': 'event',
  'entity': 'entity',
  'factor': 'factor',
  'result': 'result',
  'source': 'source',
  'timeline': 'timeline',
  'causal': 'causal',
  'scenario': 'scenario',
  'conclusion': 'conclusion',
  'agent': 'agent'  // 智能体节点类型映射
};

function mapNodeType(type: string): string {
  return typeMap[type] || 'entity';
}

export default function EventGraph({ topic, analysisData, graphData }: EventGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // 处理节点点击
  const onNodeClick: NodeMouseHandler = (event, node) => {
    setSelectedNode(node);
  };

  // 关闭详情侧边栏
  const closeDetail = () => {
    setSelectedNode(null);
  };

  // 使用useMemo缓存节点和边数据
  const processedData = useMemo(() => {
    // 如果有直接的graphData，优先使用
    if (graphData?.nodes && graphData?.edges) {
      // 直接使用 graphData 中已经布局好的节点和边
      // graph.ts 已经按照 6 层结构进行了正确的布局：
      // 第1层：信息源 → 第2层：时间线 → 第3层：因果链 → 第4层：关键因素 → 第5层：场景推演 → 第6层：结论输出
      
      const layoutNodes: Node[] = graphData.nodes.map((node: any) => ({
        ...node,
        type: mapNodeType(node.type)
      }));

      return { nodes: layoutNodes, edges: graphData.edges };
    }

    return { nodes: [], edges: [] };
  }, [graphData]);

  useEffect(() => {
    if (processedData.nodes.length > 0) {
      setNodes(processedData.nodes);
      setEdges(processedData.edges);
    }
  }, [processedData, setNodes, setEdges]);

  // 如果没有数据，显示空白占位图谱
  const hasData = processedData.nodes.length > 0;

  return (
    <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-gradient-to-l from-slate-50 via-white to-blue-50 relative">
      <ReactFlow
        nodes={hasData ? nodes : []}
        edges={hasData ? edges : []}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-left"
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls className="!bg-white !shadow-lg !border !rounded-lg" />
        <MiniMap 
          className="!bg-white !border !rounded-lg"
          nodeColor={(node) => {
            // 颜色与实际节点一致
            if (node.type === 'source' || node.type === 'entity') return '#5c6bc0';  // 信息源：蓝紫色
            if (node.type === 'timeline') return '#ff9800';  // 时间线：橙色
            if (node.type === 'causal') return '#e53935';    // 因果链：红色
            if (node.type === 'factor') return '#00acc1';    // 关键因素：青色
            if (node.type === 'scenario') return '#7b1fa2';  // 场景推演：紫色
            if (node.type === 'conclusion') return '#db2777'; // 结论输出：粉色
            if (node.type === 'agent') return '#4a5568';     // 智能体：深灰色
            if (node.type === 'event') return '#9333ea';     // 核心事件：紫色渐变
            return '#94a3b8';
          }}
        />
      </ReactFlow>
      
      {/* 图例 - 颜色与实际节点一致 */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg border text-xs">
        <div className="flex flex-wrap gap-2 max-w-[700px]">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: '#5c6bc0'}}></div>信息源</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: '#ff9800'}}></div>时间线</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: '#e53935'}}></div>因果链</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: '#00acc1'}}></div>关键因素</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: '#7b1fa2'}}></div>场景推演</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: '#db2777'}}></div>结论输出</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: '#4a5568'}}></div>智能体</div>
        </div>
      </div>
      
      {/* 空白状态提示 */}
      {!hasData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div className="text-lg font-medium mb-2">事件图谱</div>
            <div className="text-sm">输入分析主题后，图谱将展示完整的因果推演路径</div>
            <div className="mt-4 text-xs opacity-70">
              包含：信息源 → 时间线 → 因果链 → 关键因素 → 场景推演 → 结论输出
            </div>
          </div>
        </div>
      )}
      
      {/* 提示 */}
      <div className="absolute bottom-4 right-4 bg-white p-2 rounded-lg shadow border text-[10px] text-gray-500">
        💡 {hasData ? '点击节点查看详情' : '开始分析以生成事件图谱'}
      </div>
      
      {/* 节点详情侧边栏 */}
      {selectedNode && (
        <div className="absolute right-0 top-0 h-full w-[400px] bg-white shadow-2xl border-l overflow-y-auto z-10">
          <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedNode.type === 'source' && <Newspaper className="w-5 h-5" />}
              {selectedNode.type === 'timeline' && <Clock className="w-5 h-5" />}
              {selectedNode.type === 'causal' && <Zap className="w-5 h-5" />}
              {selectedNode.type === 'scenario' && <Target className="w-5 h-5" />}
              {selectedNode.type === 'factor' && <Newspaper className="w-5 h-5" />}
              {selectedNode.type === 'conclusion' && <AlertTriangle className="w-5 h-5" />}
              <span className="font-bold">
                {selectedNode.type === 'source' && '信息源详情'}
                {selectedNode.type === 'timeline' && '时间线事件'}
                {selectedNode.type === 'causal' && '因果链分析'}
                {selectedNode.type === 'scenario' && '场景推演'}
                {selectedNode.type === 'factor' && '关键因素'}
                {selectedNode.type === 'conclusion' && '态势结论'}
              </span>
            </div>
            <button onClick={closeDetail} className="hover:bg-white/20 p-1 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            {/* 核心事件详情 */}
            {selectedNode.type === 'event' && (
              <>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">事件主题</div>
                  <div className="text-lg font-bold">{selectedNode.data.description || selectedNode.data.title}</div>
                </div>
                
                {selectedNode.data.snippet && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">摘要</div>
                    <div className="text-sm bg-gray-50 p-3 rounded-lg">{selectedNode.data.snippet}</div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">信息来源</div>
                  <div className="text-sm">基于 {selectedNode.data.sourceCount || 0} 条实时信息</div>
                </div>
                
                {/* 显示原始搜索结果 */}
                {graphData?.searchResults && graphData.searchResults.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-2">原始信息列表</div>
                    <div className="space-y-2">
                      {graphData.searchResults.slice(0, 10).map((item: any, i: number) => (
                        <div key={i} className="border rounded-lg p-3 text-sm">
                          <div className="font-medium mb-1 line-clamp-2">{item.title}</div>
                          <div className="text-xs text-gray-500 mb-1">
                            {item.siteName} · {item.publishTime?.substring(0, 10)}
                          </div>
                          {item.snippet && (
                            <div className="text-xs text-gray-600 line-clamp-3 mb-2">{item.snippet}</div>
                          )}
                          {item.url && (
                            <a 
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              查看原文 <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* 时间线事件详情 */}
            {selectedNode.type === 'timeline' && (
              <>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">事件时间</div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    {selectedNode.data.date}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">事件标题</div>
                  <div className="text-base font-medium">{selectedNode.data.label}</div>
                </div>
                
                {selectedNode.data.description && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">事件描述</div>
                    <div className="text-sm bg-gray-50 p-3 rounded-lg">{selectedNode.data.description}</div>
                  </div>
                )}
                
                {selectedNode.data.significance && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">事件意义</div>
                    <div className="text-sm bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
                      {selectedNode.data.significance}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* 因果链详情 */}
            {selectedNode.type === 'causal' && (
              <>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">因素名称</div>
                  <div className="text-lg font-bold">{selectedNode.data.label}</div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">原因</div>
                  <div className="text-sm bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                    {selectedNode.data.cause}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">结果</div>
                  <div className="text-sm bg-orange-50 p-3 rounded-lg border-l-4 border-orange-500">
                    {selectedNode.data.effect}
                  </div>
                </div>
                
                {selectedNode.data.confidence && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">置信度</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 to-pink-500"
                          style={{ width: `${selectedNode.data.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">{(selectedNode.data.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* 场景详情 */}
            {selectedNode.type === 'scenario' && (
              <>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">场景名称</div>
                  <div className="text-lg font-bold">{selectedNode.data.label}</div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">发生概率</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          selectedNode.data.type === 'optimistic' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                          selectedNode.data.type === 'pessimistic' ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                          'bg-gradient-to-r from-slate-500 to-gray-500'
                        }`}
                        style={{ width: `${selectedNode.data.probability * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold">{(selectedNode.data.probability * 100).toFixed(0)}%</span>
                  </div>
                </div>
                
                {selectedNode.data.description && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">场景描述</div>
                    <div className="text-sm bg-gray-50 p-3 rounded-lg">{selectedNode.data.description}</div>
                  </div>
                )}
                
                {selectedNode.data.keyEvents && selectedNode.data.keyEvents.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">关键事件</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {selectedNode.data.keyEvents.map((event: string, i: number) => (
                        <li key={i}>{event}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            
            {/* 关键因素详情 */}
            {selectedNode.type === 'factor' && (
              <>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">因素名称</div>
                  <div className="text-lg font-bold">{selectedNode.data.label}</div>
                </div>
                
                {selectedNode.data.description && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">因素描述</div>
                    <div className="text-sm bg-gray-50 p-3 rounded-lg">{selectedNode.data.description}</div>
                  </div>
                )}
                
                {selectedNode.data.impact && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">影响程度</div>
                    <div className="text-sm">{selectedNode.data.impact}</div>
                  </div>
                )}
                
                {selectedNode.data.trend && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">趋势</div>
                    <div className="text-sm">{selectedNode.data.trend}</div>
                  </div>
                )}
              </>
            )}
            
            {/* 信息源详情 */}
            {selectedNode.type === 'source' && (
              <>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">标题</div>
                  <div className="text-base font-medium">{selectedNode.data.label || selectedNode.data.title}</div>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">来源：</span>
                    <span className="font-medium">{selectedNode.data.siteName || '未知'}</span>
                  </div>
                  {selectedNode.data.publishTime && (
                    <div>
                      <span className="text-gray-500">时间：</span>
                      <span>{selectedNode.data.publishTime.substring(0, 10)}</span>
                    </div>
                  )}
                </div>
                
                {selectedNode.data.snippet && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">摘要</div>
                    <div className="text-sm bg-gray-50 p-3 rounded-lg">{selectedNode.data.snippet}</div>
                  </div>
                )}
                
                {selectedNode.data.url && (
                  <a 
                    href={selectedNode.data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    查看原文 <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </>
            )}
            
            {/* 结论输出详情 */}
            {selectedNode.type === 'conclusion' && (
              <>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">态势结论</div>
                  <div className="text-base font-bold text-pink-600">{selectedNode.data.label}</div>
                </div>
                
                {selectedNode.data.mainConclusion && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">主要结论</div>
                    <div className="text-sm bg-pink-50 p-3 rounded-lg border-l-4 border-pink-500">
                      {selectedNode.data.mainConclusion}
                    </div>
                  </div>
                )}
                
                {selectedNode.data.probabilityDistribution && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">概率分布</div>
                    <div className="text-sm bg-gray-50 p-3 rounded-lg">{selectedNode.data.probabilityDistribution}</div>
                  </div>
                )}
                
                {selectedNode.data.confidenceLevel && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">置信度</div>
                    <div className="text-sm font-bold text-pink-600">{selectedNode.data.confidenceLevel}</div>
                  </div>
                )}
                
                {selectedNode.data.riskLevel && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">风险等级</div>
                    <span className={`text-sm font-bold px-3 py-1 rounded ${
                      selectedNode.data.riskLevel === '较高' ? 'bg-red-100 text-red-700' : 
                      selectedNode.data.riskLevel === '较低' ? 'bg-green-100 text-green-700' : 
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {selectedNode.data.riskLevel}
                    </span>
                  </div>
                )}
                
                {selectedNode.data.keyTrends && selectedNode.data.keyTrends.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">关键趋势</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {selectedNode.data.keyTrends.map((trend: string, i: number) => (
                        <li key={i}>{trend}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedNode.data.earlyWarningIndicators && selectedNode.data.earlyWarningIndicators.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-yellow-600 mb-1">⚠️ 预警指标</div>
                    <ul className="list-disc list-inside text-sm space-y-1 bg-yellow-50 p-3 rounded-lg">
                      {selectedNode.data.earlyWarningIndicators.map((warning: string, i: number) => (
                        <li key={i} className="text-yellow-800">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedNode.data.recommendations && selectedNode.data.recommendations.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-green-600 mb-1">💡 建议</div>
                    <ul className="list-disc list-inside text-sm space-y-1 bg-green-50 p-3 rounded-lg">
                      {selectedNode.data.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="text-green-800">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
