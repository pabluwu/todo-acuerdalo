'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { TableSkeleton } from '@/components/Skeletons';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { TaskType } from '@/lib/types';

function Types() {
  const toast = useToast();
  const [types, setTypes] = useState<TaskType[] | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(() => {
    api<TaskType[]>('/task-types?all=true').then(setTypes).catch((e) => toast(e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api('/task-types', { method: 'POST', body: { name } });
      setName('');
      load();
    } catch (err) { toast((err as Error).message); }
  }

  async function patch(id: string, body: Partial<TaskType>) {
    try {
      await api(`/task-types/${id}`, { method: 'PATCH', body });
      setEditing(null);
      load();
    } catch (err) { toast((err as Error).message); }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Tipos de tarea</h1>
      <form onSubmit={create} className="flex gap-2">
        <input aria-label="Nombre del nuevo tipo" className="min-w-0 flex-1" placeholder="Nombre del nuevo tipo" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-accent"><Plus {...icon} /> Crear</button>
      </form>
      {!types ? <TableSkeleton rows={3} /> : types.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no hay tipos. Crea el primero para poder crear tareas.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white px-5">
          {types.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              {editing === t.id ? (
                <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); patch(t.id, { name: editName }); }}>
                  <input aria-label="Nombre del tipo" autoFocus className="min-w-0 flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
                  <button className="btn-accent btn-sm !h-9">Guardar</button>
                  <button type="button" className="btn btn-sm !h-9" onClick={() => setEditing(null)}>Cancelar</button>
                </form>
              ) : (
                <>
                  <span className={`text-sm ${t.isActive ? '' : 'text-zinc-500 line-through'}`}>
                    {t.name}{!t.isActive && <span className="sr-only"> (inactivo)</span>}
                  </span>
                  <div className="flex gap-2">
                    <button className="btn btn-sm" onClick={() => { setEditing(t.id); setEditName(t.name); }}>Editar</button>
                    <button className="btn btn-sm" onClick={() => patch(t.id, { isActive: !t.isActive })}>{t.isActive ? 'Desactivar' : 'Activar'}</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page() {
  return <AdminGuard><Types /></AdminGuard>;
}
