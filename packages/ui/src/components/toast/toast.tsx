import { Toast as BaseToast } from '@base-ui/react/toast';
import { type CSSProperties, type ReactNode, useMemo } from 'react';
import { focusRing } from '../../lib/focus';
import { uiLabel } from '../../lib/labels';
import { interactiveTransition, pressScaleSmall } from '../../lib/motion';
import { tv } from '../../lib/tv';
import { Button } from '../button/button';
import type { IconComponent } from '../icon/icon';
import {
  CloseIcon,
  ErrorIcon,
  InfoIcon,
  OkIcon,
  SpinnerIcon,
  UndoIcon,
  WarningIcon,
} from '../icon/icon-catalog';

/**
 * The corner notice.
 *
 * It confirms something that just happened and leaves on its own. What has to
 * be read without hurry lives in the notification bell, and what has to be
 * decided lives in a dialog: if a piece of data vanishes with the notice and
 * exists nowhere else, that is a design fault, not a feature this component
 * lacks.
 *
 * Four uses, each with its lifetime built in:
 *
 *   confirmation  `success` and `info`, 5 s with the countdown at the foot;
 *   attention     `warning` and `danger`, stay until dismissed;
 *   undo          `neutral`, 8 s, which is how long regret takes;
 *   in progress   `progress` set, stays until it finishes.
 */
