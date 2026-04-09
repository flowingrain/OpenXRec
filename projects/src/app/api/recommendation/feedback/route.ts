import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';

/**
 * 推荐结果显式反馈（点赞 / 点踩），与「分析聊天」用的 /api/chat-feedback 分离。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
    const feedbackType = body.feedbackType;

    if (!userId || !itemId) {
      return NextResponse.json(
        { success: false, error: '缺少 userId 或 itemId' },
        { status: 400 }
      );
    }

    if (feedbackType !== 'like' && feedbackType !== 'dislike') {
      return NextResponse.json(
        { success: false, error: 'feedbackType 须为 like 或 dislike' },
        { status: 400 }
      );
    }

    const memory = getSupabaseRecommendationMemoryManager();
    await memory.recordUserFeedback({
      userId,
      itemId,
      feedbackType,
      context: { source: 'openxrec_recommendation_ui' },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '反馈失败';
    console.error('[recommendation/feedback]', e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
