'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme as 'light' | 'dark' | 'system'}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error:
            'group-[.toaster]:bg-destructive group-[.toaster]:text-destructive-foreground group-[.toaster]:border-destructive',
          success: 'group-[.toaster]:border-green-500',
        },
      }}
    />
  );
}
