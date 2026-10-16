'use client';

import { Plus, X } from 'lucide-react';
import { icon } from '@/lib/icons';
import { PRIORITIES, type TaskType, type UserLite } from '@/lib/types';

export interface Filters {
  assigneeId: string;
  priority: string;
  typeId: string;
}

export function FilterBar({
  filters,
  users,
  types,
  onChange,
  onClear,
  onNew,
}: {
  filters: Filters;
  users: UserLite[];
  types: TaskType[];
  onChange: (key: keyof Filters, value: string) => void;
  onClear: () => void;
  onNew: () => void;
}) {
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select aria-label="Asignado" className="col-span-2 sm:col-span-1" value={filters.assigneeId} onChange={(e) => onChange('assigneeId', e.target.value)}>
          <option value="">Todas las personas</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select aria-label="Prioridad" value={filters.priority} onChange={(e) => onChange('priority', e.target.value)}>
          <option value="">Todas las prioridades</option>
          {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select aria-label="Tipo" value={filters.typeId} onChange={(e) => onChange('typeId', e.target.value)}>
          <option value="">Todos los tipos</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {active && (
          <button className="btn-ghost col-span-2 sm:col-span-1" onClick={onClear}>
            <X {...icon} /> Limpiar
          </button>
        )}
      </div>
      <button className="btn-accent max-sm:w-full" onClick={onNew}><Plus {...icon} /> Nueva tarea</button>
    </div>
  );
}
