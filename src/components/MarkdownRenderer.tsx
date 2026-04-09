/**
 * Markdown 渲染组件
 * 用于聊天消息中的 Markdown 内容渲染
 */

'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown 渲染器
 * 临时简化版，直接显示文本内容
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className
}: MarkdownRendererProps) {
  return (
    <div className={cn('prose prose-sm prose-slate max-w-none dark:prose-invert', className)}>
      {content}
    </div>
  );
});

export default MarkdownRenderer;
