import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/user/user-service';

// ============================================================================
// 获取当前用户信息
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

    // 调用服务获取用户信息
    const result = await UserService.getCurrentUser(token);

    if (result.success) {
      // 不返回密码哈希
      const { password_hash, ...userWithoutPassword } = result.data!;
      return NextResponse.json(
        { success: true, data: userWithoutPassword },
        { status: 200 }
      );
    } else {
      return NextResponse.json(result, { status: 401 });
    }
  } catch (error) {
    console.error('Get current user API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 用户登出
// ============================================================================
export async function DELETE(request: NextRequest) {
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

    // 调用服务登出
    const result = await UserService.logout(token);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
