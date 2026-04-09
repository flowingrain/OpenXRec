import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

let envLoaded = false;
let cachedClient: SupabaseClient | null = null;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

/**
 * 检测是否处于构建阶段
 */
function isBuildTime(): boolean {
  // Next.js 构建时会设置 NODE_ENV 为 'production' 但没有真正的服务器运行
  // 或者检查是否在 Turbopack/Babel 编译上下文中
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-build' ||
    process.env.BABEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && !process.env.SUPABASE_URL)
  );
}

/**
 * 检测是否为 placeholder 值
 */
function isPlaceholderValue(value: string | undefined): boolean {
  return !value || value === '' || value.startsWith('placeholder') || value.includes('test');
}

function loadEnv(): void {
  if (envLoaded) {
    return;
  }

  // 构建时跳过环境加载
  if (isBuildTime()) {
    return;
  }

  try {
    try {
      require('dotenv').config();
    } catch {
      // dotenv not available
    }

    // 如果已经有环境变量，直接返回
    if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
      // 检查是否是 placeholder
      if (!isPlaceholderValue(process.env.COZE_SUPABASE_URL)) {
        envLoaded = true;
        return;
      }
    }
  } catch {
    // Silently fail
  }

  // 尝试从 Coze 工作负载身份获取
  try {
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // Silently fail - 构建时这是预期的
  }
}

function getSupabaseCredentials(): SupabaseCredentials | null {
  // 构建时返回 null
  if (isBuildTime()) {
    return null;
  }

  loadEnv();

  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  // 检查是否是有效的非 placeholder 值
  if (!url || isPlaceholderValue(url)) {
    return null;
  }
  if (!anonKey || isPlaceholderValue(anonKey)) {
    return null;
  }

  return { url, anonKey };
}

/**
 * 获取 Supabase 客户端
 * 构建时返回模拟客户端，运行时返回真实客户端
 */
function getSupabaseClient(token?: string): SupabaseClient {
  // 构建时返回模拟客户端
  if (isBuildTime()) {
    return createMockClient();
  }

  // 返回缓存的客户端
  if (cachedClient && !token) {
    return cachedClient;
  }

  const credentials = getSupabaseCredentials();
  
  if (!credentials) {
    return createMockClient();
  }

  const { url, anonKey } = credentials;

  if (token) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      db: {
        timeout: 60000,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  cachedClient = createClient(url, anonKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

/**
 * 创建模拟客户端（当真实客户端不可用时使用）
 */
function createMockClient(): SupabaseClient {
  const mockQuery = () => ({
    select: () => mockQuery(),
    insert: () => mockQuery(),
    update: () => mockQuery(),
    delete: () => mockQuery(),
    upsert: () => mockQuery(),
    eq: () => mockQuery(),
    neq: () => mockQuery(),
    gt: () => mockQuery(),
    gte: () => mockQuery(),
    lt: () => mockQuery(),
    lte: () => mockQuery(),
    like: () => mockQuery(),
    ilike: () => mockQuery(),
    in: () => mockQuery(),
    contains: () => mockQuery(),
    or: () => mockQuery(),
    not: () => mockQuery(),
    order: () => mockQuery(),
    limit: () => mockQuery(),
    range: () => mockQuery(),
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  });

  return {
    from: () => mockQuery() as any,
    rpc: () => Promise.resolve({ data: null, error: null }) as any,
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        remove: () => Promise.resolve({ data: null, error: null }),
        createSignedUrl: () => Promise.resolve({ data: null, error: null }),
      }),
    },
    auth: {
      getSession: () => Promise.resolve({ data: null, error: null }),
      getUser: () => Promise.resolve({ data: null, error: null }),
    },
  } as unknown as SupabaseClient;
}

/**
 * 强制重新加载环境变量（用于运行时刷新）
 */
function reloadEnv(): void {
  envLoaded = false;
  cachedClient = null;
  loadEnv();
}

/**
 * 检查 Supabase 是否可用
 */
function isSupabaseAvailable(): boolean {
  const creds = getSupabaseCredentials();
  return creds !== null;
}

export { loadEnv, reloadEnv, getSupabaseCredentials, getSupabaseClient, isSupabaseAvailable, isBuildTime };
