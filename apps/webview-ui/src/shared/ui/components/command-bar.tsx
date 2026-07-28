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
      {/* One button, two shapes. Below `sm` it collapses to a 32px square with
          just the icon: the palette used to be hidden outright on touch, which
          left phones with no way into it at all. */}
      <Button
        variant="outline"
        aria-label="Search"
        onClick={openBar}
        className="size-8 justify-center p-0 text-muted-foreground sm:w-56 sm:justify-between sm:px-2.5"
      >
        <span className="flex items-center gap-1.5">
          <SearchIcon className="size-3.5" />
          <span className="hidden text-[13px] sm:inline">Search</span>
        </span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
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
