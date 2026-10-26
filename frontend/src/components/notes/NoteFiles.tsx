'use client';

import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, formatDate, formatSize } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Note, NoteFile } from '@/lib/types';
import { ConfirmDialog } from '../ConfirmDialog';
import { isUploading, plural, UploadList, type Upload as UploadItem } from '../UploadList';

/** Archivos adjuntos de una nota, aparte del texto: los ve quien lee la nota y los gestiona quien la edita. */
export function NoteFiles({ note, onChange }: { note: Note; onChange: (files: NoteFile[]) => void }) {
  const toast = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [toUpload, setToUpload] = useState<File[] | null>(null);
  const [toDelete, setToDelete] = useState<NoteFile | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = note.myAccess === 'owner' || note.myAccess === 'edit';
  const uploading = isUploading(uploads);
  const fileUrl = (f: NoteFile) => `/api/notes/${note.id}/files/${f.id}`;

  /** Un archivo por petición: así ninguna supera el límite de tamaño del servidor web. */
  async function upload(files: File[]) {
    const items: UploadItem[] = files.map((f, i) => ({ key: Date.now() + i, name: f.name, status: 'waiting' }));
    setUploads(items);
    const patch = (key: number, p: Partial<UploadItem>) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u)));
    let current = note.files;
    for (let i = 0; i < files.length; i++) {
      patch(items[i].key, { status: 'uploading' });
      const form = new FormData();
      form.append('files', files[i]);
      try {
        const added = await api<NoteFile[]>(`/notes/${note.id}/files`, { method: 'POST', form });
        current = [...current, ...added];
        onChange(current);
        patch(items[i].key, { status: 'done' });
      } catch (err) {
        patch(items[i].key, { status: 'error', error: (err as Error).message });
      }
    }
    const ok = current.length - note.files.length;
    if (ok > 0) toast(plural(ok, 'archivo subido', 'archivos subidos'), 'success');
  }

  async function remove(f: NoteFile) {
    setBusy(true);
    try {
      await api(`/notes/${note.id}/files/${f.id}`, { method: 'DELETE' });
      onChange(note.files.filter((x) => x.id !== f.id));
      toast('Archivo eliminado', 'success');
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
    setToDelete(null);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) setToUpload(files);
  }

  if (!canEdit && note.files.length === 0) return null;

  return (
    <section aria-labelledby="note-files" className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="note-files" className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Paperclip {...icon} className="text-zinc-500" /> Archivos adjuntos
          {note.files.length > 0 && <span className="font-normal tabular-nums text-zinc-500">({note.files.length})</span>}
        </h2>
        {canEdit && (
          <>
            <button type="button" onClick={() => picker.current?.click()} className="btn btn-sm" disabled={uploading}><Upload {...icon} /> Adjuntar archivos</button>
            <input ref={picker} type="file" multiple className="hidden" onChange={onPick} aria-label="Elegir archivos para adjuntar" />
          </>
        )}
      </div>

      <UploadList uploads={uploads} onDismiss={() => setUploads([])} />

      {note.files.length === 0 ? (
        <p className="text-sm text-zinc-500">Sin archivos. Adjunta documentos, imágenes o PDF relacionados con esta nota.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {note.files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-1.5">
              <FileText {...icon} className="shrink-0 text-zinc-400" />
              <a href={fileUrl(f)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 rounded py-1">
                <span className="block truncate text-sm font-medium text-zinc-900 hover:underline">{f.originalName}</span>
                <span className="block truncate text-xs tabular-nums text-zinc-500">
                  {formatSize(f.size)} · {f.uploadedBy?.name ?? 'Usuario eliminado'} · {formatDate(f.createdAt)}
                </span>
              </a>
              <a href={`${fileUrl(f)}?download=1`} className="btn-ghost btn-icon btn-sm" aria-label={`Descargar ${f.originalName}`}><Download {...icon} /></a>
              {canEdit && (
                <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={`Eliminar el archivo ${f.originalName}`} onClick={() => setToDelete(f)}><Trash2 {...icon} /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {toUpload && (
        <ConfirmDialog
          title={`¿Adjuntar ${plural(toUpload.length, 'archivo', 'archivos')}?`}
          confirmLabel="Adjuntar"
          busyLabel="Subiendo…"
          onConfirm={() => { const files = toUpload; setToUpload(null); void upload(files); }}
          onCancel={() => setToUpload(null)}
        >
          <p>Los podrá ver cualquiera que tenga acceso a esta nota.</p>
          <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-zinc-500">
            {toUpload.map((f, i) => <li key={i} className="break-words">{f.name} ({formatSize(f.size)})</li>)}
          </ul>
        </ConfirmDialog>
      )}
      {toDelete && (
        <ConfirmDialog
          tone="danger"
          title="¿Eliminar este archivo?"
          confirmLabel="Eliminar archivo"
          busyLabel="Eliminando…"
          busy={busy}
          onConfirm={() => remove(toDelete)}
          onCancel={() => setToDelete(null)}
        >
          «{toDelete.originalName}» se eliminará para siempre.
        </ConfirmDialog>
      )}
    </section>
  );
}
