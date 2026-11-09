import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { LoginInput, loginSchema } from '../schemas/loginSchema';
import { signIn } from '../api/authApi';
import { FormInput } from '@/shared/components/form/FormInput';
import { Button } from '@/shared/components/ui/button';
import { applyServerErrors } from '@/shared/utils/applyServerErrors';
import { notify } from '@/shared/utils/notify';
import { useT } from '@/shared/hooks/useT';
import { useAuth } from '@/shared/hooks/useAuth';

export function LoginForm() {
  const t = useT();
  const navigate = useNavigate();
  const { signIn: persistSession } = useAuth();
  const methods = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'operaciones@transvalor.com', password: 'demo1234' },
  });

  const onSubmit = async (input: LoginInput) => {
    const res = await signIn(input);
    if (res.ok) {
      persistSession({
        token: res.data.token,
        refreshToken: res.data.refresh_token,
        user: res.data.user,
        permissions: res.data.permissions,
      });
      navigate('/tickets', { replace: true });
      return;
    }
    if (res.status === 422) applyServerErrors(methods.setError, res);
    notify.fromApiError(res);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput<LoginInput>
          name="email"
          type="email"
          label="auth.login.email"
          autoComplete="username"
        />
        <FormInput<LoginInput>
          name="password"
          type="password"
          label="auth.login.password"
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full" disabled={methods.formState.isSubmitting}>
          {t('auth.login.submit')}
        </Button>
      </form>
    </FormProvider>
  );
}
