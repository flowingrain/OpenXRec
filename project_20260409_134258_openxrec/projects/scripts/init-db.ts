/**
 * 执行 init.sql 数据库初始化脚本
 * 使用 pg 库直接连接数据库执行 DDL
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('❌ 错误: 请设置 SUPABASE_DB_URL 环境变量');
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
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '../supabase/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 读取 init.sql 文件成功');
    console.log('🔗 连接数据库...\n');

    // 执行整个 SQL 脚本
    await pool.query(sql);

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
