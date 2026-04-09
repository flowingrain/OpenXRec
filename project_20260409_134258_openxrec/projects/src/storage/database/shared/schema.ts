import { pgTable, index, text, jsonb, timestamp, serial, unique, uuid, integer, varchar, check, real, boolean, pgPolicy, vector, foreignKey, numeric, date, bigint, pgSequence } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const userFeedbackIdSeq = pgSequence("user_feedback_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })
export const userProfilesIdSeq = pgSequence("user_profiles_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "2147483647", cache: "1", cycle: false })

export const strategyAdjustments = pgTable("strategy_adjustments", {
	id: text().primaryKey().notNull(),
	triggeredBy: jsonb("triggered_by").default([]).notNull(),
	adjustments: jsonb().default({}).notNull(),
	reason: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_strategy_adjustments_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_strategy_adjustments_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(expires_at IS NOT NULL)`),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const reportVersions = pgTable("report_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	caseId: text("case_id").notNull(),
	version: integer().default(1).notNull(),
	storageKey: text("storage_key").notNull(),
	storageUrl: text("storage_url"),
	format: text().default('markdown'),
	changeNote: text("change_note"),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("report_versions_case_id_version_key").on(table.caseId, table.version),
]);

export const userSessions = pgTable("user_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	token: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
}, (table) => [
	unique("user_sessions_token_key").on(table.token),
]);

export const userProfiles = pgTable("user_profiles", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	interests: text().array().default([""]),
	preferences: jsonb().default({}),
	demographicData: jsonb("demographic_data"),
	behaviorStats: jsonb("behavior_stats"),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("user_profiles_user_id_key").on(table.userId),
]);

export const userPreferences = pgTable("user_preferences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	preferences: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	totalQueries: integer("total_queries").default(0),
	totalRecommendations: integer("total_recommendations").default(0),
	positiveFeedback: integer("positive_feedback").default(0),
	negativeFeedback: integer("negative_feedback").default(0),
	interests: text().array().default(["RAY['科技'::text", "'阅读'::text", "'产品'::tex"]),
}, (table) => [
	unique("user_preferences_user_id_key").on(table.userId),
]);

export const userInteractions = pgTable("user_interactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	interactionType: text("interaction_type").notNull(),
	itemId: text("item_id"),
	itemType: text("item_type").default('recommendation'),
	itemData: jsonb("item_data").default({}),
	context: jsonb().default({}),
	pageUrl: text("page_url"),
	sessionId: uuid("session_id"),
	durationMs: integer("duration_ms"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const userFeedbackExtra = pgTable("user_feedback_extra", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	itemId: text("item_id"),
	itemType: text("item_type").notNull(),
	feedbackType: text("feedback_type").notNull(),
	rating: integer(),
	comment: text(),
	sentimentScore: real("sentiment_score"),
	isAnonymous: boolean("is_anonymous").default(false),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	check("user_feedback_extra_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
]);

export const kgSnapshots = pgTable("kg_snapshots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	caseId: text("case_id"),
	entities: jsonb().default([]).notNull(),
	relations: jsonb().default([]).notNull(),
	metadata: jsonb().default({}),
	entityCount: integer("entity_count").default(0),
	relationCount: integer("relation_count").default(0),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("Allow anonymous write", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Allow anonymous read", { as: "permissive", for: "select", to: ["public"] }),
]);

export const knowledgeDocs = pgTable("knowledge_docs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	content: text(),
	fileUrl: text("file_url"),
	fileType: text("file_type"),
	fileSize: integer("file_size"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	embeddingModel: varchar("embedding_model", { length: 100 }),
	embeddingGeneratedAt: timestamp("embedding_generated_at", { withTimezone: true, mode: 'string' }),
	embedding: vector({ dimensions: 2048 }),
});

export const recommendationHistory = pgTable("recommendation_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	recommendationId: text("recommendation_id").notNull(),
	items: jsonb().notNull(),
	context: jsonb().default({}),
	algorithm: text().default('hybrid'),
	parameters: jsonb().default({}),
	userFeedback: jsonb("user_feedback").default({}),
	impressions: integer().default(0),
	clicks: integer().default(0),
	ctr: real().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("recommendation_history_recommendation_id_key").on(table.recommendationId),
]);

export const qualityReports = pgTable("quality_reports", {
	id: text().primaryKey().notNull(),
	caseId: text("case_id"),
	query: text().notNull(),
	overallScore: integer("overall_score").notNull(),
	grade: text().notNull(),
	dimensionScores: jsonb("dimension_scores").notNull(),
	issues: jsonb().default([]).notNull(),
	criticalIssues: jsonb("critical_issues").default([]).notNull(),
	improvementPriority: jsonb("improvement_priority").default([]).notNull(),
	analysisMetadata: jsonb("analysis_metadata").default({}).notNull(),
	detectedAt: timestamp("detected_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_quality_reports_case_id").using("btree", table.caseId.asc().nullsLast().op("text_ops")),
	index("idx_quality_reports_detected_at").using("btree", table.detectedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_quality_reports_score").using("btree", table.overallScore.asc().nullsLast().op("int4_ops")),
	check("quality_reports_grade_check", sql`grade = ANY (ARRAY['excellent'::text, 'good'::text, 'fair'::text, 'poor'::text, 'critical'::text])`),
]);

export const recommendationEmbeddings = pgTable("recommendation_embeddings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	embeddingType: text("embedding_type").notNull(),
	targetId: uuid("target_id").notNull(),
	embedding: vector({ dimensions: 2048 }).notNull(),
	modelName: text("model_name").notNull(),
	modelVersion: text("model_version"),
	embeddingDim: integer("embedding_dim").default(2048),
	updateFrequency: integer("update_frequency").default(0),
	lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updateReason: text("update_reason"),
	usageCount: integer("usage_count").default(0),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	check("recommendation_embeddings_embedding_type_check", sql`embedding_type = ANY (ARRAY['user'::text, 'item'::text, 'item_content'::text, 'user_preference'::text, 'user_behavior'::text, 'context'::text, 'interaction'::text])`),
]);

export const recommendationCases = pgTable("recommendation_cases", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	caseId: text("case_id").notNull(),
	caseName: text("case_name").notNull(),
	caseType: text("case_type").default('standard').notNull(),
	scenarioId: text("scenario_id"),
	scenarioName: text("scenario_name"),
	scenarioContext: jsonb("scenario_context").default({}),
	userId: uuid("user_id"),
	userContext: jsonb("user_context").default({}),
	algorithm: text(),
	algorithmParams: jsonb("algorithm_params").default({}),
	recommendedItems: jsonb("recommended_items").default([]).notNull(),
	recommendationExplanations: jsonb("recommendation_explanations").default([]),
	diversityScore: real("diversity_score"),
	noveltyScore: real("novelty_score"),
	relevanceScore: real("relevance_score"),
	userFeedback: jsonb("user_feedback").default({}),
	userRating: real("user_rating"),
	userComments: text("user_comments"),
	impressions: integer().default(0),
	clicks: integer().default(0),
	conversions: integer().default(0),
	ctr: real(),
	conversionRate: real("conversion_rate"),
	dwellTimeMs: integer("dwell_time_ms"),
	businessValue: real("business_value"),
	roi: real(),
	status: text().default('completed'),
	outcome: text(),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	insights: jsonb().default({}),
	lessonsLearned: text("lessons_learned"),
	recommendations: text(),
	reusable: boolean().default(false),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_rec_cases_algorithm").using("btree", table.algorithm.asc().nullsLast().op("text_ops")),
	index("idx_rec_cases_case_id").using("btree", table.caseId.asc().nullsLast().op("text_ops")),
	index("idx_rec_cases_ctr").using("btree", table.ctr.desc().nullsFirst().op("float4_ops")),
	index("idx_rec_cases_executed").using("btree", table.executedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_rec_cases_outcome").using("btree", table.outcome.asc().nullsLast().op("text_ops")),
	index("idx_rec_cases_reusable").using("btree", table.reusable.asc().nullsLast().op("bool_ops")).where(sql`(reusable = true)`),
	index("idx_rec_cases_scenario").using("btree", table.scenarioId.asc().nullsLast().op("text_ops")),
	index("idx_rec_cases_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_rec_cases_type").using("btree", table.caseType.asc().nullsLast().op("text_ops")),
	index("idx_rec_cases_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	unique("recommendation_cases_case_id_key").on(table.caseId),
	check("recommendation_cases_case_type_check", sql`case_type = ANY (ARRAY['standard'::text, 'experiment'::text, 'ab_test'::text, 'optimization'::text, 'failure'::text])`),
	check("recommendation_cases_outcome_check", sql`outcome = ANY (ARRAY['success'::text, 'partial'::text, 'failure'::text, 'unknown'::text])`),
	check("recommendation_cases_status_check", sql`status = ANY (ARRAY['draft'::text, 'running'::text, 'completed'::text, 'failed'::text])`),
	check("recommendation_cases_user_rating_check", sql`(user_rating >= (1)::double precision) AND (user_rating <= (5)::double precision)`),
]);

export const recommendationAlgorithms = pgTable("recommendation_algorithms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	algorithmId: text("algorithm_id").notNull(),
	name: text().notNull(),
	type: text().notNull(),
	description: text(),
	version: text().default('1.0.0'),
	author: text(),
	defaultParams: jsonb("default_params").default({}),
	requiredParams: text("required_params").array().default([""]),
	optionalParams: text("optional_params").array().default([""]),
	enabled: boolean().default(true),
	maxConcurrentRequests: integer("max_concurrent_requests").default(100),
	timeoutMs: integer("timeout_ms").default(5000),
	cacheTtlSeconds: integer("cache_ttl_seconds").default(3600),
	minQualityScore: real("min_quality_score").default(0.5),
	diversityFactor: real("diversity_factor").default(0.3),
	noveltyFactor: real("novelty_factor").default(0.3),
	dependsOn: text("depends_on").array().default([""]),
	dataSources: text("data_sources").array().default([""]),
	isInAbTest: boolean("is_in_ab_test").default(false),
	testGroup: text("test_group"),
	testPercentage: real("test_percentage").default(0),
	status: text().default('active'),
	totalCalls: integer("total_calls").default(0),
	totalErrors: integer("total_errors").default(0),
	avgResponseTimeMs: real("avg_response_time_ms"),
	avgCtr: real("avg_ctr"),
	avgConversionRate: real("avg_conversion_rate"),
	lastPerformanceAt: timestamp("last_performance_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_rec_algorithms_ab_test").using("btree", table.isInAbTest.asc().nullsLast().op("bool_ops")).where(sql`(is_in_ab_test = true)`),
	index("idx_rec_algorithms_algorithm_id").using("btree", table.algorithmId.asc().nullsLast().op("text_ops")),
	index("idx_rec_algorithms_status").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status = 'active'::text)`),
	index("idx_rec_algorithms_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	unique("recommendation_algorithms_algorithm_id_key").on(table.algorithmId),
	check("recommendation_algorithms_status_check", sql`status = ANY (ARRAY['active'::text, 'testing'::text, 'deprecated'::text, 'disabled'::text])`),
	check("recommendation_algorithms_type_check", sql`type = ANY (ARRAY['collaborative_filtering'::text, 'content_based'::text, 'hybrid'::text, 'knowledge_graph'::text, 'deep_learning'::text, 'rule_based'::text, 'llm_enhanced'::text, 'custom'::text])`),
]);

export const recommendationKnowledge = pgTable("recommendation_knowledge", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	content: text(),
	knowledgeType: text("knowledge_type").default('general').notNull(),
	sourceType: text("source_type").default('manual'),
	fileUrl: text("file_url"),
	fileType: text("file_type"),
	fileSize: integer("file_size"),
	tags: text().array().default([""]),
	categories: text().array().default([""]),
	author: text(),
	version: integer().default(1),
	status: text().default('active'),
	usageCount: integer("usage_count").default(0),
	lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true, mode: 'string' }),
	embedding: vector({ dimensions: 2048 }),
	embeddingModel: text("embedding_model"),
	embeddingGeneratedAt: timestamp("embedding_generated_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	check("recommendation_knowledge_knowledge_type_check", sql`knowledge_type = ANY (ARRAY['general'::text, 'strategy'::text, 'domain'::text, 'rule'::text, 'explanation'::text, 'best_practice'::text])`),
	check("recommendation_knowledge_source_type_check", sql`source_type = ANY (ARRAY['manual'::text, 'llm'::text, 'import'::text])`),
	check("recommendation_knowledge_status_check", sql`status = ANY (ARRAY['active'::text, 'archived'::text, 'deprecated'::text])`),
]);

