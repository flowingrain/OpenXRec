/**
 * 反馈驱动优化组件
 * 
 * 功能：
 * 1. 提供多维度反馈入口
 * 2. 错误纠正提交
 * 3. 偏好设置
 * 4. 反馈历史查看
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Star, Edit2, Settings, History, MessageCircle, AlertTriangle, CheckCircle, TrendingUp, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeedbackDimension, UserFeedback } from '@/lib/quality/feedback-optimizer';

// 维度中文名称
const FEEDBACK_DIMENSION_NAMES: Record<FeedbackDimension, string> = {
  comprehensiveness: '全面性',
  accuracy: '准确性',
  timeliness: '时效性',
  clarity: '清晰度',
  actionability: '可操作性',
};

// 错误类型中文名称
const CORRECTION_TYPE_NAMES: Record<string, string> = {
  entity: '实体错误',
  relation: '关系错误',
  causal: '因果错误',
  scenario: '场景错误',
  other: '其他错误',
};

interface FeedbackPanelProps {
  caseId: string;
  userId?: string;
  onFeedbackSubmit?: (feedback: any) => void;
}

export function FeedbackPanel({ caseId, userId, onFeedbackSubmit }: FeedbackPanelProps) {
  const [activeTab, setActiveTab] = useState('quick');
  const [submitted, setSubmitted] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<UserFeedback[]>([]);

  // 快速评分
  const handleQuickRating = async (rating: number) => {
    const feedback = {
      type: 'rating' as const,
      caseId,
      userId,
      rating,
    };
    
    await submitFeedback(feedback);
  };

  // 维度评分
  const handleDimensionRating = async (ratings: Record<FeedbackDimension, number>) => {
    const feedback = {
      type: 'dimension_rating' as const,
      caseId,
      userId,
      dimensionRatings: ratings,
    };
    
    await submitFeedback(feedback);
  };

  // 错误纠正
  const handleCorrection = async (correction: any) => {
    const feedback = {
      type: 'correction' as const,
      caseId,
      userId,
      correction,
    };
    
    await submitFeedback(feedback);
  };

  // 偏好设置
  const handlePreference = async (preference: any) => {
    const feedback = {
      type: 'preference' as const,
      caseId,
      userId,
      preference,
    };
    
    await submitFeedback(feedback);
  };

  // 提交反馈
  const submitFeedback = async (feedback: any) => {
    try {
      const response = await fetch('/api/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback', payload: feedback }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSubmitted(true);
        setFeedbackHistory(prev => [...prev, data.feedback]);
        onFeedbackSubmit?.(data.feedback);
        
        setTimeout(() => setSubmitted(false), 2000);
      }
    } catch (error) {
      console.error('提交反馈失败:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">反馈与优化</CardTitle>
            <CardDescription>
              您的反馈将帮助我们改进分析质量
            </CardDescription>
          </div>
          {submitted && (
            <Badge className="bg-green-100 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              已提交
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="quick">快速反馈</TabsTrigger>
            <TabsTrigger value="dimension">维度评分</TabsTrigger>
            <TabsTrigger value="correction">错误纠正</TabsTrigger>
            <TabsTrigger value="preference">偏好设置</TabsTrigger>
          </TabsList>

          <TabsContent value="quick">
            <QuickRatingTab onSubmit={handleQuickRating} />
          </TabsContent>

          <TabsContent value="dimension">
            <DimensionRatingTab onSubmit={handleDimensionRating} />
          </TabsContent>

          <TabsContent value="correction">
            <CorrectionTab onSubmit={handleCorrection} />
          </TabsContent>

          <TabsContent value="preference">
            <PreferenceTab onSubmit={handlePreference} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// 快速评分标签页
function QuickRatingTab({ onSubmit }: { onSubmit: (rating: number) => void }) {
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState('');

  const ratingLabels = ['很差', '较差', '一般', '较好', '很好'];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-3">请对本次分析进行整体评分</p>
        <div className="flex items-center justify-center gap-2 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className="transition-transform hover:scale-110"
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => {
                setSelectedRating(star);
                onSubmit(star);
              }}
            >
              <Star
                className={cn(
                  'h-10 w-10 transition-colors',
                  (hoveredRating || selectedRating) >= star
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                )}
              />
            </button>
          ))}
        </div>
        {(hoveredRating || selectedRating) > 0 && (
          <p className="text-sm text-gray-600">
            {ratingLabels[(hoveredRating || selectedRating) - 1]}
          </p>
        )}
      </div>

      <div className="border-t pt-4">
        <p className="text-sm text-gray-500 mb-2">补充说明（可选）</p>
        <Textarea
          placeholder="请描述您的具体意见或建议..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-20"
        />
        {comment && selectedRating > 0 && (
          <Button className="mt-2" onClick={() => onSubmit(selectedRating)}>
            提交反馈
          </Button>
        )}
      </div>
    </div>
  );
}

// 维度评分标签页
function DimensionRatingTab({ onSubmit }: { onSubmit: (ratings: Record<FeedbackDimension, number>) => void }) {
  const [ratings, setRatings] = useState<Record<FeedbackDimension, number>>({
    comprehensiveness: 3,
    accuracy: 3,
    timeliness: 3,
    clarity: 3,
    actionability: 3,
  });

  const handleSubmit = () => {
    onSubmit(ratings);
  };

  const dimensions: FeedbackDimension[] = ['comprehensiveness', 'accuracy', 'timeliness', 'clarity', 'actionability'];

  return (
    <div className="space-y-4">
      {dimensions.map((dim) => (
        <div key={dim} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              {FEEDBACK_DIMENSION_NAMES[dim]}
            </label>
            <span className="text-sm text-gray-500">{ratings[dim]}/5</span>
          </div>
          <Slider
            value={[ratings[dim]]}
            min={1}
            max={5}
            step={1}
            onValueChange={([value]) => setRatings(prev => ({ ...prev, [dim]: value }))}
          />
        </div>
      ))}

      <Button className="w-full" onClick={handleSubmit}>
        提交评分
      </Button>
    </div>
  );
}

// 错误纠正标签页
function CorrectionTab({ onSubmit }: { onSubmit: (correction: any) => void }) {
  const [correctionType, setCorrectionType] = useState<string>('entity');
  const [original, setOriginal] = useState('');
  const [corrected, setCorrected] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!original || !corrected) return;
    
    onSubmit({
      type: correctionType,
      original,
      corrected,
      reason: reason || undefined,
    });
    
    setOriginal('');
    setCorrected('');
    setReason('');
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">错误类型</label>
        <Select value={correctionType} onValueChange={setCorrectionType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="entity">实体错误</SelectItem>
            <SelectItem value="relation">关系错误</SelectItem>
            <SelectItem value="causal">因果错误</SelectItem>
            <SelectItem value="scenario">场景错误</SelectItem>
            <SelectItem value="other">其他错误</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">原始内容</label>
        <Textarea
          placeholder="请输入需要纠正的内容..."
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">正确内容</label>
        <Textarea
          placeholder="请输入正确的内容..."
          value={corrected}
          onChange={(e) => setCorrected(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">纠正原因（可选）</label>
        <Input
          placeholder="说明纠正的原因..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <Button 
        className="w-full" 
        onClick={handleSubmit}
        disabled={!original || !corrected}
      >
        提交纠正
      </Button>
    </div>
  );
}

// 偏好设置标签页
function PreferenceTab({ onSubmit }: { onSubmit: (preference: any) => void }) {
  const [aspect, setAspect] = useState<string>('depth');
  const [value, setValue] = useState<string>('normal');

  const aspectLabels: Record<string, { label: string; options: { value: string; label: string }[] }> = {
    depth: {
      label: '分析深度',
      options: [
        { value: 'low', label: '快速' },
        { value: 'normal', label: '标准' },
        { value: 'high', label: '深入' },
      ],
    },
    breadth: {
      label: '分析广度',
      options: [
        { value: 'low', label: '聚焦' },
        { value: 'normal', label: '标准' },
        { value: 'high', label: '全面' },
      ],
    },
    speed: {
      label: '分析速度',
      options: [
        { value: 'high', label: '优先速度' },
        { value: 'normal', label: '平衡' },
        { value: 'low', label: '优先质量' },
      ],
    },
    source: {
      label: '来源要求',
      options: [
        { value: 'low', label: '宽松' },
        { value: 'normal', label: '标准' },
        { value: 'high', label: '严格' },
      ],
    },
  };

  const handleSubmit = () => {
    onSubmit({ aspect, value });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-700">
          设置您的分析偏好，系统将根据您的偏好调整分析策略
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">偏好维度</label>
        <Select value={aspect} onValueChange={setAspect}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(aspectLabels).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">
          {aspectLabels[aspect].label}偏好
        </label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {aspectLabels[aspect].options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button className="w-full" onClick={handleSubmit}>
        保存偏好
      </Button>
    </div>
  );
}

// 策略状态显示组件
export function StrategyStatusCard({ strategy }: { strategy: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sliders className="h-5 w-5" />
          当前分析策略
        </CardTitle>
        <CardDescription>
          基于反馈动态优化的分析参数
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-500">搜索深度</div>
            <div className="font-bold">{strategy.searchDepth}/10</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-500">搜索广度</div>
            <div className="font-bold">{strategy.searchBreadth}</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-500">因果链深度</div>
            <div className="font-bold">{strategy.causalDepth}</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-500">场景数量</div>
            <div className="font-bold">{strategy.scenarioCount}</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-500">权威性权重</div>
            <div className="font-bold">{(strategy.authorityWeight * 100).toFixed(0)}%</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-gray-500">时效性权重</div>
            <div className="font-bold">{(strategy.freshnessWeight * 100).toFixed(0)}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default FeedbackPanel;
