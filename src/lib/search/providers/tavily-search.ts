import type { WebSearchAdvancedOptions, WebSearchAdvancedResponse } from '../types';
import { normalizeWebItems } from '../web-search-utils';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Tavily Search API（需 TAVILY_API_KEY）。
 * @see https://docs.tavily.com/
 */
export async function searchTavily(
  query: string,
  options: WebSearchAdvancedOptions,
  signal?: AbortSignal
): Promise<WebSearchAdvancedResponse> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not set');
  }

  const maxResults = Math.min(20, Math.max(1, options.count ?? 10));
  const depth = (process.env.TAVILY_SEARCH_DEPTH || 'basic').toLowerCase().trim();
  const search_depth = depth === 'advanced' ? 'advanced' : 'basic';

  const body = {
    api_key: apiKey,
    query: query.trim(),
    max_results: maxResults,
    search_depth,
    include_answer: Boolean(process.env.TAVILY_INCLUDE_ANSWER === '1' || process.env.TAVILY_INCLUDE_ANSWER === 'true'),
    include_raw_content: false,
  };

  const res = await fetch(TAVILY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Tavily HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  let data: {
    results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string; score?: number }>;
    answer?: string;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error('Tavily response is not valid JSON');
  }

  const mapped = (data.results ?? []).map((r) => {
    const url = String(r.url ?? '').trim();
    const content = String(r.content ?? r.raw_content ?? '').trim();
    return {
      title: r.title,
      url: url || undefined,
      snippet: content.slice(0, 8000),
      content: content.slice(0, 16000),
      site_name: hostnameFromUrl(url),
    };
  });

  return {
    web_items: normalizeWebItems(mapped),
    summary: typeof data.answer === 'string' ? data.answer : '',
  };
}
