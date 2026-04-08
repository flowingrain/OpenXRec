import { KeyFactor, SearchItem } from '../types';

/**
 * 从搜索结果中提取关键影响因素
 * 分析技术、政策、市场、社会等多维度因素
 */
export function extractKeyFactors(items: SearchItem[]): KeyFactor[] {
  const factors: KeyFactor[] = [];
  const content = items.map((item: SearchItem) => 
    (item.title || '') + ' ' + (item.snippet || '')
  ).join(' ').toLowerCase();
  
  // 技术因素
  if (content.includes('技术') || content.includes('科技') || content.includes('创新') || 
      content.includes('ai') || content.includes('人工智能')) {
    factors.push({
      name: '技术驱动因素',
      description: '技术创新与发展对事件的核心推动作用',
      impact: '高',
      trend: '上升',
      evidence: '检索信息中提及技术相关内容'
    });
  }
  
  // 政策因素
  if (content.includes('政策') || content.includes('政府') || content.includes('监管') || 
      content.includes('法规')) {
    factors.push({
      name: '政策环境因素',
      description: '政策导向和监管环境对事件的影响',
      impact: '高',
      trend: '平稳',
      evidence: '检索信息中提及政策相关内容'
    });
  }
  
  // 市场因素
  if (content.includes('市场') || content.includes('经济') || content.includes('投资') || 
      content.includes('资本')) {
    factors.push({
      name: '市场经济因素',
      description: '市场动态和经济环境对事件的影响',
      impact: '中',
      trend: '波动',
      evidence: '检索信息中提及市场相关内容'
    });
  }
  
  // 社会因素
  if (content.includes('社会') || content.includes('公众') || content.includes('用户') || 
      content.includes('消费者')) {
    factors.push({
      name: '社会认知因素',
      description: '社会舆论和公众态度对事件的影响',
      impact: '中',
      trend: '上升',
      evidence: '检索信息中提及社会相关内容'
    });
  }
  
  // 竞争因素
  if (content.includes('竞争') || content.includes('对手') || content.includes('行业')) {
    factors.push({
      name: '竞争格局因素',
      description: '行业竞争态势对事件的影响',
      impact: '中',
      trend: '上升',
      evidence: '检索信息中提及竞争相关内容'
    });
  }
  
  // 确保至少有4个因素
  if (factors.length < 4) {
    factors.push(
      { name: '技术驱动因素', description: '技术发展对事件的影响', impact: '高', trend: '上升', evidence: '综合分析' },
      { name: '政策环境因素', description: '政策导向对事件的影响', impact: '高', trend: '平稳', evidence: '综合分析' },
      { name: '市场经济因素', description: '市场环境对事件的影响', impact: '中', trend: '波动', evidence: '综合分析' },
      { name: '竞争格局因素', description: '行业竞争对事件的影响', impact: '中', trend: '上升', evidence: '综合分析' }
    );
  }
  
  return factors.slice(0, 5);
}
