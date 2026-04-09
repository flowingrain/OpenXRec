/**
 * LangGraph 工作流（独立模块）
 *
 * 仅在被显式 import 时加载 @langchain/langgraph，避免推荐 API 打包/执行时触发
 * Webpack 对 ESM 的错误继承链（Class extends undefined）。
 */

import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import type { RecommendationItem, RecommendationContext, UserProfile, ExplanationFactor } from './types';
import {
  intentAnalyzerNode,
  userProfilerNode,
  knowledgeExtractorNode,
  kgBuilderNode,
  itemProfilerNode,
  featureExtractorNode,
  similarityCalculatorNode,
  kgReasonerNode,
  causalReasonerNode,
  rankingAgentNode,
  explanationGeneratorNode,
  diversityOptimizerNode,
  noveltyDetectorNode,
} from './agents-nodes';

export const RecommendationStateAnnotation = Annotation.Root({
  userId: Annotation<string>,
  items: Annotation<RecommendationItem[]>,
  context: Annotation<RecommendationContext>,
  options: Annotation<any>,
  intentAnalysis: Annotation<any>,
  needsClarification: Annotation<boolean>,
  missingInformation: Annotation<string[]>,
  extractedKnowledge: Annotation<any>,
  knowledgeGraph: Annotation<any>,
  causalAnalysis: Annotation<any>,
  userProfile: Annotation<UserProfile>,
  features: Annotation<Map<string, any>>,
  similarities: Annotation<Map<string, number>>,
  rankings: Annotation<Array<{ itemId: string; score: number }>>,
  explanations: Annotation<Map<string, ExplanationFactor[]>>,
  results: Annotation<any[]>,
  error: Annotation<string>,
});

/**
 * 构建推荐工作流图并 compile。
 */
export function buildRecommendationGraph(): StateGraph<any> {
  const workflow = new StateGraph(RecommendationStateAnnotation)
    .addNode('intent_analyzer', intentAnalyzerNode)
    .addNode('user_profiler', userProfilerNode)
    .addNode('knowledge_extractor', knowledgeExtractorNode)
    .addNode('kg_builder', kgBuilderNode)
    .addNode('item_profiler', itemProfilerNode)
    .addNode('feature_extractor', featureExtractorNode)
    .addNode('similarity_calculator', similarityCalculatorNode)
    .addNode('kg_reasoner', kgReasonerNode)
    .addNode('causal_reasoner', causalReasonerNode)
    .addNode('ranking_agent', rankingAgentNode)
    .addNode('explanation_generator', explanationGeneratorNode)
    .addNode('diversity_optimizer', diversityOptimizerNode)
    .addNode('novelty_detector', noveltyDetectorNode);

  workflow
    .addEdge(START, 'intent_analyzer')
    .addEdge('intent_analyzer', 'user_profiler')
    .addEdge('user_profiler', 'knowledge_extractor')
    .addEdge('knowledge_extractor', 'kg_builder')
    .addEdge('kg_builder', 'item_profiler')
    .addEdge('item_profiler', 'feature_extractor')
    .addEdge('feature_extractor', 'similarity_calculator')
    .addEdge('similarity_calculator', 'kg_reasoner')
    .addEdge('kg_reasoner', 'causal_reasoner')
    .addEdge('causal_reasoner', 'ranking_agent')
    .addEdge('ranking_agent', 'explanation_generator')
    .addEdge('explanation_generator', 'diversity_optimizer')
    .addEdge('diversity_optimizer', 'novelty_detector')
    .addEdge('novelty_detector', END);

  return workflow.compile();
}

export const recommendationGraph = buildRecommendationGraph();
