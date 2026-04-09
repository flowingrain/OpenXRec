/**
 * 因果关系提取器
 * 集成新的因果推断系统，提供增强的因果关系识别能力
 */

import { CausalRelation, SearchItem } from '../types';
import { createCausalDiscoveryEngine } from '@/lib/causal/discovery-engine';
import { DiscoveredCausalRelation } from '@/lib/causal/types';

/**
 * 从搜索结果中提取因果关系链
 * 使用增强的因果发现引擎
 */
export async function extractCausalChain(items: SearchItem[]): Promise<CausalRelation[]> {
  // 如果没有搜索结果，返回默认因果链
  if (!items || items.length === 0) {
    return getDefaultCausalChain();
  }
  
  try {
    // 使用新的因果发现引擎
    const discoveryEngine = createCausalDiscoveryEngine();
    const result = await discoveryEngine.discoverFromSearchResults(items);
    
    // 转换为旧格式以保持兼容性
    const causalChain: CausalRelation[] = result.relations
      .filter(r => r.relationType === 'causal' || r.relationType === 'potential_causal')
      .slice(0, 6)
      .map((rel: DiscoveredCausalRelation) => ({
        label: inferChainLabel(rel.cause, rel.effect),
        cause: rel.cause,
        effect: rel.effect,
        confidence: rel.confidence,
      }));
    
    // 如果发现的因果关系不足，补充默认链
    if (causalChain.length < 3) {
      const defaultChain = getDefaultCausalChain();
      for (const chain of defaultChain) {
        if (causalChain.length >= 4) break;
        if (!causalChain.some(c => c.label === chain.label)) {
          causalChain.push(chain);
        }
      }
    }
    
    return causalChain;
  } catch (error) {
    console.error('[extractCausalChain] 增强提取失败，回退到基础方法:', error);
    return extractCausalChainBasic(items);
  }
}

/**
 * 基础因果提取（兜底方法）
 */
export function extractCausalChainBasic(items: SearchItem[]): CausalRelation[] {
  const causalChain: CausalRelation[] = [];
  const content = items.map((item: SearchItem) => 
    (item.title || '') + ' ' + (item.snippet || '')
  ).join(' ');
  
  // 基于内容关键词的因果关系识别
  if (content.includes('导致') || content.includes('引发') || content.includes('影响')) {
    causalChain.push({
      label: '直接影响链',
      cause: '核心事件发生',
      effect: '市场/行业响应',
      confidence: 0.8
    });
  }
  
  if (content.includes('政策') || content.includes('监管') || content.includes('法规')) {
    causalChain.push({
      label: '政策驱动链',
      cause: '政策调整/监管变化',
      effect: '行业格局重塑',
      confidence: 0.75
    });
  }
  
  if (content.includes('技术') || content.includes('创新') || content.includes('突破')) {
    causalChain.push({
      label: '技术推动链',
      cause: '技术突破/创新应用',
      effect: '产业升级/效率提升',
      confidence: 0.7
    });
  }
  
  if (content.includes('竞争') || content.includes('市场') || content.includes('投资')) {
    causalChain.push({
      label: '市场竞争链',
      cause: '市场动态变化',
      effect: '竞争格局调整',
      confidence: 0.65
    });
  }
  
  // 确保至少有3条因果链
  if (causalChain.length < 3) {
    const defaultChain = getDefaultCausalChain();
    for (const chain of defaultChain) {
      if (causalChain.length >= 4) break;
      if (!causalChain.some(c => c.label === chain.label)) {
        causalChain.push(chain);
      }
    }
  }
  
  return causalChain.slice(0, 4);
}

/**
 * 推断因果链标签
 */
function inferChainLabel(cause: string, effect: string): string {
  const causeLower = cause.toLowerCase();
  
  if (causeLower.includes('政策') || causeLower.includes('监管') || causeLower.includes('法规')) {
    return '政策驱动链';
  }
  if (causeLower.includes('技术') || causeLower.includes('创新') || causeLower.includes('突破')) {
    return '技术推动链';
  }
  if (causeLower.includes('市场') || causeLower.includes('竞争') || causeLower.includes('投资')) {
    return '市场竞争链';
  }
  if (causeLower.includes('供给') || causeLower.includes('需求') || causeLower.includes('消费')) {
    return '供需传导链';
  }
  if (causeLower.includes('金融') || causeLower.includes('资金') || causeLower.includes('利率')) {
    return '金融传导链';
  }
  
  return '直接影响链';
}

/**
 * 获取默认因果链
 */
function getDefaultCausalChain(): CausalRelation[] {
  return [
    { label: '直接影响链', cause: '核心事件触发', effect: '市场即时反应', confidence: 0.8 },
    { label: '间接影响链', cause: '信息传播扩散', effect: '公众认知变化', confidence: 0.7 },
    { label: '长期影响链', cause: '持续发展趋势', effect: '产业结构调整', confidence: 0.6 },
    { label: '反馈循环链', cause: '市场反应反馈', effect: '政策/策略调整', confidence: 0.55 },
  ];
}

/**
 * 增强版因果分析
 * 提供更深入的因果推断能力
 */
export async function enhancedCausalAnalysis(
  items: SearchItem[],
  options?: {
    domain?: string;
    buildModel?: boolean;
  }
): Promise<{
  causalChains: CausalRelation[];
  discoveryResult?: any;
  suggestedModel?: any;
}> {
  const discoveryEngine = createCausalDiscoveryEngine();
  const result = await discoveryEngine.discoverFromSearchResults(items, options?.domain);
  
  const causalChains: CausalRelation[] = result.relations
    .filter((r: DiscoveredCausalRelation) => r.relationType === 'causal' || r.relationType === 'potential_causal')
    .slice(0, 6)
    .map((rel: DiscoveredCausalRelation) => ({
      label: inferChainLabel(rel.cause, rel.effect),
      cause: rel.cause,
      effect: rel.effect,
      confidence: rel.confidence,
    }));
  
  return {
    causalChains,
    discoveryResult: result,
    suggestedModel: options?.buildModel ? result.suggestedGraph : undefined,
  };
}
