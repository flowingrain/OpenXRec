/**
 * 文件上传 API
 * POST /api/storage/upload - 上传文件到对象存储
 * GET /api/storage/upload - 获取文件访问 URL
 * DELETE /api/storage/upload - 删除文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  uploadFile, 
  getFileUrl, 
  deleteFile, 
  fileExists,
  listFiles,
  type StorageCategory 
} from '@/lib/storage/object-storage';

/**
 * POST - 上传文件
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const file = formData.get('file') as File | null;
    const category = formData.get('category') as StorageCategory || 'uploads';
    const caseId = formData.get('caseId') as string | null;
    const filename = formData.get('filename') as string | null;
    
    if (!file) {
      // 如果没有文件，检查是否是文本内容上传
      const content = formData.get('content') as string | null;
      const contentType = formData.get('contentType') as string | null;
      const name = filename || formData.get('filename') as string;
      
      if (!content || !name || !contentType) {
        return NextResponse.json({
          success: false,
          error: '请提供文件或文本内容',
        }, { status: 400 });
      }
      
      // 上传文本内容
      const result = await uploadFile(category, {
        content,
        filename: name,
        contentType,
      }, caseId ? { caseId } : undefined);
      
      return NextResponse.json({
        success: true,
        data: {
          key: result.key,
          url: result.url,
          category,
          caseId,
        },
      });
    }
    
    // 上传文件
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(category, {
      content: buffer,
      filename: filename || file.name,
      contentType: file.type,
    }, caseId ? { caseId } : undefined);
    
    return NextResponse.json({
      success: true,
      data: {
        key: result.key,
        url: result.url,
        originalName: file.name,
        size: file.size,
        category,
        caseId,
      },
    });
    
  } catch (error: any) {
    console.error('[Storage Upload] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * GET - 获取文件 URL 或列出文件
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');
    const category = searchParams.get('category') as StorageCategory | null;
    const caseId = searchParams.get('caseId');
    const expireTime = searchParams.get('expireTime');
    
    // 如果指定了 key，返回文件 URL
    if (key) {
      const exists = await fileExists(key);
      if (!exists) {
        return NextResponse.json({
          success: false,
          error: '文件不存在',
        }, { status: 404 });
      }
      
      const url = await getFileUrl(key, expireTime ? parseInt(expireTime) : undefined);
      
      return NextResponse.json({
        success: true,
        data: { key, url },
      });
    }
    
    // 否则列出文件
    if (category) {
      const result = await listFiles(category, {
        caseId: caseId || undefined,
        maxKeys: 100,
      });
      
      // 为每个文件生成 URL
      const files = await Promise.all(
        result.keys.map(async (k) => ({
          key: k,
          url: await getFileUrl(k),
        }))
      );
      
      return NextResponse.json({
        success: true,
        data: {
          files,
          isTruncated: result.isTruncated,
          nextToken: result.nextContinuationToken,
        },
      });
    }
    
    return NextResponse.json({
      success: false,
      error: '请提供 key 或 category 参数',
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('[Storage Upload] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * DELETE - 删除文件
 */
export async function DELETE(request: NextRequest) {
  try {
    const { key } = await request.json();
    
    if (!key) {
      return NextResponse.json({
        success: false,
        error: '请提供文件 key',
      }, { status: 400 });
    }
    
    const exists = await fileExists(key);
    if (!exists) {
      return NextResponse.json({
        success: false,
        error: '文件不存在',
      }, { status: 404 });
    }
    
    const deleted = await deleteFile(key);
    
    return NextResponse.json({
      success: deleted,
      data: { key },
    });
    
  } catch (error: any) {
    console.error('[Storage Upload] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
