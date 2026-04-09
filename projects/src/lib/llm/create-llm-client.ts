import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getChatModelId, isDeepSeekConfigured } from './chat-model';

type SdkMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type InvokeOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

/**
 * DeepSeek 等 OpenAI 兼容 Chat Completions（仅实现本仓库用到的 invoke）。
 */
class OpenAICompatibleInvokeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    const key = process.env.DEEPSEEK_API_KEY?.trim();
    if (!key) throw new Error('DEEPSEEK_API_KEY is required for OpenAI-compatible LLM client');
    this.apiKey = key;
    this.baseUrl = (process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
  }

  async invoke(
    messages: SdkMessage[],
    options?: InvokeOptions
  ): Promise<{ content: string }> {
    const model = getChatModelId(options?.model);
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`LLM ${res.status}: ${text.slice(0, 800)}`);
    }
    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error('LLM response is not valid JSON');
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    return { content };
  }
}

/**
 * 配置了 DEEPSEEK_API_KEY 时走 DeepSeek OpenAPI；否则走 Coze SDK（豆包等）。
 */
export function createLLMClient(customHeaders?: Record<string, string>): LLMClient {
  if (isDeepSeekConfigured()) {
    return new OpenAICompatibleInvokeClient() as unknown as LLMClient;
  }
  const config = new Config();
  return new LLMClient(config, customHeaders);
}

export { getChatModelId, isDeepSeekConfigured } from './chat-model';
