/**
 * 与 pnpm db:migrate / db:sql-bundle 共用的 SQL 文件顺序
 */
export const SUPABASE_SQL_MIGRATION_FILES = [
  'supabase/migrations/000_pre_vector_cleanup.sql',
  'supabase/init.sql',
  'supabase/migrations/002_add_vector_embeddings.sql',
  'supabase/migrations/003_add_user_system.sql',
  'supabase/migrations/004_recommendation_infrastructure.sql',
  'supabase/migrations/005_add_pgvector_optimization.sql',
  'supabase/migrations/006_ppo_persistence.sql',
] as const;
