'use client';

import type { User } from '@rustrak/client';
import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { RustrakLogoIcon } from '@/components/icons/rustrak-logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout } from '@/features/user/api/mutations';

interface HeaderProps {
  user: User;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logout();
      router.push('/auth/login');
    });
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-4 md:gap-10">
        {/* Logo */}
        <Link href="/projects" className="flex items-center gap-2">
          <RustrakLogoIcon className="size-6" />
          <span className="text-sm font-extrabold tracking-tight uppercase">
            Rustrak
          </span>
        </Link>
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="size-8 rounded-full p-0 bg-primary/20 hover:bg-primary/30"
                aria-label="Open user menu"
              />
            }
          >
            <span className="text-xs font-bold text-primary" aria-hidden="true">
              {user.email.charAt(0).toUpperCase()}
            </span>
            <span className="sr-only">User menu for {user.email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium truncate">{user.email}</p>
              {user.is_admin && (
                <p className="text-xs text-muted-foreground">Admin</p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href="/settings" className="cursor-pointer" />}
            >
              <Settings className="mr-2 size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
              disabled={isPending}
            >
              <LogOut className="mr-2 size-4" />
              {isPending ? 'Signing out...' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
