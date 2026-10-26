'use client';

import {
  ChevronRight, Folder, FolderOpen, FolderPlus, Lock, NotebookPen, Paperclip, Pencil, Plus, Search, Trash2, Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { NameDialog } from '@/components/NameDialog';
import { NewNoteDialog } from '@/components/notes/NewNoteDialog';
import { notesHref } from '@/components/notes/href';
import { plural } from '@/components/UploadList';
import { ApiError, formatRelative, api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import { plainExcerpt, type NoteFolder, type NoteListing, type NoteSummary, type NoteVisibility } from '@/lib/types';

type NameDialogState = { kind: 'new-folder' } | { kind: 'rename-folder'; folder: NoteFolder };

type Action =
  | { kind: 'create-folder'; name: string }
  | { kind: 'rename-folder'; folder: NoteFolder; name: string }
  | { kind: 'delete-folder'; folder: NoteFolder };

const EMPTY: NoteListing = { folder: null, breadcrumb: [], folders: [], notes: [], sharedWithMe: [] };

export default function NotesPage() {
  return (
    <Suspense>
      <NotesList />
    </Suspense>
  );
}

function NotesList() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const scope: NoteVisibility = params.get('scope') === 'private' ? 'private' : 'common';
  const folderId = params.get('folder');
  const [query, setQuery] = useState('');
  const [listing, setListing] = useState<NoteListing | null>(null);
  const [missing, setMissing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [nameError, setNameError] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const searching = query.trim() !== '';

  const fetchListing = useCallback(() => {
    const qs = new URLSearchParams({ scope });
    if (searching) qs.set('q', query.trim());
    else if (folderId) qs.set('folder', folderId);
    return api<NoteListing>(`/notes?${qs}`);
  }, [scope, folderId, query, searching]);

  useEffect(() => {
    let alive = true;
    setListing(null);
    const t = setTimeout(() => {
      fetchListing()
        .then((l) => { if (alive) { setListing(l); setMissing(false); } })
        .catch((err) => {
          if (!alive) return;
          if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setMissing(true);
          else toast((err as Error).message);
          setListing(EMPTY);
        });
    }, searching ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [fetchListing, searching, toast]);

  const reload = () => fetchListing().then(setListing).catch((err) => toast((err as Error).message));
  const goTo = (s: NoteVisibility, id?: string | null) => router.push(notesHref(s, id), { scroll: false });
  const setScope = (s: NoteVisibility) => router.replace(notesHref(s));

  const rootName = scope === 'common' ? 'Comunes' : 'Mis notas privadas';
  const here = listing?.folder?.name ?? rootName;

  function closeAll() {
    setPending(null);
    setNameDialog(null);
    setNameError('');
  }

  async function run(action: Action) {
    setBusy(true);
    try {
      switch (action.kind) {
        case 'create-folder':
          await api('/notes/folders', { method: 'POST', body: { name: action.name, visibility: scope, parentId: folderId ?? undefined } });
          toast('Carpeta creada', 'success');
          break;
        case 'rename-folder':
          await api(`/notes/folders/${action.folder.id}`, { method: 'PATCH', body: { name: action.name } });
          toast('Carpeta renombrada', 'success');
          break;
        case 'delete-folder':
          await api(`/notes/folders/${action.folder.id}`, { method: 'DELETE' });
          toast('Carpeta eliminada', 'success');
          break;
      }
      closeAll();
      await reload();
    } catch (err) {
      // los nombres repetidos u otros rechazos se muestran junto al campo; el resto, como aviso
      if (nameDialog) setNameError((err as Error).message);
      else toast((err as Error).message);
      setPending(null);
    }
    setBusy(false);
  }

  const crumbs = listing?.breadcrumb ?? [];
  const empty = listing && listing.folders.length === 0 && listing.notes.length === 0 && listing.sharedWithMe.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Notas</h1>
        <div className="flex flex-wrap items-center gap-2">
          {!searching && !missing && (
            <button type="button" onClick={() => { setNameError(''); setNameDialog({ kind: 'new-folder' }); }} className="btn"><FolderPlus {...icon} /> Nueva carpeta</button>
          )}
          <button onClick={() => setCreating(true)} className="btn-accent"><Plus {...icon} /> Nueva nota</button>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="seg" role="group" aria-label="Tipo de notas">
          <button type="button" aria-pressed={scope === 'common'} onClick={() => setScope('common')}><Users {...icon} /> Comunes</button>
          <button type="button" aria-pressed={scope === 'private'} onClick={() => setScope('private')}><Lock {...icon} /> Privadas</button>
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search {...icon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            aria-label="Buscar notas"
            placeholder="Buscar en título y contenido…"
            className="w-full pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {searching ? (
        <p className="mb-3 text-sm text-zinc-500">Resultados en todas las carpetas de {scope === 'common' ? 'Comunes' : 'Privadas'}</p>
      ) : (
        <nav aria-label="Ruta de carpetas" className="mb-3 min-w-0">
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            <li className="flex items-center gap-1">
              {crumbs.length === 0 ? (
                <span aria-current="page" className="font-medium text-zinc-900">{rootName}</span>
              ) : (
                <button type="button" onClick={() => goTo(scope)} className="rounded px-1 text-accent hover:underline">{rootName}</button>
              )}
            </li>
            {crumbs.map((c, i) => (
              <li key={c.id} className="flex items-center gap-1">
                <ChevronRight size={14} strokeWidth={1.5} aria-hidden className="text-zinc-400" />
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="font-medium text-zinc-900">{c.name}</span>
                ) : (
                  <button type="button" onClick={() => goTo(scope, c.id)} className="rounded px-1 text-accent hover:underline">{c.name}</button>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {listing === null ? (
        <div aria-hidden className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      ) : missing ? (
        <EmptyState icon={FolderOpen} title="No encontramos esta carpeta" tone="neutral" action={<button onClick={() => goTo(scope)} className="btn-accent">Ir al inicio</button>}>
          Puede que se haya eliminado.
        </EmptyState>
      ) : empty ? (
        <EmptyState
          icon={searching ? NotebookPen : listing.folder ? FolderOpen : NotebookPen}
          title={searching ? 'Sin resultados' : listing.folder ? 'Esta carpeta está vacía' : scope === 'common' ? 'Aún no hay notas comunes' : 'Aún no tienes notas privadas'}
          action={!searching && <button onClick={() => setCreating(true)} className="btn-accent"><Plus {...icon} /> Nueva nota</button>}
        >
          {searching
            ? 'Prueba con otras palabras.'
            : listing.folder
              ? 'Crea una nota aquí o una subcarpeta para seguir ordenando.'
              : scope === 'common'
                ? 'Las notas comunes las lee y edita todo el equipo, como una wiki.'
                : 'Las privadas solo las ves tú y quienes las compartan contigo.'}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {(listing.folders.length > 0 || listing.notes.length > 0) && (
            <div className="space-y-2">
              {listing.folders.length > 0 && (
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  {listing.folders.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 px-3 py-2 sm:px-4">
                      <button type="button" onClick={() => goTo(scope, f.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded py-1.5 text-left">
                        <Folder {...icon} className="shrink-0 text-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-zinc-900">{f.name}</span>
                          <span className="block truncate text-xs text-zinc-500">
                            {f.itemCount === 0 ? 'Vacía' : plural(f.itemCount, 'elemento', 'elementos')}
                          </span>
                        </span>
                      </button>
                      <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={`Renombrar la carpeta ${f.name}`} onClick={() => { setNameError(''); setNameDialog({ kind: 'rename-folder', folder: f }); }}><Pencil {...icon} /></button>
                      <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={`Eliminar la carpeta ${f.name}`} onClick={() => setPending({ kind: 'delete-folder', folder: f })}><Trash2 {...icon} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <NoteCards notes={listing.notes} />
            </div>
          )}
          {listing.sharedWithMe.length > 0 && (
            <section aria-labelledby="shared-with-me">
              <h2 id="shared-with-me" className="section-label mb-2">Compartidas conmigo</h2>
              <NoteCards notes={listing.sharedWithMe} />
            </section>
          )}
        </div>
      )}

      {creating && (
        <NewNoteDialog
          initialVisibility={scope}
          folder={searching ? null : listing?.folder ?? null}
          onClose={() => setCreating(false)}
          onCreated={(n) => router.push(`/notes/${n.id}?edit=1`)}
        />
      )}

      {nameDialog && (
        <NameDialog
          title={nameDialog.kind === 'new-folder' ? 'Nueva carpeta' : 'Renombrar carpeta'}
          label="Nombre de la carpeta"
          initial={nameDialog.kind === 'rename-folder' ? nameDialog.folder.name : ''}
          submitLabel={nameDialog.kind === 'new-folder' ? 'Crear carpeta' : 'Renombrar'}
          error={nameError}
          onSubmit={(name) => {
            setNameError('');
            if (nameDialog.kind === 'new-folder') setPending({ kind: 'create-folder', name });
            else setPending({ kind: 'rename-folder', folder: nameDialog.folder, name });
          }}
          onClose={() => { setNameDialog(null); setNameError(''); }}
        />
      )}

      {pending && (
        <ConfirmDialog
          tone={pending.kind === 'delete-folder' ? 'danger' : 'accent'}
          busy={busy}
          onConfirm={() => run(pending)}
          onCancel={() => setPending(null)}
          {...confirmCopy(pending, here)}
        />
      )}
    </div>
  );
}

function NoteCards({ notes }: { notes: NoteSummary[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-2">
      {notes.map((n) => {
        const sharedLabel = n.shared || n.myAccess !== 'owner' ? 'Privada, compartida' : 'Privada';
        return (
          <li key={n.id}>
            <Link href={`/notes/${n.id}`} className="card-surface card-surface-interactive block p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 truncate text-sm font-semibold">{n.title}</h2>
                <span className="inline-flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                  {n.fileCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 tabular-nums" title={plural(n.fileCount, 'archivo adjunto', 'archivos adjuntos')}>
                      <Paperclip size={12} strokeWidth={1.5} aria-hidden /> {n.fileCount}
                      <span className="sr-only">{n.fileCount === 1 ? 'archivo adjunto' : 'archivos adjuntos'}</span>
                    </span>
                  )}
                  {n.visibility === 'private' && (
                    <span className="inline-flex items-center" title={sharedLabel}>
                      {n.shared || n.myAccess !== 'owner' ? <Users size={12} strokeWidth={1.5} aria-hidden /> : <Lock size={12} strokeWidth={1.5} aria-hidden />}
                      <span className="sr-only">{sharedLabel}</span>
                    </span>
                  )}
                </span>
              </div>
              {n.excerpt.trim() && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{plainExcerpt(n.excerpt)}</p>}
              <p className="mt-2 text-xs text-zinc-500">
                {n.owner?.name ?? 'Autor eliminado'} · Editada {formatRelative(n.updatedAt)}
                {n.myAccess === 'view' && ' · Solo lectura'}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function confirmCopy(a: Action, here: string): { title: string; confirmLabel: string; busyLabel: string; children: React.ReactNode } {
  switch (a.kind) {
    case 'create-folder':
      return { title: `¿Crear la carpeta «${a.name}»?`, confirmLabel: 'Crear carpeta', busyLabel: 'Creando…', children: <>Se creará dentro de «{here}».</> };
    case 'rename-folder':
      return { title: '¿Renombrar la carpeta?', confirmLabel: 'Renombrar', busyLabel: 'Renombrando…', children: <>«{a.folder.name}» pasará a llamarse «{a.name}».</> };
    case 'delete-folder':
      return {
        title: '¿Eliminar esta carpeta?',
        confirmLabel: 'Eliminar carpeta',
        busyLabel: 'Eliminando…',
        children: a.folder.itemCount > 0
          ? <>Se eliminarán «{a.folder.name}» y sus subcarpetas. Las notas que contienen no se pierden: pasan al inicio de la pestaña.</>
          : <>«{a.folder.name}» está vacía y se eliminará.</>,
      };
  }
}
