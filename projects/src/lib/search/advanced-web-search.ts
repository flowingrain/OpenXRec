import type { WebSearchAdvancedOptions, WebSearchAdvancedResponse } from './types';
import { searchViaHttp } from './providers/http-web-search';
import { searchTavily } from './providers/tavily-search';
import { getWebSearchTimeoutMs, normalizeResponse, withTimeout } from './web-search-utils';

export type WebSearchProvider = 'coze' | 'http' | 'tavily' | 'none';

export function getWebSearchProvider(): WebSearchProvider {
  const p = (process.env.WEB_SEARCH_PROVIDER || 'coze').toLowerCase().trim();
  if (p === 'http' || p === 'none' || p === 'tavily') return p;
  return 'coze';
}

/**
 * 统一联网检索入口。
 *
 * - **coze**（默认）：coze-coding-dev-sdk SearchClient，整段调用带超时
 * - **tavily**：直连 Tavily REST（需 `TAVILY_API_KEY`，`WEB_SEARCH_PROVIDER=tavily`）
 * - **http**：POST 到 `WEB_SEARCH_HTTP_URL`，支持超时与重试（见 `searchViaHttp`）
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
    if (!process.env.WEB_SEARCH_HTTP_URL?.trim()) {
      console.warn('[advancedWebSearch] WEB_SEARCH_PROVIDER=http but WEB_SEARCH_HTTP_URL is empty');
      return { web_items: [], summary: '' };
    }
    return searchViaHttp(query, options, timeoutMs);
  }

  if (provider === 'tavily') {
    const abort = new AbortController();
    const p = searchTavily(query, options, abort.signal);
    const raw = await withTimeout(p, timeoutMs, abort);
    return normalizeResponse(raw);
  }

  const { SearchClient, Config } = await import('coze-coding-dev-sdk');
  const config = new Config();
  const client = new SearchClient(config, forwardHeaders as any);
  const raw = (await withTimeout(
    client.advancedSearch(query, options as any) as Promise<unknown>,
    timeoutMs
  )) as WebSearchAdvancedResponse;
  return normalizeResponse(raw);
}
