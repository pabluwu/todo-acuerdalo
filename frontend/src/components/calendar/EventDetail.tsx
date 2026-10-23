'use client';

import { Bell, CalendarClock, MapPin, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { formatDate } from '@/lib/api';
import { eventWhen, reminderLabel } from '@/lib/calendar';
import { icon } from '@/lib/icons';
import type { CalendarEvent } from '@/lib/types';
import { Avatar } from '../Avatar';
import { Dialog } from '../Dialog';
import { PanelSkeleton } from '../Skeletons';
import { ExternalTag } from './ContactPicker';

export function EventDetail({
  event,
  colorKey,
  canEdit,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent | null;
  colorKey: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const headingId = useId();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try { await onDelete(); } finally { setBusy(false); }
  }

  return (
    <Dialog variant="sheet" labelledBy={headingId} onClose={onClose}>
      <h2 id={headingId} className="sr-only">{event ? `Evento: ${event.title}` : 'Cargando evento'}</h2>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-100 bg-white py-2.5 pl-6 pr-3 sm:pl-8">
        <span className="min-w-0 truncate text-xs tabular-nums text-zinc-500">
          {event ? `Creado ${formatDate(event.createdAt)}${event.createdBy ? ` por ${event.createdBy.name}` : ''}` : ''}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {event && canEdit && <button type="button" className="btn btn-sm" onClick={onEdit}><Pencil {...icon} /> Editar</button>}
          <button onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon"><X {...icon} /></button>
        </div>
      </div>
      {!event ? (
        <PanelSkeleton />
      ) : (
        <div className="space-y-7 px-6 py-6 sm:px-8">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className={`ev-c-${colorKey} mt-2`}><span className="cal-dot" /></span>
              <h3 className="min-w-0 break-words text-xl font-semibold leading-snug tracking-tight text-balance">{event.title}</h3>
            </div>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li className="flex items-start gap-2.5"><CalendarClock {...icon} className="mt-0.5 shrink-0 text-zinc-400" /><span className="first-letter:uppercase">{eventWhen(event)}</span></li>
              {event.location && <li className="flex items-start gap-2.5"><MapPin {...icon} className="mt-0.5 shrink-0 text-zinc-400" /><span className="min-w-0 break-words">{event.location}</span></li>}
              {event.reminderMinutes && <li className="flex items-start gap-2.5"><Bell {...icon} className="mt-0.5 shrink-0 text-zinc-400" /><span>{reminderLabel(event.reminderMinutes)}</span></li>}
            </ul>
            {event.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">{event.description}</p>}
          </div>

          <section className="space-y-2.5">
            <h3 className="section-label">Participantes (<span className="tabular-nums">{event.participants.length}</span>)</h3>
            {event.participants.length === 0 ? (
              <p className="text-sm text-zinc-500">Nadie más participa en este evento.</p>
            ) : (
              <ul className="space-y-2">
                {event.participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 text-sm">
                    <Avatar name={p.name} decorative />
                    <span className="font-medium text-zinc-800">{p.name}</span>
                    <span className="min-w-0 truncate text-xs text-zinc-500">{p.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {event.externalContacts.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="section-label">Clientes y personas externas (<span className="tabular-nums">{event.externalContacts.length}</span>)</h3>
              <ul className="space-y-2">
                {event.externalContacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm">
                    {c.clientId ? (
                      <Link href={`/clients/${c.clientId}`} className="font-medium text-accent hover:underline">{c.name}</Link>
                    ) : (
                      <span className="font-medium text-zinc-800">{c.name}</span>
                    )}
                    <ExternalTag client={!!c.clientId} />
                    {c.email && <span className="min-w-0 break-all text-xs text-zinc-500">{c.email}</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-zinc-500">Solo para seguimiento; no recibe correos.</p>
            </section>
          )}

          {canEdit ? (
            <div className="border-t border-zinc-100 pt-6">
              {confirm ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-zinc-700">¿Eliminar este evento? Se avisará a los participantes.</span>
                  <button className="btn-danger" disabled={busy} onClick={remove}><Trash2 {...icon} /> Sí, eliminar</button>
                  <button className="btn" onClick={() => setConfirm(false)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn-ghost -ml-3 hover:!bg-red-50 hover:!text-red-700" onClick={() => setConfirm(true)}><Trash2 {...icon} /> Eliminar evento</button>
              )}
            </div>
          ) : (
            <p className="border-t border-zinc-100 pt-6 text-xs text-zinc-500">
              Solo {event.createdBy ? event.createdBy.name : 'quien lo creó'} o un administrador puede modificar este evento.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
