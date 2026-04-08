import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRecommendationKnowledgeManager } from '@/lib/recommendation/supabase-knowledge-integration';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { getSupabaseVectorStore } from '@/lib/vector/supabase-vector-store';
import { createSufficiencyEvaluator } from '@/lib/recommendation/recommendation-types';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

/**
 * 推荐API接口
 * 
 * 功能：
 * - 基于用户查询生成推荐
 * - 支持多种推荐策略
 * - 提供推荐解释
 * - 信息充足度评估与追问
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userProfile, context, sessionContext, skipSufficiencyCheck } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少查询内容' },
        { status: 400 }
      );
    }

    console.log('[Recommendation API] Processing query:', query);

    // 初始化服务
    const knowledgeManager = getSupabaseRecommendationKnowledgeManager();
    const memoryManager = getSupabaseRecommendationMemoryManager();
    const vectorStore = getSupabaseVectorStore();

    // 0. 信息充足度评估（除非明确跳过）
    if (!skipSufficiencyCheck) {
      console.log('[Recommendation API] Starting sufficiency evaluation...');
      try {
        const llmClient = getLLMClient();
        console.log('[Recommendation API] LLM client created');
        const evaluator = createSufficiencyEvaluator(llmClient);
        console.log('[Recommendation API] Evaluator created');
        const sufficiency = await evaluator.evaluate(query, sessionContext);
        
        console.log('[Recommendation API] Sufficiency score:', sufficiency.score);
        console.log('[Recommendation API] Is sufficient:', sufficiency.isSufficient);
        console.log('[Recommendation API] Suggested questions:', sufficiency.suggestedQuestions?.length || 0);
        
        if (!sufficiency.isSufficient && sufficiency.suggestedQuestions && sufficiency.suggestedQuestions.length > 0) {
          console.log('[Recommendation API] Need clarification, returning questions');
          return NextResponse.json({
            success: true,
            data: {
              needsClarification: true,
              sufficiency: {
                score: sufficiency.score,
                isSufficient: sufficiency.isSufficient,
                missingFields: sufficiency.missingFields
              },
              followUpQuestions: sufficiency.clarificationQuestions || sufficiency.suggestedQuestions.map((q, i) => ({
                id: `q_${i}`,
                question: q,
                type: 'text'
              })),
              explanation: '为了给您提供更精准的推荐，我需要了解一些额外信息。'
            }
          });
        }
      } catch (error: any) {
        console.error('[Recommendation API] Sufficiency evaluation failed:', error.message || error);
        console.error('[Recommendation API] Error stack:', error.stack);
        // 继续处理，不因评估失败而中断
      }
    } else {
      console.log('[Recommendation API] Sufficiency check skipped');
    }

    // 1. 分析查询意图
    const intent = analyzeQueryIntent(query);
    console.log('[Recommendation API] Intent:', intent);

    // 2. 生成候选推荐
    const candidates = await generateCandidates(query, intent, userProfile, knowledgeManager, vectorStore);
    console.log('[Recommendation API] Generated candidates:', candidates.length);

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          recommendations: {
            items: [],
            strategy: '无匹配结果',
            metadata: {
              totalCandidates: 0,
              selectedCount: 0,
              diversityScore: 0,
              noveltyScore: 0,
              confidence: 0
            }
          },
          explanation: '抱歉，暂时没有找到符合您需求的推荐。请尝试提供更详细的信息或调整您的查询内容。'
        }
      });
    }

    // 3. 优化推荐结果（多样性、新颖性）
    const optimized = await optimizeRecommendations(candidates, userProfile);
    console.log('[Recommendation API] Optimized to:', optimized.length);

    // 4. 生成推荐解释
    const explanation = generateExplanation(query, optimized, userProfile);

    // 5. 返回推荐结果
    const recommendations = {
      items: optimized,
      strategy: intent.strategy || '知识增强推荐',
      metadata: {
        totalCandidates: candidates.length,
        selectedCount: optimized.length,
        diversityScore: calculateDiversityScore(optimized),
        noveltyScore: calculateNoveltyScore(optimized),
        confidence: optimized[0]?.confidence || 0.8
      }
    };

    // 6. 记录推荐历史（如果提供了用户ID）
    if (userProfile?.userId) {
      try {
        await memoryManager.recordUserFeedback({
          userId: userProfile.userId,
          itemId: 'recommendation_session',
          feedbackType: 'view',
          context: {
            query,
            itemCount: optimized.length
          }
        });
      } catch (error) {
        console.error('[Recommendation API] Failed to record history:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        explanation
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

/**
 * 分析查询意图
 */
