"use client";

import {
  FolderIcon,
  SearchIcon,
  SettingsIcon,
  SunMoonIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CommandItem {
  label: string;
  href: string;
  icon: typeof SearchIcon;
}

const COMMANDS: CommandItem[] = [
  { label: "Projects", href: "/projects", icon: FolderIcon },
  { label: "New project", href: "/projects/new", icon: FolderIcon },
  { label: "API tokens", href: "/settings/tokens", icon: SettingsIcon },
  { label: "Account", href: "/settings/account", icon: SettingsIcon },
  { label: "Appearance", href: "/settings/appearance", icon: SunMoonIcon },
];

const KBD =
  "flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans";

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

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COMMANDS;
    return COMMANDS.filter((command) =>
      command.label.toLowerCase().includes(needle),
    );
  }, [query]);

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
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[activeIndex];
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
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
              >
                <command.icon className="size-4 shrink-0 opacity-70" />
                {command.label}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
