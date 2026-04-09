import { EventGraph, SearchResults } from './types';
import { GraphGenerationAgent } from './graph-agent';
import { LLMClient } from '@/lib/agents/memory-enhanced-agents';

/**
 * 构建事件图谱
 * 使用LLM Agent动态生成图谱内容
 */
export async function buildEventGraph(
  query: string, 
  searchResults: SearchResults,
  llmClient?: LLMClient,
  agentResults?: Record<string, string>
): Promise<EventGraph> {
  // 如果提供了LLM客户端，使用Agent生成
  if (llmClient) {
    const agent = new GraphGenerationAgent(llmClient);
    return agent.generateGraph(query, searchResults, agentResults);
  }
  
  // 否则返回基础图谱（仅使用搜索结果中的真实数据）
  return buildBasicGraph(query, searchResults);
}

/**
 * 同步版本（用于LLM调用失败时的后备方案）
 * 只使用搜索结果中的真实数据，不生成硬编码内容
 */
export function buildBasicGraph(query: string, searchResults: SearchResults): EventGraph {
  console.log('[buildBasicGraph] Building graph for:', query);
  console.log('[buildBasicGraph] Search items count:', searchResults.items?.length || 0);
  
  const nodes: any[] = [];
  const edges: any[] = [];
  
  // 核心事件节点
  nodes.push({
    id: 'event-core',
    type: 'event',
    position: { x: 50, y: 300 },
    data: {
      label: '核心事件',
      description: query,
      snippet: searchResults.summary?.substring(0, 200) || '',
      sourceCount: searchResults.items?.length || 0
    }
  });
  
  const items = searchResults.items?.slice(0, 10) || [];
  console.log('[buildBasicGraph] Processing items:', items.length);
  
  // 时间线节点（仅使用搜索结果中的真实数据）
  const timelineEvents = items
    .filter(item => item.publishTime)
    .sort((a, b) => new Date(b.publishTime || 0).getTime() - new Date(a.publishTime || 0).getTime())
    .slice(0, 5);
  
  console.log('[buildBasicGraph] Timeline events:', timelineEvents.length);
  
  timelineEvents.forEach((item, i) => {
    nodes.push({
      id: `timeline-${i}`,
      type: 'timeline',
      position: { x: 350, y: 50 + i * 100 },
      data: {
        label: item.title?.substring(0, 25) || `事件${i + 1}`,
        date: item.publishTime?.substring(0, 10) || '未知',
        description: item.snippet?.substring(0, 100) || item.title || '',
        significance: item.siteName || ''
      }
    });
    
    edges.push({
      id: `e-timeline-${i}`,
      source: 'event-core',
      target: `timeline-${i}`,
      type: 'smoothstep',
      animated: i === 0
    });
  });
  
  // 信息源节点
  items.forEach((item, i) => {
    const nodeId = `source-${i}`;
    nodes.push({
      id: nodeId,
      type: 'source',
      position: { x: 650, y: 50 + i * 80 },
      data: {
        label: item.title?.substring(0, 25) || `信息源${i + 1}`,
        title: item.title || '',
        url: item.url || '',
        siteName: item.siteName || '未知来源',
        publishTime: item.publishTime || '',
        snippet: item.snippet?.substring(0, 100) || ''
      }
    });
    
    // 连接到时间线或核心事件
    const sourceId = i < timelineEvents.length ? `timeline-${i}` : 'event-core';
    edges.push({
      id: `e-${sourceId}-source-${i}`,
      source: sourceId,
      target: nodeId,
      type: 'smoothstep'
    });
  });
  
  // 以下节点需要LLM分析才能生成，这里只创建占位符
  // 在实际使用中，应该通过GraphGenerationAgent使用LLM生成
  
  // 如果有搜索摘要，创建一个简单的关键因素占位
  if (searchResults.summary) {
    // 从摘要中提取关键词（简单的文本分析）
    const keywords = extractKeywords(searchResults.summary, items);
    console.log('[buildBasicGraph] Extracted keywords:', keywords);
    
    keywords.slice(0, 3).forEach((keyword, i) => {
      nodes.push({
        id: `factor-${i}`,
        type: 'factor',
        position: { x: 950, y: 100 + i * 90 },
        data: {
          label: keyword.substring(0, 20),
          description: '需LLM分析生成详细描述',
          impact: '待分析',
          trend: '待分析'
        }
      });
      
      if (items.length > 0) {
        edges.push({
          id: `e-source-0-factor-${i}`,
          source: 'source-0',
          target: `factor-${i}`,
          type: 'smoothstep'
        });
      }
    });
  }
  
  console.log('[buildBasicGraph] Generated nodes:', nodes.length, 'edges:', edges.length);
  console.log('[buildBasicGraph] Note: Causal chains and scenarios require LLM analysis');
  
  return { nodes, edges };
}

/**
 * 从搜索结果中提取关键词（简单的文本分析）
 */
function extractKeywords(summary: string, items: any[]): string[] {
  const allText = summary + ' ' + items.map(i => i.title + ' ' + (i.snippet || '')).join(' ');
  
  // 简单的关键词提取（按词频）
  const words = allText.match(/[\u4e00-\u9fa5]{2,8}/g) || [];
  const stopWords = ['人工智能', '智能', '技术', '发展', '领域', '进行', '已经', '可以', '通过', '当前', '以及', '实现', '推动', '持续', '成为', '显示', '表示', '认为', '指出'];
  
  const wordCount: Record<string, number> = {};
  words.forEach(word => {
    if (word.length >= 2 && !stopWords.includes(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });
  
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}
