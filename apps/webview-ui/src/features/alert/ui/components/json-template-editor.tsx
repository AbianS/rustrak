'use client';

import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { type Diagnostic, linter, lintGutter } from '@codemirror/lint';
import { Compartment, EditorState } from '@codemirror/state';
import {
  placeholder as cmPlaceholder,
  Decoration,
  type DecorationSet,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  tooltips,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { CircleQuestionMarkIcon, WandSparklesIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { expressionAt } from '@/features/alert/lib/template-completion';
import { locateTemplateError } from '@/features/alert/lib/template-diagnostic';
import type { TemplateVariable } from '@/features/alert/model/message-template';

/**
 * The message body is a template that renders to JSON, which is two languages
 * in one field: JSON everywhere, and an expression between `{{` and `}}`.
 * A plain textarea leaves the reader to hold both in their head, and the only
 * feedback they get is a save that fails.
 *
 * CodeMirror rather than Monaco: this is one small field, not an IDE, and the
 * difference is roughly 250 KB against 2-5 MB. n8n solved the same shape of
 * problem (a template language embedded in text, completing over the data
 * available at that point) on CodeMirror too.
 *
 * What the editor adds, in order of how much it helps:
 *
 * 1. Completion of payload fields, with the type beside the name and a line
 *    of prose under it, so nobody has to keep the payload shape in a docs tab.
 *    Accepting one writes `{{ x | tojson }}`, which is the escaping rule
 *    applied rather than explained.
 * 2. JSON syntax highlighting, with the `{{ … }}` spans marked so they read as
 *    expressions instead of as broken JSON.
 * 3. Bracket closing and matching, because the shape of the body is brackets.
 *
 * The CodeMirror packages are imported statically here on purpose, and
 * `react-doctor/prefer-dynamic-import` is turned off for this file in
 * `doctor.config.json` because of it: this whole component is already behind a
 * `next/dynamic` boundary in the form that uses it, so it is never in the
 * page's bundle. Splitting the imports again inside it would buy nothing and
 * cost a second waterfall.
 *
 * What it deliberately does not do is validate. The template only becomes JSON
 * once it is rendered, and the only renderer that agrees with a delivery is
 * the server's, so the preview beneath the field owns that answer.
 */
export function JsonTemplateEditor({
  value,
  onChange,
  onBlur,
  onFormat,
  validate,
  disabled,
  placeholder,
  variables,
  ariaLabel,
  label,
  helpHref,
  formatLabel,
  helpLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Rewrites the body indented. Wired to the wand in the header. */
  onFormat: () => void;
  /**
   * Why the body would be refused, or `null` when it would not. Async because
   * only the server can answer it: it owns the template engine.
   */
  validate: (template: string) => Promise<string | null>;
  disabled: boolean;
  placeholder: string;
  variables: readonly TemplateVariable[];
  ariaLabel: string;
  label: string;
  helpHref: string;
  formatLabel: string;
  helpLabel: string;
}) {
  const t = useTranslations('alerts.customWebhook.variables');
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);

  const completions = useMemo<Completion[]>(
    () =>
      variables.map((variable) => ({
        label: variable.path,
        type: 'variable',
        // The prose goes beside the name rather than in the side panel: the
        // reader is looking for the field that holds the error title, not for
        // the field whose type is string.
        detail: t(variable.descriptionKey),
        info: `${variable.detail} · ${variable.example}`,
        // Accepting a field writes the escaped form, so a title carrying a
        // quote cannot break the body the reader is composing.
        apply: `${variable.path} | tojson `,
      })),
    [variables, t],
  );

  // One compartment for the editor's lifetime. `useState` rather than
  // `useRef(new Compartment())`, which would build a compartment on every
  // render and throw all but the first away.
  const [editable] = useState(() => new Compartment());

  /**
   * Everything the editor's own callbacks read, in one box.
   *
   * The editor is built once: naming any of these in the effect below would
   * tear it down and rebuild it, and a rebuild mid-word drops the caret, the
   * selection and the undo history. Writing to the box during render is what
   * React tells you not to do, so it is written after the render commits, and
   * read only from callbacks that run later than that.
   */
  const live = useRef({ onChange, onBlur, validate, completions });
  useEffect(() => {
    live.current = { onChange, onBlur, validate, completions };
  }, [onChange, onBlur, validate, completions]);

  // What the editor is built from, captured at mount. `useState` again, so the
  // initial value is read once instead of on every render.
  const [initial] = useState(() => ({
    doc: value,
    disabled,
    placeholder,
    ariaLabel,
  }));

  useEffect(() => {
    if (!host.current || view.current) return;

    const complete = (ctx: CompletionContext): CompletionResult | null => {
      const open = expressionAt(ctx.state.doc.toString(), ctx.pos);
      if (!open) return null;
      if (!open.word && !ctx.explicit) return null;
      return {
        from: open.from,
        options: live.current.completions,
        validFor: /^[\w.]*$/,
      };
    };

    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.doc,
        extensions: [
          history(),
          json(),
          syntaxHighlighting(jsonHighlight),
          expressionHighlighter,
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          indentUnit.of('  '),
          autocompletion({ override: [complete], icons: false }),
          // Refusals belong on the line that caused them, underlined, with the
          // reason on hover and a marker in the gutter — where an editor puts
          // them. A sentence under the field makes the reader find the spot.
          linter(
            async (view): Promise<Diagnostic[]> => {
              const doc = view.state.doc.toString();
              if (!doc.trim()) return [];
              const message = await live.current.validate(doc);
              if (!message) return [];
              return [
                {
                  ...locateTemplateError(doc, message),
                  severity: 'error',
                  message,
                },
              ];
            },
            { delay: 500 },
          ),
          lintGutter(),
          // The dialog scrolls, and a scroll container clips anything drawn
          // inside it. The completion popup is wider than this field on
          // purpose, so it is drawn at the top of the document instead.
          tooltips({ parent: document.body }),
          keymap.of([
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...historyKeymap,
            indentWithTab,
            ...defaultKeymap,
          ]),
          EditorView.lineWrapping,
          cmPlaceholder(initial.placeholder),
          editorTheme,
          editable.of(EditorView.editable.of(!initial.disabled)),
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
              live.current.onChange(update.state.doc.toString());
            }
            if (update.focusChanged && !update.view.hasFocus) {
              live.current.onBlur?.();
            }
          }),
          EditorView.contentAttributes.of({
            'aria-label': initial.ariaLabel,
            role: 'textbox',
            'aria-multiline': 'true',
          }),
        ],
      }),
    });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    // Built once, deliberately. `disabled` is reconfigured through a
    // compartment below and everything else is read through a ref, so this
    // array stays empty on purpose rather than by oversight.
  }, [editable, initial]);

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.reconfigure(EditorView.editable.of(!disabled)),
    });
  }, [disabled, editable]);

  // A value that arrives from outside (a reset, a chip insertion) is written
  // in; one that came from typing already matches and is left alone.
  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    const current = instance.state.doc.toString();
    if (current === value) return;
    instance.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return (
    <div
      data-disabled={disabled || undefined}
      className="overflow-hidden rounded-md border border-input bg-transparent text-xs data-disabled:opacity-50"
    >
      <div className="flex items-center justify-between gap-2 border-b border-input px-2.5 py-1">
        <span className="font-mono text-[11px] text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <HeaderButton
            label={formatLabel}
            disabled={disabled}
            onClick={onFormat}
          >
            <WandSparklesIcon className="size-3.5" />
          </HeaderButton>
          <a
            href={helpHref}
            target="_blank"
            rel="noreferrer"
            aria-label={helpLabel}
            title={helpLabel}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <CircleQuestionMarkIcon className="size-3.5" />
          </a>
        </div>
      </div>
      <div ref={host} />
    </div>
  );
}

