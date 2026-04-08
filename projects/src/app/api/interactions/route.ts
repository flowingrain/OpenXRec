import { NextRequest, NextResponse } from 'next/server';
import { InteractionService } from '@/lib/user/interaction-service';
import { UserService } from '@/lib/user/user-service';

// ============================================================================
// 获取用户交互历史
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // 验证用户
    const userResult = await UserService.getCurrentUser(token);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const userId = userResult.data.id;

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const interaction_type = searchParams.get('interaction_type') || undefined;
    const item_type = searchParams.get('item_type') || undefined;

    // 调用服务获取交互历史
    const result = await InteractionService.getUserInteractions(userId, {
      page,
      limit,
      interaction_type,
      item_type
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Get interactions API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 记录用户交互
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // 验证用户
    const userResult = await UserService.getCurrentUser(token);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const userId = userResult.data.id;

    // 获取请求体
    const body = await request.json();

    // 验证必填字段
    if (!body.interaction_type) {
      return NextResponse.json(
        { success: false, error: 'interaction_type 为必填项' },
        { status: 400 }
      );
    }

    // 调用服务记录交互
    const result = await InteractionService.recordInteraction(userId, body);

    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Record interaction API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
