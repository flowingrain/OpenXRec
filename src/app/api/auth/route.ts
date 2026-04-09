/**
 * 认证API
 * 
 * 提供登录、注册、登出、获取当前用户等功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService, getUserFromRequest } from '@/lib/auth/auth-service';
import { cookies } from 'next/headers';

// GET: 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const permissions = authService.getPermissions(user);

    return NextResponse.json({
      success: true,
      data: {
        user,
        permissions,
      },
    });
  } catch (error) {
    console.error('[Auth API] Get user error:', error);
    return NextResponse.json(
      { success: false, error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}

// POST: 登录或注册
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, username, fullName } = body;

    let result;

    switch (action) {
      case 'login':
        if (!email || !password) {
          return NextResponse.json(
            { success: false, error: '请输入邮箱和密码' },
            { status: 400 }
          );
        }
        result = await authService.login(email, password);
        break;

      case 'register':
        if (!email || !password || !username) {
          return NextResponse.json(
            { success: false, error: '请填写所有必填项' },
            { status: 400 }
          );
        }
        result = await authService.register(email, username, password, fullName);
        break;

      case 'logout':
        // 清除 cookie
        const cookieStore = await cookies();
        cookieStore.delete('auth_token');
        return NextResponse.json({ success: true, message: '已登出' });

      default:
        return NextResponse.json(
          { success: false, error: '无效的操作' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // 设置 cookie
    if (result.token) {
      const cookieStore = await cookies();
      cookieStore.set('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7天
        path: '/',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    console.error('[Auth API] Error:', error);
    return NextResponse.json(
      { success: false, error: '操作失败，请稍后重试' },
      { status: 500 }
    );
  }
}
