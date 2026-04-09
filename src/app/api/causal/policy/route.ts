/**
 * 政策模拟API
 * 执行政策干预模拟分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPolicySimulator, createPolicyFromTemplate } from '@/lib/causal/policy-simulator';
import { createSCMBuilder } from '@/lib/causal/scm-builder';
import { createCausalDiscoveryEngine } from '@/lib/causal/discovery-engine';
import { PolicyIntervention } from '@/lib/causal/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;
    
    switch (action) {
      case 'simulate':
        return await handleSimulate(params);
      
      case 'quick_assess':
        return await handleQuickAssess(params);
      
      case 'compare':
        return await handleCompare(params);
      
      case 'create_from_template':
        return await handleCreateFromTemplate(params);
      
      default:
        return NextResponse.json(
          { error: '未知的操作类型' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API /causal/policy] Error:', error);
    return NextResponse.json(
      { error: '政策模拟失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

/**
 * 执行政策模拟
 */
async function handleSimulate(params: {
  scm: any;
  policy: PolicyIntervention;
}) {
  if (!params.scm || !params.policy) {
    return NextResponse.json(
      { error: '请提供因果模型和政策干预' },
      { status: 400 }
    );
  }
  
  const simulator = createPolicySimulator();
  const result = await simulator.simulatePolicy(params.scm, params.policy);
  
  return NextResponse.json({
    success: true,
    data: result,
  });
}

/**
 * 快速政策评估
 */
async function handleQuickAssess(params: {
  scm: any;
  policyDescription: string;
}) {
  if (!params.scm || !params.policyDescription) {
    return NextResponse.json(
      { error: '请提供因果模型和政策描述' },
      { status: 400 }
    );
  }
  
  const simulator = createPolicySimulator();
  const result = await simulator.quickAssess(params.scm, params.policyDescription);
  
  return NextResponse.json({
    success: true,
    data: result,
  });
}

/**
 * 对比多个政策方案
 */
async function handleCompare(params: {
  scm: any;
  policies: PolicyIntervention[];
}) {
  if (!params.scm || !params.policies || params.policies.length < 2) {
    return NextResponse.json(
      { error: '请提供因果模型和至少两个政策方案' },
      { status: 400 }
    );
  }
  
  const simulator = createPolicySimulator();
  const result = await simulator.comparePolicies(params.scm, params.policies);
  
  return NextResponse.json({
    success: true,
    data: result,
  });
}

/**
 * 从模板创建政策
 */
async function handleCreateFromTemplate(params: {
  templateId: string;
  templateType: 'monetary' | 'trade' | 'industrial';
  customizations?: Partial<PolicyIntervention>;
}) {
  const policy = createPolicyFromTemplate(
    params.templateId,
    params.templateType,
    params.customizations
  );
  
  if (!policy) {
    return NextResponse.json(
      { error: '未找到指定的政策模板' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    success: true,
    data: policy,
  });
}
