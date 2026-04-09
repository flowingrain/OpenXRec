import { Observable, SearchItem } from '../types';
import { analyzeSentiment } from './sentiment';

/**
 * 提取可观测性指标
 * 用于持续监测事件发展态势
 */
export function extractObservables(items: SearchItem[]): Observable[] {
  const content = items.map((item: SearchItem) => 
    (item.title || '') + ' ' + (item.snippet || '')
  ).join(' ');
  const sentiment = analyzeSentiment(content);
  
  // 计算来源多样性
  const uniqueSources = new Set(items.map((i: SearchItem) => i.siteName).filter(Boolean));
  
  // 判断信息新鲜度
  const latestDate = items[0]?.publishTime?.substring(0, 10) || '未知';
  const daysSinceLatest = latestDate !== '未知' 
    ? Math.floor((Date.now() - new Date(latestDate).getTime()) / (24 * 60 * 60 * 1000))
    : 999;
  
  const observables: Observable[] = [
    {
      label: '信息热度指标',
      metric: '新闻数量',
      currentValue: `${items.length}条`,
      threshold: '≥5条/周',
      status: items.length >= 5 ? '正常' : '警告',
      trend: items.length >= 7 ? '上升' : '平稳'
    },
    {
      label: '时间新鲜度',
      metric: '最新信息时间',
      currentValue: latestDate,
      threshold: '≤7天',
      status: daysSinceLatest <= 7 ? '正常' : daysSinceLatest <= 30 ? '警告' : '危险',
      trend: daysSinceLatest <= 3 ? '新鲜' : daysSinceLatest <= 7 ? '较新' : '陈旧'
    },
    {
      label: '来源多样性',
      metric: '信息源数量',
      currentValue: `${uniqueSources.size}个`,
      threshold: '≥3个',
      status: uniqueSources.size >= 3 ? '正常' : '警告',
      trend: '平稳'
    },
    {
      label: '情感倾向指标',
      metric: '整体情感',
      currentValue: sentiment.neutral > 0.4 ? '中性' : sentiment.positive > sentiment.negative ? '偏正面' : '偏负面',
      threshold: '中性',
      status: '正常',
      trend: sentiment.positive > 0.35 ? '向好' : sentiment.negative > 0.25 ? '承压' : '平稳'
    }
  ];
  
  return observables;
}
