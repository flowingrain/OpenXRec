/**
 * 加载 .env.local / .env（不覆盖已存在的 process.env，与 Next.js 行为一致）
 *
 * 查找顺序（先找到先加载）：
 * 1. process.cwd()/.env.local、.env
 * 2. 相对于本文件所在目录的上一级（即 projects/），解决从子目录执行命令时 cwd 不对的问题
 */
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const resolved = path.resolve(p);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      out.push(resolved);
    }
  }
  return out;
}

export function loadEnvLocal(cwd: string = process.cwd()): string[] {
  const fromScript = path.join(
    typeof __dirname !== 'undefined' ? __dirname : cwd,
    '..'
  );
  const candidates = uniquePaths([
    path.join(cwd, '.env.local'),
    path.join(cwd, '.env'),
    path.join(fromScript, '.env.local'),
    path.join(fromScript, '.env'),
  ]);

  const loaded: string[] = [];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    dotenv.config({ path: file, override: false });
    loaded.push(file);
  }
  return loaded;
}
