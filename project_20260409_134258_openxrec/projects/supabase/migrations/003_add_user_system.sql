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
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at) WHERE expires_at > NOW();

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

-- 匿名用户反馈策略（允许未登录用户提交反馈）
CREATE POLICY "Allow anonymous feedback insert" ON user_feedback
  FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

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
