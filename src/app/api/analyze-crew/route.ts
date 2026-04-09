import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import {
  SITUATION_AWARENESS_PROMPT,
  INTELLIGENCE_ANALYSIS_PROMPT,
  FORECAST_PROMPT,
  DECISION_SUPPORT_PROMPT,
  formatSearchContext,
  fillPrompt,
  parseJsonResponse,
} from '@/lib/llm-prompts';

/**
 * 态势感知分析 API
 * 
 * 使用 Coze SDK 进行搜索和 LLM 分析
 */

export async function POST(request: NextRequest) {
  try {
    const { 
      topic, 
      timeRange = '1m',
      agents = ['situation_awareness', 'intelligence_analyst', 'forecast_expert', 'decision_support']
    } = await request.json();
    
    if (!topic) {
      return NextResponse.json({ error: '请输入分析主题' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    
    const searchClient = new SearchClient(config, customHeaders);
    const llmClient = new LLMClient(config, customHeaders);

    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // ========== 1. 搜索阶段 ==========
          sendEvent({ 
            type: 'stage', 
            stage: 'search', 
            message: '正在搜索相关信息...' 
          });

          const searchResult = await searchClient.advancedSearch(topic, {
            searchType: 'web',
            count: 15,
            timeRange,
            needSummary: true,
            needContent: false
          });

          const searchItems = (searchResult.web_items || []).map(item => ({
            title: item.title || '',
            url: item.url || '',
            snippet: item.snippet || '',
            site_name: item.site_name || '',
            publish_time: item.publish_time || '',
            authority_level: item.auth_info_level || 0
          }));

          const searchContext = formatSearchContext({
            summary: searchResult.summary || '',
            items: searchItems
          });

          sendEvent({ 
            type: 'search_complete', 
            count: searchItems.length,
            summary: (searchResult.summary || '').slice(0, 100)
          });

          // ========== 2. LLM 分析阶段 ==========
          const llmResponses: Record<string, any> = {};

          // 2.1 态势感知分析
          if (agents.includes('situation_awareness')) {
            sendEvent({ 
              type: 'agent_status', 
              agent: 'situation_awareness', 
              status: 'analyzing',
              message: '态势感知专家正在分析...' 
            });

            const prompt = fillPrompt(SITUATION_AWARENESS_PROMPT, { search_context: searchContext });
            const response = await llmClient.invoke([{ role: 'user', content: prompt }]);
            const parsed = parseJsonResponse(response.content);
            
            llmResponses.situation_awareness = parsed || { raw: response.content };
            
            sendEvent({ 
              type: 'agent_status', 
              agent: 'situation_awareness', 
              status: 'completed' 
            });
          }

          // 2.2 情报分析
          if (agents.includes('intelligence_analyst')) {
            sendEvent({ 
              type: 'agent_status', 
              agent: 'intelligence_analyst', 
              status: 'analyzing',
              message: '情报分析专家正在分析...' 
            });

            const prompt = fillPrompt(INTELLIGENCE_ANALYSIS_PROMPT, {
              topic,
              search_context: searchContext,
              situation_result: JSON.stringify(llmResponses.situation_awareness, null, 2)
            });
            const response = await llmClient.invoke([{ role: 'user', content: prompt }]);
            const parsed = parseJsonResponse(response.content);
            
            llmResponses.intelligence_analyst = parsed || { raw: response.content };
            
            sendEvent({ 
              type: 'agent_status', 
              agent: 'intelligence_analyst', 
              status: 'completed' 
            });
          }

          // 2.3 趋势预测
          if (agents.includes('forecast_expert')) {
            sendEvent({ 
              type: 'agent_status', 
              agent: 'forecast_expert', 
              status: 'analyzing',
              message: '趋势预测专家正在分析...' 
            });

            const prompt = fillPrompt(FORECAST_PROMPT, {
              topic,
              situation_result: JSON.stringify(llmResponses.situation_awareness, null, 2)
            });
            const response = await llmClient.invoke([{ role: 'user', content: prompt }]);
            const parsed = parseJsonResponse(response.content);
            
            llmResponses.forecast_expert = parsed || { raw: response.content };
            
            sendEvent({ 
              type: 'agent_status', 
              agent: 'forecast_expert', 
              status: 'completed' 
            });
          }

          // 2.4 决策支持
          if (agents.includes('decision_support')) {
            sendEvent({ 
              type: 'agent_status', 
              agent: 'decision_support', 
              status: 'analyzing',
              message: '决策支持专家正在分析...' 
            });

            const prompt = fillPrompt(DECISION_SUPPORT_PROMPT, {
              topic,
              analysis_results: JSON.stringify({
                situation: llmResponses.situation_awareness,
                intelligence: llmResponses.intelligence_analyst,
                forecast: llmResponses.forecast_expert
              }, null, 2)
            });
            const response = await llmClient.invoke([{ role: 'user', content: prompt }]);
            const parsed = parseJsonResponse(response.content);
            
            llmResponses.decision_support = parsed || { raw: response.content };
            
            sendEvent({ 
              type: 'agent_status', 
              agent: 'decision_support', 
              status: 'completed' 
            });
          }

          // ========== 3. 生成事件图谱 ==========
          sendEvent({ 
            type: 'stage', 
            stage: 'event_graph', 
            message: '正在生成事件图谱...' 
          });

          const eventGraph = generateEventGraph(topic, searchItems, llmResponses);

          // ========== 4. 返回最终结果 ==========
          const finalResult = {
            topic,
            timestamp: new Date().toISOString(),
            search: {
              summary: searchResult.summary || '',
              count: searchItems.length,
              sources: searchItems.slice(0, 5).map(i => ({
                title: i.title,
                source: i.site_name
              }))
            },
            analysis: llmResponses,
            event_graph: eventGraph
          };

          sendEvent({ 
            type: 'complete', 
            result: finalResult 
          });

          controller.close();

        } catch (error) {
          console.error('Analysis error:', error);
          sendEvent({ 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析服务错误' },
      { status: 500 }
    );
  }
}

/**
 * 生成事件图谱
 */
function generateEventGraph(
  topic: string,
  searchItems: Array<{
    title: string;
    url: string;
    snippet: string;
    site_name: string;
    publish_time: string;
    authority_level: number;
  }>,
  analysis: Record<string, any>
) {
  // 时间线
  const timeline = [
    // 从 LLM 分析提取核心事件
    ...(analysis.situation_awareness?.core_events || []).slice(0, 5).map((e: any, i: number) => ({
      id: `core_${i + 1}`,
      event: e.event || e.description || '',
      time: e.timeframe || '当前',
      type: '核心事件',
      importance: e.importance || '高'
    })),
    // 从搜索结果补充
    ...searchItems.slice(0, 10).map((item, i) => ({
      id: `search_${i + 1}`,
      event: item.title,
      time: item.publish_time?.slice(0, 10) || '未知',
      type: '相关事件',
      importance: item.authority_level >= 8 ? '高' : '中',
      source: item.site_name,
      url: item.url
    }))
  ].slice(0, 15);

  // 因果链
  const causalChains = (analysis.situation_awareness?.key_factors || []).slice(0, 5).map((f: any, i: number) => ({
    id: `chain_${i + 1}`,
    cause: f.factor || f.description || '',
    effect: '影响态势发展',
    impact: f.impact || '中性'
  }));

  // 关键因素
  const keyFactors = [
    ...(analysis.situation_awareness?.key_factors || []).map((f: any) => ({
      name: f.factor || f.description || '',
      impact: f.impact || '中性',
      importance: f.importance || '中'
    })),
    ...(analysis.intelligence_analyst?.key_findings || []).slice(0, 3).map((f: any) => ({
      name: f.finding || f.description || '',
      impact: '重要',
      importance: '高'
    }))
  ].slice(0, 10);

  // 场景推演
  const scenarios = [
    ...(analysis.forecast_expert?.short_term?.trends || []).slice(0, 2).map((t: string) => ({
      name: t,
      probability: '中高',
      timeframe: '短期(1-3个月)'
    })),
    ...(analysis.forecast_expert?.medium_term?.trends || []).slice(0, 2).map((t: string) => ({
      name: t,
      probability: '中',
      timeframe: '中期(3-12个月)'
    })),
    ...(analysis.forecast_expert?.turning_points || []).slice(0, 2).map((p: any) => ({
      name: p.point || p.description || '',
      probability: p.probability || '中',
      timeframe: '关键转折点'
    }))
  ].slice(0, 6);

  // 可观测性指标
  const observability = [
    ...(analysis.decision_support?.monitoring_indicators || []).map((ind: any) => ({
      name: ind.indicator || ind.name || '',
      type: '决策指标',
      target: ind.target || '持续监控'
    }))
  ].slice(0, 8);

  return {
    topic,
    generated_at: new Date().toISOString(),
    timeline,
    causal_chains: causalChains,
    key_factors: keyFactors,
    scenarios,
    observability
  };
}
