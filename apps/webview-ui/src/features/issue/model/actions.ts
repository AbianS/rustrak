/**
 * The status changes a reader can apply to an issue from the list.
 *
 * Lives in `model` rather than beside the row that renders the menu, because
 * the filter bar's batch buttons and the row's own menu both dispatch these
 * and neither owns the vocabulary.
 */
export type IssueAction = 'resolve' | 'unresolve' | 'mute' | 'unmute';

/** The status each action leaves its issues in. */
export const STATUS_FOR: Record<
  IssueAction,
  'resolved' | 'ignored' | 'unresolved'
> = {
  resolve: 'resolved',
  mute: 'ignored',
  unresolve: 'unresolved',
  unmute: 'unresolved',
};
