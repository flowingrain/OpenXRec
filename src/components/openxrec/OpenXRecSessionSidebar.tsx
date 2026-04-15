'use client';

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SessionItem = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

type OpenXRecSessionSidebarProps = {
  sessionList: SessionItem[];
  sessionId: string;
  sessionMessages: Record<string, Array<{ id: string }>>;
  isLoading: boolean;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
};

export function OpenXRecSessionSidebar({
  sessionList,
  sessionId,
  sessionMessages,
  isLoading,
  onNewSession,
  onSwitchSession,
}: OpenXRecSessionSidebarProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              会话列表
            </CardTitle>
            <CardDescription>仅在会话推荐页显示</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onNewSession}>
            新建
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-2">
          <div className="space-y-2">
            {sessionList.map((session, index) => {
              const isActive = session.id === sessionId;
              const sessionMsgCount = sessionMessages[session.id]?.length || 0;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSwitchSession(session.id)}
                  disabled={isLoading && !isActive}
                  className={cn(
                    'w-full text-left rounded-lg border px-3 py-2 transition-colors',
                    isActive ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50 border-slate-200',
                    isLoading && !isActive && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{session.title || `会话 ${index + 1}`}</p>
                    {isActive && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        当前
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sessionMsgCount} 条消息 · {isMounted ? new Date(session.updatedAt).toLocaleTimeString() : '--:--:--'}
                  </p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
