'use client';

import { Check, Clock, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { api, fromLocalInput, toLocalInput } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { addDaysStr, eventClock, EVENT_COLORS, localDateStr, pad, REMINDERS, utcDateStr } from '@/lib/calendar';
import { icon } from '@/lib/icons';
import type { CalendarEvent, UserLite } from '@/lib/types';
import { AssigneePicker } from '../AssigneePicker';
import { Dialog } from '../Dialog';
import { Field } from '../Field';
import { ContactPicker, type ContactValue } from './ContactPicker';

export interface EventDraft {
  start: Date;
  /** Fin exclusivo cuando allDay */
  end: Date;
  allDay: boolean;
}

type Conflicts = Record<string, { id: string; title: string; startAt: string; endAt: string }[]>;

function defaultDraft(): EventDraft {
  const s = new Date();
  s.setMinutes(0, 0, 0);
  s.setHours(s.getHours() + 1);
  return { start: s, end: new Date(s.getTime() + 3600_000), allDay: false };
}

const dtInput = (d: Date) => `${localDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function EventDialog({
  users,
  event,
  draft,
  onClose,
  onSaved,
}: {
  users: UserLite[];
  event?: CalendarEvent | null;
  draft?: EventDraft | null;
  onClose: () => void;
  onSaved: (e: CalendarEvent) => void;
}) {
  const { user } = useAuth();
  const headingId = useId();
  const editing = !!event;
  const init = useMemo(() => draft ?? defaultDraft(), [draft]);

  const [title, setTitle] = useState(event?.title ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? init.allDay);
  const [start, setStart] = useState(() => {
    if (event) return event.allDay ? utcDateStr(event.startAt) : toLocalInput(event.startAt);
    return init.allDay ? localDateStr(init.start) : dtInput(init.start);
  });
  const [end, setEnd] = useState(() => {
    if (event) return event.allDay ? addDaysStr(utcDateStr(event.endAt), -1) : toLocalInput(event.endAt);
    if (init.allDay) return localDateStr(new Date(init.end.getTime() - 1));
    return dtInput(init.end);
  });
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [color, setColor] = useState(event?.color ?? 'accent');
  const [reminder, setReminder] = useState<number | null>(event?.reminderMinutes ?? null);
  const [participants, setParticipants] = useState<string[]>(event ? event.participants.map((p) => p.id) : user ? [user.id] : []);
  const [externals, setExternals] = useState<ContactValue[]>(event?.externalContacts.map((c) => ({ ...c })) ?? []);
  const [conflicts, setConflicts] = useState<Conflicts>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleAllDay(on: boolean) {
    setAllDay(on);
    if (on) {
      setStart(start.slice(0, 10));
      setEnd(end.slice(0, 10));
    } else {
      setStart(`${start.slice(0, 10)}T09:00`);
      setEnd(`${end.slice(0, 10)}T10:00`);
    }
  }

  // al mover el inicio, el fin conserva la duración
  function changeStart(v: string) {
    if (v && start && end) {
      const a = allDay ? new Date(`${start}T00:00`) : new Date(start);
      const b = allDay ? new Date(`${end}T00:00`) : new Date(end);
      const next = allDay ? new Date(`${v}T00:00`) : new Date(v);
      if (!isNaN(a.getTime()) && !isNaN(b.getTime()) && !isNaN(next.getTime()) && b >= a) {
        const moved = new Date(next.getTime() + (b.getTime() - a.getTime()));
        setEnd(allDay ? localDateStr(moved) : dtInput(moved));
      }
    }
    setStart(v);
  }

  const range = useMemo(() => {
    if (!start || !end) return null;
    const s = allDay ? new Date(`${start}T00:00`) : new Date(start);
    const e = allDay ? new Date(`${addDaysStr(end, 1)}T00:00`) : new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return { s, e, invalid: allDay ? end < start : e < s };
  }, [start, end, allDay]);

  // aviso de "ocupado": consulta los choques de los participantes con este horario
  const participantKey = [...participants].sort().join(',');
  useEffect(() => {
    if (!range || range.invalid || participants.length === 0) { setConflicts({}); return; }
    const q = new URLSearchParams({ userIds: participantKey, startAt: range.s.toISOString(), endAt: range.e.toISOString() });
    if (event) q.set('excludeId', event.id);
    let cancelled = false;
    const t = setTimeout(() => {
      api<Conflicts>(`/events/conflicts?${q}`).then((c) => !cancelled && setConflicts(c)).catch(() => undefined);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantKey, range?.s.getTime(), range?.e.getTime(), range?.invalid, event?.id]);

  const busyList = users.filter((u) => conflicts[u.id]?.length);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!range) return setError('Completa las fechas del evento.');
    if (range.invalid) return setError('El fin no puede ser anterior al inicio.');
    setBusy(true);
    setError('');
    const body = {
      title,
      description,
      location,
      allDay,
      color,
      reminderMinutes: reminder,
      startAt: allDay ? `${start}T00:00:00.000Z` : fromLocalInput(start),
      endAt: allDay ? `${addDaysStr(end, 1)}T00:00:00.000Z` : fromLocalInput(end),
      participantIds: participants,
      externalContacts: externals.map((c) => (c.id ? { id: c.id } : { name: c.name, email: c.email })),
    };
    try {
      const saved = await api<CalendarEvent>(editing ? `/events/${event!.id}` : '/events', { method: editing ? 'PATCH' : 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const dateType = allDay ? 'date' : 'datetime-local';

  return (
    <Dialog variant="form" labelledBy={headingId} onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-3 sm:px-6">
        <h2 id={headingId} className="text-base font-semibold tracking-tight">{editing ? 'Editar evento' : 'Nuevo evento'}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
      </div>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <Field label="Título">
            {(p) => <input {...p} autoFocus required maxLength={300} className="w-full" placeholder="Por ejemplo, Reunión de seguimiento" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>

          <div className="space-y-3">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
              Todo el día
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Inicio">
                {(p) => <input {...p} type={dateType} required className="w-full" value={start} onChange={(e) => changeStart(e.target.value)} />}
              </Field>
              <Field label="Fin" error={range?.invalid ? 'El fin no puede ser anterior al inicio.' : undefined}>
                {(p) => <input {...p} type={dateType} required min={start || undefined} className="w-full" value={end} onChange={(e) => setEnd(e.target.value)} />}
              </Field>
            </div>
          </div>

          <Field label="Participantes">
            {(p) => <AssigneePicker id={p.id} users={users} value={participants} onCommit={setParticipants} placeholder="Sin participantes" />}
          </Field>
          {busyList.length > 0 && (
            <div role="status" className="-mt-2 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {busyList.map((u) => (
                <p key={u.id} className="flex items-start gap-1.5">
                  <Clock {...icon} size={14} className="mt-px shrink-0" />
                  <span><strong className="font-medium">{u.name}</strong> ya tiene {conflicts[u.id].map((c) => `«${c.title}» (${eventClock({ ...c, allDay: false })})`).join(', ')}</span>
                </p>
              ))}
            </div>
          )}

          <Field label="Personas externas" hint="Solo para seguimiento; no recibe correos.">
            {(p) => <ContactPicker id={p.id} value={externals} onChange={setExternals} />}
          </Field>

          <Field label="Lugar">
            {(p) => <input {...p} maxLength={300} className="w-full" placeholder="Sala, enlace o dirección" value={location} onChange={(e) => setLocation(e.target.value)} />}
          </Field>
          <Field label="Descripción">
            {(p) => <textarea {...p} rows={3} className="w-full resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Recordatorio" hint="Por correo, solo a los participantes del equipo.">
              {(p) => (
                <select {...p} className="w-full" value={reminder ?? ''} onChange={(e) => setReminder(e.target.value ? Number(e.target.value) : null)}>
                  {REMINDERS.map((r) => <option key={r.label} value={r.value ?? ''}>{r.label}</option>)}
                </select>
              )}
            </Field>
            <div>
              <span id={`${headingId}-color`} className="mb-1 block text-xs text-zinc-600">Color</span>
              <div role="radiogroup" aria-labelledby={`${headingId}-color`} className="flex h-9 items-center gap-2">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={color === c.id}
                    aria-label={c.label}
                    title={c.label}
                    onClick={() => setColor(c.id)}
                    className={`ev-c-${c.id} flex h-7 w-7 items-center justify-center rounded-full border transition-shadow ${color === c.id ? 'border-zinc-900 shadow-[0_0_0_2px_#fff_inset]' : 'border-transparent hover:border-zinc-300'}`}
                    style={{ background: 'var(--ev-dot)' }}
                  >
                    {color === c.id && <Check size={14} strokeWidth={2} aria-hidden className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn-accent" disabled={busy || !title.trim()}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear evento'}</button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
