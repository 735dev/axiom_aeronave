import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, KeyRound, Target } from 'lucide-react';
import { Module, Permission } from '../types/role.types';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

interface Scope {
  label: string;
  code: string;
}

interface ActionNode {
  code: string;
  name: string;
  scopes: Scope[];
}

interface ModuleNode {
  code: string;
  name: string;
  actions: ActionNode[];
  total: number;
}

/**
 * Árbol módulo → acción → alcance. Un permiso con tres partes
 * (`tickets.view.expense`) cuelga de su acción base (`tickets.view`).
 */
function buildTree(modules: Module[], byModule: Record<string, Permission[]>): ModuleNode[] {
  return modules.map((module) => {
    const items = byModule[module.code] ?? [];
    const actions = new Map<string, ActionNode>();

    items
      .filter((p) => p.code.split('.').length === 2)
      .forEach((p) => actions.set(p.code, { code: p.code, name: p.name, scopes: [] }));

    items
      .filter((p) => p.code.split('.').length > 2)
      .forEach((p) => {
        const parts = p.code.split('.');
        const baseCode = `${parts[0]}.${parts[1]}`;
        const label = p.name.split('·').pop()?.trim() ?? parts.slice(2).join('.');
        const base = actions.get(baseCode);
        if (base) {
          base.scopes.push({ label, code: p.code });
          return;
        }
        actions.set(p.code, { code: p.code, name: p.name, scopes: [] });
      });

    return {
      code: module.code,
      name: module.name,
      actions: Array.from(actions.values()),
      total: items.length,
    };
  });
}

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

interface Props {
  modules: Module[];
  byModule: Record<string, Permission[]>;
  query: string;
}

export function PermissionsTree({ modules, byModule, query }: Props) {
  const t = useT();
  const tree = useMemo(() => buildTree(modules, byModule), [modules, byModule]);
  const [collapsedModules, setCollapsedModules] = useState<string[]>([]);
  const [openActions, setOpenActions] = useState<string[]>([]);

  const searching = query.trim().length > 0;

  const toggleModule = (code: string) =>
    setCollapsedModules((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const toggleAction = (code: string) =>
    setOpenActions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  return (
    <ul className="divide-y divide-border">
      {tree.map((module) => {
        const actions = module.actions
          .map((action) => ({
            ...action,
            scopes: searching
              ? action.scopes.filter((s) => matches(s.label, query) || matches(s.code, query))
              : action.scopes,
          }))
          .filter((action) => {
            if (!searching) return true;
            return (
              matches(action.name, query) ||
              matches(action.code, query) ||
              action.scopes.length > 0
            );
          });

        if (searching && actions.length === 0 && !matches(module.name, query)) return null;
        const isOpen = searching || !collapsedModules.includes(module.code);

        return (
          <li key={module.code}>
            <button
              type="button"
              onClick={() => toggleModule(module.code)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-semibold">{module.name}</span>
              <span className="data text-xs text-muted-foreground">{module.total}</span>
            </button>

            {isOpen && (
              <ul className="ml-6 border-l border-border">
                {actions.map((action) => {
                  const hasScopes = action.scopes.length > 0;
                  const scopesOpen = searching || openActions.includes(action.code);

                  return (
                    <li key={action.code}>
                      <div
                        className={cn(
                          'flex items-center gap-2 py-2 pl-3 pr-4',
                          hasScopes && 'cursor-pointer hover:bg-muted',
                        )}
                        onClick={() => hasScopes && toggleAction(action.code)}
                      >
                        {hasScopes ? (
                          scopesOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )
                        ) : (
                          <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 text-sm">
                          {action.name}
                          <code className="mt-0.5 block text-xs text-muted-foreground/70 lg:hidden">
                            {action.code}
                          </code>
                        </span>
                        {hasScopes && (
                          <span className="text-xs text-muted-foreground">
                            {action.scopes.length} {t('permissions.scopesShort')}
                          </span>
                        )}
                        <code className="hidden shrink-0 text-xs text-muted-foreground/70 lg:block">
                          {action.code}
                        </code>
                      </div>

                      {hasScopes && scopesOpen && (
                        <ul className="ml-5 border-l border-border">
                          {action.scopes.map((scope) => (
                            <li
                              key={scope.code}
                              className="flex items-center gap-2 py-1.5 pl-3 pr-4"
                            >
                              <Target className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="flex-1 text-sm text-muted-foreground">
                                {scope.label}
                              </span>
                              <code className="shrink-0 text-xs text-muted-foreground opacity-70">
                                {scope.code}
                              </code>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
