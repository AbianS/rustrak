import {
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { fromLucide } from './adapters/lucide';

/**
 * The icons the product uses, named after what they mean.
 *
 * `ResolveIcon`, not `CheckIcon`: the day resolving an issue is drawn with a
 * different glyph, this one line changes and nobody else finds out. A component
 * importing `Check` would be coupled to the drawing.
 *
 * Entries are added as they are needed. A catalog that re-exports all thousand
 * lucide glyphs is not a catalog, it is the library under another name.
 */

/** Spinning: the system is working. */
export const SpinnerIcon = fromLucide(LoaderCircle);
/** This control opens a menu instead of running an action. */
export const ChevronDownIcon = fromLucide(ChevronDown);
/** Mark an issue as resolved. */
export const ResolveIcon = fromLucide(Check);
/** An issue. */
export const IssueIcon = fromLucide(CircleAlert);
/** Create something that did not exist. */
export const CreateIcon = fromLucide(Plus);
/** Reopen what had been resolved. */
export const ReopenIcon = fromLucide(RotateCcw);
/** Destroy, with no way back. */
export const DeleteIcon = fromLucide(Trash2);
