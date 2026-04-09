# 三层混合架构 - 智能体设计指南

## 一、架构总览

```
┌────────────────────────────────────────────────────────────┐
│                      协调器 Agent                           │
│          (任务理解 → 工作流规划 → 动态调度 → 结果整合)       │
│                                                             │
│  核心能力：                                                  │
│  • 理解用户意图，判断任务复杂度                              │
│  • 动态规划Agent工作流（哪些Agent参与、执行顺序、并行关系）  │
│  • 调度Agent执行任务，处理异常                               │
│  • 整合多个Agent的输出，生成最终结果                         │
└────────────────────────────────────────────────────────────┘
                            ↓ 调度
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   感知层       │   │   认知层       │   │   行动层       │
│  Perception    │   │  Cognition    │   │   Action      │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ 信息搜索Agent  │   │ 因果推理Agent  │   │ 报告生成Agent  │
│ 信源评估Agent  │   │ 场景推演Agent  │   │ 质量检查Agent  │
│ 时间线Agent   │   │ 关键因素Agent  │   │ 可视化Agent    │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

## 二、智能体清单

### 总览表

| 层级 | Agent名称 | 职责 | 输入 | 输出 | 可否并行 |
|------|----------|------|------|------|---------|
| **协调层** | 协调器Agent | 任务理解、工作流规划、调度整合 | 用户查询 | 最终报告 | ❌ 核心 |
| **感知层** | 信息搜索Agent | 多源搜索、信息采集 | 关键词 | 信息列表 | ✅ 可并行 |
| | 信源评估Agent | 可信度评估、信息筛选 | 信息列表 | 评估结果 | ✅ 可并行 |
| | 时间线Agent | 时间排序、事件脉络 | 信息列表 | 时间线 | ❌ 需等待搜索 |
| **认知层** | 因果推理Agent | 构建因果链、识别传导机制 | 时间线 | 因果图谱 | ❌ 核心分析 |
| | 场景推演Agent | 多场景模拟、概率评估 | 因果图谱 | 场景预测 | ✅ 可并行 |
| | 关键因素Agent | 识别关键驱动因素 | 因果图谱 | 因素列表 | ✅ 可并行 |
| **行动层** | 报告生成Agent | 生成结构化报告 | 所有分析结果 | 分析报告 | ❌ 核心 |
| | 质量检查Agent | 审核逻辑、检测矛盾 | 分析报告 | 质量评分 | ✅ 可并行 |
| | 可视化Agent | 生成图谱、图表 | 因果图谱 | 可视化数据 | ✅ 可并行 |

---

## 三、详细设计

### 1️⃣ 协调器Agent (Coordinator Agent)

**定位**：大脑中枢，负责"理解-规划-调度-整合"

#### 核心能力
```typescript
interface CoordinatorCapabilities {
  // 任务理解
  understandTask: (query: string) => {
    intent: string;          // 用户意图
    complexity: 'simple' | 'medium' | 'complex';
    domains: string[];       // 涉及领域（经济、政治、军事等）
    timeScope: string;       // 时间范围
    keyEntities: string[];   // 关键实体
  };
  
  // 工作流规划
  planWorkflow: (task: any) => {
    agents: AgentTask[];     // 需要调用的Agent列表
    parallelGroups: number[][]; // 可并行执行的Agent组
    dependencies: Map<string, string[]>; // Agent间依赖关系
  };
  
  // 动态调度
  scheduleAgents: (workflow: any) => Promise<any>;
  
  // 结果整合
  synthesize: (results: Map<string, any>) => any;
}
```

#### 决策树（根据任务复杂度规划工作流）

```
任务复杂度判断
    │
    ├─ simple (单一事件查询)
    │   └─ 工作流: [搜索Agent] → [报告Agent]
    │
    ├─ medium (趋势分析)
    │   └─ 工作流: [搜索Agent, 信源Agent] → [时间线Agent] 
    │              → [因果Agent] → [报告Agent]
    │
    └─ complex (深度态势分析)
        └─ 工作流: [搜索Agent, 信源Agent] // 并行
                   → [时间线Agent]
                   → [因果Agent]
                   → [场景Agent, 关键因素Agent] // 并行
                   → [报告Agent]
                   → [质量Agent, 可视化Agent] // 并行
