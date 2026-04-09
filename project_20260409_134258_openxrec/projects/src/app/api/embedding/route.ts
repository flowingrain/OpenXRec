/**
 * 向量索引管理 API
 * 
 * 功能：
 * - 获取嵌入统计信息
 * - 为未索引的文档/实体生成嵌入
 * - 执行数据库迁移
 */

import { NextRequest, NextResponse } from 'next/server';
import { embeddingService } from '@/lib/embedding/service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * GET: 获取嵌入统计信息
 */
export async function GET() {
  try {
    const stats = await embeddingService.getEmbeddingStats();
    
    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Embedding API] Get stats error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST: 执行嵌入索引或迁移
 * 
 * Body:
 * - action: 'index_docs' | 'index_entities' | 'migrate' | 'check_pgvector'
 * - batchSize: number (default 10)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, batchSize = 10 } = body;

    switch (action) {
      case 'index_docs':
        // 为未索引的文档生成嵌入
        const docsResult = await embeddingService.indexPendingDocuments(batchSize);
        return NextResponse.json({
          success: true,
          data: docsResult,
          message: `处理了 ${docsResult.processed} 个文档，成功 ${docsResult.success}，失败 ${docsResult.failed}`
        });

      case 'index_entities':
        // 为未索引的实体生成嵌入
        const entitiesResult = await embeddingService.indexPendingEntities(batchSize);
        return NextResponse.json({
          success: true,
          data: entitiesResult,
          message: `处理了 ${entitiesResult.processed} 个实体，成功 ${entitiesResult.success}，失败 ${entitiesResult.failed}`
        });

      case 'check_pgvector':
        // 检查 pgvector 扩展是否已安装
        const supabase = getSupabaseClient();
        
        if (!supabase) {
          return NextResponse.json({
            success: false,
            installed: false,
            error: '数据库连接不可用'
          });
        }

        const { data: extensions, error } = await supabase
          .rpc('query', { 
            query: "SELECT * FROM pg_extension WHERE extname = 'vector'" 
          })
          .maybeSingle();

        if (error) {
          return NextResponse.json({
            success: false,
            installed: false,
            error: error.message,
            hint: '请执行迁移脚本: supabase/migrations/002_add_vector_embeddings.sql'
          });
        }

        return NextResponse.json({
          success: true,
          installed: !!extensions,
          message: extensions 
            ? 'pgvector 扩展已安装' 
            : 'pgvector 扩展未安装，请执行迁移脚本'
        });

      case 'migrate':
        // 执行简化版迁移（仅添加列，不创建函数）
        return await executeSimpleMigration();

      default:
        return NextResponse.json(
          { success: false, error: '未知操作，支持: index_docs, index_entities, check_pgvector, migrate' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Embedding API] POST error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 执行简化版迁移
 * 仅添加向量列，不创建 RPC 函数（需要在 Supabase 控制台手动执行完整迁移）
 */
async function executeSimpleMigration(): Promise<NextResponse> {
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    return NextResponse.json({
      success: false,
      needsManualMigration: true,
      message: '数据库连接不可用，请检查环境配置'
    });
  }

  try {
    // 检查列是否已存在
    const { data: docsColumns, error: docsError } = await supabase
      .rpc('query', {
        query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_docs' AND column_name = 'embedding'"
      });

    const { data: entitiesColumns, error: entitiesError } = await supabase
      .rpc('query', {
        query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'kg_entities' AND column_name = 'embedding'"
      });

    const docsHasEmbedding = docsColumns && docsColumns.length > 0;
    const entitiesHasEmbedding = entitiesColumns && entitiesColumns.length > 0;

    if (docsHasEmbedding && entitiesHasEmbedding) {
      return NextResponse.json({
        success: true,
        message: '向量列已存在，无需迁移',
        status: {
          knowledge_docs: 'ready',
          kg_entities: 'ready'
        }
      });
    }

    // 如果 RPC 不可用，返回手动迁移指南
    return NextResponse.json({
      success: false,
      needsManualMigration: true,
      message: '请在 Supabase SQL 编辑器中执行迁移脚本',
      migrationScript: `
-- 1. 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 添加向量列
ALTER TABLE knowledge_docs 
ADD COLUMN IF NOT EXISTS embedding vector(1024),
ADD COLUMN IF NOT EXISTS embedding_model varchar(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamp with time zone;

ALTER TABLE kg_entities 
ADD COLUMN IF NOT EXISTS embedding vector(1024),
ADD COLUMN IF NOT EXISTS embedding_model varchar(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamp with time zone;

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_embedding 
ON knowledge_docs USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_kg_entities_embedding 
ON kg_entities USING hnsw (embedding vector_cosine_ops);
`
    });
  } catch (error) {
    console.error('[Embedding API] Migration check error:', error);
    return NextResponse.json({
      success: false,
      needsManualMigration: true,
      message: '无法检查迁移状态，请手动执行迁移脚本',
      migrationPath: 'supabase/migrations/002_add_vector_embeddings.sql'
    });
  }
}
