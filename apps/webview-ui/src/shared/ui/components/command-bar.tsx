'use client';

import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CommandProject } from '@/shared/config/commands';
import CommandBarDialog from './command-bar-dialog';
import { Button } from './shadcn/button';
import { Kbd } from './shadcn/kbd';

interface CommandBarProps {
  /** Built per request from the projects the viewer can see. */
  projects: CommandProject[];
}

export default function CommandBar({ projects }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  /**
   * Bumped on every open, and used as the dialog's `key`, so each open gets a
   * brand new component instance.
   *
   * This is the reset. The query, the highlighted row, whether the preview
   * column is showing and where the list is scrolled are all just initial
   * state on a fresh mount, so none of them need clearing by hand on the way
   * out. It is bumped when *opening* rather than derived from `open`, because
   * keying on `open` would tear the dialog out mid close animation.
   */
  const [session, setSession] = useState(0);

  const openBar = () => {
    setSession((count) => count + 1);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (open) setOpen(false);
      else openBar();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        variant="outline"
        className="hidden w-40 justify-between text-muted-foreground can-hover:flex sm:w-80"
        onClick={openBar}
      >
        <span className="flex items-center gap-1.5">
          <SearchIcon />
          Search
        </span>
        <Kbd>⌘K</Kbd>
      </Button>

      <CommandBarDialog
        key={session}
        open={open}
        onOpenChange={setOpen}
        projects={projects}
      />
    </>
  );
}
