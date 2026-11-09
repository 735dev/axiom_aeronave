import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CatalogListPanel } from '@/features/catalogs/pages/CatalogsPage';
import { TicketTypesPanel } from '@/features/tickets/pages/TicketTypesPage';
import { StatusesPanel } from '@/features/tickets/pages/StatusesPage';
import { CatalogTabs } from '@/shared/components/layout/CatalogTabs';
import { useT } from '@/shared/hooks/useT';

/**
 * Una sola ruta para toda la administración de listas. El contenido cambia con
 * el parámetro `tipo` sin desmontar la pantalla: no hay recarga ni parpadeo al
 * saltar entre catálogos, tipos de ticket y estados.
 */
export function CatalogsRoute() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tipo = params.get('tipo');

  useEffect(() => {
    if (!tipo) setParams({ tipo: 'expense_concepts' }, { replace: true });
  }, [tipo, setParams]);

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">{t('catalogs.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('catalogs.subtitle')}</p>
      </header>

      <CatalogTabs />

      {tipo === 'ticket_types' ? (
        <TicketTypesPanel />
      ) : tipo === 'statuses' ? (
        <StatusesPanel />
      ) : (
        <CatalogListPanel />
      )}
    </section>
  );
}