```

#### 工具集
```typescript
const coordinatorTools = {
  // 任务分析工具
  analyzeTask: {
    description: "分析任务复杂度和关键实体",
    execute: (query: string) => { ... }
  },
  
  // Agent调度工具
  dispatchAgent: {
    description: "调度指定Agent执行任务",
    parameters: {
      agentId: string,
      task: string,
      input: any
    },
    execute: async (params) => { ... }
  },
  
  // 并行执行工具
  parallelExecute: {
    description: "并行调度多个Agent",
    parameters: {
      agents: Array<{id: string, task: string, input: any}>
    },
    execute: async (params) => { ... }
  }
};
```

---

### 2️⃣ 感知层Agent设计

#### 2.1 信息搜索Agent (Search Agent)

**职责**：多源信息采集

```typescript
class SearchAgent {
  id = 'search';
  layer = 'perception';
  
  // 核心能力
  capabilities = {
    // 多源搜索
    multiSourceSearch: async (keywords: string[]) => {
      const sources = [
        { type: 'news', weight: 0.3 },      // 新闻媒体
        { type: 'official', weight: 0.4 },   // 官方发布
        { type: 'research', weight: 0.2 },   // 研究报告
        { type: 'social', weight: 0.1 }      // 社交媒体
      ];
      
      const results = await Promise.all(
        sources.map(s => this.searchFrom(s.type, keywords))
      );
      
      return this.mergeResults(results);
    },
    
    // 关键词提取与扩展
    expandKeywords: (query: string) => {
      return [
        query,
        ...extractSynonyms(query),
        ...extractRelatedEntities(query),
        ...extractTimeExpressions(query)
      ];
    }
  };
  
  // 工具
  tools = {
    webSearch: {
      description: "网络搜索工具",
      execute: (query: string) => searchClient.search(query)
    },
    newsSearch: {
      description: "新闻搜索工具",
      execute: (query: string) => newsClient.search(query)
    }
  };
  
  // 执行入口
  async execute(query: string): Promise<SearchResult> {
    // 1. 关键词扩展
    const keywords = await this.expandKeywords(query);
    
    // 2. 多源搜索
    const results = await this.multiSourceSearch(keywords);
    
    // 3. 初步去重
    return this.deduplicate(results);
  }
}

interface SearchResult {
  items: Array<{
    title: string;
    content: string;
    source: string;
    url: string;
    timestamp: number;
    type: 'news' | 'official' | 'research' | 'social';
  }>;
  metadata: {
    totalResults: number;
    searchTime: number;
    sourcesUsed: string[];
  };
}
```

#### 2.2 信源评估Agent (Source Evaluator Agent)

**职责**：评估信息可信度，过滤低质量信息

```typescript
class SourceEvaluatorAgent {
  id = 'source_evaluator';
  layer = 'perception';
  
  // 评估维度
  evaluationDimensions = {
    authority: {      // 权威性
      weight: 0.3,
      factors: ['source_reputation', 'author_credibility']
    },
    accuracy: {       // 准确性
      weight: 0.3,
      factors: ['fact_check', 'data_support']
    },
    timeliness: {     // 时效性
      weight: 0.2,
      factors: ['publish_time', 'update_frequency']
    },
    relevance: {      // 相关性
      weight: 0.2,
      factors: ['topic_match', 'context_fit']
    }
  };
  
  async evaluate(searchResults: SearchResult): Promise<EvaluationResult> {
    const evaluations = await Promise.all(
      searchResults.items.map(item => this.evaluateItem(item))
    );
    
    // 过滤低可信度信息
    const filtered = evaluations.filter(e => e.score >= 0.6);
    
    // 按可信度排序
    const sorted = filtered.sort((a, b) => b.score - a.score);
    
    return {
      highQuality: sorted.filter(s => s.score >= 0.8),
      mediumQuality: sorted.filter(s => s.score >= 0.6 && s.score < 0.8),
      filtered: evaluations.filter(e => e.score < 0.6),
      statistics: {
        total: evaluations.length,
        passed: sorted.length,
        avgScore: this.calculateAvgScore(evaluations)
      }
    };
  }
  
