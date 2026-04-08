import { NextRequest, NextResponse } from 'next/server';
import { InteractionService } from '@/lib/user/interaction-service';
import { UserService } from '@/lib/user/user-service';

// ============================================================================
// 获取用户统计
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

    // 调用服务获取用户统计
    const result = await InteractionService.getUserStats(userId);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Get user stats API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
