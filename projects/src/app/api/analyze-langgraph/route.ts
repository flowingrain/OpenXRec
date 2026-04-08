/**
 * 基于 LangGraph 的态势分析 API
 * 
 * 功能：
 * - SSE 流式响应
 * - 使用 LangGraph 进行智能体编排
 * - 所有数据由智能体分析生成
 * - 增量图谱更新：每个智能体完成后立即推送图谱更新
 */

import { NextRequest } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { executeAnalysis, GraphCallbacks, AGENT_NODES, IncrementalGraphUpdate } from '@/lib/langgraph';

export async function POST(request: NextRequest) {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  
  const body = await request.json();
  const { query, topic, sessionId } = body;
  
  const actualQuery = query || topic;
  
  if (!actualQuery) {
    return new Response(
      JSON.stringify({ error: '缺少 query 或 topic 参数' }),
      { status: 400 }
    );
  }
  
  const encoder = new TextEncoder();
  let isClosed = false;  // 添加关闭标志
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = async (data: any) => {
        if (isClosed) {
          console.log('[SSE] Stream already closed, skipping send:', data.type);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.warn('[SSE] Failed to send data:', e);
        }
      };
      
      // 定义回调函数
      const callbacks: GraphCallbacks = {
        onAgentStart: async (agentId: string, agentName: string) => {
          await send({
            type: 'agent_start',
            agent: agentId,
            name: agentName,
            timestamp: Date.now()
          });
        },
        
        onAgentThinking: async (agentId: string, message: string) => {
          await send({
            type: 'agent_thinking',
            agent: agentId,
            message,
            timestamp: Date.now()
          });
        },
        
        onAgentComplete: async (agentId: string, result: string) => {
          await send({
            type: 'agent_complete',
            agent: agentId,
            result: result.substring(0, 150) + (result.length > 150 ? '...' : ''),
            timestamp: Date.now()
          });
        },
        
        onAgentSkip: async (agentId: string, agentName: string, reason: string) => {
          await send({
            type: 'agent_skip',
            agent: agentId,
            name: agentName,
            reason,
            timestamp: Date.now()
          });
        },
        
        onAgentSchedule: async (schedule: any) => {
          await send({
            type: 'agent_schedule',
            schedule,
            timestamp: Date.now()
          });
        },
        
        onSystem: async (message: string) => {
          await send({
            type: 'system',
            message,
            timestamp: Date.now()
          });
        },
        
        // 新增：增量图谱更新回调
        onIncrementalGraph: async (update: IncrementalGraphUpdate) => {
          await send({
            type: 'incremental_graph',
            update,
            timestamp: Date.now()
          });
        },
        
        onEventGraph: async (graph: any) => {
          await send({
            type: 'event_graph',
            graph,
            timestamp: Date.now()
          });
        }
      };
      
      try {
        // 发送开始事件
        await send({ 
          type: 'start', 
          sessionId: sessionId || `session-${Date.now()}`,
          timestamp: Date.now() 
        });
        
        // 执行分析
        const result = await executeAnalysis(actualQuery, customHeaders, callbacks);
        
        // 发送完成事件（eventGraph 已通过 onEventGraph 发送，这里不再重复）
        await send({
          type: 'complete',
          data: {
            report: result.finalReport,
            sessionId: sessionId || `session-${Date.now()}`,
            searchResults: result.searchResults || [],
            timeline: result.timeline || [],
            key_factors: result.keyFactors || [],
            scenarios: result.scenarios || [],
            causal_chains: result.causalChain || [],
            knowledgeGraph: result.knowledgeGraph,
            taskComplexity: result.taskComplexity,
            agentSchedule: result.agentSchedule,
            skippedAgents: result.skippedAgents,
            confidence: result.confidence,
          },
          timestamp: Date.now()
        });
        
        isClosed = true;
        controller.close();
        
      } catch (error) {
        console.error('[LangGraph API] Analysis error:', error);
        await send({
          type: 'error',
          error: error instanceof Error ? error.message : '分析失败',
          timestamp: Date.now()
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
}

// GET: 获取智能体节点列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'agents') {
    return Response.json({ agents: AGENT_NODES });
  }
  
  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
