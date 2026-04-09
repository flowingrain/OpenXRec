-- ============================================================================
-- PPO 超参数持久化与版本管理
-- 包含：超参数版本、训练历史、知识库、调整规则
-- 执行方式: 在 Supabase SQL Editor 中运行此脚本
-- ============================================================================

-- ============================================================================
-- 1. PPO 超参数版本表
-- 存储超参数配置的历史版本，支持回滚和审核
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_hyperparam_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  
  -- 超参数配置
  config JSONB NOT NULL,
  
  -- 性能指标
  performance JSONB,
  
  -- 状态
  is_active BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  
  -- 来源
  source VARCHAR(20) DEFAULT 'auto' CHECK (source IN ('auto', 'manual', 'rollback')),
  
  -- 元数据
  parent_version INTEGER,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- 审计信息
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：每个版本号只能有一条记录
  UNIQUE(version)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_versions_version ON ppo_hyperparam_versions(version);
CREATE INDEX IF NOT EXISTS idx_ppo_versions_active ON ppo_hyperparam_versions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ppo_versions_verified ON ppo_hyperparam_versions(is_verified) WHERE is_verified = true;
CREATE INDEX IF NOT EXISTS idx_ppo_versions_source ON ppo_hyperparam_versions(source);
CREATE INDEX IF NOT EXISTS idx_ppo_versions_tags ON ppo_hyperparam_versions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ppo_versions_created_at ON ppo_hyperparam_versions(created_at DESC);

-- 注释
COMMENT ON TABLE ppo_hyperparam_versions IS 'PPO超参数版本管理表';
COMMENT ON COLUMN ppo_hyperparam_versions.config IS '超参数配置: {learningRate, clipEpsilon, entropyCoef, gaeLambda}';
COMMENT ON COLUMN ppo_hyperparam_versions.performance IS '性能指标: {avgReward, avgLoss, avgKl, trend, sampleCount}';
COMMENT ON COLUMN ppo_hyperparam_versions.is_active IS '是否为当前激活版本';
COMMENT ON COLUMN ppo_hyperparam_versions.is_verified IS '是否通过专家审核';

-- ============================================================================
-- 2. PPO 训练历史表
-- 记录每次训练的超参数快照和性能指标
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_training_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  
  -- 超参数快照
  hyperparams JSONB NOT NULL,
  
  -- 训练指标
  metrics JSONB NOT NULL,
  
  -- 调整信息
  adaptation JSONB,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_training_session ON ppo_training_history(session_id);
CREATE INDEX IF NOT EXISTS idx_ppo_training_epoch ON ppo_training_history(epoch);
CREATE INDEX IF NOT EXISTS idx_ppo_training_created_at ON ppo_training_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppo_training_session_epoch ON ppo_training_history(session_id, epoch);

-- 注释
COMMENT ON TABLE ppo_training_history IS 'PPO训练历史记录表';
COMMENT ON COLUMN ppo_training_history.hyperparams IS '训练时的超参数快照';
COMMENT ON COLUMN ppo_training_history.metrics IS '训练指标: {policyLoss, valueLoss, entropy, klDivergence, clipFraction, avgReward, explainedVariance}';
COMMENT ON COLUMN ppo_training_history.adaptation IS '调整信息: {adapted, reason, recommendations}';

-- ============================================================================
-- 3. PPO 超参数知识库
-- 存储从训练历史中提取的知识和规则
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_hyperparam_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 知识类型
  knowledge_type VARCHAR(20) NOT NULL CHECK (knowledge_type IN (
    'correlation',      -- 相关性知识
    'pattern',          -- 模式知识
    'constraint',       -- 约束知识
    'best_practice'     -- 最佳实践
  )),
  
  -- 参数名
  param_name VARCHAR(50) NOT NULL,
  
  -- 知识内容
  knowledge JSONB NOT NULL,
  
  -- 置信度
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  
  -- 样本统计
  sample_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  
  -- 来源
  source VARCHAR(20) DEFAULT 'learned' CHECK (source IN ('learned', 'expert', 'literature')),
  
  -- 时间戳
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：同一参数的同一类型知识只能有一条
  UNIQUE(knowledge_type, param_name)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_knowledge_type ON ppo_hyperparam_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_ppo_knowledge_param ON ppo_hyperparam_knowledge(param_name);
