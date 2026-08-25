import { fromLucide } from './adapters/lucide';
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
} from './adapters/lucide-symbols';
import type { IconComponent } from './icon';

/**
 * The system's icon catalogue.
 *
 * Components and applications import from here, never from the library. The
 * name says what the icon *means* in Rustrak -- `issue`, `release`, `mute`,
 * `overflow` -- not what it draws, so changing the glyph does not force anyone
 * who uses it to change anything.
 *
 * The set is deliberately small. Every icon the product draws is here and
 * nothing else is: a catalogue that grows by accident is how a product ends up
 * with
 * three different check marks.
 */

/* --- Navigation · the sidebar's seven destinations ------------------------ */

export const OverviewIcon = /* @__PURE__ */ fromLucide(
  'OverviewIcon',
  LayoutDashboard,
);
export const IssuesIcon = /* @__PURE__ */ fromLucide('IssuesIcon', CircleAlert);
export const ReleasesIcon = /* @__PURE__ */ fromLucide('ReleasesIcon', Rocket);
export const PerformanceIcon = /* @__PURE__ */ fromLucide(
  'PerformanceIcon',
  Zap,
);
export const AgentsIcon = /* @__PURE__ */ fromLucide('AgentsIcon', Bot);
export const LogsIcon = /* @__PURE__ */ fromLucide('LogsIcon', ScrollText);
export const SettingsIcon = /* @__PURE__ */ fromLucide(
  'SettingsIcon',
  Settings,
);

/* --- Directions ----------------------------------------------------------- */

export const ChevronRightIcon = /* @__PURE__ */ fromLucide(
  'ChevronRightIcon',
  ChevronRight,
);
export const ChevronLeftIcon = /* @__PURE__ */ fromLucide(
  'ChevronLeftIcon',
  ChevronLeft,
);
export const ChevronDownIcon = /* @__PURE__ */ fromLucide(
  'ChevronDownIcon',
  ChevronDown,
);
export const ChevronUpIcon = /* @__PURE__ */ fromLucide(
  'ChevronUpIcon',
  ChevronUp,
);
/** The two-arrow chevron of a thing you can switch: the project card. */
export const SelectorIcon = /* @__PURE__ */ fromLucide(
  'SelectorIcon',
  ChevronsUpDown,
);
export const CollapsePanelIcon = /* @__PURE__ */ fromLucide(
  'CollapsePanelIcon',
  ChevronsLeft,
);
export const ExpandPanelIcon = /* @__PURE__ */ fromLucide(
  'ExpandPanelIcon',
  ChevronsRight,
);
export const PanelLeftIcon = /* @__PURE__ */ fromLucide(
  'PanelLeftIcon',
  PanelLeft,
);
export const PanelRightIcon = /* @__PURE__ */ fromLucide(
  'PanelRightIcon',
  PanelRight,
);
export const ArrowRightIcon = /* @__PURE__ */ fromLucide(
  'ArrowRightIcon',
  ArrowRight,
);
/** A figure that went up. In this product that is usually bad news. */
export const TrendUpIcon = /* @__PURE__ */ fromLucide(
  'TrendUpIcon',
  ArrowUpRight,
);
export const TrendDownIcon = /* @__PURE__ */ fromLucide(
  'TrendDownIcon',
  ArrowDownRight,
);
export const CompareIcon = /* @__PURE__ */ fromLucide(
  'CompareIcon',
  ArrowLeftRight,
);

/* --- Actions -------------------------------------------------------------- */

export const SearchIcon = /* @__PURE__ */ fromLucide('SearchIcon', Search);
export const FilterIcon = /* @__PURE__ */ fromLucide('FilterIcon', ListFilter);
export const FacetsIcon = /* @__PURE__ */ fromLucide(
  'FacetsIcon',
  SlidersHorizontal,
);
export const ColumnsIcon = /* @__PURE__ */ fromLucide('ColumnsIcon', Columns3);
export const NewIcon = /* @__PURE__ */ fromLucide('NewIcon', Plus);
export const RemoveIcon = /* @__PURE__ */ fromLucide('RemoveIcon', Minus);
export const CloseIcon = /* @__PURE__ */ fromLucide('CloseIcon', X);
export const CopyIcon = /* @__PURE__ */ fromLucide('CopyIcon', Copy);
export const ExportIcon = /* @__PURE__ */ fromLucide('ExportIcon', Download);
export const RefreshIcon = /* @__PURE__ */ fromLucide('RefreshIcon', RefreshCw);
export const DeleteIcon = /* @__PURE__ */ fromLucide('DeleteIcon', Trash2);
export const OverflowIcon = /* @__PURE__ */ fromLucide(
  'OverflowIcon',
  EllipsisVertical,
);
/** The horizontal ellipsis, for a row's inline menu. */
export const MoreIcon = /* @__PURE__ */ fromLucide('MoreIcon', Ellipsis);
export const MenuIcon = /* @__PURE__ */ fromLucide('MenuIcon', Menu);
export const ExternalLinkIcon = /* @__PURE__ */ fromLucide(
  'ExternalLinkIcon',
  ExternalLink,
);
export const LinkIcon = /* @__PURE__ */ fromLucide('LinkIcon', Link);
export const AssignIcon = /* @__PURE__ */ fromLucide('AssignIcon', Users);
export const SaveViewIcon = /* @__PURE__ */ fromLucide(
  'SaveViewIcon',
  Bookmark,
);
export const StarIcon = /* @__PURE__ */ fromLucide('StarIcon', Star);
export const CommentIcon = /* @__PURE__ */ fromLucide(
  'CommentIcon',
  MessageSquare,
);
export const AutofixIcon = /* @__PURE__ */ fromLucide('AutofixIcon', Sparkles);
export const ConfigureIcon = /* @__PURE__ */ fromLucide(
  'ConfigureIcon',
  Wrench,
);

