import type { Metadata } from 'next';
import { SettingsNav } from './settings-nav';

export const metadata: Metadata = {
  title: 'Settings | Rustrak',
  description: 'Manage your Rustrak settings',
};

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="max-w-[1600px] w-full mx-auto">
      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-border p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 px-3">
            Settings
          </h2>
          <SettingsNav />
        </aside>

        {/* Main content */}
        <div className="flex-1 p-8">{children}</div>
      </div>
    </div>
  );
}
