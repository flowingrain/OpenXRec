/**
 * 置信度校准模块入口
 * 
 * 导出所有公共API
 */

// 类型
export * from './types';

// 校准器
export { 
  ConfidenceCalibrator, 
  createCalibrator,
  DEFAULT_CALIBRATOR_CONFIG,
} from './calibrator';

// 阈值调整器
export { 
  ThresholdAdjuster, 
  createThresholdAdjuster,
  DEFAULT_THRESHOLD_STRATEGY,
  DEFAULT_THRESHOLDS,
} from './threshold-adjuster';

// 多维度评估器
export { 
  MultiDimensionalEvaluator, 
  createMultiDimensionalEvaluator,
} from './multi-dimensional';

export type { RecommendedItemForAssessment } from './multi-dimensional';

// 服务
export { 
  ConfidenceCalibrationService,
  getCalibrationService,
  createCalibrationService,
  createFeedbackEvent,
} from './service';
