/**
 * 运行环境：同一套代码在「本地 / Coze 托管」下选用不同后端能力。
 *
 * - `local`（默认）：LLM 优先 DEEPSEEK；联网检索优先 TAVILY / 自定义 HTTP（见 advanced-web-search）。
 * - `coze`：LLM 与联网检索走 coze-coding-dev-sdk（需 Coze 运行时注入）。
 *
 * 在 Coze 控制台 / 部署环境设置 OPENXREC_RUNTIME=coze；本地开发不设置或设为 local。
 */

export type OpenXRecRuntime = 'local' | 'coze';

export function getOpenXRecRuntime(): OpenXRecRuntime {
  const raw = process.env.OPENXREC_RUNTIME?.trim().toLowerCase();
  if (raw === 'coze' || raw === 'hosted') {
    return 'coze';
  }
  if (raw === 'local') {
    return 'local';
  }
  return 'local';
}

export function isCozePlatformRuntime(): boolean {
  return getOpenXRecRuntime() === 'coze';
}
