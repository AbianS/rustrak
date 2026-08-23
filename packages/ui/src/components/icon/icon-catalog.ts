import { fromLucide, lucide } from './adapters/lucide';
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

export const OverviewIcon = fromLucide('OverviewIcon', lucide.LayoutDashboard);
export const IssuesIcon = fromLucide('IssuesIcon', lucide.CircleAlert);
export const ReleasesIcon = fromLucide('ReleasesIcon', lucide.Rocket);
export const PerformanceIcon = fromLucide('PerformanceIcon', lucide.Zap);
export const AgentsIcon = fromLucide('AgentsIcon', lucide.Bot);
export const LogsIcon = fromLucide('LogsIcon', lucide.ScrollText);
export const SettingsIcon = fromLucide('SettingsIcon', lucide.Settings);

/* --- Directions ----------------------------------------------------------- */

export const ChevronRightIcon = fromLucide(
  'ChevronRightIcon',
  lucide.ChevronRight,
);
export const ChevronLeftIcon = fromLucide(
  'ChevronLeftIcon',
  lucide.ChevronLeft,
);
export const ChevronDownIcon = fromLucide(
  'ChevronDownIcon',
  lucide.ChevronDown,
);
export const ChevronUpIcon = fromLucide('ChevronUpIcon', lucide.ChevronUp);
/** The two-arrow chevron of a thing you can switch: the project card. */
export const SelectorIcon = fromLucide('SelectorIcon', lucide.ChevronsUpDown);
export const CollapsePanelIcon = fromLucide(
  'CollapsePanelIcon',
  lucide.ChevronsLeft,
);
export const ExpandPanelIcon = fromLucide(
  'ExpandPanelIcon',
  lucide.ChevronsRight,
);
export const PanelLeftIcon = fromLucide('PanelLeftIcon', lucide.PanelLeft);
export const PanelRightIcon = fromLucide('PanelRightIcon', lucide.PanelRight);
export const ArrowRightIcon = fromLucide('ArrowRightIcon', lucide.ArrowRight);
/** A figure that went up. In this product that is usually bad news. */
export const TrendUpIcon = fromLucide('TrendUpIcon', lucide.ArrowUpRight);
export const TrendDownIcon = fromLucide('TrendDownIcon', lucide.ArrowDownRight);
export const CompareIcon = fromLucide('CompareIcon', lucide.ArrowLeftRight);

/* --- Actions -------------------------------------------------------------- */

export const SearchIcon = fromLucide('SearchIcon', lucide.Search);
export const FilterIcon = fromLucide('FilterIcon', lucide.ListFilter);
export const FacetsIcon = fromLucide('FacetsIcon', lucide.SlidersHorizontal);
export const ColumnsIcon = fromLucide('ColumnsIcon', lucide.Columns3);
export const NewIcon = fromLucide('NewIcon', lucide.Plus);
export const RemoveIcon = fromLucide('RemoveIcon', lucide.Minus);
export const CloseIcon = fromLucide('CloseIcon', lucide.X);
export const CopyIcon = fromLucide('CopyIcon', lucide.Copy);
export const ExportIcon = fromLucide('ExportIcon', lucide.Download);
export const RefreshIcon = fromLucide('RefreshIcon', lucide.RefreshCw);
export const DeleteIcon = fromLucide('DeleteIcon', lucide.Trash2);
export const OverflowIcon = fromLucide('OverflowIcon', lucide.EllipsisVertical);
/** The horizontal ellipsis, for a row's inline menu. */
export const MoreIcon = fromLucide('MoreIcon', lucide.Ellipsis);
export const MenuIcon = fromLucide('MenuIcon', lucide.Menu);
export const ExternalLinkIcon = fromLucide(
  'ExternalLinkIcon',
  lucide.ExternalLink,
);
export const LinkIcon = fromLucide('LinkIcon', lucide.Link);
export const AssignIcon = fromLucide('AssignIcon', lucide.Users);
export const SaveViewIcon = fromLucide('SaveViewIcon', lucide.Bookmark);
export const StarIcon = fromLucide('StarIcon', lucide.Star);
export const CommentIcon = fromLucide('CommentIcon', lucide.MessageSquare);
export const AutofixIcon = fromLucide('AutofixIcon', lucide.Sparkles);
export const ConfigureIcon = fromLucide('ConfigureIcon', lucide.Wrench);

/* --- Issue lifecycle ------------------------------------------------------
   The three verbs an issue understands. `resolve` is a plain check because it
   is the primary action on the detail screen and shares the button with the
   label; `mute` is the crossed speaker, which is what silencing looks like
   everywhere else. */

export const ResolveIcon = fromLucide('ResolveIcon', lucide.Check);
export const MuteIcon = fromLucide('MuteIcon', lucide.VolumeX);
export const UnresolveIcon = fromLucide('UnresolveIcon', lucide.CircleX);

/* --- Severity and status --------------------------------------------------
   `error` is the crossed circle, `warning` the triangle, `ok` the ticked
   circle. Shape, not only colour: severity has to survive being printed in
   grey. */

export const ErrorIcon = fromLucide('ErrorIcon', lucide.CircleX);
export const WarningIcon = fromLucide('WarningIcon', lucide.TriangleAlert);
export const OkIcon = fromLucide('OkIcon', lucide.CircleCheck);
export const InfoIcon = fromLucide('InfoIcon', lucide.CircleAlert);
export const SpinnerIcon = fromLucide('SpinnerIcon', lucide.LoaderCircle);
export const NotificationIcon = fromLucide('NotificationIcon', lucide.Bell);
export const TimeIcon = fromLucide('TimeIcon', lucide.Clock);
export const EmptyIcon = fromLucide('EmptyIcon', lucide.Inbox);
export const WatchIcon = fromLucide('WatchIcon', lucide.Eye);

/* --- Entities -------------------------------------------------------------
   What the data is about, rather than which page shows it. */

export const ReleaseIcon = fromLucide('ReleaseIcon', lucide.GitBranch);
export const CommitIcon = fromLucide('CommitIcon', lucide.GitCommitHorizontal);
export const MergeIcon = fromLucide('MergeIcon', lucide.GitMerge);
export const EnvironmentIcon = fromLucide('EnvironmentIcon', lucide.Server);
export const MemberIcon = fromLucide('MemberIcon', lucide.User);
export const TeamIcon = fromLucide('TeamIcon', lucide.Users);

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
