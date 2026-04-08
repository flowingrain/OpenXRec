/**
 * PPO 优化器
 * 
 * 实现完整的PPO训练流程：
 * 1. 经验收集
 * 2. 优势估计（GAE）
 * 3. 策略更新（PPO-Clip）
 * 4. 价值函数更新
 */

import {
  PPOConfig,
  DEFAULT_PPO_CONFIG,
  TrainingSample,
  Trajectory,
  TrainingStats,
  PPOModelState,
  RecommendationState,
  PPOAction,
  UserFeedbackSignal
} from './types';
import { PolicyNetwork, ValueNetwork, AdamOptimizer } from './network';
import { StateEncoder, RewardCalculator } from './state-encoder';
import {
  AdaptiveHyperparamAdjuster,
  AdaptiveHyperparamConfig,
  DEFAULT_ADAPTIVE_CONFIG,
  AdaptationResult,
  CurrentHyperparams
} from './adaptive-hyperparams';

// ============================================================================
// PPO 优化器
// ============================================================================

/**
 * PPO 优化器
 * 
 * 核心算法实现
 */
export class PPOOptimizer {
  private config: PPOConfig;
  private policyNetwork: PolicyNetwork;
  private valueNetwork: ValueNetwork;
  private policyOptimizer: AdamOptimizer;
  private valueOptimizer: AdamOptimizer;
  private stateEncoder: StateEncoder;
  private rewardCalculator: RewardCalculator;
  
  // 自适应超参数调整器
  private adaptiveAdjuster: AdaptiveHyperparamAdjuster;
  private enableAdaptive: boolean = true;
  
  // 经验回放缓冲区
  private replayBuffer: TrainingSample[] = [];
  
  // 训练状态
  private modelState: PPOModelState;
  
  constructor(config: Partial<PPOConfig> = {}, adaptiveConfig?: Partial<AdaptiveHyperparamConfig>) {
    this.config = { ...DEFAULT_PPO_CONFIG, ...config };
    
    // 初始化网络
    this.policyNetwork = new PolicyNetwork(this.config);
    this.valueNetwork = new ValueNetwork(this.config);
    
    // 初始化优化器
    this.policyOptimizer = new AdamOptimizer(this.config.learningRate);
    this.valueOptimizer = new AdamOptimizer(this.config.learningRate);
    
    // 初始化编码器
    this.stateEncoder = new StateEncoder(this.config);
    this.rewardCalculator = new RewardCalculator();
    
    // 初始化自适应调整器
    this.adaptiveAdjuster = new AdaptiveHyperparamAdjuster(adaptiveConfig);
    
    // 初始化模型状态
    this.modelState = {
      version: '1.0.0',
      lastUpdated: Date.now(),
      totalSteps: 0,
      totalEpisodes: 0,
      avgReward: 0,
      bestReward: 0,
      trainingHistory: []
    };
  }
  
  // ===========================================================================
  // 核心训练接口
  // ===========================================================================
  
  /**
   * 选择动作（推理）
   */
  selectAction(state: RecommendationState, deterministic: boolean = false): PPOAction {
    const stateVector = this.stateEncoder.encode(state);
    
    if (deterministic) {
      return this.policyNetwork.getDeterministicAction(stateVector);
    }
    
    const output = this.policyNetwork.sample(stateVector);
    return output.action;
  }
  
  /**
   * 存储经验
   */
  storeExperience(sample: TrainingSample): void {
    this.replayBuffer.push(sample);
    
    // 限制缓冲区大小
    if (this.replayBuffer.length > this.config.bufferSize) {
      this.replayBuffer.shift();
    }
  }
  
  /**
   * 批量存储经验
   */
  storeExperiences(samples: TrainingSample[]): void {
    this.replayBuffer.push(...samples);
    
    // 限制缓冲区大小
    if (this.replayBuffer.length > this.config.bufferSize) {
      this.replayBuffer = this.replayBuffer.slice(-this.config.bufferSize);
    }
  }
  
