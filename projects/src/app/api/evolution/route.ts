import { NextRequest, NextResponse } from 'next/server';
import { createEvolutionManagerFromRequest } from '@/lib/evolution/evolution-manager';

/**
 * POST /api/evolution - 复盘进化操作
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
    const manager = createEvolutionManagerFromRequest(request);
    
    switch (action) {
      case 'saveCase':
        const savedCase = await manager.saveCase(data);
        return NextResponse.json({ success: true, data: savedCase });
      
      case 'getCase':
        const caseData = await manager.getCase(data.caseId);
        return NextResponse.json({ success: true, data: caseData });
      
      case 'searchCases':
        const cases = await manager.searchCases(data);
        return NextResponse.json({ success: true, data: cases });
      
      case 'findSimilarCases':
        const similar = await manager.findSimilarCases(data.query, data.topK, data.minSimilarity);
        return NextResponse.json({ success: true, data: similar });
      
      case 'submitFeedback':
        const feedback = await manager.submitFeedback(
          data.caseId,
          data.feedbackType,
          data.options
        );
        return NextResponse.json({ success: true, data: feedback });
      
      case 'createOptimization':
        const optimization = await manager.createOptimization(
          data.caseId,
          data.type,
          data.description,
          data.options
        );
        return NextResponse.json({ success: true, data: optimization });
      
      case 'applyOptimization':
        await manager.applyOptimization(data.optimizationId);
        return NextResponse.json({ success: true });
      
      case 'createExperiment':
        const experiment = await manager.createExperiment(data);
        return NextResponse.json({ success: true, data: experiment });
      
      case 'startExperiment':
        await manager.startExperiment(data.experimentId);
        return NextResponse.json({ success: true });
      
      case 'stopExperiment':
        await manager.stopExperiment(data.experimentId);
        return NextResponse.json({ success: true });
      
      case 'assignVariant':
        const variant = await manager.assignVariant(data.experimentId, data.caseId);
        return NextResponse.json({ success: true, data: { variant } });
      
      case 'recordExperimentRun':
        const run = await manager.recordExperimentRun(
          data.experimentId,
          data.variant,
          data.options
        );
        return NextResponse.json({ success: true, data: run });
      
      case 'analyzeExperiment':
        const result = await manager.analyzeExperiment(data.experimentId);
        return NextResponse.json({ success: true, data: result });
      
      case 'extractPatterns':
        const patterns = await manager.extractKnowledgePatterns();
        return NextResponse.json({ success: true, data: patterns });
      
      case 'getRelevantPatterns':
        const relevantPatterns = await manager.getRelevantPatterns(data.query, data.topK);
        return NextResponse.json({ success: true, data: relevantPatterns });
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Evolution API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/evolution - 获取案例列表和统计
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const manager = createEvolutionManagerFromRequest(request);
    
    switch (action) {
      case 'statistics':
        // 获取统计信息
        const { data: caseStats } = await manager['supabase']
          .from('analysis_cases')
          .select('domain, quality_score, feedback_count', { count: 'exact', head: true });
        
        const { data: experimentStats } = await manager['supabase']
          .from('ab_experiments')
          .select('status', { count: 'exact', head: true });
        
        return NextResponse.json({
          success: true,
          data: {
            totalCases: caseStats?.length || 0,
            totalExperiments: experimentStats?.length || 0
          }
        });
      
      case 'pendingOptimizations':
        const pending = await manager.getPendingOptimizations();
        return NextResponse.json({ success: true, data: pending });
      
      default:
        const cases = await manager.searchCases({
          limit: parseInt(searchParams.get('limit') || '20'),
          offset: parseInt(searchParams.get('offset') || '0')
        });
        return NextResponse.json({ success: true, data: cases });
    }
  } catch (error) {
    console.error('[Evolution API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
