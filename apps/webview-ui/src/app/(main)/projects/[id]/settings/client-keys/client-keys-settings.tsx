'use client';

import type { Project } from '@rustrak/client';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';
import { SettingSection } from '../setting-row';

interface ClientKeysSettingsProps {
  project: Project;
}

type HighlighterComponent = typeof import('react-syntax-highlighter').Prism;
type HighlighterStyle = Record<string, React.CSSProperties>;

export function ClientKeysSettings({ project }: ClientKeysSettingsProps) {
  const { resolvedTheme } = useTheme();
  const [copiedDsn, setCopiedDsn] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [Highlighter, setHighlighter] = useState<HighlighterComponent | null>(
    null,
  );
  const [highlighterStyle, setHighlighterStyle] =
    useState<HighlighterStyle | null>(null);
  const [highlighterFailed, setHighlighterFailed] = useState(false);
  const isDark = resolvedTheme === 'dark';

  // Loaded lazily: the highlighter is far larger than this page's own code,
  // and the DSN above it stays useful while it arrives.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('react-syntax-highlighter').then((mod) => mod.Prism),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ])
      .then(([component, styles]) => {
        if (cancelled) return;
        setHighlighter(() => component);
        setHighlighterStyle(
          (isDark ? styles.vscDarkPlus : styles.vs) as HighlighterStyle,
        );
      })
      .catch(() => {
        // Chunk failed to load. Fall back to the plain <pre> below rather than
        // spinning forever, and don't leave the rejection unhandled.
        if (!cancelled) setHighlighterFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDark]);

  const codeExample = `import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${project.dsn}",
});`;

  const copy = async (
    value: string,
    setFlag: (copied: boolean) => void,
    label: string,
  ) => {
    if (!(await copyToClipboard(value))) {
      toast.info('Clipboard unavailable', {
        description: `Select the ${label} and copy it manually, or access Rustrak over HTTPS.`,
      });
      return;
    }
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  };

  return (
    <div className="max-w-3xl">
      <SettingSection
        title="DSN"
        description="Point any Sentry SDK at this string to send events to this project."
      >
        <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted p-3">
          <code className="flex-1 truncate font-mono text-xs">
            {project.dsn}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copy(project.dsn, setCopiedDsn, 'DSN')}
            className="shrink-0"
            aria-label="Copy DSN"
          >
            {copiedDsn ? (
              <Check className="size-4 text-primary" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
      </SettingSection>

      <SettingSection
        title="Example (JavaScript)"
        description="Minimal setup for a browser app. Every SDK takes this same DSN, see the Sentry docs for yours."
      >
        <div className="mt-3">
          <div className="mb-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(codeExample, setCopiedCode, 'example')}
              className="h-6 text-xs"
            >
              {copiedCode ? (
                <>
                  <Check className="mr-1 size-3 text-primary" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 size-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="overflow-hidden overflow-x-auto rounded-lg border">
            {Highlighter && highlighterStyle ? (
              <Highlighter
                language="javascript"
                style={highlighterStyle}
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  fontSize: '0.75rem',
                  background: isDark ? '#1e1e1e' : '#ffffff',
                }}
              >
                {codeExample}
              </Highlighter>
            ) : highlighterFailed ? (
              <pre className="overflow-x-auto p-4 font-mono text-xs">
                {codeExample}
              </pre>
            ) : (
              <div className="flex h-24 animate-pulse items-center justify-center bg-muted p-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This server is compatible with all official Sentry SDKs. Check the{' '}
            <a
              href="https://docs.sentry.io/platforms/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Sentry documentation
            </a>{' '}
            for platform-specific setup instructions.
          </p>
        </div>
      </SettingSection>
    </div>
  );
}