export const recommendationItems = pgTable("recommendation_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	itemId: text("item_id").notNull(),
	itemType: text("item_type").notNull(),
	title: text().notNull(),
	description: text(),
	contentPreview: text("content_preview"),
	thumbnailUrl: text("thumbnail_url"),
	category: text(),
	subcategory: text(),
	tags: text().array().default([""]),
	keywords: text().array().default([""]),
	qualityScore: real("quality_score").default(0.5),
	popularityScore: real("popularity_score").default(0),
	relevanceScore: real("relevance_score").default(0.5),
	freshnessScore: real("freshness_score").default(0.5),
	viewCount: integer("view_count").default(0),
	clickCount: integer("click_count").default(0),
	likeCount: integer("like_count").default(0),
	bookmarkCount: integer("bookmark_count").default(0),
	shareCount: integer("share_count").default(0),
	avgRating: real("avg_rating"),
	ratingCount: integer("rating_count").default(0),
	status: text().default('active'),
	featured: boolean().default(false),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	contentEmbedding: vector("content_embedding", { dimensions: 2048 }),
	embeddingModel: text("embedding_model"),
	embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true, mode: 'string' }),
	properties: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("recommendation_items_item_id_key").on(table.itemId),
	check("recommendation_items_item_type_check", sql`item_type = ANY (ARRAY['knowledge'::text, 'entity'::text, 'report'::text, 'case'::text, 'scenario'::text, 'article'::text, 'dataset'::text])`),
	check("recommendation_items_quality_score_check", sql`(quality_score >= (0)::double precision) AND (quality_score <= (1)::double precision)`),
	check("recommendation_items_status_check", sql`status = ANY (ARRAY['active'::text, 'hidden'::text, 'archived'::text, 'deleted'::text])`),
]);

