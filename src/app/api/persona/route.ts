import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, SearchClient, Config } from 'coze-coding-dev-sdk';

/**
 * 动态人格服务
 * 
 * 功能：
 * 1. 根据主题动态识别关键人物
 * 2. 实时搜索获取最新人格特征
 * 3. 从知识库匹配相似人格模板
 */

/**
 * POST /api/persona/identify
 * 动态识别与主题相关的关键人物及其人格特征
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, maxFigures = 5 } = body;
    
    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }
    
    const config = new Config();
    const llmClient = new LLMClient(config);
    const searchClient = new SearchClient(config);
    
    // 1. 使用LLM识别关键人物
    const identifyPrompt = `你是一个国际政治经济专家。分析以下主题，识别最相关的关键决策者：

主题：${topic}

请识别：
1. 该主题涉及的主要国家/地区及其决策者
2. 相关国际组织负责人
3. 市场重要参与者（如有）
4. 对中国有直接影响的决策者

请按以下JSON格式输出（最多${maxFigures}人）：
{
  "figures": [
    {
      "name": "人物姓名（中英文）",
      "role": "具体职务",
      "country": "国家/组织",
      "relevance": 0.0-1.0,
      "reasoning": "为什么此人与主题相关（100字以内）",
      "traits": ["性格特征1", "性格特征2"],
      "decisionStyle": "conservative/moderate/aggressive",
      "recentStance": "近期公开立场摘要"
    }
  ]
}`;

    const llmResponse = await llmClient.invoke([
      { role: 'system', content: '你是国际政治经济分析专家，擅长识别关键决策者并分析其行为模式。' },
      { role: 'user', content: identifyPrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.3
    });
    
    const content = llmResponse.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse LLM response'
      });
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    let figures = (parsed.figures || []).slice(0, maxFigures);
    
    // 2. 为每个人物搜索最新信息（增强人格特征）
    const enhancedFigures = await Promise.all(
      figures.map(async (figure: any) => {
        try {
          // 搜索该人物的最新动态和立场
          const searchResults = await searchClient.advancedSearch(
            `${figure.name} 最新立场 观点 决策`,
            { searchType: 'web', count: 3, needSummary: true }
          );
          
          const items = (searchResults as any).web_items || [];
          const latestNews = items.map((item: any) => ({
            title: item.title,
            summary: item.summary?.substring(0, 200),
            date: item.publish_date,
            source: item.source
          }));
          
          return {
            id: `dynamic_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            ...figure,
            latestNews,
            lastUpdated: new Date().toISOString()
          };
        } catch (e) {
          return {
            id: `dynamic_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            ...figure,
            latestNews: [],
            lastUpdated: new Date().toISOString()
          };
        }
      })
    );
    
    return NextResponse.json({
      success: true,
      data: {
        topic,
        figures: enhancedFigures,
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[Persona Identify API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/persona/simulate
 * 模拟特定人格的决策过程
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      persona, 
      topic, 
      recentEvents,
      otherDecisions 
    } = body;
    
    if (!persona || !topic) {
      return NextResponse.json({ error: 'Persona and topic are required' }, { status: 400 });
    }
    
    const config = new Config();
    const llmClient = new LLMClient(config);
    
    // 构建决策模拟Prompt
    const simulatePrompt = `你现在要扮演${persona.name}（${persona.role}）进行决策模拟。

【你的人格特征】
- 决策风格：${persona.decisionStyle || 'moderate'}
- 性格特点：${persona.traits?.join('、') || '稳健务实'}
- 近期立场：${persona.recentStance || '暂无'}

【分析主题】
${topic}

【近期相关事件】
${(recentEvents || []).map((e: any) => `- ${e.title}: ${e.summary}`).join('\n') || '暂无'}

【其他决策者的立场】
${(otherDecisions || []).map((d: any) => `- ${d.name}: ${d.decision}`).join('\n') || '暂无'}

请基于你的人格特征和上述信息，做出你的决策判断。你需要：
1. 分析你的核心立场
2. 考虑你的决策约束（如政治压力、经济目标、国际关系等）
3. 评估对中国的影响
4. 给出你的决策和置信度

请按以下JSON格式输出：
{
  "decision": "你的核心决策",
  "reasoning": "决策理由（结合你的人格特征分析）",
  "confidence": 0.0-1.0,
  "constraints": ["约束1", "约束2"],
  "chinaConsideration": "对中国市场的考量",
  "alternativeActions": ["备选方案1", "备选方案2"]
}`;

    const llmResponse = await llmClient.invoke([
      { role: 'system', content: `你是${persona.name}的决策模拟器。你需要完全代入这个角色，基于其人格特征、政治立场和决策风格进行思考。` },
      { role: 'user', content: simulatePrompt }
    ], {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.5
    });
    
    const content = llmResponse.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]);
      
      return NextResponse.json({
        success: true,
        data: {
          personaId: persona.id,
          personaName: persona.name,
          decision,
          simulatedAt: new Date().toISOString()
        }
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to parse simulation result'
    });
    
  } catch (error) {
    console.error('[Persona Simulate API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
