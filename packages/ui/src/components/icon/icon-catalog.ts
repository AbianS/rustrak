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
  User,
  Users,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { fromLucide } from './adapters/lucide';
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

export const OverviewIcon = fromLucide('OverviewIcon', LayoutDashboard);
export const IssuesIcon = fromLucide('IssuesIcon', CircleAlert);
export const ReleasesIcon = fromLucide('ReleasesIcon', Rocket);
export const PerformanceIcon = fromLucide('PerformanceIcon', Zap);
export const AgentsIcon = fromLucide('AgentsIcon', Bot);
export const LogsIcon = fromLucide('LogsIcon', ScrollText);
export const SettingsIcon = fromLucide('SettingsIcon', Settings);

/* --- Directions ----------------------------------------------------------- */

export const ChevronRightIcon = fromLucide('ChevronRightIcon', ChevronRight);
export const ChevronLeftIcon = fromLucide('ChevronLeftIcon', ChevronLeft);
export const ChevronDownIcon = fromLucide('ChevronDownIcon', ChevronDown);
export const ChevronUpIcon = fromLucide('ChevronUpIcon', ChevronUp);
/** The two-arrow chevron of a thing you can switch: the project card. */
export const SelectorIcon = fromLucide('SelectorIcon', ChevronsUpDown);
export const CollapsePanelIcon = fromLucide('CollapsePanelIcon', ChevronsLeft);
export const ExpandPanelIcon = fromLucide('ExpandPanelIcon', ChevronsRight);
export const PanelLeftIcon = fromLucide('PanelLeftIcon', PanelLeft);
export const PanelRightIcon = fromLucide('PanelRightIcon', PanelRight);
export const ArrowRightIcon = fromLucide('ArrowRightIcon', ArrowRight);
/** A figure that went up. In this product that is usually bad news. */
export const TrendUpIcon = fromLucide('TrendUpIcon', ArrowUpRight);
export const TrendDownIcon = fromLucide('TrendDownIcon', ArrowDownRight);
export const CompareIcon = fromLucide('CompareIcon', ArrowLeftRight);

/* --- Actions -------------------------------------------------------------- */

export const SearchIcon = fromLucide('SearchIcon', Search);
export const FilterIcon = fromLucide('FilterIcon', ListFilter);
export const FacetsIcon = fromLucide('FacetsIcon', SlidersHorizontal);
export const ColumnsIcon = fromLucide('ColumnsIcon', Columns3);
export const NewIcon = fromLucide('NewIcon', Plus);
export const RemoveIcon = fromLucide('RemoveIcon', Minus);
export const CloseIcon = fromLucide('CloseIcon', X);
export const CopyIcon = fromLucide('CopyIcon', Copy);
export const ExportIcon = fromLucide('ExportIcon', Download);
export const RefreshIcon = fromLucide('RefreshIcon', RefreshCw);
export const DeleteIcon = fromLucide('DeleteIcon', Trash2);
export const OverflowIcon = fromLucide('OverflowIcon', EllipsisVertical);
/** The horizontal ellipsis, for a row's inline menu. */
export const MoreIcon = fromLucide('MoreIcon', Ellipsis);
export const MenuIcon = fromLucide('MenuIcon', Menu);
export const ExternalLinkIcon = fromLucide('ExternalLinkIcon', ExternalLink);
export const LinkIcon = fromLucide('LinkIcon', Link);
export const AssignIcon = fromLucide('AssignIcon', Users);
export const SaveViewIcon = fromLucide('SaveViewIcon', Bookmark);
export const StarIcon = fromLucide('StarIcon', Star);
export const CommentIcon = fromLucide('CommentIcon', MessageSquare);
export const AutofixIcon = fromLucide('AutofixIcon', Sparkles);
export const ConfigureIcon = fromLucide('ConfigureIcon', Wrench);

/* --- Issue lifecycle ------------------------------------------------------
   The three verbs an issue understands. `resolve` is a plain check because it
   is the primary action on the detail screen and shares the button with the
   label; `mute` is the crossed speaker, which is what silencing looks like
   everywhere else. */

export const ResolveIcon = fromLucide('ResolveIcon', Check);
export const MuteIcon = fromLucide('MuteIcon', VolumeX);
export const UnresolveIcon = fromLucide('UnresolveIcon', CircleX);

/* --- Severity and status --------------------------------------------------
   `error` is the crossed circle, `warning` the triangle, `ok` the ticked
   circle. Shape, not only colour: severity has to survive being printed in
   grey. */

export const ErrorIcon = fromLucide('ErrorIcon', CircleX);
export const WarningIcon = fromLucide('WarningIcon', TriangleAlert);
export const OkIcon = fromLucide('OkIcon', CircleCheck);
export const InfoIcon = fromLucide('InfoIcon', CircleAlert);
export const SpinnerIcon = fromLucide('SpinnerIcon', LoaderCircle);
export const NotificationIcon = fromLucide('NotificationIcon', Bell);
export const TimeIcon = fromLucide('TimeIcon', Clock);
export const EmptyIcon = fromLucide('EmptyIcon', Inbox);
export const WatchIcon = fromLucide('WatchIcon', Eye);

/* --- Entities -------------------------------------------------------------
   What the data is about, rather than which page shows it. */

export const ReleaseIcon = fromLucide('ReleaseIcon', GitBranch);
export const CommitIcon = fromLucide('CommitIcon', GitCommitHorizontal);
export const MergeIcon = fromLucide('MergeIcon', GitMerge);
export const EnvironmentIcon = fromLucide('EnvironmentIcon', Server);
export const MemberIcon = fromLucide('MemberIcon', User);
export const TeamIcon = fromLucide('TeamIcon', Users);

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
