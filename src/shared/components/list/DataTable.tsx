import { Fragment, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

export interface Column<T> {
  key: string;
  /** Texto o clave i18n de la cabecera; también es la etiqueta en la tarjeta móvil. */
  header: string;
  cell: (row: T) => ReactNode;
  /** Columna que encabeza la tarjeta móvil (sin etiqueta). Si ninguna lo es, la primera. */
  primary?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Clases extra para la celda de escritorio (anchos, `data`, etc.). */
  className?: string;
  /** No se muestra en la tarjeta móvil (columnas de apoyo). */
  hideOnMobile?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  /** Texto o clave i18n cuando no hay filas. */
  emptyMessage?: string;
  /** Botones al final de la fila (editar, desactivar…). */
  actions?: (row: T) => ReactNode;
  /** Fila navegable: toda la fila lleva al destino. */
  rowHref?: (row: T) => string | undefined;
  /** Fila accionable sin destino propio (marcar leído y navegar, abrir un diálogo…). */
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Contenido bajo la fila (detalle expandido, por ejemplo). */
  renderExpanded?: (row: T) => ReactNode;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Único formato de lista de la aplicación: tabla en escritorio, tarjeta apilada
 * en móvil, ambas desde las mismas definiciones de columna. Solo pinta; el
 * search, los filtros, la paginación y exportar los ponen ListToolbar,
 * PaginatedComplete y ExportButton.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyMessage = 'common.empty',
  actions,
  rowHref,
  onRowClick,
  rowClassName,
  renderExpanded,
}: Props<T>) {
  const t = useT();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isLoading && rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        {t(emptyMessage)}
      </div>
    );
  }

  const wrap = (row: T, children: ReactNode, className: string) => {
    const href = rowHref?.(row);
    return href ? (
      <Link to={href} className={cn('block', className)}>
        {children}
      </Link>
    ) : (
      <div className={className}>{children}</div>
    );
  };

  if (!isDesktop) {
    const primary = columns.find((c) => c.primary) ?? columns[0];
    const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
    return (
      <ul className={cn('space-y-3', isLoading && 'opacity-60')}>
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              className={cn(
                'rounded-lg border border-border bg-card p-3.5',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row),
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {wrap(
                row,
                <div className="space-y-2">
                  {primary && <div className="text-sm font-medium">{primary.cell(row)}</div>}
                  <dl className="space-y-1.5">
                    {rest.map((c) => (
                      <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                        <dt className="shrink-0 text-xs text-muted-foreground">{t(c.header)}</dt>
                        <dd className="min-w-0 text-right">{c.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>,
                '',
              )}
              {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">{actions(row)}</div>}
              {renderExpanded?.(row)}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border bg-card', isLoading && 'opacity-60')}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('label-strip whitespace-nowrap px-4 py-3 font-normal', ALIGN[c.align ?? 'left'])}
              >
                {t(c.header)}
              </th>
            ))}
            {actions && <th scope="col" className="px-4 py-3" aria-label={t('list.actions')} />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const href = rowHref?.(row);
            const expanded = renderExpanded?.(row);
            return (
              <Fragment key={rowKey(row)}>
                <tr
                  className={cn(
                    'transition-colors hover:bg-muted/40',
                    (href || onRowClick) && 'cursor-pointer',
                    rowClassName?.(row),
                  )}
                  onClick={href ? () => navigate(href) : onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn('px-4 py-3 align-middle', ALIGN[c.align ?? 'left'], c.className)}>
                      {href && i === 0 ? (
                        <Link to={href} onClick={(e) => e.stopPropagation()}>
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-2">{actions(row)}</div>
                    </td>
                  )}
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 pb-3">
                      {expanded}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
