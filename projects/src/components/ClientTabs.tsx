'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ClientTabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export default function ClientTabs({
  defaultValue = 'chat',
  value,
  onValueChange,
  className,
  children,
}: ClientTabsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[400px] ${className || ''}`}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">正在加载...</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
}
