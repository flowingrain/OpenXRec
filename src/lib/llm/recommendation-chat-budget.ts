/**
 * 推荐对话记忆 token 预算（用于 ContextManager 压缩触发阈值）。
 *
 * 说明：
 * - 多数云端 LLM 不会在 chat/completions 响应里返回「剩余上下文」；无法 100% 自动推断。
 * - 部分 OpenAI 兼容推理（如 vLLM）在 GET /v1/models 里会带 max_model_len / context_length，可用 probe 辅助。
 * - 最稳妥仍是显式配置：OPENXREC_LLM_MAX_CONTEXT_TOKENS × OPENXREC_RECOMMENDATION_CHAT_MEMORY_RATIO，
 *   或直接 OPENXREC_RECOMMENDATION_CHAT_TOKEN_BUDGET。
 */

const DEFAULT_BUDGET = 8000;
const DEFAULT_MEMORY_RATIO = 0.25;

/**
 * 同步解析预算（无网络）。优先级：
 * 1) OPENXREC_RECOMMENDATION_CHAT_TOKEN_BUDGET 显式整数
 * 2) floor(OPENXREC_LLM_MAX_CONTEXT_TOKENS × OPENXREC_RECOMMENDATION_CHAT_MEMORY_RATIO)
 * 3) DEFAULT_BUDGET（8000）
 */
export function getRecommendationChatMemoryTokenBudgetSync(): number {
  const explicit = process.env.OPENXREC_RECOMMENDATION_CHAT_TOKEN_BUDGET?.trim();
  if (explicit) {
    const n = Number(explicit);
    if (Number.isFinite(n) && n >= 512) return Math.floor(n);
  }

  const maxCtxRaw = process.env.OPENXREC_LLM_MAX_CONTEXT_TOKENS?.trim();
  const ratioRaw = process.env.OPENXREC_RECOMMENDATION_CHAT_MEMORY_RATIO?.trim();
  const ratioParsed = ratioRaw ? Number(ratioRaw) : DEFAULT_MEMORY_RATIO;
  const ratio =
    Number.isFinite(ratioParsed) && ratioParsed > 0 && ratioParsed <= 1
      ? ratioParsed
      : DEFAULT_MEMORY_RATIO;

  if (maxCtxRaw) {
    const m = Number(maxCtxRaw);
    if (Number.isFinite(m) && m >= 1024) {
      return Math.max(512, Math.floor(m * ratio));
    }
  }

  return DEFAULT_BUDGET;
}

export type OpenAiCompatibleModelRow = {
  id?: string;
  max_model_len?: number;
  context_length?: number;
};

/**
 * 尝试从 OpenAI 兼容服务的 GET /v1/models 解析当前模型的最大上下文长度。
 * 成功返回正整数；不支持或失败返回 null（需改用手动 env）。
 */
export async function probeOpenAiCompatibleModelMaxContext(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}): Promise<number | null> {
  const raw = params.baseUrl.trim().replace(/\/$/, '');
  const origin = raw.endsWith('/v1') ? raw.slice(0, -3) : raw;
  const url = `${origin.replace(/\/$/, '')}/v1/models`;
  try {
    const ac = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(10000) : undefined;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.apiKey.trim()}`,
      },
      signal: ac,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: OpenAiCompatibleModelRow[] };
    const list = body.data || [];
    const mid = params.modelId.trim();
    const row =
      list.find((m) => m.id === mid) ||
      list.find((m) => typeof m.id === 'string' && (m.id === mid || m.id.endsWith(mid)));
    if (!row) return null;
    const n = row.max_model_len ?? row.context_length;
    if (typeof n === 'number' && Number.isFinite(n) && n >= 1024) return Math.floor(n);
    return null;
  } catch {
    return null;
  }
}

/**
 * 用探测到的模型全长 × 占比得到预算（仍建议把结果写入 env 以免每次请求探测）。
 */
export async function getRecommendationChatMemoryTokenBudgetFromProbe(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}): Promise<number | null> {
  const maxLen = await probeOpenAiCompatibleModelMaxContext(params);
  if (maxLen == null) return null;
  const ratioRaw = process.env.OPENXREC_RECOMMENDATION_CHAT_MEMORY_RATIO?.trim();
  const ratioParsed = ratioRaw ? Number(ratioRaw) : DEFAULT_MEMORY_RATIO;
  const ratio =
    Number.isFinite(ratioParsed) && ratioParsed > 0 && ratioParsed <= 1
      ? ratioParsed
      : DEFAULT_MEMORY_RATIO;
  return Math.max(512, Math.floor(maxLen * ratio));
}