const toast = tv({
  slots: {
    /*
     * Bottom right. It positions nothing itself: it is the anchor of the
     * stack, which draws upward from its bottom edge.
     */
    viewport: [
      'group/stack fixed end-page-gutter bottom-page-gutter z-50 w-toast',
      'max-w-[calc(100vw-2*var(--spacing-page-gutter))]',
      'outline-none',
    ],
    /*
     * One notice of the stack.
     *
     * At rest the three sit one on top of another, peeking 10 px and
     * shrinking 5 % per step: you can see there are three without any of
     * them covering the screen. Hovering opens the stack and each takes its
     * place.
     *
     * The geometry comes from the variables Base UI writes on each notice
     * (`--toast-index`, `--toast-offset-y`, `--toast-height`); the formulas
     * live in `stackVars` so this reads as intent rather than algebra. They
     * ride the individual `translate` and `scale` properties, never
     * `transform` -- the same rule the rest of the package's motion follows,
     * and what lets the transition below actually animate them.
     */
    root: [
      'group/toast absolute right-0 bottom-0 w-full origin-bottom',
      'overflow-hidden rounded-lg border bg-surface-floating shadow-overlay',
      focusRing,
      // The front one covers the ones behind.
      '[z-index:calc(1000-var(--toast-index))]',
      // At rest every card is as tall as the front one, so the stack is one
      // shape; opened, each recovers its own height.
      'h-(--rk-toast-collapsed-height)',
      '[translate:var(--rk-toast-collapsed-translate)]',
      '[scale:var(--rk-toast-scale)]',
      /*
       * Opening the stack covers distance, and the short leg does not serve
       * there: at 70 ms three cards taking their places read as a flicker.
       * Height travels with them, or the content pops in at the end.
       */
      'transition-[translate,scale,opacity,height] duration-slow ease-standard',
      'data-expanded:h-(--toast-height)',
      'data-expanded:[translate:var(--rk-toast-expanded-translate)]',
      'data-expanded:[scale:1]',
      /*
       * In and out through the bottom, which is where they come from: rising
       * from the window's edge braking, leaving accelerating. Never across
       * the screen.
       */
      'data-starting-style:[translate:0_150%]',
      'data-starting-style:opacity-0 data-starting-style:ease-entrance',
      'data-ending-style:[translate:0_150%]',
      'data-ending-style:opacity-0 data-ending-style:ease-exit',
      // Swiped away, it leaves the way it was pushed.
      'data-ending-style:data-[swipe-direction=right]:[translate:var(--rk-toast-swipe-right)]',
      'data-ending-style:data-[swipe-direction=left]:[translate:var(--rk-toast-swipe-left)]',
      'data-ending-style:data-[swipe-direction=down]:[translate:var(--rk-toast-swipe-down)]',
      'data-ending-style:data-[swipe-direction=up]:[translate:var(--rk-toast-swipe-up)]',
      // While dragging, Base UI writes the movement inline: the transition
      // switches off so the card follows the finger, not a frame behind it.
      'data-swiping:transition-none',
      // Past the limit of three it dims and waits its turn: it returns as
      // soon as one of the front ones closes.
      'data-limited:opacity-0',
      /*
       * An invisible bridge over the gap between two notices. Without it,
       * crossing from one to the next with the pointer collapses the stack
       * and reopens it at every step.
       */
      'after:absolute after:top-full after:left-0 after:h-(--rk-toast-gap)',
      'after:w-full after:content-[""]',
    ],
    /*
     * What is inside. Only the front notice's content is read: the ones
     * behind peek like paper, with no text competing with the one being
     * read.
     */
    content: [
      'overflow-hidden transition-[opacity] duration-moderate ease-standard',
      'data-behind:opacity-0 data-expanded:opacity-100',
    ],
    row: 'flex items-start gap-3 p-3.5',
    /*
     * A solid colour disc with the icon on it: the one saturated piece of
     * the notice. The rest is typography, so colour is spent only on what
     * says what kind of thing this is.
     */
    disc: [
      'flex size-7.5 shrink-0 items-center justify-center rounded-pill',
      'text-fg-on-brand',
    ],
    body: 'flex min-w-0 flex-1 flex-col gap-1',
    title: 'text-card-title text-fg',
    description: 'text-fg-tertiary text-meta',
    actions: 'flex items-center gap-2 pt-2',
    close: [
      '-me-1 flex size-6 shrink-0 items-center justify-center rounded-sm',
      'text-fg-subtle hover:bg-surface-hover hover:text-fg',
      interactiveTransition,
      pressScaleSmall,
      focusRing,
    ],
    progress: 'flex items-center gap-2.5 pt-1.5',
    progressTrack: [
      'flex h-1.25 min-w-0 flex-1 overflow-hidden rounded-pill',
      'bg-surface-chip',
    ],
    progressBar: [
      'h-full rounded-pill bg-surface-brand',
      'transition-[width] duration-moderate ease-standard',
    ],
    progressValue: 'shrink-0 text-badge text-fg-secondary tabular-nums',
    /*
     * The countdown. Drawn at the foot rather than as a ring around the
     * icon, because it has to be ignorable: second-row information.
     */
    timerTrack: 'h-0.75 bg-surface-chip',
    timerBar: [
      'h-full origin-left animate-toast-timer motion-reduce:animate-none',
      // Hovering the stack makes Base UI pause the clock; the bar has to
      // pause with it, or it would count time that is not running.
      'group-data-expanded/toast:[animation-play-state:paused]',
    ],
  },
  variants: {
    tone: {
      success: {
        root: 'border-border',
        disc: 'bg-success',
        timerBar: 'bg-success/60',
      },
      info: {
        root: 'border-border',
        disc: 'bg-sev-info',
        timerBar: 'bg-sev-info/60',
      },
      warning: {
        root: 'border-sev-warning/40',
        disc: 'bg-sev-warning',
        timerBar: 'bg-sev-warning/60',
      },
      danger: {
        root: 'border-danger/40',
        disc: 'bg-danger',
        timerBar: 'bg-danger/60',
      },
      neutral: {
        root: 'border-border',
        disc: 'bg-surface-inverse text-fg-inverse',
        timerBar: 'bg-fg-ghost/60',
      },
    },
  },
  defaultVariants: { tone: 'info' },
});

export type ToastTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface ToastActionSpec {
  label: string;
  /** Runs and then the notice closes: the action resolves it. */
  onClick: () => void;
  /**
   * The primary look. Reserved for when the action is the way out of the
   * problem rather than an alternative -- "Retry" after a lost connection --
   * because a notice that paints itself in cannot also ask for the turn.
   */
  strong?: boolean;
}

/**
 * How long each tone lives. Not configuration: it follows from what each one
 * is for. What demands action cannot leave on its own, because nobody reads
 * at the speed a notice dismisses itself.
 */
