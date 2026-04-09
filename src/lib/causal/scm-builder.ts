/**
 * 结构化因果模型（SCM）构建器
 * 实现因果图构建、结构方程定义、模型验证
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import {
  StructuralCausalModel,
  CausalGraph,
  CausalVariable,
  CausalEdge,
  StructuralEquation,
  CausalDiscoveryResult,
  Confounder,
  VariableType,
  DataType,
} from './types';

// ============================================================================
// SCM构建器类
// ============================================================================

/**
 * 结构化因果模型构建器
 */
export class SCMBuilder {
  private llmClient: LLMClient;
  
  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
  }
  
  // ===========================================================================
  // 主要方法
  // ===========================================================================
  
  /**
   * 从因果发现结果构建SCM
   */
  async buildFromDiscovery(
    discoveryResult: CausalDiscoveryResult,
    options?: {
      domain?: string;
      scenario?: string;
      existingVariables?: CausalVariable[];
    }
  ): Promise<StructuralCausalModel> {
    // 1. 构建变量集合
    const variables = await this.buildVariables(discoveryResult, options?.existingVariables);
    
    // 2. 构建因果边
    const edges = this.buildEdges(discoveryResult, variables);
    
    // 3. 生成结构方程
    const structuralEquations = await this.generateStructuralEquations(variables, edges);
    
    // 4. 区分外生/内生变量
    const { exogenousVariables, endogenousVariables } = this.classifyVariables(variables, edges);
    
    // 5. 构建混杂因素
    const confounders = this.buildConfounders(discoveryResult, variables);
    
    // 6. 生成模型假设
    const assumptions = this.generateAssumptions(variables, edges, confounders);
    
    // 7. 验证模型
    const validation = this.validateModel(variables, edges);
    
    const scm: StructuralCausalModel = {
      id: `scm-${Date.now()}`,
      name: options?.scenario ? `${options.scenario}因果模型` : '结构化因果模型',
      description: options?.scenario,
      domain: options?.domain || 'general',
      variables,
      edges,
      structuralEquations,
      exogenousVariables,
      endogenousVariables,
      confounders,
      assumptions,
      validation,
      createdAt: new Date().toISOString(),
    };
    
    return scm;
  }
  
  /**
   * 从文本直接构建SCM
   */
  async buildFromText(
    text: string,
    domain?: string
  ): Promise<StructuralCausalModel> {
    // 使用LLM直接提取变量和关系
    const extracted = await this.extractSCMFromText(text, domain);
    
    const variables = extracted.variables;
    const edges = extracted.edges;
    const structuralEquations = await this.generateStructuralEquations(variables, edges);
    const { exogenousVariables, endogenousVariables } = this.classifyVariables(variables, edges);
    
    const validation = this.validateModel(variables, edges);
    
    return {
      id: `scm-${Date.now()}`,
      name: '从文本构建的因果模型',
      domain: domain || 'general',
      variables,
      edges,
      structuralEquations,
      exogenousVariables,
      endogenousVariables,
      assumptions: extracted.assumptions,
      validation,
      createdAt: new Date().toISOString(),
    };
  }
  
  // ===========================================================================
  // 变量构建
  // ===========================================================================
  
  /**
   * 构建变量集合
   */
  private async buildVariables(
    discoveryResult: CausalDiscoveryResult,
    existingVariables?: CausalVariable[]
  ): Promise<CausalVariable[]> {
    const variableMap = new Map<string, CausalVariable>();
    
    // 添加已有变量
    if (existingVariables) {
      for (const v of existingVariables) {
        variableMap.set(v.name, v);
      }
    }
    
    // 从发现结果创建变量
    for (const varName of discoveryResult.variables) {
      if (!variableMap.has(varName)) {
        const variable = await this.inferVariableProperties(varName, discoveryResult);
        variableMap.set(varName, variable);
      }
    }
    
    return Array.from(variableMap.values());
  }
  
  /**
   * 推断变量属性
   */
  private async inferVariableProperties(
    varName: string,
    discoveryResult: CausalDiscoveryResult
  ): Promise<CausalVariable> {
    // 确定变量类型
    const isIncoming = discoveryResult.suggestedGraph.edges.some(e => e.to === varName);
    const isOutgoing = discoveryResult.suggestedGraph.edges.some(e => e.from === varName);
    
    let type: VariableType = 'endogenous';
    if (!isIncoming && isOutgoing) {
      type = 'exogenous';
    } else if (!isIncoming && !isOutgoing) {
      type = 'exogenous'; // 孤立节点默认为外生
    }
    
    // 推断数据类型
    const dataType = this.inferDataType(varName);
    
    return {
      id: `var-${varName.replace(/\s+/g, '-').toLowerCase()}`,
      name: varName,
      type,
      dataType,
      observable: true,
      metadata: {
        discoveredAt: new Date().toISOString(),
      },
    };
  }
  
  /**
   * 推断数据类型
   */
  private inferDataType(varName: string): DataType {
    // 基于关键词推断
    const continuousKeywords = ['率', '额', '量', '值', '指数', '价格', '比例', '增长'];
    const discreteKeywords = ['数量', '人数', '次数', '个数'];
    const binaryKeywords = ['是否', '有无', '是否发生', '是否存在'];
    const categoricalKeywords = ['类型', '类别', '等级', '阶段', '状态'];
    
    for (const kw of binaryKeywords) {
      if (varName.includes(kw)) return 'binary';
    }
    for (const kw of categoricalKeywords) {
      if (varName.includes(kw)) return 'categorical';
    }
    for (const kw of discreteKeywords) {
      if (varName.includes(kw)) return 'discrete';
    }
    for (const kw of continuousKeywords) {
      if (varName.includes(kw)) return 'continuous';
    }
    
    return 'continuous'; // 默认连续
  }
  
  // ===========================================================================
  // 边构建
  // ===========================================================================
  
  /**
   * 构建因果边
   */
  private buildEdges(
    discoveryResult: CausalDiscoveryResult,
    variables: CausalVariable[]
  ): CausalEdge[] {
    const variableIds = new Map(variables.map(v => [v.name, v.id]));
    
    return discoveryResult.suggestedGraph.edges.map((edge, index) => {
      const relation = discoveryResult.relations.find(
        r => r.cause === edge.from && r.effect === edge.to
      );
      
      return {
        id: `edge-${index}`,
        cause: variableIds.get(edge.from) || edge.from,
        effect: variableIds.get(edge.to) || edge.to,
        strength: this.inferStrength(relation?.confidence || edge.confidence),
        direction: this.inferDirection(relation),
        effectSize: relation ? this.estimateEffectSize(relation) : 0.5,
        confidence: edge.confidence,
        confidenceLevel: this.getConfidenceLevel(edge.confidence),
        mechanism: relation?.evidence?.[0],
        evidence: relation?.evidence?.map(e => ({
          type: 'literature' as const,
          source: '因果发现',
          description: e,
          supportStrength: 'moderate' as const,
        })) || [],
      };
    });
  }
  
  /**
   * 推断因果强度
   */
  private inferStrength(confidence: number): 'necessary' | 'sufficient' | 'necessary_and_sufficient' | 'contributory' {
    if (confidence >= 0.9) return 'necessary_and_sufficient';
    if (confidence >= 0.75) return 'sufficient';
    if (confidence >= 0.6) return 'necessary';
    return 'contributory';
  }
  
  /**
   * 推断效应方向
   */
  private inferDirection(relation?: { reverseCausality?: { possible: boolean } }): 'positive' | 'negative' | 'nonlinear' | 'conditional' {
    if (!relation) return 'positive';
    return 'positive'; // 简化处理，实际应从文本中推断
  }
  
  /**
   * 估算效应大小
   */
  private estimateEffectSize(relation: { confidence: number }): number {
    // 简化：使用置信度作为效应大小的代理
    return relation.confidence * 0.8;
  }
  
  /**
   * 获取置信度等级
   */
  private getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'speculative' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    if (confidence >= 0.4) return 'low';
    return 'speculative';
  }
  
  // ===========================================================================
  // 结构方程生成
  // ===========================================================================
  
  /**
   * 生成结构方程
   */
  private async generateStructuralEquations(
    variables: CausalVariable[],
    edges: CausalEdge[]
  ): Promise<StructuralEquation[]> {
    const equations: StructuralEquation[] = [];
    
    // 按目标变量分组边
    const incomingEdges = new Map<string, CausalEdge[]>();
    for (const edge of edges) {
      if (!incomingEdges.has(edge.effect)) {
        incomingEdges.set(edge.effect, []);
      }
      incomingEdges.get(edge.effect)!.push(edge);
    }
    
    // 为每个内生变量生成结构方程
    for (const variable of variables) {
      const parents = incomingEdges.get(variable.id) || [];
      
      if (parents.length === 0) {
        // 外生变量：只有噪声项
        equations.push({
          targetVariable: variable.id,
          parentVariables: [],
          functionalForm: 'probabilistic',
          noiseTerm: {
            distribution: 'normal',
            params: { mean: 0, std: 1 },
          },
          description: `${variable.name}为外生变量`,
        });
      } else {
        // 内生变量：生成结构方程
        const equation = await this.generateEquationForVariable(
          variable,
          parents,
          variables
        );
        equations.push(equation);
      }
    }
    
    return equations;
  }
  
  /**
   * 为特定变量生成结构方程
   */
  private async generateEquationForVariable(
    variable: CausalVariable,
    parentEdges: CausalEdge[],
    allVariables: CausalVariable[]
  ): Promise<StructuralEquation> {
    const parentVariables = parentEdges.map(e => e.cause);
    const parentNames = parentEdges.map(e => {
      const parentVar = allVariables.find(v => v.id === e.cause);
      return parentVar?.name || e.cause;
    });
    
    // 使用LLM生成结构方程
    const llmEquation = await this.llmGenerateEquation(variable.name, parentNames);
    
    // 构建系数
    const coefficients: Record<string, number> = {};
    for (const edge of parentEdges) {
      coefficients[edge.cause] = edge.effectSize || 0.5;
    }
    
    return {
      targetVariable: variable.id,
      parentVariables,
      functionalForm: llmEquation.functionalForm || 'linear',
      parameters: {
        coefficients,
        intercept: llmEquation.intercept || 0,
      },
      noiseTerm: {
        distribution: 'normal',
        params: { mean: 0, std: 0.1 },
      },
      description: llmEquation.description,
      llmRule: llmEquation.rule,
    };
  }
  
  /**
   * 使用LLM生成结构方程
   */
  private async llmGenerateEquation(
    targetName: string,
    parentNames: string[]
  ): Promise<{
    functionalForm: 'linear' | 'nonlinear' | 'threshold' | 'probabilistic';
    intercept?: number;
    description?: string;
    rule?: string;
  }> {
    const prompt = `请为变量"${targetName}"生成一个结构方程描述。

原因变量：${parentNames.join('、')}

请输出JSON格式：
{
  "functionalForm": "linear/nonlinear/threshold/probabilistic",
  "description": "方程描述（自然语言）",
  "rule": "推理规则（如何从原因变量计算目标变量）"
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[SCMBuilder] LLM生成方程失败:', error);
    }
    
    // 默认返回
    return {
      functionalForm: 'linear',
      description: `${targetName}由${parentNames.join('、')}线性组合决定`,
      rule: `${targetName} = 线性加权和(${parentNames.join(' + ')}) + 随机噪声`,
    };
  }
  
  // ===========================================================================
  // 变量分类
  // ===========================================================================
  
  /**
   * 分类外生/内生变量
   */
  private classifyVariables(
    variables: CausalVariable[],
    edges: CausalEdge[]
  ): { exogenousVariables: string[]; endogenousVariables: string[] } {
    const hasIncoming = new Set(edges.map(e => e.effect));
    
    const exogenousVariables: string[] = [];
    const endogenousVariables: string[] = [];
    
    for (const variable of variables) {
      if (hasIncoming.has(variable.id)) {
        endogenousVariables.push(variable.id);
      } else {
        exogenousVariables.push(variable.id);
      }
    }
    
    return { exogenousVariables, endogenousVariables };
  }
  
  // ===========================================================================
  // 混杂因素与假设
  // ===========================================================================
  
  /**
   * 构建混杂因素
   */
  private buildConfounders(
    discoveryResult: CausalDiscoveryResult,
    variables: CausalVariable[]
  ): Confounder[] {
    return discoveryResult.confounders.map((name, index) => ({
      id: `confounder-${index}`,
      name,
      affectsPair: ['', ''], // 需要后续填充
      mechanism: '混杂因素影响多个变量',
      observable: false,
      controlMethods: ['stratification', 'regression', 'matching'] as const,
    }));
  }
  
  /**
   * 生成模型假设
   */
  private generateAssumptions(
    variables: CausalVariable[],
    edges: CausalEdge[],
    confounders: Confounder[]
  ): string[] {
    const assumptions: string[] = [];
    
    // 因果充分性
    assumptions.push('因果马尔可夫条件：给定父节点，变量独立于其非后代节点');
    
    // 忠实性
    assumptions.push('忠实性假设：所有条件独立性都由因果图蕴含');
    
    // 无隐藏混杂
    if (confounders.length === 0) {
      assumptions.push('无隐藏混杂假设：所有混杂因素都已识别');
    } else {
      assumptions.push(`存在 ${confounders.length} 个潜在混杂因素需要控制`);
    }
    
    // 可观测性
    const unobservable = variables.filter(v => !v.observable);
    if (unobservable.length > 0) {
      assumptions.push(`存在 ${unobservable.length} 个不可观测变量，可能影响推断准确性`);
    }
    
    // 时序假设
    assumptions.push('时序假设：原因变量在时间上先于结果变量');
    
    return assumptions;
  }
  
  // ===========================================================================
  // 模型验证
  // ===========================================================================
  
  /**
   * 验证模型
   */
  private validateModel(
    variables: CausalVariable[],
    edges: CausalEdge[]
  ): StructuralCausalModel['validation'] {
    const issues: string[] = [];
    
    // 检查是否有孤立节点
    const connectedNodes = new Set([
      ...edges.map(e => e.cause),
      ...edges.map(e => e.effect),
    ]);
    const isolatedNodes = variables.filter(v => !connectedNodes.has(v.id));
    if (isolatedNodes.length > 0) {
      issues.push(`存在 ${isolatedNodes.length} 个孤立节点（无因果连接）`);
    }
    
    // 检查是否有环（DAG检查）
    const cycles = this.detectCycles(variables, edges);
    if (cycles.length > 0) {
      issues.push(`检测到 ${cycles.length} 个环，模型不是有效的DAG`);
    }
    
    // 检查是否有双向边
    const bidirectionalEdges = this.detectBidirectionalEdges(edges);
    if (bidirectionalEdges.length > 0) {
      issues.push(`存在 ${bidirectionalEdges.length} 对双向边，可能存在反馈循环`);
    }
    
    // 检查置信度
    const lowConfidenceEdges = edges.filter(e => e.confidence < 0.5);
    if (lowConfidenceEdges.length > 0) {
      issues.push(`${lowConfidenceEdges.length} 个因果边的置信度低于50%`);
    }
    
    return {
      isValid: cycles.length === 0 && issues.length <= 2,
      issues,
      lastValidated: new Date().toISOString(),
    };
  }
  
  /**
   * 检测环
   */
  private detectCycles(
    variables: CausalVariable[],
    edges: CausalEdge[]
  ): string[][] {
    const cycles: string[][] = [];
    const adjList = new Map<string, string[]>();
    
    // 构建邻接表
    for (const v of variables) {
      adjList.set(v.id, []);
    }
    for (const e of edges) {
      adjList.get(e.cause)?.push(e.effect);
    }
    
    // DFS检测环
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];
    
    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      for (const neighbor of adjList.get(node) || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          // 找到环
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
          return true;
        }
      }
      
      path.pop();
      recursionStack.delete(node);
      return false;
    };
    
    for (const v of variables) {
      if (!visited.has(v.id)) {
        dfs(v.id);
      }
    }
    
    return cycles;
  }
  
  /**
   * 检测双向边
   */
  private detectBidirectionalEdges(edges: CausalEdge[]): Array<[string, string]> {
    const bidirectional: Array<[string, string]> = [];
    const edgeSet = new Set(edges.map(e => `${e.cause}->${e.effect}`));
    
    for (const e of edges) {
      const reverse = `${e.effect}->${e.cause}`;
      if (edgeSet.has(reverse)) {
        bidirectional.push([e.cause, e.effect]);
      }
    }
    
    return bidirectional;
  }
  
  // ===========================================================================
  // LLM直接提取
  // ===========================================================================
  
  /**
   * 使用LLM从文本直接提取SCM
   */
  private async extractSCMFromText(
    text: string,
    domain?: string
  ): Promise<{
    variables: CausalVariable[];
    edges: CausalEdge[];
    assumptions: string[];
  }> {
    const prompt = `请从以下文本中提取结构化因果模型。

文本：
${text.slice(0, 3000)}

领域：${domain || '一般'}

请输出JSON格式：
{
  "variables": [
    {
      "name": "变量名",
      "type": "exogenous/endogenous",
      "dataType": "continuous/discrete/binary/categorical",
      "description": "变量描述"
    }
  ],
  "edges": [
    {
      "cause": "原因变量名",
      "effect": "结果变量名",
      "confidence": 0.8,
      "mechanism": "因果机制描述"
    }
  ],
  "assumptions": ["模型假设1", "模型假设2"]
}`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        const variables: CausalVariable[] = (parsed.variables || []).map((v: any, i: number) => ({
          id: `var-${i}`,
          name: v.name,
          type: v.type || 'endogenous',
          dataType: v.dataType || 'continuous',
          description: v.description,
          observable: true,
        }));
        
        const edges: CausalEdge[] = (parsed.edges || []).map((e: any, i: number) => ({
          id: `edge-${i}`,
          cause: variables.find(v => v.name === e.cause)?.id || e.cause,
          effect: variables.find(v => v.name === e.effect)?.id || e.effect,
          strength: 'contributory' as const,
          direction: 'positive' as const,
          confidence: e.confidence || 0.6,
          confidenceLevel: 'medium' as const,
          mechanism: e.mechanism,
        }));
        
        return {
          variables,
          edges,
          assumptions: parsed.assumptions || [],
        };
      }
    } catch (error) {
      console.error('[SCMBuilder] LLM提取失败:', error);
    }
    
    return { variables: [], edges: [], assumptions: [] };
  }
  
  // ===========================================================================
  // 因果图操作
  // ===========================================================================
  
  /**
   * 从SCM构建因果图
   */
  buildCausalGraph(scm: StructuralCausalModel): CausalGraph {
    const topologicalOrder = this.topologicalSort(scm);
    const statistics = this.computeGraphStatistics(scm);
    
    return {
      id: `graph-${scm.id}`,
      nodes: scm.variables,
      edges: scm.edges,
      topologicalOrder,
      statistics,
    };
  }
  
  /**
   * 拓扑排序
   */
  private topologicalSort(scm: StructuralCausalModel): string[] {
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // 初始化
    for (const v of scm.variables) {
      adjList.set(v.id, []);
      inDegree.set(v.id, 0);
    }
    
    // 构建图
    for (const e of scm.edges) {
      adjList.get(e.cause)?.push(e.effect);
      inDegree.set(e.effect, (inDegree.get(e.effect) || 0) + 1);
    }
    
    // Kahn算法
    const queue: string[] = [];
    const result: string[] = [];
    
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }
    
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      
      for (const neighbor of adjList.get(node) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    return result;
  }
  
  /**
   * 计算图统计
   */
  private computeGraphStatistics(scm: StructuralCausalModel): CausalGraph['statistics'] {
    const nodeCount = scm.variables.length;
    const edgeCount = scm.edges.length;
    
    // 计算入度和出度
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();
    
    for (const v of scm.variables) {
      inDegrees.set(v.id, 0);
      outDegrees.set(v.id, 0);
    }
    
    for (const e of scm.edges) {
      inDegrees.set(e.effect, (inDegrees.get(e.effect) || 0) + 1);
      outDegrees.set(e.cause, (outDegrees.get(e.cause) || 0) + 1);
    }
    
    const avgInDegree = edgeCount / nodeCount;
    const avgOutDegree = edgeCount / nodeCount;
    
    // 最长路径（简化计算）
    const longestPath = this.topologicalSort(scm).length;
    
    // 检测环
    const cycles = this.detectCycles(scm.variables, scm.edges);
    
    return {
      nodeCount,
      edgeCount,
      avgInDegree,
      avgOutDegree,
      longestPath,
      cycles,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建SCM构建器
 */
export function createSCMBuilder(): SCMBuilder {
  return new SCMBuilder();
}