  private async evaluateItem(item: any): Promise<ItemEvaluation> {
    // 使用LLM评估
    const prompt = `
      评估以下信息的可信度（0-1分）：
      
      标题：${item.title}
      来源：${item.source}
      内容：${item.content.substring(0, 500)}
      
      请从权威性、准确性、时效性、相关性四个维度评分，并给出总分。
    `;
    
    const evaluation = await this.llmClient.chat(prompt);
    return this.parseEvaluation(evaluation, item);
  }
}
```

#### 2.3 时间线Agent (Timeline Agent)

**职责**：构建事件时间脉络

```typescript
class TimelineAgent {
  id = 'timeline';
  layer = 'perception';
  
  async buildTimeline(evaluatedInfo: EvaluationResult): Promise<Timeline> {
    // 1. 提取时间点
    const events = await this.extractEvents(evaluatedInfo.highQuality);
    
    // 2. 时间排序
    const sorted = events.sort((a, b) => a.timestamp - b.timestamp);
    
    // 3. 事件聚类（将相关事件分组）
    const clusters = this.clusterEvents(sorted);
    
    // 4. 构建时间线
    return {
      events: sorted,
      clusters,
      timeline: this.formatTimeline(clusters),
      keyMoments: this.identifyKeyMoments(sorted)
    };
  }
  
  private async extractEvents(items: any[]): Promise<Event[]> {
    const events = [];
    
    for (const item of items) {
      const prompt = `
        从以下文本中提取关键事件：
        
        ${item.content}
        
        请提取：
        1. 事件名称
        2. 发生时间
        3. 主要参与方
        4. 事件影响
        5. 事件类型（政策/市场/冲突/合作等）
      `;
      
      const extracted = await this.llmClient.chat(prompt);
      events.push(...this.parseEvents(extracted, item.source));
    }
    
    return events;
  }
}

interface Timeline {
  events: Event[];
  clusters: EventCluster[];
  timeline: FormattedTimeline;
  keyMoments: KeyMoment[];
}

interface Event {
  id: string;
  name: string;
  timestamp: number;
  participants: string[];
  impact: string;
  type: 'policy' | 'market' | 'conflict' | 'cooperation' | 'other';
  sources: string[];
  confidence: number;
}
```

---

### 3️⃣ 认知层Agent设计

#### 3.1 因果推理Agent (Causal Inference Agent)

**职责**：构建因果链，识别传导机制

```typescript
class CausalInferenceAgent {
  id = 'causal_inference';
  layer = 'cognition';
  
  async inferCausalChain(timeline: Timeline): Promise<CausalGraph> {
    // 1. 识别因果关系
    const causalRelations = await this.identifyCausalRelations(timeline.events);
    
    // 2. 构建因果图
    const graph = this.buildGraph(causalRelations);
    
    // 3. 识别传导路径
    const paths = this.findTransmissionPaths(graph);
    
    // 4. 计算因果强度
    const weightedGraph = this.calculateCausalStrength(graph);
    
    return {
      nodes: weightedGraph.nodes,
      edges: weightedGraph.edges,
      paths,
      keyDrivers: this.identifyKeyDrivers(weightedGraph),
      vulnerabilities: this.identifyVulnerabilities(weightedGraph)
    };
  }
  
  private async identifyCausalRelations(events: Event[]): Promise<CausalRelation[]> {
    const relations: CausalRelation[] = [];
    
    // 对每对事件分析因果关系
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const relation = await this.analyzeCausalRelation(events[i], events[j]);
        if (relation.strength > 0.5) {
          relations.push(relation);
        }
      }
    }
    
    return relations;
  }
  
  private async analyzeCausalRelation(eventA: Event, eventB: Event): Promise<CausalRelation> {
    const prompt = `
      分析两个事件之间是否存在因果关系：
      
      事件A：${eventA.name}（${new Date(eventA.timestamp).toLocaleDateString()}）
      影响：${eventA.impact}
      
      事件B：${eventB.name}（${new Date(eventB.timestamp).toLocaleDateString()}）
      影响：${eventB.impact}
      
      请判断：
      1. A是否导致B？（因果关系强度0-1）
      2. 因果机制是什么？
      3. 有哪些中间因素？
      4. 是否存在反向因果或第三方因素？
    `;
    
    const analysis = await this.llmClient.chat(prompt);
    return this.parseCausalAnalysis(analysis, eventA, eventB);
  }
}

interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  paths: TransmissionPath[];
  keyDrivers: CausalNode[];
  vulnerabilities: Vulnerability[];
}

interface CausalNode {
  id: string;
  event: Event;
  type: 'root_cause' | 'intermediate' | 'outcome';
  influence: number;  // 影响力分数
}

