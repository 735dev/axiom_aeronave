import { useEffect, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { apiAxios } from '@/shared/api/api';
import { isSuccessfully } from '@/shared/api/handlers';
import { useT } from '@/shared/hooks/useT';
import { useCan } from '@/shared/hooks/useCan';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { cn } from '@/shared/utils/cn';

interface CatalogChip {
  key: string;
  name: string;
  count?: number;
}

/**
 * Barra única de catálogos. Las listas simples viven en /catalogos con el
 * parámetro `tipo`; tipos de ticket y estados tienen pantalla propia porque
 * su edición es distinta, pero se navegan desde el mismo lugar.
 */
export function CatalogTabs() {
  const t = useT();
  const { can } = useCan();
  const [params] = useSearchParams();
  const [chips, setChips] = useState<CatalogChip[]>([]);
  const active = params.get('tipo');

  useEffect(() => {
    void apiAxios
      .get({ url: '/catalogs/' })
      .then((res) => {
        if (!isSuccessfully(res.status)) return;
        setChips(
          (res.data as Array<{ key: string; name: string; items_count: number }>).map((c) => ({
            key: c.key,
            name: c.name,
            count: c.items_count,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const chipClass = (isActive: boolean) =>
    cn(
      'shrink-0 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted',
      isActive && 'border-primary text-primary',
    );

  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 pb-1 md:mx-0 md:px-0">
      {chips.map((chip) => (
        <NavLink
          key={chip.key}
          to={`/catalogos?tipo=${chip.key}`}
          className={({ isActive }) => chipClass(isActive && active === chip.key)}
        >
          {chip.name}
          {chip.count !== undefined && <span className="ml-1.5 text-xs opacity-70">{chip.count}</span>}
        </NavLink>
      ))}

      {can(PERMISSIONS.ticketTypesManage) && (
        <>
          <NavLink
            to="/catalogos?tipo=ticket_types"
            className={() => chipClass(active === 'ticket_types')}
          >
            {t('nav.ticketTypes')}
          </NavLink>
          <NavLink
            to="/catalogos?tipo=statuses"
            className={() => chipClass(active === 'statuses')}
          >
            {t('nav.statuses')}
          </NavLink>
        </>
      )}
    </nav>
  );
}
