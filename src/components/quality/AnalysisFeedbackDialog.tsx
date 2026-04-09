'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Lightbulb,
  X,
} from 'lucide-react';

interface AnalysisFeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string | null;
  topic: string;
  modelConfidence?: number; // 模型置信度 (0-1)
  onSubmit: (feedback: FeedbackData) => void;
}

export interface FeedbackData {
  rating: number;
  helpful: boolean;
  comments: string;
  suggestions: string;
}

// 星级评分组件
function StarRating({ 
  value, 
  onChange,
  size = 'lg'
}: { 
  value: number; 
  onChange: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const starSize = size === 'lg' ? 'h-8 w-8' : size === 'md' ? 'h-6 w-6' : 'h-4 w-4';
  
  const ratingLabels = ['', '很差', '较差', '一般', '较好', '很好'];
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} cursor-pointer transition-all duration-150 ${
              star <= (hovered || value)
                ? 'text-yellow-400 fill-yellow-400 scale-110'
                : 'text-gray-300 hover:text-yellow-200'
            }`}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
          />
        ))}
      </div>
      {(hovered || value) > 0 && (
        <span className="text-sm text-muted-foreground animate-fade-in">
          {ratingLabels[hovered || value]}
        </span>
      )}
    </div>
  );
}

export function AnalysisFeedbackDialog({
  isOpen,
  onClose,
  caseId,
  topic,
  modelConfidence = 0.8,
  onSubmit
}: AnalysisFeedbackDialogProps) {
  const [rating, setRating] = useState(3);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [showThankYou, setShowThankYou] = useState(false);
  
  // 根据模型置信度设置默认评分
  const defaultRating = useMemo(() => {
    // 将置信度 (0-1) 映射到评分 (1-5)
    // 0.9+ -> 5
    // 0.7-0.9 -> 4
    // 0.5-0.7 -> 3
    // 0.3-0.5 -> 2
    // <0.3 -> 1
    if (modelConfidence >= 0.9) return 5;
    if (modelConfidence >= 0.7) return 4;
    if (modelConfidence >= 0.5) return 3;
    if (modelConfidence >= 0.3) return 2;
    return 1;
  }, [modelConfidence]);
  
  // 初始化默认评分
  useEffect(() => {
    if (isOpen) {
      setRating(defaultRating);
      setHelpful(null);
      setComments('');
      setSuggestions('');
      setShowThankYou(false);
    }
  }, [isOpen, defaultRating]);
  
  const handleSubmit = () => {
    onSubmit({
      rating,
      helpful: helpful ?? true,
      comments,
      suggestions
    });
    setShowThankYou(true);
    
    // 2秒后自动关闭
    setTimeout(() => {
      onClose();
    }, 2000);
  };
  
  const handleSkip = () => {
    // 提交默认评分但不带其他反馈
    onSubmit({
      rating: defaultRating,
      helpful: true,
      comments: '',
      suggestions: ''
    });
    onClose();
  };
  
  if (showThankYou) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <ThumbsUp className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">感谢您的反馈！</h3>
            <p className="text-muted-foreground text-center">
              您的反馈将帮助我们改进分析质量
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            分析质量反馈
          </DialogTitle>
          <DialogDescription>
            请对本次分析结果进行评价，您的反馈将用于优化分析质量
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* 分析主题 */}
          <div className="bg-muted/50 rounded-lg p-3">
            <span className="text-xs text-muted-foreground">分析主题</span>
            <p className="font-medium text-sm mt-1 line-clamp-2">{topic}</p>
          </div>
          
          {/* 评分 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">整体评分</label>
              <span className="text-xs text-muted-foreground">
                模型置信度: {(modelConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-center py-2">
              <StarRating value={rating} onChange={setRating} />
            </div>
          </div>
          
          {/* 是否有帮助 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">分析结果是否有帮助？</label>
            <div className="flex gap-3">
              <Button
                variant={helpful === true ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setHelpful(true)}
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                有帮助
              </Button>
              <Button
                variant={helpful === false ? 'destructive' : 'outline'}
                className="flex-1"
                onClick={() => setHelpful(false)}
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                需改进
              </Button>
            </div>
          </div>
          
          {/* 意见建议 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              <MessageSquare className="h-4 w-4 inline mr-1" />
              其他意见（可选）
            </label>
            <Textarea
              placeholder="请输入您的意见或建议..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
          </div>
          
          {/* 改进建议 */}
          {helpful === false && (
            <div className="space-y-3">
              <label className="text-sm font-medium">
                <Lightbulb className="h-4 w-4 inline mr-1" />
                改进建议
              </label>
              <Textarea
                placeholder="请告诉我们哪些方面需要改进..."
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>
        
        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="ghost" onClick={handleSkip}>
            跳过
          </Button>
          <Button onClick={handleSubmit}>
            提交反馈
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
