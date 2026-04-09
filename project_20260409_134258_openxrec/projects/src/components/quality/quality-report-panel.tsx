/**
 * 质量报告展示组件
 * 
 * 功能：
 * 1. 展示综合质量评分和等级
 * 2. 分维度展示评分和问题
 * 3. 展示改进优先级
 * 4. 支持快速反馈
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Info, AlertCircle, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QualityReport, QualityIssue, DimensionScore } from '@/lib/quality/quality-checker';

// 维度中文名称
const DIMENSION_NAMES: Record<string, string> = {
  information_quality: '信息源质量',
  causal_chain_depth: '因果链深度',
  scenario_reasonability: '场景合理性',
  knowledge_richness: '知识丰富度',
  timeline_coherence: '时间线连贯性',
  report_quality: '报告质量',
};

// 等级颜色
const GRADE_COLORS: Record<string, string> = {
  excellent: 'text-green-500',
  good: 'text-blue-500',
  fair: 'text-yellow-500',
  poor: 'text-orange-500',
  critical: 'text-red-500',
};

// 等级背景色
const GRADE_BG_COLORS: Record<string, string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  fair: 'bg-yellow-500',
  poor: 'bg-orange-500',
  critical: 'bg-red-500',
};

// 等级中文
const GRADE_NAMES: Record<string, string> = {
  excellent: '优秀',
  good: '良好',
  fair: '一般',
  poor: '较差',
  critical: '严重',
};

// 严重程度图标
const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

interface QualityReportPanelProps {
  report: QualityReport;
  onFeedback?: (feedback: any) => void;
  compact?: boolean;
}

export function QualityReportPanel({ report, onFeedback, compact = false }: QualityReportPanelProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // 获取评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  // 获取进度条颜色
  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (compact) {
    return (
      <Card className="border-l-4" style={{ borderLeftColor: report.overallScore >= 60 ? '#22c55e' : '#ef4444' }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">质量评分</CardTitle>
            <div className="flex items-center gap-2">
              <span className={cn('text-2xl font-bold', getScoreColor(report.overallScore))}>
                {report.overallScore}
              </span>
              <Badge className={GRADE_BG_COLORS[report.grade]}>
                {GRADE_NAMES[report.grade]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {report.criticalIssues.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-500 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span>{report.criticalIssues.length} 个严重问题需要关注</span>
            </div>
          )}
          <div className="flex gap-1">
            {report.dimensionScores.map((ds) => (
              <div
                key={ds.dimension}
                className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"
                title={`${DIMENSION_NAMES[ds.dimension]}: ${ds.score}分`}
              >
                <div
                  className={cn('h-full transition-all', getProgressColor(ds.score))}
                  style={{ width: `${ds.score}%` }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 综合评分卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>分析质量评估</CardTitle>
              <CardDescription>
                基于多维度指标的综合评价
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className={cn('text-4xl font-bold', getScoreColor(report.overallScore))}>
                  {report.overallScore}
                </span>
                <Badge className={cn('text-base px-3 py-1', GRADE_BG_COLORS[report.grade])}>
                  {GRADE_NAMES[report.grade]}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                检测于 {new Date(report.detectedAt).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 关键问题提示 */}
          {report.criticalIssues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <AlertCircle className="h-5 w-5" />
                <span>发现 {report.criticalIssues.length} 个严重问题</span>
              </div>
              <ul className="text-sm text-red-600 space-y-1">
                {report.criticalIssues.slice(0, 3).map((issue) => (
                  <li key={issue.id} className="flex items-start gap-2">
                    <span>•</span>
                    <span>{issue.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 改进优先级 */}
          {report.improvementPriority.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                <Sparkles className="h-5 w-5" />
                <span>改进建议</span>
              </div>
              <ol className="text-sm text-blue-600 space-y-1">
                {report.improvementPriority.slice(0, 3).map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="font-medium">{index + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 维度评分详情 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">维度评分详情</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="details">详情</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid gap-3">
                {report.dimensionScores.map((ds) => (
                  <DimensionScoreBar
                    key={ds.dimension}
                    score={ds}
                    isExpanded={expandedDimension === ds.dimension}
                    onToggle={() => setExpandedDimension(
                      expandedDimension === ds.dimension ? null : ds.dimension
                    )}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="details">
              <div className="space-y-4">
                {report.dimensionScores.map((ds) => (
                  <DimensionDetailCard key={ds.dimension} score={ds} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 问题列表 */}
      {report.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">问题清单</CardTitle>
            <CardDescription>
              共发现 {report.issues.length} 个问题
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.issues.map((issue) => (
                <IssueItem key={issue.id} issue={issue} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 分析元数据 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">分析统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">信息源</div>
              <div className="text-2xl font-bold">{report.analysisMetadata.searchResultCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">时间线事件</div>
              <div className="text-2xl font-bold">{report.analysisMetadata.timelineEventCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">因果链层数</div>
              <div className="text-2xl font-bold">{report.analysisMetadata.causalChainCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">场景数量</div>
              <div className="text-2xl font-bold">{report.analysisMetadata.scenarioCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">知识实体</div>
              <div className="text-2xl font-bold">{report.analysisMetadata.knowledgeEntityCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">知识关系</div>
              <div className="text-2xl font-bold">{report.analysisMetadata.knowledgeRelationCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">报告字数</div>
              <div className="text-2xl font-bold">{report.analysisMetadata.reportLength}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500">置信度</div>
              <div className="text-2xl font-bold">
                {(report.analysisMetadata.modelConfidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 反馈区域 */}
      {onFeedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">提交反馈</CardTitle>
            <CardDescription>
              您的反馈将帮助我们改进分析质量
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickFeedback 
              reportId={report.id}
              onSubmit={(feedback) => {
                onFeedback(feedback);
                setShowFeedbackForm(false);
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 维度评分条组件
function DimensionScoreBar({ 
  score, 
  isExpanded, 
  onToggle 
}: { 
  score: DimensionScore;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const getProgressColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-blue-500';
    if (s >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div 
      className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{DIMENSION_NAMES[score.dimension]}</span>
          {score.issues.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {score.issues.length} 个问题
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-bold',
            score.score >= 60 ? 'text-green-500' : 'text-red-500'
          )}>
            {score.score}分
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all', getProgressColor(score.score))}
          style={{ width: `${score.score}%` }}
        />
      </div>
      
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {score.strengths.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">优点</div>
              {score.strengths.map((s, i) => (
                <div key={i} className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {score.issues.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">问题</div>
              {score.issues.map((issue) => (
                <div key={issue.id} className="flex items-start gap-1 text-sm text-gray-600 mb-1">
                  {SEVERITY_ICONS[issue.severity]}
                  <span>{issue.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 维度详情卡片
function DimensionDetailCard({ score }: { score: DimensionScore }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">{DIMENSION_NAMES[score.dimension]}</h4>
        <span className={cn(
          'text-lg font-bold',
          score.score >= 60 ? 'text-green-500' : 'text-red-500'
        )}>
          {score.score}分
        </span>
      </div>
      
      {score.strengths.length > 0 && (
        <div className="mb-3">
          <h5 className="text-sm font-medium text-green-600 mb-1">优点</h5>
          <ul className="text-sm text-gray-600 space-y-1">
            {score.strengths.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {score.issues.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-1">待改进</h5>
          <ul className="text-sm space-y-2">
            {score.issues.map((issue) => (
              <li key={issue.id} className="bg-gray-50 rounded p-2">
                <div className="flex items-start gap-2">
                  {SEVERITY_ICONS[issue.severity]}
                  <div>
                    <div className="font-medium">{issue.title}</div>
                    <div className="text-gray-500">{issue.description}</div>
                    <div className="text-blue-500 mt-1">{issue.suggestion}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 问题项组件
function IssueItem({ issue }: { issue: QualityIssue }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'border rounded-lg p-3',
      issue.severity === 'critical' && 'border-red-200 bg-red-50',
      issue.severity === 'warning' && 'border-yellow-200 bg-yellow-50',
      issue.severity === 'info' && 'border-blue-200 bg-blue-50'
    )}>
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {SEVERITY_ICONS[issue.severity]}
          <span className="font-medium">{issue.title}</span>
          {issue.autoFixable && (
            <Badge variant="outline" className="text-xs">可修复</Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>
      
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-200 text-sm">
          <p className="text-gray-600 mb-1">{issue.description}</p>
          <p className="text-blue-600">{issue.suggestion}</p>
        </div>
      )}
    </div>
  );
}

// 快速反馈组件
function QuickFeedback({ 
  reportId, 
  onSubmit 
}: { 
  reportId: string;
  onSubmit: (feedback: any) => void;
}) {
  const [feedbackType, setFeedbackType] = useState<'thumbs' | 'rating' | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (type: 'thumbs' | 'rating', value: boolean | number) => {
    onSubmit({
      type,
      caseId: reportId,
      thumbsUp: type === 'thumbs' ? value : undefined,
      rating: type === 'rating' ? value : undefined,
      comment: comment || undefined,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center gap-2 text-green-600 py-4">
        <CheckCircle className="h-5 w-5" />
        <span>感谢您的反馈！</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          className="flex items-center gap-2"
          onClick={() => handleSubmit('thumbs', true)}
        >
          <ThumbsUp className="h-5 w-5" />
          <span>有用</span>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex items-center gap-2"
          onClick={() => handleSubmit('thumbs', false)}
        >
          <ThumbsDown className="h-5 w-5" />
          <span>需改进</span>
        </Button>
      </div>
      
      <div className="text-center text-sm text-gray-500">或</div>
      
      <div className="space-y-2">
        <div className="text-sm text-gray-500 text-center">详细评分</div>
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className={cn(
                'w-10 h-10 rounded-full border-2 transition-colors',
                rating >= star ? 'bg-yellow-100 border-yellow-400' : 'border-gray-200'
              )}
              onClick={() => {
                setRating(star);
                handleSubmit('rating', star);
              }}
            >
              <span className={cn(
                'text-lg',
                rating >= star ? 'text-yellow-500' : 'text-gray-300'
              )}>★</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="补充说明（可选）"
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {comment && (
          <Button size="sm" onClick={() => handleSubmit('thumbs', true)}>
            提交
          </Button>
        )}
      </div>
    </div>
  );
}

export default QualityReportPanel;
