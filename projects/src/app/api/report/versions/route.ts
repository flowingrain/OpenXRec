/**
 * 报告版本管理 API
 * POST /api/report/versions - 创建新版本
 * GET /api/report/versions - 获取版本历史
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { uploadReport, getFileUrl } from '@/lib/storage/object-storage';

/**
 * POST - 创建报告新版本
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, topic, content, format = 'markdown', changeNote } = body;

    if (!caseId || !content) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: caseId, content',
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取当前版本号
    let currentVersion = 1;
    const { data: versions, error: queryError } = await supabase
      .from('report_versions')
      .select('version')
      .eq('case_id', caseId)
      .order('version', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('[Report Versions] Query error:', queryError);
    }

    if (versions && versions.length > 0) {
      currentVersion = (versions[0].version as number) + 1;
    }

    // 上传到对象存储
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeTopic = (topic || 'report').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 50);
    const extensions: Record<string, string> = {
      markdown: 'md',
      html: 'html',
      pdf: 'pdf',
    };
    const filename = `${safeTopic}_v${currentVersion}_${timestamp}.${extensions[format] || 'md'}`;

    const storageResult = await uploadReport(caseId, {
      content,
      filename,
      format: format as 'markdown' | 'html' | 'pdf',
    });

    // 保存版本记录到数据库
    const { error: insertError } = await supabase
      .from('report_versions')
      .insert({
        case_id: caseId,
        version: currentVersion,
        storage_key: storageResult.key,
        storage_url: storageResult.url,
        format,
        change_note: changeNote,
      });

    if (insertError) {
      console.error('[Report Versions] Insert error:', insertError);
    }

    return NextResponse.json({
      success: true,
      data: {
        caseId,
        version: currentVersion,
        key: storageResult.key,
        url: storageResult.url,
        filename,
        format,
        changeNote,
        createdAt: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('[Report Versions] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * GET - 获取报告版本历史
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const caseId = searchParams.get('caseId');
    const version = searchParams.get('version');

    if (!caseId) {
      return NextResponse.json({
        success: false,
        error: '请提供 caseId 参数',
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 如果指定了版本号，返回该版本详情
    if (version) {
      const { data, error } = await supabase
        .from('report_versions')
        .select('*')
        .eq('case_id', caseId)
        .eq('version', parseInt(version))
        .maybeSingle();

      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message,
        }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({
          success: false,
          error: '版本不存在',
        }, { status: 404 });
      }

      // 获取新的签名 URL
      const url = await getFileUrl(data.storage_key);

      return NextResponse.json({
        success: true,
        data: {
          ...data,
          url,
        },
      });
    }

    // 返回所有版本列表
    const { data: versions, error } = await supabase
      .from('report_versions')
      .select('id, version, format, change_note, created_at, storage_key')
      .eq('case_id', caseId)
      .order('version', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 500 });
    }

    // 为每个版本生成访问 URL
    const versionsWithUrl = await Promise.all(
      (versions || []).map(async (v) => ({
        ...v,
        url: await getFileUrl(v.storage_key),
      }))
    );

    return NextResponse.json({
      success: true,
      data: {
        caseId,
        versions: versionsWithUrl,
        total: versionsWithUrl.length,
      },
    });

  } catch (error: any) {
    console.error('[Report Versions] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
