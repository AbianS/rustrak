import { FolderIcon, KeyIcon, PlusIcon, SettingsIcon, SunMoonIcon } from "lucide-react";

export type CommandItem = {
  label: string;
  href: string;
  category: "Settings" | "Projects" | "Project";
  icon: typeof SettingsIcon;
};

export const COMMANDS: CommandItem[] = [
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
    icon: PlusIcon,
  },
  {
    label: "API tokens",
    href: "/settings/tokens",
    category: "Settings",
    icon: KeyIcon,
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
