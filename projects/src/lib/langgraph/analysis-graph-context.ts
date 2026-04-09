/**
 * 编译分析图运行时的请求头（供 scout_cluster 等节点调用联网检索）。
 * 在 executeAnalysis（compile 路径）入口设置，结束后清理。
 */

let forwardHeaders: Record<string, string> = {};

export function setAnalysisForwardHeaders(headers: Record<string, string>): void {
  forwardHeaders = headers && typeof headers === 'object' ? { ...headers } : {};
}

export function getAnalysisForwardHeaders(): Record<string, string> {
  return forwardHeaders;
}

export function clearAnalysisForwardHeaders(): void {
  forwardHeaders = {};
}
