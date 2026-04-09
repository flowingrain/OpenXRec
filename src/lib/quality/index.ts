/**
 * 质量检测与反馈优化 - 类型导出
 */

export type {
  QualityDimension,
  Severity,
  QualityIssueType,
  QualityIssue,
  DimensionScore,
  QualityReport,
  QualityCheckConfig,
} from './quality-checker';

export type {
  FeedbackType,
  FeedbackDimension,
  UserFeedback,
  StrategyAdjustment,
  LearningPattern,
  UserPreferences,
} from './feedback-optimizer';

export { QualityChecker, qualityChecker } from './quality-checker';
export { FeedbackOptimizer, feedbackOptimizer } from './feedback-optimizer';
// 导出 SQL 语句（运行时获取）
export const QUALITY_TABLES_SQL = `
-- 1. 质量检测报告表
CREATE TABLE IF NOT EXISTS quality_reports (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    query TEXT NOT NULL,
    overall_score INTEGER NOT NULL,
    grade TEXT NOT NULL CHECK (grade IN ('excellent', 'good', 'fair', 'poor', 'critical')),
    dimension_scores JSONB NOT NULL,
    issues JSONB NOT NULL DEFAULT '[]',
    critical_issues JSONB NOT NULL DEFAULT '[]',
    improvement_priority JSONB NOT NULL DEFAULT '[]',
    analysis_metadata JSONB NOT NULL DEFAULT '{}',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_quality_reports_case_id ON quality_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_quality_reports_score ON quality_reports(overall_score);
CREATE INDEX IF NOT EXISTS idx_quality_reports_detected_at ON quality_reports(detected_at DESC);

-- 2. 用户反馈表
CREATE TABLE IF NOT EXISTS analysis_feedback (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    user_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('rating', 'thumbs', 'dimension_rating', 'correction', 'suggestion', 'preference')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    thumbs_up BOOLEAN,
    dimension_ratings JSONB,
    correction JSONB,
    suggestion JSONB,
    preference JSONB,
    quality_report_id TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_quality_report FOREIGN KEY (quality_report_id) REFERENCES quality_reports(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_analysis_feedback_case_id ON analysis_feedback(case_id);
CREATE INDEX IF NOT EXISTS idx_analysis_feedback_user_id ON analysis_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_feedback_type ON analysis_feedback(type);
CREATE INDEX IF NOT EXISTS idx_analysis_feedback_created_at ON analysis_feedback(created_at DESC);

-- 3. 策略调整记录表
CREATE TABLE IF NOT EXISTS strategy_adjustments (
    id TEXT PRIMARY KEY,
    triggered_by JSONB NOT NULL DEFAULT '[]',
    adjustments JSONB NOT NULL DEFAULT '{}',
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_strategy_adjustments_created_at ON strategy_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_adjustments_expires_at ON strategy_adjustments(expires_at) WHERE expires_at IS NOT NULL;

-- 4. 用户偏好表
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    depth TEXT NOT NULL DEFAULT 'normal' CHECK (depth IN ('shallow', 'normal', 'deep')),
    breadth TEXT NOT NULL DEFAULT 'normal' CHECK (breadth IN ('narrow', 'normal', 'wide')),
    speed TEXT NOT NULL DEFAULT 'normal' CHECK (speed IN ('fast', 'normal', 'thorough')),
    preferred_sources JSONB NOT NULL DEFAULT '[]',
    avoided_sources JSONB NOT NULL DEFAULT '[]',
    min_authority_level INTEGER NOT NULL DEFAULT 3,
    report_style TEXT NOT NULL DEFAULT 'normal' CHECK (report_style IN ('brief', 'normal', 'detailed')),
    focus_areas JSONB NOT NULL DEFAULT '[]',
    max_analysis_time INTEGER NOT NULL DEFAULT 120,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
