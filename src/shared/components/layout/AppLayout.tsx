import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useMobileNav } from '@/shared/hooks/useMobileNav';
import { cn } from '@/shared/utils/cn';
import { Topbar } from './Topbar';
import { useSessionSync } from '@/shared/hooks/useSessionSync';

export function AppLayout() {
  useSessionSync();
  const { showsBar } = useMobileNav();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className={cn('flex-1 md:pb-6', showsBar ? 'pb-20' : 'pb-6')}>
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
