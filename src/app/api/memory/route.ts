/**
 * 记忆管理API
 * 
 * 功能：
 * - 搜索记忆
 * - 添加记忆
 * - 删除记忆
 * - 获取记忆统计
 */

import { NextRequest } from 'next/server';
import { memoryManager, InMemoryStore } from '@/lib/memory';

// GET: 搜索记忆或获取统计
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '10');
  
  try {
    if (action === 'search' && query) {
      // 搜索记忆
      const results = await memoryManager.recall(query, limit);
      
      return Response.json({
        results: results.map(r => ({
          id: r.entry.id,
          type: r.entry.type,
          content: r.entry.content.substring(0, 200) + '...',
          relevance: r.relevance,
          timestamp: r.entry.metadata.timestamp
        }))
      });
    }
    
    if (action === 'stats') {
      // 获取统计信息
      const currentSession = memoryManager.getCurrentSession();
      
      return Response.json({
        currentSession: currentSession ? {
          sessionId: currentSession.sessionId,
          messageCount: currentSession.messages.length,
          entityCount: currentSession.context.entities.length,
          preferenceCount: Object.keys(currentSession.context.preferences).length
        } : null,
        storeType: 'InMemoryStore'
      });
    }
    
    return Response.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Memory API error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// POST: 添加记忆
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, content, importance = 0.7, agentId } = body;
    
    if (!type || !content) {
      return Response.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    const memoryId = await memoryManager.addMemory({
      type,
      content,
      metadata: {
        agentId,
        timestamp: Date.now(),
        importance,
        accessCount: 1,
        lastAccessed: Date.now()
      }
    });
    
    return Response.json({
      memoryId,
      message: '记忆添加成功',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Add memory error:', error);
    return Response.json(
      { error: '添加记忆失败' },
      { status: 500 }
    );
  }
}

// DELETE: 删除记忆
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const memoryId = searchParams.get('memoryId');
  
  if (!memoryId) {
    return Response.json(
      { error: '缺少memoryId参数' },
      { status: 400 }
    );
  }
  
  try {
    await memoryManager['store'].deleteMemory(memoryId);
    
    return Response.json({
      message: '记忆删除成功',
      memoryId
    });
  } catch (error) {
    console.error('Delete memory error:', error);
    return Response.json(
      { error: '删除记忆失败' },
      { status: 500 }
    );
  }
}

// PUT: 学习用户偏好
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;
    
    if (!key) {
      return Response.json(
        { error: '缺少key参数' },
        { status: 400 }
      );
    }
    
    await memoryManager.learnPreference(key, value);
    
    return Response.json({
      message: '偏好学习成功',
      key,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Learn preference error:', error);
    return Response.json(
      { error: '学习偏好失败' },
      { status: 500 }
    );
  }
}
