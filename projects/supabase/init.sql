-- ============================================================================
-- OmniSight 宏观态势感知平台 - 数据库初始化脚本
-- 执行方式: 在 Supabase SQL Editor 中运行此脚本
-- ============================================================================

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
  embedding vector(2048),  -- 需要启用 pgvector 扩展
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
-- 10. 启用必要的扩展
-- ============================================================================
-- 如果需要向量搜索，取消下面的注释
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 10. 行级安全策略 (RLS)
-- ============================================================================
ALTER TABLE kg_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_feedback ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Allow anonymous read" ON case_feedback FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write" ON case_feedback FOR ALL USING (true) WITH CHECK (true);
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
-- 6. case_feedback - 案例反馈
-- 7. knowledge_docs - 知识库文档
-- 8. user_preferences - 用户偏好
