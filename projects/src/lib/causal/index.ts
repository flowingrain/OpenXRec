/**
 * 因果推断系统模块导出
 */

// 类型定义
export * from './types';

// 因果发现引擎
export { CausalDiscoveryEngine, createCausalDiscoveryEngine } from './discovery-engine';

// 结构化因果模型构建器
export { SCMBuilder, createSCMBuilder } from './scm-builder';

// 因果推断引擎
export { CausalInferenceEngine, createCausalInferenceEngine } from './inference-engine';

// 政策模拟分析器
export { 
  PolicySimulator, 
  createPolicySimulator, 
  createPolicyFromTemplate,
  MONETARY_POLICY_TEMPLATES,
  TRADE_POLICY_TEMPLATES,
  INDUSTRIAL_POLICY_TEMPLATES,
} from './policy-simulator';

// 因果分析统一服务
export { CausalAnalysisService, createCausalAnalysisService } from './causal-service';
