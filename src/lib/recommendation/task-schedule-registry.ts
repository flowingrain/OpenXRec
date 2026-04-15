/**
 * 任务级固化调度（产品能力）
 *
 * 对特定垂直任务固定「智能体阶段」开关（相似度 / KG / 因果 / 多样性）。
 *
 * 解析优先级（默认不依赖关键词规则）：
 * 1) API / 前端显式 `taskScheduleId`
 * 2) 意图分析智能体在 JSON 中输出的 `taskScheduleId`（与 runIntentAnalyzer 对齐）
 * 3) 可选兜底：`OPENXREC_TASK_SCHEDULE_LEGACY_KEYWORDS=true` 时启用旧版关键词/scenario 匹配
 *
 * 环境：OPENXREC_TASK_SCHEDULE_AUTO=false 时关闭除显式 ID 以外的自动解析。
 */

export type TaskScheduleId =
  | 'book'
  | 'video'
  | 'poi'
  | 'shopping'
  | 'travel'
  | 'learning';

/** 与 AgentRecommendationService 内 RecommendationExecutionPlan 对齐 */
export interface FrozenExecutionPlan {
  complexity: 'simple' | 'moderate' | 'complex';
  useSimilarity: boolean;
  useKnowledgeGraphReasoning: boolean;
  useCausalReasoning: boolean;
  useDiversityOptimizer: boolean;
}

export interface TaskScheduleProfile {
  id: TaskScheduleId;
  /** 展示用 */
  label: string;
  /** 固化后的执行计划 */
  plan: FrozenExecutionPlan;
  /** @deprecated 仅当 OPENXREC_TASK_SCHEDULE_LEGACY_KEYWORDS=true 时使用 */
  matchKeywords?: string[];
  /** @deprecated 仅当 OPENXREC_TASK_SCHEDULE_LEGACY_KEYWORDS=true 时使用 */
  matchScenarioTypes?: string[];
}

/** 关键词匹配时的优先级（先匹配更「垂直」的画像，避免泛词抢命中） */
const PROFILE_ORDER: TaskScheduleId[] = [
  'poi',
  'travel',
  'video',
  'book',
  'learning',
  'shopping',
];

const REGISTRY: Record<TaskScheduleId, TaskScheduleProfile> = {
  book: {
    id: 'book',
    label: '图书/阅读',
    plan: {
      complexity: 'moderate',
      useSimilarity: true,
      useKnowledgeGraphReasoning: true,
      useCausalReasoning: false,
      useDiversityOptimizer: true,
    },
  },
  video: {
    id: 'video',
    label: '影视/视频',
    plan: {
      complexity: 'moderate',
      useSimilarity: true,
      useKnowledgeGraphReasoning: true,
      useCausalReasoning: false,
      useDiversityOptimizer: true,
    },
  },
  poi: {
    id: 'poi',
    label: '地点/选址/到店',
    plan: {
      complexity: 'complex',
      useSimilarity: true,
      useKnowledgeGraphReasoning: true,
      useCausalReasoning: true,
      useDiversityOptimizer: true,
    },
  },
  shopping: {
    id: 'shopping',
    label: '购物/选品',
    plan: {
      complexity: 'moderate',
      useSimilarity: true,
      useKnowledgeGraphReasoning: true,
      useCausalReasoning: false,
      useDiversityOptimizer: true,
    },
  },
  travel: {
    id: 'travel',
    label: '旅游/行程',
    plan: {
      complexity: 'moderate',
      useSimilarity: true,
      useKnowledgeGraphReasoning: true,
      useCausalReasoning: false,
      useDiversityOptimizer: true,
    },
  },
  learning: {
    id: 'learning',
    label: '学习/课程',
    plan: {
      complexity: 'moderate',
      useSimilarity: true,
      useKnowledgeGraphReasoning: true,
      useCausalReasoning: false,
      useDiversityOptimizer: true,
    },
  },
};

export function listTaskScheduleProfiles(): TaskScheduleProfile[] {
  return Object.values(REGISTRY);
}