function analyzeQueryIntent(query: string): {
  type: 'product' | 'article' | 'course' | 'general';
  strategy: string;
  interests: string[];
} {
  const lowerQuery = query.toLowerCase();
  let type: 'product' | 'article' | 'course' | 'general' = 'general';
  let strategy = '知识增强推荐';
  const interests: string[] = [];

  // 识别物品类型
  if (lowerQuery.includes('产品') || lowerQuery.includes('商品')) {
    type = 'product';
    strategy = '基于内容的推荐';
  } else if (lowerQuery.includes('文章') || lowerQuery.includes('阅读') || lowerQuery.includes('书')) {
    type = 'article';
    strategy = '兴趣匹配推荐';
  } else if (lowerQuery.includes('课程') || lowerQuery.includes('学习') || lowerQuery.includes('教程')) {
    type = 'course';
    strategy = '协同过滤推荐';
  }

  // 识别兴趣关键词
  const interestKeywords = {
    '科技': ['科技', '技术', 'AI', '人工智能', '编程', '软件'],
    '阅读': ['阅读', '书', '文章', '写作', '文学'],
    '产品': ['产品', '设计', 'UX', 'UI', '用户体验'],
    '音乐': ['音乐', '歌曲', '专辑', '歌手', '音乐人'],
    '电影': ['电影', '影视', '影片', '导演', '演员'],
    '运动': ['运动', '健身', '体育', '锻炼', '健康'],
    '美食': ['美食', '食物', '烹饪', '菜谱', '餐厅']
  };

  for (const [interest, keywords] of Object.entries(interestKeywords)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      interests.push(interest);
    }
  }

  return { type, strategy, interests };
}

/**
 * 生成候选推荐
 */
