'use client';

import type { Project } from '@rustrak/client';
import { Check, Copy, Loader2, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateProject } from '@/actions/projects';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface ProjectSettingsDialogProps {
  project: Project;
}

// Dynamically loaded syntax highlighter component and style
type HighlighterComponent = typeof import('react-syntax-highlighter').Prism;
type HighlighterStyle = Record<string, React.CSSProperties>;

export function ProjectSettingsDialog({ project }: ProjectSettingsDialogProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [copiedDsn, setCopiedDsn] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [Highlighter, setHighlighter] = useState<HighlighterComponent | null>(
    null,
  );
  const [highlighterStyle, setHighlighterStyle] =
    useState<HighlighterStyle | null>(null);
  const isDark = resolvedTheme === 'dark';

  const hasChanges = name !== project.name;

  // Load syntax highlighter dynamically when dialog opens
  useEffect(() => {
    if (open && !Highlighter) {
      Promise.all([
        import('react-syntax-highlighter').then((mod) => mod.Prism),
        import('react-syntax-highlighter/dist/esm/styles/prism').then(
          (styles) => (isDark ? styles.vscDarkPlus : styles.vs),
        ),
      ]).then(([component, style]) => {
        setHighlighter(() => component);
        setHighlighterStyle(style as HighlighterStyle);
      });
    }
  }, [open, Highlighter, isDark]);

  // Update style when theme changes
  useEffect(() => {
    if (Highlighter) {
      import('react-syntax-highlighter/dist/esm/styles/prism').then(
        (styles) => {
          setHighlighterStyle(
            (isDark ? styles.vscDarkPlus : styles.vs) as HighlighterStyle,
          );
        },
      );
    }
  }, [isDark, Highlighter]);

  const copyDsn = async () => {
    await navigator.clipboard.writeText(project.dsn);
    setCopiedDsn(true);
    setTimeout(() => setCopiedDsn(false), 2000);
  };

  const codeExample = `import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${project.dsn}",
});`;

  const copyCode = async () => {
    await navigator.clipboard.writeText(codeExample);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSave = () => {
    if (!hasChanges || !name.trim()) return;

    startTransition(async () => {
      try {
        await updateProject(project.id, { name: name.trim() });
        toast.success('Project updated');
        router.refresh();
        setOpen(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update project';
        toast.error('Failed to update project', { description: message });
      }
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset name to current value when closing
      setName(project.name);
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Project Settings">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Configure your project and view integration details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Name */}
          <div className="space-y-2">
            <Label
              htmlFor="project-name"
              className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
            >
              Project Name
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                disabled={isPending}
              />
              <Button
                onClick={handleSave}
                disabled={isPending || !hasChanges || !name.trim()}
                size="sm"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* DSN */}
          <div className="space-y-2">
            <label
              htmlFor="dsn"
              className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
            >
              DSN
            </label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
              <code className="flex-1 text-xs font-mono truncate">
                {project.dsn}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyDsn}
                className="shrink-0"
              >
                {copiedDsn ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Code Example */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="codeExample"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                Example (JavaScript)
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCode}
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
            <div className="rounded-lg border overflow-hidden">
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
              ) : (
                <div className="p-4 bg-muted animate-pulse h-24 flex items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  );
}
