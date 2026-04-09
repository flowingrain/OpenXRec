import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRecommendationKnowledgeManager } from '@/lib/recommendation/supabase-knowledge-integration';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { getSupabaseVectorStore } from '@/lib/vector/supabase-vector-store';
import { LLMClient, SearchClient, Config } from 'coze-coding-dev-sdk';
import { 
  getEnhancedRecommendationService,
  type EnhancedRecommendationRequest 
} from '@/lib/recommendation/enhanced-recommendation-service';

/**
 * 推荐API接口
 * 
 * 功能：
 * - 基于用户查询生成推荐（多智能体协作）
 * - 置信度校准
 * - 反思机制（自我评估）
 * - 反馈闭环优化
 * - 自适应优化
 */

// LLM客户端单例
let llmClientInstance: LLMClient | null = null;
function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    const config = new Config();
    llmClientInstance = new LLMClient(config, {});
  }
  return llmClientInstance;
}

/**
 * 增强版推荐请求参数
 */
interface EnhancedRequestBody {
  query?: string;
  contextQuery?: string;  // 替代 context.query 的别名
  scenario?: string;  // 推荐场景
  userProfile?: any;
  sessionContext?: any;
  skipSufficiencyCheck?: boolean;
  userId?: string;
  sessionId?: string;
  options?: {
    enableCalibration?: boolean;
    enableReflection?: boolean;
    enableFeedbackLoop?: boolean;
    enableAdaptiveOptimization?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: EnhancedRequestBody = await request.json();
    
    // 支持两种格式：顶级 query 或 contextQuery
    const query = body.query || body.contextQuery;
    const { 
      scenario,
      userProfile, 
      sessionContext, 
      skipSufficiencyCheck,
      userId,
      sessionId,
      options 
    } = body;

    console.log('[Recommendation API] Query:', query);

    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少查询内容' },
        { status: 400 }
      );
    }

    // ========================================
    // 获取增强版推荐服务
    // ========================================
    console.log('[Recommendation API] Using Enhanced Recommendation Service');
    const enhancedService = getEnhancedRecommendationService();

    // 获取上下文信息
    let knowledgeContext = '';
    let webContext = '';

    try {
      const knowledgeManager = getSupabaseRecommendationKnowledgeManager();
      const vectorStore = getSupabaseVectorStore();

      // 获取知识库上下文
      try {
        const knowledgeResults = await knowledgeManager.queryRecommendationKnowledge(query, { limit: 3 });
        knowledgeContext = knowledgeResults.map(r => r.entry.content).join('\n');
      } catch (e) {
        console.log('[Recommendation API] Knowledge context fetch failed');
      }

      // 获取向量检索上下文
      try {
        const vectorResults = await vectorStore.search(query, { topK: 3, threshold: 0.6 });
        if (vectorResults.length > 0) {
          webContext = vectorResults.map(r => r.entry.textPreview).join('\n');
        }
      } catch (e) {
        console.log('[Recommendation API] Vector context fetch failed');
      }
    } catch (e) {
      console.error('[Recommendation API] Failed to get context:', e);
    }

    // ========================================
    // 生成增强版推荐
    // ========================================
    const enhancedRequest: EnhancedRecommendationRequest = {
      query,
      userId: userId || userProfile?.userId,
      sessionId,
      context: {
        scenario,
        knowledgeContext,
        webContext,
      },
      options: {
        enableCalibration: options?.enableCalibration ?? true,
        enableReflection: options?.enableReflection ?? true,
        enableFeedbackLoop: options?.enableFeedbackLoop ?? true,
        enableAdaptiveOptimization: options?.enableAdaptiveOptimization ?? true,
        skipSufficiencyCheck,
      },
    };

    console.log('[Recommendation API] Calling enhanced service...');
    const enhancedResult = await enhancedService.generateRecommendation(enhancedRequest);

    // ========================================
    // 记录到内存管理器（可选，失败不影响返回）
    // 注意：user_feedback 表可能不存在或 RLS 阻止访问，忽略错误
    // ========================================
    try {
      const memoryManager = getSupabaseRecommendationMemoryManager();
      if (userId || userProfile?.userId) {
        // 使用 'suggestion' 作为通用的反馈类型（表CHECK允许）
        await memoryManager.recordUserFeedback({
          userId: userId || userProfile?.userId,
          itemId: 'recommendation_session',
          feedbackType: 'view',  // 会话浏览记录
          context: {
            query,
            itemCount: enhancedResult.items.length,
            type: 'session_view'
          }
        });
      }
    } catch (e) {
      // 只记录警告，不影响返回
      console.warn('[Recommendation API] Failed to record history (ignored):', e);
    }

    // ========================================
    // 返回响应
    // ========================================
    return NextResponse.json({
      success: true,
      data: {
        items: enhancedResult.items,
        strategy: enhancedResult.strategy,
        explanation: enhancedResult.explanation,
        feedbackToken: enhancedResult.feedbackToken,
        metadata: enhancedResult.metadata,
      }
    });

  } catch (error: any) {
    console.error('[Recommendation API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '推荐失败' },
      { status: 500 }
    );
  }
}

// 支持GET请求（用于测试）
export async function GET(request: NextRequest) {
  const service = getEnhancedRecommendationService();
  const status = service.getServiceStatus();
  
  return NextResponse.json({
    success: true,
    message: 'Enhanced Recommendation API is running',
    features: [
      '多智能体协作推荐',
      '置信度校准',
      '反思机制',
      '反馈闭环优化',
      '自适应优化',
      '序列推荐',
      'PPO强化学习'
    ],
    serviceStatus: status
  });
}
