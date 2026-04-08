/**
 * PPO（Proximal Policy Optimization）类型定义
 * 
 * 用于强化学习优化推荐策略权重
 */

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 推荐状态（PPO观测空间）
 */
export interface RecommendationState {
  // 用户特征
  userId: string;
  userFeatures: {
    activeLevel: number;        // 活跃度 (0-1)
    diversityPreference: number; // 多样性偏好 (0-1)
    avgSessionLength: number;   // 平均会话时长(归一化)
    clickThroughRate: number;   // 历史CTR
    conversionRate: number;     // 转化率
  };
  
  // 场景特征
  scenarioFeatures: {
    scenarioType: string;       // 场景类型
    itemPoolSize: number;       // 候选池大小(归一化)
    timeOfDay: number;          // 时间特征(归一化)
    dayOfWeek: number;          // 星期特征(归一化)
  };
  
  // 历史统计
  historyStats: {
    recentCtr: number;          // 近期CTR
    recentSatisfaction: number; // 近期满意度
    strategyPerformance: Record<string, number>; // 各策略历史表现
  };
  
  // 当前配置
  currentConfig: {
    strategyWeights: StrategyWeights;
    diversityWeight: number;
    noveltyWeight: number;
    serendipityWeight: number;
    minScoreThreshold: number;
  };
}

/**
 * 策略权重向量（PPO动作空间）
 */
export interface StrategyWeights {
  content_based: number;      // 基于内容
  collaborative: number;      // 协同过滤
  knowledge_based: number;    // 知识图谱
  agent_based: number;        // 智能体驱动
  causal_based: number;       // 因果推断
}

/**
 * PPO动作
 */
export interface PPOAction {
  strategyWeights: StrategyWeights;
  diversityWeight: number;
  noveltyWeight: number;
  serendipityWeight: number;
  minScoreThreshold: number;
}

/**
 * 用户反馈（奖励信号来源）
 */
export interface UserFeedbackSignal {
  type: 'click' | 'like' | 'purchase' | 'dislike' | 'skip' | 'dwell';
  value: number;              // 反馈值（点击=1, 购买=5, 跳过=-1等）
  itemId: string;
  timestamp: number;
  context?: {
    position: number;         // 推荐位置
    strategy: string;         // 使用的策略
    explanationType: string;  // 解释类型
  };
}

/**
 * 奖励计算配置
 */
export interface RewardConfig {
  // 行为奖励权重
  clickWeight: number;
  likeWeight: number;
  purchaseWeight: number;
  dislikeWeight: number;
  skipWeight: number;
  dwellWeight: number;
  
  // 位置衰减
  positionDecay: number;
  
  // 多样性奖励
  diversityBonus: number;
  
  // 新颖性奖励
  noveltyBonus: number;
  
  // 时间衰减
  timeDecay: number;
}

/**
 * 默认奖励配置
 */
export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  clickWeight: 1.0,
  likeWeight: 2.0,
  purchaseWeight: 5.0,
  dislikeWeight: -2.0,
  skipWeight: -0.5,
  dwellWeight: 0.1,
  positionDecay: 0.8,
  diversityBonus: 0.5,
  noveltyBonus: 0.3,
  timeDecay: 0.95
};

/**
 * 训练样本
 */
export interface TrainingSample {
  state: RecommendationState;
  action: PPOAction;
  reward: number;
  nextState: RecommendationState;
  done: boolean;
  logProb: number;            // 动作的对数概率
  value: number;              // 状态价值估计
  advantage?: number;         // 优势函数值
}

/**
 * 训练轨迹
 */
export interface Trajectory {
  samples: TrainingSample[];
  totalReward: number;
  length: number;
  startTime: number;
  endTime: number;
}

/**
 * PPO训练配置
 */
export interface PPOConfig {
  // 网络结构
  stateDim: number;           // 状态维度
  actionDim: number;          // 动作维度
  hiddenDims: number[];       // 隐藏层维度
  
  // PPO参数
  clipEpsilon: number;        // PPO裁剪参数 (通常0.1-0.3)
  gamma: number;              // 折扣因子
  gaeLambda: number;          // GAE参数
  entropyCoef: number;        // 熵正则化系数
  valueCoef: number;          // 价值损失系数
  
  // 训练参数
  learningRate: number;
  batchSize: number;
  epochs: number;             // 每次更新的epoch数
  maxGradNorm: number;        // 梯度裁剪
  
  // 经验回放
  bufferSize: number;
  minSamples: number;         // 最小训练样本数
  
  // 动作约束
  actionBounds: {
    min: number;
    max: number;
  };
}

/**
 * 默认PPO配置
 */
export const DEFAULT_PPO_CONFIG: PPOConfig = {
  stateDim: 32,               // 状态向量维度
  actionDim: 9,               // 动作维度（5策略权重 + 3优化权重 + 1阈值）
  hiddenDims: [128, 64, 32],
  clipEpsilon: 0.2,
  gamma: 0.99,
  gaeLambda: 0.95,
  entropyCoef: 0.01,
  valueCoef: 0.5,
  learningRate: 3e-4,
  batchSize: 64,
  epochs: 10,
  maxGradNorm: 0.5,
  bufferSize: 10000,
  minSamples: 256,
  actionBounds: {
    min: 0.0,
    max: 1.0
  }
};

/**
 * 策略网络输出
 */
export interface PolicyOutput {
  action: PPOAction;
  logProb: number;
  entropy: number;
  mean: number[];
  std: number[];
}

/**
 * 价值网络输出
 */
export interface ValueOutput {
  value: number;
}

/**
 * 训练统计
 */
export interface TrainingStats {
  epoch: number;
  policyLoss: number;
  valueLoss: number;
  entropy: number;
  totalLoss: number;
  explainedVariance: number;
  klDivergence: number;
  clipFraction: number;
  timestamp: number;
}

/**
 * PPO模型状态
 */
export interface PPOModelState {
  version: string;
  lastUpdated: number;
  totalSteps: number;
  totalEpisodes: number;
  avgReward: number;
  bestReward: number;
  trainingHistory: TrainingStats[];
}

/**
 * 离线训练数据
 */
export interface OfflineTrainingData {
  userId: string;
  scenario: string;
  state: RecommendationState;
  action: PPOAction;
  feedback: UserFeedbackSignal[];
  reward: number;
  timestamp: number;
}

/**
 * A/B测试配置
 */
export interface PPOTestConfig {
  testId: string;
  testName: string;
  controlGroup: {
    usePPO: false;
    config: Partial<PPOConfig>;
  };
  treatmentGroup: {
    usePPO: true;
    config: Partial<PPOConfig>;
  };
  trafficSplit: number;       // 处理组流量比例
  metrics: string[];
  startDate: number;
  endDate?: number;
}
