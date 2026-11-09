import { Toaster } from 'sonner';
import { useAppSelector } from '@/shared/store/hooks';

export function ToasterRoot() {
  const theme = useAppSelector((s) => s.theme.mode);
  return (
    <Toaster
      richColors
      theme={theme === 'dark' ? 'dark' : 'light'}
      closeButton
      position="top-right"
    />
  );
}
