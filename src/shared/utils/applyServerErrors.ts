import { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import { ApiError } from '@/shared/api/types';

export function applyServerErrors<T extends FieldValues>(setError: UseFormSetError<T>, err: ApiError) {
  if (!err.fieldErrors) return;
  Object.entries(err.fieldErrors).forEach(([field, message]) => {
    setError(field as Path<T>, { type: 'server', message });
  });
}
