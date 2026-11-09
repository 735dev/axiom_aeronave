import { SyncStatus } from '@/features/offline/components/SyncStatus';
import { NotificationsBell } from './NotificationsBell';
import { UserMenu } from './UserMenu';
import { Logo } from '@/shared/components/brand/Logo';

export function Topbar() {
  return (
    <header className="flex h-16 items-center gap-1 border-b border-border bg-card px-4">
      {/* En móvil no hay barra lateral: la marca vive aquí. */}
      <Logo className="md:hidden" />
      <div className="ml-auto flex items-center gap-1">
        <SyncStatus />
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
