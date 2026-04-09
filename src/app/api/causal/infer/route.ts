/**
 * 因果推断API
 * 执行因果查询、干预分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSCMBuilder } from '@/lib/causal/scm-builder';
import { createCausalInferenceEngine } from '@/lib/causal/inference-engine';
import { createCausalDiscoveryEngine } from '@/lib/causal/discovery-engine';
import { CausalQuery, Intervention, CounterfactualScenario } from '@/lib/causal/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;
    
    switch (action) {
      case 'build_model':
        return await handleBuildModel(params);
      
      case 'query':
        return await handleQuery(params);
      
      case 'intervene':
        return await handleIntervene(params);
      
      case 'counterfactual':
        return await handleCounterfactual(params);
      
      default:
        return NextResponse.json(
          { error: '未知的操作类型' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API /causal/infer] Error:', error);
    return NextResponse.json(
      { error: '因果推断失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 构建因果模型
 */
async function handleBuildModel(params: {
  text?: string;
  discoveryResult?: any;
  domain?: string;
  scenario?: string;
}) {
  const scmBuilder = createSCMBuilder();
  
  let scm;
  if (params.discoveryResult) {
    scm = await scmBuilder.buildFromDiscovery(params.discoveryResult, {
      domain: params.domain,
      scenario: params.scenario,
    });
  } else if (params.text) {
    scm = await scmBuilder.buildFromText(params.text, params.domain);
  } else {
    return NextResponse.json(
      { error: '请提供文本或发现结果' },
      { status: 400 }
    );
  }
  
  const causalGraph = scmBuilder.buildCausalGraph(scm);
  
  return NextResponse.json({
    success: true,
    data: {
      scm,
      causalGraph,
    },
  });
}

/**
 * 执行因果查询
 */
async function handleQuery(params: {
  scm: any;
  query: CausalQuery;
}) {
  if (!params.scm || !params.query) {
    return NextResponse.json(
      { error: '请提供因果模型和查询参数' },
      { status: 400 }
    );
  }
  
  const inferenceEngine = createCausalInferenceEngine();
  const result = await inferenceEngine.executeQuery(params.scm, params.query);
  
  return NextResponse.json({
    success: true,
    data: result,
  });
}

/**
 * 执行干预分析
 */
async function handleIntervene(params: {
  scm: any;
  intervention: Intervention;
  targetVariable: string;
}) {
  if (!params.scm || !params.intervention || !params.targetVariable) {
    return NextResponse.json(
      { error: '请提供因果模型、干预操作和目标变量' },
      { status: 400 }
    );
  }
  
  const inferenceEngine = createCausalInferenceEngine();
  const result = await inferenceEngine.performIntervention(
    params.scm,
    params.intervention,
    params.targetVariable
  );
  
  return NextResponse.json({
    success: true,
    data: result,
  });
}

/**
 * 执行反事实推断
 */
async function handleCounterfactual(params: {
  scm: any;
  scenario: CounterfactualScenario;
}) {
  if (!params.scm || !params.scenario) {
    return NextResponse.json(
      { error: '请提供因果模型和反事实场景' },
      { status: 400 }
    );
  }
  
  const inferenceEngine = createCausalInferenceEngine();
  const result = await inferenceEngine.performCounterfactual(params.scm, params.scenario);
  
  return NextResponse.json({
    success: true,
    data: result,
  });
}
