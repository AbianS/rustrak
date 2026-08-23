/**
 * The library's symbols, re-exported under the names it gave them.
 *
 * `icon-catalog.ts` decides what each one *means* in Rustrak; this file is the
 * only thing in the package that knows what they are called upstream. Together
 * with `lucide.tsx` it is the whole surface a change of icon library touches.
 *
 * A re-export and not an object: the inferred type of an object literal of 57
 * components names `ForwardRefExoticComponent` and `RefAttributes`, which this
 * file never imports, and `tsdown` cannot write that into the declaration file
 * (TS2883). A re-export forwards the declarations and has nothing to infer.
 */
export {
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
  Undo2,
  User,
  Users,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