export function getTaskScheduleProfile(id: string): TaskScheduleProfile | null {
  if (id in REGISTRY) return REGISTRY[id as TaskScheduleId];
  return null;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function isTaskScheduleAutoMatchEnabled(): boolean {
  const v = process.env.OPENXREC_TASK_SCHEDULE_AUTO?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

/** 是否启用旧版关键词/scenario 兜底（默认关闭，由意图智能体主导） */
export function isTaskScheduleLegacyKeywordMatchEnabled(): boolean {
  const v = process.env.OPENXREC_TASK_SCHEDULE_LEGACY_KEYWORDS?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** 归一化意图智能体输出的 taskScheduleId */
export function normalizeAgentTaskScheduleId(raw: unknown): TaskScheduleId | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase();
  if (!s || s === 'null' || s === 'none' || s === 'general' || s === '其他') return undefined;
  if (s in REGISTRY) return s as TaskScheduleId;
  return undefined;
}

export type TaskScheduleResolution = {
  profile: TaskScheduleProfile | null;
  source: 'explicit' | 'agent' | 'keyword' | 'scenario_type' | 'none';
};

/** 旧版兜底用的最小关键词表（仅 LEGACY_KEYWORDS 开启时使用） */
const LEGACY_KEYWORDS: Record<TaskScheduleId, { matchKeywords: string[]; matchScenarioTypes?: string[] }> = {
  poi: {
    matchKeywords: ['选址', '开店', '门店', '商圈'],
    matchScenarioTypes: ['开店'],
  },
  travel: { matchKeywords: ['旅游', '行程', '酒店'], matchScenarioTypes: ['旅游'] },
  video: { matchKeywords: ['视频', '电影', '剧集'], matchScenarioTypes: [] },
  book: { matchKeywords: ['书', '阅读', '小说'], matchScenarioTypes: [] },
  learning: { matchKeywords: ['课程', '教程'], matchScenarioTypes: ['学习'] },
  shopping: { matchKeywords: ['选购', '商品'], matchScenarioTypes: ['购物'] },
};

function tryLegacyKeywordMatch(input: {
  query: string;
  scenario?: string;
  intentScenarioType?: string;
}): TaskScheduleResolution {
  const q = normalize(input.query);
  const scen = input.scenario ? normalize(input.scenario) : '';
  const intentSt = input.intentScenarioType?.trim() || '';

  for (const id of PROFILE_ORDER) {
    const legacy = LEGACY_KEYWORDS[id];
    for (const kw of legacy.matchKeywords) {
      if (q.includes(normalize(kw)) || (scen && scen.includes(normalize(kw)))) {
        return { profile: REGISTRY[id], source: 'keyword' };
      }
    }
  }
  if (intentSt) {
    for (const id of PROFILE_ORDER) {
      const types = LEGACY_KEYWORDS[id].matchScenarioTypes || [];
      for (const t of types) {
        if (intentSt.includes(t) || t.includes(intentSt)) {
          return { profile: REGISTRY[id], source: 'scenario_type' };
        }
      }
    }
  }
  return { profile: null, source: 'none' };
}

/**
 * 解析本次请求应使用的固化调度（若有）。
 */
export function resolveTaskSchedule(input: {
  explicitId?: string;
  /** 意图分析智能体输出的 taskScheduleId（合法枚举或 null） */
  agentSuggestedTaskScheduleId?: string | null;
  query: string;
  scenario?: string;
  intentScenarioType?: string;
}): TaskScheduleResolution {
  const explicit = input.explicitId?.trim();
  if (explicit) {
    const p = getTaskScheduleProfile(explicit);
    if (p) return { profile: p, source: 'explicit' };
  }

  if (!isTaskScheduleAutoMatchEnabled()) {
    return { profile: null, source: 'none' };
  }

  const agentId = normalizeAgentTaskScheduleId(input.agentSuggestedTaskScheduleId);
  if (agentId) {
    return { profile: REGISTRY[agentId], source: 'agent' };
  }

  if (isTaskScheduleLegacyKeywordMatchEnabled()) {
    const legacy = tryLegacyKeywordMatch({
      query: input.query,
      scenario: input.scenario,
      intentScenarioType: input.intentScenarioType,
    });
    if (legacy.profile) return legacy;
  }

  return { profile: null, source: 'none' };
}

/**
 * 将固化计划与全局配置合并（如 skipKnowledgeGraph）。
 */
export function applyConfigToFrozenPlan(
  plan: FrozenExecutionPlan,
  opts: { skipKnowledgeGraph?: boolean }
): FrozenExecutionPlan {
  if (!opts.skipKnowledgeGraph) return { ...plan };
  return {
    ...plan,
    useKnowledgeGraphReasoning: false,
  };
}
