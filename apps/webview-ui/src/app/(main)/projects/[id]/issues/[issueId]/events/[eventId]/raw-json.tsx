'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface RawJsonProps {
  data: Record<string, unknown>;
}

export function RawJson({ data }: RawJsonProps) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="mr-1 size-3 text-primary" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 size-3" />
              Copy JSON
            </>
          )}
        </Button>
      </div>

      <div className="bg-zinc-100 dark:bg-zinc-900 border rounded-lg p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
        <pre className="text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre">
          {jsonString}
        </pre>
      </div>
    </div>
  );
}
