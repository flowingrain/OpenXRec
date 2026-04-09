/**
 * 自动质量检测集成组件
 * 
 * 功能：
 * 1. 分析完成后自动触发质量检测
 * 2. 显示质量报告摘要
 * 3. 提供反馈入口
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, 
  CheckCircle, 
  Sparkles, 
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QualityReportPanel } from './quality-report-panel';
import { FeedbackPanel } from './feedback-panel';
import type { QualityReport } from '@/lib/quality/quality-checker';

// 维度中文名称
const DIMENSION_NAMES: Record<string, string> = {
  information_quality: '信息源',
  causal_chain_depth: '因果链',
  scenario_reasonability: '场景',
  knowledge_richness: '知识图谱',
  timeline_coherence: '时间线',
  report_quality: '报告',
};

interface AutoQualityCheckerProps {
  // 分析状态
  analysisState: any;
  // 分析是否完成
  isAnalysisComplete: boolean;
  // 案例ID
  caseId?: string;
  // 用户ID
  userId?: string;
  // 是否自动检测（默认true）
  autoCheck?: boolean;
  // 检测完成回调
  onQualityCheck?: (report: QualityReport) => void;
}

export function AutoQualityChecker({
  analysisState,
  isAnalysisComplete,
  caseId,
  userId,
  autoCheck = true,
  onQualityCheck,
}: AutoQualityCheckerProps) {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 执行质量检测
  const performQualityCheck = useCallback(async () => {
    if (!analysisState || isChecking) return;
    
    setIsChecking(true);
    setError(null);
    
    try {
      const response = await fetch('/api/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          payload: { analysisState },
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReport(data.report);
        onQualityCheck?.(data.report);
      } else {
        setError(data.error || '质量检测失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '质量检测失败');
    } finally {
      setIsChecking(false);
    }
  }, [analysisState, isChecking, onQualityCheck]);

  // 自动触发检测
  useEffect(() => {
    if (autoCheck && isAnalysisComplete && analysisState && !report && !isChecking) {
      performQualityCheck();
    }
  }, [autoCheck, isAnalysisComplete, analysisState, report, isChecking, performQualityCheck]);

  // 处理反馈提交
  const handleFeedback = async (feedback: any) => {
    try {
      await fetch('/api/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          payload: { ...feedback, caseId, userId },
        }),
      });
    } catch (err) {
      console.error('提交反馈失败:', err);
    }
  };

  // 加载中状态
  if (isChecking) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
            <div>
              <div className="font-medium">正在进行质量检测...</div>
              <div className="text-sm text-gray-500">评估分析结果的多个维度</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className="border-l-4 border-l-red-500">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium">质量检测失败</div>
                <div className="text-sm text-gray-500">{error}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={performQualityCheck}>
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 无报告状态
  if (!report) {
    return (
      <Card className="border-l-4 border-l-gray-300">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-gray-400" />
              <div>
                <div className="font-medium">质量检测</div>
                <div className="text-sm text-gray-500">分析完成后将自动进行质量检测</div>
              </div>
            </div>
            {isAnalysisComplete && (
              <Button variant="outline" size="sm" onClick={performQualityCheck}>
                开始检测
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

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

  return (
    <div className="space-y-4">
      {/* 质量摘要卡片 */}
      <Card className={cn(
        'border-l-4 cursor-pointer transition-all hover:shadow-md',
        report.overallScore >= 60 ? 'border-l-green-500' : 'border-l-red-500'
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              分析质量评估
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className={cn('text-3xl font-bold', getScoreColor(report.overallScore))}>
                {report.overallScore}
              </span>
              <Badge className={cn(
                report.overallScore >= 80 ? 'bg-green-500' :
                report.overallScore >= 60 ? 'bg-blue-500' :
                report.overallScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              )}>
                {report.overallScore >= 80 ? '优秀' :
                 report.overallScore >= 60 ? '良好' :
                 report.overallScore >= 40 ? '一般' : '待改进'}
              </Badge>
              {showDetail ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </div>
        </CardHeader>
        <CardContent onClick={() => setShowDetail(!showDetail)}>
          {/* 关键问题提示 */}
          {report.criticalIssues.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
              <AlertCircle className="h-4 w-4" />
              <span>发现 {report.criticalIssues.length} 个严重问题需要关注</span>
            </div>
          )}
          
          {/* 维度评分快速预览 */}
          <div className="grid grid-cols-6 gap-2 mb-3">
            {report.dimensionScores.map((ds) => (
              <div key={ds.dimension} className="text-center">
                <div className="text-xs text-gray-500 mb-1">{DIMENSION_NAMES[ds.dimension]}</div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full transition-all', getProgressColor(ds.score))}
                    style={{ width: `${ds.score}%` }}
                  />
                </div>
                <div className={cn('text-xs font-medium mt-1', getScoreColor(ds.score))}>
                  {ds.score}
                </div>
              </div>
            ))}
          </div>

          {/* 改进建议 */}
          {report.improvementPriority.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="flex items-center gap-1 text-xs text-blue-700 font-medium mb-1">
                <TrendingUp className="h-3 w-3" />
                <span>优先改进</span>
              </div>
              <div className="text-xs text-blue-600">
                {report.improvementPriority[0]}
              </div>
            </div>
          )}

          {/* 反馈按钮 */}
          <div className="flex justify-end mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                setShowFeedback(!showFeedback);
              }}
            >
              <MessageSquare className="h-4 w-4" />
              <span>反馈</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 详细报告 */}
      {showDetail && (
        <QualityReportPanel
          report={report}
          onFeedback={handleFeedback}
        />
      )}

      {/* 反馈面板 */}
      {showFeedback && caseId && (
        <FeedbackPanel
          caseId={caseId}
          userId={userId}
          onFeedbackSubmit={(feedback) => {
            handleFeedback(feedback);
            setShowFeedback(false);
          }}
        />
      )}
    </div>
  );
}

export default AutoQualityChecker;
