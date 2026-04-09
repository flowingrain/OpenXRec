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