interface CausalEdge {
  source: string;
  target: string;
  strength: number;   // 因果强度 0-1
  mechanism: string;  // 因果机制
  lag: number;        // 时间滞后（天）
}
```

#### 3.2 场景推演Agent (Scenario Agent)

**职责**：多场景模拟，概率评估

```typescript
class ScenarioAgent {
  id = 'scenario';
  layer = 'cognition';
  
  async simulateScenarios(causalGraph: CausalGraph): Promise<ScenarioAnalysis> {
    // 1. 识别关键不确定性
    const uncertainties = await this.identifyUncertainties(causalGraph);
    
    // 2. 生成场景矩阵
    const scenarios = this.generateScenarios(uncertainties);
    
    // 3. 模拟每个场景
    const simulations = await Promise.all(
      scenarios.map(s => this.simulateScenario(s, causalGraph))
    );
    
    // 4. 概率评估
    const withProbabilities = await this.assessProbabilities(simulations);
    
    return {
      scenarios: withProbabilities,
      recommendedActions: this.recommendActions(withProbabilities),
      riskAssessment: this.assessRisks(withProbabilities)
    };
  }
  
  private generateScenarios(uncertainties: Uncertainty[]): Scenario[] {
    // 使用2x2矩阵生成场景
    const keyUncertainties = uncertainties.slice(0, 2);
    
    return [
      {
        id: 'optimistic',
        name: '乐观场景',
        conditions: [
          { factor: keyUncertainties[0].factor, state: 'positive' },
          { factor: keyUncertainties[1].factor, state: 'positive' }
        ]
      },
      {
        id: 'baseline',
        name: '基准场景',
        conditions: [
          { factor: keyUncertainties[0].factor, state: 'neutral' },
          { factor: keyUncertainties[1].factor, state: 'neutral' }
        ]
      },
      {
        id: 'pessimistic',
        name: '悲观场景',
        conditions: [
          { factor: keyUncertainties[0].factor, state: 'negative' },
          { factor: keyUncertainties[1].factor, state: 'negative' }
        ]
      },
      {
        id: 'mixed',
        name: '混合场景',
        conditions: [
          { factor: keyUncertainties[0].factor, state: 'positive' },
          { factor: keyUncertainties[1].factor, state: 'negative' }
        ]
      }
    ];
  }
  
  private async simulateScenario(scenario: Scenario, graph: CausalGraph): Promise<ScenarioSimulation> {
    const prompt = `
      基于以下因果图谱，模拟在"${scenario.name}"下的可能发展：
      
      场景条件：${JSON.stringify(scenario.conditions)}
      
      因果链：
      ${this.formatCausalGraph(graph)}
      
      请推演：
      1. 未来3个月可能发生的关键事件
      2. 每个事件的发生概率
      3. 对主要利益相关方的影响
      4. 关键转折点
    `;
    
    const simulation = await this.llmClient.chat(prompt);
    return this.parseSimulation(simulation, scenario);
  }
}

interface ScenarioAnalysis {
  scenarios: ScenarioSimulation[];
  recommendedActions: Action[];
  riskAssessment: RiskAssessment;
}

interface ScenarioSimulation {
  scenario: Scenario;
  probability: number;
  timeline: ProjectedEvent[];
  impacts: Impact[];
  keyTurningPoints: TurningPoint[];
}
```

#### 3.3 关键因素Agent (Key Factor Agent)

**职责**：识别关键驱动因素

```typescript
class KeyFactorAgent {
  id = 'key_factor';
  layer = 'cognition';
  
  async identifyKeyFactors(causalGraph: CausalGraph): Promise<KeyFactorAnalysis> {
    // 1. 计算节点影响力
    const influences = this.calculateInfluenceScores(causalGraph);
    
    // 2. 识别关键驱动因素
    const drivers = influences
      .filter(n => n.type === 'root_cause')
      .sort((a, b) => b.influence - a.influence)
      .slice(0, 5);
    
    // 3. 分析可控性
    const withControllability = await this.analyzeControllability(drivers);
    
    // 4. 生成监控建议
    const monitoringPlan = this.generateMonitoringPlan(withControllability);
    
    return {
      keyFactors: withControllability,
      monitoringPlan,
      interventionPoints: this.identifyInterventionPoints(causalGraph)
    };
  }
  
