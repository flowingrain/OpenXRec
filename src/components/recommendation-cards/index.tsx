'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { TemplateOutput, RenderConfig } from '@/lib/recommendation/response-templates/types';

// 动态加载组件（按需加载，减少首屏加载时间）
const ComparisonAnalysisCard = dynamic(
  () => import('./ComparisonAnalysisCard').then((mod) => mod.ComparisonAnalysisCard),
  {
    loading: () => <LoadingCard />,
    ssr: false,
  }
);

const RankingListCard = dynamic(
  () => import('./RankingListCard').then((mod) => mod.RankingListCard),
  {
    loading: () => <LoadingCard />,
    ssr: false,
  }
);

const AnswerCard = dynamic(
  () => import('./AnswerCard').then((mod) => mod.AnswerCard),
  {
    loading: () => <LoadingCard />,
    ssr: false,
  }
);

const RecommendationItemsCard = dynamic(
  () => import('./RecommendationItemsCard').then((mod) => mod.RecommendationItemsCard),
  {
    loading: () => <LoadingCard />,
    ssr: false,
  }
);

const ClarificationForm = dynamic(
  () => import('./ClarificationForm').then((mod) => mod.ClarificationForm),
  {
    loading: () => <LoadingCard />,
    ssr: false,
  }
);

// 组件映射表
const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  ComparisonAnalysisCard,
  RankingListCard,
  AnswerCard,
  RecommendationItemsCard,
  ClarificationForm,
};

// 默认渲染配置
const DEFAULT_CONFIGS: Record<string, RenderConfig> = {
  comparison_analysis: {
    component: 'ComparisonAnalysisCard',
    layout: 'comparison',
    style: { showScoreChart: true, showDimensionTable: true },
  },
  ranking_list: {
    component: 'RankingListCard',
    layout: 'list',
    style: { showScoreBadge: true, showComparisonTable: true },
  },
  single_answer: {
    component: 'AnswerCard',
    layout: 'card',
    style: { highlightAnswer: true },
  },
  recommendation_items: {
    component: 'RecommendationItemsCard',
    layout: 'card',
    style: { showExplanations: true, showSourceLinks: true },
  },
  clarification: {
    component: 'ClarificationForm',
    layout: 'form',
    style: { showProgress: true, allowSkip: true },
  },
};

/**
 * 加载中卡片
 */
