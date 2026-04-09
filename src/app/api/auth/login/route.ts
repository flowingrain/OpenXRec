import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/user/user-service';

// ============================================================================
// 用户登录
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '邮箱和密码为必填项' },
        { status: 400 }
      );
    }

    // 调用登录服务
    const result = await UserService.login({ email, password });

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 401 });
    }
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
