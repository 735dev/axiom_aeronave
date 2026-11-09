import { useEffect, useState } from 'react';
import { Mail, Plane, ShieldCheck, UserCircle } from 'lucide-react';
import { apiAxios } from '@/shared/api/api';
import { isSuccessfully } from '@/shared/api/handlers';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useT } from '@/shared/hooks/useT';
import { useAuth } from '@/shared/hooks/useAuth';
import { SignatureCard } from '../components/SignatureCard';

export function ProfilePage() {
  const t = useT();
  const { user, permissions } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    void apiAxios
      .get({ url: '/roles/?limit=100' })
      .then((res) => {
        if (!isSuccessfully(res.status)) return;
        const role = (res.data.data as Array<{ id: string; permissions: string[] }>).find(
          (r) => r.id === user.role_id,
        );
        setRolePermissions(role?.permissions ?? []);
      })
      .catch(() => undefined);
  }, [user]);

  if (!user) return null;

  // Un permiso que tengo pero que mi rol no da, vino como excepción.
  const isExtra = (code: string) => rolePermissions.length > 0 && !rolePermissions.includes(code);

  return (
    <section className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            {user.full_name ?? user.email}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {user.role_name}
            </span>
            {user.aircraft_id && (
              <span className="flex items-center gap-1.5">
                <Plane className="h-3.5 w-3.5" />
                {user.aircraft_id}
              </span>
            )}
          </div>
        </CardHeader>
      </Card>

      <SignatureCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            {t('profile.permissions')} ({permissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {permissions.map((code) => (
            <Badge key={code} variant={isExtra(code) ? 'success' : 'info'}>
              {code}
              {isExtra(code) && ` · ${t('users.granted')}`}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t('profile.hint')}</p>
    </section>
  );
}
