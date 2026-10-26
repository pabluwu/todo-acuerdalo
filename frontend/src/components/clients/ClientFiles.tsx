'use client';

import { ChevronRight, Download, FileText, Folder, FolderOpen, FolderPlus, Pencil, Trash2, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, formatDate, formatSize } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { ClientFile, ClientFolder, FolderListing } from '@/lib/types';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmptyState } from '../EmptyState';
import { NameDialog } from '../NameDialog';
import { isUploading, plural, UploadList, type Upload as UploadItem } from '../UploadList';

type NameDialog =
  | { kind: 'new-folder' }
  | { kind: 'rename-folder'; folder: ClientFolder }
  | { kind: 'rename-file'; file: ClientFile };

type Action =
  | { kind: 'create-folder'; name: string }
  | { kind: 'rename-folder'; folder: ClientFolder; name: string }
  | { kind: 'rename-file'; file: ClientFile; name: string }
  | { kind: 'delete-folder'; folder: ClientFolder }
  | { kind: 'delete-file'; file: ClientFile }
  | { kind: 'upload'; files: File[] };

/** Explorador de archivos del cliente: carpetas anidadas con ruta de navegación. */
export function ClientFiles({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const folderId = params.get('folder');
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [missing, setMissing] = useState(false);
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
  const [nameError, setNameError] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    return api<FolderListing>(`/clients/${clientId}/folders${folderId ? `?parent=${folderId}` : ''}`)
      .then((l) => { setListing(l); setMissing(false); })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setMissing(true);
        else toast((err as Error).message);
        setListing({ folder: null, breadcrumb: [], folders: [], files: [] });
      });
  }, [clientId, folderId, toast]);

  useEffect(() => {
    setListing(null);
    void load();
  }, [load]);

  const goTo = (id: string | null) => router.push(`/clients/${clientId}?tab=archivos${id ? `&folder=${id}` : ''}`, { scroll: false });
  const here = listing?.folder?.name ?? clientName;
  const fileUrl = (f: ClientFile) => `/api/clients/${clientId}/files/${f.id}`;

  function closeAll() {
    setPending(null);
    setNameDialog(null);
    setNameError('');
  }

  async function run(action: Action) {
    setBusy(true);
    try {
      const base = `/clients/${clientId}`;
      switch (action.kind) {
        case 'create-folder':
          await api(`${base}/folders`, { method: 'POST', body: { name: action.name, parentId: folderId ?? undefined } });
          toast('Carpeta creada', 'success');
          break;
        case 'rename-folder':
          await api(`${base}/folders/${action.folder.id}`, { method: 'PATCH', body: { name: action.name } });
          toast('Carpeta renombrada', 'success');
          break;
        case 'rename-file':
          await api(`${base}/files/${action.file.id}`, { method: 'PATCH', body: { name: action.name } });
          toast('Archivo renombrado', 'success');
          break;
        case 'delete-folder':
          await api(`${base}/folders/${action.folder.id}`, { method: 'DELETE' });
          toast('Carpeta eliminada', 'success');
          break;
        case 'delete-file':
          await api(`${base}/files/${action.file.id}`, { method: 'DELETE' });
          toast('Archivo eliminado', 'success');
          break;
        case 'upload':
          closeAll();
          setBusy(false);
          void upload(action.files);
          return;
      }
      closeAll();
      await load();
    } catch (err) {
      // los nombres repetidos u otros rechazos se muestran junto al campo; el resto, como aviso
      if (nameDialog) setNameError((err as Error).message);
      else toast((err as Error).message);
      setPending(null);
    }
    setBusy(false);
  }

  /** Un archivo por petición: así ninguna supera el límite de tamaño del servidor web. */
  async function upload(files: File[]) {
    const target = folderId;
    const items: UploadItem[] = files.map((f, i) => ({ key: Date.now() + i, name: f.name, status: 'waiting' }));
    setUploads(items);
    const patch = (key: number, p: Partial<UploadItem>) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u)));
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      patch(items[i].key, { status: 'uploading' });
      const form = new FormData();
      form.append('files', files[i]);
      if (target) form.append('folderId', target);
      try {
        await api(`/clients/${clientId}/files`, { method: 'POST', form });
        patch(items[i].key, { status: 'done' });
        ok++;
      } catch (err) {
        patch(items[i].key, { status: 'error', error: (err as Error).message });
      }
    }
    if (ok > 0) toast(plural(ok, 'archivo subido', 'archivos subidos'), 'success');
    await load();
  }

  const uploading = isUploading(uploads);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) setPending({ kind: 'upload', files });
  }

  const crumbs = listing?.breadcrumb ?? [];
  const empty = listing && listing.folders.length === 0 && listing.files.length === 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Ruta de carpetas" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            <li className="flex items-center gap-1">
              {crumbs.length === 0 ? (
                <span aria-current="page" className="font-medium text-zinc-900">{clientName}</span>
              ) : (
                <button type="button" onClick={() => goTo(null)} className="rounded px-1 text-accent hover:underline">{clientName}</button>
              )}
            </li>
            {crumbs.map((c, i) => (
              <li key={c.id} className="flex items-center gap-1">
                <ChevronRight size={14} strokeWidth={1.5} aria-hidden className="text-zinc-400" />
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="font-medium text-zinc-900">{c.name}</span>
                ) : (
                  <button type="button" onClick={() => goTo(c.id)} className="rounded px-1 text-accent hover:underline">{c.name}</button>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setNameError(''); setNameDialog({ kind: 'new-folder' }); }} className="btn"><FolderPlus {...icon} /> Nueva carpeta</button>
          <button type="button" onClick={() => picker.current?.click()} className="btn-accent" disabled={uploading}><Upload {...icon} /> Subir archivos</button>
          <input ref={picker} type="file" multiple className="hidden" onChange={onPick} aria-label="Elegir archivos para subir" />
        </div>
      </div>

      <UploadList uploads={uploads} onDismiss={() => setUploads([])} />

      {listing === null ? (
        <div aria-hidden className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 w-full" />)}
        </div>
      ) : missing ? (
        <EmptyState icon={FolderOpen} title="No encontramos esta carpeta" tone="neutral" action={<button onClick={() => goTo(null)} className="btn-accent">Ir a la raíz</button>}>
          Puede que se haya eliminado.
        </EmptyState>
      ) : empty ? (
        <EmptyState icon={FolderOpen} title="Esta carpeta está vacía" tone="neutral">
          Crea una carpeta para ordenar los documentos o sube los archivos del caso.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {listing.folders.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2 sm:px-4">
              <button type="button" onClick={() => goTo(f.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded py-1.5 text-left">
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
          {listing.files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2 sm:px-4">
              <FileText {...icon} className="shrink-0 text-zinc-400" />
              <a href={fileUrl(f)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 rounded py-1.5">
                <span className="block truncate text-sm font-medium text-zinc-900 hover:underline">{f.originalName}</span>
                <span className="block truncate text-xs tabular-nums text-zinc-500">
                  {formatSize(f.size)} · {f.uploadedBy?.name ?? 'Usuario eliminado'} · {formatDate(f.createdAt)}
                </span>
              </a>
              <a href={`${fileUrl(f)}?download=1`} className="btn-ghost btn-icon btn-sm" aria-label={`Descargar ${f.originalName}`}><Download {...icon} /></a>
              <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={`Renombrar el archivo ${f.originalName}`} onClick={() => { setNameError(''); setNameDialog({ kind: 'rename-file', file: f }); }}><Pencil {...icon} /></button>
              <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={`Eliminar el archivo ${f.originalName}`} onClick={() => setPending({ kind: 'delete-file', file: f })}><Trash2 {...icon} /></button>
            </li>
          ))}
        </ul>
      )}

      {nameDialog && (
        <NameDialog
          title={nameDialog.kind === 'new-folder' ? 'Nueva carpeta' : nameDialog.kind === 'rename-folder' ? 'Renombrar carpeta' : 'Renombrar archivo'}
          label={nameDialog.kind === 'rename-file' ? 'Nombre del archivo' : 'Nombre de la carpeta'}
          initial={nameDialog.kind === 'rename-folder' ? nameDialog.folder.name : nameDialog.kind === 'rename-file' ? nameDialog.file.originalName : ''}
          submitLabel={nameDialog.kind === 'new-folder' ? 'Crear carpeta' : 'Renombrar'}
          error={nameError}
          onSubmit={(name) => {
            setNameError('');
            if (nameDialog.kind === 'new-folder') setPending({ kind: 'create-folder', name });
            else if (nameDialog.kind === 'rename-folder') setPending({ kind: 'rename-folder', folder: nameDialog.folder, name });
            else setPending({ kind: 'rename-file', file: nameDialog.file, name });
          }}
          onClose={() => { setNameDialog(null); setNameError(''); }}
        />
      )}

      {pending && (
        <ConfirmDialog
          tone={pending.kind.startsWith('delete') ? 'danger' : 'accent'}
          busy={busy}
          onConfirm={() => run(pending)}
          onCancel={() => setPending(null)}
          {...confirmCopy(pending, here)}
        />
      )}
    </div>
  );
}

function confirmCopy(a: Action, here: string): { title: string; confirmLabel: string; busyLabel: string; children: React.ReactNode } {
  switch (a.kind) {
    case 'create-folder':
      return { title: `¿Crear la carpeta «${a.name}»?`, confirmLabel: 'Crear carpeta', busyLabel: 'Creando…', children: <>Se creará dentro de «{here}».</> };
    case 'rename-folder':
      return { title: '¿Renombrar la carpeta?', confirmLabel: 'Renombrar', busyLabel: 'Renombrando…', children: <>«{a.folder.name}» pasará a llamarse «{a.name}».</> };
    case 'rename-file':
      return { title: '¿Renombrar el archivo?', confirmLabel: 'Renombrar', busyLabel: 'Renombrando…', children: <>«{a.file.originalName}» pasará a llamarse «{a.name}».</> };
    case 'delete-folder':
      return {
        title: '¿Eliminar esta carpeta?',
        confirmLabel: 'Eliminar carpeta',
        busyLabel: 'Eliminando…',
        children: a.folder.itemCount > 0
          ? <>«{a.folder.name}» y los {plural(a.folder.itemCount, 'elemento', 'elementos')} que contiene (carpetas y archivos) se eliminarán para siempre.</>
          : <>«{a.folder.name}» está vacía y se eliminará para siempre.</>,
      };
    case 'delete-file':
      return { title: '¿Eliminar este archivo?', confirmLabel: 'Eliminar archivo', busyLabel: 'Eliminando…', children: <>«{a.file.originalName}» se eliminará para siempre.</> };
    case 'upload':
      return {
        title: `¿Subir ${plural(a.files.length, 'archivo', 'archivos')}?`,
        confirmLabel: 'Subir',
        busyLabel: 'Subiendo…',
        children: (
          <>
            <p>Se guardarán en «{here}» y todo el equipo podrá verlos.</p>
            <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-zinc-500">
              {a.files.map((f, i) => <li key={i} className="break-words">{f.name} ({formatSize(f.size)})</li>)}
            </ul>
          </>
        ),
      };
  }
}