CREATE INDEX IF NOT EXISTS idx_ppo_knowledge_confidence ON ppo_hyperparam_knowledge(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_ppo_knowledge_source ON ppo_hyperparam_knowledge(source);

-- 注释
COMMENT ON TABLE ppo_hyperparam_knowledge IS 'PPO超参数知识库，存储从训练历史中提取的知识';

-- ============================================================================
-- 4. PPO 调整规则表
-- 存储动态调整超参数的规则
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_adjustment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 规则名称
  rule_name VARCHAR(100) NOT NULL,
  
  -- 触发条件
  trigger_condition JSONB NOT NULL,
  
  -- 调整动作
  adjustment_action JSONB NOT NULL,
  
  -- 优先级
  priority INTEGER DEFAULT 100,
  
  -- 状态
  enabled BOOLEAN DEFAULT true,
  expert_verified BOOLEAN DEFAULT false,
  
  -- 效果统计
  stats JSONB,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束
  UNIQUE(rule_name)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_rules_enabled ON ppo_adjustment_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_ppo_rules_priority ON ppo_adjustment_rules(priority);
CREATE INDEX IF NOT EXISTS idx_ppo_rules_verified ON ppo_adjustment_rules(expert_verified) WHERE expert_verified = true;

-- 注释
COMMENT ON TABLE ppo_adjustment_rules IS 'PPO超参数动态调整规则表';
COMMENT ON COLUMN ppo_adjustment_rules.trigger_condition IS '触发条件: {metric, operator, value, consecutive_count}';
COMMENT ON COLUMN ppo_adjustment_rules.adjustment_action IS '调整动作: {param, action, value, factor, bounds}';

-- ============================================================================
-- 5. 超参数效果追踪表
-- 记录每个配置的使用效果
-- ============================================================================
CREATE TABLE IF NOT EXISTS ppo_hyperparam_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联版本
  version_id UUID REFERENCES ppo_hyperparam_versions(id),
  
  -- 使用时长（毫秒）
  usage_duration BIGINT DEFAULT 0,
  
  -- 效果指标
  metrics JSONB NOT NULL,
  
  -- 用户反馈
  feedback JSONB,
  
  -- 时间范围
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ DEFAULT NOW(),
  
  -- 创建时间
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ppo_effects_version ON ppo_hyperparam_effects(version_id);
CREATE INDEX IF NOT EXISTS idx_ppo_effects_start_time ON ppo_hyperparam_effects(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_ppo_effects_metrics ON ppo_hyperparam_effects USING GIN(metrics);

-- 注释
COMMENT ON TABLE ppo_hyperparam_effects IS 'PPO超参数效果追踪表';

-- ============================================================================
-- 6. 初始数据
-- ============================================================================

-- 插入初始超参数版本
INSERT INTO ppo_hyperparam_versions (version, config, performance, is_active, source, tags, notes, created_by)
VALUES (
  1,
  '{"learningRate": 0.0003, "clipEpsilon": 0.2, "entropyCoef": 0.01, "gaeLambda": 0.95}',
  '{"avgReward": 0, "avgLoss": 0, "avgKl": 0, "trend": "stable", "sampleCount": 0}',
  true,
  'manual',
  '{"initial", "default"}',
  '默认初始配置',
  'system'
) ON CONFLICT (version) DO NOTHING;

-- 插入初始调整规则
INSERT INTO ppo_adjustment_rules (rule_name, trigger_condition, adjustment_action, priority, enabled, expert_verified)
VALUES 
(
  'high_kl_reduce_lr',
  '{"metric": "klDivergence", "operator": "gt", "value": 0.1, "consecutive_count": 3}',
  '{"param": "learningRate", "action": "decrease", "factor": 0.7, "bounds": {"min": 1e-6, "max": 1e-3}}',
  100,
  true,
  true
),
(
  'low_stability_increase_entropy',
  '{"metric": "stability", "operator": "lt", "value": 0.7, "consecutive_count": 5}',
  '{"param": "entropyCoef", "action": "increase", "factor": 1.2, "bounds": {"min": 0.001, "max": 0.1}}',
  90,
  true,
  false
),
(
  'degrading_trend_rollback',
  '{"metric": "trend", "operator": "eq", "value": "degrading", "consecutive_count": 10}',
  '{"param": "all", "action": "rollback"}',
  50,
  true,
  true
) ON CONFLICT (rule_name) DO NOTHING;

-- 插入初始知识
INSERT INTO ppo_hyperparam_knowledge (knowledge_type, param_name, knowledge, confidence, sample_count, source)
VALUES 
(
  'constraint',
  'learningRate',
  '{"description": "学习率应在1e-6到1e-3之间", "range": {"min": 1e-6, "max": 1e-3}}',
  0.95,
  0,
  'literature'
),
(
  'constraint',
  'clipEpsilon',
  '{"description": "PPO裁剪参数通常在0.1到0.3之间", "range": {"min": 0.05, "max": 0.3}}',
  0.90,
  0,
  'literature'
),
(
  'constraint',
  'entropyCoef',
  '{"description": "熵系数用于鼓励探索，通常在0.001到0.1之间", "range": {"min": 0.001, "max": 0.1}}',
  0.85,
  0,
  'literature'
),
(
  'best_practice',
  'gaeLambda',
  '{"description": "GAE lambda通常设置为0.95，平衡偏差和方差", "value": 0.95}',
  0.90,
  0,
  'literature'
) ON CONFLICT (knowledge_type, param_name) DO NOTHING;

-- ============================================================================
-- 7. 触发器：自动更新时间戳
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ppo_adjustment_rules_updated_at
    BEFORE UPDATE ON ppo_adjustment_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. 视图：活跃配置统计
-- ============================================================================
CREATE OR REPLACE VIEW ppo_active_config_stats AS
SELECT 
  v.id,
  v.version,
  v.config,
  v.performance,
  v.tags,
  v.created_at,
  COUNT(e.id) as effect_count,
  AVG((NULLIF(TRIM(e.metrics->>'avgReward'), ''))::double precision) as avg_effect_reward,
  SUM(e.usage_duration) as total_usage_duration
FROM ppo_hyperparam_versions v
LEFT JOIN ppo_hyperparam_effects e ON v.id = e.version_id
WHERE v.is_active = true
GROUP BY v.id, v.version, v.config, v.performance, v.tags, v.created_at;

COMMENT ON VIEW ppo_active_config_stats IS '当前激活配置的效果统计视图';

-- ============================================================================
-- 完成
-- ============================================================================
-- 执行完成后，PPO持久化系统表结构已创建
-- 包含：版本管理、训练历史、知识库、调整规则、效果追踪
