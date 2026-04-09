import { NextRequest, NextResponse } from 'next/server';
import { UserProfileService } from '@/lib/user/profile-service';
import { UserService } from '@/lib/user/user-service';

// ============================================================================
// 获取用户画像
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

    // 调用服务获取用户画像
    const result = await UserProfileService.getUserProfile(userId);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 404 });
    }
  } catch (error) {
    console.error('Get profile API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 生成/更新用户画像
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

    // 调用服务生成用户画像
    const result = await UserProfileService.generateUserProfile(userId);

    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Generate profile API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 更新用户画像权重
// ============================================================================
export async function PATCH(request: NextRequest) {
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

    // 调用服务更新用户画像
    const result = await UserProfileService.updateUserProfile(userId, body);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Update profile API error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
