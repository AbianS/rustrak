"use client";

import Fuse from "fuse.js";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { PlatformIcon } from "platformicons";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Kbd, KbdGroup } from "./ui/kbd";
import { CommandItem, COMMANDS, getProjectCommands } from "@/lib/command-bar";

/** "New project" -> "np", so acronym-style queries match. */
function initials(label: string) {
  return label
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toLowerCase();
}

interface CommandBarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandBarDialog({
  open,
  onOpenChange,
}: CommandBarDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [projectCommands, setProjectCommands] = useState<CommandItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    getProjectCommands().then((commands) => {
      if (cancelled) return;
      setProjectCommands(commands);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const commands = useMemo(
    () => [...projectCommands, ...COMMANDS],
    [projectCommands],
  );

  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: [
          { name: "label", weight: 2 },
          {
            name: "initials",
            weight: 1,
            getFn: (command) => initials(command.label),
          },
          { name: "category", weight: 0.5 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [commands],
  );

  const results = useMemo(() => {
    const needle = query.trim();
    if (!needle) return commands;
    return fuse.search(needle).map((result) => result.item);
  }, [query, commands, fuse]);

  // Results can grow while the bar is open (projects arriving) or shrink as the
  // query narrows, so keep the highlight inside the list.
  const active =
    results.length === 0 ? 0 : Math.min(activeIndex, results.length - 1);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  };

  const select = (command: CommandItem) => {
    handleOpenChange(false);
    router.push(command.href);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((active + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((active - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[active];
      if (command) select(command);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="top-24 max-w-lg translate-y-0 gap-0 p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command bar</DialogTitle>
        <DialogDescription className="sr-only">
          Search for a page and press enter to navigate to it.
        </DialogDescription>

        <div className="flex items-center gap-2 border-b border-border px-4">
          <SearchIcon className="size-4 shrink-0 opacity-50" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search..."
            aria-label="Search"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No results found.
            </p>
          ) : (
            results.map((command, index) => (
              <button
                key={command.href}
                type="button"
                onClick={() => select(command)}
                onMouseMove={() => setActiveIndex(index)}
                className={cn(
                  "flex p-2 gap-1.5 rounded-md w-full justify-between hover:bg-transparent hover:text-inherit dark:hover:bg-transparent",
                  active === index &&
                    "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/10",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {command.platform === undefined ? (
                    <command.icon className="size-4 opacity-70" />
                  ) : (
                    <PlatformIcon
                      platform={command.platform ?? "other"}
                      size={16}
                      format="lg"
                      className="shrink-0 rounded-xs"
                    />
                  )}
                  {command.label}
                </span>
                <span className="opacity-35">{command.category}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <KbdGroup>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
            </KbdGroup>
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            to select
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>esc</Kbd>
            to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
