import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/features/user/api/queries';
import { OutageScreen } from '@/shared/ui/outage-screen';

export default async function Home() {
  const session = await getCurrentUser();

  // `anonymous` is the only state that means "log in". This route sits outside
  // the `(main)` group, so it has no gate above it and owns the whole decision.
  if (session.state === 'anonymous') {
    redirect('/auth/login');
  }

  if (session.state === 'unavailable') {
    return <OutageScreen error={session.error} />;
  }

  redirect('/projects');
}
