/**
 * 知识审核管理API
 * 
 * 提供审核队列、审核操作接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { reviewService } from '@/lib/knowledge/review-service';
import { requireAdmin, getUserFromRequest } from '@/lib/auth/auth-service';

// GET: 获取审核队列或统计
export async function GET(request: NextRequest) {
  // 验证权限
  const authResult = await requireAdmin(request);
  if ('error' in authResult) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error === '未登录' ? 401 : 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'queue';

  try {
    switch (action) {
      case 'stats':
        const stats = await reviewService.getReviewStats();
        return NextResponse.json({ success: true, data: { stats } });

      case 'queue':
        const type = searchParams.get('type') as 'entity' | 'relation' | null;
        const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
        const minConfidence = searchParams.get('minConfidence');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const queue = await reviewService.getReviewQueue(
          {
            type: type || undefined,
            status: status || undefined,
            minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
          },
          limit,
          offset
        );
        return NextResponse.json({ success: true, data: { queue } });

      case 'conflicts':
        const itemId = searchParams.get('id');
        const itemType = searchParams.get('itemType') as 'entity' | 'relation';
        
        if (!itemId || !itemType) {
          return NextResponse.json(
            { success: false, error: 'Missing id or itemType' },
            { status: 400 }
          );
        }

        const conflicts = await reviewService.detectConflicts(itemId, itemType);
        return NextResponse.json({ success: true, data: { conflicts } });

      case 'history':
        const reviewerId = searchParams.get('reviewerId') || undefined;
        const historyLimit = parseInt(searchParams.get('limit') || '50');
        const history = await reviewService.getReviewHistory(reviewerId, historyLimit);
        return NextResponse.json({ success: true, data: { history } });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[AdminReview API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST: 执行审核操作
export async function POST(request: NextRequest) {
  // 验证权限
  const authResult = await requireAdmin(request);
  if ('error' in authResult) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.error === '未登录' ? 401 : 403 }
    );
  }

  const reviewerId = authResult.user.id;

  try {
    const body = await request.json();
    const { action, type, id, approved, note, items } = body;

    switch (action) {
      case 'review':
        if (!type || !id || approved === undefined) {
          return NextResponse.json(
            { success: false, error: 'Missing required fields' },
            { status: 400 }
          );
        }

        const result = await reviewService.reviewItem(
          type as 'entity' | 'relation',
          id,
          approved,
          reviewerId,
          note
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: approved ? '审核通过' : '已拒绝',
        });

      case 'batch-review':
        if (!items || !Array.isArray(items)) {
          return NextResponse.json(
            { success: false, error: 'Missing items array' },
            { status: 400 }
          );
        }

        const batchResult = await reviewService.batchReview(
          items,
          approved ?? true,
          reviewerId,
          note
        );

        return NextResponse.json({
          success: true,
          data: batchResult,
          message: `成功 ${batchResult.success} 项，失败 ${batchResult.failed} 项`,
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[AdminReview API] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
