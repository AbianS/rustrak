'use client';

import type { User } from '@rustrak/client';
import { LogOut, Settings, Terminal, Book } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { logout } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
    <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-10">
        {/* Logo */}
        <Link href="/projects" className="flex items-center gap-2">
          <div className="size-6 bg-primary rounded-sm flex items-center justify-center">
            <Terminal className="size-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-extrabold tracking-tight uppercase">
            Rustrak
          </span>
        </Link>
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-4">
        {/* Documentation Link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <a href="https://abians.github.io/rustrak" 
                target="_blank"
                rel="noopener noreferrer">
                  <Book className="size-4" />
                  <span className="sr-only">Documentation</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Documentation</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="size-8 rounded-full p-0 bg-primary/20 hover:bg-primary/30"
              aria-label="Open user menu"
            >
              <span
                className="text-xs font-bold text-primary"
                aria-hidden="true"
              >
                {user.email.charAt(0).toUpperCase()}
              </span>
              <span className="sr-only">User menu for {user.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.email}</p>
              {user.is_admin && (
                <p className="text-xs text-muted-foreground">Admin</p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isPending}
              className="cursor-pointer text-destructive focus:text-destructive"
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
