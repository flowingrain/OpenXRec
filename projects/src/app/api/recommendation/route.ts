import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseRecommendationKnowledgeManager } from '@/lib/recommendation/supabase-knowledge-integration';
import { getSupabaseRecommendationMemoryManager } from '@/lib/recommendation/supabase-memory-integration';
import { getSupabaseVectorStore } from '@/lib/vector/supabase-vector-store';
import { createSufficiencyEvaluator } from '@/lib/recommendation/recommendation-types';
import {
  enrichRecommendationsWithBatchLLM,
  getRecommendDisplayMax,
} from '@/lib/recommendation/batch-llm-explanations';
import { advancedWebSearch } from '@/lib/search/advanced-web-search';
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

function extractQueryFromBody(body: Record<string, unknown>): string {
  const candidates = [
    body.query,
    (body.context as Record<string, unknown> | undefined)?.query,
    body.message,
    body.prompt,
    body.text,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userProfile: bodyUserProfile,
      context,
      sessionContext: bodySessionContext,
      skipSufficiencyCheck,
      userId,
    } = body;

    const query = extractQueryFromBody(body);

    if (!query) {
      return NextResponse.json(
        { success: false, error: '缺少查询内容（需要 query、context.query、message 等任一字段）' },
        { status: 400 }
      );
    }

    const userProfile =
      bodyUserProfile ?? (typeof userId === 'string' && userId ? { userId } : undefined);
    const sessionContext = {
      ...(typeof bodySessionContext === 'object' && bodySessionContext
        ? bodySessionContext
        : {}),
      ...(typeof context === 'object' && context ? context : {}),
      ...(typeof userId === 'string' ? { userId } : {}),
    };

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
          const followUpQuestions =
            sufficiency.clarificationQuestions ||
            sufficiency.suggestedQuestions.map((q: string, i: number) => ({
              id: `q_${i}`,
              question: q,
              type: 'text',
            }));
          return NextResponse.json({
            success: true,
            data: {
              items: [],
              needsClarification: true,
              sufficiency: {
                score: sufficiency.score,
                isSufficient: sufficiency.isSufficient,
                missingFields: sufficiency.missingFields,
              },
              followUpQuestions,
              explanation: '为了给您提供更精准的推荐，我需要了解一些额外信息。',
              metadata: {
                clarification: {
                  needsClarification: true,
                  sufficiency,
                  followUpQuestions,
                },
              },
            },
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
          items: [],
          recommendations: {
            items: [],
            strategy: '无匹配结果',
            metadata: {
              totalCandidates: 0,
              selectedCount: 0,
              diversityScore: 0,
              noveltyScore: 0,
              confidence: 0,
            },
          },
          explanation:
            '未检索到可用推荐。请确认：1）联网检索已配置且可用（WEB_SEARCH_PROVIDER / Coze 或 WEB_SEARCH_HTTP_URL）；2）向量嵌入服务正常以便检索历史案例；3）知识库中是否有相关内容。',
        },
      });
    }

    // 3. 优化推荐结果（多样性、新颖性）
    let optimized = await optimizeRecommendations(candidates, userProfile);
    console.log('[Recommendation API] Optimized to:', optimized.length);

    const displayMax = getRecommendDisplayMax();
    optimized = optimized.slice(0, displayMax);
    console.log('[Recommendation API] Display cap:', displayMax, '→ items:', optimized.length);

    // 3.5 单次 LLM 调用为每条展示项生成理由（条数 ≤ displayMax，一次请求内完成）
    optimized = await enrichRecommendationsWithBatchLLM(query, optimized);

    // 4. 生成整体说明（模板；单条理由已在上一歩写入 explanation）
    const explanation = generateExplanation(query, optimized, userProfile, intent.strategy);

    // 5. 返回推荐结果
    const recommendations = {
      items: optimized,
      strategy: intent.strategy || '联网检索与知识融合',
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
        items: optimized,
        recommendations,
        explanation,
        metadata: recommendations.metadata,
      },
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

