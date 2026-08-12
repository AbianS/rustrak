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
import { ProjectSettingsNav } from './settings-nav';

interface ProjectSettingsMobileNavProps {
  projectId: number;
}

export function ProjectSettingsMobileNav({
  projectId,
}: ProjectSettingsMobileNavProps) {
  const t = useTranslations('settings');
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu className="size-5" />
        <span className="sr-only">{t('nav.openProjectSettingsMenu')}</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-6">
        <SheetHeader className="mb-4 p-0">
          <SheetTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('nav.projectSettingsTitle')}
          </SheetTitle>
        </SheetHeader>
        <ProjectSettingsNav
          projectId={projectId}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