  private calculateInfluenceScores(graph: CausalGraph): InfluenceScore[] {
    const scores: Map<string, number> = new Map();
    
    // 使用PageRank算法计算节点影响力
    graph.nodes.forEach(node => {
      const inLinks = graph.edges.filter(e => e.target === node.id);
      const outLinks = graph.edges.filter(e => e.source === node.id);
      
      const inScore = inLinks.reduce((sum, e) => sum + e.strength, 0);
      const outScore = outLinks.reduce((sum, e) => sum + e.strength, 0);
      
      scores.set(node.id, inScore * 0.6 + outScore * 0.4);
    });
    
    return Array.from(scores.entries()).map(([id, influence]) => ({
      nodeId: id,
      influence,
      type: this.classifyNodeType(id, graph)
    }));
  }
}
```

---

### 4️⃣ 行动层Agent设计

#### 4.1 报告生成Agent (Report Agent)

**职责**：生成结构化分析报告

```typescript
class ReportAgent {
  id = 'report';
  layer = 'action';
  
  async generateReport(analysisResults: {
    timeline: Timeline;
    causalGraph: CausalGraph;
    scenarios: ScenarioAnalysis;
    keyFactors: KeyFactorAnalysis;
  }): Promise<AnalysisReport> {
    // 1. 确定报告结构
    const structure = this.determineStructure(analysisResults);
    
    // 2. 生成各部分内容
    const sections = await this.generateSections(structure, analysisResults);
    
    // 3. 整合报告
    const report = this.assembleReport(sections);
    
    // 4. 添加执行摘要
    report.executiveSummary = await this.generateExecutiveSummary(report);
    
    return report;
  }
  
  private async generateSections(
    structure: ReportStructure,
    results: any
  ): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];
    
    for (const section of structure.sections) {
      const content = await this.generateSectionContent(section, results);
      sections.push({
        id: section.id,
        title: section.title,
        content,
        keyPoints: this.extractKeyPoints(content)
      });
    }
    
    return sections;
  }
  
  private async generateSectionContent(section: any, results: any): Promise<string> {
    const prompt = this.buildPrompt(section, results);
    return await this.llmClient.chat(prompt);
  }
}

interface AnalysisReport {
  id: string;
  title: string;
  timestamp: number;
  executiveSummary: string;
  sections: ReportSection[];
  conclusions: string[];
  recommendations: string[];
  confidence: number;
}

interface ReportSection {
  id: string;
  title: string;
  content: string;
  keyPoints: string[];
}
```

#### 4.2 质量检查Agent (Quality Check Agent)

**职责**：审核分析质量，检测矛盾

```typescript
class QualityCheckAgent {
  id = 'quality_check';
  layer = 'action';
  
  async checkQuality(report: AnalysisReport, analysisResults: any): Promise<QualityReport> {
    // 1. 逻辑一致性检查
    const logicalConsistency = await this.checkLogicalConsistency(report);
    
    // 2. 数据准确性检查
    const dataAccuracy = await this.checkDataAccuracy(report, analysisResults);
    
    // 3. 完整性检查
    const completeness = this.checkCompleteness(report);
    
    // 4. 可信度评估
    const credibility = this.assessCredibility(report, analysisResults);
    
    // 5. 生成改进建议
    const improvements = await this.generateImprovements({
      logicalConsistency,
      dataAccuracy,
      completeness,
      credibility
    });
    
    return {
      overallScore: this.calculateOverallScore({
        logicalConsistency,
        dataAccuracy,
        completeness,
        credibility
      }),
      details: {
        logicalConsistency,
        dataAccuracy,
        completeness,
        credibility
      },
      improvements,
      passed: logicalConsistency.score >= 0.7 && 
              dataAccuracy.score >= 0.8 && 
              completeness.score >= 0.9
    };
  }
  
  private async checkLogicalConsistency(report: AnalysisReport): Promise<CheckResult> {
    const prompt = `
      检查以下分析报告的逻辑一致性：
      
      ${JSON.stringify(report.sections)}
      
      请检查：
      1. 是否存在自相矛盾的陈述？
      2. 因果推理是否合理？
      3. 结论是否由证据支持？
      4. 是否存在逻辑跳跃？
      
      给出一致性评分（0-1）和具体问题列表。
    `;
    
    const result = await this.llmClient.chat(prompt);
    return this.parseCheckResult(result);
  }
}
```

#### 4.3 可视化Agent (Visualization Agent)

**职责**：生成图谱、图表数据

```typescript
class VisualizationAgent {
  id = 'visualization';
  layer = 'action';
  
