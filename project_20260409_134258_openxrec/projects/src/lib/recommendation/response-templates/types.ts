/**
 * 响应模板系统类型定义
 * 
 * 核心理念：将展示格式与业务逻辑分离，通过模板驱动输出
 */

// ============================================================================
// 核心类型
// ============================================================================

/**
 * 响应模板定义
 */
export interface ResponseTemplate {
  /** 模板唯一标识 */
  id: string;
  
  /** 模板名称 */
  name: string;
  
  /** 模板描述 */
  description: string;
  
  /** 触发条件 */
  triggers: TemplateTriggers;
  
  /** LLM Prompt 模板 */
  promptTemplate: string;
  
  /** 输出结构定义 (JSON Schema) */
  outputSchema: Record<string, any>;
  
  /** 前端渲染配置 */
  renderConfig: RenderConfig;
  
  /** 模板示例 */
  examples: TemplateExample[];
  
  /** 模板元数据 */
  metadata?: {
    version?: string;
    author?: string;
    createdAt?: number;
    updatedAt?: number;
    tags?: string[];
  };
}

/**
 * 模板触发条件
 */
export interface TemplateTriggers {
  /** 匹配的问题模式（支持占位符如 {A}、{B}） */
  queryPatterns?: string[];
  
  /** 匹配的意图类型 */
  intentTypes?: string[];
  
  /** 实体数量约束 */
  entityCount?: {
    min: number;
    max: number;
  };
  
  /** 场景类型约束 */
  scenarioTypes?: string[];
  
  /** 关键词匹配 */
  keywords?: string[];
  
  /** 自定义匹配函数 */
  customMatcher?: string; // 函数名，运行时动态加载
}

/**
 * 前端渲染配置
 */
export interface RenderConfig {
  /** 渲染组件名 */
  component: string;
  
  /** 布局类型 */
  layout: 'card' | 'table' | 'list' | 'comparison' | 'analysis' | 'form' | 'timeline';
  
  /** 样式配置 */
  style?: Record<string, any>;
  
  /** 交互配置 */
  interactions?: {
    expandable?: boolean;
    collapsible?: boolean;
    sortable?: boolean;
    filterable?: boolean;
  };
}

/**
 * 模板示例
 */
export interface TemplateExample {
  /** 输入问题 */
  input: string;
  
  /** 预期输出 */
  output: Record<string, any>;
  
  /** 说明 */
  note?: string;
}

// ============================================================================
// 模板输出类型
// ============================================================================

/**
 * 对比分析输出
 */
export interface ComparisonAnalysisOutput {
  type: 'comparison_analysis';
  
  /** 对比的实体 */
  entities: Array<{
    name: string;
    type?: string;
    pros: string[];
    cons: string[];
    score?: number;
    image?: string;
  }>;
  
  /** 对比维度 */
  dimensions?: Array<{
    name: string;
    values: Record<string, string>;
  }>;
  
  /** 对比摘要 */
  summary: string;
  
  /** 结论 */
  conclusion: string;
  
  /** 推荐建议 */
  recommendation?: {
    preferred?: string;
    reason: string;
    conditions?: Array<{
      condition: string;
      recommendation: string;
    }>;
  };
  
  /** 信息来源 */
  sources: Array<{
    title: string;
    url?: string;
    snippet?: string;
  }>;
}

/**
 * 排序列表输出
 */
export interface RankingListOutput {
  type: 'ranking_list';
  
  /** 分类名称 */
  category: string;
  
  /** 排序项 */
  items: Array<{
    rank: number;
    title: string;
    description?: string;
    score: number;
    maxScore?: number;
    advantages?: string[];
    disadvantages?: string[];
    reasoning?: string;
    targetUsers?: string;
    priceRange?: string;
    image?: string;
    source?: string;
    sourceUrl?: string;
  }>;
  
  /** 对比表格 */
  comparisonTable?: Array<{
    name: string;
    [key: string]: string | number;
  }>;
  
  /** 选择指南 */
  selectionGuide?: {
    highBudget?: string;
    valueForMoney?: string;
    entryLevel?: string;
    custom?: Array<{
      scenario: string;
      recommendation: string;
    }>;
  };
  
  /** 信息来源 */
  sources?: Array<{
    title: string;
    url?: string;
  }>;
}

/**
 * 单一答案输出
 */
export interface SingleAnswerOutput {
  type: 'single_answer';
  
  /** 核心答案 */
  answer: string;
  
  /** 详细解释 */
  explanation?: string;
  
  /** 示例说明 */
  examples?: Array<{
    title: string;
    content: string;
  }>;
  
  /** 相关概念 */
  relatedConcepts?: Array<{
    term: string;
    definition: string;
  }>;
  
  /** 信息来源 */
  sources?: Array<{
    title: string;
    url?: string;
  }>;
}

/**
 * 推荐列表输出
 */
export interface RecommendationItemsOutput {
  type: 'recommendation_items';
  
  /** 推荐项 */
  items: Array<{
    id: string;
    title: string;
    description: string;
    score?: number;
    confidence?: number;
    explanations?: Array<{
      type: string;
      reason: string;
      factors?: Array<{
        name: string;
        value: any;
        importance: number;
      }>;
    }>;
    source?: string;
    sourceUrl?: string;
    image?: string;
    metadata?: Record<string, any>;
  }>;
  
  /** 整体解释 */
  explanation?: string;
  
  /** 策略说明 */
  strategy?: string;
}

/**
 * 追问引导输出
 */
export interface ClarificationOutput {
  type: 'clarification';
  
