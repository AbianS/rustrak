import { createFileRoute, redirect } from '@tanstack/react-router';

// The dashboard has no separate overview: projects is where work starts, so
// `/` is that page's address rather than a screen of its own. Redirecting in
// `beforeLoad` means nothing renders first.
export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    throw redirect({ to: '/projects' });
  },
});
