/**
 * 存储健康检查 API
 * GET /api/storage/health - 检查对象存储连接状态
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { getStorage } = await import('@/lib/storage/object-storage');
    const storage = getStorage();
    
    // 尝试列出文件来验证连接
    const result = await storage.listFiles({ maxKeys: 1 });
    
    return NextResponse.json({
      success: true,
      connection: 'ok',
      endpoint: process.env.COZE_BUCKET_ENDPOINT_URL,
      bucket: process.env.COZE_BUCKET_NAME,
      message: '✅ 对象存储配置正常',
      test: {
        canList: true,
        keyCount: result.keys.length,
      },
    });
    
  } catch (error: any) {
    console.error('[Storage Health] Error:', error);
    return NextResponse.json({
      success: false,
      connection: 'failed',
      endpoint: process.env.COZE_BUCKET_ENDPOINT_URL,
      bucket: process.env.COZE_BUCKET_NAME,
      error: error.message,
      message: '❌ 对象存储连接失败，请检查配置',
    }, { status: 500 });
  }
}
