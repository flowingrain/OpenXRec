-- ============================================================================
-- 快速创建 user_profiles 表（临时解决方案）
-- 执行方式: 在 Supabase SQL Editor 中运行
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  
  -- 兴趣偏好
  interests TEXT[] DEFAULT ARRAY['科技', '阅读', '产品'],
  
  -- 偏好设置
  preferences JSONB DEFAULT '{}',
  
  -- 统计信息
  total_queries INTEGER DEFAULT 0,
  total_recommendations INTEGER DEFAULT 0,
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated ON user_profiles(updated_at DESC);

-- 启用行级安全策略
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 允许公开读取（临时方案）
CREATE POLICY "Allow anonymous read" ON user_profiles
  FOR SELECT TO public USING (true);

-- 允许公开写入（临时方案）
CREATE POLICY "Allow anonymous write" ON user_profiles
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- 完成
SELECT 'user_profiles table created successfully!' as status;
