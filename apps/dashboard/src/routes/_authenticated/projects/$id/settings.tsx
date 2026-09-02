import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/projects/$id/settings')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authenticated/projects/$id/settings"!</div>;
}
