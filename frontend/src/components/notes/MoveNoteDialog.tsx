'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import type { Note, NoteFolderOption } from '@/lib/types';
import { Dialog } from '../Dialog';
import { Field } from '../Field';

/** Cambia la carpeta de una nota dentro de su misma pestaña. */
export function MoveNoteDialog({ note, onClose, onMoved }: { note: Note; onClose: () => void; onMoved: (n: Note) => void }) {
  const headingId = useId();
  const [folders, setFolders] = useState<NoteFolderOption[] | null>(null);
  const [target, setTarget] = useState(note.folderId ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<NoteFolderOption[]>(`/notes/folders?scope=${note.visibility}`)
      .then(setFolders)
      .catch((err) => { setError((err as Error).message); setFolders([]); });
  }, [note.visibility]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onMoved(await api<Note>(`/notes/${note.id}`, { method: 'PATCH', body: { folderId: target || null } }));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const rootName = note.visibility === 'common' ? 'Inicio de Comunes' : 'Inicio de mis notas privadas';

  return (
    <Dialog labelledBy={headingId} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 id={headingId} className="text-base font-semibold tracking-tight">Mover a carpeta</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
        </div>
        <Field label="Carpeta">
          {(p) => (
            <select {...p} className="w-full" value={target} onChange={(e) => setTarget(e.target.value)} disabled={folders === null}>
              <option value="">{rootName}</option>
              {(folders ?? []).map((f) => <option key={f.id} value={f.id}>{f.path}</option>)}
            </select>
          )}
        </Field>
        {folders?.length === 0 && !error && (
          <p className="text-xs text-zinc-500">Aún no hay carpetas en esta pestaña. Créalas desde la lista de notas.</p>
        )}
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">Cancelar</button>
          <button className="btn-accent" disabled={busy || folders === null || target === (note.folderId ?? '')}>{busy ? 'Moviendo…' : 'Mover'}</button>
        </div>
      </form>
    </Dialog>
  );
}
