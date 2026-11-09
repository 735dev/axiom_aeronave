import { Module, Permission } from '../types/role.types';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

interface Props {
  byModule: Record<string, Permission[]>;
  modules: Module[];
  selected: string[];
  disabled?: boolean;
  onToggle: (code: string) => void;
  onToggleModule: (codes: string[], allSelected: boolean) => void;
}

export function PermissionMatrix({
  byModule,
  modules,
  selected,
  disabled,
  onToggle,
  onToggleModule,
}: Props) {
  const t = useT();
  const moduleCodes = Object.keys(byModule);

  /** El nombre viene de la base: los módulos son datos, no claves de traducción. */
  const moduleName = (code: string) => modules.find((m) => m.code === code)?.name ?? t(`modules.${code}`);

  return (
    <div className="space-y-3">
      {moduleCodes.map((moduleCode) => {
        const perms = byModule[moduleCode] ?? [];
        const codes = perms.map((p) => p.code);
        const allSelected = codes.every((c) => selected.includes(c));
        const someSelected = !allSelected && codes.some((c) => selected.includes(c));

        return (
          <div key={moduleCode} className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium">{moduleName(moduleCode)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleModule(codes, allSelected)}
                className={cn(
                  'text-xs text-muted-foreground hover:text-primary disabled:opacity-40',
                  someSelected && 'text-primary',
                )}
              >
                {allSelected ? t('roles.unselectAll') : t('roles.selectAll')}
              </button>
            </div>
            <div className="grid gap-1 p-3 sm:grid-cols-2">
              {perms.map((p) => (
                <label
                  key={p.code}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted',
                    disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    checked={selected.includes(p.code)}
                    disabled={disabled}
                    onChange={() => onToggle(p.code)}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <code className="shrink-0 text-[10px] text-muted-foreground">{p.code}</code>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
