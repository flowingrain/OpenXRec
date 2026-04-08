/**
 * 报告导出 API
 * POST /api/export - 导出分析报告到对象存储
 * GET /api/export - 获取导出的报告列表或下载链接
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadReport, getFileUrl, listFiles } from '@/lib/storage/object-storage';

/**
 * POST - 导出报告
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, topic, content, format = 'markdown' } = body;
    
    if (!caseId || !content) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: caseId, content',
      }, { status: 400 });
    }
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeTopic = (topic || 'analysis').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 50);
    const extensions: Record<string, string> = {
      pdf: 'pdf',
      markdown: 'md',
      html: 'html',
    };
    const filename = `${safeTopic}_${timestamp}.${extensions[format] || 'md'}`;
    
    // 如果是 HTML 格式，包装成完整文档
    let finalContent = content;
    if (format === 'html') {
      finalContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${topic || '分析报告'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    h3 { color: #4b5563; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f3f4f6; }
    .metadata { color: #6b7280; font-size: 0.9em; margin-bottom: 20px; }
    .section { margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
    .confidence { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #dbeafe; color: #1e40af; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #e5e7eb; margin: 2px; font-size: 0.85em; }
  </style>
</head>
<body>
  <h1>${topic || '宏观态势分析报告'}</h1>
  <div class="metadata">
    生成时间: ${new Date().toLocaleString('zh-CN')}<br>
    案例ID: ${caseId}
  </div>
  ${content}
</body>
</html>`;
    }
    
    // 上传报告
    const result = await uploadReport(caseId, {
      content: finalContent,
      filename,
      format,
    });
    
    return NextResponse.json({
      success: true,
      data: {
        key: result.key,
        url: result.url,
        filename,
        format,
        caseId,
        exportedAt: new Date().toISOString(),
      },
    });
    
  } catch (error: any) {
    console.error('[Export] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * GET - 获取报告列表或下载链接
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const caseId = searchParams.get('caseId');
    const key = searchParams.get('key');
    
    // 如果指定了 key，返回下载链接
    if (key) {
      const url = await getFileUrl(key, 3600); // 1 小时有效期
      return NextResponse.json({
        success: true,
        data: { key, url },
      });
    }
    
    // 否则返回报告列表
    if (caseId) {
      const result = await listFiles('reports', { caseId });
      
      const reports = await Promise.all(
        result.keys.map(async (k) => {
          const url = await getFileUrl(k);
          const filename = k.split('/').pop() || '';
          return { key: k, url, filename };
        })
      );
      
      return NextResponse.json({
        success: true,
        data: { reports, caseId },
      });
    }
    
    // 返回所有报告
    const result = await listFiles('reports');
    
    const reports = await Promise.all(
      result.keys.map(async (k) => {
        const url = await getFileUrl(k);
        const parts = k.split('/');
        const caseIdFromPath = parts[1];
        const filename = parts[parts.length - 1];
        return { key: k, url, caseId: caseIdFromPath, filename };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: { reports },
    });
    
  } catch (error: any) {
    console.error('[Export] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
