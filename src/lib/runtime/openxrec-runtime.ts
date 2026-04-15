/**
 * 运行环境：同一套代码在「本地 / Coze 托管」下选用不同后端能力。
 *
 * - `local`（默认）：LLM 优先 DEEPSEEK；联网检索优先 TAVILY / 自定义 HTTP（见 advanced-web-search）。
 * - `coze`：LLM 与联网检索走 coze-coding-dev-sdk（需 Coze 运行时注入）。
 *
 * 在 Coze 控制台 / 部署环境设置 OPENXREC_RUNTIME=coze；本地开发不设置或设为 local。
 *
 * 本地再分子场景（仅 OPENXREC_RUNTIME=local 时生效）：
 * - `OPENXREC_DEV_PROFILE=cloud`（默认）：走公网替代能力（DeepSeek / DashScope / Tavily 等），适合不在实验室的本地开发。
 * - `OPENXREC_DEV_PROFILE=lab`：实验室内网；可配 `OPENXREC_LAB_API_BASE` 给自建 BFF；也可配 vLLM OpenAI 兼容端点（见 `OPENXREC_LAB_LLM_*` / `OPENXREC_LAB_EMBEDDING_*`，典型为 SSH 隧道后的 8010/8011）。
 */

export type OpenXRecRuntime = 'local' | 'coze';

/** 本地开发子场景：公网替代栈 vs 实验室内网 */
export type OpenXRecDevProfile = 'lab' | 'cloud';

/** 对外部 HTTP 能力的大致归类（便于日志与后续扩展） */
export type OpenXRecHttpStackMode = 'coze_sdk' | 'lab_http' | 'public_http';

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

/**
 * 本地开发子配置。Coze 托管下固定为 `cloud`（实验室内网模式不适用）。
 */
export function getOpenXRecDevProfile(): OpenXRecDevProfile {
  if (isCozePlatformRuntime()) {
    return 'cloud';
  }
  const raw = process.env.OPENXREC_DEV_PROFILE?.trim().toLowerCase();
  if (raw === 'lab' || raw === 'lan' || raw === 'intranet') {
    return 'lab';
  }
  return 'cloud';
}

export function isLabDevProfile(): boolean {
  return !isCozePlatformRuntime() && getOpenXRecDevProfile() === 'lab';
}

/**
 * 实验室内统一 HTTP 入口（如 http://192.168.x.x:8000），不要尾斜杠。
 */
export function getLabApiBaseUrl(): string | null {
  const b = process.env.OPENXREC_LAB_API_BASE?.trim();
  if (!b) return null;
  return b.replace(/\/$/, '');
}

export function getHttpStackMode(): OpenXRecHttpStackMode {
  if (isCozePlatformRuntime()) return 'coze_sdk';
  if (
    isLabDevProfile() &&
    (getLabApiBaseUrl() || isLabVllmLlmConfigured() || isLabVllmEmbeddingConfigured())
  ) {
    return 'lab_http';
  }
  return 'public_http';
}

/** 实验室 vLLM 对话服务（OpenAI 兼容，如 http://127.0.0.1:8010/v1） */
export function isLabVllmLlmConfigured(): boolean {
  if (!isLabDevProfile()) return false;
  return Boolean(
    process.env.OPENXREC_LAB_LLM_BASE_URL?.trim() &&
      process.env.OPENXREC_LAB_LLM_API_KEY?.trim() &&
      process.env.OPENXREC_LAB_LLM_MODEL?.trim()
  );
}

/** 实验室 vLLM 向量服务（OpenAI 兼容，如 http://127.0.0.1:8011/v1） */
export function isLabVllmEmbeddingConfigured(): boolean {
  if (!isLabDevProfile()) return false;
  return Boolean(
    process.env.OPENXREC_LAB_EMBEDDING_BASE_URL?.trim() &&
      process.env.OPENXREC_LAB_EMBEDDING_API_KEY?.trim() &&
      process.env.OPENXREC_LAB_EMBEDDING_MODEL?.trim()
  );
}

/** 35B 等推理较慢时可调大（毫秒），默认 120s */
export function getLabLlmTimeoutMs(): number {
  const raw = process.env.OPENXREC_LAB_LLM_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 5000) return n;
  return 120_000;
}

/** 向量服务默认 60s；可调 OPENXREC_LAB_EMBEDDING_TIMEOUT_MS */
export function getLabEmbeddingTimeoutMs(): number {
  const raw = process.env.OPENXREC_LAB_EMBEDDING_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 3000) return n;
  return 60_000;
}

/**
 * 服务端请求实验室内服务时使用：`joinLabApiUrl('/v1/embed')`。
 * 未配置实验室内网或未处于 lab 配置时返回 null。
 */
export function joinLabApiUrl(path: string): string | null {
  if (!isLabDevProfile()) return null;
  const base = getLabApiBaseUrl();
  if (!base) return null;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
