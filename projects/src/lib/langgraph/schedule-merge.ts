import type { AgentSchedule } from './state';
import type { SchedulingDecision } from './intelligent-scheduler';

/**
 * IntelligentScheduler 使用的 ID → 分析图 `isAgentRequired` 所用的节点 ID
 */
const SCHEDULER_ID_TO_GRAPH_IDS: Record<string, string[]> = {
  intent_parser: [],
  scout_cluster: [],
  alert_sentinel: ['quality_evaluator'],
  geo_extractor: ['geo_extractor'],
  event_extractor: ['event_extractor'],
  analyst: ['timeline_analyst', 'causal_analyst'],
  cik_expert: ['knowledge_extractor'],
  validator: ['result_validator'],
  arbitrator: ['result_validator'],
  strategy_planner: [],
  simulation: ['scenario_simulator'],
  sensitivity_analysis: ['sensitivity_analyst'],
  action_advisor: ['action_advisor'],
  instruction_parser: [],
  execution_monitor: [],
  memory_agent: ['knowledge_manager'],
  review_agent: ['review_analyst'],
};

function expandSchedulerIds(agents: string[]): string[] {
  const out = new Set<string>();
  for (const id of agents) {
    const mapped = SCHEDULER_ID_TO_GRAPH_IDS[id];
    if (mapped !== undefined) {
      mapped.forEach((x) => out.add(x));
    } else {
      out.add(id);
    }
  }
  return [...out];
}

/**
 * 将协调器产出的编排与 IntelligentScheduler 的决策合并为最终 `AgentSchedule`。
 */
export function mergeSchedulingIntoAgentSchedule(
  base: AgentSchedule | null | undefined,
  decision: SchedulingDecision
): AgentSchedule {
  const fromDecision = expandSchedulerIds(decision.agentsToExecute || []);
  const required = new Set<string>(base?.requiredAgents || []);
  fromDecision.forEach((id) => required.add(id));

  const core =
    base?.coreObjective ||
    decision.reasoning?.slice(0, 200) ||
    '综合分析';
  const reason = [
    base?.reason,
    decision.reasoning ? `[智能调度] ${decision.reasoning}` : '',
  ]
    .filter(Boolean)
    .join('；');

  return {
    requiredAgents: [...required],
    coreObjective: core,
    keyQuestions: base?.keyQuestions || [],
    analysisPlan: base?.analysisPlan?.length ? base.analysisPlan : decision.estimatedPath || [],
    taskComplexity: base?.taskComplexity || 'moderate',
    reason: reason || '协调器与智能调度合并',
  };
}
