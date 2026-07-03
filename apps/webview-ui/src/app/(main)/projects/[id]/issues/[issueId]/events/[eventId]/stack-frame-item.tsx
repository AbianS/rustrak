'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  buildFrameContextLines,
  type StackFrame,
} from '@/lib/format-stack-trace';
import { cn } from '@/lib/utils';

/**
 * Detect programming language from filename extension
 */
function detectLanguage(filename?: string): string {
  if (!filename) return 'text';

  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    php: 'php',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
  };

  return langMap[ext ?? ''] ?? 'text';
}

/** Best-effort label for a frame's origin — `filename` first, falling back
 *  to `module`/`package` for platforms (JVM, .NET, native) that identify
 *  frames that way instead. */
function frameLocationLabel(frame: StackFrame): string {
  return frame.filename || frame.module || frame.package || '<unknown>';
}

export function StackFrameItem({
  frame,
  index,
}: {
  frame: StackFrame;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(frame.in_app ?? false);
  const contextLines = buildFrameContextLines(frame);
  const hasVars = frame.vars && Object.keys(frame.vars).length > 0;
  const hasContext = contextLines.length > 0 || hasVars;

  const language = detectLanguage(frame.filename);

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-colors',
        frame.in_app
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card/50 opacity-60',
      )}
    >
      {/* Frame Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span
          className={cn(
            'text-xs font-mono',
            frame.in_app ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {String(index).padStart(2, '0')}
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold truncate">
            {frame.function || frame.raw_function || '<anonymous>'}
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {frameLocationLabel(frame)}
            {frame.lineno && `:${frame.lineno}`}
            {frame.colno && `:${frame.colno}`}
          </p>
        </div>

        {hasContext && (
          <span className="text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
        )}
      </button>

      {/* Frame Context with Syntax Highlighting */}
      {isExpanded && hasContext && (
        <>
          {contextLines.length > 0 && (
            <div className="bg-zinc-900 font-mono text-xs leading-relaxed overflow-x-auto">
              {contextLines.map((line) => (
                <CodeLine
                  key={line.lineNumber}
                  lineNumber={line.lineNumber}
                  code={line.code}
                  language={language}
                  isHighlighted={line.isHighlighted}
                />
              ))}
            </div>
          )}
          {hasVars && <FrameVariables vars={frame.vars!} />}
        </>
      )}
    </div>
  );
}

function FrameVariables({ vars }: { vars: Record<string, unknown> }) {
  return (
    <div className="border-t px-4 py-3 space-y-1.5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Variables
      </p>
      <dl className="space-y-1">
        {Object.entries(vars).map(([key, value]) => (
          <div key={key} className="flex gap-2 text-xs font-mono">
            <dt className="shrink-0 text-muted-foreground">{key}</dt>
            <dd className="min-w-0 break-all text-foreground">
              {typeof value === 'string' ? value : JSON.stringify(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CodeLine({
  lineNumber,
  code,
  language,
  isHighlighted,
}: {
  lineNumber: number;
  code: string;
  language: string;
  isHighlighted: boolean;
}) {
  return (
    <div
      className={cn(
        'flex relative',
        isHighlighted ? 'bg-primary/15' : 'opacity-60',
      )}
    >
      {/* Highlight indicator */}
      {isHighlighted && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
      )}

      {/* Line number */}
      <span
        className={cn(
          'w-12 shrink-0 text-right pr-4 pl-3 select-none py-0.5',
          isHighlighted ? 'text-primary font-medium' : 'text-muted-foreground',
        )}
      >
        {lineNumber}
      </span>

      {/* Code with syntax highlighting */}
      <div className="flex-1 py-0.5 pr-4 overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: 'inherit',
            lineHeight: 'inherit',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'inherit',
              whiteSpace: 'pre',
            },
          }}
        >
          {code || ' '}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
