import { isCozePlatformRuntime } from '@/lib/runtime/openxrec-runtime';
import type { WebSearchAdvancedOptions, WebSearchAdvancedResponse } from './types';
import { searchViaHttp } from './providers/http-web-search';
import { searchTavily } from './providers/tavily-search';
import { getWebSearchTimeoutMs, normalizeResponse, withTimeout } from './web-search-utils';

export type WebSearchProvider = 'coze' | 'http' | 'tavily' | 'none';

/**
 * 解析当前使用的联网检索渠道。
 *
 * - **显式** `WEB_SEARCH_PROVIDER=coze|tavily|http|none` 时严格按配置（用于仍部署在 Coze 且要走 SearchClient 的场景）。
 * - **未设置时**：
 *   - `OPENXREC_RUNTIME=coze`：默认 `coze`（Coze SearchClient）。
 *   - 本地：有 `TAVILY_API_KEY` → tavily；否则 `WEB_SEARCH_HTTP_URL` → http；否则 none（不默认走 Coze，避免本地 Invalid URL）。
 */
export function getWebSearchProvider(): WebSearchProvider {
  const raw = process.env.WEB_SEARCH_PROVIDER?.trim();
  if (raw) {
    const p = raw.toLowerCase();
    if (p === 'http' || p === 'none' || p === 'tavily' || p === 'coze') {
      return p;
    }
    console.warn(`[advancedWebSearch] Unknown WEB_SEARCH_PROVIDER="${raw}", treating as none`);
    return 'none';
  }
  if (isCozePlatformRuntime()) {
    return 'coze';
  }
  if (process.env.TAVILY_API_KEY?.trim()) return 'tavily';
  if (process.env.WEB_SEARCH_HTTP_URL?.trim()) return 'http';
  return 'none';
}

/**
 * 统一联网检索入口（本地默认可脱离 Coze：Tavily / HTTP / none；Coze 仅显式开启）。
 *
 * - **tavily**：直连 https://api.tavily.com（需 `TAVILY_API_KEY`）
 * - **http**：POST 到 `WEB_SEARCH_HTTP_URL`
 * - **coze**：`OPENXREC_RUNTIME=coze` 且未设 `WEB_SEARCH_PROVIDER` 时默认；或显式 `WEB_SEARCH_PROVIDER=coze`。`forwardHeaders` 仅对此渠道有意义
 * - **none**：空结果
 */
export async function advancedWebSearch(
  query: string,
  options: WebSearchAdvancedOptions = {},
  forwardHeaders?: Record<string, string>
): Promise<WebSearchAdvancedResponse> {
  const provider = getWebSearchProvider();
  const timeoutMs = getWebSearchTimeoutMs();

  if (provider === 'none') {
    return { web_items: [], summary: '' };
  }

  if (provider === 'http') {
    const url = process.env.WEB_SEARCH_HTTP_URL?.trim();
    if (!url) {
      console.warn('[advancedWebSearch] provider=http but WEB_SEARCH_HTTP_URL is empty');
      return { web_items: [], summary: '' };
    }
    return searchViaHttp(query, options, timeoutMs);
  }

  if (provider === 'tavily') {
    if (!process.env.TAVILY_API_KEY?.trim()) {
      console.warn('[advancedWebSearch] provider=tavily but TAVILY_API_KEY is empty');
      return { web_items: [], summary: '' };
    }
    const abort = new AbortController();
    const raw = await withTimeout(searchTavily(query, options, abort.signal), timeoutMs, abort);
    return normalizeResponse(raw);
  }

  // coze：显式启用时才加载 SDK
  if (provider === 'coze') {
    try {
      const { SearchClient, Config } = await import('coze-coding-dev-sdk');
      const config = new Config();
      const client = new SearchClient(config, (forwardHeaders ?? {}) as Record<string, string>);
      const raw = (await withTimeout(
        client.advancedSearch(query, options as never) as Promise<unknown>,
        timeoutMs
      )) as WebSearchAdvancedResponse;
      return normalizeResponse(raw);
    } catch (e) {
      console.error('[advancedWebSearch] Coze SearchClient error:', e);
      return { web_items: [], summary: '' };
    }
  }

  return { web_items: [], summary: '' };
}
