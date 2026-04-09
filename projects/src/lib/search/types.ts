/**
 * 与 Coze SearchClient.advancedSearch 对齐的选项/响应形状，便于 HTTP 适配器复用。
 */
export type WebSearchAdvancedOptions = {
  searchType?: string;
  count?: number;
  needSummary?: boolean;
  needContent?: boolean;
  timeRange?: string;
};

export type WebSearchRawItem = Record<string, unknown> & {
  title?: string;
  url?: string;
  snippet?: string;
  content?: string;
  site_name?: string;
  publish_time?: string;
  auth_info_level?: number;
  auth_info_des?: string;
};

export type WebSearchAdvancedResponse = {
  web_items?: WebSearchRawItem[];
  results?: WebSearchRawItem[];
  summary?: string;
};
