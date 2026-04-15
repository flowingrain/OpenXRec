'use client';

import Link from 'next/link';
import { Sparkles, BookOpen, Database, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AuthButton } from '@/components/auth/LoginDialog';

type OpenXRecHeaderProps = {
  onOpenKnowledgeBase: () => void;
  onOpenCases: () => void;
};

export function OpenXRecHeader({
  onOpenKnowledgeBase,
  onOpenCases,
}: OpenXRecHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                OpenXRec
              </h1>
              <p className="text-xs text-muted-foreground">可解释推荐系统</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onOpenKnowledgeBase}>
              <BookOpen className="h-4 w-4" />
              <span className="hidden md:inline">知识库</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onOpenCases}>
              <Database className="h-4 w-4" />
              <span className="hidden md:inline">案例库</span>
            </Button>
            <Link href="/api-docs">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Code className="h-4 w-4" />
                <span className="hidden md:inline">API</span>
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <AuthButton />
          </div>
        </div>
      </div>
    </header>
  );
}
