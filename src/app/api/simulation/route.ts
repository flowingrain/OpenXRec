import { NextRequest, NextResponse } from 'next/server';
import { quickSimulate, EventSimulationResult } from '@/lib/langgraph/event-driven-simulation';

/**
 * POST /api/simulation - 执行事件驱动推演
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, context, config } = body;
    
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }
    
    // 执行推演
    const result = await quickSimulate(topic, context, config);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Simulation API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
