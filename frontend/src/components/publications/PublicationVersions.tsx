'use client';

import { Check, CircleCheck, Columns2, Eye, History, LoaderCircle, MessageSquareWarning, RotateCcw, Upload, X, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatDate, formatSize } from '@/lib/api';
import { icon } from '@/lib/icons';
import { uploadForm } from '@/lib/publications';
import { useToast } from '@/lib/toast';
import type { PublicationDetail, PublicationVersion } from '@/lib/types';

const MAX_IMAGES = 20;

function versionBadge(pub: PublicationDetail, v: PublicationVersion, isLatest: boolean): { label: string; icon: LucideIcon; cls: string } {
  if (!isLatest) return { label: 'Reemplazada', icon: History, cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' };
  if (pub.status === 'por_publicar' || pub.status === 'publicada') return { label: 'Aprobada', icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' };
  if (v.approvals.some((a) => a.decision === 'cambios')) return { label: 'Cambios pedidos', icon: MessageSquareWarning, cls: 'bg-rose-50 text-rose-800 ring-rose-200' };
  const active = pub.reviewers.filter((r) => r.isActive);
  if (active.length > 0 && active.every((r) => v.approvals.some((a) => a.userId === r.id && a.decision === 'aprobada'))) {
    return { label: 'Aprobada', icon: CircleCheck, cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' };
  }
  return { label: 'En revisión', icon: Eye, cls: 'bg-indigo-50 text-indigo-800 ring-indigo-200' };
}

/** Lista de versiones (elegir cuál ver, comparar) y zona para subir la siguiente. */
export function PublicationVersions({
  pub,
  viewedId,
  onSelect,
  comparing,
  onCompare,
  onUploaded,
  onUploadingChange,
  onReopen,
  reopening,
}: {
  pub: PublicationDetail;
  viewedId: string | null;
  onSelect: (id: string) => void;
  comparing: boolean;
  onCompare: (on: boolean) => void;
  onUploaded: (p: PublicationDetail) => void;
  onUploadingChange: (busy: boolean) => void;
  onReopen: () => void;
  reopening: boolean;
}) {
  const toast = useToast();
  const headingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);
  const [staged, setStaged] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const latest = pub.versions[0];
  const next = (latest?.number ?? 0) + 1;
  const isVideo = pub.format === 'video';
  const uploading = progress !== null;
  const viewIdx = Math.max(0, pub.versions.findIndex((v) => v.id === (viewedId ?? latest?.id)));
  const hasPrevious = viewIdx < pub.versions.length - 1;
  const editable = pub.status === 'idea' || pub.status === 'edicion';

  useEffect(() => { onUploadingChange(uploading); }, [uploading, onUploadingChange]);
  useEffect(() => {
    if (!uploading) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [uploading]);

  function add(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (incoming.length === 0 || uploading) return;
    setError('');
    if (isVideo) {
      if (incoming.length > 1) return setError('Sube un solo video por versión.');
      if (!incoming[0].type.startsWith('video/')) return setError('El archivo debe ser un video (MP4 o MOV).');
      setStaged(incoming);
      return;
    }
    if (incoming.some((f) => !f.type.startsWith('image/'))) return setError('Todos los archivos deben ser imágenes.');
    if (staged.length + incoming.length > MAX_IMAGES) return setError(`Un carrusel admite hasta ${MAX_IMAGES} imágenes.`);
    setStaged([...staged, ...incoming]);
  }

  async function upload() {
    if (staged.length === 0 || uploading) return;
    const form = new FormData();
    staged.forEach((f) => form.append('files', f));
    if (note.trim()) form.append('note', note.trim());
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress(0);
    setError('');
    try {
      const updated = await uploadForm<PublicationDetail>(`/publications/${pub.id}/versions`, form, setProgress, ctrl.signal);
      setStaged([]);
      setNote('');
      onUploaded(updated);
      toast(`Versión v${next} subida`, 'success');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      if (msg !== 'Subida cancelada.') toast(msg);
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  const total = staged.reduce((n, f) => n + f.size, 0);
  const accept = isVideo ? 'video/*' : 'image/*';

  return (
    <section aria-labelledby={headingId} className="card-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-semibold text-zinc-900">Versiones</h2>
        {pub.versions.length > 1 && (
          <button type="button" className="btn btn-sm" aria-pressed={comparing} disabled={!hasPrevious && !comparing} onClick={() => onCompare(!comparing)}>
            <Columns2 {...icon} /> {comparing ? 'Dejar de comparar' : 'Comparar con la versión anterior'}
          </button>
        )}
      </div>

      {pub.versions.length === 0 ? (
        <p className="mb-4 text-sm text-zinc-600">Todavía no hay versiones. Sube la primera para que el equipo la revise.</p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {pub.versions.map((v, i) => {
            const selected = v.id === (viewedId ?? latest.id);
            const b = versionBadge(pub, v, i === 0);
            return (
              <li key={v.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(v.id)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? 'border-accent bg-accent-soft/60' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}
                >
                  <span className="w-8 shrink-0 text-sm font-semibold tabular-nums text-zinc-900">v{v.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-800">
                      {i === 0 ? 'Última versión' : 'Versión anterior'}
                      {v.note && <span className="text-zinc-500"> · {v.note}</span>}
                    </span>
                    <span className="block truncate text-xs tabular-nums text-zinc-500">
                      {v.uploadedBy?.name ?? 'Alguien'} · {formatDate(v.createdAt)} · {v.files.length} {v.files.length === 1 ? 'archivo' : 'archivos'}
                    </span>
                  </span>
                  <span className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 ring-inset ${b.cls}`}>
                    <b.icon size={12} strokeWidth={1.75} aria-hidden /> {b.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <div
          onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true); } }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDragLeave={() => { if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
          onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDragging(false); add(e.dataTransfer.files); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={!isVideo}
            className="hidden"
            tabIndex={-1}
            onChange={(e) => { add(e.target.files ?? []); e.target.value = ''; }}
          />
          {staged.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-zinc-300 bg-stone-50/60 hover:border-zinc-400 hover:bg-stone-50'}`}
            >
              <Upload {...icon} className="text-accent" />
              <span className="text-sm font-medium text-zinc-900">Subir v{next}</span>
              <span className="text-xs text-zinc-600">{isVideo ? 'Arrastra un video o toca para elegirlo' : `Arrastra hasta ${MAX_IMAGES} imágenes o toca para elegirlas`}</span>
              {next === 1 && <span className="text-xs text-zinc-500">Al subir la primera versión pasa a Edición y se avisa a los revisores.</span>}
            </button>
          ) : (
            <div className={`rounded-xl border p-3 ${dragging ? 'border-accent bg-accent-soft' : 'border-zinc-200 bg-stone-50/60'}`}>
              <p className="mb-2 text-sm font-medium text-zinc-900">Subir v{next} · <span className="tabular-nums font-normal text-zinc-600">{staged.length} {staged.length === 1 ? 'archivo' : 'archivos'}, {formatSize(total)}</span></p>
              <ol className="mb-3 space-y-1">
                {staged.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm">
                    {!isVideo && <span className="w-5 shrink-0 text-xs tabular-nums text-zinc-500">{i + 1}</span>}
                    <span className="min-w-0 flex-1 truncate text-zinc-800">{f.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">{formatSize(f.size)}</span>
                    {!uploading && (
                      <button type="button" aria-label={`Quitar ${f.name}`} className="btn-ghost btn-icon btn-sm" onClick={() => setStaged(staged.filter((_, j) => j !== i))}><X size={14} strokeWidth={1.5} aria-hidden /></button>
                    )}
                  </li>
                ))}
              </ol>
              {!isVideo && !uploading && staged.length < MAX_IMAGES && (
                <button type="button" className="btn btn-sm mb-3" onClick={() => inputRef.current?.click()}><Upload {...icon} /> Añadir más imágenes</button>
              )}
              <label className="label" htmlFor={`${headingId}-note`}>Nota de la versión (opcional)</label>
              <input id={`${headingId}-note`} className="mb-3 w-full" maxLength={500} placeholder="Qué cambió respecto a la anterior" value={note} disabled={uploading} onChange={(e) => setNote(e.target.value)} />
              {uploading ? (
                <div role="status">
                  <div className="mb-1 flex items-center justify-between text-xs tabular-nums text-zinc-600">
                    <span className="inline-flex items-center gap-1.5"><LoaderCircle size={14} strokeWidth={1.5} aria-hidden className="animate-spin text-accent" /> {progress! >= 1 ? 'Procesando…' : 'Subiendo…'}</span>
                    <span>{Math.round(progress! * 100)} %</span>
                  </div>
                  <div role="progressbar" aria-label="Progreso de la subida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress! * 100)} className="h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${progress! * 100}%` }} />
                  </div>
                  <button type="button" className="btn btn-sm mt-3" onClick={() => abortRef.current?.abort()}>Cancelar subida</button>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn" onClick={() => { setStaged([]); setNote(''); setError(''); }}>Cancelar</button>
                  <button type="button" className="btn-accent" onClick={upload}><Check {...icon} /> Subir v{next}</button>
                </div>
              )}
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}

      {pub.status === 'por_publicar' && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-stone-50/60 p-4 text-sm text-zinc-600">
          <p className="mb-3">La edición está cerrada porque todos aprobaron. Si necesitas cambiar algo, reabre la edición y sube una nueva versión.</p>
          <button type="button" className="btn" onClick={onReopen} disabled={reopening}><RotateCcw {...icon} /> {reopening ? 'Reabriendo…' : 'Reabrir edición'}</button>
        </div>
      )}
      {pub.status === 'cancelada' && <p className="text-sm text-zinc-500">La publicación está cancelada. Reactívala para subir nuevas versiones.</p>}
    </section>
  );
}
