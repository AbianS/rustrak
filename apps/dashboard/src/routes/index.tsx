import { Button, CreateIcon, IssueIcon, ResolveIcon } from '@rustrak/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/')({ component: Overview });

function Overview() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-fg">Overview</h1>
        <Button variant="primary" size="lg" icon={CreateIcon}>
          New project
        </Button>
      </div>

      <p className="max-w-prose text-body text-fg-secondary">
        This page exists to prove three things at once: that{' '}
        <code className="font-mono text-code text-fg-brand">@rustrak/ui</code>{' '}
        renders inside the Vite app, that client-side routing works, and that
        the Rust binary can serve the whole thing itself.
      </p>

      <section className="flex flex-col gap-3 rounded-lg bg-surface p-5 inset-ring inset-ring-border">
        <h2 className="text-section text-fg">
          Buttons, from the design system
        </h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="primary" icon={ResolveIcon}>
            Resolve
          </Button>
          <Button variant="secondary" icon={IssueIcon}>
            Assign
          </Button>
          <Button variant="ghost">Ignore</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="dashed" icon={CreateIcon}>
            Add alert rule
          </Button>
        </div>
      </section>

      {/* Navigating from an event handler rather than a link, so the spike
          covers both ways a route change can start. */}
      <div>
        <Button variant="secondary" onClick={() => navigate({ to: '/issues' })}>
          Go to issues
        </Button>
      </div>
    </div>
  );
}
