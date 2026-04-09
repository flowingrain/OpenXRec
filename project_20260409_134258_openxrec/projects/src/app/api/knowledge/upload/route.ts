/**
 * 文档上传与解析 API
 * 
 * 支持：
 * - PDF 文档解析
 * - Word 文档解析
 * - Markdown 文档解析
 * - 纯文本解析
 * - 知识自动提取
 * - 文件存储到对象存储
 * - 元数据存储到 Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeAccumulator, DocumentType, UploadedDocument } from '@/lib/knowledge/knowledge-accumulator';
import { uploadKnowledgeDoc } from '@/lib/storage/object-storage';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { embeddingService } from '@/lib/embedding/service';

// ==================== 文档解析工具 ====================

/**
 * 解析文档内容
 * 注意：当前为简化实现，生产环境应使用专业解析库
 */
async function parseDocument(
  file: File,
  content: string
): Promise<{
  text: string;
  metadata: {
    title?: string;
    author?: string;
    createdAt?: string;
  };
}> {
  const filename = file.name;
  const extension = filename.split('.').pop()?.toLowerCase();
  
  // 根据文件类型处理
  switch (extension) {
    case 'md':
    case 'markdown':
      // Markdown 直接使用原始内容
      return {
        text: content,
        metadata: {
          title: extractMarkdownTitle(content) || filename
        }
      };
      
    case 'txt':
      // 纯文本直接使用
      return {
        text: content,
        metadata: {
          title: filename
        }
      };
      
    case 'pdf':
    case 'docx':
    case 'doc':
      // PDF/Word 需要前端预处理为文本
      // 这里假设前端已经将文件转换为文本
      return {
        text: content,
        metadata: {
          title: filename
        }
      };
      
    default:
      return {
        text: content,
        metadata: {
          title: filename
        }
      };
  }
}

/**
 * 从 Markdown 中提取标题
 */
function extractMarkdownTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

/**
 * 获取文档类型
 */
function getDocumentType(filename: string): DocumentType {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'txt':
      return 'txt';
    case 'html':
    case 'htm':
      return 'html';
    default:
      return 'txt';
  }
}

