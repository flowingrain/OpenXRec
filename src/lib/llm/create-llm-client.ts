import type { LLMClient } from 'coze-coding-dev-sdk';
import {
  getLabLlmTimeoutMs,
  isCozePlatformRuntime,
  isLabVllmLlmConfigured,
} from '@/lib/runtime/openxrec-runtime';
import { getChatModelId, isDeepSeekConfigured } from './chat-model';

type SdkMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type InvokeOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

/** OpenAI 兼容 Chat Completions URL（base 可已含 `/v1`，如 vLLM）。 */
function openAiChatCompletionsUrl(baseRaw: string): string {
  const base = baseRaw.trim().replace(/\/$/, '');
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/**
 * 实验室 vLLM（OpenAI 兼容 Chat Completions），如 SSH 隧道到 8010。
 */
class LabOpenAICompatibleInvokeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    const key = process.env.OPENXREC_LAB_LLM_API_KEY?.trim();
    const base = process.env.OPENXREC_LAB_LLM_BASE_URL?.trim();
    if (!key || !base) {
      throw new Error(
        'OPENXREC_LAB_LLM_API_KEY and OPENXREC_LAB_LLM_BASE_URL are required for lab vLLM LLM client'
      );
    }
    this.apiKey = key;
    this.baseUrl = base;
  }

  async invoke(
    messages: SdkMessage[],
    options?: InvokeOptions
  ): Promise<{ content: string }> {
    const model = getChatModelId(options?.model);
    const url = openAiChatCompletionsUrl(this.baseUrl);
    const controller = new AbortController();
    const timeoutMs = getLabLlmTimeoutMs();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
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
        throw new Error(`Lab LLM ${res.status}: ${text.slice(0, 800)}`);
      }
      let data: { choices?: Array<{ message?: { content?: string } }> };
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        throw new Error('Lab LLM response is not valid JSON');
      }
      const content = data.choices?.[0]?.message?.content ?? '';
      return { content };
    } finally {
      clearTimeout(timer);
    }
  }
}

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
 * 未配置 DEEPSEEK 时回退 Coze SDK。使用运行时 require + next.config serverExternalPackages，
 * 避免 Webpack 把 coze-coding-dev-sdk 打进服务端 chunk（易触发 Class extends undefined）。
 */
function createCozeLLMClient(customHeaders?: Record<string, string>): LLMClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 刻意避免顶层静态 import
  const { LLMClient, Config } = require('coze-coding-dev-sdk') as typeof import('coze-coding-dev-sdk');
  return new LLMClient(new Config(), customHeaders);
}

/**
 * - `OPENXREC_RUNTIME=coze`（Coze 托管）：始终使用 coze-coding-dev-sdk LLM（与平台注入一致）。
 * - 本地 + `OPENXREC_DEV_PROFILE=lab` 且配置 `OPENXREC_LAB_LLM_*`：走实验室 vLLM（OpenAI 兼容）。
 * - 本地：配置了 `DEEPSEEK_API_KEY` 时走 DeepSeek；否则回退 Coze SDK。
 */
export function createLLMClient(customHeaders?: Record<string, string>): LLMClient {
  if (isCozePlatformRuntime()) {
    return createCozeLLMClient(customHeaders);
  }
  if (isLabVllmLlmConfigured()) {
    return new LabOpenAICompatibleInvokeClient() as unknown as LLMClient;
  }
  if (isDeepSeekConfigured()) {
    return new OpenAICompatibleInvokeClient() as unknown as LLMClient;
  }
  return createCozeLLMClient(customHeaders);
}

export { getChatModelId, isDeepSeekConfigured } from './chat-model';
