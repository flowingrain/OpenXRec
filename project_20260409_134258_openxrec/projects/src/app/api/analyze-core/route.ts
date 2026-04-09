import { NextRequest } from 'next/server';
import { LLMClient, SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { 
  CoordinatorAgent,
  SearchAgent,
  SourceEvaluatorAgent,
  TimelineAgent,
  CausalInferenceAgent,
  ScenarioAgent,
  KeyFactorAgent,
  ReportAgent,
  QualityCheckAgent
} from '@/lib/core-agents';

/**
 * 核心Agent API - 三层混合架构
 * 
 * 协调层：协调器Agent
 * 感知层：搜索、信源评估、时间线
 * 认知层：因果推理、场景推演、关键因素
 * 行动层：报告生成、质量检查
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
          // 创建所有Agent
          sendEvent({ 
            type: 'system', 
            message: '正在初始化三层混合架构Agent系统...' 
          });
          
          // 协调层
          const coordinator = new CoordinatorAgent(llmClient, searchClient);
          
          // 感知层
          const search = new SearchAgent(llmClient, searchClient);
          const sourceEvaluator = new SourceEvaluatorAgent(llmClient);
          const timeline = new TimelineAgent(llmClient);
          
          // 认知层
          const causalInference = new CausalInferenceAgent(llmClient);
          const scenario = new ScenarioAgent(llmClient);
          const keyFactor = new KeyFactorAgent(llmClient);
          
          // 行动层
          const report = new ReportAgent(llmClient);
          const qualityCheck = new QualityCheckAgent(llmClient);
          
          // 注册所有Agent到协调器
          coordinator.registerAgent(search);
          coordinator.registerAgent(sourceEvaluator);
          coordinator.registerAgent(timeline);
          coordinator.registerAgent(causalInference);
          coordinator.registerAgent(scenario);
          coordinator.registerAgent(keyFactor);
          coordinator.registerAgent(report);
          coordinator.registerAgent(qualityCheck);
          
          sendEvent({ 
            type: 'system', 
            message: 'Agent系统初始化完成，共10个Agent已就绪' 
          });
          
          // 执行协调分析
          const result = await coordinator.execute(
            { query: topic },
            (event) => {
              // 转发所有Agent事件
              sendEvent(event);
            }
          );
          
          if (result.success) {
            sendEvent({ 
              type: 'complete',
              message: '分析完成',
              data: result.data
            });
          } else {
            sendEvent({ 
              type: 'error', 
              error: result.error || '分析失败' 
            });
          }
          
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
