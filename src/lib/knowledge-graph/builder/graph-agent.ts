import { LLMClient } from '@/lib/agents/memory-enhanced-agents';
import { SearchItem, SearchResults, EventGraph, GraphNode, GraphEdge } from './types';

/**
 * 图谱生成Agent
 * 使用LLM和各Agent分析结果动态生成事件图谱
 */
export class GraphGenerationAgent {
  constructor(private llmClient: LLMClient) {}
  
  /**
   * 生成完整的事件图谱
   * 优先使用已解析的Agent结果，缺失时调用LLM补充
   */
  async generateGraph(query: string, searchResults: SearchResults, agentResults?: Record<string, string>): Promise<EventGraph> {
    const items = searchResults.items?.slice(0, 10) || [];
    
    if (items.length === 0) {
      console.log('[GraphAgent] No search results, returning empty graph');
      return this.generateEmptyGraph(query);
    }
    
    try {
      // 尝试从已解析的Agent结果中提取数据
      const extractedData = this.extractFromAgentResults(agentResults);
      
      // 如果Agent结果数据完整，直接使用
      if (extractedData.hasCompleteData) {
        console.log('[GraphAgent] Using data from agent results');
        return this.transformToGraph(extractedData.data, query);
      }
      
      // 否则调用LLM补充生成
      console.log('[GraphAgent] Calling LLM for supplementary graph generation...');
      const prompt = this.buildPrompt(query, items, extractedData.data);
      
      const response = await this.llmClient.chat([
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt }
      ]);
      
      console.log('[GraphAgent] LLM response length:', response.length);
      
      const llmData = this.parseGraphResponse(response);
      // 合并Agent结果和LLM补充数据
      const mergedData = this.mergeData(extractedData.data, llmData);
      
      return this.transformToGraph(mergedData, query);
    } catch (error) {
      console.error('[GraphAgent] Graph generation failed:', error);
      throw error;
    }
  }
  
  /**
   * 从Agent结果中提取结构化数据
   */
  private extractFromAgentResults(agentResults?: Record<string, string>): { hasCompleteData: boolean; data: any } {
    if (!agentResults) {
      return { hasCompleteData: false, data: {} };
    }
    
    const data: any = {};
    let hasCompleteData = true;
    
    // 提取时间线数据
    const timelineOutput = agentResults['timeline'];
    if (timelineOutput) {
      const parsed = this.extractJSON(timelineOutput);
      if (parsed?.events && Array.isArray(parsed.events)) {
        data.timeline = parsed.events.map((e: any) => ({
          date: e.timestamp || e.date,
          event: e.event,
          significance: e.significance || ''
        }));
      } else {
        hasCompleteData = false;
      }
    } else {
      hasCompleteData = false;
    }
    
    // 提取因果链数据
    const causalOutput = agentResults['causal_inference'];
    if (causalOutput) {
      const parsed = this.extractJSON(causalOutput);
      if (parsed?.chains && Array.isArray(parsed.chains)) {
        data.causalChain = parsed.chains.map((c: any) => ({
          cause: c.factor,
          effect: c.description,
          mechanism: '',
          confidence: c.strength || 0.5
        }));
      } else {
        hasCompleteData = false;
      }
    } else {
      hasCompleteData = false;
    }
    
    // 提取关键因素数据
    const factorOutput = agentResults['key_factor'];
    if (factorOutput) {
      const parsed = this.extractJSON(factorOutput);
      if (parsed?.factors && Array.isArray(parsed.factors)) {
        data.keyFactors = parsed.factors.map((f: any) => ({
          name: f.factor,
          description: f.description,
          impact: f.impact,
          trend: f.trend,
          evidence: ''
        }));
      } else {
        hasCompleteData = false;
      }
    } else {
      hasCompleteData = false;
    }
    
    // 提取场景数据
    const scenarioOutput = agentResults['scenario'];
    if (scenarioOutput) {
      const parsed = this.extractJSON(scenarioOutput);
      if (parsed?.scenarios && Array.isArray(parsed.scenarios)) {
        data.scenarios = parsed.scenarios.map((s: any) => ({
          type: s.type,
          title: s.name,
          description: s.description,
          probability: s.probability,
          keyEvents: s.triggers || [],
          timeFrame: s.predictions?.[0]?.timeframe || ''
        }));
      } else {
        hasCompleteData = false;
      }
    } else {
      hasCompleteData = false;
    }
    
    console.log('[GraphAgent] Extracted from agent results:', {
      timeline: data.timeline?.length || 0,
      causalChain: data.causalChain?.length || 0,
      keyFactors: data.keyFactors?.length || 0,
      scenarios: data.scenarios?.length || 0
    });
    
    return { hasCompleteData, data };
  }
  
  /**
   * 智能提取JSON
   */
  private extractJSON(text: string): any {
    if (!text) return null;
    
    try {
      return JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch {}
      }
      
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch {}
      }
    }
    return null;
  }
  
  /**
   * 合并Agent结果和LLM补充数据
   */
  private mergeData(agentData: any, llmData: any): any {
    return {
      coreEvent: llmData.coreEvent || { description: '', summary: '' },
      timeline: agentData.timeline?.length > 0 ? agentData.timeline : llmData.timeline || [],
      causalChain: agentData.causalChain?.length > 0 ? agentData.causalChain : llmData.causalChain || [],
      keyFactors: agentData.keyFactors?.length > 0 ? agentData.keyFactors : llmData.keyFactors || [],
      scenarios: agentData.scenarios?.length > 0 ? agentData.scenarios : llmData.scenarios || [],
      observables: llmData.observables || []
    };
  }
  
  private getSystemPrompt(): string {
    return `你是一个专业的事件图谱生成助手。你的任务是基于提供的新闻搜索结果，生成结构化的事件图谱数据。

【重要】你必须输出严格的JSON格式，不要有任何多余内容。

输出格式：
{
  "coreEvent": {
    "description": "核心事件描述",
    "summary": "事件摘要"
  },
  "timeline": [
    {"date": "YYYY-MM-DD", "event": "事件描述", "significance": "重要性"}
  ],
  "causalChain": [
    {"cause": "原因", "effect": "结果", "mechanism": "机制", "confidence": 0.8}
  ],
  "keyFactors": [
    {"name": "因素名称", "description": "描述", "impact": "高/中/低", "trend": "上升/下降/稳定", "evidence": "证据"}
  ],
  "scenarios": [
    {"type": "optimistic/neutral/pessimistic", "title": "场景名称", "description": "描述", "probability": 0.4, "keyEvents": [], "timeFrame": "时间范围"}
  ],
  "observables": [
    {"name": "指标名称", "description": "说明", "currentStatus": "当前状态", "threshold": "阈值", "trend": "趋势"}
  ]
}

规则：
1. confidence和probability必须是0-1之间的数值
2. 场景类型只能是：optimistic, neutral, pessimistic
3. 必须生成3个场景（乐观、基准、悲观）`;
  }
  
  private buildPrompt(query: string, items: SearchItem[], existingData?: any): string {
    const searchInfo = items.map((item, i) => 
      `【${i + 1}】${item.title || '未知标题'}
时间: ${item.publishTime?.substring(0, 10) || '未知'}
摘要: ${item.snippet?.substring(0, 150) || '无'}`
    ).join('\n');
    
    let prompt = `分析主题: ${query}

搜索结果（${items.length}条）:
${searchInfo}

请基于以上信息生成事件图谱JSON。`;
    
    // 如果已有部分数据，提示LLM补充缺失部分
    if (existingData && Object.keys(existingData).length > 0) {
      prompt += `\n\n已有部分数据，请补充缺失部分：`;
      if (existingData.timeline?.length > 0) {
        prompt += `\n- 时间线数据已有(${existingData.timeline.length}条)`;
      }
      if (existingData.causalChain?.length > 0) {
        prompt += `\n- 因果链数据已有(${existingData.causalChain.length}条)`;
      }
      if (existingData.keyFactors?.length > 0) {
        prompt += `\n- 关键因素数据已有(${existingData.keyFactors.length}个)`;
      }
      if (existingData.scenarios?.length > 0) {
        prompt += `\n- 场景数据已有(${existingData.scenarios.length}个)`;
      }
    }
    
    return prompt;
  }
  
  private parseGraphResponse(response: string): any {
    try {
      let jsonStr = response;
      
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        const braceMatch = response.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          jsonStr = braceMatch[0];
        }
      }
      
      jsonStr = this.fixJsonString(jsonStr);
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('[GraphAgent] Failed to parse JSON:', error);
      throw error;
    }
  }
  
  private fixJsonString(jsonStr: string): string {
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '');
    jsonStr = jsonStr.replace(/"([^"]+)":\s*([,}\]])/g, '"$1": ""$2');
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    return jsonStr;
  }
  
  private transformToGraph(data: any, query: string): EventGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // 1. 核心事件节点
    nodes.push({
      id: 'event-core',
      type: 'event',
      position: { x: 50, y: 300 },
      data: {
        label: '核心事件',
        description: data.coreEvent?.description || query,
        snippet: data.coreEvent?.summary || ''
      }
    });
    
    // 2. 时间线节点
    const timeline = data.timeline || [];
    timeline.slice(0, 5).forEach((event: any, i: number) => {
      nodes.push({
        id: `timeline-${i}`,
        type: 'timeline',
        position: { x: 350, y: 50 + i * 80 },
        data: {
          label: event.event?.substring(0, 20) || `节点${i + 1}`,
          date: event.date || '',
          description: event.event || '',
          significance: event.significance || ''
        }
      });
      
      edges.push({
        id: `e-timeline-${i}`,
        source: 'event-core',
        target: `timeline-${i}`,
        type: 'smoothstep',
        animated: i === 0
      });
    });
    
    // 3. 因果链节点
    const causalChain = data.causalChain || [];
    causalChain.slice(0, 4).forEach((causal: any, i: number) => {
      nodes.push({
        id: `causal-${i}`,
        type: 'causal',
        position: { x: 650, y: 80 + i * 100 },
        data: {
          label: causal.cause?.substring(0, 15) || `因果${i + 1}`,
          cause: causal.cause || '',
          effect: causal.effect || '',
          mechanism: causal.mechanism || '',
          confidence: causal.confidence || 0.5
        }
      });
      
      if (timeline.length > 0) {
        edges.push({
          id: `e-timeline-0-causal-${i}`,
          source: 'timeline-0',
          target: `causal-${i}`,
          type: 'smoothstep'
        });
      }
    });
    
    // 4. 关键因素节点
    const keyFactors = data.keyFactors || [];
    keyFactors.slice(0, 5).forEach((factor: any, i: number) => {
      nodes.push({
        id: `factor-${i}`,
        type: 'factor',
        position: { x: 950, y: 60 + i * 90 },
        data: {
          label: factor.name?.substring(0, 20) || `因素${i + 1}`,
          description: factor.description || '',
          impact: factor.impact || '中',
          trend: factor.trend || '平稳',
          evidence: factor.evidence || ''
        }
      });
      
      if (causalChain.length > 0) {
        edges.push({
          id: `e-causal-0-factor-${i}`,
          source: 'causal-0',
          target: `factor-${i}`,
          type: 'smoothstep'
        });
      }
    });
    
    // 5. 场景推演节点
    const scenarios = data.scenarios || [];
    scenarios.slice(0, 3).forEach((scenario: any, i: number) => {
      nodes.push({
        id: `scenario-${i}`,
        type: 'scenario',
        position: { x: 1250, y: 80 + i * 130 },
        data: {
          label: scenario.title || `场景${i + 1}`,
          type: scenario.type || 'neutral',
          description: scenario.description || '',
          probability: scenario.probability || 0.33,
          keyEvents: scenario.keyEvents || [],
          timeFrame: scenario.timeFrame || ''
        }
      });
      
      if (keyFactors.length > 0) {
        edges.push({
          id: `e-factor-0-scenario-${i}`,
          source: 'factor-0',
          target: `scenario-${i}`,
          type: 'smoothstep',
          animated: scenario.probability > 0.4
        });
      }
    });
    
    // 6. 可观测性节点
    const observables = data.observables || [];
    observables.slice(0, 4).forEach((observable: any, i: number) => {
      nodes.push({
        id: `observable-${i}`,
        type: 'observable',
        position: { x: 1550, y: 100 + i * 80 },
        data: {
          label: observable.name || `指标${i + 1}`,
          description: observable.description || '',
          currentStatus: observable.currentStatus || '',
          threshold: observable.threshold || '',
          trend: observable.trend || ''
        }
      });
      
      if (scenarios.length > 0) {
        edges.push({
          id: `e-scenario-0-observable-${i}`,
          source: 'scenario-0',
          target: `observable-${i}`,
          type: 'smoothstep'
        });
      }
    });
    
    console.log('[GraphAgent] Generated graph:', nodes.length, 'nodes,', edges.length, 'edges');
    
    return { nodes, edges };
  }
  
  private generateEmptyGraph(query: string): EventGraph {
    return {
      nodes: [{
        id: 'event-core',
        type: 'event',
        position: { x: 50, y: 300 },
        data: {
          label: '核心事件',
          description: query,
          snippet: '暂无足够信息生成图谱'
        }
      }],
      edges: []
    };
  }
}
