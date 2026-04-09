/**
 * PPO 模块入口
 * 
 * 导出所有 PPO 相关的类型和类
 */

// 类型定义
export * from './types';

// 神经网络
export { PolicyNetwork, ValueNetwork, AdamOptimizer } from './network';

// 状态编码和奖励计算
export { StateEncoder, RewardCalculator, ActionDecoder } from './state-encoder';

// PPO 优化器
export { PPOOptimizer } from './optimizer';

// 自适应超参数调整
export { AdaptiveHyperparamAdjuster, getAdaptiveAdjuster, resetAdaptiveAdjuster, DEFAULT_ADAPTIVE_CONFIG } from './adaptive-hyperparams';
export type {
  AdaptiveHyperparamConfig,
  CurrentHyperparams,
  PerformanceTracker,
  AdaptationHistory,
  AdaptationResult
} from './adaptive-hyperparams';
export { AdaptationStrategy } from './adaptive-hyperparams';

// 创建默认实例的工厂函数
import type { PPOConfig } from './types';
import { PPOOptimizer } from './optimizer';
import type { AdaptiveHyperparamConfig } from './adaptive-hyperparams';

/**
 * 创建 PPO 优化器实例
 */
export function createPPOOptimizer(
  config?: Partial<PPOConfig>,
  adaptiveConfig?: Partial<AdaptiveHyperparamConfig>
): PPOOptimizer {
  return new PPOOptimizer(config, adaptiveConfig);
}

/**
 * 创建轻量级 PPO 优化器（用于快速响应）
 */
export function createLightPPOOptimizer(): PPOOptimizer {
  return new PPOOptimizer({
    stateDim: 24,
    hiddenDims: [64, 32],
    batchSize: 32,
    epochs: 5,
    bufferSize: 5000
  });
}

/**
 * 创建高精度 PPO 优化器（用于离线训练）
 */
export function createHighPrecisionPPOOptimizer(): PPOOptimizer {
  return new PPOOptimizer({
    stateDim: 64,
    hiddenDims: [256, 128, 64],
    batchSize: 128,
    epochs: 20,
    bufferSize: 50000,
    learningRate: 1e-4
  });
}
