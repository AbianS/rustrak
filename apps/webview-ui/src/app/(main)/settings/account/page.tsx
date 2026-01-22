import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/actions/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export const metadata: Metadata = {
  title: 'Account | Rustrak',
  description: 'Manage your account settings',
};

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Account</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account information
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            {user.is_admin && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Role</Label>
                <p className="text-sm font-medium">Administrator</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
