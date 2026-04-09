import { relations } from "drizzle-orm/relations";
import { qualityReports, analysisFeedback, analysisCases, caseEmbeddings, experimentRuns, abExperiments, kgEntities, kgRelations, kgCorrections, optimizations, userFeedbacks, ppoHyperparamVersions, ppoHyperparamEffects } from "./schema";

export const analysisFeedbackRelations = relations(analysisFeedback, ({one}) => ({
	qualityReport: one(qualityReports, {
		fields: [analysisFeedback.qualityReportId],
		references: [qualityReports.id]
	}),
}));

export const qualityReportsRelations = relations(qualityReports, ({many}) => ({
	analysisFeedbacks: many(analysisFeedback),
}));

export const caseEmbeddingsRelations = relations(caseEmbeddings, ({one}) => ({
	analysisCase: one(analysisCases, {
		fields: [caseEmbeddings.caseId],
		references: [analysisCases.id]
	}),
}));

export const analysisCasesRelations = relations(analysisCases, ({many}) => ({
	caseEmbeddings: many(caseEmbeddings),
	experimentRuns: many(experimentRuns),
	optimizations: many(optimizations),
	userFeedbacks: many(userFeedbacks),
}));

export const experimentRunsRelations = relations(experimentRuns, ({one}) => ({
	analysisCase: one(analysisCases, {
		fields: [experimentRuns.caseId],
		references: [analysisCases.id]
	}),
	abExperiment: one(abExperiments, {
		fields: [experimentRuns.experimentId],
		references: [abExperiments.id]
	}),
}));

export const abExperimentsRelations = relations(abExperiments, ({many}) => ({
	experimentRuns: many(experimentRuns),
}));

export const kgRelationsRelations = relations(kgRelations, ({one, many}) => ({
	kgEntity_sourceEntityId: one(kgEntities, {
		fields: [kgRelations.sourceEntityId],
		references: [kgEntities.id],
		relationName: "kgRelations_sourceEntityId_kgEntities_id"
	}),
	kgEntity_targetEntityId: one(kgEntities, {
		fields: [kgRelations.targetEntityId],
		references: [kgEntities.id],
		relationName: "kgRelations_targetEntityId_kgEntities_id"
	}),
	kgCorrections: many(kgCorrections),
}));

export const kgEntitiesRelations = relations(kgEntities, ({many}) => ({
	kgRelations_sourceEntityId: many(kgRelations, {
		relationName: "kgRelations_sourceEntityId_kgEntities_id"
	}),
	kgRelations_targetEntityId: many(kgRelations, {
		relationName: "kgRelations_targetEntityId_kgEntities_id"
	}),
	kgCorrections: many(kgCorrections),
}));

export const kgCorrectionsRelations = relations(kgCorrections, ({one}) => ({
	kgEntity: one(kgEntities, {
		fields: [kgCorrections.entityId],
		references: [kgEntities.id]
	}),
	kgRelation: one(kgRelations, {
		fields: [kgCorrections.relationId],
		references: [kgRelations.id]
	}),
}));

export const optimizationsRelations = relations(optimizations, ({one}) => ({
	analysisCase: one(analysisCases, {
		fields: [optimizations.caseId],
		references: [analysisCases.id]
	}),
}));

export const userFeedbacksRelations = relations(userFeedbacks, ({one}) => ({
	analysisCase: one(analysisCases, {
		fields: [userFeedbacks.caseId],
		references: [analysisCases.id]
	}),
}));

export const ppoHyperparamEffectsRelations = relations(ppoHyperparamEffects, ({one}) => ({
	ppoHyperparamVersion: one(ppoHyperparamVersions, {
		fields: [ppoHyperparamEffects.versionId],
		references: [ppoHyperparamVersions.id]
	}),
}));

export const ppoHyperparamVersionsRelations = relations(ppoHyperparamVersions, ({many}) => ({
	ppoHyperparamEffects: many(ppoHyperparamEffects),
}));