async function generateCandidates(
  query: string,
  intent: any,
  userProfile: any,
  knowledgeManager: any,
  vectorStore: any
): Promise<any[]> {
  const candidates: any[] = [];

  // 策略1: 基于兴趣匹配
  if (intent.interests.length > 0) {
    for (const interest of intent.interests) {
      const items = await generateInterestBasedCandidates(interest, intent.type, userProfile);
      candidates.push(...items);
    }
  }

  // 策略2: 基于向量检索
  try {
    const vectorResults = await vectorStore.search(query, {
      topK: 5,
      threshold: 0.6,
      embeddingType: intent.type
    });

    for (const result of vectorResults.slice(0, 3)) {
      if (!candidates.some(c => c.id === result.entry.caseId)) {
        candidates.push({
          id: result.entry.caseId,
          title: generateTitleFromVector(result.entry),
          type: intent.type,
          description: result.entry.textPreview || `基于向量检索找到的${intent.type}`,
          score: result.similarity,
          confidence: Math.min(result.similarity, 0.95),
          explanation: `通过向量相似度匹配，与您的查询高度相关（相似度 ${(result.similarity * 100).toFixed(0)}%）`,
          knowledgeSources: [],
          features: {
            category: intent.type,
            tags: intent.interests,
            attributes: { matchType: 'vector' }
          }
        });
      }
    }
  } catch (error) {
    console.error('[Recommendation API] Vector search failed:', error);
  }

  // 策略3: 基于知识库检索
  try {
    const knowledgeResults = await knowledgeManager.queryRecommendationKnowledge(query, {
      limit: 3
    });

    for (const result of knowledgeResults) {
      const itemId = `kb_${result.entry.id}`;
      if (!candidates.some(c => c.id === itemId)) {
        candidates.push({
          id: itemId,
          title: result.entry.title,
          type: 'article',
          description: result.entry.content.substring(0, 100),
          score: result.relevance,
          confidence: Math.min(result.relevance * 0.9, 0.9),
          explanation: result.entry.description || `从知识库中检索到相关内容（相关度 ${(result.relevance * 100).toFixed(0)}%）`,
          knowledgeSources: [{
            title: result.entry.title,
            relevance: result.relevance
          }],
          features: {
            category: result.entry.metadata?.type || 'knowledge',
            tags: result.entry.metadata?.tags || [],
            attributes: { source: 'knowledge_base' }
          }
        });
      }
    }
  } catch (error) {
    console.error('[Recommendation API] Knowledge search failed:', error);
  }

  // 如果候选不足，生成模拟数据
  if (candidates.length < 3) {
    const mockCandidates = generateMockCandidates(query, intent, 3 - candidates.length);
    candidates.push(...mockCandidates);
  }

  // 按分数排序
  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * 生成基于兴趣的候选
 */
async function generateInterestBasedCandidates(
  interest: string,
  type: string,
  userProfile: any
): Promise<any[]> {
  const candidates: any[] = [];

  const templates = {
    '科技': [
      { title: `智能${type}推荐系统`, description: `基于${interest}领域的最新${type}推荐，结合AI技术提供个性化体验` },
      { title: `${interest}创新产品解析`, description: `深入分析${interest}领域的创新${type}，了解技术趋势和应用场景` },
      { title: `${interest}数据驱动决策`, description: `利用数据驱动的方法优化${interest}相关的${type}选择和决策过程` }
    ],
    '阅读': [
      { title: `${type}推荐：必读经典`, description: `精选${interest}领域的经典${type}，为您提供深度阅读体验` },
      { title: `${interest}主题书单`, description: `围绕${interest}主题精选的${type}清单，适合不同阅读水平` },
      { title: `${interest}阅读方法指南`, description: `学习高效的${interest}阅读方法，提升${type}理解和吸收能力` }
    ],
    '产品': [
      { title: `${interest}设计原则`, description: `掌握${interest}领域的核心设计原则，打造优秀${type}` },
      { title: `${interest}用户体验优化`, description: `基于用户体验理论优化${interest}相关的${type}设计` },
      { title: `${interest}产品案例分析`, description: `分析成功的${interest}${type}案例，学习最佳实践` }
    ],
    'default': [
      { title: `${interest}领域${type}精选`, description: `为您精选${interest}领域的高质量${type}` },
      { title: `${interest}趋势分析`, description: `深度分析${interest}领域的最新趋势和未来方向` },
      { title: `${interest}实践指南`, description: `提供${interest}领域的实用指南和操作方法` }
    ]
  };

  const interestTemplates = templates[interest as keyof typeof templates] || templates.default;

  for (let i = 0; i < Math.min(interestTemplates.length, 2); i++) {
    const template = interestTemplates[i];
    candidates.push({
      id: `interest_${interest}_${i}`,
      title: template.title,
      type: type,
      description: template.description,
      score: 0.85 - i * 0.05,
      confidence: 0.8,
      explanation: `基于您对"${interest}"的兴趣，为您推荐这篇${type}`,
      knowledgeSources: [{
        title: `${interest}知识库`,
        relevance: 0.8
      }],
      features: {
        category: interest,
        tags: [interest, type],
        attributes: { source: 'interest_match' }
      }
    });
  }

  return candidates;
}

/**
 * 生成模拟候选
 */
function generateMockCandidates(query: string, intent: any, count: number): any[] {
  const candidates: any[] = [];
  const types = ['product', 'article', 'course'];

  for (let i = 0; i < count; i++) {
    const randomType = types[Math.floor(Math.random() * types.length)];
    candidates.push({
      id: `mock_${Date.now()}_${i}`,
      title: `${query} - ${randomType}推荐 ${i + 1}`,
      type: randomType,
      description: `这是一个关于"${query}"的${randomType}推荐项，包含丰富的内容和实践指导`,
      score: 0.75 - i * 0.05,
      confidence: 0.7,
      explanation: `基于您的查询"${query}"生成的推荐${randomType}`,
      knowledgeSources: [],
      features: {
        category: intent.type || 'general',
        tags: intent.interests,
        attributes: { source: 'mock' }
      }
    });
  }

  return candidates;
}

/**
 * 从向量结果生成标题
 */
function generateTitleFromVector(entry: any): string {
  const preview = entry.textPreview || '';
  if (preview.length > 50) {
    return preview.substring(0, 50) + '...';
  }
  return preview || '相关内容';
}

/**
 * 优化推荐结果（多样性、新颖性）
 */
async function optimizeRecommendations(
  candidates: any[],
  userProfile: any
): Promise<any[]> {
  // 简单的多样性优化：确保推荐项类型多样化
  const typeCount: Record<string, number> = {};
  const optimized: any[] = [];

  for (const candidate of candidates) {
    const type = candidate.type;
    if (!typeCount[type] || typeCount[type] < 2) {
      optimized.push(candidate);
      typeCount[type] = (typeCount[type] || 0) + 1;
    }
  }

  // 如果优化后数量过少，从剩余候选中补充
  if (optimized.length < 3) {
    const remaining = candidates.filter(c => !optimized.includes(c));
    optimized.push(...remaining.slice(0, 3 - optimized.length));
  }

  // 更新分数，加入多样性惩罚
  return optimized.map((item, index) => ({
    ...item,
    score: item.score * (1 - index * 0.05),
    confidence: Math.max(item.confidence * (1 - index * 0.03), 0.6)
  }));
}

/**
 * 生成推荐解释
 */
function generateExplanation(
  query: string,
  recommendations: any[],
  userProfile: any
): string {
  const topItem = recommendations[0];
  const strategy = topItem?.strategy || '混合推荐';
  const confidence = (topItem?.confidence * 100).toFixed(0);

  let explanation = `根据您的需求"${query}"，我为您找到了 **${recommendations.length}** 个推荐项。\n\n`;
  explanation += `## 🎯 推荐策略\n采用 **${strategy}** 策略，推荐置信度 **${confidence}%**。\n\n`;

  if (topItem) {
    explanation += `## ⭐ 最佳推荐\n**${topItem.title}**\n${topItem.description}\n\n`;
    explanation += `**推荐理由**：${topItem.explanation}\n\n`;
  }

  explanation += `## 📊 推荐指标\n`;
  explanation += `- 候选总数：${recommendations.length}\n`;
  explanation += `- 多样性得分：${calculateDiversityScore(recommendations).toFixed(2)}\n`;
  explanation += `- 新颖性得分：${calculateNoveltyScore(recommendations).toFixed(2)}`;

  return explanation;
}

/**
 * 计算多样性得分
 */
function calculateDiversityScore(recommendations: any[]): number {
  const types = new Set(recommendations.map(r => r.type));
  return Math.min(types.size / 3, 1.0);
}

/**
 * 计算新颖性得分
 */
function calculateNoveltyScore(recommendations: any[]): number {
  // 简化版本：基于分数的倒数
  const avgScore = recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length;
  return 1 - avgScore;
}

// 支持GET请求（用于测试）
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Recommendation API is running',
    endpoints: {
      POST: 'Generate recommendations',
      GET: 'API status check'
    }
  });
}
