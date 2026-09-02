import { type ReactNode, useState } from 'react';
import { uiLabel } from '../../lib/labels';
import { Button } from '../button/button';
import { Field, FieldLabel } from '../field/field';
import type { IconComponent } from '../icon/icon';
import {
  DeleteIcon,
  InfoIcon,
  OkIcon,
  WarningIcon,
} from '../icon/icon-catalog';
import { Input } from '../input/input';
import {
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  type DialogTone,
} from './dialog';
import { createDialog } from './dialog-store';

/**
 * The two eternal questions, pre-assembled.
 *
 * `confirm` is an alert dialog: it does not close on an outside click, has
 * no cross, and focus lands on the way out, because the only way forward is
 * to answer. `alert` only tells something that must be read. Everything else
 * -- choosing in a table, filling a form, showing a long process's outcome
 * -- is written with `createDialog`.
 */

export interface ConfirmOptions {
  /** What will happen, subject included: "Delete the RUSTRAK-1042 issue". */
  title: string;
  /** What it takes with it and what can be recovered. This is what is read. */
  description?: ReactNode;
  /** The disc's colour and icon. Red only when something is destroyed. */
  tone?: DialogTone;
  icon?: IconComponent;
  /** The action's label, in the title's own verb: "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** What must be reviewed before deciding: figures, checks. */
  details?: ReactNode;
  /**
   * A word that must be typed to unlock the action. Only for what has no way
   * back -- deleting a project, purging events --: it forces reading, which
   * is the point.
   */
  phrase?: string;
  /**
   * The copy around `phrase` and the footer hint, for an application that
   * ships in more than one language.
   *
   * The English defaults are a convenience for Storybook and for a caller
   * with one locale, not a licence to leave them: everything a reader sees in
   * the product comes from `@rustrak/i18n`.
   *
   * `{phrase}` and `{count}` are replaced.
   */
  phraseLabel?: string;
  charactersLeftLabel?: string;
  escapeHint?: string;
}

const TONE_ICONS: Record<DialogTone, IconComponent> = {
  brand: InfoIcon,
  success: OkIcon,
  warning: WarningIcon,
  danger: DeleteIcon,
};

function ConfirmContent({
  title,
  description,
  tone = 'danger',
  icon,
  confirmLabel,
  cancelLabel,
  details,
  phrase,
  phraseLabel,
  charactersLeftLabel,
  escapeHint,
  close,
}: ConfirmOptions & { close: (result?: boolean) => void }) {
  const confirmText = confirmLabel ?? uiLabel('confirm');
  const cancelText = cancelLabel ?? uiLabel('cancel');
  const phraseText = phraseLabel ?? uiLabel('confirmPhrase');
  const charactersLeftText = charactersLeftLabel;
  const escapeText = escapeHint ?? uiLabel('escapeCancels');
  const [typed, setTyped] = useState('');
  const locked = !!phrase && typed.trim() !== phrase;
  const remaining = phrase == null ? 0 : phrase.length - typed.trim().length;

  return (
    <>
      <DialogHeader
        title={title}
        description={description}
        icon={icon ?? TONE_ICONS[tone]}
        tone={tone}
        dismissible={false}
      />

      {details || phrase ? (
        <DialogBody inset>
          {details}
          {phrase ? (
            // A `Field`, which is what ties the label to the box: written by
            // hand it would end in an `htmlFor` with no partner.
            <Field className="pt-3.5 first:pt-0">
              <FieldLabel>
                {phraseText.split('{phrase}').flatMap((part, index) =>
                  index === 0
                    ? [part]
                    : [
                        <b className="font-mono text-fg" key="phrase">
                          {phrase}
                        </b>,
                        part,
                      ],
                )}
              </FieldLabel>
              <Input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                size="sm"
                className="font-mono"
              />
            </Field>
          ) : null}
        </DialogBody>
      ) : null}

      <DialogFooter
        hint={
          locked
            ? (charactersLeftText?.replace(
                '{count}',
                String(Math.max(remaining, 0)),
              ) ??
              uiLabel('confirmCharactersLeft', {
                count: Math.max(remaining, 0),
              }))
            : escapeText
        }
      >
        {/* The modal's first focusable element, which is where Base UI puts
            the focus on open: in the destructive, the way out comes before
            the action. */}
        <DialogClose
          render={<Button variant="secondary" aria-label={cancelText} />}
        >
          {cancelText}
        </DialogClose>
        <Button
          variant={tone === 'danger' ? 'danger-primary' : 'primary'}
          shortcut={locked ? undefined : '⏎'}
          disabled={locked}
          onClick={() => close(true)}
        >
          {confirmText}
        </Button>
      </DialogFooter>
    </>
  );
}

/** 420 px for the reversible; 480 for what must be typed by hand. */
const confirmDialog = createDialog<ConfirmOptions, boolean>(ConfirmContent, {
  alert: true,
  size: 'sm',
});

const confirmPhraseDialog = createDialog<ConfirmOptions, boolean>(
  ConfirmContent,
  { alert: true, size: 'md' },
);

/**
 * Asks and waits. Returns `true` only if the action was pressed: closing any
 * other way is a no.
 *
 * ```tsx
 * if (!(await confirm({ title: 'Delete the RUSTRAK-1042 issue' }))) return;
 * ```
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
  const dialog = options.phrase ? confirmPhraseDialog : confirmDialog;

  return (await dialog.open(options)) ?? false;
}

export interface AlertOptions {
  title: string;
  description?: ReactNode;
  tone?: DialogTone;
  icon?: IconComponent;
  /** The label of the only way out. */
  closeLabel?: string;
  details?: ReactNode;
}

const alertDialog = createDialog<AlertOptions, void>(
  function AlertContent({
    title,
    description,
    tone = 'brand',
    icon,
    closeLabel = 'Got it',
    details,
    close,
  }) {
    return (
      <>
        <DialogHeader
          title={title}
          description={description}
          icon={icon ?? TONE_ICONS[tone]}
          tone={tone}
          dismissible={false}
        />

        {details ? <DialogBody inset>{details}</DialogBody> : null}

        <DialogFooter>
          <Button variant="primary" shortcut="⏎" onClick={() => close()}>
            {closeLabel}
          </Button>
        </DialogFooter>
      </>
    );
  },
  { alert: true, size: 'sm' },
);

/**
 * Tells something that has to be read, and waits until it is dismissed. If
 * it does not have to be read, it is not a modal: it is a corner toast.
 */
export async function alert(options: AlertOptions): Promise<void> {
  await alertDialog.open(options);
}
