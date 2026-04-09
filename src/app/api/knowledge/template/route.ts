/**
 * 知识模板API
 * 
 * 提供模板列表和从模板创建实体
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeTemplateService } from '@/lib/knowledge/template-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET: 获取模板列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const templateId = searchParams.get('id');

  try {
    if (templateId) {
      const template = knowledgeTemplateService.getTemplate(templateId);
      return NextResponse.json({
        success: true,
        data: { template },
      });
    }

    const templates = category
      ? knowledgeTemplateService.getTemplatesByCategory(category)
      : knowledgeTemplateService.getAllTemplates();

    const categories = knowledgeTemplateService.getCategories();

    return NextResponse.json({
      success: true,
      data: {
        templates,
        categories,
      },
    });
  } catch (error) {
    console.error('[KnowledgeTemplate API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST: 从模板创建实体
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, values } = body;

    if (!templateId || !values) {
      return NextResponse.json(
        { success: false, error: 'Missing templateId or values' },
        { status: 400 }
      );
    }

    // 从模板创建实体数据
    const entityData = knowledgeTemplateService.createFromTemplate(templateId, values);

    // 保存到数据库
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('kg_entities')
        .insert({
          name: entityData.name,
          type: entityData.type,
          description: entityData.description,
          aliases: entityData.aliases,
          importance: entityData.importance,
          properties: entityData.properties,
          source_type: 'manual',
          verified: false,
        })
        .select()
        .single();

      if (error) {
        console.error('[KnowledgeTemplate API] Insert error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to create entity' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { entity: data },
        message: '实体创建成功，等待审核',
      });
    }

    return NextResponse.json({
      success: true,
      data: { entity: entityData },
      message: '实体数据已生成（数据库不可用）',
    });
  } catch (error) {
    console.error('[KnowledgeTemplate API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
