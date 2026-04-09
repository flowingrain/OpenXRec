import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';

/**
 * 用户画像API接口
 * 
 * 功能：
 * - 创建/更新用户画像
 * - 获取用户画像
 * - 记录用户行为
 * - 记录用户反馈
 */

// 初始化Supabase客户端
const supabaseUrl = process.env.COZE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[User Profile API] Supabase credentials not found');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 用户画像接口
 */
interface UserProfile {
  userId: string;
  interests: string[];
  preferences: Record<string, any>;
  statistics: {
    totalQueries: number;
    totalRecommendations: number;
    positiveFeedback: number;
    negativeFeedback: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建或更新用户画像
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action,
      userId,
      interests,
      preferences,
      behavior,
      feedback
    } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }

    console.log('[User Profile API] Action:', action, 'User:', userId);

    const memoryManager = getSupabaseRecommendationMemoryManager();

    // 根据不同的action执行不同的操作
    switch (action) {
      case 'update_profile':
        return await handleUpdateProfile(userId, interests, preferences, memoryManager);
      
      case 'record_behavior':
        return await handleRecordBehavior(userId, behavior, memoryManager);
      
      case 'record_feedback':
        return await handleRecordFeedback(userId, feedback, memoryManager);
      
      default:
        return NextResponse.json(
          { success: false, error: '未知操作' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('[User Profile API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '用户画像操作失败' },
      { status: 500 }
    );
  }
}

/**
 * 获取用户画像
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }

    console.log('[User Profile API] Get profile for:', userId);

    const memoryManager = getSupabaseRecommendationMemoryManager();

    // 从Supabase获取用户画像
    const { data: userProfile, error } = await supabase
      .from('user_preferences')  // 使用user_preferences表
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // 如果用户不存在，创建默认画像
      if (error.code === 'PGRST116') {
        const defaultProfile = await createDefaultProfile(userId, memoryManager);
        return NextResponse.json({
          success: true,
          data: defaultProfile
        });
      }
      throw error;
    }

    // 转换为前端格式
    const profile: UserProfile = {
      userId: userProfile.user_id,
      interests: userProfile.interests || ['科技', '阅读', '产品'],
      preferences: userProfile.preferences || {},
      statistics: {
        totalQueries: userProfile.total_queries || 0,
        totalRecommendations: userProfile.total_recommendations || 0,
        positiveFeedback: userProfile.positive_feedback || 0,
        negativeFeedback: userProfile.negative_feedback || 0
      },
      createdAt: userProfile.created_at,
      updatedAt: userProfile.updated_at
    };

    return NextResponse.json({
      success: true,
      data: profile
    });

  } catch (error: any) {
    console.error('[User Profile API] Get error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取用户画像失败' },
      { status: 500 }
    );
  }
}

/**
 * 处理更新用户画像
 */
async function handleUpdateProfile(
  userId: string,
  interests: string[],
  preferences: Record<string, any>,
  memoryManager: any
) {
  try {
    // 检查用户是否存在
    const { data: existingUser } = await supabase
      .from('user_preferences')  // 使用user_preferences表
      .select('user_id')
      .eq('user_id', userId)
      .single();

    const profileData = {
      user_id: userId,
      interests: interests || [],
      preferences: preferences || {},
      updated_at: new Date().toISOString()
    };

    if (existingUser) {
      // 更新现有用户
      const { error } = await supabase
        .from('user_preferences')  // 使用user_preferences表
        .update(profileData)
        .eq('user_id', userId);

      if (error) throw error;
    } else {
      // 创建新用户
      const { error } = await supabase
        .from('user_preferences')  // 使用user_preferences表
        .insert({
          ...profileData,
          total_queries: 0,
          total_recommendations: 0,
          positive_feedback: 0,
          negative_feedback: 0,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      message: '用户画像更新成功',
      data: { userId, interests, preferences }
    });

  } catch (error: any) {
    throw error;
  }
}

/**
 * 处理记录用户行为
 */
async function handleRecordBehavior(
  userId: string,
  behavior: any,
  memoryManager: any
) {
  try {
    if (!behavior) {
      throw new Error('缺少行为数据');
    }

    // 记录行为
    await memoryManager.recordUserInteraction({
      userId,
      action: behavior.action || 'view',
      itemId: behavior.itemId || 'unknown',
      itemType: behavior.itemType || 'unknown',
      context: behavior.context || {}
    });

    // 更新统计信息
    // 注意：Supabase客户端不支持 .raw() 方法，需要先获取当前值再更新
    // 暂时跳过 total_queries 的自增
    /*
    const { error } = await supabase
      .from('user_preferences')  // 使用user_preferences表
      .update({
        total_queries: supabase.raw('total_queries + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    */

    const { error } = await supabase
      .from('user_preferences')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '用户行为记录成功'
    });

  } catch (error: any) {
    throw error;
  }
}

/**
 * 处理用户在资料/设置侧提交的显式反馈（与推荐接口内的「展示统计」不同）。
 */
async function handleRecordFeedback(
  userId: string,
  feedback: any,
  memoryManager: any
) {
  try {
    if (!feedback) {
      throw new Error('缺少反馈数据');
    }

    // 记录反馈
    await memoryManager.recordUserFeedback({
      userId,
      itemId: feedback.itemId || 'unknown',
      feedbackType: feedback.type || 'neutral',
      rating: feedback.rating || 0,
      context: feedback.context || {}
    });

    // 更新统计信息
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    // 注意：Supabase客户端不支持 .raw() 方法，需要先获取当前值再更新
    // 暂时跳过 feedback 计数的自增
    /*
    if (feedback.type === 'positive') {
      updateData.positive_feedback = supabase.raw('positive_feedback + 1');
    } else if (feedback.type === 'negative') {
      updateData.negative_feedback = supabase.raw('negative_feedback + 1');
    }
    */

    const { error } = await supabase
      .from('user_preferences')  // 使用user_preferences表
      .update(updateData)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '用户反馈记录成功'
    });

  } catch (error: any) {
    throw error;
  }
}

/**
 * 创建默认用户画像
 */
async function createDefaultProfile(userId: string, memoryManager: any): Promise<UserProfile> {
  const now = new Date().toISOString();
  const defaultProfile = {
    userId,
    interests: ['科技', '阅读', '产品'],
    preferences: {
      strategy: 'knowledge_enhanced',
      diversityLevel: 'medium'
    },
    statistics: {
      totalQueries: 0,
      totalRecommendations: 0,
      positiveFeedback: 0,
      negativeFeedback: 0
    },
    createdAt: now,
    updatedAt: now
  };

  // 保存到数据库
  const { error } = await supabase
    .from('user_preferences')  // 使用user_preferences表
    .insert({
      user_id: userId,
      interests: defaultProfile.interests,
      preferences: defaultProfile.preferences,
      total_queries: 0,
      total_recommendations: 0,
      positive_feedback: 0,
      negative_feedback: 0,
      created_at: now,
      updated_at: now
    });

  if (error) {
    console.error('[User Profile API] Create default profile error:', error);
  }

  return defaultProfile;
}
