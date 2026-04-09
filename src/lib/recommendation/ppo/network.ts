/**
 * PPO 神经网络实现
 * 
 * 轻量级神经网络实现，无需外部深度学习库
 * 使用纯 TypeScript 实现前馈网络、策略网络、价值网络
 */

import { PPOConfig, PPOAction, StrategyWeights, PolicyOutput, ValueOutput } from './types';

// ============================================================================
// 数学工具函数
// ============================================================================

/**
 * 生成标准正态分布随机数（Box-Muller变换）
 */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Sigmoid 函数
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

/**
 * ReLU 函数
 */
function relu(x: number): number {
  return Math.max(0, x);
}

/**
 * Leaky ReLU 函数
 */
function leakyRelu(x: number, alpha: number = 0.01): number {
  return x > 0 ? x : alpha * x;
}

/**
 * Tanh 函数
 */
function tanh(x: number): number {
  return Math.tanh(x);
}

/**
 * Softmax 函数
 */
function softmax(x: number[]): number[] {
  const maxVal = Math.max(...x);
  const exp = x.map(v => Math.exp(v - maxVal));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(v => v / sum);
}

/**
 * 向量点积
 */
function dot(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/**
 * 矩阵乘法
 */
function matmul(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result: number[][] = [];
  for (let i = 0; i < rows; i++) {
    result[i] = [];
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * 向量外积
 */
function outer(a: number[], b: number[]): number[][] {
  return a.map(ai => b.map(bi => ai * bi));
}

// ============================================================================
// 神经网络层
// ============================================================================

interface Layer {
  weights: number[][];
  biases: number[];
  activation: 'relu' | 'tanh' | 'sigmoid' | 'linear';
}

/**
 * 创建全连接层
 */
function createLayer(inputDim: number, outputDim: number, activation: Layer['activation']): Layer {
  // Xavier 初始化
  const scale = Math.sqrt(2.0 / (inputDim + outputDim));
  const weights: number[][] = [];
  for (let i = 0; i < outputDim; i++) {
    weights[i] = [];
    for (let j = 0; j < inputDim; j++) {
      weights[i][j] = randn() * scale;
    }
  }
  const biases = new Array(outputDim).fill(0);
  return { weights, biases, activation };
}

/**
 * 前向传播单层
 */
function forwardLayer(layer: Layer, input: number[]): { output: number[]; preActivation: number[] } {
  const preActivation = layer.weights.map((w, i) => dot(w, input) + layer.biases[i]);
  
  let output: number[];
  switch (layer.activation) {
    case 'relu':
      output = preActivation.map(relu);
      break;
    case 'tanh':
      output = preActivation.map(tanh);
      break;
    case 'sigmoid':
      output = preActivation.map(sigmoid);
      break;
    default:
      output = [...preActivation];
  }
  
  return { output, preActivation };
}

// ============================================================================
// 策略网络（Actor）
// ============================================================================

/**
 * 策略网络
 * 
 * 输出动作的均值和对数标准差（高斯策略）
 */
export class PolicyNetwork {
  private layers: Layer[] = [];
  private meanLayer: Layer;
  private logStdLayer: Layer;
  private config: PPOConfig;
  
  constructor(config: PPOConfig) {
    this.config = config;
    
    // 创建隐藏层
    let inputDim = config.stateDim;
    for (const hiddenDim of config.hiddenDims) {
      this.layers.push(createLayer(inputDim, hiddenDim, 'tanh'));
      inputDim = hiddenDim;
    }
    
    // 创建输出层（均值）
    this.meanLayer = createLayer(inputDim, config.actionDim, 'sigmoid');
    
    // 创建输出层（对数标准差）
    this.logStdLayer = createLayer(inputDim, config.actionDim, 'linear');
  }
  
  /**
   * 前向传播
   */
  forward(state: number[]): { mean: number[]; logStd: number[]; hidden: number[] } {
    let hidden = state;
    const hiddenStates: number[] = [...state];
    
    // 通过隐藏层
    for (const layer of this.layers) {
      const result = forwardLayer(layer, hidden);
      hidden = result.output;
      hiddenStates.push(...hidden);
    }
    
    // 输出均值（通过sigmoid限制到[0,1]）
    const meanResult = forwardLayer(this.meanLayer, hidden);
    const mean = meanResult.output;
    
    // 输出对数标准差（限制范围防止数值问题）
    const logStdResult = forwardLayer(this.logStdLayer, hidden);
    const logStd = logStdResult.preActivation.map(x => Math.max(-2, Math.min(0.5, x)));
    
    return { mean, logStd, hidden: hiddenStates };
  }
  
  /**
   * 采样动作
   */
  sample(state: number[]): PolicyOutput {
    const { mean, logStd } = this.forward(state);
    const std = logStd.map(s => Math.exp(s));
    
    // 采样
    const noise = std.map(() => randn());
    const rawAction = mean.map((m, i) => m + noise[i] * std[i]);
    
    // 裁剪到动作空间
    const action = rawAction.map(a => 
      Math.max(this.config.actionBounds.min, 
               Math.min(this.config.actionBounds.max, a))
    );
    
    // 计算对数概率
    const logProb = action.reduce((sum, a, i) => {
      const diff = a - mean[i];
      return sum - 0.5 * Math.log(2 * Math.PI) - logStd[i] - 0.5 * (diff * diff) / (std[i] * std[i]);
    }, 0);
    
    // 计算熵
    const entropy = logStd.reduce((sum, s) => sum + s + 0.5 * Math.log(2 * Math.PI * Math.E), 0);
    
    // 转换为动作对象
    const ppoAction = this.arrayToAction(action);
    
    return { action: ppoAction, logProb, entropy, mean, std };
  }
  
  /**
   * 计算给定动作的对数概率
   */
  evaluateActions(state: number[], action: number[]): { logProb: number; entropy: number } {
    const { mean, logStd } = this.forward(state);
    const std = logStd.map(s => Math.exp(s));
    
    const actionArray = action;
    
    // 计算对数概率
    const logProb = actionArray.reduce((sum, a, i) => {
      const diff = a - mean[i];
      return sum - 0.5 * Math.log(2 * Math.PI) - logStd[i] - 0.5 * (diff * diff) / (std[i] * std[i]);
    }, 0);
    
    // 计算熵
    const entropy = logStd.reduce((sum, s) => sum + s + 0.5 * Math.log(2 * Math.PI * Math.E), 0);
    
    return { logProb, entropy };
  }
  
  /**
   * 获取确定性动作（用于推理）
   */
  getDeterministicAction(state: number[]): PPOAction {
    const { mean } = this.forward(state);
    return this.arrayToAction(mean);
  }
  
  /**
   * 数组转动作对象
   */
  private arrayToAction(arr: number[]): PPOAction {
    // 归一化策略权重（确保和为1）
    const weights = arr.slice(0, 5);
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
    const normalizedWeights = weights.map(w => w / weightSum);
    
    return {
      strategyWeights: {
        content_based: normalizedWeights[0],
        collaborative: normalizedWeights[1],
        knowledge_based: normalizedWeights[2],
        agent_based: normalizedWeights[3],
        causal_based: normalizedWeights[4]
      },
      diversityWeight: arr[5],
      noveltyWeight: arr[6],
      serendipityWeight: arr[7],
      minScoreThreshold: arr[8]
    };
  }
  
  /**
   * 动作对象转数组
   */
  actionToArray(action: PPOAction): number[] {
    const w = action.strategyWeights;
    return [
      w.content_based,
      w.collaborative,
      w.knowledge_based,
      w.agent_based,
      w.causal_based,
      action.diversityWeight,
      action.noveltyWeight,
      action.serendipityWeight,
      action.minScoreThreshold
    ];
  }
  
  /**
   * 获取参数（用于保存/加载）
   */
  getParameters(): { layers: Layer[]; meanLayer: Layer; logStdLayer: Layer } {
    return {
      layers: JSON.parse(JSON.stringify(this.layers)),
      meanLayer: JSON.parse(JSON.stringify(this.meanLayer)),
      logStdLayer: JSON.parse(JSON.stringify(this.logStdLayer))
    };
  }
  
  /**
   * 设置参数（用于加载）
   */
  setParameters(params: { layers: Layer[]; meanLayer: Layer; logStdLayer: Layer }): void {
    this.layers = JSON.parse(JSON.stringify(params.layers));
    this.meanLayer = JSON.parse(JSON.stringify(params.meanLayer));
    this.logStdLayer = JSON.parse(JSON.stringify(params.logStdLayer));
  }
}

// ============================================================================
// 价值网络（Critic）
// ============================================================================

/**
 * 价值网络
 * 
 * 估计状态价值 V(s)
 */
export class ValueNetwork {
  private layers: Layer[] = [];
  private outputLayer: Layer;
  private config: PPOConfig;
  
  constructor(config: PPOConfig) {
    this.config = config;
    
    // 创建隐藏层
    let inputDim = config.stateDim;
    for (const hiddenDim of config.hiddenDims) {
      this.layers.push(createLayer(inputDim, hiddenDim, 'tanh'));
      inputDim = hiddenDim;
    }
    
    // 创建输出层（单一值）
    this.outputLayer = createLayer(inputDim, 1, 'linear');
  }
  
  /**
   * 前向传播
   */
  forward(state: number[]): number {
    let hidden = state;
    
    // 通过隐藏层
    for (const layer of this.layers) {
      const result = forwardLayer(layer, hidden);
      hidden = result.output;
    }
    
    // 输出价值
    const output = forwardLayer(this.outputLayer, hidden);
    return output.output[0];
  }
  
  /**
   * 获取参数
   */
  getParameters(): { layers: Layer[]; outputLayer: Layer } {
    return {
      layers: JSON.parse(JSON.stringify(this.layers)),
      outputLayer: JSON.parse(JSON.stringify(this.outputLayer))
    };
  }
  
  /**
   * 设置参数
   */
  setParameters(params: { layers: Layer[]; outputLayer: Layer }): void {
    this.layers = JSON.parse(JSON.stringify(params.layers));
    this.outputLayer = JSON.parse(JSON.stringify(params.outputLayer));
  }
}

// ============================================================================
// 优化器
// ============================================================================

/**
 * Adam 优化器
 */
export class AdamOptimizer {
  private learningRate: number;
  private beta1: number = 0.9;
  private beta2: number = 0.999;
  private epsilon: number = 1e-8;
  private m: Map<string, number[][] | number[]> = new Map();
  private v: Map<string, number[][] | number[]> = new Map();
  private t: number = 0;
  
  constructor(learningRate: number) {
    this.learningRate = learningRate;
  }
  
  /**
   * 设置学习率
   */
  setLearningRate(lr: number): void {
    this.learningRate = lr;
  }
  
  /**
   * 获取学习率
   */
  getLearningRate(): number {
    return this.learningRate;
  }
  
  /**
   * 更新参数
   */
  step(params: Map<string, { weights?: number[][]; biases?: number[] }>, 
       grads: Map<string, { weights?: number[][]; biases?: number[] }>): void {
    this.t++;
    
    for (const [key, param] of params) {
      const grad = grads.get(key);
      if (!grad) continue;
      
      // 更新权重
      if (param.weights && grad.weights) {
        const mKey = `${key}_w_m`;
        const vKey = `${key}_w_v`;
        
        let m = this.m.get(mKey) as number[][] | undefined;
        let v = this.v.get(vKey) as number[][] | undefined;
        
        if (!m || !v) {
          m = param.weights.map(row => row.map(() => 0));
          v = param.weights.map(row => row.map(() => 0));
        }
        
        for (let i = 0; i < param.weights.length; i++) {
          for (let j = 0; j < param.weights[i].length; j++) {
            m[i][j] = this.beta1 * m[i][j] + (1 - this.beta1) * grad.weights![i][j];
            v[i][j] = this.beta2 * v[i][j] + (1 - this.beta2) * grad.weights![i][j] * grad.weights![i][j];
            
            const mHat = m[i][j] / (1 - Math.pow(this.beta1, this.t));
            const vHat = v[i][j] / (1 - Math.pow(this.beta2, this.t));
            
            param.weights[i][j] -= this.learningRate * mHat / (Math.sqrt(vHat) + this.epsilon);
          }
        }
        
        this.m.set(mKey, m);
        this.v.set(vKey, v);
      }
      
      // 更新偏置
      if (param.biases && grad.biases) {
        const mKey = `${key}_b_m`;
        const vKey = `${key}_b_v`;
        
        let m = this.m.get(mKey) as number[] | undefined;
        let v = this.v.get(vKey) as number[] | undefined;
        
        if (!m || !v) {
          m = param.biases.map(() => 0);
          v = param.biases.map(() => 0);
        }
        
        for (let i = 0; i < param.biases.length; i++) {
          m[i] = this.beta1 * m[i] + (1 - this.beta1) * grad.biases![i];
          v[i] = this.beta2 * v[i] + (1 - this.beta2) * grad.biases![i] * grad.biases![i];
          
          const mHat = m[i] / (1 - Math.pow(this.beta1, this.t));
          const vHat = v[i] / (1 - Math.pow(this.beta2, this.t));
          
          param.biases[i] -= this.learningRate * mHat / (Math.sqrt(vHat) + this.epsilon);
        }
        
        this.m.set(mKey, m);
        this.v.set(vKey, v);
      }
    }
  }
}

export { relu, tanh, sigmoid, softmax, dot, matmul, outer };
