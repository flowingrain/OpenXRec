/**
 * 合并迁移 SQL 为单文件，供 Supabase 网页「SQL Editor」粘贴执行（无需本机 TCP 直连）。
 *
 * 运行：pnpm db:sql-bundle
 * 输出：supabase/migrate-all-for-sql-editor.sql
 *
 * 使用：Dashboard → SQL → New query → 粘贴全部内容 → Run
 *
 * 首段含 000_pre_vector_cleanup.sql：先 DROP 向量索引并将旧 vector 列改为 2000 维，便于重复执行。
 */

import * as fs from 'fs';
import * as path from 'path';
import { SUPABASE_SQL_MIGRATION_FILES } from './supabase-sql-sources';

const OUT = 'supabase/migrate-all-for-sql-editor.sql';

function main(): void {
  const cwd = process.cwd();
  const parts: string[] = [
    `-- ============================================================================`,
    `-- 自动生成：pnpm db:sql-bundle`,
    `-- 在 Supabase SQL Editor 中整段执行即可（走 HTTPS，无需本机 postgres 直连）`,
    `-- ============================================================================`,
    ``,
    `CREATE EXTENSION IF NOT EXISTS vector;`,
    ``,
  ];

  for (const relative of SUPABASE_SQL_MIGRATION_FILES) {
    const fp = path.join(cwd, relative);
    if (!fs.existsSync(fp)) {
      console.error(`❌ 缺少文件: ${fp}`);
      process.exit(1);
    }
    const body = fs.readFileSync(fp, 'utf8').trim();
    parts.push(
      `-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`,
      `-- 来源: ${relative}`,
      `-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<`,
      ``,
      body,
      ``
    );
  }

  const outPath = path.join(cwd, OUT);
  fs.writeFileSync(outPath, parts.join('\n'), 'utf8');
  console.log(`✅ 已写入: ${outPath}`);
  console.log(`\n下一步：用编辑器打开该文件，全选复制 → Supabase → SQL Editor → 粘贴 → Run`);
}

main();
