import {
  BellOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Ellipsis,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
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
/** Silence an issue without saying it is fixed. */
export const IgnoreIcon = fromLucide(BellOff);
/** Put a person's name on it. */
export const AssignIcon = fromLucide(UserPlus);
/** Reopen what had been resolved. */
export const ReopenIcon = fromLucide(RotateCcw);
/** Destroy, with no way back. */
export const DeleteIcon = fromLucide(Trash2);
/** The actions that did not fit, behind one control. */
export const OverflowIcon = fromLucide(Ellipsis);
/** A row that can open to show more about itself. */
export const DiscloseIcon = fromLucide(ChevronRight);
/** Some of a set is selected, not all of it. */
export const PartialIcon = fromLucide(Minus);

/* Paging through a result set. */
export const PageFirstIcon = fromLucide(ChevronsLeft);
export const PagePreviousIcon = fromLucide(ChevronLeft);
export const PageNextIcon = fromLucide(ChevronRight);
export const PageLastIcon = fromLucide(ChevronsRight);
