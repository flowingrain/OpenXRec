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
