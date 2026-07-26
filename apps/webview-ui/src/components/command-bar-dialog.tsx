"use client";

import {
  FolderIcon,
  SearchIcon,
  SettingsIcon,
  SunMoonIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getProjects } from "@/actions/projects";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface CommandItem {
  label: string;
  href: string;
  category: "Settings" | "Projects" | "Project";
  icon: typeof SearchIcon;
}

const COMMANDS: CommandItem[] = [
  {
    label: "Projects",
    href: "/projects",
    category: "Projects",
    icon: FolderIcon,
  },
  {
    label: "New project",
    href: "/projects/new",
    category: "Projects",
    icon: FolderIcon,
  },
  {
    label: "API tokens",
    href: "/settings/tokens",
    category: "Settings",
    icon: SettingsIcon,
  },
  {
    label: "Account",
    href: "/settings/account",
    category: "Settings",
    icon: SettingsIcon,
  },
  {
    label: "Appearance",
    href: "/settings/appearance",
    category: "Settings",
    icon: SunMoonIcon,
  },
];

const KBD =
  "flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans";

interface CommandBarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function searchify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function CommandBarDialog({
  open,
  onOpenChange,
}: CommandBarDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [projectCommands, setProjectCommands] = useState<CommandItem[]>([]);

  // Warm the project list in the background so it is already there the first
  // time the bar is opened.
  useEffect(() => {
    let cancelled = false;

    getProjects({ per_page: 100 })
      .then((response) => {
        if (cancelled) return;
        setProjectCommands(
          response.items.map((project) => ({
            label: project.name,
            href: `/projects/${project.id}`,
            category: "Project",
            icon: FolderIcon,
          })),
        );
      })
      .catch(() => {
        // Projects are an enhancement here; the static commands still work.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const commands = [...projectCommands, ...COMMANDS];
    const needle = searchify(query);
    if (!needle) return commands;
    return commands.filter((command) =>
      searchify(command.label).includes(needle),
    );
  }, [query, projectCommands]);

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
              <Button
                key={command.href}
                type="button"
                variant="primary-ghost"
                onClick={() => select(command)}
                onMouseMove={() => setActiveIndex(index)}
                className={cn(
                  "w-full justify-between",
                  active === index && "bg-primary/10 text-primary",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <command.icon className="size-4 opacity-70" />
                  {command.label}
                </span>
                <span className="opacity-35">{command.category}</span>
              </Button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className={KBD}>↑</kbd>
            <kbd className={KBD}>↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className={KBD}>↵</kbd>
            to select
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className={KBD}>esc</kbd>
            to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
