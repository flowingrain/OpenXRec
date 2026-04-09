/**
 * 推荐反馈 API
 * 
 * 功能：
 * - 记录用户对推荐的反馈（有帮助/不相关）
 * - 存储反馈到数据库用于模型优化
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface FeedbackRequest {
  userId: string;
  itemId: string;
  feedbackType: 'like' | 'dislike';
  recommendationId?: string;
  messageId?: string;
  query?: string;
  metadata?: Record<string, any>;
}

/**
 * POST /api/recommendation-feedback
 * 记录推荐反馈
 */
export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json();
    const { userId, itemId, feedbackType, recommendationId, messageId, query, metadata } = body;

    console.log('[Recommendation Feedback] Received:', {
      userId,
      itemId,
      feedbackType,
      recommendationId,
      messageId
    });

    // 验证必要参数
    if (!itemId || !feedbackType) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 });
    }

    // 获取 Supabase 客户端
    const supabase = getSupabaseClient();

    // 尝试存储反馈到数据库（使用 recommendation_feedbacks 表）
    if (supabase) {
      try {
        const { error: insertError } = await supabase.from('recommendation_feedbacks').insert({
          user_id: userId || null,  // 允许匿名用户
          item_id: itemId,
          item_title: metadata?.itemTitle || itemId,
          item_type: metadata?.itemType || 'knowledge',
          feedback_type: feedbackType === 'like' ? 'helpful' : 'not_relevant',
          recommendation_id: recommendationId || 'unknown',
          metadata: metadata || {}
        });

        if (insertError) {
          console.warn('[Recommendation Feedback] Database insert skipped:', insertError.message);
        } else {
          console.log('[Recommendation Feedback] Stored in recommendation_feedbacks');
        }
      } catch (e) {
        console.warn('[Recommendation Feedback] Database operation failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: feedbackType === 'like' ? '感谢您的反馈！' : '感谢您的反馈，我们会继续改进。'
    });

  } catch (error: any) {
    console.error('[Recommendation Feedback] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '处理反馈失败'
    }, { status: 500 });
  }
}

/**
 * GET /api/recommendation-feedback
 * 获取反馈统计
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const itemId = searchParams.get('itemId');

    const supabase = getSupabaseClient();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        data: { helpful: 0, notRelevant: 0 }
      });
    }

    // 查询统计 - 使用 recommendation_feedbacks 表
    let query = supabase
      .from('recommendation_feedbacks')
      .select('feedback_type');

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Recommendation Feedback] Query error:', error);
      return NextResponse.json({
        success: false,
        error: '查询失败'
      }, { status: 500 });
    }

    const helpful = data?.filter(d => d.feedback_type === 'helpful').length || 0;
    const notRelevant = data?.filter(d => d.feedback_type === 'not_relevant').length || 0;

    return NextResponse.json({
      success: true,
      data: { helpful, notRelevant, total: helpful + notRelevant }
    });

  } catch (error: any) {
    console.error('[Recommendation Feedback] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '获取统计失败'
    }, { status: 500 });
  }
}
