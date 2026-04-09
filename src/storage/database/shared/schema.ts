import { pgTable, index, pgPolicy, varchar, text, jsonb, timestamp, numeric, integer, serial, foreignKey, boolean, uuid, unique, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



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

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

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
			columns: [table.experimentId],
			foreignColumns: [abExperiments.id],
			name: "experiment_runs_experiment_id_ab_experiments_id_fk"
		}),
	foreignKey({
			columns: [table.caseId],
			foreignColumns: [analysisCases.id],
			name: "experiment_runs_case_id_analysis_cases_id_fk"
		}),
	pgPolicy("experiment_runs_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("experiment_runs_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("experiment_runs_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("experiment_runs_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
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
}, (table) => [
	index("idx_kg_entities_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_kg_entities_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("idx_kg_entities_verified").using("btree", table.verified.asc().nullsLast().op("bool_ops")),
	pgPolicy("Allow anonymous write", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
	pgPolicy("Allow anonymous read", { as: "permissive", for: "select", to: ["public"] }),
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

export const userPreferences = pgTable("user_preferences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	preferences: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("user_preferences_user_id_key").on(table.userId),
]);

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
});
