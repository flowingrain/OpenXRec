-- ============================================================================
-- 推荐反馈表 - 独立于用户系统
-- 用于记录推荐反馈，支持匿名用户
-- ============================================================================

-- 检查表是否已存在
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recommendation_feedbacks') THEN
    -- 创建推荐反馈表
    CREATE TABLE recommendation_feedbacks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT,  -- 可以是 UUID 或会话 ID，支持匿名（NULL）
      recommendation_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_title TEXT,
      item_type TEXT DEFAULT 'knowledge',
      feedback_type VARCHAR(20) NOT NULL,
      rating INTEGER,
      satisfied BOOLEAN,
      comment TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- 创建索引
    CREATE INDEX idx_rec_feedback_user_id ON recommendation_feedbacks(user_id);
    CREATE INDEX idx_rec_feedback_recommendation_id ON recommendation_feedbacks(recommendation_id);
    CREATE INDEX idx_rec_feedback_item_id ON recommendation_feedbacks(item_id);
    CREATE INDEX idx_rec_feedback_created_at ON recommendation_feedbacks(created_at DESC);
    CREATE INDEX idx_rec_feedback_type ON recommendation_feedbacks(feedback_type);
    
    -- 启用 RLS
    ALTER TABLE recommendation_feedbacks ENABLE ROW LEVEL SECURITY;
    
    -- RLS 策略：允许匿名用户插入自己的数据
    CREATE POLICY "Allow anonymous insert for own data" ON recommendation_feedbacks
        FOR INSERT TO public
        WITH CHECK (user_id IS NULL OR auth.uid()::text = user_id);
    
    -- RLS 策略：允许读取自己的数据或匿名数据
    CREATE POLICY "Allow read for own data or anonymous" ON recommendation_feedbacks
        FOR SELECT USING (user_id IS NULL OR auth.uid()::text = user_id);
    
    -- 添加注释
    COMMENT ON TABLE recommendation_feedbacks IS '推荐反馈表，记录用户对推荐结果的评价，支持匿名用户反馈';
    
    RAISE NOTICE 'Created recommendation_feedbacks table';
  ELSE
    -- 如果表已存在，添加缺失的列
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recommendation_feedbacks' AND column_name = 'item_title') THEN
      ALTER TABLE recommendation_feedbacks ADD COLUMN item_title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recommendation_feedbacks' AND column_name = 'item_type') THEN
      ALTER TABLE recommendation_feedbacks ADD COLUMN item_type TEXT DEFAULT 'knowledge';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recommendation_feedbacks' AND column_name = 'satisfied') THEN
      ALTER TABLE recommendation_feedbacks ADD COLUMN satisfied BOOLEAN;
    END IF;
    
    -- 确保 RLS 已启用
    ALTER TABLE recommendation_feedbacks ENABLE ROW LEVEL SECURITY;
    
    -- 确保 RLS 策略存在
    DROP POLICY IF EXISTS "Allow anonymous insert for own data" ON recommendation_feedbacks;
    CREATE POLICY "Allow anonymous insert for own data" ON recommendation_feedbacks
        FOR INSERT TO public
        WITH CHECK (user_id IS NULL OR auth.uid()::text = user_id);
    
    DROP POLICY IF EXISTS "Allow read for own data or anonymous" ON recommendation_feedbacks;
    CREATE POLICY "Allow read for own data or anonymous" ON recommendation_feedbacks
        FOR SELECT USING (user_id IS NULL OR auth.uid()::text = user_id);
    
    RAISE NOTICE 'Updated recommendation_feedbacks table with missing columns and RLS policies';
  END IF;
END $$;

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';
