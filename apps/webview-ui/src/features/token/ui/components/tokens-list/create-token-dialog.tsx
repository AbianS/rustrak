'use client';

import { Check, Copy, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/components/shadcn/dialog';
import { Input } from '@/shared/ui/components/shadcn/input';
import { Label } from '@/shared/ui/components/shadcn/label';

export const TOKEN_DESCRIPTION_MAX_LENGTH = 200;

/**
 * Creating a token, and then showing the one thing the server will not repeat
 * on demand in this shape: the full value, once.
 *
 * Two states in one dialog because they are two steps of one act. Closing
 * after the value is shown is what refreshes the list, which is why the caller
 * gets `onDone` rather than a plain `onOpenChange`.
 */
export function CreateTokenDialog({
  open,
  onOpenChange,
  newToken,
  isPending,
  onCreate,
  onDone,
  onCopyToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The full value, present only between creating it and closing the dialog. */
  newToken: string | null;
  isPending: boolean;
  onCreate: (description: string) => void;
  onDone: () => void;
  onCopyToken: () => Promise<boolean>;
}) {
  const t = useTranslations('tokens');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  const trimmed = description.trim();
  const isValid = trimmed.length <= TOKEN_DESCRIPTION_MAX_LENGTH;

  const create = () => {
    if (!isValid) return;
    onCreate(trimmed);
    setDescription('');
  };

  const copy = async () => {
    if (!(await onCopyToken())) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button className="font-bold uppercase tracking-wider" />}
      >
        <Plus className="mr-2 size-4" />
        {t('create.trigger')}
      </DialogTrigger>
      <DialogContent>
        {newToken ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('create.createdTitle')}</DialogTitle>
              <DialogDescription>
                {t('create.createdDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
                <code className="flex-1 text-sm font-mono break-all">
                  {newToken}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copy}
                  className="shrink-0"
                  aria-label={t('create.copyTokenLabel')}
                >
                  {copied ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t('create.copyAgainHint')}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={onDone}>{t('create.done')}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('create.title')}</DialogTitle>
              <DialogDescription>{t('create.description')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="description">
                  {t('create.descriptionLabel')}
                </Label>
                <Input
                  id="description"
                  placeholder={t('create.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && create()}
                  // Deliberately above the limit: the field accepts a little
                  // overshoot so the counter can say what is wrong, rather
                  // than silently swallowing keystrokes at the boundary.
                  maxLength={TOKEN_DESCRIPTION_MAX_LENGTH + 10}
                  aria-invalid={!isValid}
                />
                <p className="text-xs text-muted-foreground">
                  {t('create.charCount', {
                    count: trimmed.length,
                    max: TOKEN_DESCRIPTION_MAX_LENGTH,
                  })}
                </p>
                {!isValid && (
                  <p className="text-sm text-destructive">
                    {t('create.descriptionTooLong', {
                      max: TOKEN_DESCRIPTION_MAX_LENGTH,
                    })}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {t('create.cancel')}
              </Button>
              <Button onClick={create} disabled={isPending || !isValid}>
                {isPending ? t('create.creating') : t('create.submit')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
