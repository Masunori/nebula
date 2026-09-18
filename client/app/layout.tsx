import type { Metadata } from 'next';
import './globals.css';
import { AppNav } from '@/components/ui/AppNav';

export const metadata: Metadata = {
  title: 'RailSync — Railway Track Access Planner',
  description: 'Railway possession scheduling and replanning tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="">
      <body>
        <AppNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
