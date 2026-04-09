-- ============================================================================
-- 自动生成：pnpm db:sql-bundle
-- 在 Supabase SQL Editor 中整段执行即可（走 HTTPS，无需本机 postgres 直连）
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 来源: supabase/migrations/000_pre_vector_cleanup.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 预清理：重复执行 / 从旧 vector(2048) 等升级时，先删向量索引再统一为 vector(2000)
-- 幂等：表或列不存在则跳过；非 vector 类型列跳过；失败仅 NOTICE 不中断整段迁移
-- 依赖：pgvector（vector_dims、subvector）
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

DROP INDEX IF EXISTS public.idx_knowledge_docs_embedding;
DROP INDEX IF EXISTS public.idx_kg_entities_embedding;
DROP INDEX IF EXISTS public.idx_rec_knowledge_embedding;
DROP INDEX IF EXISTS public.idx_rec_items_embedding;
DROP INDEX IF EXISTS public.idx_rec_embeddings_user;
DROP INDEX IF EXISTS public.idx_rec_embeddings_item;
DROP INDEX IF EXISTS public.case_embeddings_embedding_cosine_idx;
DROP INDEX IF EXISTS public.case_embeddings_embedding_l2_idx;
DROP INDEX IF EXISTS public.case_embeddings_embedding_ip_idx;

-- 将已有 vector 列改为 vector(2000)；维数 >2000 时截断前 2000 维
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relname = 'knowledge_docs'
      AND a.attname = 'embedding'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typname = 'vector'
  ) THEN
    ALTER TABLE public.knowledge_docs
      ALTER COLUMN embedding TYPE vector(2000) USING (
        CASE
          WHEN embedding IS NULL THEN NULL::vector(2000)
          WHEN vector_dims(embedding) > 2000 THEN subvector(embedding, 1, 2000)
          ELSE embedding::vector(2000)
        END
      );
    RAISE NOTICE 'knowledge_docs.embedding -> vector(2000)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'knowledge_docs.embedding: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relname = 'kg_entities'
      AND a.attname = 'embedding'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typname = 'vector'
  ) THEN
    ALTER TABLE public.kg_entities
      ALTER COLUMN embedding TYPE vector(2000) USING (
        CASE
          WHEN embedding IS NULL THEN NULL::vector(2000)
          WHEN vector_dims(embedding) > 2000 THEN subvector(embedding, 1, 2000)
          ELSE embedding::vector(2000)
        END
      );
    RAISE NOTICE 'kg_entities.embedding -> vector(2000)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'kg_entities.embedding: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relname = 'recommendation_knowledge'
      AND a.attname = 'embedding'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typname = 'vector'
  ) THEN
    ALTER TABLE public.recommendation_knowledge
      ALTER COLUMN embedding TYPE vector(2000) USING (
        CASE
          WHEN embedding IS NULL THEN NULL::vector(2000)
          WHEN vector_dims(embedding) > 2000 THEN subvector(embedding, 1, 2000)
          ELSE embedding::vector(2000)
        END
      );
    RAISE NOTICE 'recommendation_knowledge.embedding -> vector(2000)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'recommendation_knowledge.embedding: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relname = 'recommendation_items'
      AND a.attname = 'content_embedding'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typname = 'vector'
  ) THEN
    ALTER TABLE public.recommendation_items
      ALTER COLUMN content_embedding TYPE vector(2000) USING (
        CASE
          WHEN content_embedding IS NULL THEN NULL::vector(2000)
          WHEN vector_dims(content_embedding) > 2000 THEN subvector(content_embedding, 1, 2000)
          ELSE content_embedding::vector(2000)
        END
      );
    RAISE NOTICE 'recommendation_items.content_embedding -> vector(2000)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'recommendation_items.content_embedding: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relname = 'recommendation_embeddings'
      AND a.attname = 'embedding'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typname = 'vector'
  ) THEN
    ALTER TABLE public.recommendation_embeddings
      ALTER COLUMN embedding TYPE vector(2000) USING (
        CASE
          WHEN embedding IS NULL THEN NULL::vector(2000)
          WHEN vector_dims(embedding) > 2000 THEN subvector(embedding, 1, 2000)
          ELSE embedding::vector(2000)
        END
      );
    RAISE NOTICE 'recommendation_embeddings.embedding -> vector(2000)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'recommendation_embeddings.embedding: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = 'public'
      AND c.relname = 'case_embeddings'
      AND a.attname = 'embedding'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND t.typname = 'vector'
  ) THEN
    ALTER TABLE public.case_embeddings
      ALTER COLUMN embedding TYPE vector(2000) USING (
        CASE
          WHEN embedding IS NULL THEN NULL::vector(2000)
          WHEN vector_dims(embedding) > 2000 THEN subvector(embedding, 1, 2000)
          ELSE embedding::vector(2000)
        END
      );
    RAISE NOTICE 'case_embeddings.embedding -> vector(2000)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'case_embeddings.embedding: %', SQLERRM;
END $$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 来源: supabase/init.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- OmniSight 宏观态势感知平台 - 数据库初始化脚本
-- 执行方式: 在 Supabase SQL Editor 中运行此脚本
-- ============================================================================

-- pgvector：必须先创建，后续表中的 vector(…) 列才能建成功
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. 知识图谱实体表
-- ============================================================================
CREATE TABLE IF NOT EXISTS kg_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '其他',
  aliases TEXT[] DEFAULT '{}',
  description TEXT,
  importance REAL DEFAULT 0.5,
  properties JSONB DEFAULT '{}',
  source_type TEXT DEFAULT 'llm' CHECK (source_type IN ('llm', 'manual', 'merged')),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_kg_entities_name ON kg_entities(name);
CREATE INDEX IF NOT EXISTS idx_kg_entities_type ON kg_entities(type);
CREATE INDEX IF NOT EXISTS idx_kg_entities_importance ON kg_entities(importance DESC);
CREATE INDEX IF NOT EXISTS idx_kg_entities_source_type ON kg_entities(source_type);

