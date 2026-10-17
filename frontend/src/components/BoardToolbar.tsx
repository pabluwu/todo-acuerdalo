'use client';

import { AlarmClock, ArrowUpDown, CircleDot, Flag, Kanban, List, Plus, Tag, User, UserCheck, X, TriangleAlert } from 'lucide-react';
import { icon } from '@/lib/icons';
import { PRIORITIES, STATUSES, type TaskType, type UserLite } from '@/lib/types';
import { Avatar } from './Avatar';
import { FilterPill } from './FilterPill';
import { SORTS, type ListSort } from './TaskListView';

export interface Filters {
  assigneeId: string;
  priority: string;
  typeId: string;
  due: '' | 'overdue' | 'soon';
  status: string;
  sort: ListSort;
}
export type BoardView = 'board' | 'list';

/** Claves que cuentan como "filtro activo" (el orden no filtra). */
export const FILTER_KEYS = ['assigneeId', 'priority', 'typeId', 'due', 'status'] as const;

export function BoardToolbar({
  filters,
  users,
  types,
  meId,
  view,
  mobile,
  summary,
  onView,
  onChange,
  onClear,
  onNew,
}: {
  filters: Filters;
  users: UserLite[];
  types: TaskType[];
  meId: string | undefined;
  view: BoardView;
  mobile: boolean;
  summary: { open: number; overdue: number } | null;
  onView: (v: BoardView) => void;
  onChange: (key: keyof Filters, value: string) => void;
  onClear: () => void;
  onNew: () => void;
}) {
  const active = FILTER_KEYS.some((k) => filters[k] && (k !== 'status' || view === 'list'));
  const mine = !!meId && filters.assigneeId === meId;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">Tareas</h1>
          <p className="mt-0.5 h-5 text-sm tabular-nums text-zinc-500">
            {summary && (
              <>
                {summary.open} {summary.open === 1 ? 'abierta' : 'abiertas'}
                {summary.overdue > 0 && <span className="text-red-700"> · {summary.overdue} {summary.overdue === 1 ? 'vencida' : 'vencidas'}</span>}
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!mobile && (
            <div role="group" aria-label="Vista" className="seg">
              <button type="button" aria-pressed={view === 'board'} onClick={() => onView('board')}><Kanban {...icon} /> Tablero</button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => onView('list')}><List {...icon} /> Lista</button>
            </div>
          )}
          {!mobile && <button className="btn-accent" onClick={onNew}><Plus {...icon} /> Nueva tarea</button>}
        </div>
      </div>

      {/* en móvil el carril hace scroll horizontal; en escritorio envuelve */}
      <div role="toolbar" aria-label="Filtros" className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        {meId && (
          <button type="button" className="pill" aria-pressed={mine} onClick={() => onChange('assigneeId', mine ? '' : meId)}>
            <UserCheck {...icon} /> Mis tareas
          </button>
        )}
        <button type="button" className="pill" aria-pressed={filters.due === 'overdue'} onClick={() => onChange('due', filters.due === 'overdue' ? '' : 'overdue')}>
          <TriangleAlert {...icon} /> Vencidas
        </button>
        <button type="button" className="pill" aria-pressed={filters.due === 'soon'} onClick={() => onChange('due', filters.due === 'soon' ? '' : 'soon')}>
          <AlarmClock {...icon} /> Vencen pronto
        </button>

        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-zinc-200" />

        <FilterPill
          icon={User}
          label="Persona"
          sheet={mobile}
          value={mine ? '' : filters.assigneeId}
          onChange={(v) => onChange('assigneeId', v)}
          options={users.map((u) => ({ id: u.id, label: u.id === meId ? `${u.name} (tú)` : u.name, lead: <Avatar name={u.name} decorative /> }))}
        />
        <FilterPill
          icon={Flag}
          label="Prioridad"
          sheet={mobile}
          value={filters.priority}
          onChange={(v) => onChange('priority', v)}
          options={PRIORITIES.map((p) => ({ id: p.id, label: p.label, lead: <p.icon size={16} strokeWidth={2} aria-hidden className={p.fg} /> }))}
        />
        <FilterPill
          icon={Tag}
          label="Tipo"
          sheet={mobile}
          value={filters.typeId}
          onChange={(v) => onChange('typeId', v)}
          options={types.map((t) => ({ id: t.id, label: t.name }))}
        />
        {view === 'list' && (
          <FilterPill
            icon={CircleDot}
            label="Estado"
            sheet={mobile}
            value={filters.status}
            onChange={(v) => onChange('status', v)}
            options={STATUSES.map((s) => ({ id: s.id, label: s.label, lead: <s.icon size={16} strokeWidth={2} aria-hidden className={s.fg} /> }))}
          />
        )}

        {active && (
          <button type="button" className="btn-ghost btn-sm shrink-0" onClick={onClear}>
            <X {...icon} /> Limpiar
          </button>
        )}

        {view === 'list' && (
          <div className="shrink-0 md:ml-auto">
            <FilterPill
              icon={ArrowUpDown}
              label="Ordenar"
              sheet={mobile}
              clearable={false}
              align="right"
              value={filters.sort}
              onChange={(v) => onChange('sort', v)}
              options={SORTS.map((s) => ({ id: s.id, label: s.label }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
