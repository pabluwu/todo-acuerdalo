'use client';

import { X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Note, NotePermission, UserLite } from '@/lib/types';
import { Avatar } from '../Avatar';
import { Dialog } from '../Dialog';

type Level = NotePermission | 'none';

/** El dueño elige, por persona, si puede ver, editar o no tiene acceso. */
export function ShareDialog({
  note,
  users,
  onClose,
  onSaved,
}: {
  note: Note;
  users: UserLite[];
  onClose: () => void;
  onSaved: (n: Note) => void;
}) {
  const headingId = useId();
  const toast = useToast();
  const [levels, setLevels] = useState<Record<string, Level>>(() =>
    Object.fromEntries(note.shares.map((s) => [s.userId, s.permission])),
  );
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return users
      .filter((u) => u.id !== note.owner?.id)
      .filter((u) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [users, filter, note.owner?.id]);

  async function save() {
    setBusy(true);
    setError('');
    const shares = Object.entries(levels)
      .filter(([, l]) => l !== 'none')
      .map(([userId, permission]) => ({ userId, permission }));
    try {
      onSaved(await api<Note>(`/notes/${note.id}/shares`, { method: 'PUT', body: { shares } }));
      toast('Accesos actualizados', 'success');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog labelledBy={headingId} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id={headingId} className="text-base font-semibold tracking-tight">Compartir «{note.title}»</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
        </div>
        <input
          type="search"
          aria-label="Buscar persona"
          placeholder="Buscar persona…"
          className="w-full"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200">
          {candidates.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-3 py-2">
              <Avatar name={u.name} decorative />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{u.name}</p>
                <p className="truncate text-xs text-zinc-500">{u.email}</p>
              </div>
              <select
                aria-label={`Acceso de ${u.name}`}
                className="w-36 shrink-0"
                value={levels[u.id] ?? 'none'}
                onChange={(e) => setLevels({ ...levels, [u.id]: e.target.value as Level })}
              >
                <option value="none">Sin acceso</option>
                <option value="view">Puede ver</option>
                <option value="edit">Puede editar</option>
              </select>
            </li>
          ))}
          {candidates.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-500">No hay personas que coincidan.</li>}
        </ul>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">Cancelar</button>
          <button type="button" onClick={save} className="btn-accent" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Dialog>
  );
}
