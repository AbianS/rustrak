import {
  DatabaseIcon,
  FolderIcon,
  InfoIcon,
  KeyIcon,
  PaletteIcon,
  PlugIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

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
    label: "Integrations",
    href: "/settings/integrations",
    category: "Settings",
    icon: PlugIcon,
  },
  {
    label: "Team",
    href: "/settings/team",
    category: "Settings",
    icon: UsersIcon,
  },
  {
    label: "Storage",
    href: "/settings/storage",
    category: "Settings",
    icon: DatabaseIcon,
  },
  {
    label: "Account",
    href: "/settings/account",
    category: "Settings",
    icon: UserIcon,
  },
  {
    label: "Appearance",
    href: "/settings/appearance",
    category: "Settings",
    icon: PaletteIcon,
  },
  {
    label: "About",
    href: "/settings/about",
    category: "Settings",
    icon: InfoIcon,
  },
];
