import { useMemo, useState } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { getUsers, UsersQuery } from '../api/usersApi';
import { AppUser } from '../types/user.types';

export function useUsers() {
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const initialParams = useMemo<UsersQuery>(() => ({ q }), [q]);

  const pagination = usePagination<AppUser, UsersQuery>({
    fetcher: getUsers,
    initialParams,
    initialLimit: 20,
  });

  return { ...pagination, search, setSearch };
}