  async generateVisualizations(causalGraph: CausalGraph): Promise<VisualizationData> {
    return {
      causalNetwork: this.generateCausalNetwork(causalGraph),
      timelineChart: this.generateTimelineChart(causalGraph),
      influenceHeatmap: this.generateInfluenceHeatmap(causalGraph),
      scenarioMatrix: this.generateScenarioMatrix(causalGraph)
    };
  }
  
  private generateCausalNetwork(graph: CausalGraph): NetworkData {
    // 转换为ReactFlow格式
    return {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        data: {
          label: n.event.name,
          type: n.type,
          influence: n.influence
        },
        position: this.calculatePosition(n, graph)
      })),
      edges: graph.edges.map(e => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: e.mechanism,
        animated: e.strength > 0.7,
        style: { stroke: this.getEdgeColor(e.strength) }
      }))
    };
  }
}
```

---

## 四、Agent创建方法

### 方法一：基于TypeScript的类继承

```typescript
// 1. 定义Agent基类
abstract class BaseAgent {
  abstract id: string;
  abstract layer: 'perception' | 'cognition' | 'action';
  abstract name: string;
  
  protected llmClient: LLMClient;
  protected tools: Map<string, Tool> = new Map();
  
  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }
  
  // 注册工具
  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }
  
  // 执行工具
  async executeTool(name: string, params: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return await tool.execute(params);
  }
  
  // 抽象方法：执行任务
  abstract execute(input: any): Promise<any>;
}

// 2. 创建具体Agent
class SearchAgent extends BaseAgent {
  id = 'search';
  layer = 'perception' as const;
  name = '信息搜索Agent';
  
  constructor(llmClient: LLMClient, searchClient: SearchClient) {
    super(llmClient);
    
    // 注册工具
    this.registerTool({
      name: 'web_search',
      description: '网络搜索',
      parameters: { query: 'string' },
      execute: async (params) => {
        return await searchClient.search(params.query);
      }
    });
  }
  
  async execute(input: { query: string }): Promise<SearchResult> {
    const results = await this.executeTool('web_search', { query: input.query });
    return this.processResults(results);
  }
  
  private processResults(raw: any): SearchResult {
    // 处理搜索结果
    return { items: raw, metadata: {} };
  }
}
```

### 方法二：基于Python + CrewAI

```python
from crewai import Agent, Task, Crew, Process
from langchain.tools import Tool

# 1. 定义Agent
searcher = Agent(
    role='信息搜索专家',
    goal='搜索并采集多源信息',
    backstory='专业的信息采集Agent，擅长从多个渠道获取高质量信息',
    tools=[
        Tool(
            name='web_search',
            func=search_web,
            description='搜索网络信息'
        )
    ],
    verbose=True,
    allow_delegation=False
)

evaluator = Agent(
    role='信源评估专家',
    goal='评估信息可信度，过滤低质量信息',
    backstory='专业的信息质量评估Agent，擅长识别虚假信息和低质量来源',
    verbose=True,
    allow_delegation=False
)

# 2. 定义任务
search_task = Task(
    description='搜索关于{topic}的信息',
    agent=searcher,
    expected_output='包含标题、内容、来源的信息列表'
)

evaluate_task = Task(
    description='评估搜索结果的可信度',
    agent=evaluator,
    context=[search_task],  # 依赖搜索任务
    expected_output='按可信度排序的信息列表'
)

# 3. 创建协作团队
crew = Crew(
    agents=[searcher, evaluator],
    tasks=[search_task, evaluate_task],
    process=Process.sequential  # 顺序执行
)

# 4. 执行
result = crew.run(topic='美联储降息')
```

### 方法三：配置驱动创建（推荐）

```yaml
# agents/search.yaml
agent:
  id: search
  name: 信息搜索Agent
  layer: perception
  
  capabilities:
    - multi_source_search
    - keyword_expansion
    - deduplication
  
  tools:
    - name: web_search
      type: coze_search
      config:
        max_results: 20
        
    - name: news_search
      type: coze_news
      config:
        time_range: 7d
  
  prompts:
    keyword_expansion: |
      分析查询并扩展关键词：
      原始查询：{query}
      请提取同义词、相关实体、时间表达式。
    
    result_filter: |
      过滤搜索结果，保留与主题高度相关的内容。
