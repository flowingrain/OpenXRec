/**
 * 知识管理 API
 * 
 * 支持的操作：
 * - GET: 检索知识（支持关键词搜索和类型过滤）
 * - POST: 添加知识（用户手动输入）、批量操作
 * - PUT: 编辑知识
 * - DELETE: 删除知识
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeManager, KnowledgeType, KnowledgeEntry } from '@/lib/knowledge';
import { getKnowledgeAccumulator } from '@/lib/knowledge/knowledge-accumulator';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== GET: 检索知识 ====================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || '';
    const type = searchParams.get('type') as KnowledgeType | null;
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const knowledgeManager = getKnowledgeManager();
    
    // 如果没有查询条件，返回所有知识
    if (!query && !type && tags.length === 0) {
      const allKnowledge = knowledgeManager.getAllKnowledge();
      const stats = knowledgeManager.getStats();
      
      return NextResponse.json({
        success: true,
        data: {
          entries: allKnowledge.slice(0, limit),
          stats
        }
      });
    }
    
    // 搜索知识
    const results = await knowledgeManager.searchKnowledge(query, {
      limit,
      types: type ? [type] : undefined,
      tags: tags.length > 0 ? tags : undefined
    });
    
    return NextResponse.json({
      success: true,
      data: {
        results,
        query,
        total: results.length
      }
    });
    
  } catch (error) {
    console.error('[Knowledge API] GET error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// ==================== POST: 添加知识 ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
    
    const accumulator = getKnowledgeAccumulator();
    
    switch (action) {
      case 'add': {
        // 用户手动添加知识
        const { title, content, type, tags, relatedEntities } = data;
        
        if (!title || !content) {
          return NextResponse.json(
            { success: false, error: '标题和内容不能为空' },
            { status: 400 }
          );
        }
        
        const entry = await accumulator.addUserKnowledge({
          title,
          content,
          type,
          tags,
          relatedEntities
        });
        
        return NextResponse.json({
          success: true,
          data: { entry },
          message: '知识添加成功'
        });
      }
      
      case 'extract_from_analysis': {
        // 从分析结果自动提取知识
        const { query, conclusion, keyFactors, causalChains, scenarios } = data;
        
        const entries = await accumulator.extractFromAnalysis({
          query,
          conclusion,
          keyFactors: keyFactors || [],
          causalChains: causalChains || [],
          scenarios: scenarios || []
        });
        
        return NextResponse.json({
          success: true,
          data: { entries, count: entries.length },
          message: `从分析中提取了 ${entries.length} 条知识`
        });
      }
      
      case 'learn_from_feedback': {
        // 从用户反馈学习
        const { caseId, feedbackType, originalContent, userCorrection, reason } = data;
        
        const entry = await accumulator.learnFromFeedback({
          caseId,
          feedbackType,
          originalContent,
          userCorrection,
          reason
        });
        
        if (!entry) {
          return NextResponse.json({
            success: true,
            data: { entry: null },
            message: '该反馈类型不需要生成新知识'
          });
        }
        
        return NextResponse.json({
          success: true,
          data: { entry },
          message: '从反馈中学习成功'
        });
      }
      
      case 'batch_add': {
        // 批量添加知识
        const { entries } = data;
        
        if (!Array.isArray(entries) || entries.length === 0) {
          return NextResponse.json(
            { success: false, error: '知识列表不能为空' },
            { status: 400 }
          );
        }
        
        const addedEntries: KnowledgeEntry[] = [];
        
        for (const item of entries) {
          const entry = await accumulator.addUserKnowledge({
            title: item.title,
            content: item.content,
            type: item.type,
            tags: item.tags,
            relatedEntities: item.relatedEntities
          });
          addedEntries.push(entry);
        }
        
        return NextResponse.json({
          success: true,
          data: { entries: addedEntries, count: addedEntries.length },
          message: `批量添加了 ${addedEntries.length} 条知识`
        });
      }
      
      default:
        return NextResponse.json(
          { success: false, error: '未知操作类型' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('[Knowledge API] POST error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// ==================== PUT: 编辑知识 ====================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, data } = body;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少知识ID' },
        { status: 400 }
      );
    }
    
    const { title, content, type, tags, relatedEntities, confidence } = data;
    
    // 尝试从数据库更新
    const supabase = getSupabaseClient();
    if (supabase) {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (title) updateData.title = title;
      if (content) updateData.content = content;
      if (type) updateData.file_type = type;
      
      if (tags || relatedEntities || confidence) {
        const { data: existing } = await supabase
          .from('knowledge_docs')
          .select('metadata')
          .eq('id', id)
          .maybeSingle();
        
        const existingMetadata = existing?.metadata || {};
        updateData.metadata = {
          ...existingMetadata,
          ...(tags && { tags }),
          ...(relatedEntities && { relatedEntities }),
          ...(confidence && { confidence }),
        };
      }
      
      const { error } = await supabase
        .from('knowledge_docs')
        .update(updateData)
        .eq('id', id);
      
      if (error) {
        console.error('[Knowledge API] Database update error:', error);
        return NextResponse.json(
          { success: false, error: '更新失败：' + error.message },
          { status: 500 }
        );
      }
    }
    
    // 同时更新内存中的知识
    const knowledgeManager = getKnowledgeManager();
    const updated = knowledgeManager.updateKnowledge(id, {
      title,
      content,
      type,
      metadata: {
        tags,
        relatedEntities,
        confidence,
      }
    });
    
    return NextResponse.json({
      success: true,
      data: { entry: updated },
      message: '知识更新成功'
    });
    
  } catch (error) {
    console.error('[Knowledge API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// ==================== DELETE: 删除知识 ====================

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const ids = searchParams.get('ids'); // 支持批量删除
    
    if (!id && !ids) {
      return NextResponse.json(
        { success: false, error: '缺少知识ID' },
        { status: 400 }
      );
    }
    
    // 从数据库删除
    const supabase = getSupabaseClient();
    if (supabase) {
      if (ids) {
        // 批量删除
        const idList = ids.split(',').filter(Boolean);
        const { error } = await supabase
          .from('knowledge_docs')
          .delete()
          .in('id', idList);
        
        if (error) {
          console.error('[Knowledge API] Batch delete error:', error);
          return NextResponse.json(
            { success: false, error: '批量删除失败：' + error.message },
            { status: 500 }
          );
        }
        
        // 从内存中删除
        const knowledgeManager = getKnowledgeManager();
        idList.forEach(id => knowledgeManager.deleteKnowledge(id));
        
        return NextResponse.json({
          success: true,
          message: `成功删除 ${idList.length} 条知识`
        });
      } else {
        // 单条删除
        const { error } = await supabase
          .from('knowledge_docs')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error('[Knowledge API] Delete error:', error);
          return NextResponse.json(
            { success: false, error: '删除失败：' + error.message },
            { status: 500 }
          );
        }
        
        // 从内存中删除
        const knowledgeManager = getKnowledgeManager();
        knowledgeManager.deleteKnowledge(id!);
        
        return NextResponse.json({
          success: true,
          message: '知识删除成功'
        });
      }
    }
    
    // 如果没有数据库连接，仅从内存删除
    const knowledgeManager = getKnowledgeManager();
    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      idList.forEach(id => knowledgeManager.deleteKnowledge(id));
      return NextResponse.json({
        success: true,
        message: `成功删除 ${idList.length} 条知识（仅内存）`
      });
    } else {
      knowledgeManager.deleteKnowledge(id!);
      return NextResponse.json({
        success: true,
        message: '知识删除成功（仅内存）'
      });
    }
    
  } catch (error) {
    console.error('[Knowledge API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
