-- 统一存储系统数据库表结构
-- 
-- 架构设计：
-- ┌─────────────────────────────────────────────────────────────────┐
-- │                        数据存储分层架构                          │
-- ├─────────────────────────────────────────────────────────────────┤
-- │  在线检索层 (Web Search) - 实时数据，不持久化                     │
-- │                              ↓                                  │
-- │  RAG检索层 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
-- │            │   向量库     │←→│   知识库     │←→│   案例库     │   │
-- │            │  (索引层)    │  │  (事实层)    │  │  (经验层)    │   │
-- │            └─────────────┘  └─────────────┘  └─────────────┘   │
-- │                              ↓                                  │
-- │  数据库层 (Supabase) - 元数据、配置、日志、事务                   │
-- └─────────────────────────────────────────────────────────────────┘

-- ==================== 数据库层（元数据与事务层）====================

-- 用户偏好表（已存在，扩展字段）
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_system_configs_key ON system_configs(key);
CREATE INDEX IF NOT EXISTS idx_system_configs_category ON system_configs(category);

-- 交互日志表
CREATE TABLE IF NOT EXISTS interaction_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('query', 'click', 'feedback', 'search')),
  data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interaction_logs_user_id ON interaction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_session_id ON interaction_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_type ON interaction_logs(type);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_created_at ON interaction_logs(created_at DESC);

-- ==================== 知识库层（事实知识层）====================

-- 知识实体表（已存在，确保字段完整）
CREATE TABLE IF NOT EXISTS kg_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'other',
  aliases TEXT[] DEFAULT '{}',
  description TEXT,
  importance NUMERIC(3, 2) DEFAULT 0.5,
  properties JSONB DEFAULT '{}',
  source_type TEXT DEFAULT 'llm_generated',
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_entities_name ON kg_entities(name);
CREATE INDEX IF NOT EXISTS idx_kg_entities_type ON kg_entities(type);
CREATE INDEX IF NOT EXISTS idx_kg_entities_verified ON kg_entities(verified);

-- 知识关系表（已存在，确保字段完整）
CREATE TABLE IF NOT EXISTS kg_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID REFERENCES kg_entities(id) ON DELETE CASCADE,
  target_entity_id UUID REFERENCES kg_entities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  confidence NUMERIC(3, 2) DEFAULT 0.5,
  evidence TEXT,
  properties JSONB DEFAULT '{}',
  source_type TEXT DEFAULT 'llm_generated',
  verified BOOLEAN DEFAULT FALSE,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_entity_id, target_entity_id, type)
);

