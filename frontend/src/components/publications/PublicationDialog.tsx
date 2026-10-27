'use client';

import { Film, Image as ImageIcon, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from '@/lib/api';
import { localDateStr, pad } from '@/lib/calendar';
import { icon } from '@/lib/icons';
import { PLATFORM_LABEL } from '@/lib/publications';
import type { ClientSummary, PublicationDetail, PublicationFormat, UserLite } from '@/lib/types';
import { AssigneePicker } from '../AssigneePicker';
import { Dialog } from '../Dialog';
import { Field } from '../Field';

const VIDEO_PLATFORMS = ['tiktok', 'reels'];
const POST_PLATFORMS = ['instagram'];

/**
 * Crear o editar una publicación. Se crea como Idea; el llamador navega al detalle.
 * En móvil ocupa toda la pantalla (`dialog-form`), con el botón de guardar al alcance del pulgar.
 */
export function PublicationDialog({
  publication,
  initialDate,
  initialClientId,
  onClose,
  onSaved,
}: {
  publication?: PublicationDetail | null;
  /** yyyy-mm-dd */
  initialDate?: string;
  initialClientId?: string;
  onClose: () => void;
  onSaved: (p: PublicationDetail) => void;
}) {
  const headingId = useId();
  const editing = !!publication;
  const hasVersions = !!publication && publication.versions.length > 0;
  const sched = publication ? new Date(publication.scheduledAt) : null;

  const [title, setTitle] = useState(publication?.title ?? '');
  const [format, setFormat] = useState<PublicationFormat>(publication?.format ?? 'video');
  const [platforms, setPlatforms] = useState<string[]>(publication?.platforms ?? VIDEO_PLATFORMS);
  const [clientId, setClientId] = useState(publication?.client?.id ?? initialClientId ?? '');
  const [date, setDate] = useState(sched ? localDateStr(sched) : initialDate ?? localDateStr(new Date()));
  const [time, setTime] = useState(sched ? `${pad(sched.getHours())}:${pad(sched.getMinutes())}` : '10:00');
  const [brief, setBrief] = useState(publication?.brief ?? '');
  const [reviewers, setReviewers] = useState<string[] | null>(publication ? publication.reviewers.filter((r) => r.isActive).map((r) => r.id) : null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<UserLite[]>('/users')
      .then((u) => {
        setUsers(u);
        // por defecto revisan todos los usuarios activos
        setReviewers((r) => r ?? u.map((x) => x.id));
      })
      .catch(() => setReviewers((r) => r ?? []));
    api<ClientSummary[]>('/clients').then(setClients).catch(() => undefined);
  }, []);

  function pickFormat(f: PublicationFormat) {
    if (f === format || hasVersions) return;
    setFormat(f);
    setPlatforms(f === 'video' ? VIDEO_PLATFORMS : POST_PLATFORMS);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) return setError('Elige la fecha y la hora.');
    if (format === 'video' && platforms.length === 0) return setError('Elige al menos una plataforma.');
    const at = new Date(`${date}T${time}`);
    if (isNaN(at.getTime())) return setError('La fecha u hora no es válida.');
    setBusy(true);
    setError('');
    const body = {
      title: title.trim(),
      format,
      platforms,
      scheduledAt: at.toISOString(),
      clientId: clientId || null,
      brief,
      reviewerIds: reviewers ?? [],
    };
    try {
      const saved = await api<PublicationDetail>(editing ? `/publications/${publication!.id}` : '/publications', { method: editing ? 'PATCH' : 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const cards: { id: PublicationFormat; label: string; sub: string; Icon: typeof Film }[] = [
    { id: 'video', label: 'Video', sub: 'TikTok y Reels', Icon: Film },
    { id: 'post', label: 'Post', sub: 'Imagen o carrusel', Icon: ImageIcon },
  ];

  return (
    <Dialog variant="form" labelledBy={headingId} onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-3 sm:px-6">
        <h2 id={headingId} className="text-base font-semibold tracking-tight">{editing ? 'Editar publicación' : 'Nueva publicación'}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
      </div>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <Field label="Título">
            {(p) => <input {...p} autoFocus required maxLength={300} className="w-full" placeholder="Por ejemplo, Tips para declarar impuestos" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>

          <fieldset>
            <legend className="mb-1 text-xs text-zinc-600">Formato</legend>
            <div role="radiogroup" aria-label="Formato" className="grid grid-cols-2 gap-3">
              {cards.map((c) => {
                const on = format === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={hasVersions && !on}
                    onClick={() => pickFormat(c.id)}
                    className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${on ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${on ? 'bg-white text-accent' : 'bg-zinc-100 text-zinc-600'}`}><c.Icon {...icon} /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-900">{c.label}</span>
                      <span className="block text-xs text-zinc-600">{c.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {hasVersions && <p className="mt-1 text-xs text-zinc-500">El formato no se puede cambiar una vez subida la primera versión.</p>}
            {format === 'video' && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2" role="group" aria-label="Plataformas">
                {VIDEO_PLATFORMS.map((pl) => (
                  <label key={pl} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={platforms.includes(pl)}
                      onChange={(e) => setPlatforms(e.target.checked ? [...platforms, pl] : platforms.filter((x) => x !== pl))}
                    />
                    {PLATFORM_LABEL[pl]}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <Field label="Cliente">
            {(p) => (
              <select {...p} className="w-full" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Sin cliente</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha">
              {(p) => <input {...p} type="date" required className="w-full tabular-nums" value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Field label="Hora">
              {(p) => <input {...p} type="time" required className="w-full tabular-nums" value={time} onChange={(e) => setTime(e.target.value)} />}
            </Field>
          </div>

          <Field label="Brief" hint="La idea en pocas líneas: de qué trata, tono, referencias.">
            {(p) => <textarea {...p} rows={4} className="w-full resize-none" value={brief} onChange={(e) => setBrief(e.target.value)} />}
          </Field>

          <Field label="Revisores" hint="Aprueban la última versión. Por defecto, todo el equipo.">
            {(p) => <AssigneePicker id={p.id} users={users} value={reviewers ?? []} onCommit={setReviewers} placeholder="Sin revisores" />}
          </Field>

          {!editing && (
            <p className="rounded-md bg-stone-100 px-3 py-2 text-xs text-zinc-600">Se crea como Idea. Sube la primera versión cuando esté lista para revisión.</p>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn-accent" disabled={busy || !title.trim()}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear idea'}</button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