/* --- Issue lifecycle ------------------------------------------------------
   The three verbs an issue understands. `resolve` is a plain check because it
   is the primary action on the detail screen and shares the button with the
   label; `mute` is the crossed speaker, which is what silencing looks like
   everywhere else. */

export const ResolveIcon = /* @__PURE__ */ fromLucide('ResolveIcon', Check);
export const MuteIcon = /* @__PURE__ */ fromLucide('MuteIcon', VolumeX);
export const UnresolveIcon = /* @__PURE__ */ fromLucide(
  'UnresolveIcon',
  CircleX,
);
/** Take it back: the action an undo toast carries. */
export const UndoIcon = /* @__PURE__ */ fromLucide('UndoIcon', Undo2);

/* --- Severity and status --------------------------------------------------
   `error` is the crossed circle, `warning` the triangle, `ok` the ticked
   circle. Shape, not only colour: severity has to survive being printed in
   grey. */

export const ErrorIcon = /* @__PURE__ */ fromLucide('ErrorIcon', CircleX);
export const WarningIcon = /* @__PURE__ */ fromLucide(
  'WarningIcon',
  TriangleAlert,
);
export const OkIcon = /* @__PURE__ */ fromLucide('OkIcon', CircleCheck);
export const InfoIcon = /* @__PURE__ */ fromLucide('InfoIcon', CircleAlert);
export const SpinnerIcon = /* @__PURE__ */ fromLucide(
  'SpinnerIcon',
  LoaderCircle,
);
export const NotificationIcon = /* @__PURE__ */ fromLucide(
  'NotificationIcon',
  Bell,
);
export const TimeIcon = /* @__PURE__ */ fromLucide('TimeIcon', Clock);
export const EmptyIcon = /* @__PURE__ */ fromLucide('EmptyIcon', Inbox);
export const WatchIcon = /* @__PURE__ */ fromLucide('WatchIcon', Eye);

/* --- Entities -------------------------------------------------------------
   What the data is about, rather than which page shows it. */

export const ReleaseIcon = /* @__PURE__ */ fromLucide('ReleaseIcon', GitBranch);
export const CommitIcon = /* @__PURE__ */ fromLucide(
  'CommitIcon',
  GitCommitHorizontal,
);
export const MergeIcon = /* @__PURE__ */ fromLucide('MergeIcon', GitMerge);
export const EnvironmentIcon = /* @__PURE__ */ fromLucide(
  'EnvironmentIcon',
  Server,
);
export const MemberIcon = /* @__PURE__ */ fromLucide('MemberIcon', User);
export const TeamIcon = /* @__PURE__ */ fromLucide('TeamIcon', Users);

/**
 * The same icons reachable by name, for navigation and action bars that are
 * described with data instead of JSX.
 */
export const icons = {
  overview: OverviewIcon,
  issues: IssuesIcon,
  releases: ReleasesIcon,
  performance: PerformanceIcon,
  agents: AgentsIcon,
  logs: LogsIcon,
  settings: SettingsIcon,
  chevronRight: ChevronRightIcon,
  chevronLeft: ChevronLeftIcon,
  chevronDown: ChevronDownIcon,
  chevronUp: ChevronUpIcon,
  selector: SelectorIcon,
  collapsePanel: CollapsePanelIcon,
  expandPanel: ExpandPanelIcon,
  panelLeft: PanelLeftIcon,
  panelRight: PanelRightIcon,
  arrowRight: ArrowRightIcon,
  trendUp: TrendUpIcon,
  trendDown: TrendDownIcon,
  compare: CompareIcon,
  search: SearchIcon,
  filter: FilterIcon,
  facets: FacetsIcon,
  columns: ColumnsIcon,
  new: NewIcon,
  remove: RemoveIcon,
  close: CloseIcon,
  copy: CopyIcon,
  export: ExportIcon,
  refresh: RefreshIcon,
  delete: DeleteIcon,
  overflow: OverflowIcon,
  more: MoreIcon,
  menu: MenuIcon,
  externalLink: ExternalLinkIcon,
  link: LinkIcon,
  assign: AssignIcon,
  saveView: SaveViewIcon,
  star: StarIcon,
  comment: CommentIcon,
  autofix: AutofixIcon,
  configure: ConfigureIcon,
  resolve: ResolveIcon,
  mute: MuteIcon,
  unresolve: UnresolveIcon,
  undo: UndoIcon,
  error: ErrorIcon,
  warning: WarningIcon,
  ok: OkIcon,
  info: InfoIcon,
  spinner: SpinnerIcon,
  notification: NotificationIcon,
  time: TimeIcon,
  empty: EmptyIcon,
  watch: WatchIcon,
  release: ReleaseIcon,
  commit: CommitIcon,
  merge: MergeIcon,
  environment: EnvironmentIcon,
  member: MemberIcon,
  team: TeamIcon,
} as const satisfies Record<string, IconComponent>;

export type IconName = keyof typeof icons;
