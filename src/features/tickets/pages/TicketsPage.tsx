import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTickets, useTicketTypes } from '../hooks/useTickets';
import { TicketsList } from '../components/TicketsList';
import { TicketFilters } from '../components/TicketFilters';
import { NewTicketDialog } from '../components/NewTicketDialog';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { Button } from '@/shared/components/ui/button';
import { useCan } from '@/shared/hooks/useCan';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { useT } from '@/shared/hooks/useT';
import { useTypeAccess } from '@/shared/auth/typeAccess';
import { cn } from '@/shared/utils/cn';

type View = 'operations' | 'work' | 'mine';

interface Props {
  /** La misma pantalla sirve de bandeja general o de listado de operaciones. */
  initialView?: View;
}

const VIEWS: View[] = ['operations', 'work', 'mine'];

export function TicketsPage({ initialView = 'work' }: Props) {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);

  // La pestaña viaja en la URL junto con los filtros: al volver desde un
  // expediente el usuario debe encontrar la pantalla como la dejó.
  const fromUrl = params.get('vista') as View | null;
  const view: View = fromUrl && VIEWS.includes(fromUrl) ? fromUrl : initialView;

  const setView = (next: View) => {
    setParams(
      (prev) => {
        const draft = new URLSearchParams(prev);
        draft.set('vista', next);
        // Cambiar de pestaña cambia el universo de tipos: los filtros del
        // anterior no aplican y quedarían filtrando por algo invisible.
        ['tipo', 'estado', 'abierto'].forEach((key) => draft.delete(key));
        return draft;
      },
      { replace: true },
    );
  };

  const fixed =
    view === 'operations'
      ? { is_root: true }
      : view === 'mine'
        ? // Incluye la operación raíz: la misión de un piloto ES su vuelo.
          { mine: true, open: true }
        : { is_root: false };

  const tickets = useTickets(fixed);
  const { types: allTypes } = useTicketTypes({ is_active: true });
  const { canForType } = useTypeAccess();
  const { canScoped } = useCan();
  const types = allTypes.filter((type) => canForType('view', type.code));
  const creatableTypes = (view === 'operations' ? types.filter((x) => x.is_root) : types).filter(
    (x) => canForType('create', x.code),
  );

  const tab = (value: View, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setView(value)}
      className={cn(
        'flex-1 border-b-2 border-transparent px-3 pb-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:flex-none sm:px-4',
        view === value && 'border-primary text-primary',
      )}
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{t('tickets.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('tickets.subtitle')}</p>
        </div>
        {canScoped(PERMISSIONS.ticketsCreate) && creatableTypes.length > 0 && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {view === 'operations' ? t('tickets.newOperation') : t('tickets.new')}
          </Button>
        )}
      </header>

      <div className="flex gap-1 border-b border-border">
        {tab('operations', t('tickets.viewOperations'))}
        {tab('work', t('tickets.viewWork'))}
        {tab('mine', t('tickets.viewMine'))}
      </div>

      <TicketFilters
        types={view === 'operations' ? types.filter((x) => x.is_root) : types.filter((x) => !x.is_root)}
        search={tickets.search}
        filters={tickets.filters}
        onSearch={tickets.setSearch}
        onChange={tickets.setFilters}
      />

      <TicketsList items={tickets.items} isLoading={tickets.isLoading} />

      <PaginatedComplete
        page={tickets.page}
        limit={tickets.limit}
        total={tickets.total}
        links={tickets.links}
        onPageChange={tickets.setPage}
      />

      <NewTicketDialog
        open={creating}
        types={creatableTypes}
        onOpenChange={setCreating}
        onCreated={() => void tickets.reload()}
      />
    </section>
  );
}
