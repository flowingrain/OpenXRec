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
    ELSE
        -- 创建 HNSW 索引用于余弦相似度搜索
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'case_embeddings_embedding_cosine_idx'
        ) THEN
            CREATE INDEX case_embeddings_embedding_cosine_idx 
            ON case_embeddings 
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        END IF;

        -- 创建 HNSW 索引用于欧氏距离搜索
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'case_embeddings_embedding_l2_idx'
        ) THEN
            CREATE INDEX case_embeddings_embedding_l2_idx 
            ON case_embeddings 
            USING hnsw (embedding vector_l2_ops)
            WITH (m = 16, ef_construction = 64);
        END IF;

        -- 创建 HNSW 索引用于内积搜索
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

-- 为 user_feedbacks 表添加复合索引
CREATE INDEX IF NOT EXISTS user_feedbacks_user_created_idx 
ON user_feedbacks (userId, createdAt DESC);

-- 为 user_preferences 表添加 JSONB 索引
CREATE INDEX IF NOT EXISTS user_preferences_preferences_gin_idx 
ON user_preferences 
USING gin (preferences);

-- 添加 pg_trgm 扩展用于模糊搜索
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
