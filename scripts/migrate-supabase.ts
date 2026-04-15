/**
 * 一键执行 Supabase DDL：扩展 + init.sql + migrations/002–006
 *
 * 前置条件：
 * 1. 在 Supabase Dashboard → Project Settings → Database 复制连接串（带密码）
 * 2. 在 projects/.env.local 中设置：
 *    SUPABASE_DB_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
 *    （或使用 Session pooler，以控制台文档为准）
 *
 * 运行（在 projects 目录下）：
 *   pnpm exec tsx scripts/migrate-supabase.ts
 *
 * 说明：匿名 API 密钥无法执行 DDL，必须使用数据库直连 URL。
 *
 * 若本机始终无法直连（Connection terminated），可改用浏览器执行 SQL，无需 TCP：
 *   pnpm db:sql-bundle
 *   将生成的 supabase/migrate-all-for-sql-editor.sql 粘贴到 Dashboard → SQL Editor → Run
 *
 * 首个文件 000_pre_vector_cleanup.sql 会 DROP 向量索引并将旧 vector 列规范为 1024 维，便于重复执行。
 */

import dns from 'node:dns';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { loadEnvLocal } from './load-env-local';
import { SUPABASE_SQL_MIGRATION_FILES } from './supabase-sql-sources';

/** 缓解 Windows / 部分网络下 Supabase 直连被断开（优先走 IPv4） */
dns.setDefaultResultOrder('ipv4first');

function printDbUrlHelp(): void {
  console.error(`
❌ 未找到数据库直连地址（SUPABASE_DB_URL / DATABASE_URL / POSTGRES_URL）。

说明：脚本会读取 .env.local，但只有变量名存在时才会生效。
若 .env.local 里只有 NEXT_PUBLIC_SUPABASE_URL、ANON_KEY，没有下面任一变量，迁移仍会失败——
anon key 不能代替数据库密码连接串。

pnpm db:migrate 必须用 Postgres 连接串（含你在创建项目时设置的「数据库密码」）。

请在本项目根目录的 .env.local 中增加一行（二选一变量名即可）：

  SUPABASE_DB_URL=postgresql://postgres:你的数据库密码@db.xxxxx.supabase.co:5432/postgres

或：

  DATABASE_URL=postgresql://postgres:你的数据库密码@db.xxxxx.supabase.co:5432/postgres

获取方式（Supabase 控制台）：
  Project → Project Settings → Database → Connection string
  选择 URI，把 [YOUR-PASSWORD] 换成你的 Database password（若忘记可点 Reset）。

保存 .env.local 后重新执行：pnpm db:migrate
`);
}

function printConnectionTroubleshooting(err: Error): void {
  if (!/Connection terminated|ECONNRESET|ETIMEDOUT|timeout/i.test(err.message)) {
    return;
  }
  console.error(`
┌─ 连接被断开 / 超时 — 可尝试 ─────────────────────────────────
│ 1) 在 Supabase → Database → Connection string 改用 「Session mode」
│    的 URI（常为 :6543 + pooler 主机名），替换 SUPABASE_DB_URL
│ 2) 确认项目未暂停（免费额度休眠时需唤醒）
│ 3) 核对数据库密码：Settings → Database → 非 Dashboard 登录密码
│ 4) 本脚本已启用 IPv4 优先；仍失败可检查本机防火墙 / VPN
└────────────────────────────────────────────────────────────
`);
}

async function run(): Promise<void> {
  const envFiles = loadEnvLocal();
  if (envFiles.length > 0) {
    console.log('📎 已从以下文件加载环境变量（不含已存在于系统环境里的键）：');
    envFiles.forEach((f) => console.log(`   ${f}`));
    console.log('');
  } else {
    console.warn(
      `⚠️  未找到 .env.local / .env（当前工作目录: ${process.cwd()}）\n`
    );
  }

  const dbUrl =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;
  if (!dbUrl) {
    printDbUrlHelp();
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl.trim(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
    query_timeout: 300000,
    keepAlive: true,
  });

  console.log('🚀 Supabase 结构迁移开始…\n');

  try {
    console.log('📦 启用 pgvector 扩展…');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('   ✅ vector\n');

    for (const relative of SUPABASE_SQL_MIGRATION_FILES) {
      const sqlPath = path.join(process.cwd(), relative);
      if (!fs.existsSync(sqlPath)) {
        console.error(`❌ 找不到文件: ${sqlPath}`);
        process.exit(1);
      }
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`📄 执行: ${relative}`);
      await pool.query(sql);
      console.log(`   ✅ 完成\n`);
    }

    const { rows } = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log(`📊 当前 public 表数量: ${rows.length}`);
    rows.slice(0, 40).forEach((r) => console.log(`   - ${r.table_name}`));
    if (rows.length > 40) console.log(`   … 共 ${rows.length} 张表`);

    console.log('\n🎉 迁移完成。');
  } catch (e: unknown) {
    const err = e as Error;
    console.error('\n❌ 迁移失败:', err.message);
    printConnectionTroubleshooting(err);
    if (
      err.message.includes('already exists') ||
      err.message.includes('duplicate')
    ) {
      console.error(
        '\n提示：若表/策略已存在，可能是第二次执行。可新建空库后重试，或手动在 SQL Editor 中分段执行。'
      );
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