function LoadingCard() {
  return (
    <Card className="w-full">
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

/**
 * 未知类型卡片
 */
function UnknownTypeCard({ type }: { type?: string }) {
  return (
    <Card className="w-full">
      <CardContent className="py-8 text-center">
        <p className="text-muted-foreground">
          未知的响应类型: {type || 'undefined'}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * 推荐结果渲染器属性
 */
export interface RecommendationRendererProps {
  /** 响应数据 */
  data: TemplateOutput | any;
  /** 渲染配置（可选，会从数据中自动提取） */
  config?: RenderConfig;
  /** 模板ID（可选，用于确定组件类型） */
  templateId?: string;
  /** 追问表单提交回调 */
  onClarificationSubmit?: (answers: Record<string, string | string[]>) => void;
  /** 追问表单跳过回调 */
  onClarificationSkip?: () => void;
}

/**
 * 推荐结果渲染器
 * 
 * 根据响应数据类型自动选择对应的组件进行渲染
 * 
 * @example
 * ```tsx
 * // 从 API 返回的数据直接渲染
 * <RecommendationRenderer data={apiResponse.data} />
 * 
 * // 自定义配置
 * <RecommendationRenderer
 *   data={apiResponse.data}
 *   config={{ showScoreChart: false }}
 * />
 * ```
 */
export function RecommendationRenderer({
  data,
  config,
  templateId,
  onClarificationSubmit,
  onClarificationSkip,
}: RecommendationRendererProps) {
  // 确定数据类型
  const type = data.type || templateId || data._templateId || 'recommendation_items';
  
  // 获取渲染配置
  const renderConfig = config || data._renderConfig || DEFAULT_CONFIGS[type];
  
  // 获取组件
  const Component = COMPONENT_MAP[renderConfig?.component || ''];
  
  // 没有找到对应组件
  if (!Component) {
    console.warn(`[RecommendationRenderer] Unknown component for type: ${type}`);
    return <UnknownTypeCard type={type} />;
  }
  
  // 渲染组件
  return (
    <div className="recommendation-renderer">
      <Component
        data={data}
        config={renderConfig?.style || {}}
        onSubmit={onClarificationSubmit}
        onSkip={onClarificationSkip}
      />
    </div>
  );
}

/**
 * 智能渲染器（自动检测数据格式）
 * 
 * 支持多种数据格式：
 * 1. 模板输出格式（带 type 字段）
 * 2. 旧版推荐格式（带 items 字段）
 * 3. 对比分析格式（带 entities 字段）
 */
export function SmartRecommendationRenderer({
  data,
  onClarificationSubmit,
  onClarificationSkip,
}: Omit<RecommendationRendererProps, 'config' | 'templateId'>) {
  // 情况1：已经是标准模板格式
  if (data.type) {
    return (
      <RecommendationRenderer
        data={data}
        onClarificationSubmit={onClarificationSubmit}
        onClarificationSkip={onClarificationSkip}
      />
    );
  }
  
  // 情况2：对比分析格式（entities 字段）
  if (data.entities && Array.isArray(data.entities)) {
    return (
      <RecommendationRenderer
        data={{ ...data, type: 'comparison_analysis' }}
        onClarificationSubmit={onClarificationSubmit}
        onClarificationSkip={onClarificationSkip}
      />
    );
  }
  
  // 情况3：旧版推荐格式（items 字段）
  if (data.items && Array.isArray(data.items)) {
    // 检查是否是对比分析结果（单个 item 包含对比内容）
    if (data.items.length === 1 && data.items[0]?.description?.includes('优点')) {
      // 转换为对比分析格式
      return (
        <RecommendationRenderer
          data={convertToComparisonAnalysis(data)}
          onClarificationSubmit={onClarificationSubmit}
          onClarificationSkip={onClarificationSkip}
        />
      );
    }
    
    // 转换为推荐列表格式
    return (
      <RecommendationRenderer
        data={convertToRecommendationItems(data)}
        onClarificationSubmit={onClarificationSubmit}
        onClarificationSkip={onClarificationSkip}
      />
    );
  }
  
  // 情况4：追问格式（questions 字段）
  if (data.questions && Array.isArray(data.questions)) {
    return (
      <RecommendationRenderer
        data={{ ...data, type: 'clarification' }}
        onClarificationSubmit={onClarificationSubmit}
        onClarificationSkip={onClarificationSkip}
      />
    );
  }
  
  // 默认：显示原始数据
  return <UnknownTypeCard type="unknown" />;
}

/**
 * 转换旧版推荐格式为推荐项列表格式
 */
function convertToRecommendationItems(data: any): TemplateOutput {
  return {
    type: 'recommendation_items',
    items: data.items.map((item: any) => ({
      id: item.id || Math.random().toString(36).slice(2),
      title: item.title || item.name || '',
      description: item.description || '',
      score: item.score || item.confidence,
      confidence: item.confidence || 0.7,
      explanations: item.explanations || [],
      source: item.source,
      sourceUrl: item.sourceUrl,
    })),
    explanation: data.explanation || data.metadata?.explanation,
    strategy: data.strategy,
  };
}

/**
 * 转换旧版对比分析格式
 */
function convertToComparisonAnalysis(data: any): TemplateOutput {
  // 尝试从描述中解析对比信息
  const item = data.items[0];
  const description = item?.description || '';
  
  // 简单的解析逻辑（实际项目中应该更复杂）
  const entities: any[] = [];
  const lines = description.split('\n');
  let currentEntity: any = null;
  
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (currentEntity) entities.push(currentEntity);
      currentEntity = { name: line.replace('### ', ''), pros: [], cons: [] };
    } else if (line.includes('✅') && currentEntity) {
      currentEntity.pros.push(line.replace(/- ✅ /, ''));
    } else if (line.includes('❌') && currentEntity) {
      currentEntity.cons.push(line.replace(/- ❌ /, ''));
    }
  }
  
  if (currentEntity) entities.push(currentEntity);
  
  return {
    type: 'comparison_analysis',
    entities,
    summary: data.explanation || '',
    conclusion: item?.description?.split('### 综合建议')?.[1]?.trim() || '请参考以上对比分析',
    sources: [],
  };
}

export default RecommendationRenderer;
