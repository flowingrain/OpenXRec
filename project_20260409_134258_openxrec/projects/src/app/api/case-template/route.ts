/**
 * 案例模板API
 */

import { NextRequest, NextResponse } from 'next/server';
import { caseTemplateService } from '@/lib/knowledge/case-template-service';

// GET: 获取模板列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  const templateId = searchParams.get('id');

  try {
    if (templateId) {
      const templates = await caseTemplateService.getTemplates();
      const template = templates.find(t => t.id === templateId);
      return NextResponse.json({
        success: true,
        data: { template },
      });
    }

    const templates = await caseTemplateService.getTemplates(domain || undefined);

    return NextResponse.json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    console.error('[CaseTemplate API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST: 创建模板或应用模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, caseId, templateId, values } = body;

    if (action === 'create' && caseId) {
      const template = await caseTemplateService.createTemplateFromCase(caseId);
      if (!template) {
        return NextResponse.json(
          { success: false, error: 'Failed to create template from case' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        data: { template },
        message: '模板创建成功',
      });
    }

    if (action === 'apply' && templateId && values) {
      const result = await caseTemplateService.applyTemplate(templateId, values);
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Failed to apply template' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        data: { result },
        message: '模板应用成功',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action or missing parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[CaseTemplate API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
