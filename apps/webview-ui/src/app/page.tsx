import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/actions/auth';

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  redirect('/projects');
}
