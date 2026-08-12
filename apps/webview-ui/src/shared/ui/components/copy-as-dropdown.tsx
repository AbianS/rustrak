'use client';

import { Check, ChevronDown, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/components/shadcn/dropdown-menu';

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
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (format: CopyAsFormat) => {
    if (!(await copyToClipboard(format.value))) {
      toast.info(t('clipboardUnavailable'), {
        description: t('clipboardUnavailableHint'),
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
        {t('copyAs')}
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
