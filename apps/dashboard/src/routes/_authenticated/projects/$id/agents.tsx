import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/projects/$id/agents')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authenticated/projects/$id/agents"!</div>;
}
