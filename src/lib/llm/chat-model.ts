import { isLabVllmLlmConfigured } from '@/lib/runtime/openxrec-runtime';

/**
 * 解析当前应使用的聊天模型 ID（Coze 豆包 / DeepSeek OpenAPI 兼容等）。
 */
export function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

/**
 * @param callerModel - 调用方传入的 model（如仍为 doubao-* 则在 DeepSeek 模式下会被忽略）
 */
export function getChatModelId(callerModel?: string): string {
  const c = callerModel?.trim();
  if (isLabVllmLlmConfigured()) {
    if (c && !c.startsWith('doubao-')) return c;
    return (process.env.OPENXREC_LAB_LLM_MODEL || '').trim();
  }
  if (isDeepSeekConfigured()) {
    if (c && !c.startsWith('doubao-')) return c;
    return (process.env.DEEPSEEK_MODEL || process.env.LLM_MODEL || 'deepseek-chat').trim();
  }
  if (c) return c;
  return (process.env.LLM_MODEL || 'doubao-seed-2-0-pro-260215').trim();
}
