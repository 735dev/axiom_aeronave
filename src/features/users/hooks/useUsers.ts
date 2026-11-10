import { useMemo, useState } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { boolFilter, orUndefined, useListFilters } from '@/shared/hooks/useListFilters';
import { getUsers, UsersQuery } from '../api/usersApi';
import { AppUser } from '../types/user.types';

export function useUsers() {
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const { values, setFilter, reset } = useListFilters();

  /** Lo que se consulta, sin página ni límite: también es lo que se exporta. */
  const query = useMemo<UsersQuery>(
    () => ({
      q,
      is_active: boolFilter(values.is_active),
      role_id: orUndefined(values.role_id),
      location: orUndefined(values.location),
      aircraft_id: orUndefined(values.aircraft_id),
    }),
    [q, values],
  );

  const pagination = usePagination<AppUser, UsersQuery>({
    fetcher: getUsers,
    initialParams: query,
    initialLimit: 25,
  });

  return {
    ...pagination,
    search,
    setSearch,
    filters: values,
    setFilter,
    clear: () => {
      setSearch('');
      reset();
    },
    query,
  };
}
