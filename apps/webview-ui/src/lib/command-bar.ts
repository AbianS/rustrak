import { getProjects } from "@/actions/projects";
import {
  AlertCircleIcon,
  BellIcon,
  BotIcon,
  DatabaseIcon,
  FolderIcon,
  InfoIcon,
  KeyIcon,
  KeyRoundIcon,
  PaletteIcon,
  PlugIcon,
  PlusIcon,
  RocketIcon,
  ScrollTextIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UserIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

export type CommandItem = {
  label: string;
  href: string;
  category: "Settings" | "Projects" | "Project" | ({} & string);
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

export async function getProjectCommands(): Promise<CommandItem[]> {
  const projects = await getProjects({ per_page: 100 });
  return projects.items.flatMap((project) => {
    const base = `/projects/${project.id}`;

    const pages: { label: string; segment: string; icon: typeof FolderIcon }[] = [
      { label: "Issues", segment: "/issues", icon: AlertCircleIcon },
      { label: "Releases", segment: "/releases", icon: RocketIcon },
      { label: "Performance", segment: "/performance", icon: ZapIcon },
      { label: "Agents", segment: "/agents", icon: BotIcon },
      { label: "Logs", segment: "/logs", icon: ScrollTextIcon },
      {
        label: "General settings",
        segment: "/settings/general",
        icon: SlidersHorizontalIcon,
      },
      { label: "Alerts", segment: "/settings/alerts", icon: BellIcon },
      { label: "Members", segment: "/settings/members", icon: UsersIcon },
      {
        label: "Client keys",
        segment: "/settings/client-keys",
        icon: KeyRoundIcon,
      },
    ];

    return [
      {
        label: project.name,
        href: base,
        category: "Project",
        icon: FolderIcon,
      },
      ...pages.map((page) => ({
        label: page.label,
        href: `${base}${page.segment}`,
        category: project.name,
        icon: page.icon,
      })),
    ];
  });
}
