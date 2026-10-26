'use client';

import { Folder, Lock, Users, X } from 'lucide-react';
import { useId, useState } from 'react';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import type { Note, NoteFolder, NoteVisibility } from '@/lib/types';
import { Dialog } from '../Dialog';
import { Field } from '../Field';

export function NewNoteDialog({
  initialVisibility,
  folder = null,
  onClose,
  onCreated,
}: {
  initialVisibility: NoteVisibility;
  /** Carpeta abierta en la lista: la nota se crea ahí si se mantiene la misma visibilidad */
  folder?: NoteFolder | null;
  onClose: () => void;
  onCreated: (n: Note) => void;
}) {
  const headingId = useId();
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<NoteVisibility>(initialVisibility);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // las carpetas son de cada pestaña: al cambiar de visibilidad la nota va al inicio de la otra
  const inFolder = folder !== null && folder.visibility === visibility;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onCreated(await api<Note>('/notes', { method: 'POST', body: { title, body: '', visibility, folderId: inFolder ? folder.id : undefined } }));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog labelledBy={headingId} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 id={headingId} className="text-base font-semibold tracking-tight">Nueva nota</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
        </div>
        <Field label="Título">
          {(p) => <input {...p} autoFocus required maxLength={300} className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <div>
          <span className="label">Visibilidad</span>
          <div className="seg w-full" role="group" aria-label="Visibilidad">
            <button type="button" aria-pressed={visibility === 'common'} onClick={() => setVisibility('common')}><Users {...icon} /> Común</button>
            <button type="button" aria-pressed={visibility === 'private'} onClick={() => setVisibility('private')}><Lock {...icon} /> Privada</button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {visibility === 'common' ? 'Todo el equipo puede leerla y editarla.' : 'Solo tú la ves; luego puedes compartirla con personas concretas.'}
          </p>
          {folder && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-zinc-500">
              <Folder size={12} strokeWidth={1.5} aria-hidden />
              {inFolder ? <>Se creará en «{folder.name}».</> : <>Se creará al inicio de {visibility === 'common' ? 'Comunes' : 'Privadas'}.</>}
            </p>
          )}
        </div>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">Cancelar</button>
          <button className="btn-accent" disabled={busy || !title.trim()}>{busy ? 'Creando…' : 'Crear y escribir'}</button>
        </div>
      </form>
    </Dialog>
  );
}
