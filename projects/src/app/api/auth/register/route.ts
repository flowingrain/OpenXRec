import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/user/user-service';

// ============================================================================
// 用户注册
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password, full_name, bio } = body;

    // 验证必填字段
    if (!email || !username || !password) {
      return NextResponse.json(
        { success: false, error: '邮箱、用户名和密码为必填项' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 验证密码强度
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码长度至少为 6 位' },
        { status: 400 }
      );
    }

    // 验证用户名格式
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { success: false, error: '用户名长度必须在 3-20 位之间' },
        { status: 400 }
      );
    }

    // 调用注册服务
    const result = await UserService.register({
      email,
      username,
      password,
      full_name,
      bio
    });

    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
