import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/projects/$id/performance',
)({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authenticated/projects/$id/performance"!</div>;
}
