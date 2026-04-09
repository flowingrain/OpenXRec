import type { WebSearchAdvancedResponse, WebSearchRawItem } from './types';

/** 默认联网超时（毫秒），含 Coze / HTTP / Tavily */
export function getWebSearchTimeoutMs(): number {
  const raw = process.env.WEB_SEARCH_TIMEOUT_MS;
  if (raw == null || raw === '') return 45_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 3_000 ? Math.min(n, 120_000) : 45_000;
}

export function getHttpSearchRetries(): number {
  const raw = process.env.WEB_SEARCH_HTTP_RETRIES;
  if (raw == null || raw === '') return 2;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 5) : 2;
}

/**
 * 对 Promise 施加超时；超时后 AbortSignal 若存在则 abort（用于 fetch）。
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  abort?: AbortController
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      try {
        abort?.abort();
      } catch {
        /* ignore */
      }
      reject(new Error(`Web search timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * 将各渠道返回的字段别名统一为 WebSearchRawItem（title/url/snippet 等）。
 */
export function normalizeWebItem(raw: unknown): WebSearchRawItem {
  if (raw == null || typeof raw !== 'object') {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? o.name ?? o.headline ?? '').trim();
  const url = String(o.url ?? o.link ?? o.href ?? '').trim();
  const snippet = String(
    o.snippet ?? o.summary ?? o.description ?? o.text ?? o.content ?? ''
  ).trim();
  const site_name = String(
    o.site_name ?? o.source ?? o.site ?? o.publisher ?? o.siteName ?? ''
  ).trim();
  const content =
    typeof o.content === 'string' ? o.content : typeof o.body === 'string' ? o.body : undefined;

  return {
    ...o,
    title: title || undefined,
    url: url || undefined,
    snippet: snippet ? snippet.slice(0, 16_000) : undefined,
    content: content?.slice(0, 32_000),
    site_name: site_name || undefined,
  };
}

export function normalizeWebItems(items: unknown[]): WebSearchRawItem[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeWebItem).filter((it) => it.title || it.url || it.snippet);
}

export function normalizeResponse(data: WebSearchAdvancedResponse): WebSearchAdvancedResponse {
  const raw = data.web_items ?? data.results ?? [];
  const web_items = normalizeWebItems(Array.isArray(raw) ? raw : []);
  return {
    ...data,
    web_items,
    summary: typeof data.summary === 'string' ? data.summary : '',
  };
}
