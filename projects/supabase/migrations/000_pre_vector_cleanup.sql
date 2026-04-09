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
