'use client';

import { ArrowLeft, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { api, formatRelative } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import { plainExcerpt, type ClientNote, type ClientNoteSummary } from '@/lib/types';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmptyState } from '../EmptyState';
import { Markdown } from '../notes/Markdown';

// El editor es pesado: solo se descarga al editar
const NoteEditor = dynamic(() => import('../notes/NoteEditor').then((m) => m.NoteEditor), {
  ssr: false,
  loading: () => <div className="note-editor-loading" role="status">Cargando editor…</div>,
});

type View =
  | { kind: 'list' }
  | { kind: 'view'; note: ClientNote }
  | { kind: 'edit'; note: ClientNote | null; title: string; body: string };

/** Cuaderno del cliente: todos los usuarios ven, editan y borran todas las notas. */
export function ClientNotes({ clientId }: { clientId: string }) {
  const toast = useToast();
  const [notes, setNotes] = useState<ClientNoteSummary[] | null>(null);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [confirm, setConfirm] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<ClientNoteSummary[]>(`/clients/${clientId}/notes`)
      .then(setNotes)
      .catch((err) => { toast((err as Error).message); setNotes([]); });
  }, [clientId, toast]);
  useEffect(load, [load]);

  async function open(id: string) {
    try {
      setView({ kind: 'view', note: await api<ClientNote>(`/clients/${clientId}/notes/${id}`) });
    } catch (err) {
      toast((err as Error).message);
      load();
    }
  }

  async function save() {
    if (view.kind !== 'edit') return;
    setBusy(true);
    try {
      const body = { title: view.title.trim(), body: view.body };
      const saved = view.note
        ? await api<ClientNote>(`/clients/${clientId}/notes/${view.note.id}`, { method: 'PATCH', body })
        : await api<ClientNote>(`/clients/${clientId}/notes`, { method: 'POST', body });
      toast(view.note ? 'Nota guardada' : 'Nota creada', 'success');
      setView({ kind: 'view', note: saved });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
    setConfirm(null);
    setBusy(false);
  }

  async function remove() {
    if (view.kind !== 'view') return;
    setBusy(true);
    try {
      await api(`/clients/${clientId}/notes/${view.note.id}`, { method: 'DELETE' });
      toast('Nota eliminada', 'success');
      setView({ kind: 'list' });
      load();
    } catch (err) {
      toast((err as Error).message);
    }
    setConfirm(null);
    setBusy(false);
  }

  const startNew = () => { setError(''); setView({ kind: 'edit', note: null, title: '', body: '' }); };

  if (view.kind === 'edit') {
    const { note } = view;
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <form
          onSubmit={(e) => { e.preventDefault(); setConfirm('save'); }}
          className="space-y-4 p-6 sm:p-8"
        >
          <h2 className="text-base font-semibold tracking-tight">{note ? 'Editar nota' : 'Nueva nota'}</h2>
          <div>
            <label className="label" htmlFor="cn-title">Título</label>
            <input id="cn-title" required autoFocus maxLength={300} className="w-full" value={view.title} onChange={(e) => setView({ ...view, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="cn-body">Contenido</label>
            <NoteEditor id="cn-body" markdown={view.body} onChange={(body) => setView((v) => (v.kind === 'edit' ? { ...v, body } : v))} />
          </div>
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setView(note ? { kind: 'view', note } : { kind: 'list' })} className="btn">Cancelar</button>
            <button className="btn-accent" disabled={!view.title.trim()}>Guardar</button>
          </div>
        </form>
        {confirm === 'save' && (
          <ConfirmDialog
            title={note ? '¿Guardar los cambios de la nota?' : '¿Crear esta nota?'}
            confirmLabel={note ? 'Guardar' : 'Crear nota'}
            busyLabel="Guardando…"
            busy={busy}
            onConfirm={save}
            onCancel={() => setConfirm(null)}
          >
            «{view.title.trim()}» quedará en el cuaderno de este cliente, visible y editable para todo el equipo.
          </ConfirmDialog>
        )}
      </div>
    );
  }

  if (view.kind === 'view') {
    const { note } = view;
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => { setView({ kind: 'list' }); load(); }} className="btn-ghost -ml-3"><ArrowLeft {...icon} /> Volver a las notas</button>
          <div className="flex items-center gap-1">
            <button onClick={() => { setError(''); setView({ kind: 'edit', note, title: note.title, body: note.body }); }} className="btn"><Pencil {...icon} /> Editar</button>
            <button onClick={() => setConfirm('delete')} className="btn-danger"><Trash2 {...icon} /> Eliminar</button>
          </div>
        </div>
        <article className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">{note.title}</h2>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            {note.author && <span>Autor: {note.author.name}</span>}
            <span>Editada {formatRelative(note.updatedAt)}{note.updatedBy ? ` por ${note.updatedBy.name}` : ''}</span>
          </p>
          <div className="mt-6">
            {note.body.trim() ? <Markdown>{note.body}</Markdown> : <p className="text-sm text-zinc-500">Esta nota está vacía. Usa «Editar» para escribir.</p>}
          </div>
        </article>
        {confirm === 'delete' && (
          <ConfirmDialog
            title="¿Eliminar esta nota?"
            tone="danger"
            confirmLabel="Eliminar"
            busyLabel="Eliminando…"
            busy={busy}
            onConfirm={remove}
            onCancel={() => setConfirm(null)}
          >
            «{note.title}» se eliminará para siempre.
          </ConfirmDialog>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="section-label">Cuaderno de notas</h2>
        <button onClick={startNew} className="btn-accent"><Plus {...icon} /> Nueva nota</button>
      </div>
      {notes === null ? (
        <div aria-hidden className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Aún no hay notas"
          action={<button onClick={startNew} className="btn-accent"><Plus {...icon} /> Nueva nota</button>}
        >
          Anota reuniones, llamadas y avances de este cliente. Todo el equipo las ve y las edita.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n.id)} className="card-surface card-surface-interactive block w-full p-4 text-left">
                <h3 className="truncate text-sm font-semibold">{n.title}</h3>
                {n.excerpt.trim() && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{plainExcerpt(n.excerpt)}</p>}
                <p className="mt-2 text-xs text-zinc-500">
                  {n.author?.name ?? 'Autor eliminado'} · Editada {formatRelative(n.updatedAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
