import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { FieldDef, FieldRole, FieldType } from '../../types/ticket.types';
import { CatalogKey } from '@/features/catalogs/types/catalog.types';
import { Input } from '@/shared/components/ui/input';
import { Select } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { PermissionOption } from '@/shared/auth/accessApi';

const FIELD_TYPES: FieldType[] = [
  'text',
  'textarea',
  'number',
  'money',
  'select',
  'date',
  'time',
  'checkbox',
  'file',
];

/** Roles que el sistema entiende: de ellos salen los totales, el número y la lectura. */
export const FIELD_ROLES: FieldRole[] = [
  'amount',
  'currency',
  'accounting_date',
  'aircraft',
  'item',
  'quantity',
  'unit',
  'supplier',
];

const CATALOG_KEYS: CatalogKey[] = [
  'expense_concepts',
  'units',
  'currencies',
  'operation_kinds',
  'operation_scopes',
  'aircraft_statuses',
  'aircrafts',
  'airports',
  'locations',
];

interface Props {
  field: FieldDef;
  index: number;
  total: number;
  permissions: PermissionOption[];
  onChange: (field: FieldDef) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function FieldEditor({
  field,
  index,
  total,
  permissions,
  onChange,
  onRemove,
  onMove,
}: Props) {
  const t = useT();
  const set = (patch: Partial<FieldDef>) => onChange({ ...field, ...patch });

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t('ticketTypes.field')} {index + 1}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">{t('ticketTypes.fields.label')}</Label>
          <Input value={field.label} onChange={(e) => set({ label: e.target.value })} />
        </div>

        <div>
          <Label className="mb-1.5 block">{t('ticketTypes.fields.type')}</Label>
          <Select
            value={field.type}
            onChange={(e) => set({ type: e.target.value as FieldType, catalog: undefined })}
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`ticketTypes.fieldType.${type}`)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">{t('ticketTypes.fields.width')}</Label>
          <Select
            value={field.width}
            onChange={(e) => set({ width: e.target.value as FieldDef['width'] })}
          >
            <option value="full">{t('ticketTypes.width.full')}</option>
            <option value="half">{t('ticketTypes.width.half')}</option>
          </Select>
        </div>

        {field.type === 'select' && (
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block">{t('ticketTypes.fields.catalog')}</Label>
            <Select
              value={field.catalog ?? ''}
              onChange={(e) =>
                set({ catalog: (e.target.value || undefined) as CatalogKey | undefined })
              }
            >
              <option value="">{t('ticketTypes.ownOptions')}</option>
              {CATALOG_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`ticketTypes.catalog.${key}`)}
                </option>
              ))}
            </Select>
            {!field.catalog && (
              <Input
                className="mt-2"
                placeholder={t('ticketTypes.optionsPlaceholder')}
                value={(field.options ?? []).map((o) => o.label).join(', ')}
                onChange={(e) =>
                  set({
                    options: e.target.value
                      .split(',')
                      .map((label) => label.trim())
                      .filter(Boolean)
                      .map((label) => ({ value: label.toLowerCase().replace(/\s+/g, '_'), label })),
                  })
                }
              />
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">{t('ticketTypes.fields.help')}</Label>
          <Input value={field.help ?? ''} onChange={(e) => set({ help: e.target.value })} />
        </div>

        <div>
          <Label className="mb-1.5 block">{t('ticketTypes.fields.role')}</Label>
          <Select
            value={field.role ?? ''}
            onChange={(e) => set({ role: (e.target.value || undefined) as FieldRole | undefined })}
          >
            <option value="">{t('ticketTypes.fields.roleNone')}</option>
            {FIELD_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`ticketTypes.fields.roles.${r}`)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{t('ticketTypes.fields.roleHint')}</p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={field.required}
            onChange={(e) => set({ required: e.target.checked })}
          />
          {t('ticketTypes.fields.required')}
        </label>

        <div className="sm:col-span-2 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">{t('ticketTypes.fields.viewPermission')}</Label>
            <Select
              value={field.view_permission ?? ''}
              onChange={(e) => set({ view_permission: e.target.value || undefined })}
            >
              <option value="">{t('ticketTypes.everyone')}</option>
              {permissions.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} · {p.code}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">{t('ticketTypes.fields.editPermission')}</Label>
            <Select
              value={field.edit_permission ?? ''}
              onChange={(e) => set({ edit_permission: e.target.value || undefined })}
            >
              <option value="">{t('ticketTypes.everyone')}</option>
              {permissions.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} · {p.code}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {t('ticketTypes.permissionHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
