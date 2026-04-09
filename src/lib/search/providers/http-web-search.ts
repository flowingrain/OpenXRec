import type { WebSearchAdvancedOptions, WebSearchAdvancedResponse } from '../types';
import { getHttpSearchRetries, normalizeResponse } from '../web-search-utils';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 自定义 HTTP 检索：POST JSON 到 WEB_SEARCH_HTTP_URL，需返回 { web_items } 或 { results }。
 * 支持超时（AbortController）、有限次重试（仅网络错误与 5xx）。
 */
export async function searchViaHttp(
  query: string,
  options: WebSearchAdvancedOptions,
  timeoutMs: number
): Promise<WebSearchAdvancedResponse> {
  const url = process.env.WEB_SEARCH_HTTP_URL?.trim();
  if (!url) {
    throw new Error('WEB_SEARCH_HTTP_URL is empty');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.WEB_SEARCH_HTTP_SECRET;
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const extra = process.env.WEB_SEARCH_HTTP_HEADERS_JSON;
  if (extra) {
    try {
      Object.assign(headers, JSON.parse(extra) as Record<string, string>);
    } catch {
      console.warn('[searchViaHttp] WEB_SEARCH_HTTP_HEADERS_JSON is not valid JSON');
    }
  }

  const retries = getHttpSearchRetries();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, ...options }),
        signal: abort.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      if (!res.ok) {
        const err = new Error(`WEB_SEARCH_HTTP ${res.status}: ${text.slice(0, 500)}`);
        if (res.status >= 500 && attempt < retries) {
          lastError = err;
          await sleep(300 * (attempt + 1));
          continue;
        }
        throw err;
      }

      let data: WebSearchAdvancedResponse;
      try {
        data = JSON.parse(text) as WebSearchAdvancedResponse;
      } catch {
        throw new Error('WEB_SEARCH_HTTP response is not JSON');
      }
      return normalizeResponse(data);
    } catch (e) {
      clearTimeout(timer);
      const err = e instanceof Error ? e : new Error(String(e));
      const isAbort = err.name === 'AbortError' || err.message.includes('timed out');
      const isNetwork =
        err.message.includes('fetch') ||
        err.message.includes('network') ||
        err.message.includes('ECONNRESET');

      if ((isAbort || isNetwork) && attempt < retries) {
        lastError = err;
        await sleep(300 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('WEB_SEARCH_HTTP failed after retries');
}
