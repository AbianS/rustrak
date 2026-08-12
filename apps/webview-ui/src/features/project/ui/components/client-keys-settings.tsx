'use client';

import type { Project } from '@rustrak/client';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  PLATFORM_DOCS,
  PLATFORM_SNIPPETS,
  renderSnippet,
} from '@/shared/config/platform-snippets';
import { platformLabel } from '@/shared/config/platforms';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { SettingSection } from '@/shared/ui/components/setting-row';
import { Button } from '@/shared/ui/components/shadcn/button';

interface ClientKeysSettingsProps {
  project: Project;
}

type HighlighterComponent = typeof import('react-syntax-highlighter').Prism;
type HighlighterStyle = Record<string, React.CSSProperties>;

export function ClientKeysSettings({ project }: ClientKeysSettingsProps) {
  const t = useTranslations('projects');
  const { resolvedTheme } = useTheme();
  const [copiedDsn, setCopiedDsn] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [Highlighter, setHighlighter] = useState<HighlighterComponent | null>(
    null,
  );
  const [highlighterStyle, setHighlighterStyle] =
    useState<HighlighterStyle | null>(null);
  const [highlighterFailed, setHighlighterFailed] = useState(false);
  const isDark = resolvedTheme === 'dark';

  async function copy(
    value: string,
    setFlag: (copied: boolean) => void,
    label: string,
  ) {
    if (!(await copyToClipboard(value))) {
      toast.info(t('copyUnavailable'), {
        description: t('copyUnavailableHint', { label }),
      });
      return;
    }
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  }

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

  // Setup instructions follow the project's own platform. Only a project with
  // no platform at all (never set, no event ingested yet) gets the generic
  // browser example.
  //
  // A project that HAS a platform but no snippet must never get it: snippet
  // coverage is partial by design, and the platforms it misses are mostly
  // console and native ones (unreal, playstation, xbox, native...) where a
  // `@sentry/browser` example is actively misleading. Sentry does the same,
  // and more strictly: `sdkDocumentation.tsx` renders an explicit "currently
  // unavailable" error rather than substituting another platform's snippet.
  const snippet = project.platform
    ? PLATFORM_SNIPPETS[project.platform]
    : undefined;
  const docsUrl = project.platform
    ? PLATFORM_DOCS[project.platform]
    : undefined;

  // Absent for a selected platform we have no snippet for. The DSN section and
  // the docs link carry the page on their own, which is what Sentry falls back
  // to for its deprecated platforms (`deprecatedPlatformInfo.tsx`).
  const codeExample = snippet
    ? renderSnippet(snippet.configure, project.dsn)
    : project.platform
      ? undefined
      : `import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${project.dsn}",
});`;
  const codeLanguage = snippet?.language ?? 'javascript';
  const exampleTitle = snippet
    ? t('clientKeys.examplePlatform', {
        platform: platformLabel(project.platform ?? ''),
      })
    : t('clientKeys.exampleJs');

  return (
    <div className="max-w-3xl">
      <SettingSection
        title={t('clientKeys.dsn')}
        description={t('clientKeys.dsnDescription')}
      >
        <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted p-3">
          <code className="flex-1 truncate font-mono text-xs">
            {project.dsn}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copy(project.dsn, setCopiedDsn, t('clientKeys.dsn'))}
            className="shrink-0"
            aria-label={t('clientKeys.copyDsn')}
          >
            {copiedDsn ? (
              <Check className="size-4 text-primary" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
      </SettingSection>

      {snippet?.install && (
        <SettingSection
          title={t('clientKeys.install')}
          description={t('clientKeys.installDescription')}
        >
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted p-3">
            <code className="flex-1 overflow-x-auto font-mono text-xs">
              {snippet.install}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                copy(
                  snippet.install ?? '',
                  setCopiedInstall,
                  t('clientKeys.commandLabel'),
                )
              }
              className="shrink-0"
              aria-label={t('clientKeys.copyInstallCommand')}
            >
              {copiedInstall ? (
                <Check className="size-4 text-primary" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </SettingSection>
      )}

      <SettingSection
        title={codeExample ? exampleTitle : t('clientKeys.setup')}
        description={
          codeExample ? t('clientKeys.dsnFilled') : t('clientKeys.pointSdk')
        }
      >
        <div className="mt-3">
          {codeExample && (
            <>
              <div className="mb-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copy(
                      codeExample,
                      setCopiedCode,
                      t('clientKeys.exampleLabel'),
                    )
                  }
                  className="h-6 text-xs"
                >
                  {copiedCode ? (
                    <>
                      <Check className="mr-1 size-3 text-primary" />
                      {t('clientKeys.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 size-3" />
                      {t('clientKeys.copy')}
                    </>
                  )}
                </Button>
              </div>
              <div className="overflow-hidden overflow-x-auto rounded-lg border">
                {Highlighter && highlighterStyle ? (
                  <Highlighter
                    language={codeLanguage}
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
            </>
          )}
          <p
            className={`text-xs text-muted-foreground${codeExample ? ' mt-3' : ''}`}
          >
            {t('clientKeys.compatLead')}{' '}
            <a
              href={docsUrl ?? 'https://docs.sentry.io/platforms/'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {docsUrl
                ? t('clientKeys.docsPlatform', {
                    platform: platformLabel(project.platform ?? ''),
                  })
                : t('clientKeys.docsSentry')}
            </a>{' '}
            {codeExample
              ? t('clientKeys.compatFull')
              : t('clientKeys.compatSteps')}
          </p>
        </div>
      </SettingSection>
    </div>
  );
}