const TIMEOUTS: Record<ToastTone, number> = {
  success: 5000,
  info: 5000,
  warning: 0,
  danger: 0,
  neutral: 8000,
};

const ICONS: Record<ToastTone, IconComponent> = {
  success: OkIcon,
  info: InfoIcon,
  warning: WarningIcon,
  danger: ErrorIcon,
  neutral: UndoIcon,
};

export interface ToastOptions {
  /** What happened, in one line and in the past tense: "Alert created". */
  title: string;
  /** The detail that makes it recognisable: ids, counts, names. */
  description?: ReactNode;
  tone?: ToastTone;
  /** Replaces the tone's icon when the tone falls short. */
  icon?: IconComponent;
  /** The action that resolves the notice. A real button, not a link. */
  action?: ToastActionSpec;
  /** The secondary way out: "Dismiss" beside "Retry". */
  altAction?: ToastActionSpec;
  /** 0 to 100. Turns the notice into an in-progress one: it stops leaving. */
  progress?: number;
  /** Stays until dismissed, whatever the tone. */
  persist?: boolean;
  /** Milliseconds of life. Only to depart from the tone's own duration. */
  timeout?: number;
  /** Repeating it updates the notice that already exists instead of stacking. */
  id?: string;
  onClose?: () => void;
}

interface ToastData {
  tone: ToastTone;
  icon?: IconComponent;
  action?: ToastActionSpec;
  altAction?: ToastActionSpec;
  progress?: number;
}

type ToastItem = BaseToast.Root.ToastObject<ToastData>;

/** How far each notice peeks from behind the front one, and how far apart
 *  they sit when the stack opens. */
const PEEK = 10;
const GAP = 10;

/**
 * The stack's algebra, over what Base UI measures and writes on each notice:
 * `--toast-index` (0 is the front), `--toast-offset-y` (what the ones in
 * front of it occupy) and `--toast-height` (its own).
 *
 * Variables rather than classes because a three-storey formula written as a
 * Tailwind utility is read by nobody, and these need tuning.
 */
const stackVars = {
  '--rk-toast-peek': `${PEEK}px`,
  '--rk-toast-gap': `${GAP}px`,
  // Each step back shrinks 5 %. With three visible, the last is at 90 %:
  // the stack shows, and what peeks is still legible.
  '--rk-toast-scale': 'max(0, 1 - var(--toast-index) * 0.05)',
  // At rest every card is as tall as the front one; unmeasured, its own.
  '--rk-toast-collapsed-height':
    'var(--toast-frontmost-height, var(--toast-height))',
  // They shrink from the bottom, so each is brought back to the floor line.
  '--rk-toast-collapsed-translate': `var(--toast-swipe-movement-x)
    calc(
      var(--toast-swipe-movement-y)
      - var(--toast-index) * var(--rk-toast-peek)
      - (1 - var(--rk-toast-scale)) * var(--rk-toast-collapsed-height)
    )`,
  '--rk-toast-expanded-translate': `var(--toast-swipe-movement-x)
    calc(
      var(--toast-offset-y) * -1
      - var(--toast-index) * var(--rk-toast-gap)
      + var(--toast-swipe-movement-y)
    )`,
  '--rk-toast-swipe-right':
    'calc(var(--toast-swipe-movement-x) + 150%) var(--toast-swipe-movement-y)',
  '--rk-toast-swipe-left':
    'calc(var(--toast-swipe-movement-x) - 150%) var(--toast-swipe-movement-y)',
  '--rk-toast-swipe-down':
    'var(--toast-swipe-movement-x) calc(var(--toast-swipe-movement-y) + 150%)',
  '--rk-toast-swipe-up':
    'var(--toast-swipe-movement-x) calc(var(--toast-swipe-movement-y) - 150%)',
} as CSSProperties;

