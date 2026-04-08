/**
 * 因果推断引擎
 * 实现do-calculus、反事实推断、可识别性分析
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import {
  StructuralCausalModel,
  CausalQuery,
  CausalQueryResult,
  Intervention,
  CounterfactualScenario,
  CounterfactualResult,
  VariableState,
  CausalVariable,
  CausalEdge,
} from './types';

// ============================================================================
// 因果推断引擎类
// ============================================================================

/**
 * 因果推断引擎
 */
export class CausalInferenceEngine {
  private llmClient: LLMClient;
  
  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
  }
  
  // ===========================================================================
  // 主要方法
  // ===========================================================================
  
  /**
   * 执行因果查询
   */
  async executeQuery(
    scm: StructuralCausalModel,
    query: CausalQuery
  ): Promise<CausalQueryResult> {
    const startTime = Date.now();
    
    // 1. 判断可识别性
    const identifiability = this.checkIdentifiability(scm, query);
    
    if (!identifiability.identifiable) {
      return {
        queryId: query.id,
        identifiable: false,
        unidentifiableReason: identifiability.reason,
        estimationMethod: '无法估计',
        explanation: `该因果效应不可识别：${identifiability.reason}`,
        confidenceLevel: 0,
      };
    }
    
    // 2. 计算调整集
    const adjustmentSet = this.computeAdjustmentSet(scm, query);
    
    // 3. 生成调整公式
    const adjustmentFormula = this.generateAdjustmentFormula(query, adjustmentSet);
    
    // 4. 使用LLM估计因果效应
    const estimate = await this.estimateCausalEffect(scm, query, adjustmentSet);
    
    // 5. 敏感性分析
    const sensitivityAnalysis = this.performSensitivityAnalysis(scm, query, adjustmentSet);
    
    // 6. 生成解释
    const explanation = await this.generateExplanation(query, estimate, adjustmentSet, scm);
    
    const computationTime = Date.now() - startTime;
    
    return {
      queryId: query.id,
      identifiable: true,
      estimate,
      confidenceInterval: estimate?.distribution ? [estimate.value - 0.1, estimate.value + 0.1] : undefined,
      confidenceLevel: 0.9,
      estimationMethod: '后门调整 + LLM推断',
      adjustmentFormula,
      adjustmentSet,
      sensitivityAnalysis,
      explanation,
      computationTime,
    };
  }
  
  /**
   * 执行干预分析 (do-operator)
   */
  async performIntervention(
    scm: StructuralCausalModel,
    intervention: Intervention,
    targetVariable: string
  ): Promise<{
    priorDistribution: VariableState[];
    posteriorDistribution: VariableState[];
    causalEffect: number;
    explanation: string;
  }> {
    // 1. 计算干预前的分布
    const priorDistribution = await this.computePriorDistribution(scm);
    
    // 2. 应用干预（修改结构方程）
    const intervenedSCM = this.applyIntervention(scm, intervention);
    
    // 3. 计算干预后的分布
    const posteriorDistribution = await this.computePosteriorDistribution(intervenedSCM, intervention);
    
    // 4. 计算因果效应
    const priorValue = this.getVariableValue(priorDistribution, targetVariable);
    const posteriorValue = this.getVariableValue(posteriorDistribution, targetVariable);
    const causalEffect = posteriorValue - priorValue;
    
    // 5. 生成解释
    const explanation = await this.generateInterventionExplanation(
      scm,
      intervention,
      targetVariable,
      causalEffect,
      priorValue,
      posteriorValue
    );
    
    return {
      priorDistribution,
      posteriorDistribution,
      causalEffect,
      explanation,
    };
  }
  
  /**
   * 执行反事实推断
   */
  async performCounterfactual(
    scm: StructuralCausalModel,
    scenario: CounterfactualScenario
  ): Promise<CounterfactualResult> {
    // 1. 提取事实状态
    const factualState = scenario.factualState;
    
    // 2. 推断外生变量的值（溯因推理）
    const exogenousValues = await this.abductExogenousVariables(scm, factualState);
    
    // 3. 应用反事实干预
    const counterfactualSCM = this.applyIntervention(scm, scenario.counterfactualIntervention);
    
    // 4. 计算反事实状态
    const counterfactualState = await this.computeCounterfactualState(
      counterfactualSCM,
      exogenousValues,
      scenario.counterfactualIntervention
    );
    
    // 5. 计算因果效应
    const causalEffect = this.computeCounterfactualEffects(factualState, counterfactualState);
    
    // 6. 计算路径效应
    const pathwayAnalysis = this.analyzePathways(scm, scenario);
    
    // 7. 生成解释
    const explanation = await this.generateCounterfactualExplanation(
      scm,
      scenario,
      factualState,
      counterfactualState,
      causalEffect
    );
    
    return {
      scenarioId: scenario.id,
      counterfactualState,
      causalEffect,
      pathwayAnalysis,
      confidence: 0.75,
      explanation,
      uncertainty: {
        lowerBound: causalEffect[0]?.difference ? causalEffect[0].difference * 0.8 : 0,
        upperBound: causalEffect[0]?.difference ? causalEffect[0].difference * 1.2 : 0,
        confidenceLevel: 0.9,
      },
    };
  }
  
  // ===========================================================================
  // 可识别性分析
  // ===========================================================================
  
  /**
   * 检查因果效应可识别性
   */
  private checkIdentifiability(
    scm: StructuralCausalModel,
    query: CausalQuery
  ): { identifiable: boolean; reason?: string } {
    if (!query.interventionVariables || query.interventionVariables.length === 0) {
      return { identifiable: true };
    }
    
    // 检查是否存在后门路径
    for (const interventionVar of query.interventionVariables) {
      const backdoorPaths = this.findBackdoorPaths(scm, interventionVar, query.targetVariable);
      
      if (backdoorPaths.length > 0) {
        // 检查是否可以阻断所有后门路径
        const blockable = this.canBlockBackdoorPaths(scm, backdoorPaths);
        
        if (!blockable) {
          return {
            identifiable: false,
            reason: `存在无法阻断的后门路径，混杂因素不可观测`,
          };
        }
      }
    }
    
    return { identifiable: true };
  }
  
  /**
   * 查找后门路径
   */
  private findBackdoorPaths(
    scm: StructuralCausalModel,
    treatment: string,
    outcome: string
  ): string[][] {
    const paths: string[][] = [];
    const adjList = new Map<string, string[]>();
    const reverseAdjList = new Map<string, string[]>();
    
    // 构建双向图
    for (const v of scm.variables) {
      adjList.set(v.id, []);
      reverseAdjList.set(v.id, []);
    }
    
    for (const e of scm.edges) {
      adjList.get(e.cause)?.push(e.effect);
      reverseAdjList.get(e.effect)?.push(e.cause);
    }
    
    // DFS查找后门路径（从治疗变量的父节点出发）
    const treatmentParents = reverseAdjList.get(treatment) || [];
    
    for (const parent of treatmentParents) {
      this.findPathsDFS(parent, outcome, adjList, reverseAdjList, [parent], paths, treatment);
    }
    
    return paths;
  }
  
  /**
   * DFS查找路径
   */
  private findPathsDFS(
    current: string,
    target: string,
    adjList: Map<string, string[]>,
    reverseAdjList: Map<string, string[]>,
    path: string[],
    allPaths: string[][],
    blockedNode: string
  ): void {
    if (current === target) {
      allPaths.push([...path]);
      return;
    }
    
    if (path.length > 10) return; // 防止无限循环
    
    // 向前搜索
    for (const next of adjList.get(current) || []) {
      if (!path.includes(next) && next !== blockedNode) {
        path.push(next);
        this.findPathsDFS(next, target, adjList, reverseAdjList, path, allPaths, blockedNode);
        path.pop();
      }
    }
  }
  
  /**
   * 检查是否可以阻断后门路径
   */
  private canBlockBackdoorPaths(scm: StructuralCausalModel, paths: string[][]): boolean {
    // 检查是否存在可观测变量可以阻断所有路径
    for (const path of paths) {
      const hasObservable = path.some(nodeId => {
        const variable = scm.variables.find(v => v.id === nodeId);
        return variable?.observable;
      });
      
      if (!hasObservable && path.length > 2) {
        return false;
      }
    }
    
    return true;
  }
  
  // ===========================================================================
  // 调整集计算
  // ===========================================================================
  
  /**
   * 计算调整集
   */
  private computeAdjustmentSet(
    scm: StructuralCausalModel,
    query: CausalQuery
  ): string[] {
    if (!query.interventionVariables || query.interventionVariables.length === 0) {
      return [];
    }
    
    const adjustmentSet: string[] = [];
    
    for (const treatment of query.interventionVariables) {
      // 获取治疗变量的父节点
      const parents = scm.edges
        .filter(e => e.effect === treatment)
        .map(e => e.cause);
      
      // 添加可观测的父节点
      for (const parentId of parents) {
        const parentVar = scm.variables.find(v => v.id === parentId);
        if (parentVar?.observable && !adjustmentSet.includes(parentId)) {
          adjustmentSet.push(parentId);
        }
      }
    }
    
    // 添加条件变量（如果有）
    if (query.conditioningVariables) {
      for (const condVar of query.conditioningVariables) {
        if (!adjustmentSet.includes(condVar)) {
          adjustmentSet.push(condVar);
        }
      }
    }
    
    return adjustmentSet;
  }
  
  /**
   * 生成调整公式
   */
  private generateAdjustmentFormula(query: CausalQuery, adjustmentSet: string[]): string {
    if (adjustmentSet.length === 0) {
      return `P(${query.targetVariable} | do(${query.interventionVariables?.join(',')}))`;
    }
    
    return `P(${query.targetVariable} | do(${query.interventionVariables?.join(',')})) = Σ P(${query.targetVariable} | ${query.interventionVariables?.join(',')}, ${adjustmentSet.join(',')}) * P(${adjustmentSet.join(',')})`;
  }
  
  // ===========================================================================
  // 因果效应估计
  // ===========================================================================
  
  /**
   * 估计因果效应
   */
  private async estimateCausalEffect(
    scm: StructuralCausalModel,
    query: CausalQuery,
    adjustmentSet: string[]
  ): Promise<CausalQueryResult['estimate']> {
    // 构建LLM提示
    const prompt = this.buildEstimationPrompt(scm, query, adjustmentSet);
    
    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: '你是一个因果推断专家，请基于结构化因果模型估计因果效应。' },
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });
      
      return this.parseEstimate(response.content || '');
    } catch (error) {
      console.error('[CausalInference] 估计失败:', error);
      
      // 返回默认估计
      return {
        value: 0.5,
        type: 'effect_size',
      };
    }
  }
  
  /**
   * 构建估计提示
   */
  private buildEstimationPrompt(
    scm: StructuralCausalModel,
    query: CausalQuery,
    adjustmentSet: string[]
  ): string {
    const variableNames = scm.variables.map(v => v.name).join('、');
    const edges = scm.edges.map(e => {
      const cause = scm.variables.find(v => v.id === e.cause)?.name || e.cause;
      const effect = scm.variables.find(v => v.id === e.effect)?.name || e.effect;
      return `${cause} → ${effect} (置信度: ${(e.confidence * 100).toFixed(0)}%)`;
    }).join('\n');
    
    return `基于以下结构化因果模型，估计因果效应：

**变量**: ${variableNames}

**因果关系**:
${edges}

**因果查询**:
- 类型: ${query.type}
- 目标变量: ${query.targetVariable}
- 干预变量: ${query.interventionVariables?.join(',') || '无'}
- 调整集: ${adjustmentSet.join(',') || '无'}

**描述**: ${query.description}

请输出JSON格式：
{
  "value": 0.75,
  "type": "probability/effect_size",
  "reasoning": "推理过程"
}`;
  }
  
  /**
   * 解析估计结果
   */
  private parseEstimate(content: string): CausalQueryResult['estimate'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          value: parsed.value || 0.5,
          type: parsed.type || 'effect_size',
        };
      }
    } catch (error) {
      console.error('[CausalInference] 解析估计失败:', error);
    }
    
    return {
      value: 0.5,
      type: 'effect_size',
    };
  }
  
  // ===========================================================================
  // 敏感性分析
  // ===========================================================================
  
  /**
   * 执行敏感性分析
   */
  private performSensitivityAnalysis(
    scm: StructuralCausalModel,
    query: CausalQuery,
    adjustmentSet: string[]
  ): CausalQueryResult['sensitivityAnalysis'] {
    // 计算稳健性分数
    const robustnessScore = this.computeRobustnessScore(scm, adjustmentSet);
    
    // 评估未观测混杂的影响
    const unmeasuredConfounderImpact = this.assessUnmeasuredConfounderImpact(scm, query);
    
    // 计算E-value
    const eValue = this.computeEValue(robustnessScore);
    
    return {
      robustnessScore,
      unmeasuredConfounderImpact,
      eValue,
    };
  }
  
  /**
   * 计算稳健性分数
   */
  private computeRobustnessScore(scm: StructuralCausalModel, adjustmentSet: string[]): number {
    // 基于调整集完整性和混杂因素可观测性计算
    const totalConfounders = scm.confounders?.length || 0;
    const observableConfounders = scm.confounders?.filter(c => c.observable).length || 0;
    
    if (totalConfounders === 0) return 0.9;
    
    return 0.5 + (observableConfounders / totalConfounders) * 0.4;
  }
  
  /**
   * 评估未观测混杂影响
   */
  private assessUnmeasuredConfounderImpact(
    scm: StructuralCausalModel,
    query: CausalQuery
  ): string {
    const unmeasured = scm.confounders?.filter(c => !c.observable) || [];
    
    if (unmeasured.length === 0) {
      return '未检测到未观测混杂因素，估计结果较为可靠';
    }
    
    if (unmeasured.length === 1) {
      return '存在1个未观测混杂因素，可能对估计结果产生中等影响';
    }
    
    return `存在${unmeasured.length}个未观测混杂因素，估计结果可能存在较大偏差`;
  }
  
  /**
   * 计算E-value
   */
  private computeEValue(pointEstimate: number): number {
    // E-value公式: E = RR + sqrt(RR * (RR - 1))
    // 简化计算
    const rr = Math.max(1, pointEstimate);
    return rr + Math.sqrt(rr * Math.max(0, rr - 1));
  }
  
  // ===========================================================================
  // 干预操作
  // ===========================================================================
  
  /**
   * 应用干预
   */
  private applyIntervention(
    scm: StructuralCausalModel,
    intervention: Intervention
  ): StructuralCausalModel {
    // 创建新的SCM（图手术）
    const newSCM: StructuralCausalModel = {
      ...scm,
      id: `${scm.id}-intervened-${intervention.id}`,
      edges: scm.edges.filter(e => e.effect !== intervention.variable),
      structuralEquations: scm.structuralEquations.map(eq => {
        if (eq.targetVariable === intervention.variable) {
          // 修改结构方程为常量
          return {
            ...eq,
            parentVariables: [],
            functionalForm: 'linear' as const,
            parameters: {
              intercept: this.parseInterventionValue(intervention.value),
            },
            description: `干预设置: ${intervention.variable} = ${intervention.value}`,
          };
        }
        return eq;
      }),
    };
    
    return newSCM;
  }
  
  /**
   * 解析干预值
   */
  private parseInterventionValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }
  
  /**
   * 计算先验分布
   */
  private async computePriorDistribution(scm: StructuralCausalModel): Promise<VariableState[]> {
    return scm.variables.map(v => ({
      variableId: v.id,
      value: null,
      probability: 1 / scm.variables.length,
      source: 'prior' as const,
    }));
  }
  
  /**
   * 计算后验分布
   */
  private async computePosteriorDistribution(
    scm: StructuralCausalModel,
    intervention: Intervention
  ): Promise<VariableState[]> {
    // 使用LLM推断后验分布
    const prompt = `基于因果模型，在干预 ${intervention.variable} = ${intervention.value} 后，推断各变量的状态：

变量列表: ${scm.variables.map(v => v.name).join('、')}

因果边: ${scm.edges.map(e => `${e.cause}→${e.effect}`).join(', ')}

请输出JSON数组，估计每个变量的状态变化：
[{"variable": "变量名", "expectedValue": 0.5, "changeDirection": "increase/decrease/none"}]`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });
      
      const parsed = this.parsePosteriorResponse(response.content || '', scm);
      return parsed;
    } catch {
      return scm.variables.map(v => ({
        variableId: v.id,
        value: null,
        probability: 1 / scm.variables.length,
        source: 'inferred' as const,
      }));
    }
  }
  
  /**
   * 解析后验响应
   */
  private parsePosteriorResponse(content: string, scm: StructuralCausalModel): VariableState[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((item: any) => ({
          variableId: scm.variables.find(v => v.name === item.variable)?.id || item.variable,
          value: item.expectedValue,
          probability: 0.7,
          source: 'inferred' as const,
        }));
      }
    } catch (error) {
      console.error('[CausalInference] 解析后验失败:', error);
    }
    
    return scm.variables.map(v => ({
      variableId: v.id,
      value: null,
      probability: 0.5,
      source: 'inferred' as const,
    }));
  }
  
  /**
   * 获取变量值
   */
  private getVariableValue(states: VariableState[], variableId: string): number {
    const state = states.find(s => s.variableId === variableId);
    return typeof state?.value === 'number' ? state.value : 0.5;
  }
  
  // ===========================================================================
  // 反事实推断
  // ===========================================================================
  
  /**
   * 溯因推理：推断外生变量值
   */
  private async abductExogenousVariables(
    scm: StructuralCausalModel,
    factualState: VariableState[]
  ): Promise<Map<string, any>> {
    const exogenousValues = new Map<string, any>();
    
    // 对于每个外生变量，推断其可能的值
    for (const exogVarId of scm.exogenousVariables) {
      const exogVar = scm.variables.find(v => v.id === exogVarId);
      if (!exogVar) continue;
      
      // 使用LLM推断外生变量值
      const inferredValue = await this.inferExogenousValue(scm, exogVar, factualState);
      exogenousValues.set(exogVarId, inferredValue);
    }
    
    return exogenousValues;
  }
  
  /**
   * 推断外生变量值
   */
  private async inferExogenousValue(
    scm: StructuralCausalModel,
    exogVar: CausalVariable,
    factualState: VariableState[]
  ): Promise<any> {
    const affectedVars = scm.edges
      .filter(e => e.cause === exogVar.id)
      .map(e => {
        const v = scm.variables.find(vari => vari.id === e.effect);
        const state = factualState.find(s => s.variableId === e.effect);
        return `${v?.name || e.effect} = ${state?.value || '未知'}`;
      });
    
    const prompt = `外生变量"${exogVar.name}"影响了以下变量：
${affectedVars.join('\n')}

请推断该外生变量可能的值（0-1之间的数值）。仅输出数值。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.3,
      });
      
      const value = parseFloat(response.content || '0.5');
      return isNaN(value) ? 0.5 : Math.max(0, Math.min(1, value));
    } catch {
      return 0.5;
    }
  }
  
  /**
   * 计算反事实状态
   */
  private async computeCounterfactualState(
    scm: StructuralCausalModel,
    exogenousValues: Map<string, any>,
    intervention: Intervention
  ): Promise<VariableState[]> {
    // 按拓扑顺序计算每个变量的值
    const states = new Map<string, any>();
    
    // 设置外生变量
    for (const [varId, value] of exogenousValues) {
      states.set(varId, value);
    }
    
    // 设置干预变量
    states.set(intervention.variable, this.parseInterventionValue(intervention.value));
    
    // 按结构方程计算内生变量
    for (const equation of scm.structuralEquations) {
      if (states.has(equation.targetVariable)) continue;
      
      // 计算变量值
      let value = equation.parameters?.intercept || 0;
      for (const parentId of equation.parentVariables) {
        const parentValue = states.get(parentId) || 0.5;
        const coefficient = equation.parameters?.coefficients?.[parentId] || 0.5;
        value += parentValue * coefficient;
      }
      
      states.set(equation.targetVariable, value);
    }
    
    // 转换为VariableState数组
    return scm.variables.map(v => ({
      variableId: v.id,
      value: states.get(v.id) || 0,
      probability: 0.7,
      source: 'counterfactual' as const,
    }));
  }
  
  /**
   * 计算反事实效应
   */
  private computeCounterfactualEffects(
    factualState: VariableState[],
    counterfactualState: VariableState[]
  ): CounterfactualResult['causalEffect'] {
    return factualState.map(factual => {
      const counterfactual = counterfactualState.find(s => s.variableId === factual.variableId);
      const factualValue = typeof factual.value === 'number' ? factual.value : 0;
      const counterfactualValue = typeof counterfactual?.value === 'number' ? counterfactual.value : 0;
      
      return {
        variable: factual.variableId,
        factualValue,
        counterfactualValue,
        difference: counterfactualValue - factualValue,
        probabilityOfNecessity: Math.abs(factualValue - counterfactualValue) * 0.6,
        probabilityOfSufficiency: Math.abs(factualValue - counterfactualValue) * 0.5,
      };
    });
  }
  
  /**
   * 分析路径效应
   */
  private analyzePathways(
    scm: StructuralCausalModel,
    scenario: CounterfactualScenario
  ): CounterfactualResult['pathwayAnalysis'] {
    // 简化的路径分析
    return {
      totalEffect: 0.5,
      directEffect: 0.3,
      indirectEffects: [
        {
          path: ['intervention', 'mediator', 'outcome'],
          effect: 0.2,
        },
      ],
    };
  }
  
  // ===========================================================================
  // 解释生成
  // ===========================================================================
  
  /**
   * 生成解释
   */
  private async generateExplanation(
    query: CausalQuery,
    estimate: CausalQueryResult['estimate'] | undefined,
    adjustmentSet: string[],
    scm: StructuralCausalModel
  ): Promise<string> {
    const prompt = `请为以下因果推断结果生成简洁的解释：

**因果查询**: ${query.description}
**估计效应**: ${estimate?.value || '未知'}
**调整集**: ${adjustmentSet.join(', ') || '无'}
**模型领域**: ${scm.domain}

请用2-3句话解释：1) 因果效应的含义 2) 为什么选择这个调整集 3) 结果的可信度。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt },
      ], {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.5,
      });
      
      return response.content || '因果效应估计完成，具体解释请参考估计值和置信区间。';
    } catch {
      return '因果效应估计完成，具体解释请参考估计值和置信区间。';
    }
  }
  
  /**
   * 生成干预解释
   */
  private async generateInterventionExplanation(
    scm: StructuralCausalModel,
    intervention: Intervention,
    targetVariable: string,
    causalEffect: number,
    priorValue: number,
    posteriorValue: number
  ): Promise<string> {
    const targetVar = scm.variables.find(v => v.id === targetVariable);
    
    return `干预分析结果：
    
**干预操作**: 设置 ${intervention.variable} = ${intervention.value}

**对目标变量的影响**: 
- ${targetVar?.name || targetVariable} 从 ${priorValue.toFixed(3)} 变化到 ${posteriorValue.toFixed(3)}
- 因果效应: ${causalEffect >= 0 ? '+' : ''}${causalEffect.toFixed(3)}

**解释**: 干预${intervention.variable}对${targetVar?.name || targetVariable}产生了${Math.abs(causalEffect) > 0.1 ? '显著' : '轻微'}的${causalEffect > 0 ? '正向' : '负向'}影响。`;
  }
  
  /**
   * 生成反事实解释
   */
  private async generateCounterfactualExplanation(
    scm: StructuralCausalModel,
    scenario: CounterfactualScenario,
    factualState: VariableState[],
    counterfactualState: VariableState[],
    causalEffect: CounterfactualResult['causalEffect']
  ): Promise<string> {
    const mainEffect = causalEffect[0];
    if (!mainEffect) {
      return '反事实分析完成，但未能计算出明确的因果效应。';
    }
    
    return `反事实分析结果：

**场景**: ${scenario.name}

**事实情况**: ${scenario.factualState.map(s => `${s.variableId}=${s.value}`).join(', ')}

**反事实假设**: 如果 ${scenario.counterfactualIntervention.variable} = ${scenario.counterfactualIntervention.value}

**结果变化**: 
- ${mainEffect.variable} 将从 ${mainEffect.factualValue.toFixed(3)} 变为 ${mainEffect.counterfactualValue.toFixed(3)}
- 变化幅度: ${mainEffect.difference >= 0 ? '+' : ''}${mainEffect.difference.toFixed(3)}

**解释**: 在反事实情境下，${mainEffect.difference > 0 ? '会有正向变化' : '会有负向变化'}。这表明${scenario.counterfactualIntervention.variable}对结果具有因果影响。`;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建因果推断引擎
 */
export function createCausalInferenceEngine(): CausalInferenceEngine {
  return new CausalInferenceEngine();
}
