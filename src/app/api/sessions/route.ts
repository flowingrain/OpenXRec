/**
 * 会话管理API
 * 
 * 功能：
 * - 创建新会话
 * - 加载历史会话
 * - 删除会话
 */

import { NextRequest } from 'next/server';
import { memoryManager } from '@/lib/memory';

// GET: 获取会话列表或单个会话
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const userId = searchParams.get('userId');
  
  try {
    if (sessionId) {
      // 获取单个会话
      const session = await memoryManager.loadSession(sessionId);
      
      if (!session) {
        return Response.json(
          { error: '会话不存在' },
          { status: 404 }
        );
      }
      
      return Response.json({ session });
    } else {
      // 获取会话列表
      const sessions = await memoryManager['store'].listConversations(userId || undefined);
      
      return Response.json({
        sessions: sessions.map(s => ({
          sessionId: s.sessionId,
          messageCount: s.messages.length,
          topic: s.context.topic,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        }))
      });
    }
  } catch (error) {
    console.error('Session API error:', error);
    return Response.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// POST: 创建新会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    const sessionId = await memoryManager.createSession(userId);
    
    return Response.json({
      sessionId,
      message: '会话创建成功',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Create session error:', error);
    return Response.json(
      { error: '创建会话失败' },
      { status: 500 }
    );
  }
}

// DELETE: 删除会话
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return Response.json(
      { error: '缺少sessionId参数' },
      { status: 400 }
    );
  }
  
  try {
    await memoryManager['store'].deleteConversation(sessionId);
    
    return Response.json({
      message: '会话删除成功',
      sessionId
    });
  } catch (error) {
    console.error('Delete session error:', error);
    return Response.json(
      { error: '删除会话失败' },
      { status: 500 }
    );
  }
}