  /**
   * 训练一个epoch
   */
  async train(samples?: TrainingSample[]): Promise<TrainingStats> {
    const trainingSamples = samples || this.replayBuffer;
    
    if (trainingSamples.length < this.config.minSamples) {
      console.warn(`[PPO] Not enough samples for training: ${trainingSamples.length} < ${this.config.minSamples}`);
      return this.createEmptyStats();
    }
    
    // 应用自适应超参数
    if (this.enableAdaptive) {
      this.applyAdaptiveParams();
    }
    
    // 计算优势
    const advantages = this.computeAdvantages(trainingSamples);
    
    // 归一化优势
    const normalizedAdvantages = this.normalizeAdvantages(advantages);
    
    // 训练统计
    let totalPolicyLoss = 0;
    let totalValueLoss = 0;
    let totalEntropy = 0;
    let totalKl = 0;
    let clipCount = 0;
    
    // 多个epoch训练
    for (let epoch = 0; epoch < this.config.epochs; epoch++) {
      // 打乱数据
      const indices = this.shuffleIndices(trainingSamples.length);
      
      // 分批训练
      for (let i = 0; i < indices.length; i += this.config.batchSize) {
        const batchIndices = indices.slice(i, i + this.config.batchSize);
        const batchSamples = batchIndices.map(idx => trainingSamples[idx]);
        const batchAdvantages = batchIndices.map(idx => normalizedAdvantages[idx]);
        
        // 策略网络更新
        const policyResult = this.updatePolicy(batchSamples, batchAdvantages);
        totalPolicyLoss += policyResult.loss;
        totalEntropy += policyResult.entropy;
        totalKl += policyResult.klDivergence;
        clipCount += policyResult.clipCount;
        
        // 价值网络更新
        const valueResult = this.updateValue(batchSamples);
        totalValueLoss += valueResult.loss;
      }
    }
    
    // 计算平均统计
    const numBatches = Math.ceil(trainingSamples.length / this.config.batchSize) * this.config.epochs;
    const stats: TrainingStats = {
      epoch: this.modelState.totalSteps,
      policyLoss: totalPolicyLoss / numBatches,
      valueLoss: totalValueLoss / numBatches,
      entropy: totalEntropy / numBatches,
      totalLoss: (totalPolicyLoss + totalValueLoss) / numBatches,
      explainedVariance: this.computeExplainedVariance(trainingSamples),
      klDivergence: totalKl / numBatches,
      clipFraction: clipCount / (numBatches * this.config.batchSize),
      timestamp: Date.now()
    };
    
    // 更新状态
    this.modelState.totalSteps++;
    this.modelState.trainingHistory.push(stats);
    this.modelState.lastUpdated = Date.now();
    
    // 保持历史记录在合理范围
    if (this.modelState.trainingHistory.length > 100) {
      this.modelState.trainingHistory = this.modelState.trainingHistory.slice(-100);
    }
    
    // 自适应超参数调整
    if (this.enableAdaptive) {
      const adaptResult = this.adaptiveAdjuster.adapt(stats, this.modelState.avgReward);
      
      if (adaptResult.adapted) {
        console.log(`[PPO Adaptive] ${adaptResult.reason}`);
        adaptResult.recommendations.forEach(rec => console.log(`  - ${rec}`));
        
        // 检查是否应该早停
        const perfStats = this.adaptiveAdjuster.getPerformanceStats();
        if (perfStats.shouldStop) {
          console.warn('[PPO Adaptive] Early stopping triggered');
        }
      }
    }
    
    return stats;
  }
  
  /**
   * 离线训练（从历史数据）
   */
  async trainOffline(
    historicalData: Array<{
      state: RecommendationState;
      action: PPOAction;
      feedback: UserFeedbackSignal[];
    }>
  ): Promise<TrainingStats> {
    const samples: TrainingSample[] = [];
    
    for (let i = 0; i < historicalData.length - 1; i++) {
      const data = historicalData[i];
      const nextData = historicalData[i + 1];
      
      // 计算奖励
      const reward = this.rewardCalculator.calculateSessionReward(
        data.feedback.map(f => ({
          type: f.type,
          position: f.context?.position || 0,
          dwellTime: f.value,
          timestamp: f.timestamp
        }))
      );
      
      // 编码状态
      const stateVector = this.stateEncoder.encode(data.state);
      const nextStatVector = this.stateEncoder.encode(nextData.state);
      const actionArray = this.policyNetwork.actionToArray(data.action);
      
      // 计算logProb和value
      const { logProb } = this.policyNetwork.evaluateActions(stateVector, actionArray);
      const value = this.valueNetwork.forward(stateVector);
      
      samples.push({
        state: data.state,
        action: data.action,
        reward,
        nextState: nextData.state,
        done: i === historicalData.length - 2,
        logProb,
        value,
        advantage: 0 // 将在computeAdvantages中计算
      });
    }
    
    this.storeExperiences(samples);
    return this.train(samples);
  }
  
