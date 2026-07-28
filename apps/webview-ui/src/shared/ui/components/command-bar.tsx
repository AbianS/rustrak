'use client';

import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CommandItem } from '@/shared/config/commands';
import CommandBarDialog from './command-bar-dialog';
import { Button } from './shadcn/button';

interface CommandBarProps {
  /** Built per request from the projects the viewer can see. */
  projectCommands: CommandItem[];
}

export default function CommandBar({ projectCommands }: CommandBarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="w-40 sm:w-80 justify-between hidden can-hover:flex"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-1.5">
          <SearchIcon />
          <span>Search</span>
        </div>
        <span className="opacity-50">⌘K</span>
      </Button>

      <CommandBarDialog
        open={open}
        onOpenChange={setOpen}
        projectCommands={projectCommands}
      />
    </>
  );
}
