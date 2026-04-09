'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  X, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  BookOpen,
  Settings
} from 'lucide-react';
import type { OptimizationSuggestion } from '@/lib/evolution/auto-evolution';

interface OptimizationNotifierProps {
  suggestion: OptimizationSuggestion;
  onDismiss: () => void;
  onApply: () => void;
}

export function OptimizationNotifier({ 
  suggestion, 
  onDismiss, 
  onApply 
}: OptimizationNotifierProps) {
  const getIcon = () => {
    switch (suggestion.type) {
      case 'prompt_improvement':
        return <Sparkles className="h-4 w-4" />;
      case 'knowledge_gap':
        return <BookOpen className="h-4 w-4" />;
      case 'workflow_optimization':
        return <Settings className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };
  
  const getImpactColor = () => {
    switch (suggestion.impact) {
      case 'high':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };
  
  return (
    <Card className="mb-6 border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5 p-2 rounded-full bg-primary/10">
              {getIcon()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{suggestion.title}</span>
                <Badge variant="secondary" className={`text-xs ${getImpactColor()}`}>
                  {suggestion.impact === 'high' ? '高影响' : suggestion.impact === 'medium' ? '中影响' : '低影响'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{suggestion.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {suggestion.autoApplicable && (
              <Button 
                size="sm" 
                variant="default"
                onClick={onApply}
                className="h-7 text-xs"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                应用
              </Button>
            )}
            {!suggestion.autoApplicable && (
              <Button 
                size="sm" 
                variant="outline"
                className="h-7 text-xs"
              >
                查看详情
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onDismiss}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
