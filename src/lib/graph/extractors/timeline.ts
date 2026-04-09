import { TimelineEvent, SearchItem } from '../types';

/**
 * 从搜索结果中提取时间线事件
 * 基于新闻发布时间构建时间线
 */
export function extractTimelineEvents(items: SearchItem[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const seenDates = new Set<string>();
  
  // 按时间排序（最新的在前）
  const sortedItems = [...items]
    .filter(item => item.publishTime)
    .sort((a, b) => {
      const timeA = new Date(a.publishTime || '').getTime();
      const timeB = new Date(b.publishTime || '').getTime();
      return timeB - timeA;
    });
  
  sortedItems.slice(0, 5).forEach((item: SearchItem) => {
    const date = item.publishTime?.substring(0, 10) || '未知日期';
    if (!seenDates.has(date)) {
      seenDates.add(date);
      events.push({
        label: `关键节点 ${events.length + 1}`,
        date: date,
        description: item.title?.substring(0, 40) || '重要事件',
        source: item.siteName,
        url: item.url
      });
    }
  });
  
  // 确保至少有3个时间节点
  if (events.length < 3) {
    const now = new Date();
    events.push(
      { label: '近期动态', date: now.toISOString().substring(0, 10), description: '最新发展态势', source: '综合分析' },
      { label: '中期趋势', date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10), description: '周度趋势变化', source: '综合分析' },
      { label: '长期背景', date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10), description: '月度背景分析', source: '综合分析' }
    );
  }
  
  return events.slice(0, 5);
}