  /** 追问问题 */
  questions: Array<{
    id: string;
    question: string;
    type: 'single_choice' | 'multiple_choice' | 'text' | 'range' | 'date';
    options?: string[];
    placeholder?: string;
    required: boolean;
    priority: 'high' | 'medium' | 'low';
    defaultValue?: string;
  }>;
  
  /** 已提取的信息 */
  extractedInfo?: string[];
  
  /** 建议的回答方式 */
  suggestedAnswers?: string;
  
  /** 引导说明 */
  guidance?: string;
}

/**
 * 步骤指南输出
 */
export interface StepByStepOutput {
  type: 'step_by_step';
  
  /** 标题 */
  title: string;
  
  /** 步骤列表 */
  steps: Array<{
    number: number;
    title: string;
    description: string;
    tips?: string[];
    warnings?: string[];
    estimatedTime?: string;
  }>;
  
  /** 前置条件 */
  prerequisites?: string[];
  
  /** 注意事项 */
  notes?: string[];
  
  /** 相关资源 */
  resources?: Array<{
    title: string;
    url?: string;
  }>;
}

/**
 * 数据洞察输出
 */
export interface DataInsightOutput {
  type: 'data_insight';
  
  /** 洞察摘要 */
  summary: string;
  
  /** 关键发现 */
  findings: Array<{
    title: string;
    description: string;
    importance: 'high' | 'medium' | 'low';
    data?: Record<string, any>;
  }>;
  
  /** 数据可视化 */
  visualizations?: Array<{
    type: 'chart' | 'table' | 'metric';
    title: string;
    data: Record<string, any>;
  }>;
  
  /** 建议 */
  recommendations?: Array<{
    action: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

// ============================================================================
// 模板匹配结果
// ============================================================================

/**
 * 模板匹配结果
 */
export interface TemplateMatchResult {
  /** 匹配的模板 */
  template: ResponseTemplate;
  
  /** 匹配分数 (0-1) */
  score: number;
  
  /** 匹配详情 */
  details: {
    patternMatched?: string;
    intentMatched?: string;
    entityCountMatched?: boolean;
    keywordsMatched?: string[];
    reason?: string;
  };
}

// ============================================================================
// 模板渲染上下文
// ============================================================================

/**
 * 模板渲染上下文
 */
export interface TemplateRenderContext {
  /** 用户问题 */
  query: string;
  
  /** 意图分析结果 */
  intent: {
    type: string;
    scenarioType?: string;
    confidence: number;
    entities?: Array<{ name: string; type?: string }>;
  };
  
  /** 候选数据 */
  candidates?: any[];
  
  /** 知识库上下文 */
  knowledgeContext?: string;
  
  /** 网页搜索上下文 */
  webContext?: string;
  
  /** 信息来源 */
  sources?: Array<{
    title: string;
    url?: string;
    snippet?: string;
    type: 'knowledge' | 'web';
  }>;
  
  /** 用户偏好 */
  userPreferences?: Record<string, any>;
  
  /** 会话历史 */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

// ============================================================================
// 模板输出联合类型
// ============================================================================

export type TemplateOutput = 
  | ComparisonAnalysisOutput
  | RankingListOutput
  | SingleAnswerOutput
  | RecommendationItemsOutput
  | ClarificationOutput
  | StepByStepOutput
  | DataInsightOutput;

// ============================================================================
// 模板类型枚举
// ============================================================================

export enum TemplateType {
  COMPARISON_ANALYSIS = 'comparison_analysis',
  RANKING_LIST = 'ranking_list',
  SINGLE_ANSWER = 'single_answer',
  RECOMMENDATION_ITEMS = 'recommendation_items',
  CLARIFICATION = 'clarification',
  STEP_BY_STEP = 'step_by_step',
  DATA_INSIGHT = 'data_insight',
}

// ============================================================================
// 默认渲染配置
// ============================================================================

export const DEFAULT_RENDER_CONFIGS: Record<TemplateType, RenderConfig> = {
  [TemplateType.COMPARISON_ANALYSIS]: {
    component: 'ComparisonAnalysisCard',
    layout: 'comparison',
    style: {
      showScoreChart: true,
      showDimensionTable: true,
      expandableDetails: true,
      highlightWinner: true,
    },
  },
  
  [TemplateType.RANKING_LIST]: {
    component: 'RankingListCard',
    layout: 'list',
    style: {
      showScoreBadge: true,
      showComparisonTable: true,
      expandableDetails: false,
      itemsPerPage: 5,
    },
    interactions: {
      sortable: true,
      filterable: true,
    },
  },
  
  [TemplateType.SINGLE_ANSWER]: {
    component: 'AnswerCard',
    layout: 'card',
    style: {
      highlightAnswer: true,
      collapsibleDetails: true,
      showRelatedConcepts: true,
    },
  },
  
  [TemplateType.RECOMMENDATION_ITEMS]: {
    component: 'RecommendationItemsCard',
    layout: 'card',
    style: {
      showExplanations: true,
      showSourceLinks: true,
      gridLayout: false,
    },
    interactions: {
      expandable: true,
    },
  },
  
  [TemplateType.CLARIFICATION]: {
    component: 'ClarificationForm',
    layout: 'form',
    style: {
      showProgress: true,
      allowSkip: true,
      compact: false,
    },
  },
  
  [TemplateType.STEP_BY_STEP]: {
    component: 'StepGuideCard',
    layout: 'timeline',
    style: {
      showEstimatedTime: true,
      showPrerequisites: true,
      collapsibleSteps: true,
    },
  },
  
  [TemplateType.DATA_INSIGHT]: {
    component: 'InsightCard',
    layout: 'analysis',
    style: {
      showCharts: true,
      showMetrics: true,
      highlightFindings: true,
    },
  },
};