```

```typescript
// Agent工厂
class AgentFactory {
  static async create(configPath: string): Promise<BaseAgent> {
    const config = await loadConfig(configPath);
    
    const agent = new DynamicAgent(config);
    
    // 注册工具
    for (const toolConfig of config.tools) {
      const tool = await ToolFactory.create(toolConfig);
      agent.registerTool(tool);
    }
    
    return agent;
  }
}

// 使用
const searchAgent = await AgentFactory.create('agents/search.yaml');
const result = await searchAgent.execute({ query: '美联储降息' });
```

---

## 五、Agent协作机制

### 1. 协调器调度流程

```typescript
class CoordinatorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent>;
  
  async coordinate(query: string): Promise<any> {
    // 1. 理解任务
    const task = await this.understandTask(query);
    
    // 2. 规划工作流
    const workflow = this.planWorkflow(task);
    
    // 3. 执行工作流
    const results = new Map<string, any>();
    
    for (const stage of workflow.stages) {
      if (stage.parallel) {
        // 并行执行
        const parallelResults = await Promise.all(
          stage.agents.map(a => 
            this.agents.get(a)!.execute(results)
          )
        );
        stage.agents.forEach((a, i) => results.set(a, parallelResults[i]));
      } else {
        // 顺序执行
        for (const agentId of stage.agents) {
          const result = await this.agents.get(agentId)!.execute(results);
          results.set(agentId, result);
        }
      }
    }
    
    // 4. 整合结果
    return this.synthesize(results);
  }
  
  private planWorkflow(task: TaskAnalysis): Workflow {
    if (task.complexity === 'simple') {
      return {
        stages: [
          { agents: ['search'], parallel: false },
          { agents: ['report'], parallel: false }
        ]
      };
    } else if (task.complexity === 'medium') {
      return {
        stages: [
          { agents: ['search', 'source_evaluator'], parallel: true },
          { agents: ['timeline'], parallel: false },
          { agents: ['causal_inference'], parallel: false },
          { agents: ['report'], parallel: false }
        ]
      };
    } else {
      return {
        stages: [
          { agents: ['search', 'source_evaluator'], parallel: true },
          { agents: ['timeline'], parallel: false },
          { agents: ['causal_inference'], parallel: false },
          { agents: ['scenario', 'key_factor'], parallel: true },
          { agents: ['report'], parallel: false },
          { agents: ['quality_check', 'visualization'], parallel: true }
        ]
      };
    }
  }
}
```

### 2. Agent间通信

```typescript
interface AgentMessage {
  from: string;
  to: string | 'broadcast';
  type: 'request' | 'response' | 'notification';
  payload: any;
  timestamp: number;
}

class MessageBus {
  private subscribers: Map<string, Function[]> = new Map();
  
  subscribe(agentId: string, handler: (msg: AgentMessage) => void) {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, []);
    }
    this.subscribers.get(agentId)!.push(handler);
  }
  
  publish(message: AgentMessage) {
    if (message.to === 'broadcast') {
      // 广播给所有Agent
      this.subscribers.forEach((handlers) => {
        handlers.forEach(h => h(message));
      });
    } else {
      // 发送给指定Agent
      const handlers = this.subscribers.get(message.to);
      handlers?.forEach(h => h(message));
    }
  }
}
```

---

## 六、实施路线图

### Phase 1: 核心Agent实现（v0.5）
- [ ] 实现协调器Agent（动态工作流）
- [ ] 实现搜索Agent + 信源评估Agent
- [ ] 实现因果推理Agent
- [ ] 实现报告生成Agent

### Phase 2: 完整三层架构（v0.7）
- [ ] 感知层：时间线Agent
- [ ] 认知层：场景推演Agent + 关键因素Agent
- [ ] 行动层：质量检查Agent + 可视化Agent

### Phase 3: Python后端重构（v0.6）
- [ ] 迁移到Python + CrewAI
- [ ] 实现Agent持久化
- [ ] 实现真正的记忆系统

### Phase 4: 高级特性（v0.8）
- [ ] Agent并行执行
- [ ] Agent自主学习
- [ ] Agent协作优化