function toManagerOptions(options: ToastOptions) {
  const { tone = 'info', persist, progress, timeout } = options;
  const inProgress = progress != null;

  return {
    // Only present when given: `update` merges what it receives onto the
    // toast, and an explicit `id: undefined` would wipe the toast's own id,
    // leaving the next update unable to find it.
    ...(options.id !== undefined ? { id: options.id } : {}),
    title: options.title,
    description: options.description,
    // Travels to the DOM as `data-type`: visible in the inspector and tests.
    type: tone,
    timeout: persist || inProgress ? 0 : (timeout ?? TIMEOUTS[tone]),
    /*
     * Everything announces calmly, the error included.
     *
     * Base UI's high priority reads the notice from a separate region and
     * keeps the visible one out of the accessibility tree until F6 is
     * pressed. That would cost dearly here: errors stay put and carry the
     * action that resolves them, and that action must be reachable without
     * knowing a shortcut.
     */
    priority: 'low' as const,
    onClose: options.onClose,
    data: {
      tone,
      icon: options.icon,
      action: options.action,
      altAction: options.altAction,
      progress,
    },
  };
}

/** One state of a `toast.promise` call: options, or just the title. */
export type ToastPromiseState<Value> =
  | string
  | ToastOptions
  | ((value: Value) => string | ToastOptions);

function promiseState<Value>(
  state: ToastPromiseState<Value>,
  defaults: Partial<ToastOptions>,
) {
  return (value: Value) => {
    const resolved = typeof state === 'function' ? state(value) : state;
    const options =
      typeof resolved === 'string' ? { title: resolved } : resolved;
    return toManagerOptions({ ...defaults, ...options });
  };
}

export interface UseToastReturn {
  /** Shows a notice and returns its id. */
  show: (options: ToastOptions) => string;
  /**
   * Changes a notice that is already up: an import's percentage, the
   * "Sending" that becomes "Sent". Restarts its countdown.
   */
  update: (id: string, options: ToastOptions) => void;
  /** Without an id, closes the front one. */
  close: (id?: string) => void;
  /**
   * One notice that follows a promise: spinner while it runs, then the
   * success or the failure, in place. The promise's own result passes
   * through untouched.
   */
  promise: <Value>(
    promise: Promise<Value>,
    states: {
      loading: string | ToastOptions;
      success: ToastPromiseState<Value>;
      error: ToastPromiseState<unknown>;
    },
  ) => Promise<Value>;
}

/**
 * The one way to raise a notice.
 *
 * Needs a `ToastProvider` above, which is also what draws the stack.
 */
export function useToast(): UseToastReturn {
  // The loose methods, not the whole manager: the manager changes identity
  // with every notice in or out, and an effect depending on it would fire
  // again, raising the same notice twice.
  const { add, update, close, promise } =
    BaseToast.useToastManager<ToastData>();

  return useMemo(
    () => ({
      show: (options) => add(toManagerOptions(options)),
      update: (id, options) => update(id, toManagerOptions(options)),
      close: (id) => close(id),
      promise: (value, states) =>
        promise(value, {
          loading: promiseState(states.loading, {
            tone: 'neutral',
            icon: SpinnerIcon,
            persist: true,
          })(undefined),
          success: promiseState(states.success, { tone: 'success' }),
          error: promiseState(states.error, { tone: 'danger' }),
        }),
    }),
    [add, update, close, promise],
  );
}

/** The tone-resolved class slots, which only `ToastRoot` can build. */
type ToastStyles = ReturnType<typeof toast>;

/** How far along the work is, clamped to the bar it is drawn in. */
function ToastProgress({
  value,
  styles,
}: {
  value: number;
  styles: ToastStyles;
}) {
  // Normalized once, then used for all three. The bar was already clamped
  // while `aria-valuenow` and the caption were not, so a caller reporting 150
  // drew a full bar and announced "150 %" against a declared maximum of 100.
  // A non-finite value reads as no progress rather than as `NaN %`.
  const clamped = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 100)
    : 0;
  const rounded = Math.round(clamped);

  return (
    <div
      className={styles.progress()}
      role="progressbar"
      aria-label="Progress"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={styles.progressTrack()}>
        <span
          className={styles.progressBar()}
          style={{ width: `${clamped}%` }}
        />
      </span>
      <span className={styles.progressValue()}>{rounded} %</span>
    </div>
  );
}

/**
 * What can be done about the notice.
 *
 * The primary is a `BaseToast.Action` and the secondary is a plain button:
 * only the first is the toast's own action, and marking both would give a
 * screen reader two of them.
 */
