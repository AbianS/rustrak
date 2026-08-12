'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/components/shadcn/sheet';
import { SettingsNav } from './settings-nav';

interface SettingsMobileNavProps {
  isAdmin?: boolean;
}

export function SettingsMobileNav({ isAdmin }: SettingsMobileNavProps) {
  const t = useTranslations('settings');
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu className="size-5" />
        <span className="sr-only">{t('nav.openSettingsMenu')}</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-6">
        <SheetHeader className="p-0 mb-4">
          <SheetTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('nav.settingsTitle')}
          </SheetTitle>
        </SheetHeader>
        <SettingsNav onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
      </SheetContent>
    </Sheet>
  );
}
