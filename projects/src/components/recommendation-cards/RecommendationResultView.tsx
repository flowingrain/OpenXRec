'use client';

import React from 'react';
import { SmartRecommendationRenderer } from '@/components/recommendation-cards';
import type { TemplateOutput } from '@/lib/recommendation/response-templates/types';

/**
 * 推荐结果视图属性
 */
export interface RecommendationResultViewProps {
  /** 原始 API 响应数据 */
  data: {
    items?: any[];
    metadata?: {
      queryType?: string;
      templateId?: string;
      templateName?: string;
      reasoningChain?: string[];
    };
    strategy?: string;
    explanation?: string;
  };
  /** 自定义样式 */
  className?: string;
  /** 追问表单回调 */
  onClarificationSubmit?: (answers: Record<string, string | string[]>) => void;
  onClarificationSkip?: () => void;
}

/**
 * 推荐结果视图
 * 
 * 将 API 响应数据转换为模板格式，并使用动态渲染器展示
 * 
 * @example
 * ```tsx
 * // 在聊天消息中使用
 * <RecommendationResultView 
 *   data={apiResponse.data}
 *   className="mt-4"
 * />
 * ```
 */
export function RecommendationResultView({
  data,
  className,
  onClarificationSubmit,
  onClarificationSkip,
}: RecommendationResultViewProps) {
  if (!data) {
    return null;
  }

  // 转换 API 响应为模板格式
  const templateData = convertToTemplateData(data);

  return (
    <div className={className}>
      <SmartRecommendationRenderer
        data={templateData}
        onClarificationSubmit={onClarificationSubmit}
        onClarificationSkip={onClarificationSkip}
      />
      
      {/* 渲染推理链（可选） */}
      {data.metadata?.reasoningChain && data.metadata.reasoningChain.length > 0 && (
        <div className="mt-4 text-xs text-muted-foreground">
          <details className="cursor-pointer">
            <summary className="hover:text-foreground transition-colors">
              查看推理过程
            </summary>
            <ol className="mt-2 ml-4 space-y-1 list-decimal">
              {data.metadata.reasoningChain.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}

/**
 * 转换 API 响应为模板格式
 */
function convertToTemplateData(data: any): TemplateOutput {
  const queryType = data.metadata?.queryType || 'recommendation';
  
  // 根据查询类型转换
  switch (queryType) {
    case 'comparison_analysis':
      return convertToComparisonAnalysis(data);
    
    case 'ranking':
      return convertToRankingList(data);
    
    case 'single':
    case 'qa':
      return convertToSingleAnswer(data);
    
    case 'clarification':
      return convertToClarification(data);
    
    default:
      return convertToRecommendationItems(data);
  }
}

/**
 * 转换为对比分析格式
 */
function convertToComparisonAnalysis(data: any): TemplateOutput {
  const item = data.items?.[0];
  
  // 如果 item 的 metadata 包含实体信息，使用它
  if (item?.metadata?.entities) {
    return {
      type: 'comparison_analysis',
      entities: item.metadata.entities.map((e: any) => ({
        name: e.name,
        pros: e.pros || [],
        cons: e.cons || [],
        score: e.score,
      })),
      summary: data.explanation || '',
      conclusion: item.metadata.conclusion?.summary || item.description?.split('### 综合建议')?.[1]?.trim() || '',
      recommendation: item.metadata.conclusion?.recommendation ? {
        reason: item.metadata.conclusion.recommendation,
      } : undefined,
      sources: item.metadata.sources || [],
    };
  }
  
  // 否则尝试从 description 解析
  return parseComparisonFromDescription(item, data);
}

/**
 * 从 description 解析对比分析
 */
function parseComparisonFromDescription(item: any, data: any): TemplateOutput {
  const description = item?.description || '';
  const entities: any[] = [];
  const lines = description.split('\n');
  let currentEntity: any = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('### ') && !trimmedLine.includes('综合')) {
      if (currentEntity) entities.push(currentEntity);
      currentEntity = { 
        name: trimmedLine.replace('### ', ''), 
        pros: [], 
        cons: [] 
      };
    } else if (trimmedLine.startsWith('- ✅') && currentEntity) {
      currentEntity.pros.push(trimmedLine.replace('- ✅ ', ''));
    } else if (trimmedLine.startsWith('- ❌') && currentEntity) {
      currentEntity.cons.push(trimmedLine.replace('- ❌ ', ''));
    }
  }
  
  if (currentEntity) entities.push(currentEntity);
  
  return {
    type: 'comparison_analysis',
    entities,
    summary: data.explanation || `为您对比分析了${entities.map(e => e.name).join('和')}`,
    conclusion: extractConclusion(description),
    sources: item?.metadata?.sources || [],
  };
}

/**
 * 提取结论
 */
function extractConclusion(description: string): string {
  const parts = description.split('### 综合建议');
  if (parts.length > 1) {
    return parts[1].replace(/\*\*选择建议\*\*：?/g, '').trim();
  }
  return '';
}

/**
 * 转换为排序列表格式
 */
function convertToRankingList(data: any): TemplateOutput {
  const items = data.items || [];
  
  return {
    type: 'ranking_list',
    category: extractCategory(data.explanation || ''),
    items: items.map((item: any, index: number) => ({
      rank: item.rank || index + 1,
      title: item.title,
      description: item.description,
      score: item.score || item.confidence * 10,
      advantages: item.advantages || item.explanations?.[0]?.factors
        ?.filter((f: any) => f.importance > 0.5)
        ?.map((f: any) => `${f.name}: ${f.value}`) || [],
      disadvantages: [],
      reasoning: item.explanations?.[0]?.reason || '',
      targetUsers: item.targetUsers,
      priceRange: item.priceRange,
      source: item.source,
      sourceUrl: item.sourceUrl,
    })),
    selectionGuide: generateSelectionGuide(items),
    sources: items[0]?.metadata?.sources || [],
  };
}

/**
 * 提取分类名称
 */
function extractCategory(explanation: string): string {
  const match = explanation.match(/为您.*?(\d+).*?(.*)/);
  if (match) {
    return match[2].trim() || '推荐列表';
  }
  return '推荐列表';
}

/**
 * 生成选择指南
 */
function generateSelectionGuide(items: any[]): any {
  if (items.length === 0) return undefined;
  
  return {
    highBudget: items[0] ? `推荐第1名：${items[0].title}` : undefined,
    valueForMoney: items[1] ? `推荐第2名：${items[1].title}` : undefined,
    entryLevel: items[2] ? `推荐第3名：${items[2].title}` : undefined,
  };
}

/**
 * 转换为单一答案格式
 */
function convertToSingleAnswer(data: any): TemplateOutput {
  const item = data.items?.[0];
  
  return {
    type: 'single_answer',
    answer: item?.title || data.explanation || '',
    explanation: item?.description,
    examples: item?.examples || [],
    sources: item?.metadata?.sources || [],
  };
}

/**
 * 转换为追问格式
 */
function convertToClarification(data: any): TemplateOutput {
  const clarification = data.metadata?.clarification;
  
  return {
    type: 'clarification',
    questions: clarification?.questions || [],
    extractedInfo: clarification?.extractedInfo || [],
    guidance: clarification?.guidance || '为了给您更精准的推荐，请回答以下问题：',
  };
}

/**
 * 转换为推荐列表格式
 */
function convertToRecommendationItems(data: any): TemplateOutput {
  const items = data.items || [];
  
  return {
    type: 'recommendation_items',
    items: items.map((item: any) => ({
      id: item.id || Math.random().toString(36).slice(2),
      title: item.title,
      description: item.description || '',
      score: item.score,
      confidence: item.confidence,
      explanations: item.explanations || [{
        type: '综合推荐',
        reason: item.explanation || item.explanations?.[0]?.reason || item.reason || '基于综合分析推荐',
        factors: item.explanations?.[0]?.factors || [],
      }],
      source: item.source,
      sourceUrl: item.sourceUrl,
      metadata: item.metadata,
    })),
    explanation: data.explanation,
    strategy: data.strategy,
  };
}

export default RecommendationResultView;
