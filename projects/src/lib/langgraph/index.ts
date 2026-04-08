/**
 * LangGraph 智能体系统导出
 */

export * from './state';
export * from './nodes';
export * from './graph';

// 五层架构新增模块（选择性导出，避免与 state.ts 冲突）
export { 
  IntelligentBase,
  BlackboardSystem,
  EventBus,
  Commander,
  DynamicPropagationDiscovery,  // 替换 RiskPropagationLibrary
  CausalReasoningEngine,
  CausalPatternLibrary,
  FEMA_LIBRARY,
  createIntelligentBase,
  type BlackboardItem,
  type Event,
  type EventType,
  type EventListener,
  type CausalPattern,
  type FEMAMode,
  type HistoricalPropagationCase
} from './intelligent-base';

export {
  LayerScheduler,
  createLayerScheduler,
  EXECUTION_STRATEGIES,
  LAYER_AGENTS,
  type ExecutionStrategy,
  type AgentNodeFunction,
  type SchedulerCallbacks,
  type LayerExecutionResult
} from './layer-scheduler';

// 智能调度器（v1.5新增）
export {
  IntelligentScheduler,
  type SchedulingDecision,
  type AgentDependencyGraph,
  type ExecutionPlan,
  type SchedulerConfig
} from './intelligent-scheduler';

// 智能体配置（v1.5新增，用于UI显示）
export {
  SCHEDULER_CONFIG,
  AGENT_LAYERS,
  AGENT_ID_MAPPING,
  ALL_AGENTS,
  getCanonicalAgentId,
  getAgentDisplayConfig,
  getLayerAgents,
  SCHEDULER_CONFIG_TYPE,
  AGENT_LAYER_TYPE,
  AGENT_DISPLAY_CONFIG_TYPE,
  type AgentLayerId,
  type AgentConfig,
  type SchedulerConfig as SchedulerConfigType
} from './agent-config';

// 领域适配系统
export {
  DomainAdapterManager,
  domainManager,
  FINANCE_DOMAIN,
  GEOPOLITICS_DOMAIN,
  EVENT_ANALYSIS_SCENARIO,
  TREND_PREDICTION_SCENARIO,
  type DomainType,
  type ScenarioType,
  type DomainConfig,
  type ScenarioConfig,
  type DomainCausalPattern,
  type DomainRiskPath,
  type DomainIndicator,
  type AgentEnhancement,
  type PromptTemplate,
  type OutputFormatConfig,
  type QualityStandard
} from './domain-config';

// 智能体工厂
export {
  AgentFactory,
  AgentOrchestrator,
  createAgentFactory,
  createAgentOrchestrator,
  type AgentNodeFunction as FactoryAgentNodeFunction,
  type AgentExecutionContext,
  type DynamicAgentConfig
} from './agent-factory';

// 进化体层 - 复盘进化能力
export {
  CaseMemoryStore,
  caseMemoryStore,
  type AnalysisCase,
  type CaseFeedback,
  type ReviewResult,
  type OptimizationResult
} from './case-memory-store';

export {
  memoryAgentNode,
  reviewAgentNode,
  rlTrainerNode,
  type EvolutionLayerOutput,
  type SimilarCaseResult
} from './evolution-nodes';

// 人格智能体系统
export {
  personaAgentNode,
  createLLMClientForPersona,
  getPersonaById,
  getAllPersonas,
  type PersonaProfile,
  type PersonaDecision
} from './persona-system';

// 博弈仿真引擎
export {
  GameSimulationEngine,
  createGameSimulationEngine,
  quickSimulate,
  simulateFedRateHike,
  simulateGeopoliticalCrisis,
  simulateTradeTension
} from './game-simulation-engine';

// 交互式探秘分析
export {
  ExploratoryAnalysisEngine,
  createExploratoryEngine,
  quickExplore,
  type Hypothesis,
  type Evidence,
  type CausalChain,
  type ExplorationSession,
  type ExplorationPath,
  type HypothesisStatus,
  type EvidenceType
} from './exploratory-analysis';

// 假设验证沙盒
export {
  HypothesisSandbox,
  createHypothesisSandbox,
  type SandboxHypothesis,
  type SandboxEvidence,
  type EvidenceInput,
  type SandboxConfig,
  type SandboxState,
  type ComparisonMatrix
} from './hypothesis-sandbox';

// 事件驱动推演
export {
  EventDrivenSimulationEngine,
  createEventDrivenSimulationEngine,
  quickSimulate as quickEventSimulate,
  type KeyFigure,
  type RecentEvent,
  type SimulatedDecision,
  type EventSimulationResult,
  type SimulationConfig
} from './event-driven-simulation';
