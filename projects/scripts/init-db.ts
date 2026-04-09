/**
 * 执行 000_pre_vector_cleanup.sql + supabase/init.sql（核心表）
 * 全量结构（含 002–006 迁移）请使用：pnpm db:migrate 或 pnpm db:sql-bundle
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { loadEnvLocal } from './load-env-local';

loadEnvLocal();

const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error(
    '❌ 请设置 SUPABASE_DB_URL 或 DATABASE_URL（Postgres 直连，见 migrate-supabase.ts 顶部说明）'
  );
  process.exit(1);
}

async function initDatabase() {
  console.log('🚀 开始初始化数据库...\n');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const cleanupPath = path.join(
      __dirname,
      '../supabase/migrations/000_pre_vector_cleanup.sql'
    );
    const sqlPath = path.join(__dirname, '../supabase/init.sql');

    console.log('📄 读取 000_pre_vector_cleanup.sql + init.sql');
    console.log('🔗 连接数据库...\n');

    await pool.query(fs.readFileSync(cleanupPath, 'utf-8'));
    await pool.query(fs.readFileSync(sqlPath, 'utf-8'));

    console.log('✅ SQL 脚本执行成功！\n');

    // 验证表是否创建成功
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('kg_entities', 'kg_relations', 'kg_corrections', 'kg_snapshots', 
                           'analysis_cases', 'case_feedback', 'knowledge_docs', 
                           'user_preferences', 'report_versions')
      ORDER BY table_name;
    `);

    console.log('📊 创建的表:');
    result.rows.forEach((row) => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // 验证示例数据
    const entitiesResult = await pool.query('SELECT name, type FROM kg_entities ORDER BY importance DESC;');
    console.log('\n📝 示例数据:');
    entitiesResult.rows.forEach((row) => {
      console.log(`   - ${row.name} (${row.type})`);
    });

    console.log('\n🎉 数据库初始化完成！');

  } catch (error: any) {
    console.error('❌ 执行失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

initDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
