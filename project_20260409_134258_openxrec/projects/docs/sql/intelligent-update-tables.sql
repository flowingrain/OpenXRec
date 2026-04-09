-- 智能更新检测系统数据库表
-- 执行顺序：先删除旧表（如果存在），再创建新表

-- ==================== 知识版本表 ====================
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_entry_id ON knowledge_versions(entry_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_is_current ON knowledge_versions(is_current);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_created_at ON knowledge_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_change_type ON knowledge_versions(change_type);

-- ==================== 知识审核队列 ====================
CREATE TABLE IF NOT EXISTS knowledge_review_queue (
  id TEXT PRIMARY KEY,
  entry_snapshot JSONB NOT NULL,
  detection_result JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_review_queue_status ON knowledge_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON knowledge_review_queue(priority);
CREATE INDEX IF NOT EXISTS idx_review_queue_submitted_at ON knowledge_review_queue(submitted_at DESC);

-- ==================== 知识生命周期事件表 ====================
CREATE TABLE IF NOT EXISTS knowledge_lifecycle_events (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('create', 'access', 'update', 'correct', 'supplement', 'expire', 'restore', 'archive', 'conflict')),
  old_state TEXT CHECK (old_state IN ('created', 'active', 'updated', 'superseded', 'expired', 'conflicted', 'archived')),
  new_state TEXT CHECK (new_state IN ('created', 'active', 'updated', 'superseded', 'expired', 'conflicted', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_entry_id ON knowledge_lifecycle_events(entry_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_event ON knowledge_lifecycle_events(event);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_created_at ON knowledge_lifecycle_events(created_at DESC);

-- ==================== 更新知识条目表（添加新字段）====================

-- 检查表是否存在，如果存在则添加新字段
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_entries') THEN
    -- 添加时效性字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_entries' AND column_name = 'time_sensitivity') THEN
      ALTER TABLE knowledge_entries ADD COLUMN time_sensitivity TEXT DEFAULT 'low' CHECK (time_sensitivity IN ('realtime', 'high', 'medium', 'low', 'permanent'));
    END IF;
    
    -- 添加过期时间字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_entries' AND column_name = 'expires_at') THEN
      ALTER TABLE knowledge_entries ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
    
    -- 添加版本计数字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_entries' AND column_name = 'version_count') THEN
      ALTER TABLE knowledge_entries ADD COLUMN version_count INTEGER DEFAULT 0;
    END IF;
    
    -- 添加最后更新者字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_entries' AND column_name = 'last_updated_by') THEN
      ALTER TABLE knowledge_entries ADD COLUMN last_updated_by TEXT;
    END IF;
  END IF;
END $$;

-- ==================== 注释 ====================
COMMENT ON TABLE knowledge_versions IS '知识版本历史表，存储每次变更的快照';
COMMENT ON TABLE knowledge_review_queue IS '知识审核队列，存储待审核的知识变更';
COMMENT ON TABLE knowledge_lifecycle_events IS '知识生命周期事件表，记录状态转换历史';

COMMENT ON COLUMN knowledge_versions.snapshot IS '知识条目的完整快照';
COMMENT ON COLUMN knowledge_versions.change_type IS '变更类型：create/update/correct/supplement/merge/restore';
COMMENT ON COLUMN knowledge_versions.diff IS '与上一版本的差异';

COMMENT ON COLUMN knowledge_lifecycle_events.event IS '生命周期事件类型';
COMMENT ON COLUMN knowledge_lifecycle_events.old_state IS '转换前的状态';
COMMENT ON COLUMN knowledge_lifecycle_events.new_state IS '转换后的状态';
