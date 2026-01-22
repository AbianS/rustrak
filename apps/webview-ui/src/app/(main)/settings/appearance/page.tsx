import type { Metadata } from 'next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ThemeSelector } from './theme-selector';

export const metadata: Metadata = {
  title: 'Appearance | Rustrak',
  description: 'Customize the appearance of Rustrak',
};

export default function AppearancePage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Appearance</h1>
        <p className="text-muted-foreground mt-1">
          Customize how Rustrak looks on your device
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Select your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>
    </>
  );
}
