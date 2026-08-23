import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Columns3,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Inbox,
  LayoutDashboard,
  Link,
  ListFilter,
  LoaderCircle,
  type LucideIcon,
  Menu,
  MessageSquare,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
  RefreshCw,
  Rocket,
  ScrollText,
  Search,
  Server,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  User,
  Users,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { type IconComponent, type IconProps, iconVariants } from '../icon';

/**
 * The library's symbols, gathered here and nowhere else.
 *
 * `icon-catalog.ts` names what each one *means* in Rustrak; this object is the
 * only thing in the package that knows what they are called upstream. Switching
 * library means rewriting this file and `fromLucide` below, and not one
 * component finds out.
 */
export const lucide = {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Columns3,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Inbox,
  LayoutDashboard,
  Link,
  ListFilter,
  LoaderCircle,
  Menu,
  MessageSquare,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
  RefreshCw,
  Rocket,
  ScrollText,
  Search,
  Server,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  User,
  Users,
  VolumeX,
  Wrench,
  X,
  Zap,
} as const;

/**
 * Adapter from lucide-react to the `IconComponent` contract.
 *
 * This is the only file in the package that imports `lucide-react`. Switching
 * icon library means writing another adapter with this signature and pointing
 * `icon-catalog.ts` at it; not one component finds out.
 *
 * What it normalises:
 *   - size and stroke become tokens rather than library props;
 *   - the icon is decorative by default (`aria-hidden`), because it almost
 *     always sits beside text a screen reader already announces. Give it an
 *     `aria-label` and it becomes `role="img"` and is announced;
 *   - it is never reachable by tab.
 */
export function fromLucide(
  displayName: string,
  Source: LucideIcon,
): IconComponent {
  function Icon({ size, className, ...props }: IconProps) {
    const labelled = props['aria-label'] != null;

    return (
      <Source
        aria-hidden={labelled ? undefined : true}
        role={labelled ? 'img' : undefined}
        focusable="false"
        {...props}
        className={iconVariants({ size, className })}
      />
    );
  }

  Icon.displayName = displayName;

  return Icon;
}
