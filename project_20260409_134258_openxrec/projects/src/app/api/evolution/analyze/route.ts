import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, EmbeddingClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * POST /api/evolution/analyze
 * 使用LLM分析用户交互模式并生成优化建议
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      interactions, 
      cases, 
      currentAnalysis,
      patterns 
    } = body;
    
    const config = new Config();
    const llmClient = new LLMClient(config);
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const embeddingClient = new EmbeddingClient({ customHeaders } as any);
    
    // 1. 使用嵌入模型找到相似案例
    let similarCases: any[] = [];
    if (currentAnalysis?.topic && cases?.length > 0) {
      // 获取主题的嵌入向量
      const topicEmbedding = await embeddingClient.embedText(currentAnalysis.topic);
      
      // 计算与每个案例的语义相似度
      const caseSimilarities = await Promise.all(
        cases.slice(0, 10).map(async (c: any) => {
          try {
            const caseEmbedding = await embeddingClient.embedText(c.topic);
            return {
              case: c,
              similarity: cosineSimilarity(topicEmbedding, caseEmbedding)
            };
          } catch {
            return { case: c, similarity: 0 };
          }
        })
      );
      
      similarCases = caseSimilarities
        .filter(item => item.similarity > 0.7)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3)
        .map(item => item.case);
    }
    
    // 2. 使用LLM分析交互模式并生成建议
    const analysisPrompt = `你是一个智能复盘进化系统，分析以下数据并生成优化建议：

## 用户交互记录（最近20条）
${JSON.stringify(interactions?.slice(-20) || [], null, 2)}

## 相似案例
${JSON.stringify(similarCases.map((c: any) => ({
  topic: c.topic,
  conclusion: c.conclusion?.substring(0, 100),
  rating: c.feedback?.rating
})), null, 2)}

## 当前分析主题
${currentAnalysis?.topic || '无'}

## 已提取的知识模式
${JSON.stringify(patterns?.slice(0, 10) || [], null, 2)}

请分析：
1. 用户的分析习惯和偏好是什么？
2. 当前分析是否存在知识缺口？是否可以参考相似案例？
3. 有哪些可自动应用的优化建议？

请按以下JSON格式输出（不要输出其他内容）：
{
  "userPreferences": {
    "preferredViews": ["视图列表"],
    "analysisStyle": "深度/快速/探索型",
    "commonTopics": ["常见主题"]
  },
  "knowledgeGaps": [
    {
      "topic": "缺口主题",
      "suggestion": "建议参考"
    }
  ],
  "optimizationSuggestions": [
    {
      "type": "workflow_optimization/prompt_improvement/knowledge_gap",
      "title": "建议标题",
      "description": "详细描述",
      "impact": "high/medium/low",
      "autoApplicable": true/false,
      "details": {}
    }
  ]
}`;

    const llmResponse = await llmClient.invoke([
      { role: 'system', content: '你是智能复盘进化系统，专门分析用户行为并生成优化建议。' },
      { role: 'user', content: analysisPrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.3
    });
    
    const content = llmResponse.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      return NextResponse.json({
        success: true,
        data: {
          similarCases,
          analysis: result,
          timestamp: Date.now()
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        similarCases,
        analysis: null,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    console.error('[Evolution Analyze API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/evolution/extract-patterns
 * 使用LLM从案例中深度提取知识模式
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseData } = body;
    
    const config = new Config();
    const llmClient = new LLMClient(config);
    
    const extractPrompt = `你是一个知识工程师，从以下分析案例中提取深层次的知识模式：

## 案例
主题：${caseData.topic}
结论：${caseData.conclusion}

关键因素：
${JSON.stringify(caseData.keyFactors, null, 2)}

时间线：
${JSON.stringify(caseData.timeline?.slice(0, 10), null, 2)}

场景：
${JSON.stringify(caseData.scenarios, null, 2)}

请提取：
1. 因果链模式（如：X变化 → Y影响 → Z结果）
2. 风险传导路径（如：政策 → 市场 → 企业）
3. 指标模式（如：哪些指标预示某个趋势）
4. 可复用的分析框架

请按以下JSON格式输出：
{
  "causalPatterns": [
    {
      "pattern": "因果链描述",
      "confidence": 0.0-1.0,
      "applicableContexts": ["适用场景"]
    }
  ],
  "riskPaths": [
    {
      "path": "传导路径",
      "probability": 0.0-1.0,
      "indicators": ["预警指标"]
    }
  ],
  "indicatorPatterns": [
    {
      "indicator": "指标名称",
      "signals": ["信号含义"],
      "historicalAccuracy": 0.0-1.0
    }
  ],
  "analysisFramework": {
    "name": "框架名称",
    "steps": ["分析步骤"],
    "applicableTopics": ["适用主题类型"]
  }
}`;

    const llmResponse = await llmClient.invoke([
      { role: 'system', content: '你是知识工程专家，擅长从案例中提取可复用的知识模式。' },
      { role: 'user', content: extractPrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.2
    });
    
    const content = llmResponse.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const patterns = JSON.parse(jsonMatch[0]);
      
      return NextResponse.json({
        success: true,
        data: patterns
      });
    }
    
    return NextResponse.json({
      success: true,
      data: null
    });
    
  } catch (error) {
    console.error('[Evolution Extract API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
