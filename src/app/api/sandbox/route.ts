import { NextRequest, NextResponse } from 'next/server';
import { HypothesisSandbox, createHypothesisSandbox, SandboxHypothesis, EvidenceInput } from '@/lib/langgraph/hypothesis-sandbox';

// 内存存储沙盒实例（生产环境应使用数据库）
const sandboxStore = new Map<string, HypothesisSandbox>();

/**
 * POST /api/sandbox - 创建沙盒或执行操作
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sandboxId, data } = body;

    switch (action) {
      case 'create':
        return handleCreate(data);
      
      case 'addHypothesis':
        return handleAddHypothesis(sandboxId, data);
      
      case 'addEvidence':
        return handleAddEvidence(sandboxId, data);
      
      case 'setCompetition':
        return handleSetCompetition(sandboxId, data);
      
      case 'rateEvidence':
        return handleRateEvidence(sandboxId, data);
      
      case 'searchEvidence':
        return handleSearchEvidence(sandboxId, data);
      
      case 'updateConfidence':
        return handleUpdateConfidence(sandboxId);
      
      case 'getState':
        return handleGetState(sandboxId);
      
      case 'exportReport':
        return handleExportReport(sandboxId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Sandbox API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sandbox - 获取沙盒列表或状态
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get('sandboxId');
  
  if (sandboxId) {
    const sandbox = sandboxStore.get(sandboxId);
    if (!sandbox) {
      return NextResponse.json(
        { error: 'Sandbox not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: sandbox.getState()
    });
  }
  
  // 返回所有沙盒列表
  const sandboxes = Array.from(sandboxStore.entries()).map(([id, sandbox]) => {
    const state = sandbox.getState();
    return {
      id,
      name: state.name,
      status: state.status,
      hypothesisCount: state.hypotheses.length,
      evidenceCount: state.allEvidence.length,
      createdAt: state.createdAt
    };
  });
  
  return NextResponse.json({
    success: true,
    data: sandboxes
  });
}

/**
 * DELETE /api/sandbox - 删除沙盒
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get('sandboxId');
  
  if (!sandboxId) {
    return NextResponse.json(
      { error: 'sandboxId is required' },
      { status: 400 }
    );
  }
  
  const deleted = sandboxStore.delete(sandboxId);
  return NextResponse.json({
    success: deleted,
    message: deleted ? 'Sandbox deleted' : 'Sandbox not found'
  });
}

// ============================================================================
// 处理函数
// ============================================================================

function handleCreate(data: { name: string; description?: string; config?: any }) {
  const sandbox = createHypothesisSandbox(
    data.name,
    data.description || '',
    data.config
  );
  const state = sandbox.getState();
  sandboxStore.set(state.id, sandbox);
  
  return NextResponse.json({
    success: true,
    data: {
      sandboxId: state.id,
      state
    }
  });
}

async function handleAddHypothesis(sandboxId: string, data: any) {
  const sandbox = sandboxStore.get(sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'Sandbox not found' },
      { status: 404 }
    );
  }
  
  try {
    const hypothesis = sandbox.addHypothesis(
      data.statement,
      data.initialConfidence,
      data.options
    );
    
    return NextResponse.json({
      success: true,
      data: {
        hypothesis,
        state: sandbox.getState()
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

async function handleAddEvidence(sandboxId: string, data: any) {
  const sandbox = sandboxStore.get(sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'Sandbox not found' },
      { status: 404 }
    );
  }
  
  const evidenceInput: EvidenceInput = {
    content: data.content,
    source: data.source,
    sourceUrl: data.sourceUrl
  };
  
  const evidence = await sandbox.addEvidence(evidenceInput, data.targetHypothesisIds);
  
  return NextResponse.json({
    success: true,
    data: {
      evidence,
      state: sandbox.getState()
    }
  });
}

function handleSetCompetition(sandboxId: string, data: any) {
  const sandbox = sandboxStore.get(sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'Sandbox not found' },
      { status: 404 }
    );
  }
  
  sandbox.setCompetition(data.hypothesisId, data.competitorIds);
  
  return NextResponse.json({
    success: true,
    data: sandbox.getState()
  });
}

function handleRateEvidence(sandboxId: string, data: any) {
  const sandbox = sandboxStore.get(sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'Sandbox not found' },
      { status: 404 }
    );
  }
  
  sandbox.rateEvidence(data.evidenceId, data.rating, data.notes);
  
  return NextResponse.json({
    success: true,
    data: sandbox.getState()
  });
}

async function handleSearchEvidence(sandboxId: string, data: any) {
  const sandbox = sandboxStore.get(sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'Sandbox not found' },
      { status: 404 }
    );
  }
  
  const results = await sandbox.searchEvidence(data.query);
  
  return NextResponse.json({
    success: true,
    data: results
  });
}

function handleUpdateConfidence(sandboxId: string) {
  const sandbox = sandboxStore.get(sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'Sandbox not found' },
      { status: 404 }
    );
  }
  
  sandbox.updateAllConfidences();
  
  return NextResponse.json({
    success: true,
    data: sandbox.getState()
  });
}

function handleGetState(sandboxId: string) {
  const sandbox = sandboxStore.get(sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'Sandbox not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    success: true,
    data: sandbox.getState()
  });
}

function handleExportReport(sandboxId: string) {
  const sandbox = sandboxStore.get(sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'Sandbox not found' },
      { status: 404 }
    );
  }
  
  const report = sandbox.exportReport();
  
  return NextResponse.json({
    success: true,
    data: { report }
  });
}
