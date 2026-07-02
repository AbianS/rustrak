'use client';

import { Check, ChevronDown, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { copyToClipboard } from '@/lib/clipboard';

interface CopyAsFormat {
  label: string;
  /** Precomputed text, not a function — this component may be rendered from
   * a Server Component, and functions can't cross that boundary as props. */
  value: string;
}

interface CopyAsDropdownProps {
  formats: CopyAsFormat[];
}

/** "Copy as ..." dropdown for section headers (Stack Trace, Breadcrumbs). */
export function CopyAsDropdown({ formats }: CopyAsDropdownProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (format: CopyAsFormat) => {
    if (!(await copyToClipboard(format.value))) {
      toast.info('Clipboard unavailable', {
        description:
          'Select the content and copy it manually, or access Rustrak over HTTPS.',
      });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" type="button" />}
      >
        {copied ? (
          <Check className="mr-1 size-3 text-primary" />
        ) : (
          <Copy className="mr-1 size-3" />
        )}
        Copy as
        <ChevronDown className="ml-1 size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => (
          <DropdownMenuItem
            key={format.label}
            onClick={() => handleCopy(format)}
          >
            {format.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
