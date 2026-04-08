/**
 * LLM 分析提示模板
 * 用于引导 LLM 进行多维度态势分析
 */

// ==================== 态势感知分析 ====================

export const SITUATION_AWARENESS_PROMPT = `你是一位资深的态势感知专家。请基于以下搜索结果，分析当前态势。

## 搜索结果
{search_context}

## 分析要求
1. 核心事件识别（识别最重要的3-5个核心事件）
2. 关键要素提取（提取5-10个关键因素）
3. 当前态势评估（整体态势判断）

## 输出格式
请以JSON格式返回，不要包含其他内容：
{
  "core_events": [
    {"event": "事件描述", "importance": "高/中/低", "timeframe": "时间范围"}
  ],
  "key_factors": [
    {"factor": "因素描述", "impact": "正面/负面/中性", "importance": "高/中/低"}
  ],
  "situation_assessment": "整体态势评估文本"
}`;

// ==================== 情报分析 ====================

export const INTELLIGENCE_ANALYSIS_PROMPT = `你是一位经验丰富的情报分析专家。请基于以下信息，进行深度情报分析。

## 分析主题
{topic}

## 搜索结果
{search_context}

## 态势感知结果
{situation_result}

## 分析要求
1. 信息源可信度评估
2. 关键发现（3-5个重要发现）
3. 异常信号识别
4. 风险与机遇分析

## 输出格式
请以JSON格式返回：
{
  "credibility_assessment": [
    {"source": "来源", "credibility": "高/中/低", "reason": "评估理由"}
  ],
  "key_findings": [
    {"finding": "发现描述", "confidence": "高/中/低", "evidence": "支持证据"}
  ],
  "anomaly_signals": [
    {"signal": "异常信号", "severity": "高/中/低", "description": "详细说明"}
  ],
  "risks_opportunities": {
    "risks": ["风险1", "风险2"],
    "opportunities": ["机遇1", "机遇2"]
  }
}`;

// ==================== 趋势预测 ====================

export const FORECAST_PROMPT = `你是一位专业的趋势预测专家。请基于以下信息，进行趋势预测分析。

## 分析主题
{topic}

## 态势感知结果
{situation_result}

## 分析要求
1. 短期趋势预测（1-3个月）
2. 中期趋势预测（3-12个月）
3. 长期趋势预测（1-3年）
4. 关键转折点预判

## 输出格式
请以JSON格式返回：
{
  "short_term": {
    "trends": ["趋势1", "趋势2"],
    "confidence": "高/中/低",
    "key_indicators": ["指标1", "指标2"]
  },
  "medium_term": {
    "trends": ["趋势1", "趋势2"],
    "confidence": "高/中/低",
    "key_indicators": ["指标1", "指标2"]
  },
  "long_term": {
    "trends": ["趋势1", "趋势2"],
    "confidence": "高/中/低",
    "key_indicators": ["指标1", "指标2"]
  },
  "turning_points": [
    {"point": "转折点描述", "probability": "高/中/低", "impact": "影响描述"}
  ]
}`;

// ==================== 决策支持 ====================

export const DECISION_SUPPORT_PROMPT = `你是一位资深的决策支持专家。请基于以下分析结果，提供决策建议。

## 分析主题
{topic}

## 分析结果
{analysis_results}

## 分析要求
1. 决策建议方案（至少3个方案）
2. 方案对比分析
3. 实施建议
4. 监控指标

## 输出格式
请以JSON格式返回：
{
  "recommendations": [
    {
      "title": "方案标题",
      "description": "方案描述",
      "pros": ["优势1", "优势2"],
      "cons": ["劣势1", "劣势2"],
      "implementation_steps": ["步骤1", "步骤2"],
      "priority": "高/中/低"
    }
  ],
  "comparison": {
    "criteria": ["评估标准1", "评估标准2"],
    "analysis": "对比分析文本"
  },
  "implementation_advice": "实施建议文本",
  "monitoring_indicators": [
    {"indicator": "指标名称", "target": "目标值", "frequency": "监控频率"}
  ]
}`;

// ==================== 辅助函数 ====================

export function formatSearchContext(searchResults: {
  summary: string;
  items: Array<{
    title: string;
    site_name?: string;
    publish_time?: string;
    snippet?: string;
  }>;
}): string {
  let output = `搜索摘要: ${searchResults.summary}\n\n`;
  output += `找到 ${searchResults.items.length} 条相关信息:\n\n`;
  
  for (let i = 0; i < Math.min(10, searchResults.items.length); i++) {
    const item = searchResults.items[i];
    output += `【${i + 1}】${item.title}\n`;
    output += `来源: ${item.site_name || '未知'} | 时间: ${item.publish_time?.slice(0, 10) || '未知'}\n`;
    output += `摘要: ${(item.snippet || '').slice(0, 150)}\n\n`;
  }
  
  return output;
}

export function fillPrompt(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * 解析 LLM 返回的 JSON
 */
export function parseJsonResponse(response: string): any {
  try {
    // 尝试直接解析
    return JSON.parse(response);
  } catch {
    // 尝试提取 JSON 块
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // 尝试提取花括号内容
    const braceMatch = response.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0]);
    }
    
    return null;
  }
}