// ==================== POST: 上传文档 ====================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const content = formData.get('content') as string | null;
    const autoExtract = formData.get('autoExtract') !== 'false'; // 默认自动提取
    const tags = (formData.get('tags') as string)?.split(',').filter(Boolean) || [];
    
    // 验证
    if (!file && !content) {
      return NextResponse.json(
        { success: false, error: '请上传文件或提供文档内容' },
        { status: 400 }
      );
    }
    
    // 如果有文件但没有内容，尝试读取文件
    let documentContent = content || '';
    let filename = 'manual_input.txt';
    let fileSize = 0;
    
    if (file) {
      filename = file.name;
      fileSize = file.size;
      
      // 如果没有提供预处理内容，尝试读取文件
      if (!content) {
        try {
          // 对于文本类文件，直接读取
          if (file.type.startsWith('text/') || 
              filename.endsWith('.md') || 
              filename.endsWith('.txt')) {
            documentContent = await file.text();
          } else {
            // 对于 PDF/Word，提示使用预处理内容
            return NextResponse.json(
              { 
                success: false, 
                error: 'PDF/Word 文档请在前端预处理后提交文本内容',
                hint: '可以使用 pdf.js 或 mammoth.js 在前端解析文档'
              },
              { status: 400 }
            );
          }
        } catch (e) {
          return NextResponse.json(
            { success: false, error: '文件读取失败' },
            { status: 400 }
          );
        }
      }
    }
    
    // 解析文档
    const parsed = await parseDocument(file || { name: filename, size: fileSize } as File, documentContent);
    
    // 创建文档对象
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const document: UploadedDocument = {
      id: documentId,
      filename,
      type: getDocumentType(filename),
      size: fileSize || documentContent.length,
      uploadedAt: new Date().toISOString(),
      content: parsed.text,
      metadata: {
        title: parsed.metadata.title,
        author: parsed.metadata.author,
        createdAt: parsed.metadata.createdAt,
        tags
      }
    };
    
    // 上传文件到对象存储（如果有文件）
    let storageResult = null;
    if (file && fileSize > 0) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        storageResult = await uploadKnowledgeDoc({
          content: buffer,
          filename,
          contentType: file.type || 'application/octet-stream',
        }, {
          source: 'knowledge-upload',
          documentId,
        });
      } catch (e) {
        console.warn('Failed to upload to object storage:', e);
        // 继续处理，即使对象存储失败
      }
    }
    
    // 保存元数据到 Supabase
    let dbRecord = null;
    try {
      const supabase = getSupabaseClient();
      
      if (supabase) {
        const { data, error } = await supabase
          .from('knowledge_docs')
          .insert({
            id: documentId,
            title: parsed.metadata.title || filename,
            content: parsed.text.slice(0, 10000), // 只存储前 10000 字符
            file_url: storageResult?.key,
            file_type: document.type,
            file_size: document.size,
            metadata: {
              tags,
              author: parsed.metadata.author,
              storageKey: storageResult?.key,
              storageUrl: storageResult?.url,
            },
          })
          .select()
          .maybeSingle();
        
        if (!error) {
          dbRecord = data;
        }
      }
    } catch (e) {
      console.warn('Failed to save to Supabase:', e);
    }
    
    // 自动提取知识
    let extractionResult = null;
    
    if (autoExtract && parsed.text.length > 50) {
      const accumulator = getKnowledgeAccumulator();
      extractionResult = await accumulator.extractFromDocument(document);
    }
    
    // 自动生成嵌入向量（后台异步执行）
    let embeddingStatus = 'pending';
    if (dbRecord && parsed.text.length > 10) {
      // 不阻塞响应，后台生成嵌入
      embeddingService.indexDocument(dbRecord.id, parsed.text, {
        tags,
        title: parsed.metadata.title
      }).then(success => {
        console.log(`[Knowledge Upload] Embedding generated for ${documentId}: ${success ? 'success' : 'failed'}`);
      }).catch(err => {
        console.warn(`[Knowledge Upload] Embedding generation failed:`, err);
      });
      embeddingStatus = 'generating';
    }
    
    return NextResponse.json({
      success: true,
      data: {
        document: {
          id: document.id,
          filename: document.filename,
          type: document.type,
          size: document.size,
          uploadedAt: document.uploadedAt,
          title: document.metadata.title,
          wordCount: parsed.text.length,
          // 新增存储信息
          storageKey: storageResult?.key,
          storageUrl: storageResult?.url,
          dbId: dbRecord?.id,
          embeddingStatus, // 嵌入生成状态
        },
        extraction: extractionResult ? {
          entriesCount: extractionResult.entries.length,
          confidence: extractionResult.confidence,
          entries: extractionResult.entries.slice(0, 5) // 只返回前5条预览
        } : null
      },
      message: extractionResult 
        ? `文档上传成功，提取了 ${extractionResult.entries.length} 条知识${embeddingStatus === 'generating' ? '，正在生成向量嵌入...' : ''}`
        : `文档上传成功${embeddingStatus === 'generating' ? '，正在生成向量嵌入...' : ''}`
    });
    
  } catch (error) {
    console.error('[Document Upload API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// ==================== GET: 获取支持的文档类型 ====================

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      supportedTypes: [
        { extension: 'pdf', name: 'PDF 文档', requiresPreprocess: true },
        { extension: 'docx', name: 'Word 文档', requiresPreprocess: true },
        { extension: 'doc', name: 'Word 97-2003', requiresPreprocess: true },
        { extension: 'md', name: 'Markdown', requiresPreprocess: false },
        { extension: 'txt', name: '纯文本', requiresPreprocess: false },
        { extension: 'html', name: 'HTML', requiresPreprocess: false }
      ],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      recommendations: {
        pdf: '建议使用 pdf.js 在前端解析后提交文本',
        docx: '建议使用 mammoth.js 在前端解析后提交文本',
        markdown: '可直接上传，系统自动解析',
        txt: '可直接上传，系统自动解析'
      }
    }
  });
}
