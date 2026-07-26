'use client';

import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import CommandBarDialog from './command-bar-dialog';
import { Button } from './ui/button';

export default function CommandBar() {
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
        className="w-80 justify-between hidden can-hover:sm:flex"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-1.5">
          <SearchIcon />
          <span>Search</span>
        </div>
        <span className="opacity-50">⌘K</span>
      </Button>

      <CommandBarDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
