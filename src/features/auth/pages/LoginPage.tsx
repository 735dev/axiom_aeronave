import { Navigate } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { Logo } from '@/shared/components/brand/Logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useT } from '@/shared/hooks/useT';
import { useAuth } from '@/shared/hooks/useAuth';
import { env } from '@/shared/config/env';

export function LoginPage() {
  const t = useT();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/tickets" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-sm shadow-soft">
        <CardHeader className="items-center gap-1 border-b border-border p-6 text-center">
          <Logo className="mx-auto mb-3" />
          <CardTitle className="text-balance text-lg font-extrabold">
            {t('auth.login.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('auth.login.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <LoginForm />
          {env.useMocks && (
            <p className="rounded-lg border border-border bg-muted p-2.5 text-center text-xs text-muted-foreground">
              {t('auth.login.demoHint')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
