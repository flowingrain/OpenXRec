'use client';

import { Bot, User, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Message } from '@/components/openxrec/types';

type OpenXRecMessageListProps = {
  messages: Message[];
  isLoading: boolean;
  quickExamples: string[];
  questionAnswers: Record<string, string>;
  onExampleClick: (example: string) => void;
  onSelectAnswer: (questionId: string, answer: string) => void;
  onQuickAnswer: (questionId: string, answer: string) => void;
  onSubmitAnswers: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export function OpenXRecMessageList({
  messages,
  isLoading,
  quickExamples,
  questionAnswers,
  onExampleClick,
  onSelectAnswer,
  onQuickAnswer,
  onSubmitAnswers,
  messagesEndRef,
}: OpenXRecMessageListProps) {
  return (
    <div className="flex-1 pr-4 overflow-y-auto">
      <div className="space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <Lightbulb className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-muted-foreground mb-4">
              您好！我是 OpenXRec 推荐助手。请描述您的需求，我会为您提供可解释的推荐。
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {quickExamples.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => onExampleClick(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2',
                message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{String(message.content || '')}</p>

              {message.recommendationType === 'clarification' && message.clarification && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                    <Lightbulb className="w-4 h-4" />
                    需要更多信息
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>信息收集进度</span>
                      <span>{message.clarification.progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${message.clarification.progress}%` }}
                      />
                    </div>
                  </div>
                  {message.clarification.questions && message.clarification.questions.length > 0 ? (
                    <div className="space-y-3">
                      {message.clarification.questions.map((q, i) => {
                        const selectedAnswer = questionAnswers[q.id];
                        return (
                          <div key={q.id || i} className="bg-white p-2 rounded border border-amber-100">
                            <div className="flex items-center gap-1 mb-2">
                              <span className="text-amber-600 font-medium">{i + 1}.</span>
                              <span className="font-medium">{String(q.question || '')}</span>
                              {q.required && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1">
                                  必填
                                </Badge>
                              )}
                              {selectedAnswer && (
                                <Badge variant="default" className="text-[10px] px-1 py-0 ml-auto bg-green-500">
                                  已选
                                </Badge>
                              )}
                            </div>
                            {q.type === 'text' && (
                              <Input
                                placeholder={q.placeholder || '请输入...'}
                                className="h-8 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    onQuickAnswer(q.id, (e.target as HTMLInputElement).value);
                                  }
                                }}
                                onChange={(e) => {
                                  onSelectAnswer(q.id, (e.target as HTMLInputElement).value);
                                }}
                              />
                            )}
                            {q.options && q.options.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {q.options.map((opt, j) => {
                                  const isSelected = selectedAnswer === opt;
                                  return (
                                    <Button
                                      key={j}
                                      variant={isSelected ? 'default' : 'outline'}
                                      size="sm"
                                      className={cn(
                                        'h-7 text-xs transition-all',
                                        isSelected
                                          ? 'bg-amber-500 hover:bg-amber-600 border-amber-500'
                                          : 'hover:bg-amber-100 hover:border-amber-300'
                                      )}
                                      onClick={() => onSelectAnswer(q.id, opt)}
                                    >
                                      {String(opt)}
                                    </Button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {Object.keys(questionAnswers).length > 0 && (
                        <Button
                          onClick={onSubmitAnswers}
                          className="w-full bg-amber-500 hover:bg-amber-600"
                        >
                          提交答案 ({Object.keys(questionAnswers).length}项)
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">请提供更多信息以便给您精准推荐</div>
                  )}
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
