'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SettingsNav } from './settings-nav';

export function SettingsMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">Open settings menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-6">
        <SheetHeader className="p-0 mb-4">
          <SheetTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Settings
          </SheetTitle>
        </SheetHeader>
        <SettingsNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