/** 联网检索 → 推荐候选（含可点击来源） */
async function fetchWebSearchCandidates(
  query: string,
  intent: { type: string; interests: string[] }
): Promise<any[]> {
  const count = Math.min(
    15,
    Math.max(5, parseInt(process.env.RECOMMENDATION_WEB_SEARCH_COUNT || '12', 10) || 12)
  );
  try {
    const res = await advancedWebSearch(
      query,
      { searchType: 'web', count, needSummary: true },
      undefined
    );
    const raw = (res.web_items ?? res.results ?? []) as any[];
    const out: any[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      const url = String(item.url || item.link || '').trim();
      const title = String(item.title || item.name || '').trim() || '未命名结果';
      const dedupeKey = url || `${title}_${i}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      let summary = '';
      if (typeof item.summary === 'string') summary = item.summary;
      else if (typeof item.snippet === 'string') summary = item.snippet;
      else if (typeof item.content === 'string') summary = item.content.substring(0, 400);
      summary = summary.trim().slice(0, 500);

      const relRaw = item.relevance ?? item.score;
      const rel =
        typeof relRaw === 'number' && !Number.isNaN(relRaw)
          ? Math.min(0.95, Math.max(0.5, relRaw))
          : 0.9 - i * 0.02;

      const idKey = url || title;
      const id = `web_${createHash('sha1').update(idKey).digest('hex').slice(0, 24)}`;

      out.push({
        id,
        title,
        type: intent.type,
        description: summary || title,
        url,
        source: String(item.source || item.site || '网络').slice(0, 120),
        sourceUrl: url,
        score: rel,
        confidence: Math.min(0.92, rel),
        explanation: url
          ? `联网检索 · ${String(item.source || item.site || '来源待核').slice(0, 80)}`
          : '联网检索（无有效链接，请核对来源）',
        knowledgeSources: url ? [{ title, url, relevance: rel }] : [],
        features: {
          category: intent.type,
          tags: intent.interests,
          attributes: { matchType: 'web_search', url: url || undefined },
        },
      });
    }

    if (out.length) {
      console.log('[Recommendation API] Web search candidates:', out.length);
    }
    return out;
  } catch (e) {
    console.error('[Recommendation API] Web search failed:', e);
    return [];
  }
}

/**
 * 生成候选推荐（联网检索 + 向量 + 知识库；无模板/mock）
 */
async function generateCandidates(
  query: string,
  intent: any,
  userProfile: any,
  knowledgeManager: any,
  vectorStore: any
): Promise<any[]> {
  const candidates: any[] = [];

  const webItems = await fetchWebSearchCandidates(query, intent);
  candidates.push(...webItems);

  try {
    const vectorResults = await vectorStore.search(query, {
      topK: 5,
      threshold: 0.6,
      embeddingType: intent.type,
    });

    for (const result of vectorResults.slice(0, 5)) {
      if (!candidates.some((c) => c.id === result.entry.caseId)) {
        candidates.push({
          id: result.entry.caseId,
          title: generateTitleFromVector(result.entry),
          type: intent.type,
          description: result.entry.textPreview || `基于向量检索的${intent.type}相关案例`,
          score: result.similarity,
          confidence: Math.min(result.similarity, 0.95),
          explanation: `向量相似度 ${(result.similarity * 100).toFixed(0)}%，来自历史案例库`,
          knowledgeSources: [],
          features: {
            category: intent.type,
            tags: intent.interests,
            attributes: { matchType: 'vector' },
          },
        });
      }
    }
  } catch (error) {
    console.error('[Recommendation API] Vector search failed:', error);
  }

  try {
    const knowledgeResults = await knowledgeManager.queryRecommendationKnowledge(query, {
      limit: 5,
    });

    for (const result of knowledgeResults) {
      const itemId = `kb_${result.entry.id}`;
      if (!candidates.some((c) => c.id === itemId)) {
        candidates.push({
          id: itemId,
          title: result.entry.title,
          type: 'article',
          description: result.entry.content.substring(0, 200),
          score: result.relevance,
          confidence: Math.min(result.relevance * 0.9, 0.9),
          explanation:
            result.entry.description ||
            `知识库命中（相关度 ${(result.relevance * 100).toFixed(0)}%）`,
          knowledgeSources: [{ title: result.entry.title, relevance: result.relevance }],
          features: {
            category: result.entry.metadata?.type || 'knowledge',
            tags: result.entry.metadata?.tags || [],
            attributes: { source: 'knowledge_base' },
          },
        });
      }
    }
  } catch (error) {
    console.error('[Recommendation API] Knowledge search failed:', error);
  }

  return candidates.sort((a, b) => b.score - a.score);
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
 * 生成整体说明文案（模板拼接，非逐条调用大模型）。
 * 单条「推荐理由」来自候选或后续批量 LLM 写入的 explanation。
 */
function generateExplanation(
  query: string,
  recommendations: any[],
  userProfile: any,
  strategyHint?: string
): string {
  const topItem = recommendations[0];
  const strategy = strategyHint || topItem?.strategy || '联网检索与知识融合';
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
