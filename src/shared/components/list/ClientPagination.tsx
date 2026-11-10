import { PAGE_SIZE_OPTIONS, PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { useClientList } from '@/shared/hooks/useClientList';

type ClientList = Pick<
  ReturnType<typeof useClientList>,
  'page' | 'limit' | 'total' | 'links' | 'setPage' | 'setLimit'
>;

/**
 * Paginación de una lista en memoria. Con menos registros que la página mínima
 * no hay nada que paginar y el control no aparece.
 */
export function ClientPagination({ list }: { list: ClientList }) {
  if (list.total <= (PAGE_SIZE_OPTIONS[0] ?? 10)) return null;
  return (
    <PaginatedComplete
      page={list.page}
      limit={list.limit}
      total={list.total}
      links={list.links}
      onPageChange={list.setPage}
      onLimitChange={list.setLimit}
    />
  );
}