/** An icon-only action in the editor header. */
function HeaderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * JSON's own colours. The editor ships none of its own, so without this the
 * body is one flat grey block and the point of using an editor is lost.
 */
const jsonHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--chart-1, #7dd3fc)' },
  { tag: tags.string, color: 'var(--chart-2, #a5d6a7)' },
  { tag: tags.number, color: 'var(--chart-4, #f0b37e)' },
  { tag: tags.bool, color: 'var(--chart-4, #f0b37e)' },
  { tag: tags.null, color: 'var(--muted-foreground)' },
  { tag: tags.separator, color: 'var(--muted-foreground)' },
  { tag: tags.brace, color: 'var(--muted-foreground)' },
  { tag: tags.squareBracket, color: 'var(--muted-foreground)' },
]);

/** Marks `{{ … }}` so an expression does not read as malformed JSON. */
const expressionMark = Decoration.mark({ class: 'cm-template-expression' });

const expressionHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = mark(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = mark(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function mark(view: EditorView): DecorationSet {
  const ranges: ReturnType<typeof expressionMark.range>[] = [];
  const doc = view.state.doc.toString();
  for (const match of doc.matchAll(/\{\{[\s\S]*?\}\}/g)) {
    const from = match.index ?? 0;
    ranges.push(expressionMark.range(from, from + match[0].length));
  }
  return Decoration.set(ranges);
}

const editorTheme = EditorView.theme({
  '&': { fontSize: '12px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    padding: '8px 0',
    minHeight: '7rem',
    caretColor: 'var(--foreground)',
  },
  '.cm-scroller': {
    maxHeight: '15rem',
    lineHeight: '1.6',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  '.cm-line': { padding: '0 10px' },
  '.cm-gutters': {
    background: 'transparent',
    border: 'none',
    borderRight: '1px solid var(--border)',
    color: 'var(--muted-foreground)',
    paddingRight: '2px',
    userSelect: 'none',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--destructive)',
    textUnderlineOffset: '3px',
  },
  '.cm-tooltip-lint': { maxWidth: 'min(28rem, 85vw)' },
  '.cm-diagnostic-error': {
    borderLeftColor: 'var(--destructive)',
    fontFamily: 'inherit',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 6px 0 10px',
    minWidth: '1.5rem',
  },
  '.cm-activeLine': {
    background: 'color-mix(in oklch, var(--foreground) 4%, transparent)',
  },
  '.cm-activeLineGutter': {
    background: 'transparent',
    color: 'var(--foreground)',
  },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-selectionBackground, ::selection': { background: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground': { background: 'var(--accent)' },
  '.cm-template-expression': {
    color: 'var(--primary)',
    background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
    borderRadius: '3px',
  },
  '.cm-tooltip-autocomplete': {
    // Wide enough for a name and its description on one line; the popup is
    // free to reach past the field, which is narrower than the sentence.
    minWidth: 'min(28rem, 85vw)',
    maxWidth: 'min(34rem, 90vw)',
  },
  '.cm-tooltip-autocomplete > ul': { maxHeight: '13rem' },
  '.cm-tooltip': {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: 'var(--accent)',
    color: 'var(--accent-foreground)',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '3px 8px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
    justifyContent: 'space-between',
  },
  '.cm-completionLabel': {
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  },
  '.cm-completionDetail': {
    color: 'var(--muted-foreground)',
    fontStyle: 'normal',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  '.cm-completionInfo': {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px 8px',
    maxWidth: '18rem',
  },
});
