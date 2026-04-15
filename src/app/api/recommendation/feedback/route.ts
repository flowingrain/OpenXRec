import { NextRequest, NextResponse } from 'next/server';
import {
  classifyOpinionIntent,
  runRecommendationFeedbackPipeline,
  type OpinionFeedbackIntent,
} from '@/lib/recommendation/unified-feedback-bridge';

/**
 * 推荐结果显式反馈（点赞 / 点踩）。
 * 与聊天反馈共用 `unified-feedback-bridge`（同一套记忆 + PPO/自适应链路）。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
    const feedbackTypeRaw = body.feedbackType;
    const opinionText = typeof body.opinionText === 'string' ? body.opinionText.trim() : '';
    const correction = body.correction && typeof body.correction === 'object' ? body.correction : null;

    const inferredIntent = classifyOpinionIntent(
      opinionText || (typeof correction?.content === 'string' ? correction.content : '')
    );
    const explicitIntent =
      typeof body.intent === 'string' &&
      ['correction', 'approve', 'reject', 'request_explanation', 'other'].includes(body.intent)
        ? (body.intent as OpinionFeedbackIntent)
        : null;
    const intent: OpinionFeedbackIntent = explicitIntent || inferredIntent;

    const mappedFeedbackType =
      feedbackTypeRaw === 'like' || feedbackTypeRaw === 'dislike'
        ? feedbackTypeRaw
        : intent === 'approve'
          ? 'like'
          : intent === 'reject'
            ? 'dislike'
            : 'neutral';

    if (!userId || !itemId) {
      return NextResponse.json(
        { success: false, error: '缺少 userId 或 itemId' },
        { status: 400 }
      );
    }

    const { ppoAccepted, correctionCandidateId } = await runRecommendationFeedbackPipeline({
      userId,
      itemId,
      mappedFeedbackType,
      intent,
      opinionText,
      position: Number(body.position ?? 0) || 0,
      strategy: typeof body.strategy === 'string' ? body.strategy : 'feedback_route',
      explanationType:
        typeof body.explanationType === 'string' ? body.explanationType : 'evidence_chain',
      correction,
    });

    return NextResponse.json({
      success: true,
      data: {
        intent,
        feedbackType: mappedFeedbackType,
        ppoAccepted,
        correctionCandidateId,
        reviewRequired: !!correctionCandidateId,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '反馈失败';
    console.error('[recommendation/feedback]', e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
