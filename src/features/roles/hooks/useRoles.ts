import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { notify } from '@/shared/utils/notify';
import { getModules, getPermissions, getRoles, RolesQuery } from '../api/rolesApi';
import { Module, Permission, Role } from '../types/role.types';

export function useRoles() {
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const initialParams = useMemo<RolesQuery>(() => ({ q }), [q]);

  const pagination = usePagination<Role, RolesQuery>({
    fetcher: getRoles,
    initialParams,
    initialLimit: 20,
  });

  return { ...pagination, search, setSearch };
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
