import { NextRequest } from 'next/server';
import { LLMClient, SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { AgentOrchestrator } from '@/lib/true-agent-framework';

/**
 * True Agent API - 五层智能体协作架构
 * 
 * 感知 → 认知 → 决策 → 行动 → 进化
 */

export async function POST(request: NextRequest) {
  try {
    const { topic, timeRange = '3m' } = await request.json();
    
    if (!topic) {
      return new Response(
        JSON.stringify({ error: '请输入分析主题' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);
    const searchClient = new SearchClient(config, customHeaders);

    const encoder = new TextEncoder();
    let isClosed = false;
    
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          if (!isClosed) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            } catch (e) {
              // Controller already closed, ignore
            }
          }
        };

        try {
          // 创建编排器
          const orchestrator = new AgentOrchestrator(llmClient, searchClient);
          
          sendEvent({ 
            type: 'stage', 
            agent: 'orchestrator',
            message: '五层智能体系统初始化完成，开始分析...' 
          });

          // 执行五层智能体分析
          const result = await orchestrator.analyze(topic, timeRange, (event) => {
            sendEvent(event);
          });

          sendEvent({ 
            type: 'complete',
            message: '分析完成',
            data: result
          });

          isClosed = true;
          controller.close();
        } catch (error) {
          console.error('Agent error:', error);
          sendEvent({ 
            type: 'error', 
            error: error instanceof Error ? error.message : '分析失败' 
          });
          isClosed = true;
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
