import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// 检测是否在服务器端
// ============================================================================

const isServer = typeof window === 'undefined';

// ============================================================================
// 内存存储（服务器端降级方案）
// ============================================================================

const memoryStore = new Map<string, any>();

// ============================================================================
// GET /api/storage - 获取会话列表或单个会话
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // 服务器端降级：返回提示信息
    if (isServer) {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');
      
      if (action === 'statistics') {
        return NextResponse.json({
          success: true,
          data: {
            totalSessions: 0,
            byType: {},
            favorites: 0,
            totalSize: 0,
            note: 'IndexedDB仅在浏览器端可用，请在客户端调用此API'
          }
        });
      }
      
      return NextResponse.json({
        success: true,
        data: [],
        note: 'IndexedDB仅在浏览器端可用，请在客户端调用此API'
      });
    }
    
    // 客户端逻辑
    const { getStorage } = await import('@/lib/storage/persistence');
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    const action = searchParams.get('action');
    
    const storage = getStorage();
    
    // 获取单个会话
    if (sessionId) {
      const session = await storage.getSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: session });
    }
    
    // 获取所有标签
    if (action === 'tags') {
      const tags = await storage.getAllTags();
      return NextResponse.json({ success: true, data: tags });
    }
    
    // 获取统计信息
    if (action === 'statistics') {
      const stats = await storage.getStatistics();
      return NextResponse.json({ success: true, data: stats });
    }
    
    // 搜索会话
    const searchParamsObj: any = {
      query: searchParams.get('query') || undefined,
      type: searchParams.get('type') || undefined,
      isFavorite: searchParams.get('isFavorite') === 'true' ? true : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined
    };
    
    // 标签过滤
    const tagsParam = searchParams.get('tags');
    if (tagsParam) {
      searchParamsObj.tags = tagsParam.split(',');
    }
    
    // 日期范围
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    if (dateStart && dateEnd) {
      searchParamsObj.dateRange = {
        start: dateStart,
        end: dateEnd
      };
    }
    
    const sessions = await storage.searchSessions(searchParamsObj);
    
    return NextResponse.json({
      success: true,
      data: sessions,
      total: sessions.length
    });
  } catch (error) {
    console.error('[Storage API] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/storage - 保存或更新会话
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
    
    // 服务器端降级：使用内存存储
    if (isServer) {
      switch (action) {
        case 'save':
          const now = new Date().toISOString();
          const saved = {
            ...data,
            metadata: {
              createdAt: data.metadata?.createdAt || now,
              updatedAt: now,
              version: '1.0.0',
              tags: data.metadata?.tags || [],
              isFavorite: data.metadata?.isFavorite || false
            }
          };
          memoryStore.set(data.id, saved);
          return NextResponse.json({ success: true, data: saved });
        
        case 'toggleFavorite':
          const session = memoryStore.get(data.id);
          if (session) {
            session.metadata.isFavorite = !session.metadata.isFavorite;
            return NextResponse.json({ success: true, data: { isFavorite: session.metadata.isFavorite } });
          }
          return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        
        case 'export':
          return NextResponse.json({
            success: true,
            data: {
              version: '1.0.0',
              exportedAt: new Date().toISOString(),
              sessions: Array.from(memoryStore.values())
            }
          });
        
        default:
          return NextResponse.json({ success: true, note: 'Server-side storage is limited' });
      }
    }
    
    // 客户端逻辑
    const { getStorage } = await import('@/lib/storage/persistence');
    const storage = getStorage();
    
    switch (action) {
      case 'save':
        const saved = await storage.saveSession(data);
        return NextResponse.json({ success: true, data: saved });
      
      case 'toggleFavorite':
        const isFavorite = await storage.toggleFavorite(data.id);
        return NextResponse.json({ success: true, data: { isFavorite } });
      
      case 'addTags':
        await storage.addTags(data.id, data.tags);
        return NextResponse.json({ success: true });
      
      case 'removeTags':
        await storage.removeTags(data.id, data.tags);
        return NextResponse.json({ success: true });
      
      case 'export':
        const exportData = await storage.exportAll();
        return NextResponse.json({ success: true, data: exportData });
      
      case 'import':
        const importedCount = await storage.importData(data, { overwrite: true });
        return NextResponse.json({ 
          success: true, 
          data: { imported: importedCount } 
        });
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Storage API] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/storage - 删除会话
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    const action = searchParams.get('action');
    
    // 服务器端降级
    if (isServer) {
      if (action === 'clear') {
        memoryStore.clear();
        return NextResponse.json({ success: true, message: 'All data cleared' });
      }
      
      if (sessionId) {
        const deleted = memoryStore.delete(sessionId);
        return NextResponse.json({
          success: deleted,
          message: deleted ? 'Session deleted' : 'Session not found'
        });
      }
    }
    
    // 客户端逻辑
    const { getStorage } = await import('@/lib/storage/persistence');
    const storage = getStorage();
    
    // 清空所有数据
    if (action === 'clear') {
      await storage.clearAll();
      return NextResponse.json({ success: true, message: 'All data cleared' });
    }
    
    // 删除单个会话
    if (sessionId) {
      const deleted = await storage.deleteSession(sessionId);
      return NextResponse.json({ 
        success: deleted, 
        message: deleted ? 'Session deleted' : 'Session not found' 
      });
    }
    
    return NextResponse.json(
      { error: 'id or action=clear is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Storage API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
