import { createLLMClient } from '@/lib/llm/create-llm-client';
import { getChatModelId } from '@/lib/llm/chat-model';

/**
 * 最终向用户展示的推荐条数：默认 10，可通过环境变量限制在 5～10。
 */
export function getRecommendDisplayMax(): number {
  const raw = process.env.RECOMMENDATION_MAX_ITEMS?.trim();
  if (raw === undefined || raw === '') return 10;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 10;
  return Math.min(10, Math.max(5, n));
}

/**
 * 在一次 Chat Completions 调用中，为每条推荐生成中文「推荐理由」，写回 `explanation`。
 * 失败或未启用时原样返回 items（调用方宜已按 getRecommendDisplayMax() 截断）。
 */
export async function enrichRecommendationsWithBatchLLM(
  query: string,
  items: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const limited = items.slice(0, getRecommendDisplayMax());
  if (!limited.length) return limited;

  const skip =
    process.env.RECOMMENDATION_BATCH_LLM_EXPLANATIONS === '0' ||
    process.env.RECOMMENDATION_BATCH_LLM_EXPLANATIONS === 'false';
  if (skip) return limited;

  try {
    const llmClient = createLLMClient();
    const brief = limited.map((it, i) => ({
      i,
      id: String(it.id ?? i),
      title: String(it.title ?? '').slice(0, 140),
      description: String(it.description ?? '').slice(0, 240),
      type: String(it.type ?? ''),
      url: typeof it.url === 'string' ? it.url.slice(0, 300) : typeof it.sourceUrl === 'string' ? it.sourceUrl.slice(0, 300) : '',
      source: typeof it.source === 'string' ? it.source.slice(0, 80) : '',
    }));

    const user = `用户需求/查询：
${query}

以下为待解释的推荐项（请按顺序为每一项写一条中文「推荐理由」，1～2 句，说明与用户需求的相关性；若含 url 可简要提示「可打开链接查看」；勿编造不存在的网站或课程名）：
${JSON.stringify(brief, null, 2)}

只输出一个 JSON 对象，格式严格为：
{"reasons":["第0条理由","第1条理由",...]}
其中 reasons 数组长度必须为 ${brief.length}，与上面列表顺序一致。不要 markdown 代码块。`;

    const res = await llmClient.invoke(
      [
        { role: 'system', content: '你是推荐系统解释助手，只输出合法 JSON，理由简洁、可读。' },
        { role: 'user', content: user },
      ],
      { model: getChatModelId(), temperature: 0.35 }
    );

    const text = (res.content || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[batch-llm-explanations] No JSON object in model output');
      return limited;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { reasons?: unknown };
    const reasons = parsed.reasons;
    if (!Array.isArray(reasons)) {
      console.warn('[batch-llm-explanations] reasons is not an array');
      return limited;
    }

    return limited.map((it, idx) => {
      const r = reasons[idx];
      const line =
        typeof r === 'string' && r.trim()
          ? r.trim()
          : typeof it.explanation === 'string'
            ? it.explanation
            : '';
      return { ...it, explanation: line || it.explanation };
    });
  } catch (e) {
    console.error('[batch-llm-explanations]', e);
    return limited;
  }
}