  // ===========================================================================
  // 内部方法
  // ===========================================================================
  
  /**
   * 计算优势函数（GAE）
   */
  private computeAdvantages(samples: TrainingSample[]): number[] {
    const advantages: number[] = [];
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      
      // 使用GAE公式
      // A(s,a) = Σ γ^λ * δ
      let advantage = 0;
      let gae = 0;
      
      // 简化版：使用TD残差
      const currentValue = sample.value;
      const nextValue = samples[i + 1]?.value || 0;
      const delta = sample.reward + this.config.gamma * nextValue - currentValue;
      
      // GAE计算
      gae = delta;
      for (let j = i + 1; j < Math.min(i + 10, samples.length); j++) {
        const nextDelta = samples[j].reward + 
          this.config.gamma * (samples[j + 1]?.value || 0) - 
          samples[j].value;
        gae += Math.pow(this.config.gamma * this.config.gaeLambda, j - i) * nextDelta;
      }
      
      advantages.push(gae);
    }
    
    return advantages;
  }
  
  /**
   * 归一化优势
   */
  private normalizeAdvantages(advantages: number[]): number[] {
    const mean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
    const variance = advantages.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / advantages.length;
    const std = Math.sqrt(variance) + 1e-8;
    
    return advantages.map(a => (a - mean) / std);
  }
  
  /**
   * 更新策略网络
   */
  private updatePolicy(
    samples: TrainingSample[],
    advantages: number[]
  ): { loss: number; entropy: number; klDivergence: number; clipCount: number } {
    let totalLoss = 0;
    let totalEntropy = 0;
    let totalKl = 0;
    let clipCount = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const advantage = advantages[i];
      
      const stateVector = this.stateEncoder.encode(sample.state);
      const actionArray = this.policyNetwork.actionToArray(sample.action);
      
      // 新策略下的logProb
      const { logProb: newLogProb, entropy } = this.policyNetwork.evaluateActions(stateVector, actionArray);
      
      // 计算重要性比率
      const ratio = Math.exp(newLogProb - sample.logProb);
      
      // PPO-Clip损失
      const clippedRatio = Math.max(
        1 - this.config.clipEpsilon,
        Math.min(1 + this.config.clipEpsilon, ratio)
      );
      
      const unclippedLoss = ratio * advantage;
      const clippedLoss = clippedRatio * advantage;
      const policyLoss = -Math.min(unclippedLoss, clippedLoss);
      
      // 熵奖励
      const entropyLoss = -this.config.entropyCoef * entropy;
      
      totalLoss += policyLoss + entropyLoss;
      totalEntropy += entropy;
      
      // KL散度估计
      const kl = Math.abs(newLogProb - sample.logProb);
      totalKl += kl;
      
      // 统计clip次数
      if (Math.abs(ratio - clippedRatio) > 1e-6) {
        clipCount++;
      }
    }
    
    return {
      loss: totalLoss / samples.length,
      entropy: totalEntropy / samples.length,
      klDivergence: totalKl / samples.length,
      clipCount
    };
  }
  
  /**
   * 更新价值网络
   */
  private updateValue(samples: TrainingSample[]): { loss: number } {
    let totalLoss = 0;
    
    for (const sample of samples) {
      const stateVector = this.stateEncoder.encode(sample.state);
      const predictedValue = this.valueNetwork.forward(stateVector);
      
      // 计算TD目标
      const target = sample.reward + 
        this.config.gamma * (sample.done ? 0 : this.valueNetwork.forward(
          this.stateEncoder.encode(sample.nextState)
        ));
      
      // MSE损失
      const loss = Math.pow(predictedValue - target, 2);
      totalLoss += loss;
    }
    
    return {
      loss: this.config.valueCoef * totalLoss / samples.length
    };
  }
  
  /**
   * 计算解释方差
   */
  private computeExplainedVariance(samples: TrainingSample[]): number {
    const values = samples.map(s => s.value);
    const rewards = samples.map(s => s.reward + 
      this.config.gamma * (s.done ? 0 : this.valueNetwork.forward(
        this.stateEncoder.encode(s.nextState)
      ))
    );
    
    const meanValue = values.reduce((a, b) => a + b, 0) / values.length;
    const meanReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    
    const variance = rewards.reduce((a, b) => a + Math.pow(b - meanReward, 2), 0);
    const residual = rewards.reduce((a, b, i) => a + Math.pow(b - values[i], 2), 0);
    
    return 1 - residual / (variance + 1e-8);
  }
  
  /**
   * 打乱索引
   */
  private shuffleIndices(length: number): number[] {
    const indices = Array.from({ length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }
  
  /**
   * 创建空统计
   */
  private createEmptyStats(): TrainingStats {
    return {
      epoch: this.modelState.totalSteps,
      policyLoss: 0,
      valueLoss: 0,
      entropy: 0,
      totalLoss: 0,
      explainedVariance: 0,
      klDivergence: 0,
      clipFraction: 0,
      timestamp: Date.now()
    };
  }
  
  // ===========================================================================
  // 状态管理
  // ===========================================================================
  
  /**
   * 获取模型状态
   */
  getState(): PPOModelState {
    return { ...this.modelState };
  }
  
  /**
   * 保存模型
   */
  save(): {
    policyNetwork: ReturnType<PolicyNetwork['getParameters']>;
    valueNetwork: ReturnType<ValueNetwork['getParameters']>;
    state: PPOModelState;
    config: PPOConfig;
  } {
    return {
      policyNetwork: this.policyNetwork.getParameters(),
      valueNetwork: this.valueNetwork.getParameters(),
      state: this.modelState,
      config: this.config
    };
  }
  
  /**
   * 加载模型
   */
  load(saved: {
    policyNetwork: ReturnType<PolicyNetwork['getParameters']>;
    valueNetwork: ReturnType<ValueNetwork['getParameters']>;
    state: PPOModelState;
    config: PPOConfig;
  }): void {
    this.policyNetwork.setParameters(saved.policyNetwork);
    this.valueNetwork.setParameters(saved.valueNetwork);
    this.modelState = saved.state;
    this.config = saved.config;
  }
  
  /**
   * 获取缓冲区大小
   */
  getBufferSize(): number {
    return this.replayBuffer.length;
  }
  
  /**
   * 清空缓冲区
   */
  clearBuffer(): void {
    this.replayBuffer = [];
  }
  
  /**
   * 更新奖励统计
   */
  updateRewardStats(reward: number): void {
    this.modelState.avgReward = 
      this.modelState.avgReward * 0.9 + reward * 0.1;
    
    if (reward > this.modelState.bestReward) {
      this.modelState.bestReward = reward;
    }
  }

  // ===========================================================================
  // 服务模式接口（用于独立策略优化服务）
  // ===========================================================================

  /**
   * 获取推荐动作（服务接口）
   * 
   * @param state 推荐状态
   * @param deterministic 是否使用确定性策略
   * @returns 动作和元信息
   */
  getAction(
    state: RecommendationState, 
    deterministic: boolean = false
  ): {
    action: PPOAction;
    logProb: number;
    deterministic: boolean;
  } {
    const stateVector = this.stateEncoder.encode(state);
    
    if (deterministic) {
      const action = this.policyNetwork.getDeterministicAction(stateVector);
      return {
        action,
        logProb: 0,
        deterministic: true
      };
    }
    
    const output = this.policyNetwork.sample(stateVector);
    return {
      action: output.action,
      logProb: output.logProb,
      deterministic: false
    };
  }

  /**
   * 使用配置参数训练（服务接口）
   * 
   * @param epochs 训练轮数
   * @param batchSize 批次大小
   * @returns 训练统计
   */
  async trainWithConfig(
    epochs: number = this.config.epochs,
    batchSize: number = this.config.batchSize
  ): Promise<TrainingStats & { 
    avgPolicyLoss: number; 
    avgValueLoss: number; 
    avgReward: number;
    improvement: number;
  }> {
    if (this.replayBuffer.length < this.config.minSamples) {
      console.warn(`[PPO] Not enough samples: ${this.replayBuffer.length} < ${this.config.minSamples}`);
      return {
        epoch: this.modelState.totalSteps,
        policyLoss: 0,
        valueLoss: 0,
        entropy: 0,
        totalLoss: 0,
        explainedVariance: 0,
        klDivergence: 0,
        clipFraction: 0,
        timestamp: Date.now(),
        avgPolicyLoss: 0,
        avgValueLoss: 0,
        avgReward: this.modelState.avgReward,
        improvement: 0
      };
    }

    // 临时保存原配置
    const originalEpochs = this.config.epochs;
    const originalBatchSize = this.config.batchSize;
    
    // 应用新配置
    this.config.epochs = epochs;
    this.config.batchSize = batchSize;
    
    // 执行训练
    const prevAvgReward = this.modelState.avgReward;
    const stats = await this.train();
    
    // 恢复原配置
    this.config.epochs = originalEpochs;
    this.config.batchSize = originalBatchSize;
    
    // 计算提升
    const improvement = this.modelState.avgReward - prevAvgReward;
    
    return {
      ...stats,
      avgPolicyLoss: stats.policyLoss,
      avgValueLoss: stats.valueLoss,
      avgReward: this.modelState.avgReward,
      improvement
    };
  }

  /**
   * 批量存储经验（服务接口）
   * 
   * @param experiences 经验数组
   */
  storeExperiencesBatch(experiences: Array<{
    state: RecommendationState;
    action: PPOAction;
    reward: number;
    nextState: RecommendationState;
    done: boolean;
  }>): void {
    for (const exp of experiences) {
      const stateVector = this.stateEncoder.encode(exp.state);
      const actionArray = this.policyNetwork.actionToArray(exp.action);
      const { logProb } = this.policyNetwork.evaluateActions(stateVector, actionArray);
      const value = this.valueNetwork.forward(stateVector);
      
      this.storeExperience({
        state: exp.state,
        action: exp.action,
        reward: exp.reward,
        nextState: exp.nextState,
        done: exp.done,
        logProb,
        value
      });
      
      // 更新奖励统计
      this.updateRewardStats(exp.reward);
    }
  }

  /**
   * 从用户反馈生成训练样本
   * 
   * @param feedbacks 用户反馈数组
   * @param states 对应的状态数组
   * @param actions 对应的动作数组
   */
  generateTrainingSamplesFromFeedback(
    feedbacks: UserFeedbackSignal[][],
    states: RecommendationState[],
    actions: PPOAction[]
  ): Array<{
    state: RecommendationState;
    action: PPOAction;
    reward: number;
    nextState: RecommendationState;
    done: boolean;
  }> {
    const samples: Array<{
      state: RecommendationState;
      action: PPOAction;
      reward: number;
      nextState: RecommendationState;
      done: boolean;
    }> = [];

    for (let i = 0; i < feedbacks.length - 1; i++) {
      const sessionFeedbacks = feedbacks[i];
      const reward = this.rewardCalculator.calculateSessionReward(
        sessionFeedbacks.map(f => ({
          type: f.type,
          position: f.context?.position || 0,
          dwellTime: f.value,
          timestamp: f.timestamp
        }))
      );

      samples.push({
        state: states[i],
        action: actions[i],
        reward,
        nextState: states[i + 1],
        done: i === feedbacks.length - 2
      });
    }

    return samples;
  }

  // ===========================================================================
  // 自适应超参数调整接口
  // ===========================================================================

  /**
   * 应用自适应超参数
   */
  private applyAdaptiveParams(): void {
    const params = this.adaptiveAdjuster.getCurrentParams();
    
    // 更新学习率
    this.policyOptimizer.setLearningRate(params.learningRate);
    this.valueOptimizer.setLearningRate(params.learningRate);
    
    // 更新裁剪参数
    this.config.clipEpsilon = params.clipEpsilon;
    
    // 更新熵系数
    this.config.entropyCoef = params.entropyCoef;
    
    // 更新GAE Lambda
    this.config.gaeLambda = params.gaeLambda;
  }

  /**
   * 获取当前超参数
   */
  getCurrentHyperparams(): CurrentHyperparams {
    return this.adaptiveAdjuster.getCurrentParams();
  }

  /**
   * 获取自适应调整历史
   */
  getAdaptationHistory() {
    return this.adaptiveAdjuster.getHistory();
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return this.adaptiveAdjuster.getPerformanceStats();
  }

  /**
   * 启用/禁用自适应调整
   */
  setAdaptiveEnabled(enabled: boolean): void {
    this.enableAdaptive = enabled;
  }

  /**
   * 是否启用自适应调整
   */
  isAdaptiveEnabled(): boolean {
    return this.enableAdaptive;
  }

  /**
   * 重置自适应调整器
   */
  resetAdaptive(): void {
    this.adaptiveAdjuster.reset();
  }
}
