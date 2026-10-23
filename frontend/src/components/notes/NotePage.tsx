'use client';

import { ArrowLeft, Check, FileQuestion, Link2, Lock, Pencil, Share2, Trash2, Users, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import { api, ApiError, formatRelative } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Note, NoteAccessRequest, NoteNoAccess, NotePermission, UserLite } from '@/lib/types';
import { Dialog } from '../Dialog';
import { EmptyState } from '../EmptyState';
import { PanelSkeleton } from '../Skeletons';
import { Markdown } from './Markdown';
import { ShareDialog } from './ShareDialog';

// El editor es pesado: solo se descarga al editar
const NoteEditor = dynamic(() => import('./NoteEditor').then((m) => m.NoteEditor), {
  ssr: false,
  loading: () => <div className="note-editor-loading" role="status">Cargando editor…</div>,
});

const ACCESS_LABEL = { owner: 'Dueño', edit: 'Puede editar', view: 'Solo lectura' } as const;

/** Nota a pantalla completa en `/notes/[id]`: el enlace que se comparte. */
export function NotePage({ noteId }: { noteId: string }) {
  const router = useRouter();
  const toast = useToast();
  const startEditing = useSearchParams().get('edit') === '1';
  const [note, setNote] = useState<Note | null>(null);
  const [noAccess, setNoAccess] = useState<NoteNoAccess | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [requests, setRequests] = useState<NoteAccessRequest[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', visibility: 'common' as Note['visibility'] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadRequests = useCallback(() => {
    api<NoteAccessRequest[]>(`/notes/${noteId}/access-requests`).then(setRequests).catch(() => undefined);
  }, [noteId]);

  useEffect(() => {
    let alive = true;
    api<Note>(`/notes/${noteId}`)
      .then((n) => {
        if (!alive) return;
        setNote(n);
        if (startEditing && (n.myAccess === 'owner' || n.myAccess === 'edit')) {
          setDraft({ title: n.title, body: n.body, visibility: n.visibility });
          setEditing(true);
        }
        if (n.myAccess === 'owner' && n.visibility === 'private') loadRequests();
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 403 && err.data?.code === 'NO_ACCESS') setNoAccess(err.data as unknown as NoteNoAccess);
        else if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else toast((err as Error).message);
      });
    return () => { alive = false; };
    // solo al abrir: `?edit=1` no debe reabrir el editor al guardar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    if (note?.myAccess === 'owner' && note.visibility === 'private') api<UserLite[]>('/users').then(setUsers).catch(() => undefined);
  }, [note?.myAccess, note?.visibility]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/notes/${noteId}`);
      toast('Enlace copiado', 'success');
    } catch {
      toast('No se pudo copiar el enlace');
    }
  }

  function startEdit() {
    if (!note) return;
    setDraft({ title: note.title, body: note.body, visibility: note.visibility });
    setError('');
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!note) return;
    setSaving(true);
    setError('');
    try {
      const body: Record<string, string> = { title: draft.title, body: draft.body };
      if (note.myAccess === 'owner' && draft.visibility !== note.visibility) body.visibility = draft.visibility;
      setNote(await api<Note>(`/notes/${noteId}`, { method: 'PATCH', body }));
      setEditing(false);
      toast('Nota guardada', 'success');
    } catch (err) {
      setError((err as Error).message);
    }
    setSaving(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/notes/${noteId}`, { method: 'DELETE' });
      toast('Nota eliminada', 'success');
      router.push(`/notes?scope=${note?.visibility ?? 'common'}`);
    } catch (err) {
      toast((err as Error).message);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  async function requestAccess() {
    setBusy(true);
    try {
      await api(`/notes/${noteId}/access-requests`, { method: 'POST' });
      setNoAccess((n) => (n ? { ...n, requestStatus: 'pending' } : n));
      toast('Solicitud enviada', 'success');
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  }

  async function resolve(r: NoteAccessRequest, approve: boolean, permission?: NotePermission) {
    try {
      await api(`/notes/access-requests/${r.id}`, { method: 'PATCH', body: { approve, permission } });
      setRequests((list) => list.filter((x) => x.id !== r.id));
      if (approve) {
        const fresh = await api<Note>(`/notes/${noteId}`);
        setNote(fresh);
      }
      toast(approve ? `Acceso concedido a ${r.user.name}` : 'Solicitud rechazada', 'success');
    } catch (err) {
      toast((err as Error).message);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState icon={FileQuestion} title="No encontramos esta nota" tone="neutral" action={<Link href="/notes" className="btn-accent">Ir a las notas</Link>}>
          Puede que se haya eliminado o que el enlace no sea correcto.
        </EmptyState>
      </div>
    );
  }

  if (noAccess) {
    const status = noAccess.requestStatus;
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Lock}
          title={noAccess.title}
          tone="neutral"
          action={
            status === 'pending' ? (
              <p role="status" className="text-sm text-zinc-600">Solicitud enviada. Te avisaremos por correo cuando la resuelvan.</p>
            ) : (
              <div className="flex flex-col items-center gap-3">
                {status === 'rejected' && <p className="text-sm text-red-700">Tu solicitud anterior fue rechazada.</p>}
                <button onClick={requestAccess} className="btn-accent" disabled={busy || !noAccess.owner}>
                  {status === 'rejected' ? 'Volver a solicitar acceso' : 'Solicitar acceso'}
                </button>
              </div>
            )
          }
        >
          Esta nota es privada{noAccess.owner ? ` de ${noAccess.owner.name}` : ''}. Pídele acceso para poder leerla.
        </EmptyState>
        <p className="mt-4 text-center"><Link href="/notes" className="text-sm text-accent hover:underline">Volver a las notas</Link></p>
      </div>
    );
  }

  if (!note) return <div className="mx-auto max-w-3xl"><PanelSkeleton /></div>;

  const canEdit = note.myAccess === 'owner' || note.myAccess === 'edit';
  const isOwner = note.myAccess === 'owner';
  const VisIcon = note.visibility === 'private' ? Lock : Users;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/notes?scope=${note.visibility}`} className="btn-ghost -ml-3"><ArrowLeft {...icon} /> Volver a las notas</Link>
        <div className="flex flex-wrap items-center gap-1">
          <button onClick={copyLink} className="btn-ghost"><Link2 {...icon} /> Copiar enlace</button>
          {isOwner && note.visibility === 'private' && !editing && (
            <button onClick={() => setSharing(true)} className="btn-ghost"><Share2 {...icon} /> Compartir</button>
          )}
          {canEdit && !editing && <button onClick={startEdit} className="btn"><Pencil {...icon} /> Editar</button>}
          {note.canDelete && !editing && (
            <button onClick={() => setConfirmDelete(true)} className="btn-danger"><Trash2 {...icon} /> Eliminar</button>
          )}
        </div>
      </div>

      {isOwner && note.visibility === 'private' && requests.length > 0 && !editing && (
        <section aria-label="Solicitudes de acceso" className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <h2 className="section-label mb-2">Solicitudes pendientes</h2>
          <ul className="divide-y divide-amber-100">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.user.name}</p>
                  <p className="truncate text-xs text-zinc-600">{r.user.email} · {formatRelative(r.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => resolve(r, true, 'view')} className="btn btn-sm"><Check {...icon} /> Puede ver</button>
                  <button onClick={() => resolve(r, true, 'edit')} className="btn btn-sm"><Check {...icon} /> Puede editar</button>
                  <button onClick={() => resolve(r, false)} className="btn-danger btn-sm"><X {...icon} /> Rechazar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {editing ? (
          <form onSubmit={save} className="space-y-4 p-6 sm:p-8">
            <div>
              <label className="label" htmlFor="note-title">Título</label>
              <input id="note-title" required maxLength={300} className="w-full" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            {isOwner && (
              <div>
                <label className="label" htmlFor="note-visibility">Visibilidad</label>
                <select id="note-visibility" className="w-full sm:w-64" value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as Note['visibility'] })}>
                  <option value="common">Común (todo el equipo)</option>
                  <option value="private">Privada (solo tú y a quien compartas)</option>
                </select>
                {draft.visibility === 'common' && note.visibility === 'private' && (
                  <p className="mt-1 text-xs text-amber-700">Al hacerla común se quitan los accesos individuales y las solicitudes pendientes.</p>
                )}
              </div>
            )}
            <div>
              <label className="label" htmlFor="note-body">Contenido</label>
              <NoteEditor id="note-body" markdown={draft.body} onChange={(body) => setDraft((d) => ({ ...d, body }))} />
            </div>
            {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="btn">Cancelar</button>
              <button className="btn-accent" disabled={saving || !draft.title.trim()}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        ) : (
          <article className="p-6 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{note.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1"><VisIcon size={12} strokeWidth={1.5} aria-hidden /> {note.visibility === 'private' ? 'Privada' : 'Común'}</span>
              {note.owner && <span>Autor: {note.owner.name}</span>}
              <span>Editada {formatRelative(note.updatedAt)}{note.updatedBy ? ` por ${note.updatedBy.name}` : ''}</span>
              {note.visibility === 'private' && <span>{ACCESS_LABEL[note.myAccess]}</span>}
              {isOwner && note.visibility === 'private' && note.shares.length > 0 && (
                <span>Compartida con {note.shares.map((s) => `${s.name} (${s.permission === 'edit' ? 'edita' : 've'})`).join(', ')}</span>
              )}
            </p>
            <div className="mt-6">
              {note.body.trim() ? (
                <Markdown>{note.body}</Markdown>
              ) : (
                <p className="text-sm text-zinc-500">Esta nota está vacía.{canEdit ? ' Usa «Editar» para escribir.' : ''}</p>
              )}
            </div>
          </article>
        )}
      </div>

      {sharing && (
        <ShareDialog
          note={note}
          users={users}
          onClose={() => setSharing(false)}
          onSaved={(n) => { setNote(n); setSharing(false); }}
        />
      )}
      {confirmDelete && (
        <ConfirmDeleteDialog title={note.title} busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({ title, busy, onCancel, onConfirm }: { title: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const headingId = useId();
  return (
    <Dialog labelledBy={headingId} onClose={onCancel}>
      <div className="space-y-4">
        <h2 id={headingId} className="text-base font-semibold tracking-tight">¿Eliminar esta nota?</h2>
        <p className="text-sm text-zinc-600">«{title}» se eliminará para siempre, junto con los accesos compartidos.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn" autoFocus>Cancelar</button>
          <button type="button" onClick={onConfirm} className="btn-danger" disabled={busy}>{busy ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </div>
    </Dialog>
  );
}
