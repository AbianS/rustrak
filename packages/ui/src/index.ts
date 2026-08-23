/**
 * @rustrak/ui -- the design system behind the Rustrak dashboard.
 *
 * Everything is exported from here. There are no deep imports: the paths inside
 * `src` are an implementation detail and moving a file should not break a
 * consumer.
 */

/* --- Foundations --------------------------------------------------------- */

export { cn } from './lib/cn';
export {
  focusRing,
  focusRingInset,
  focusRingWithin,
} from './lib/focus';
export {
  chevronFlip,
  dropIn,
  interactiveTransition,
  popTransition,
  pressNudge,
  pressScale,
  pressScaleSmall,
  pressScaleTrigger,
  slideTransition,
  swapAnimation,
  wipeReveal,
} from './lib/motion';
export type {
  ColorToken,
  DurationToken,
  EaseToken,
  FontToken,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  TextToken,
} from './lib/tokens';
export {
  colorTokens,
  durationTokens,
  easeTokens,
  fontTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  textTokens,
} from './lib/tokens';
export type { VariantProps } from './lib/tv';
export { tv } from './lib/tv';
export type { WithClassName } from './lib/types';
export { useMobileBreakpoint } from './lib/use-mobile';

/* --- Brand --------------------------------------------------------------- */

export { Wordmark } from './components/brand/wordmark';

/* --- Icons --------------------------------------------------------------- */

export { fromLucide } from './components/icon/adapters/lucide';
export type {
  IconComponent,
  IconProps,
  IconSize,
} from './components/icon/icon';
export { iconVariants } from './components/icon/icon';
export * from './components/icon/icon-catalog';

/* --- Presentation -------------------------------------------------------- */

export type { AvatarProps, AvatarShape } from './components/avatar/avatar';
export { Avatar } from './components/avatar/avatar';
export type { CountProps } from './components/count/count';
export { Count } from './components/count/count';
export type { KbdProps } from './components/kbd/kbd';
export { Kbd } from './components/kbd/kbd';
export type { SeparatorProps } from './components/separator/separator';
export { Separator } from './components/separator/separator';
export type { SpinnerProps } from './components/spinner/spinner';
export { Spinner } from './components/spinner/spinner';
export type { TagProps, TagTone } from './components/tag/tag';
export { Tag } from './components/tag/tag';
export type { TextProps, TextTone, TextVariant } from './components/text/text';
export { Text } from './components/text/text';

/* --- Actions ------------------------------------------------------------- */

export type {
  ButtonProps,
  ButtonSize,
  ButtonVariant,
} from './components/button/button';
export { Button } from './components/button/button';
export type { SplitButtonProps } from './components/button/split-button';
export { SplitButton } from './components/button/split-button';

/* --- Navigation ---------------------------------------------------------- */

export type {
  BreadcrumbsProps,
  Crumb,
} from './components/breadcrumbs/breadcrumbs';
export { Breadcrumbs } from './components/breadcrumbs/breadcrumbs';
export type { MenuProps } from './components/menu/menu';
export {
  Menu,
  MenuActions,
  MenuGroup,
  MenuGroupLabel,
} from './components/menu/menu';
export type { MenuAction } from './components/menu/menu-parts';
export { explainAction } from './components/menu/menu-parts';
export type {
  SegmentedControlProps,
  SegmentedItemProps,
} from './components/segmented-control/segmented-control';
export {
  SegmentedControl,
  SegmentedItem,
} from './components/segmented-control/segmented-control';
export type {
  TabListProps,
  TabPanelProps,
  TabProps,
  TabsProps,
  TabsSize,
} from './components/tabs/tabs';
export { Tab, TabList, TabPanel, Tabs } from './components/tabs/tabs';
export type { TooltipProps } from './components/tooltip/tooltip';
export { Tooltip, TooltipProvider } from './components/tooltip/tooltip';

/* --- Forms --------------------------------------------------------------- */

export type { CheckboxProps } from './components/checkbox/checkbox';
export { Checkbox } from './components/checkbox/checkbox';
export type { PopoverProps } from './components/popover/popover';
export { Popover } from './components/popover/popover';

/* --- Data table ---------------------------------------------------------- */

export type { DataTableColumnsButtonProps } from './components/data-table/columns-menu';
export { DataTableColumnsButton } from './components/data-table/columns-menu';
export type {
  DataTableEmptyProps,
  DataTableProps,
} from './components/data-table/data-table';
export { DataTable } from './components/data-table/data-table';
export type {
  ColumnFilterSpec,
  DataTableColumnDef,
  DataTableColumnMeta,
  DataTableFeatures,
  FilterOption,
} from './components/data-table/features';
export {
  createDataTableColumnHelper,
  dataTableFeatures,
} from './components/data-table/features';
export type { DataTablePaginationProps } from './components/data-table/pagination';
export { DataTablePagination } from './components/data-table/pagination';
export type {
  DataTableQuery,
  FilterVariants,
} from './components/data-table/query';
export {
  DEFAULT_PAGE_SIZE,
  emptyTableQuery,
  formatFilterQuery,
  parseFilterQuery,
  parseTableQuery,
  serializeTableQuery,
} from './components/data-table/query';
export type {
  DataTableInstance,
  UseDataTableOptions,
} from './components/data-table/use-data-table';
export { useDataTable } from './components/data-table/use-data-table';

/* --- Overlays ------------------------------------------------------------ */

export type {
  AlertOptions,
  ConfirmOptions,
} from './components/dialog/confirm';
export { alert, confirm } from './components/dialog/confirm';
export type {
  DialogBodyProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogProps,
  DialogSize,
  DialogTone,
} from './components/dialog/dialog';
export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
} from './components/dialog/dialog';
export type {
  DialogComponent,
  DialogDefinition,
  DialogDefinitionOptions,
  DialogHostProps,
  DialogProviderProps,
} from './components/dialog/dialog-manager';
export {
  closeAllDialogs,
  createDialog,
  DialogProvider,
} from './components/dialog/dialog-manager';
export type {
  ToastActionSpec,
  ToastOptions,
  ToastPromiseState,
  ToastProviderProps,
  ToastTone,
  UseToastReturn,
} from './components/toast/toast';
export { ToastProvider, useToast } from './components/toast/toast';

/* --- Query bar ----------------------------------------------------------- */

export type {
  QueryBarProps,
  QueryField,
} from './components/query-bar/query-bar';
export {
  QueryBar,
  queryFieldsFromColumns,
  variantsFromFields,
} from './components/query-bar/query-bar';

/* --- Shell --------------------------------------------------------------- */

export type {
  AppShellProps,
  PageHeaderProps,
  PageProps,
  SubHeaderProps,
} from './components/shell/app-shell';
export {
  AppShell,
  Page,
  PageHeader,
  SubHeader,
} from './components/shell/app-shell';
export type {
  SidebarItemProps,
  SidebarProjectProps,
  SidebarProps,
} from './components/shell/sidebar';
export {
  Sidebar,
  SidebarCollapseButton,
  SidebarItem,
  SidebarProject,
} from './components/shell/sidebar';
export type { SidebarProviderProps } from './components/shell/sidebar-context';
export {
  SidebarProvider,
  useSidebar,
} from './components/shell/sidebar-context';
export type {
  TopbarActionProps,
  TopbarBrandProps,
  TopbarProps,
  TopbarSearchProps,
  TopbarUserProps,
} from './components/shell/topbar';
export {
  Topbar,
  TopbarAction,
  TopbarBrand,
  TopbarMenuButton,
  TopbarSearch,
  TopbarUser,
} from './components/shell/topbar';