function ToastActions({
  action,
  altAction,
  onRun,
  styles,
}: {
  action: ToastActionSpec | undefined;
  altAction: ToastActionSpec | undefined;
  onRun: (spec: ToastActionSpec) => () => void;
  styles: ToastStyles;
}) {
  return (
    <div className={styles.actions()}>
      {action ? (
        <BaseToast.Action
          onClick={onRun(action)}
          render={
            <Button
              variant={action.strong ? 'primary' : 'secondary'}
              size="sm"
              aria-label={action.label}
            />
          }
        >
          {action.label}
        </BaseToast.Action>
      ) : null}
      {altAction ? (
        <Button variant="ghost" size="sm" onClick={onRun(altAction)}>
          {altAction.label}
        </Button>
      ) : null}
    </div>
  );
}

function ToastRoot({ toast: item }: { toast: ToastItem }) {
  const { close } = BaseToast.useToastManager<ToastData>();
  const data = item.data;
  const tone = data?.tone ?? 'info';
  const styles = toast({ tone });

  const Icon = data?.icon ?? ICONS[tone];
  const progress = data?.progress;
  const action = data?.action;
  const altAction = data?.altAction;
  // The countdown is only drawn when there really is one: on a notice that
  // stays, a bar at the foot would promise it is going to leave.
  const timeout = item.timeout ?? 0;

  const runAndClose = (spec: ToastActionSpec) => () => {
    spec.onClick();
    close(item.id);
  };

  return (
    <BaseToast.Root toast={item} className={styles.root()} style={stackVars}>
      <BaseToast.Content className={styles.content()}>
        <div className={styles.row()}>
          <span className={styles.disc()}>
            <Icon
              size="lg"
              aria-hidden="true"
              className={Icon === SpinnerIcon ? 'animate-spin' : undefined}
            />
          </span>

          <div className={styles.body()}>
            <BaseToast.Title className={styles.title()} />
            {item.description ? (
              <BaseToast.Description className={styles.description()} />
            ) : null}

            {progress != null ? (
              <ToastProgress value={progress} styles={styles} />
            ) : null}

            {action || altAction ? (
              <ToastActions
                action={action}
                altAction={altAction}
                onRun={runAndClose}
                styles={styles}
              />
            ) : null}
          </div>

          <BaseToast.Close
            className={styles.close()}
            aria-label={uiLabel('dismiss')}
          >
            <CloseIcon size="sm" aria-hidden="true" />
          </BaseToast.Close>
        </div>

        {timeout > 0 ? (
          <div className={styles.timerTrack()}>
            <div
              // When the notice updates, Base UI restarts its clock: the bar
              // rewinds to start with it instead of carrying on.
              key={item.updateKey}
              className={styles.timerBar()}
              style={{ animationDuration: `${timeout}ms` }}
            />
          </div>
        ) : null}
      </BaseToast.Content>
    </BaseToast.Root>
  );
}

ToastRoot.displayName = 'ToastRoot';

function ToastViewport() {
  const { toasts } = BaseToast.useToastManager<ToastData>();
  const styles = toast();

  return (
    <BaseToast.Portal>
      <BaseToast.Viewport className={styles.viewport()}>
        {toasts.map((item) => (
          <ToastRoot key={item.id} toast={item} />
        ))}
      </BaseToast.Viewport>
    </BaseToast.Portal>
  );
}

ToastViewport.displayName = 'ToastViewport';

export interface ToastProviderProps {
  children?: ReactNode;
  /**
   * How many notices show at once. Three: a fourth card already covers the
   * screen being worked on. Past the limit they wait, dimmed, and enter as
   * the front ones close.
   */
  limit?: number;
}

/**
 * Goes once, at the application's root, with the stack built in: where
 * notices appear is the design system's decision, not each screen's.
 */
export function ToastProvider({ children, limit = 3 }: ToastProviderProps) {
  return (
    <BaseToast.Provider limit={limit}>
      {children}
      <ToastViewport />
    </BaseToast.Provider>
  );
}

ToastProvider.displayName = 'ToastProvider';