-- ============================================================================
-- 2. 知识图谱关系表
-- ============================================================================
CREATE TABLE IF NOT EXISTS kg_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID REFERENCES kg_entities(id) ON DELETE CASCADE,
  target_entity_id UUID REFERENCES kg_entities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  evidence TEXT,
  properties JSONB DEFAULT '{}',
  source_type TEXT DEFAULT 'llm' CHECK (source_type IN ('llm', 'manual', 'merged')),
  verified BOOLEAN DEFAULT false,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_to DATE,  -- NULL 表示当前有效
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_kg_relations_source ON kg_relations(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_relations_target ON kg_relations(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_relations_type ON kg_relations(type);
CREATE INDEX IF NOT EXISTS idx_kg_relations_valid ON kg_relations(valid_to) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_kg_relations_confidence ON kg_relations(confidence DESC);

-- ============================================================================
-- 3. 修正历史表（审计追溯）
-- ============================================================================
CREATE TABLE IF NOT EXISTS kg_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES kg_entities(id) ON DELETE SET NULL,
  relation_id UUID REFERENCES kg_relations(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('entity_add', 'entity_update', 'entity_delete', 'relation_add', 'relation_update', 'relation_delete')),
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  corrected_by TEXT,
  corrected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_corrections_entity ON kg_corrections(entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_corrections_relation ON kg_corrections(relation_id);
CREATE INDEX IF NOT EXISTS idx_kg_corrections_type ON kg_corrections(change_type);

-- ============================================================================
-- 4. 知识图谱快照表
-- ============================================================================
CREATE TABLE IF NOT EXISTS kg_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  case_id TEXT,
  entities JSONB NOT NULL DEFAULT '[]',
  relations JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  entity_count INTEGER DEFAULT 0,
  relation_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_snapshots_case ON kg_snapshots(case_id);
CREATE INDEX IF NOT EXISTS idx_kg_snapshots_created ON kg_snapshots(created_at DESC);

-- ============================================================================
-- 5. 分析案例存储表
-- ============================================================================
CREATE TABLE IF NOT EXISTS analysis_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  query TEXT,
  final_report TEXT,
  timeline JSONB DEFAULT '[]',
  causal_chain JSONB DEFAULT '[]',
  key_factors JSONB DEFAULT '[]',
  scenarios JSONB DEFAULT '[]',
  event_graph JSONB,
  search_results JSONB DEFAULT '[]',
  conclusion TEXT,
  confidence REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_cases_topic ON analysis_cases(topic);
CREATE INDEX IF NOT EXISTS idx_analysis_cases_created ON analysis_cases(created_at DESC);

-- 案例向量（语义检索；pgvector，与 migrations 中 HNSW 一致）
CREATE TABLE IF NOT EXISTS case_embeddings (
  id VARCHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  case_id UUID NOT NULL REFERENCES analysis_cases(id) ON DELETE CASCADE,
  embedding_type VARCHAR(30) NOT NULL,
  embedding vector(2000) NOT NULL,
  model VARCHAR(100) NOT NULL DEFAULT 'unknown',
  text_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS case_embeddings_case_id_idx ON case_embeddings(case_id);
CREATE INDEX IF NOT EXISTS case_embeddings_model_idx ON case_embeddings(model);
CREATE INDEX IF NOT EXISTS case_embeddings_type_idx ON case_embeddings(embedding_type);

-- ============================================================================
-- 6. 案例反馈表
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES analysis_cases(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  feedback_type TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_feedback_case ON case_feedback(case_id);

-- 用户反馈（聊天面板、进化模块等；与 Drizzle user_feedbacks 一致）
CREATE TABLE IF NOT EXISTS user_feedbacks (
  id VARCHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  case_id UUID NOT NULL REFERENCES analysis_cases(id) ON DELETE CASCADE,
  feedback_type VARCHAR(30) NOT NULL,
  rating INTEGER,
  comment TEXT,
  correction TEXT,
  aspects JSONB,
  user_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_feedbacks_case_id_idx ON user_feedbacks(case_id);
CREATE INDEX IF NOT EXISTS user_feedbacks_created_at_idx ON user_feedbacks(created_at DESC);
CREATE INDEX IF NOT EXISTS user_feedbacks_feedback_type_idx ON user_feedbacks(feedback_type);
CREATE INDEX IF NOT EXISTS user_feedbacks_case_created_idx ON user_feedbacks(case_id, created_at DESC);

-- ============================================================================
-- 7. 知识库文档表
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  embedding vector(2000),  -- pgvector 索引上限 2000 维；需启用 vector 扩展
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_title ON knowledge_docs(title);

-- ============================================================================
-- 8. 用户偏好表
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. 报告版本表
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  storage_key TEXT NOT NULL,
  storage_url TEXT,
  format TEXT DEFAULT 'markdown',
  change_note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(case_id, version)
);

CREATE INDEX IF NOT EXISTS idx_report_versions_case ON report_versions(case_id);
CREATE INDEX IF NOT EXISTS idx_report_versions_created ON report_versions(created_at DESC);

-- ============================================================================
-- 10. 行级安全策略 (RLS)
-- ============================================================================
ALTER TABLE kg_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问（开发环境）- 生产环境应配置更严格的策略
CREATE POLICY "Allow anonymous read" ON kg_entities FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON kg_entities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON kg_relations FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON kg_relations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON kg_corrections FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON kg_corrections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON kg_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON kg_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON analysis_cases FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON analysis_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON case_embeddings FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON case_embeddings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON case_feedback FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON case_feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON user_feedbacks FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON user_feedbacks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON knowledge_docs FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON knowledge_docs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON user_preferences FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON user_preferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read" ON report_versions FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON report_versions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 11. 更新时间触发器
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_kg_entities_updated_at BEFORE UPDATE ON kg_entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kg_relations_updated_at BEFORE UPDATE ON kg_relations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_cases_updated_at BEFORE UPDATE ON analysis_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_docs_updated_at BEFORE UPDATE ON knowledge_docs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. 插入示例数据（可选）
-- ============================================================================
-- 示例实体
INSERT INTO kg_entities (name, type, description, importance, source_type) VALUES
('美联储', '机构', '美国中央银行系统', 0.9, 'manual'),
('美联储主席', '人物', '美联储最高领导职位', 0.85, 'manual'),
('美国', '地点', '美利坚合众国', 0.95, 'manual'),
('联邦基金利率', '指标', '美国银行间拆借利率', 0.8, 'manual')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 完成！
-- ============================================================================
-- 执行此脚本后，您的 Supabase 数据库将包含以下表：
-- 1. kg_entities - 知识图谱实体
-- 2. kg_relations - 知识图谱关系
-- 3. kg_corrections - 修正历史
-- 4. kg_snapshots - 图谱快照
-- 5. analysis_cases - 分析案例
-- 6. case_embeddings - 案例向量（语义检索）
-- 7. case_feedback - 案例反馈
-- 8. user_feedbacks - 用户反馈
-- 9. knowledge_docs - 知识库文档
-- 10. user_preferences - 用户偏好

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 来源: supabase/migrations/002_add_vector_embeddings.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- =====================================================
-- 向量嵌入迁移脚本
-- 为知识库和知识图谱添加向量搜索能力
-- 使用 pgvector 扩展实现语义搜索
-- =====================================================

-- 1. 启用 pgvector 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 为 knowledge_docs 表添加向量列（2000维）
ALTER TABLE knowledge_docs 
ADD COLUMN IF NOT EXISTS embedding vector(2000),
ADD COLUMN IF NOT EXISTS embedding_model varchar(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamp with time zone;

-- 3. 为 kg_entities 表添加向量列（2000维）
ALTER TABLE kg_entities 
ADD COLUMN IF NOT EXISTS embedding vector(2000),
ADD COLUMN IF NOT EXISTS embedding_model varchar(100),
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamp with time zone;

-- 4. 向量索引（2000 维，可用 HNSW）

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_embedding 
ON knowledge_docs 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_kg_entities_embedding 
ON kg_entities 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5. 创建向量搜索函数 - 知识库文档
CREATE OR REPLACE FUNCTION search_knowledge_docs(
  query_embedding vector(2000),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_file_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  file_type text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kd.id,
    kd.title,
    kd.content,
    kd.file_type,
    1 - (kd.embedding <=> query_embedding) AS similarity,
    kd.metadata
  FROM knowledge_docs kd
  WHERE 
    kd.embedding IS NOT NULL
    AND (filter_file_type IS NULL OR kd.file_type = filter_file_type)
    AND 1 - (kd.embedding <=> query_embedding) > match_threshold
  ORDER BY kd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. 创建向量搜索函数 - 知识图谱实体
CREATE OR REPLACE FUNCTION search_kg_entities(
  query_embedding vector(2000),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20,
  filter_entity_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name varchar(255),
  type varchar(50),
  description text,
  importance numeric,
  similarity float,
  properties jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ke.id,
    ke.name,
    ke.type,
    ke.description,
    ke.importance,
    1 - (ke.embedding <=> query_embedding) AS similarity,
    ke.properties
  FROM kg_entities ke
  WHERE 
    ke.embedding IS NOT NULL
    AND (filter_entity_type IS NULL OR ke.type = filter_entity_type)
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. 创建向量搜索函数 - 案例库（使用 case_embeddings 表）
CREATE OR REPLACE FUNCTION search_analysis_cases(
  query_embedding vector(2000),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id varchar(36),
  query text,
  conclusion jsonb,
  confidence numeric,
  analyzed_at timestamp with time zone,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.id,
    ac.query,
    ac.conclusion,
    ac.confidence,
    ac.analyzed_at,
    1 - (ce.embedding::vector <=> query_embedding) AS similarity
  FROM analysis_cases ac
  JOIN case_embeddings ce ON ce.case_id = ac.id
  WHERE 
    ce.embedding_type = 'query'
    AND ce.embedding IS NOT NULL
    AND 1 - (ce.embedding::vector <=> query_embedding) > match_threshold
  ORDER BY ce.embedding::vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8. 创建批量更新嵌入的辅助函数
CREATE OR REPLACE FUNCTION update_knowledge_doc_embedding(
  doc_id uuid,
  new_embedding vector(2000),
  model_name varchar(100) DEFAULT 'doubao-embedding-vision-251215'
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE knowledge_docs
  SET 
    embedding = new_embedding,
    embedding_model = model_name,
    embedding_generated_at = NOW(),
    updated_at = NOW()
  WHERE id = doc_id;
  
  RETURN FOUND;
END;
$$;

-- 9. 创建批量更新实体嵌入的辅助函数
CREATE OR REPLACE FUNCTION update_entity_embedding(
  entity_id uuid,
  new_embedding vector(2000),
  model_name varchar(100) DEFAULT 'doubao-embedding-vision-251215'
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE kg_entities
  SET 
    embedding = new_embedding,
    embedding_model = model_name,
    embedding_generated_at = NOW(),
    updated_at = NOW()
  WHERE id = entity_id;
  
  RETURN FOUND;
END;
$$;

-- 10. 创建索引统计视图
CREATE OR REPLACE VIEW embedding_stats AS
SELECT 
  'knowledge_docs' AS table_name,
  COUNT(*) AS total_records,
  COUNT(embedding) AS embedded_records,
  ROUND(COUNT(embedding)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS embedding_percentage
FROM knowledge_docs
UNION ALL
SELECT 
  'kg_entities' AS table_name,
  COUNT(*) AS total_records,
  COUNT(embedding) AS embedded_records,
  ROUND(COUNT(embedding)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS embedding_percentage
FROM kg_entities;

-- 11. 添加注释
COMMENT ON COLUMN knowledge_docs.embedding IS '文档内容的向量嵌入（2000维）';
COMMENT ON COLUMN knowledge_docs.embedding_model IS '嵌入模型名称';
COMMENT ON COLUMN knowledge_docs.embedding_generated_at IS '嵌入生成时间';
COMMENT ON COLUMN kg_entities.embedding IS '实体名称+描述的向量嵌入（2000维）';
COMMENT ON COLUMN kg_entities.embedding_model IS '嵌入模型名称';
COMMENT ON COLUMN kg_entities.embedding_generated_at IS '嵌入生成时间';

-- 完成
SELECT 'Vector embedding migration completed successfully!' AS status;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 来源: supabase/migrations/003_add_user_system.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 可解释推荐系统 - 用户系统数据库迁移
-- 执行方式: 在 Supabase SQL Editor 中运行此脚本
-- ============================================================================

-- ============================================================================
-- 1. 用户表
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. 用户会话表
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
-- 部分索引的 WHERE 中不可使用 NOW()（非 IMMUTABLE）；改为整列索引即可支持按 expires_at 查询/清理
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- 3. 交互历史表
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'view',
    'click',
    'like',
    'dislike',
    'share',
    'bookmark',
    'comment',
    'rating',
    'search',
    'filter',
    'recommendation_request',
    'recommendation_accept',
    'recommendation_reject'
  )),
  item_id TEXT,
  item_type TEXT DEFAULT 'recommendation' CHECK (item_type IN (
    'recommendation',
    'knowledge',
    'entity',
    'relation',
    'case'
  )),
  item_data JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  page_url TEXT,
  session_id UUID,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_item ON user_interactions(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created ON user_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session ON user_interactions(session_id);

-- ============================================================================
-- 4. 用户画像表
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- 兴趣偏好
  interests JSONB DEFAULT '{}',
  preferred_categories JSONB DEFAULT '[]',
  preferred_entities JSONB DEFAULT '[]',
  preferred_topics JSONB DEFAULT '[]',

  -- 行为模式
  behavior_pattern JSONB DEFAULT '{}',
  activity_pattern JSONB DEFAULT '{}',
  time_pattern JSONB DEFAULT '{}',

  -- 偏好权重
  diversity_weight REAL DEFAULT 0.3 CHECK (diversity_weight >= 0 AND diversity_weight <= 1),
  novelty_weight REAL DEFAULT 0.3 CHECK (novelty_weight >= 0 AND novelty_weight <= 1),
  relevance_weight REAL DEFAULT 0.4 CHECK (relevance_weight >= 0 AND relevance_weight <= 1),

  -- 统计数据
  total_interactions INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_dislikes INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,

  -- 画像版本
  profile_version INTEGER DEFAULT 1,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated ON user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_interactions ON user_profiles(total_interactions DESC);

-- ============================================================================
-- 5. 推荐历史表
-- ============================================================================
CREATE TABLE IF NOT EXISTS recommendation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id TEXT UNIQUE NOT NULL,
  items JSONB NOT NULL,
  context JSONB DEFAULT '{}',
  algorithm TEXT DEFAULT 'hybrid',
  parameters JSONB DEFAULT '{}',
  user_feedback JSONB DEFAULT '{}',
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_recommendation_history_user ON recommendation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_id ON recommendation_history(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_created ON recommendation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_ctr ON recommendation_history(ctr DESC);

-- ============================================================================
-- 6. 用户反馈表
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT,
  item_type TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'rating',
    'like',
    'dislike',
    'comment',
    'report',
    'suggestion'
  )),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  sentiment_score REAL,
  is_anonymous BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_feedback_user ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_item ON user_feedback(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created ON user_feedback(created_at DESC);

-- ============================================================================
-- 7. 启用行级安全策略 (RLS)
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- 用户表策略
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 用户会话策略
CREATE POLICY "Users can read own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON user_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 交互历史策略
CREATE POLICY "Users can read own interactions" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interactions" ON user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户画像策略
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- 推荐历史策略
CREATE POLICY "Users can read own recommendations" ON recommendation_history
  FOR SELECT USING (auth.uid() = user_id);

-- 用户反馈策略
CREATE POLICY "Users can read own feedback" ON user_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own feedback" ON user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 8. 更新时间触发器
-- ============================================================================
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. 用户画像更新触发器
-- ============================================================================
CREATE OR REPLACE FUNCTION update_user_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET
    total_interactions = total_interactions + 1,
    last_interaction_at = NOW(),
    last_updated_at = NOW()
  WHERE user_id = NEW.user_id;

  -- 根据交互类型更新具体统计
  IF NEW.interaction_type = 'view' THEN
    UPDATE user_profiles SET total_views = total_views + 1 WHERE user_id = NEW.user_id;
  ELSIF NEW.interaction_type = 'click' THEN
    UPDATE user_profiles SET total_clicks = total_clicks + 1 WHERE user_id = NEW.user_id;
  ELSIF NEW.interaction_type = 'like' THEN
    UPDATE user_profiles SET total_likes = total_likes + 1 WHERE user_id = NEW.user_id;
  ELSIF NEW.interaction_type = 'dislike' THEN
    UPDATE user_profiles SET total_dislikes = total_dislikes + 1 WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profile_on_interaction
  AFTER INSERT ON user_interactions
  FOR EACH ROW EXECUTE FUNCTION update_user_profile_stats();

-- ============================================================================
-- 10. 清理过期会话
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- ============================================================================
-- 完成！
-- ============================================================================
-- 执行此脚本后，您的数据库将新增以下表：
-- 1. users - 用户表
-- 2. user_sessions - 用户会话表
-- 3. user_interactions - 交互历史表
-- 4. user_profiles - 用户画像表
-- 5. recommendation_history - 推荐历史表
-- 6. user_feedback - 用户反馈表
--
-- 功能特性：
-- - 完整的用户注册/登录系统
-- - 会话管理（支持过期清理）
-- - 详细的交互历史记录
-- - 自动更新的用户画像
-- - 推荐历史追踪
-- - 用户反馈收集
-- - 行级安全策略（RLS）

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 来源: supabase/migrations/004_recommendation_infrastructure.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- 可解释推荐系统 - 独立数据库基础设施
-- 包含：知识库、向量库、案例库、对象库、场景库、算法配置
-- 执行方式: 在 Supabase SQL Editor 中运行此脚本
-- ============================================================================

-- ============================================================================
-- 1. 推荐知识库
-- 存储推荐系统相关的知识文档，支持语义搜索
-- ============================================================================
CREATE TABLE IF NOT EXISTS recommendation_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  knowledge_type TEXT NOT NULL DEFAULT 'general' CHECK (knowledge_type IN (
    'general',          -- 通用知识
    'strategy',         -- 推荐策略
    'domain',           -- 领域知识
    'rule',             -- 规则集
    'explanation',      -- 解释性文档
    'best_practice'     -- 最佳实践
  )),
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'llm', 'import')),
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,

  -- 元数据
  tags TEXT[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  author TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecated')),

  -- 统计信息
  usage_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- 向量嵌入（语义搜索）
  embedding vector(2000),
  embedding_model TEXT,
  embedding_generated_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 知识库索引
CREATE INDEX IF NOT EXISTS idx_rec_knowledge_title ON recommendation_knowledge(title);
CREATE INDEX IF NOT EXISTS idx_rec_knowledge_type ON recommendation_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_rec_knowledge_tags ON recommendation_knowledge USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_rec_knowledge_status ON recommendation_knowledge(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rec_knowledge_embedding ON recommendation_knowledge USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 2. 推荐对象库
-- 存储可推荐的各种对象（知识、实体、报告等）
-- ============================================================================
CREATE TABLE IF NOT EXISTS recommendation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT UNIQUE NOT NULL,  -- 外部对象唯一标识

  -- 对象类型
  item_type TEXT NOT NULL CHECK (item_type IN (
    'knowledge',        -- 知识文档
    'entity',           -- 实体
    'report',           -- 报告
    'case',             -- 案例
    'scenario',         -- 场景
    'article',          -- 文章
    'dataset'           -- 数据集
  )),

  -- 基础信息
  title TEXT NOT NULL,
  description TEXT,
  content_preview TEXT,
  thumbnail_url TEXT,

  -- 分类和标签
  category TEXT,
  subcategory TEXT,
  tags TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',

  -- 质量指标
  quality_score REAL DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
  popularity_score REAL DEFAULT 0,
  relevance_score REAL DEFAULT 0.5,
  freshness_score REAL DEFAULT 0.5,

  -- 统计信息
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  bookmark_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,

  -- 交互指标
  avg_rating REAL,
  rating_count INTEGER DEFAULT 0,

  -- 状态管理
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived', 'deleted')),
  featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- 向量嵌入（内容相似度）
  content_embedding vector(2000),
  embedding_model TEXT,
  embedding_updated_at TIMESTAMPTZ,

  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 对象库索引
CREATE INDEX IF NOT EXISTS idx_rec_items_item_id ON recommendation_items(item_id);
CREATE INDEX IF NOT EXISTS idx_rec_items_type ON recommendation_items(item_type);
CREATE INDEX IF NOT EXISTS idx_rec_items_category ON recommendation_items(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_rec_items_tags ON recommendation_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_rec_items_status ON recommendation_items(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rec_items_quality ON recommendation_items(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_rec_items_popularity ON recommendation_items(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_rec_items_featured ON recommendation_items(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_rec_items_embedding ON recommendation_items USING hnsw (content_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 3. 推荐向量库
-- 存储各类向量化数据，支持多种推荐算法
-- ============================================================================
CREATE TABLE IF NOT EXISTS recommendation_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embedding_type TEXT NOT NULL CHECK (embedding_type IN (
    'user',              -- 用户向量
    'item',              -- 物品向量
    'item_content',      -- 物品内容向量
    'user_preference',   -- 用户偏好向量
    'user_behavior',     -- 用户行为向量
    'context',           -- 上下文向量
    'interaction'        -- 交互向量
  )),
  target_id UUID NOT NULL,  -- 关联的对象ID（用户ID、物品ID等）

  -- 向量数据
  embedding vector(2000) NOT NULL,

  -- 向量模型信息
  model_name TEXT NOT NULL,
  model_version TEXT,
  embedding_dim INTEGER DEFAULT 2000,

  -- 向量更新信息
  update_frequency INTEGER DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  update_reason TEXT,

  -- 统计信息
  usage_count INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 向量库索引
CREATE INDEX IF NOT EXISTS idx_rec_embeddings_type ON recommendation_embeddings(embedding_type);
CREATE INDEX IF NOT EXISTS idx_rec_embeddings_target ON recommendation_embeddings(target_id, embedding_type);
CREATE INDEX IF NOT EXISTS idx_rec_embeddings_model ON recommendation_embeddings(model_name);
CREATE INDEX IF NOT EXISTS idx_rec_embeddings_updated ON recommendation_embeddings(last_updated_at DESC);

-- 为不同类型创建专门的向量搜索索引
CREATE INDEX IF NOT EXISTS idx_rec_embeddings_user ON recommendation_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64) WHERE embedding_type = 'user';
CREATE INDEX IF NOT EXISTS idx_rec_embeddings_item ON recommendation_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64) WHERE embedding_type IN ('item', 'item_content');

-- ============================================================================
-- 4. 推荐案例库
-- 存储推荐案例和场景，支持效果评估和优化
-- ============================================================================
CREATE TABLE IF NOT EXISTS recommendation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT UNIQUE NOT NULL,

  -- 案例基本信息
  case_name TEXT NOT NULL,
  case_type TEXT NOT NULL DEFAULT 'standard' CHECK (case_type IN (
    'standard',        -- 标准案例
    'experiment',      -- 实验案例
    'ab_test',         -- A/B测试
    'optimization',    -- 优化案例
    'failure'          -- 失败案例
  )),

  -- 推荐场景
  scenario_id TEXT,
  scenario_name TEXT,
  scenario_context JSONB DEFAULT '{}',

  -- 推荐输入
  user_id UUID,
  user_context JSONB DEFAULT '{}',
  algorithm TEXT,
  algorithm_params JSONB DEFAULT '{}',

  -- 推荐输出
  recommended_items JSONB NOT NULL DEFAULT '[]',
  recommendation_explanations JSONB DEFAULT '[]',
  diversity_score REAL,
  novelty_score REAL,
  relevance_score REAL,

  -- 用户反馈
  user_feedback JSONB DEFAULT '{}',
  user_rating REAL CHECK (user_rating >= 1 AND user_rating <= 5),
  user_comments TEXT,

  -- 效果指标
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr REAL,  -- 点击率
  conversion_rate REAL,
  dwell_time_ms INTEGER,  -- 停留时间

  -- 业务指标
  business_value REAL,
  roi REAL,  -- 投资回报率

  -- 案例状态
  status TEXT DEFAULT 'completed' CHECK (status IN ('draft', 'running', 'completed', 'failed')),
  outcome TEXT CHECK (outcome IN ('success', 'partial', 'failure', 'unknown')),

  -- 时间信息
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 分析和洞察
  insights JSONB DEFAULT '{}',
  lessons_learned TEXT,
  recommendations TEXT,

  -- 归档和复用
  reusable BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 案例库索引
CREATE INDEX IF NOT EXISTS idx_rec_cases_case_id ON recommendation_cases(case_id);
CREATE INDEX IF NOT EXISTS idx_rec_cases_type ON recommendation_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_rec_cases_scenario ON recommendation_cases(scenario_id);
CREATE INDEX IF NOT EXISTS idx_rec_cases_user ON recommendation_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_rec_cases_algorithm ON recommendation_cases(algorithm);
CREATE INDEX IF NOT EXISTS idx_rec_cases_status ON recommendation_cases(status);
CREATE INDEX IF NOT EXISTS idx_rec_cases_outcome ON recommendation_cases(outcome);
CREATE INDEX IF NOT EXISTS idx_rec_cases_ctr ON recommendation_cases(ctr DESC);
CREATE INDEX IF NOT EXISTS idx_rec_cases_executed ON recommendation_cases(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_cases_reusable ON recommendation_cases(reusable) WHERE reusable = true;

-- ============================================================================
-- 5. 推荐场景库
-- 定义和管理推荐场景
-- ============================================================================
CREATE TABLE IF NOT EXISTS recommendation_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT UNIQUE NOT NULL,

  -- 场景基本信息
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority INTEGER DEFAULT 0,

  -- 场景配置
  context JSONB DEFAULT '{}',
  constraints JSONB DEFAULT '{}',
  filters JSONB DEFAULT '{}',

  -- 推荐策略
  default_algorithm TEXT,
  available_algorithms TEXT[] DEFAULT '{}',
  fallback_algorithm TEXT,

  -- 多样性和新颖性配置
  min_diversity REAL DEFAULT 0.3 CHECK (min_diversity >= 0 AND min_diversity <= 1),
  min_novelty REAL DEFAULT 0.3 CHECK (min_novelty >= 0 AND min_novelty <= 1),
  max_repeat_ratio REAL DEFAULT 0.2,

  -- 时效性配置
  max_item_age_days INTEGER,
  refresh_interval_hours INTEGER DEFAULT 24,

  -- 目标指标
  target_ctr REAL,
  target_conversion_rate REAL,
  target_dwell_time_ms INTEGER,

  -- 状态管理
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled', 'archived')),

  -- 统计信息
  total_recommendations INTEGER DEFAULT 0,
  avg_ctr REAL,
  avg_conversion_rate REAL,

  -- A/B测试
  is_ab_test BOOLEAN DEFAULT false,
  test_group TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 场景库索引
CREATE INDEX IF NOT EXISTS idx_rec_scenarios_scenario_id ON recommendation_scenarios(scenario_id);
CREATE INDEX IF NOT EXISTS idx_rec_scenarios_category ON recommendation_scenarios(category);
CREATE INDEX IF NOT EXISTS idx_rec_scenarios_status ON recommendation_scenarios(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rec_scenarios_priority ON recommendation_scenarios(priority DESC);
CREATE INDEX IF NOT EXISTS idx_rec_scenarios_ab_test ON recommendation_scenarios(is_ab_test) WHERE is_ab_test = true;

-- ============================================================================
-- 6. 推荐算法配置
-- 存储和管理推荐算法的配置和参数
-- ============================================================================
CREATE TABLE IF NOT EXISTS recommendation_algorithms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  algorithm_id TEXT UNIQUE NOT NULL,

  -- 算法基本信息
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'collaborative_filtering',  -- 协同过滤
    'content_based',            -- 内容推荐
    'hybrid',                   -- 混合推荐
    'knowledge_graph',          -- 知识图谱推荐
    'deep_learning',            -- 深度学习
    'rule_based',               -- 规则推荐
    'llm_enhanced',             -- LLM增强推荐
    'custom'                    -- 自定义算法
  )),

  -- 算法描述
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  author TEXT,

  -- 算法参数
  default_params JSONB DEFAULT '{}',
  required_params TEXT[] DEFAULT '{}',
  optional_params TEXT[] DEFAULT '{}',

  -- 性能配置
  enabled BOOLEAN DEFAULT true,
  max_concurrent_requests INTEGER DEFAULT 100,
  timeout_ms INTEGER DEFAULT 5000,
  cache_ttl_seconds INTEGER DEFAULT 3600,

  -- 质量配置
  min_quality_score REAL DEFAULT 0.5,
  diversity_factor REAL DEFAULT 0.3,
  novelty_factor REAL DEFAULT 0.3,

  -- 依赖关系
  depends_on TEXT[] DEFAULT '{}',  -- 依赖的其他算法
  data_sources TEXT[] DEFAULT '{}', -- 需要的数据源

  -- A/B测试配置
  is_in_ab_test BOOLEAN DEFAULT false,
  test_group TEXT,
  test_percentage REAL DEFAULT 0,

  -- 状态管理
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'testing', 'deprecated', 'disabled')),

  -- 统计信息
  total_calls INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  avg_response_time_ms REAL,

  -- 效果指标
  avg_ctr REAL,
  avg_conversion_rate REAL,
  last_performance_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 算法配置索引
CREATE INDEX IF NOT EXISTS idx_rec_algorithms_algorithm_id ON recommendation_algorithms(algorithm_id);
CREATE INDEX IF NOT EXISTS idx_rec_algorithms_type ON recommendation_algorithms(type);
CREATE INDEX IF NOT EXISTS idx_rec_algorithms_status ON recommendation_algorithms(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rec_algorithms_ab_test ON recommendation_algorithms(is_in_ab_test) WHERE is_in_ab_test = true;

-- ============================================================================
-- 7. 启用 pgvector 扩展
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 8. 创建向量搜索函数
-- ============================================================================

-- 8.1 知识库语义搜索
CREATE OR REPLACE FUNCTION search_recommendation_knowledge(
  query_embedding vector(2000),
  match_threshold REAL DEFAULT 0.5,
  match_count INTEGER DEFAULT 10,
  filter_knowledge_type TEXT DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  knowledge_type TEXT,
  similarity REAL,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rk.id,
    rk.title,
    rk.content,
    rk.knowledge_type,
    1 - (rk.embedding <=> query_embedding) AS similarity,
    rk.metadata
  FROM recommendation_knowledge rk
  WHERE
    rk.embedding IS NOT NULL
    AND rk.status = 'active'
    AND (filter_knowledge_type IS NULL OR rk.knowledge_type = filter_knowledge_type)
    AND (filter_tags IS NULL OR rk.tags && filter_tags)
    AND 1 - (rk.embedding <=> query_embedding) > match_threshold
  ORDER BY rk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8.2 推荐对象相似度搜索
CREATE OR REPLACE FUNCTION search_similar_items(
  query_embedding vector(2000),
  match_threshold REAL DEFAULT 0.6,
  match_count INTEGER DEFAULT 20,
  filter_item_type TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  min_quality_score REAL DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  item_id TEXT,
  title TEXT,
  item_type TEXT,
  category TEXT,
  quality_score REAL,
  popularity_score REAL,
  similarity REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ri.id,
    ri.item_id,
    ri.title,
    ri.item_type,
    ri.category,
    ri.quality_score,
    ri.popularity_score,
    1 - (ri.content_embedding <=> query_embedding) AS similarity
  FROM recommendation_items ri
  WHERE
    ri.content_embedding IS NOT NULL
    AND ri.status = 'active'
    AND (filter_item_type IS NULL OR ri.item_type = filter_item_type)
    AND (filter_category IS NULL OR ri.category = filter_category)
    AND ri.quality_score >= min_quality_score
    AND 1 - (ri.content_embedding <=> query_embedding) > match_threshold
  ORDER BY ri.content_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8.3 用户相似度搜索（基于用户向量）
CREATE OR REPLACE FUNCTION find_similar_users(
  target_user_embedding vector(2000),
  match_threshold REAL DEFAULT 0.6,
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  similarity REAL,
  update_frequency INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.target_id AS user_id,
    1 - (re.embedding <=> target_user_embedding) AS similarity,
    re.update_frequency
  FROM recommendation_embeddings re
  WHERE
    re.embedding_type = 'user'
    AND re.embedding IS NOT NULL
    AND 1 - (re.embedding <=> target_user_embedding) > match_threshold
  ORDER BY re.embedding <=> target_user_embedding
  LIMIT match_count;
END;
$$;

-- 8.4 物品相似度搜索（基于物品向量）
CREATE OR REPLACE FUNCTION find_similar_items_by_embedding(
  target_item_embedding vector(2000),
  match_threshold REAL DEFAULT 0.6,
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  item_id UUID,
  similarity REAL,
  embedding_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.target_id AS item_id,
    1 - (re.embedding <=> target_item_embedding) AS similarity,
    re.embedding_type
  FROM recommendation_embeddings re
  WHERE
    re.embedding_type IN ('item', 'item_content')
    AND re.embedding IS NOT NULL
    AND 1 - (re.embedding <=> target_item_embedding) > match_threshold
  ORDER BY re.embedding <=> target_item_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- 9. 创建辅助函数
-- ============================================================================

-- 9.1 更新知识库嵌入
CREATE OR REPLACE FUNCTION update_recommendation_knowledge_embedding(
  knowledge_id UUID,
  new_embedding vector(2000),
  model_name TEXT DEFAULT 'doubao-embedding-vision-251215'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE recommendation_knowledge
  SET
    embedding = new_embedding,
    embedding_model = model_name,
    embedding_generated_at = NOW(),
    updated_at = NOW()
  WHERE id = knowledge_id;

  RETURN FOUND;
END;
$$;

-- 9.2 更新推荐对象嵌入
CREATE OR REPLACE FUNCTION update_recommendation_item_embedding(
  item_id UUID,
  new_embedding vector(2000),
  model_name TEXT DEFAULT 'doubao-embedding-vision-251215'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE recommendation_items
  SET
    content_embedding = new_embedding,
    embedding_model = model_name,
    embedding_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = item_id;

  RETURN FOUND;
END;
$$;

-- 9.3 批量更新用户向量
CREATE OR REPLACE FUNCTION upsert_user_embedding(
  user_id UUID,
  user_embedding vector(2000),
  model_name TEXT DEFAULT 'doubao-embedding-vision-251215',
  update_reason TEXT DEFAULT 'behavior_update'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- 检查是否已存在
  SELECT COUNT(*) INTO existing_count
  FROM recommendation_embeddings
  WHERE embedding_type = 'user' AND target_id = user_id;

  IF existing_count > 0 THEN
    -- 更新现有记录
    UPDATE recommendation_embeddings
    SET
      embedding = user_embedding,
      model_name = model_name,
      update_frequency = update_frequency + 1,
      last_updated_at = NOW(),
      update_reason = update_reason
    WHERE embedding_type = 'user' AND target_id = user_id;
  ELSE
    -- 插入新记录
    INSERT INTO recommendation_embeddings (
      embedding_type,
      target_id,
      embedding,
      model_name,
      update_reason
    ) VALUES (
      'user',
      user_id,
      user_embedding,
      model_name,
      update_reason
    );
  END IF;

  RETURN TRUE;
END;
$$;

-- 9.4 记录推荐案例
CREATE OR REPLACE FUNCTION log_recommendation_case(
  p_case_id TEXT,
  p_user_id UUID,
  p_scenario_id TEXT,
  p_algorithm TEXT,
  p_algorithm_params JSONB,
  p_recommended_items JSONB,
  p_explanations JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_case_id UUID;
BEGIN
  INSERT INTO recommendation_cases (
    case_id,
    user_id,
    scenario_id,
    scenario_name,
    algorithm,
    algorithm_params,
    recommended_items,
    recommendation_explanations,
    executed_at,
    status
  ) VALUES (
    p_case_id,
    p_user_id,
    p_scenario_id,
    COALESCE((SELECT name FROM recommendation_scenarios WHERE scenario_id = p_scenario_id), p_scenario_id),
    p_algorithm,
    p_algorithm_params,
    p_recommended_items,
    p_explanations,
    NOW(),
    'completed'
  ) RETURNING id INTO new_case_id;

  -- 更新场景统计
  UPDATE recommendation_scenarios
  SET
    total_recommendations = total_recommendations + 1,
    updated_at = NOW()
  WHERE scenario_id = p_scenario_id;

  -- 更新算法统计
  UPDATE recommendation_algorithms
  SET
    total_calls = total_calls + 1,
    updated_at = NOW()
  WHERE algorithm_id = p_algorithm;

  RETURN new_case_id;
END;
$$;

-- ============================================================================
-- 10. 创建统计视图
-- ============================================================================

-- 10.1 向量嵌入统计
CREATE OR REPLACE VIEW recommendation_embedding_stats AS
SELECT
  embedding_type,
  COUNT(*) AS total_records,
  COUNT(embedding) AS embedded_records,
  ROUND(COUNT(embedding)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS embedding_percentage,
  AVG(update_frequency) AS avg_update_frequency
FROM recommendation_embeddings
GROUP BY embedding_type;

-- 10.2 推荐对象统计
CREATE OR REPLACE VIEW recommendation_item_stats AS
SELECT
  item_type,
  category,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE status = 'active') AS active_items,
  AVG(quality_score) AS avg_quality_score,
  AVG(popularity_score) AS avg_popularity_score,
  SUM(view_count) AS total_views,
  SUM(click_count) AS total_clicks,
  ROUND(SUM(click_count)::numeric / NULLIF(SUM(view_count), 0) * 100, 2) AS overall_ctr
FROM recommendation_items
GROUP BY item_type, category
ORDER BY total_items DESC;

-- 10.3 推荐算法性能
CREATE OR REPLACE VIEW recommendation_algorithm_performance AS
SELECT
  algorithm_id,
  name,
  type,
  total_calls,
  total_errors,
  ROUND(total_errors::numeric / NULLIF(total_calls, 0) * 100, 2) AS error_rate,
  avg_response_time_ms,
  avg_ctr,
  avg_conversion_rate,
  status
FROM recommendation_algorithms
WHERE total_calls > 0
ORDER BY total_calls DESC;

-- 10.4 场景效果统计
CREATE OR REPLACE VIEW recommendation_scenario_performance AS
SELECT
  rs.scenario_id,
  rs.name,
  rs.category,
  rs.total_recommendations,
  rs.avg_ctr,
  rs.avg_conversion_rate,
  COUNT(rc.id) FILTER (WHERE rc.outcome = 'success') AS success_cases,
  COUNT(rc.id) FILTER (WHERE rc.outcome = 'failure') AS failure_cases,
  ROUND(AVG(rc.ctr)::numeric, 4) AS actual_avg_ctr,
  ROUND(AVG(rc.conversion_rate)::numeric, 4) AS actual_avg_conversion_rate
FROM recommendation_scenarios rs
LEFT JOIN recommendation_cases rc ON rc.scenario_id = rs.scenario_id
WHERE rs.status = 'active'
GROUP BY rs.scenario_id, rs.name, rs.category, rs.total_recommendations, rs.avg_ctr, rs.avg_conversion_rate
ORDER BY rs.total_recommendations DESC;

-- ============================================================================
-- 11. 启用行级安全策略 (RLS)
-- ============================================================================

-- 知识库
ALTER TABLE recommendation_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access" ON recommendation_knowledge FOR SELECT USING (true);
CREATE POLICY "Allow write access" ON recommendation_knowledge FOR ALL USING (true) WITH CHECK (true);

-- 对象库
ALTER TABLE recommendation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access" ON recommendation_items FOR SELECT USING (true);
CREATE POLICY "Allow write access" ON recommendation_items FOR ALL USING (true) WITH CHECK (true);

-- 向量库
ALTER TABLE recommendation_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access" ON recommendation_embeddings FOR SELECT USING (true);
CREATE POLICY "Allow write access" ON recommendation_embeddings FOR ALL USING (true) WITH CHECK (true);

-- 案例库
ALTER TABLE recommendation_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access" ON recommendation_cases FOR SELECT USING (true);
CREATE POLICY "Allow write access" ON recommendation_cases FOR ALL USING (true) WITH CHECK (true);

-- 场景库
ALTER TABLE recommendation_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access" ON recommendation_scenarios FOR SELECT USING (true);
CREATE POLICY "Allow write access" ON recommendation_scenarios FOR ALL USING (true) WITH CHECK (true);

-- 算法配置
ALTER TABLE recommendation_algorithms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access" ON recommendation_algorithms FOR SELECT USING (true);
CREATE POLICY "Allow write access" ON recommendation_algorithms FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 12. 创建更新时间触发器
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rec_knowledge_updated_at BEFORE UPDATE ON recommendation_knowledge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rec_items_updated_at BEFORE UPDATE ON recommendation_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rec_cases_updated_at BEFORE UPDATE ON recommendation_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rec_scenarios_updated_at BEFORE UPDATE ON recommendation_scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rec_algorithms_updated_at BEFORE UPDATE ON recommendation_algorithms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13. 插入初始化数据
-- ============================================================================

-- 插入示例推荐场景
INSERT INTO recommendation_scenarios (scenario_id, name, description, category, priority, default_algorithm) VALUES
('homepage_discover', '首页发现', '为用户推荐可能感兴趣的内容', 'discovery', 10, 'hybrid'),
('related_knowledge', '相关知识推荐', '根据当前内容推荐相关知识', 'contextual', 8, 'content_based'),
('trending_items', '热门趋势', '推荐当前热门的内容', 'trending', 6, 'rule_based'),
('personalized_feed', '个性化推荐', '基于用户画像的个性化推荐', 'personalization', 9, 'collaborative_filtering')
ON CONFLICT (scenario_id) DO NOTHING;

-- 插入示例推荐算法
INSERT INTO recommendation_algorithms (algorithm_id, name, type, description, default_params) VALUES
('cf_user_based', '基于用户的协同过滤', 'collaborative_filtering', '通过找到相似用户进行推荐',
 '{"top_k": 50, "similarity_threshold": 0.6}'::jsonb),
('cf_item_based', '基于物品的协同过滤', 'collaborative_filtering', '通过相似物品进行推荐',
 '{"top_k": 50, "similarity_threshold": 0.6}'::jsonb),
('cb_tfidf', '基于TF-IDF的内容推荐', 'content_based', '使用TF-IDF计算内容相似度',
 '{"min_similarity": 0.3, "max_results": 20}'::jsonb),
('cb_embedding', '基于向量的内容推荐', 'content_based', '使用向量嵌入计算内容相似度',
 '{"embedding_dim": 2000, "similarity_threshold": 0.6}'::jsonb),
('hybrid_weighted', '加权混合推荐', 'hybrid', '结合多种算法的加权推荐',
 '{"cf_weight": 0.4, "cb_weight": 0.4, "kg_weight": 0.2}'::jsonb),
('kg_path_based', '基于知识图谱路径推荐', 'knowledge_graph', '通过知识图谱路径关系推荐',
 '{"max_path_length": 3, "min_confidence": 0.5}'::jsonb),
('llm_enhanced', 'LLM增强推荐', 'llm_enhanced', '使用大语言模型增强推荐结果',
 '{"model": "doubao-pro", "temperature": 0.7}'::jsonb)
ON CONFLICT (algorithm_id) DO NOTHING;

-- 插入示例知识文档
INSERT INTO recommendation_knowledge (title, content, knowledge_type, tags, status) VALUES
('推荐系统基础知识', '推荐系统是信息过滤系统的一种，旨在预测用户对物品的偏好...', 'general', ARRAY['推荐系统', '基础'], 'active'),
('协同过滤算法原理', '协同过滤是一种基于用户行为数据进行推荐的算法...', 'strategy', ARRAY['协同过滤', '算法'], 'active'),
('多样性推荐策略', '多样性是衡量推荐系统质量的重要指标...', 'strategy', ARRAY['多样性', '策略'], 'active'),
('新颖性推荐', '新颖性指推荐用户未曾接触过的新物品...', 'explanation', ARRAY['新颖性', '探索'], 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 完成！
-- ============================================================================
SELECT '推荐系统独立数据库基础设施创建完成！' AS status,
       '创建了 6 张核心表 + 向量搜索功能' AS summary;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 来源: supabase/migrations/005_add_pgvector_optimization.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- 添加 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 为 case_embeddings 表添加向量索引
-- 如果 embedding 字段已经存在，我们添加索引
-- 注意：需要确保 embedding 字段是 vector 类型

-- 首先检查 embedding 字段类型
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'vector'
    ) THEN
        RAISE NOTICE 'vector type does not exist, skipping index creation';
    ELSIF to_regclass('public.case_embeddings') IS NULL THEN
        RAISE NOTICE 'case_embeddings table missing, skipping case_embeddings vector indexes (run init.sql first)';
    ELSE
        -- case_embeddings.embedding 需为 vector(≤2000)；与全库 2000 维一致
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'case_embeddings_embedding_cosine_idx'
        ) THEN
            CREATE INDEX case_embeddings_embedding_cosine_idx 
            ON case_embeddings 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'case_embeddings_embedding_l2_idx'
        ) THEN
            CREATE INDEX case_embeddings_embedding_l2_idx 
            ON case_embeddings 
            USING hnsw (embedding vector_l2_ops)
            WITH (m = 16, ef_construction = 64);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'case_embeddings_embedding_ip_idx'
        ) THEN
            CREATE INDEX case_embeddings_embedding_ip_idx 
            ON case_embeddings 
            USING hnsw (embedding vector_ip_ops)
            WITH (m = 16, ef_construction = 64);
        END IF;
    END IF;
END $$;

-- pg_trgm 必须在 gin_trgm_ops 索引之前启用
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 为 knowledge_docs 表添加全文搜索索引（优化文本搜索）
CREATE INDEX IF NOT EXISTS knowledge_docs_title_trgm_idx 
ON knowledge_docs 
USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS knowledge_docs_content_trgm_idx 
ON knowledge_docs 
USING gin (content gin_trgm_ops);

-- 为 kg_entities 表添加名称搜索索引
CREATE INDEX IF NOT EXISTS kg_entities_name_trgm_idx 
ON kg_entities 
USING gin (name gin_trgm_ops);

-- 为 kg_relations 表添加复合索引
CREATE INDEX IF NOT EXISTS kg_relations_type_confidence_idx 
ON kg_relations (type, confidence DESC);

-- user_feedbacks 表及索引见 init.sql（原 userId/createdAt 列名错误，已移除）

-- 为 user_preferences 表添加 JSONB 索引
CREATE INDEX IF NOT EXISTS user_preferences_preferences_gin_idx 
ON user_preferences 
USING gin (preferences);

-- 创建数据导出/导入相关的视图
CREATE OR REPLACE VIEW v_data_export_summary AS
SELECT 
    'knowledge_docs' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_count
FROM knowledge_docs
UNION ALL
SELECT 
    'case_embeddings' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_count
FROM case_embeddings
UNION ALL
SELECT 
    'kg_entities' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_count
FROM kg_entities
UNION ALL
SELECT 
    'kg_relations' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_count
FROM kg_relations
UNION ALL
SELECT 
    'user_feedbacks' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_count
FROM user_feedbacks
UNION ALL
SELECT 
    'user_preferences' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN updated_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_count
FROM user_preferences;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 来源: supabase/migrations/006_ppo_persistence.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- ============================================================================
-- PPO 超参数持久化与版本管理
-- 包含：超参数版本、训练历史、知识库、调整规则
-- 执行方式: 在 Supabase SQL Editor 中运行此脚本
-- ============================================================================

-- ============================================================================
-- 1. PPO 超参数版本表
-- 存储超参数配置的历史版本，支持回滚和审核
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_hyperparam_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  
  -- 超参数配置
  config JSONB NOT NULL,
  
  -- 性能指标
  performance JSONB,
  
  -- 状态
  is_active BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  
  -- 来源
  source VARCHAR(20) DEFAULT 'auto' CHECK (source IN ('auto', 'manual', 'rollback')),
  
  -- 元数据
  parent_version INTEGER,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- 审计信息
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：每个版本号只能有一条记录
  UNIQUE(version)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_versions_version ON ppo_hyperparam_versions(version);
CREATE INDEX IF NOT EXISTS idx_ppo_versions_active ON ppo_hyperparam_versions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ppo_versions_verified ON ppo_hyperparam_versions(is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_ppo_versions_source ON ppo_hyperparam_versions(source);
CREATE INDEX IF NOT EXISTS idx_ppo_versions_tags ON ppo_hyperparam_versions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ppo_versions_created_at ON ppo_hyperparam_versions(created_at DESC);

-- 注释
COMMENT ON TABLE ppo_hyperparam_versions IS 'PPO超参数版本管理表';
COMMENT ON COLUMN ppo_hyperparam_versions.config IS '超参数配置: {learningRate, clipEpsilon, entropyCoef, gaeLambda}';
COMMENT ON COLUMN ppo_hyperparam_versions.performance IS '性能指标: {avgReward, avgLoss, avgKl, trend, sampleCount}';
COMMENT ON COLUMN ppo_hyperparam_versions.is_active IS '是否为当前激活版本';
COMMENT ON COLUMN ppo_hyperparam_versions.is_verified IS '是否通过专家审核';

-- ============================================================================
-- 2. PPO 训练历史表
-- 记录每次训练的超参数快照和性能指标
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_training_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  
  -- 超参数快照
  hyperparams JSONB NOT NULL,
  
  -- 训练指标
  metrics JSONB NOT NULL,
  
  -- 调整信息
  adaptation JSONB,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_training_session ON ppo_training_history(session_id);
CREATE INDEX IF NOT EXISTS idx_ppo_training_epoch ON ppo_training_history(epoch);
CREATE INDEX IF NOT EXISTS idx_ppo_training_created_at ON ppo_training_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppo_training_session_epoch ON ppo_training_history(session_id, epoch);

-- 注释
COMMENT ON TABLE ppo_training_history IS 'PPO训练历史记录表';
COMMENT ON COLUMN ppo_training_history.hyperparams IS '训练时的超参数快照';
COMMENT ON COLUMN ppo_training_history.metrics IS '训练指标: {policyLoss, valueLoss, entropy, klDivergence, clipFraction, avgReward, explainedVariance}';
COMMENT ON COLUMN ppo_training_history.adaptation IS '调整信息: {adapted, reason, recommendations}';

-- ============================================================================
-- 3. PPO 超参数知识库
-- 存储从训练历史中提取的知识和规则
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_hyperparam_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 知识类型
  knowledge_type VARCHAR(20) NOT NULL CHECK (knowledge_type IN (
    'correlation',      -- 相关性知识
    'pattern',          -- 模式知识
    'constraint',       -- 约束知识
    'best_practice'     -- 最佳实践
  )),
  
  -- 参数名
  param_name VARCHAR(50) NOT NULL,
  
  -- 知识内容
  knowledge JSONB NOT NULL,
  
  -- 置信度
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  
  -- 样本统计
  sample_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  
  -- 来源
  source VARCHAR(20) DEFAULT 'learned' CHECK (source IN ('learned', 'expert', 'literature')),
  
  -- 时间戳
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：同一参数的同一类型知识只能有一条
  UNIQUE(knowledge_type, param_name)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_knowledge_type ON ppo_hyperparam_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_ppo_knowledge_param ON ppo_hyperparam_knowledge(param_name);
CREATE INDEX IF NOT EXISTS idx_ppo_knowledge_confidence ON ppo_hyperparam_knowledge(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_ppo_knowledge_source ON ppo_hyperparam_knowledge(source);

-- 注释
COMMENT ON TABLE ppo_hyperparam_knowledge IS 'PPO超参数知识库，存储从训练历史中提取的知识';

-- ============================================================================
-- 4. PPO 调整规则表
-- 存储动态调整超参数的规则
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_adjustment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 规则名称
  rule_name VARCHAR(100) NOT NULL,
  
  -- 触发条件
  trigger_condition JSONB NOT NULL,
  
  -- 调整动作
  adjustment_action JSONB NOT NULL,
  
  -- 优先级
  priority INTEGER DEFAULT 100,
  
  -- 状态
  enabled BOOLEAN DEFAULT true,
  expert_verified BOOLEAN DEFAULT false,
  
  -- 效果统计
  stats JSONB,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束
  UNIQUE(rule_name)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_rules_enabled ON ppo_adjustment_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_ppo_rules_priority ON ppo_adjustment_rules(priority);
CREATE INDEX IF NOT EXISTS idx_ppo_rules_verified ON ppo_adjustment_rules(expert_verified) WHERE expert_verified = true;

-- 注释
COMMENT ON TABLE ppo_adjustment_rules IS 'PPO超参数动态调整规则表';
COMMENT ON COLUMN ppo_adjustment_rules.trigger_condition IS '触发条件: {metric, operator, value, consecutive_count}';
COMMENT ON COLUMN ppo_adjustment_rules.adjustment_action IS '调整动作: {param, action, value, factor, bounds}';

-- ============================================================================
-- 5. 超参数效果追踪表
-- 记录每个配置的使用效果
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_hyperparam_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联版本
  version_id UUID REFERENCES ppo_hyperparam_versions(id),
  
  -- 使用时长（毫秒）
  usage_duration BIGINT DEFAULT 0,
  
  -- 效果指标
  metrics JSONB NOT NULL,
  
  -- 用户反馈
  feedback JSONB,
  
  -- 时间范围
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ DEFAULT NOW(),
  
  -- 创建时间
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_effects_version ON ppo_hyperparam_effects(version_id);
CREATE INDEX IF NOT EXISTS idx_ppo_effects_start_time ON ppo_hyperparam_effects(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_ppo_effects_metrics ON ppo_hyperparam_effects USING GIN(metrics);

-- 注释
COMMENT ON TABLE ppo_hyperparam_effects IS 'PPO超参数效果追踪表';

-- ============================================================================
-- 6. 初始数据
-- ============================================================================

-- 插入初始超参数版本
INSERT INTO ppo_hyperparam_versions (version, config, performance, is_active, source, tags, notes, created_by)
VALUES (
  1,
  '{"learningRate": 0.0003, "clipEpsilon": 0.2, "entropyCoef": 0.01, "gaeLambda": 0.95}',
  '{"avgReward": 0, "avgLoss": 0, "avgKl": 0, "trend": "stable", "sampleCount": 0}',
  true,
  'manual',
  '{"initial", "default"}',
  '默认初始配置',
  'system'
) ON CONFLICT (version) DO NOTHING;

-- 插入初始调整规则
INSERT INTO ppo_adjustment_rules (rule_name, trigger_condition, adjustment_action, priority, enabled, expert_verified)
VALUES 
(
  'high_kl_reduce_lr',
  '{"metric": "klDivergence", "operator": "gt", "value": 0.1, "consecutive_count": 3}',
  '{"param": "learningRate", "action": "decrease", "factor": 0.7, "bounds": {"min": 1e-6, "max": 1e-3}}',
  100,
  true,
  true
),
(
  'low_stability_increase_entropy',
  '{"metric": "stability", "operator": "lt", "value": 0.7, "consecutive_count": 5}',
  '{"param": "entropyCoef", "action": "increase", "factor": 1.2, "bounds": {"min": 0.001, "max": 0.1}}',
  90,
  true,
  false
),
(
  'degrading_trend_rollback',
  '{"metric": "trend", "operator": "eq", "value": "degrading", "consecutive_count": 10}',
  '{"param": "all", "action": "rollback"}',
  50,
  true,
  true
) ON CONFLICT (rule_name) DO NOTHING;

-- 插入初始知识
INSERT INTO ppo_hyperparam_knowledge (knowledge_type, param_name, knowledge, confidence, sample_count, source)
VALUES 
(
  'constraint',
  'learningRate',
  '{"description": "学习率应在1e-6到1e-3之间", "range": {"min": 1e-6, "max": 1e-3}}',
  0.95,
  0,
  'literature'
),
(
  'constraint',
  'clipEpsilon',
  '{"description": "PPO裁剪参数通常在0.1到0.3之间", "range": {"min": 0.05, "max": 0.3}}',
  0.90,
  0,
  'literature'
),
(
  'constraint',
  'entropyCoef',
  '{"description": "熵系数用于鼓励探索，通常在0.001到0.1之间", "range": {"min": 0.001, "max": 0.1}}',
  0.85,
  0,
  'literature'
),
(
  'best_practice',
  'gaeLambda',
  '{"description": "GAE lambda通常设置为0.95，平衡偏差和方差", "value": 0.95}',
  0.90,
  0,
  'literature'
) ON CONFLICT (knowledge_type, param_name) DO NOTHING;

-- ============================================================================
-- 7. 触发器：自动更新时间戳
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ppo_adjustment_rules_updated_at
    BEFORE UPDATE ON ppo_adjustment_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. 视图：活跃配置统计
-- ============================================================================
CREATE OR REPLACE VIEW ppo_active_config_stats AS
SELECT 
  v.id,
  v.version,
  v.config,
  v.performance,
  v.tags,
  v.created_at,
  COUNT(e.id) as effect_count,
  AVG((NULLIF(TRIM(e.metrics->>'avgReward'), ''))::double precision) as avg_effect_reward,
  SUM(e.usage_duration) as total_usage_duration
FROM ppo_hyperparam_versions v
LEFT JOIN ppo_hyperparam_effects e ON v.id = e.version_id
WHERE v.is_active = true
GROUP BY v.id, v.version, v.config, v.performance, v.tags, v.created_at;

COMMENT ON VIEW ppo_active_config_stats IS '当前激活配置的效果统计视图';

-- ============================================================================
-- 完成
-- ============================================================================
-- 执行完成后，PPO持久化系统表结构已创建
-- 包含：版本管理、训练历史、知识库、调整规则、效果追踪
