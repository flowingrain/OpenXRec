'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  HelpCircle,
  MessageSquare,
  Send,
  SkipForward,
  CheckCircle2,
} from 'lucide-react';
import type { ClarificationOutput } from '@/lib/recommendation/response-templates/types';

interface ClarificationFormProps {
  data: ClarificationOutput;
  config?: {
    showProgress?: boolean;
    allowSkip?: boolean;
    compact?: boolean;
  };
  onSubmit?: (answers: Record<string, string | string[]>) => void;
  onSkip?: () => void;
}

/**
 * 追问表单组件
 * 
 * 用于信息不足时向用户追问
 */
export function ClarificationForm({
  data,
  config = {},
  onSubmit,
  onSkip,
}: ClarificationFormProps) {
  const { showProgress = true, allowSkip = true, compact = false } = config;

  const questions = data.questions || [];
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({});
  const [currentQuestion, setCurrentQuestion] = React.useState(0);
  const [submitted, setSubmitted] = React.useState(false);

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(answers);
    }
    setSubmitted(true);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  const allRequiredAnswered = questions
    .filter((q) => q.required)
    .every((q) => {
      const answer = answers[q.id];
      return answer && (Array.isArray(answer) ? answer.length > 0 : answer.trim());
    });

  // 已提交状态
  if (submitted) {
    return (
      <Card className="w-full overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">感谢您的回答</h3>
            <p className="text-sm text-muted-foreground">
              正在为您生成更精准的推荐...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-amber-600" />
          需要更多信息
        </CardTitle>
        {data.guidance && (
          <p className="text-sm text-muted-foreground mt-2">{data.guidance}</p>
        )}
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* 进度条 */}
        {showProgress && questions.length > 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">问题进度</span>
              <span className="font-medium">
                {currentQuestion + 1} / {questions.length}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 已提取的信息 */}
        {data.extractedInfo && data.extractedInfo.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">已了解的信息</h3>
            <div className="flex flex-wrap gap-2">
              {data.extractedInfo.map((info, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {info}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 问题列表 */}
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className={`space-y-3 ${
                showProgress && index !== currentQuestion ? 'hidden' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Label htmlFor={question.id} className="font-medium">
                  {question.question}
                </Label>
                {question.required && (
                  <Badge variant="destructive" className="text-xs">
                    必填
                  </Badge>
                )}
                {question.priority === 'high' && (
                  <Badge variant="outline" className="text-xs">
                    重要
                  </Badge>
                )}
              </div>

              {/* 单选 */}
              {question.type === 'single_choice' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <button
                      key={optIndex}
                      onClick={() => handleAnswerChange(question.id, option)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all ${
                        answers[question.id] === option
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                          : 'border-border hover:border-amber-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {/* 多选 */}
              {question.type === 'multiple_choice' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => {
                    const selected = (answers[question.id] as string[])?.includes(option);
                    return (
                      <button
                        key={optIndex}
                        onClick={() => {
                          const current = (answers[question.id] as string[]) || [];
                          const updated = selected
                            ? current.filter((v) => v !== option)
                            : [...current, option];
                          handleAnswerChange(question.id, updated);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all ${
                          selected
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                            : 'border-border hover:border-amber-300'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 文本输入 */}
              {question.type === 'text' && (
                <Input
                  id={question.id}
                  placeholder={question.placeholder}
                  value={(answers[question.id] as string) || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="w-full"
                />
              )}

              {/* 范围选择 */}
              {question.type === 'range' && (
                <div className="space-y-2">
                  <Input
                    type="range"
                    id={question.id}
                    placeholder={question.placeholder}
                    value={(answers[question.id] as string) || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {question.placeholder}
                  </p>
                </div>
              )}

              {/* 日期选择 */}
              {question.type === 'date' && (
                <Input
                  type="date"
                  id={question.id}
                  value={(answers[question.id] as string) || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="w-full"
                />
              )}

              {/* 导航按钮 */}
              {showProgress && questions.length > 1 && (
                <div className="flex justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                    disabled={currentQuestion === 0}
                  >
                    上一题
                  </Button>
                  {currentQuestion < questions.length - 1 ? (
                    <Button
                      size="sm"
                      onClick={() => setCurrentQuestion(currentQuestion + 1)}
                      disabled={
                        question.required &&
                        !answers[question.id]
                      }
                    >
                      下一题
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 建议的回答方式 */}
        {data.suggestedAnswers && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                您可以这样回答
              </h3>
              <p className="text-sm text-muted-foreground">{data.suggestedAnswers}</p>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t bg-muted/30">
        {allowSkip ? (
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-2" />
            跳过
          </Button>
        ) : (
          <div />
        )}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!allRequiredAnswered}
        >
          <Send className="h-4 w-4 mr-2" />
          提交回答
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ClarificationForm;