export const recommendationScenarios = pgTable("recommendation_scenarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	scenarioId: text("scenario_id").notNull(),
	name: text().notNull(),
	description: text(),
	category: text().notNull(),
	priority: integer().default(0),
	context: jsonb().default({}),
	constraints: jsonb().default({}),
	filters: jsonb().default({}),
	defaultAlgorithm: text("default_algorithm"),
	availableAlgorithms: text("available_algorithms").array().default([""]),
	fallbackAlgorithm: text("fallback_algorithm"),
	minDiversity: real("min_diversity").default(0.3),
	minNovelty: real("min_novelty").default(0.3),
	maxRepeatRatio: real("max_repeat_ratio").default(0.2),
	maxItemAgeDays: integer("max_item_age_days"),
	refreshIntervalHours: integer("refresh_interval_hours").default(24),
	targetCtr: real("target_ctr"),
	targetConversionRate: real("target_conversion_rate"),
	targetDwellTimeMs: integer("target_dwell_time_ms"),
	status: text().default('active'),
	totalRecommendations: integer("total_recommendations").default(0),
	avgCtr: real("avg_ctr"),
	avgConversionRate: real("avg_conversion_rate"),
	isAbTest: boolean("is_ab_test").default(false),
	testGroup: text("test_group"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_rec_scenarios_ab_test").using("btree", table.isAbTest.asc().nullsLast().op("bool_ops")).where(sql`(is_ab_test = true)`),
	index("idx_rec_scenarios_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_rec_scenarios_priority").using("btree", table.priority.desc().nullsFirst().op("int4_ops")),
	index("idx_rec_scenarios_scenario_id").using("btree", table.scenarioId.asc().nullsLast().op("text_ops")),
	index("idx_rec_scenarios_status").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status = 'active'::text)`),
	unique("recommendation_scenarios_scenario_id_key").on(table.scenarioId),
	check("recommendation_scenarios_min_diversity_check", sql`(min_diversity >= (0)::double precision) AND (min_diversity <= (1)::double precision)`),
	check("recommendation_scenarios_min_novelty_check", sql`(min_novelty >= (0)::double precision) AND (min_novelty <= (1)::double precision)`),
	check("recommendation_scenarios_status_check", sql`status = ANY (ARRAY['active'::text, 'paused'::text, 'disabled'::text, 'archived'::text])`),
]);

export const userFeedback = pgTable("user_feedback", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	caseId: varchar("case_id", { length: 255 }),
	feedbackType: varchar("feedback_type", { length: 20 }).notNull(),
	rating: integer(),
	comment: text(),
	context: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	check("user_feedback_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
]);

export const analysisFeedback = pgTable("analysis_feedback", {
	id: text().primaryKey().notNull(),
	caseId: text("case_id").notNull(),
	userId: text("user_id"),
	type: text().notNull(),
	rating: integer(),
	thumbsUp: boolean("thumbs_up"),
	dimensionRatings: jsonb("dimension_ratings"),
	correction: jsonb(),
	suggestion: jsonb(),
	preference: jsonb(),
	qualityReportId: text("quality_report_id"),
	comment: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_analysis_feedback_case_id").using("btree", table.caseId.asc().nullsLast().op("text_ops")),
	index("idx_analysis_feedback_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_analysis_feedback_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("idx_analysis_feedback_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.qualityReportId],
			foreignColumns: [qualityReports.id],
			name: "fk_quality_report"
		}).onDelete("set null"),
	check("analysis_feedback_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
	check("analysis_feedback_type_check", sql`type = ANY (ARRAY['rating'::text, 'thumbs'::text, 'dimension_rating'::text, 'correction'::text, 'suggestion'::text, 'preference'::text])`),
]);

export const caseEmbeddings = pgTable("case_embeddings", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	caseId: varchar("case_id", { length: 36 }).notNull(),
	embeddingType: varchar("embedding_type", { length: 30 }).notNull(),
	embedding: jsonb().notNull(),
	model: varchar({ length: 100 }).notNull(),
	textPreview: text("text_preview"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("case_embeddings_case_id_idx").using("btree", table.caseId.asc().nullsLast().op("text_ops")),
	index("case_embeddings_model_idx").using("btree", table.model.asc().nullsLast().op("text_ops")),
	index("case_embeddings_type_idx").using("btree", table.embeddingType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.caseId],
			foreignColumns: [analysisCases.id],
			name: "case_embeddings_case_id_analysis_cases_id_fk"
		}),
	pgPolicy("case_embeddings_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("case_embeddings_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("case_embeddings_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("case_embeddings_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const analysisCases = pgTable("analysis_cases", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	query: text().notNull(),
	domain: varchar({ length: 50 }).notNull(),
	finalReport: text("final_report"),
	conclusion: jsonb(),
	timeline: jsonb(),
	keyFactors: jsonb("key_factors"),
	scenarios: jsonb(),
	causalChains: jsonb("causal_chains"),
	confidence: numeric({ precision: 3, scale:  2 }),
	agentOutputs: jsonb("agent_outputs"),
	qualityScore: numeric("quality_score", { precision: 3, scale:  2 }),
	userRating: integer("user_rating"),
	feedbackCount: integer("feedback_count").default(0),
	tags: jsonb().default([]),
	status: varchar({ length: 20 }).default('completed'),
	analyzedAt: timestamp("analyzed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("analysis_cases_analyzed_at_idx").using("btree", table.analyzedAt.asc().nullsLast().op("timestamptz_ops")),
	index("analysis_cases_domain_idx").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	index("analysis_cases_quality_score_idx").using("btree", table.qualityScore.asc().nullsLast().op("numeric_ops")),
	index("analysis_cases_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("analysis_cases_tags_idx").using("btree", table.tags.asc().nullsLast().op("jsonb_ops")),
	pgPolicy("analysis_cases_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("analysis_cases_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("analysis_cases_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("analysis_cases_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const experimentRuns = pgTable("experiment_runs", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	experimentId: varchar("experiment_id", { length: 36 }).notNull(),
	caseId: varchar("case_id", { length: 36 }),
	variant: varchar({ length: 20 }).notNull(),
	inputData: jsonb("input_data"),
	outputData: jsonb("output_data"),
	metrics: jsonb(),
	durationMs: integer("duration_ms"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("experiment_runs_case_id_idx").using("btree", table.caseId.asc().nullsLast().op("text_ops")),
	index("experiment_runs_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("experiment_runs_experiment_id_idx").using("btree", table.experimentId.asc().nullsLast().op("text_ops")),
	index("experiment_runs_variant_idx").using("btree", table.variant.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.caseId],
			foreignColumns: [analysisCases.id],
			name: "experiment_runs_case_id_analysis_cases_id_fk"
		}),
	foreignKey({
			columns: [table.experimentId],
			foreignColumns: [abExperiments.id],
			name: "experiment_runs_experiment_id_ab_experiments_id_fk"
		}),
	pgPolicy("experiment_runs_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("experiment_runs_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("experiment_runs_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("experiment_runs_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const abExperiments = pgTable("ab_experiments", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	experimentType: varchar("experiment_type", { length: 50 }).notNull(),
	controlConfig: jsonb("control_config").notNull(),
	treatmentConfig: jsonb("treatment_config").notNull(),
	trafficSplit: jsonb("traffic_split").default({"control":50,"treatment":50}),
	targetCriteria: jsonb("target_criteria"),
	status: varchar({ length: 20 }).default('draft'),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	results: jsonb(),
	statisticalSignificance: numeric("statistical_significance", { precision: 5, scale:  4 }),
	sampleSize: integer("sample_size").default(0),
	confidenceLevel: numeric("confidence_level", { precision: 3, scale:  2 }).default('0.95'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("ab_experiments_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("ab_experiments_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("ab_experiments_type_idx").using("btree", table.experimentType.asc().nullsLast().op("text_ops")),
	pgPolicy("ab_experiments_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("ab_experiments_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("ab_experiments_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("ab_experiments_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const kgRelations = pgTable("kg_relations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sourceEntityId: uuid("source_entity_id"),
	targetEntityId: uuid("target_entity_id"),
	type: varchar({ length: 50 }).notNull(),
	confidence: numeric({ precision: 3, scale:  2 }).default('0.5'),
	evidence: text(),
	properties: jsonb().default({}),
	sourceType: varchar("source_type", { length: 20 }).default('llm'),
	verified: boolean().default(false),
	validFrom: date("valid_from"),
	validTo: date("valid_to"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_kg_relations_source").using("btree", table.sourceEntityId.asc().nullsLast().op("uuid_ops")),
	index("idx_kg_relations_target").using("btree", table.targetEntityId.asc().nullsLast().op("uuid_ops")),
	index("idx_kg_relations_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("idx_kg_relations_verified").using("btree", table.verified.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.sourceEntityId],
			foreignColumns: [kgEntities.id],
			name: "kg_relations_source_entity_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.targetEntityId],
			foreignColumns: [kgEntities.id],
			name: "kg_relations_target_entity_id_fkey"
		}).onDelete("cascade"),
	unique("kg_relations_source_entity_id_target_entity_id_type_key").on(table.sourceEntityId, table.targetEntityId, table.type),
	pgPolicy("Allow anonymous write", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Allow anonymous read", { as: "permissive", for: "select", to: ["public"] }),
]);

export const kgCorrections = pgTable("kg_corrections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	entityId: uuid("entity_id"),
	relationId: uuid("relation_id"),
	changeType: varchar("change_type", { length: 50 }).notNull(),
	oldValue: jsonb("old_value"),
	newValue: jsonb("new_value"),
	reason: text(),
	correctedBy: varchar("corrected_by", { length: 100 }),
	correctedAt: timestamp("corrected_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_kg_corrections_relation").using("btree", table.relationId.asc().nullsLast().op("uuid_ops")),
	index("idx_kg_corrections_time").using("btree", table.correctedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.entityId],
			foreignColumns: [kgEntities.id],
			name: "kg_corrections_entity_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.relationId],
			foreignColumns: [kgRelations.id],
			name: "kg_corrections_relation_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Allow anonymous write", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Allow anonymous read", { as: "permissive", for: "select", to: ["public"] }),
]);

export const optimizations = pgTable("optimizations", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	caseId: varchar("case_id", { length: 36 }),
	optimizationType: varchar("optimization_type", { length: 50 }).notNull(),
	description: text().notNull(),
	beforeState: jsonb("before_state"),
	afterState: jsonb("after_state"),
	improvementScore: numeric("improvement_score", { precision: 5, scale:  2 }),
	validationStatus: varchar("validation_status", { length: 20 }).default('pending'),
	validationResults: jsonb("validation_results"),
	isApplied: boolean("is_applied").default(false),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("optimizations_case_id_idx").using("btree", table.caseId.asc().nullsLast().op("text_ops")),
	index("optimizations_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("optimizations_status_idx").using("btree", table.validationStatus.asc().nullsLast().op("text_ops")),
	index("optimizations_type_idx").using("btree", table.optimizationType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.caseId],
			foreignColumns: [analysisCases.id],
			name: "optimizations_case_id_analysis_cases_id_fk"
		}),
	pgPolicy("optimizations_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("optimizations_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("optimizations_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("optimizations_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const userFeedbacks = pgTable("user_feedbacks", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	caseId: varchar("case_id", { length: 36 }).notNull(),
	feedbackType: varchar("feedback_type", { length: 30 }).notNull(),
	rating: integer(),
	comment: text(),
	correction: text(),
	aspects: jsonb(),
	userContext: jsonb("user_context"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_feedbacks_case_id_idx").using("btree", table.caseId.asc().nullsLast().op("text_ops")),
	index("user_feedbacks_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("user_feedbacks_feedback_type_idx").using("btree", table.feedbackType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.caseId],
			foreignColumns: [analysisCases.id],
			name: "user_feedbacks_case_id_analysis_cases_id_fk"
		}),
	pgPolicy("user_feedbacks_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("user_feedbacks_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("user_feedbacks_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("user_feedbacks_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const knowledgePatterns = pgTable("knowledge_patterns", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	patternType: varchar("pattern_type", { length: 50 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	patternData: jsonb("pattern_data").notNull(),
	occurrenceCount: integer("occurrence_count").default(0),
	successRate: numeric("success_rate", { precision: 3, scale:  2 }),
	sourceCaseIds: jsonb("source_case_ids").default([]),
	isVerified: boolean("is_verified").default(false),
	confidence: numeric({ precision: 3, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("knowledge_patterns_occurrence_idx").using("btree", table.occurrenceCount.asc().nullsLast().op("int4_ops")),
	index("knowledge_patterns_type_idx").using("btree", table.patternType.asc().nullsLast().op("text_ops")),
	index("knowledge_patterns_verified_idx").using("btree", table.isVerified.asc().nullsLast().op("bool_ops")),
	pgPolicy("knowledge_patterns_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("knowledge_patterns_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("knowledge_patterns_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("knowledge_patterns_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const kgEntities = pgTable("kg_entities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	type: varchar({ length: 50 }).default('公司').notNull(),
	aliases: text().array().default([""]),
	description: text(),
	importance: numeric({ precision: 3, scale:  2 }).default('0.5'),
	properties: jsonb().default({}),
	sourceType: varchar("source_type", { length: 20 }).default('llm'),
	verified: boolean().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	embeddingModel: varchar("embedding_model", { length: 100 }),
	embeddingGeneratedAt: timestamp("embedding_generated_at", { withTimezone: true, mode: 'string' }),
	embedding: vector({ dimensions: 2048 }),
}, (table) => [
	index("idx_kg_entities_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_kg_entities_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("idx_kg_entities_verified").using("btree", table.verified.asc().nullsLast().op("bool_ops")),
	unique("kg_entities_name_unique").on(table.name),
	pgPolicy("Allow anonymous write", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Allow anonymous read", { as: "permissive", for: "select", to: ["public"] }),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text(),
	username: text(),
	passwordHash: text("password_hash"),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	bio: text(),
	role: text().default('user'),
	isActive: boolean("is_active").default(true),
	emailVerified: boolean("email_verified").default(false),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_key").on(table.email),
	unique("users_username_key").on(table.username),
	check("users_role_check", sql`role = ANY (ARRAY['user'::text, 'admin'::text])`),
]);

export const ppoTrainingHistory = pgTable("ppo_training_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: text("session_id").notNull(),
	epoch: integer().notNull(),
	hyperparams: jsonb().notNull(),
	metrics: jsonb().notNull(),
	adaptation: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ppo_training_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_ppo_training_session").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
]);

export const ppoHyperparamEffects = pgTable("ppo_hyperparam_effects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	versionId: uuid("version_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usageDuration: bigint("usage_duration", { mode: "number" }).default(0),
	metrics: jsonb().notNull(),
	feedback: jsonb(),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.versionId],
			foreignColumns: [ppoHyperparamVersions.id],
			name: "ppo_hyperparam_effects_version_id_fkey"
		}),
]);

export const ppoHyperparamKnowledge = pgTable("ppo_hyperparam_knowledge", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	knowledgeType: varchar("knowledge_type", { length: 20 }).notNull(),
	paramName: varchar("param_name", { length: 50 }).notNull(),
	knowledge: jsonb().notNull(),
	confidence: real().default(0.5).notNull(),
	sampleCount: integer("sample_count").default(0),
	successCount: integer("success_count").default(0),
	source: varchar({ length: 20 }).default('learned'),
	lastUpdated: timestamp("last_updated", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ppo_knowledge_param").using("btree", table.paramName.asc().nullsLast().op("text_ops")),
	index("idx_ppo_knowledge_type").using("btree", table.knowledgeType.asc().nullsLast().op("text_ops")),
	unique("ppo_hyperparam_knowledge_knowledge_type_param_name_key").on(table.knowledgeType, table.paramName),
	check("ppo_hyperparam_knowledge_knowledge_type_check", sql`(knowledge_type)::text = ANY ((ARRAY['correlation'::character varying, 'pattern'::character varying, 'constraint'::character varying, 'best_practice'::character varying])::text[])`),
	check("ppo_hyperparam_knowledge_confidence_check", sql`(confidence >= (0)::double precision) AND (confidence <= (1)::double precision)`),
	check("ppo_hyperparam_knowledge_source_check", sql`(source)::text = ANY ((ARRAY['learned'::character varying, 'expert'::character varying, 'literature'::character varying])::text[])`),
]);

export const ppoAdjustmentRules = pgTable("ppo_adjustment_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ruleName: varchar("rule_name", { length: 100 }).notNull(),
	triggerCondition: jsonb("trigger_condition").notNull(),
	adjustmentAction: jsonb("adjustment_action").notNull(),
	priority: integer().default(100),
	enabled: boolean().default(true),
	expertVerified: boolean("expert_verified").default(false),
	stats: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("ppo_adjustment_rules_rule_name_key").on(table.ruleName),
]);

export const ppoHyperparamVersions = pgTable("ppo_hyperparam_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	version: integer().notNull(),
	config: jsonb().notNull(),
	performance: jsonb(),
	isActive: boolean("is_active").default(false),
	isVerified: boolean("is_verified").default(false),
	source: varchar({ length: 20 }).default('auto'),
	parentVersion: integer("parent_version"),
	tags: text().array().default([""]),
	notes: text(),
	createdBy: text("created_by").default('system'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ppo_versions_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_ppo_versions_version").using("btree", table.version.asc().nullsLast().op("int4_ops")),
	unique("ppo_hyperparam_versions_version_key").on(table.version),
]);

export const recommendationFeedbacks = pgTable("recommendation_feedbacks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	recommendationId: text("recommendation_id").notNull(),
	itemId: text("item_id").notNull(),
	itemTitle: text("item_title"),
	itemType: text("item_type").default('knowledge'),
	feedbackType: varchar("feedback_type", { length: 20 }).notNull(),
	rating: integer(),
	satisfied: boolean(),
	comment: text(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_rec_feedback_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_rec_feedback_item_id").using("btree", table.itemId.asc().nullsLast().op("text_ops")),
	index("idx_rec_feedback_recommendation_id").using("btree", table.recommendationId.asc().nullsLast().op("text_ops")),
	index("idx_rec_feedback_type").using("btree", table.feedbackType.asc().nullsLast().op("text_ops")),
	index("idx_rec_feedback_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("Allow read for own data or anonymous", { as: "permissive", for: "select", to: ["public"], using: sql`((user_id IS NULL) OR ((auth.uid())::text = user_id))` }),
	pgPolicy("Allow anonymous insert for own data", { as: "permissive", for: "insert", to: ["public"] }),
]);
