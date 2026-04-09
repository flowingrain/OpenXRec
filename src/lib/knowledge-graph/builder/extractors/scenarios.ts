import { Scenario, SearchItem } from '../types';
import { analyzeSentiment } from './sentiment';

/**
 * 生成场景推演
 * 基于当前态势预测乐观、中性、悲观三种情景
 */
export function generateScenarios(items: SearchItem[]): Scenario[] {
  const content = items.map((item: SearchItem) => 
    (item.title || '') + ' ' + (item.snippet || '')
  ).join(' ');
  const sentiment = analyzeSentiment(content);
  
  return [
    {
      label: '乐观情景',
      type: 'optimistic',
      description: '有利因素占主导，事件积极发展',
      probability: sentiment.positive,
      keyEvents: ['政策支持增强', '技术突破加速', '市场信心提升'],
      timeFrame: '3-6个月'
    },
    {
      label: '中性情景',
      type: 'neutral',
      description: '多空因素平衡，维持现状发展',
      probability: sentiment.neutral,
      keyEvents: ['政策平稳过渡', '技术渐进发展', '市场理性调整'],
      timeFrame: '6-12个月'
    },
    {
      label: '悲观情景',
      type: 'pessimistic',
      description: '不利因素增多，面临挑战风险',
      probability: sentiment.negative,
      keyEvents: ['政策收紧风险', '竞争加剧压力', '市场信心下降'],
      timeFrame: '3-6个月'
    }
  ];
}
