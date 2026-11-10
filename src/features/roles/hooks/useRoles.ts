import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { boolFilter, useListFilters } from '@/shared/hooks/useListFilters';
import { notify } from '@/shared/utils/notify';
import { getModules, getPermissions, getRoles, RolesQuery } from '../api/rolesApi';
import { Module, Permission, Role } from '../types/role.types';

export function useRoles() {
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const { values, setFilter, reset } = useListFilters();

  /** Lo que se consulta, sin página ni límite: también es lo que se exporta. */
  const query = useMemo<RolesQuery>(
    () => ({ q, is_active: boolFilter(values.is_active), is_system: boolFilter(values.is_system) }),
    [q, values],
  );

  const pagination = usePagination<Role, RolesQuery>({
    fetcher: getRoles,
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

export function usePermissionCatalog() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [permissionsRes, modulesRes] = await Promise.all([getPermissions(), getModules()]);
    if (permissionsRes.ok) setPermissions(permissionsRes.data);
    else notify.fromApiError(permissionsRes);
    if (modulesRes.ok) setModules(modulesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byModule = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((acc, p) => {
      const list = acc[p.module_code] ?? [];
      list.push(p);
      acc[p.module_code] = list;
      return acc;
    }, {});
  }, [permissions]);

  return { permissions, modules, byModule, isLoading, reload: load };
}