CREATE INDEX IF NOT EXISTS idx_kg_relations_source ON kg_relations(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_relations_target ON kg_relations(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_relations_type ON kg_relations(type);
CREATE INDEX IF NOT EXISTS idx_kg_relations_verified ON kg_relations(verified);

-- 知识条目表
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('economic_indicator', 'event', 'entity', 'policy', 'relationship', 'market_data')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence NUMERIC(3, 2) DEFAULT 0.8,
  tags TEXT[] DEFAULT '{}',
  related_entities TEXT[] DEFAULT '{}',
  region TEXT,
  sector TEXT,
  is_preset BOOLEAN DEFAULT FALSE,
  is_auto_learned BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'conflicted', 'pending_review', 'archived')),
  time_sensitivity TEXT DEFAULT 'low' CHECK (time_sensitivity IN ('realtime', 'high', 'medium', 'low', 'permanent')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  version_count INTEGER DEFAULT 0,
  last_updated_by TEXT,
  embedding VECTOR(1024)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_type ON knowledge_entries(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_status ON knowledge_entries(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_tags ON knowledge_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_expires ON knowledge_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding ON knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 知识版本表（继承自智能更新系统）
CREATE TABLE IF NOT EXISTS knowledge_versions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'correct', 'supplement', 'merge', 'restore')),
  change_description TEXT,
  change_source JSONB,
  diff JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  is_current BOOLEAN DEFAULT TRUE,
  tags TEXT[] DEFAULT '{}',
  
  CONSTRAINT uk_entry_version UNIQUE (entry_id, version)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_versions_entry_id ON knowledge_versions(entry_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_is_current ON knowledge_versions(is_current);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_created_at ON knowledge_versions(created_at DESC);

-- ==================== 案例库层（经验知识层）====================

-- 分析案例表（已存在，确保字段完整）
CREATE TABLE IF NOT EXISTS analysis_cases (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  domain TEXT NOT NULL,
  final_report TEXT,
  conclusion JSONB,
  timeline JSONB,
  key_factors JSONB,
  scenarios JSONB,
  causal_chains JSONB,
  confidence NUMERIC(3, 2),
  agent_outputs JSONB,
  quality_score NUMERIC(3, 2),
  user_rating INTEGER,
  feedback_count INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]',
  status TEXT DEFAULT 'completed',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_cases_domain ON analysis_cases(domain);
CREATE INDEX IF NOT EXISTS idx_analysis_cases_status ON analysis_cases(status);
CREATE INDEX IF NOT EXISTS idx_analysis_cases_analyzed_at ON analysis_cases(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_cases_quality_score ON analysis_cases(quality_score);

-- 案例模板表
CREATE TABLE IF NOT EXISTS case_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT NOT NULL,
  template JSONB NOT NULL,
  usage_count INTEGER DEFAULT 0,
  success_rate NUMERIC(3, 2) DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_templates_domain ON case_templates(domain);
CREATE INDEX IF NOT EXISTS idx_case_templates_usage_count ON case_templates(usage_count DESC);

-- ==================== 向量库层（语义索引层）====================

-- 案例嵌入表（已存在，确保字段完整）
CREATE TABLE IF NOT EXISTS case_embeddings (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  embedding_type TEXT NOT NULL CHECK (embedding_type IN ('case_query', 'case_result', 'query')),
  embedding VECTOR(1024) NOT NULL,
  model TEXT NOT NULL,
  text_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_embeddings_case_id ON case_embeddings(case_id);
CREATE INDEX IF NOT EXISTS idx_case_embeddings_type ON case_embeddings(embedding_type);
CREATE INDEX IF NOT EXISTS idx_case_embeddings_model ON case_embeddings(model);
CREATE INDEX IF NOT EXISTS idx_case_embeddings_vector ON case_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ==================== 向量搜索函数 ====================

-- 知识条目向量搜索函数
CREATE OR REPLACE FUNCTION search_knowledge_by_vector(
  query_embedding VECTOR(1024),
  match_limit INTEGER DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  type TEXT,
  confidence NUMERIC,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.title,
    ke.content,
    ke.type,
    ke.confidence,
    1 - (ke.embedding <=> query_embedding) AS similarity,
    ke.created_at
  FROM knowledge_entries ke
  WHERE ke.embedding IS NOT NULL
    AND ke.status = 'active'
    AND 1 - (ke.embedding <=> query_embedding) >= match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- 案例向量搜索函数
CREATE OR REPLACE FUNCTION search_case_by_vector(
  query_embedding VECTOR(1024),
  match_limit INTEGER DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id TEXT,
  case_id TEXT,
  embedding_type TEXT,
  model TEXT,
  text_preview TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id,
    ce.case_id,
    ce.embedding_type,
    ce.model,
    ce.text_preview,
    1 - (ce.embedding <=> query_embedding) AS similarity,
    ce.created_at
  FROM case_embeddings ce
  WHERE 1 - (ce.embedding <=> query_embedding) >= match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- ==================== 注释 ====================

COMMENT ON TABLE user_preferences IS '用户偏好设置表';
COMMENT ON TABLE system_configs IS '系统配置表';
COMMENT ON TABLE interaction_logs IS '交互日志表';
COMMENT ON TABLE kg_entities IS '知识实体表';
COMMENT ON TABLE kg_relations IS '知识关系表';
COMMENT ON TABLE knowledge_entries IS '知识条目表';
COMMENT ON TABLE knowledge_versions IS '知识版本历史表';
COMMENT ON TABLE analysis_cases IS '分析案例表';
COMMENT ON TABLE case_templates IS '案例模板表';
COMMENT ON TABLE case_embeddings IS '案例向量嵌入表';

COMMENT ON COLUMN knowledge_entries.embedding IS '向量嵌入，使用 doubao-embedding-vision-251215 模型';
COMMENT ON COLUMN case_embeddings.embedding IS '向量嵌入，使用 doubao-embedding-vision-251215 模型';

-- ==================== 初始化默认配置 ====================

INSERT INTO system_configs (key, value, category, description)
VALUES 
  ('recommendation.strategy_weights', '{"content_based": 0.3, "collaborative": 0.3, "knowledge_based": 0.2, "agent_based": 0.1, "causal_based": 0.1}', 'recommendation', '推荐策略权重配置')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_configs (key, value, category, description)
VALUES 
  ('recommendation.diversity', '{"enabled": true, "threshold": 0.7}', 'recommendation', '多样性优化配置')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_configs (key, value, category, description)
VALUES 
  ('storage.time_sensitivity', '{"realtime": 1, "high": 24, "medium": 168, "low": 720, "permanent": null}', 'storage', '时效性配置（小时）')
ON CONFLICT (key) DO NOTHING;
