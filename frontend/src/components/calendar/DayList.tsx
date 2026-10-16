'use client';

import { CheckSquare, MapPin, Plus } from 'lucide-react';
import { eventClock, parseLocalDate } from '@/lib/calendar';
import { icon } from '@/lib/icons';
import type { CalendarEvent, Task } from '@/lib/types';
import { Avatar } from '../Avatar';

/** Lista de los eventos de un día: lo que reemplaza al detalle del mes en pantallas estrechas. */
export function DayList({
  day,
  events,
  tasks,
  colorOf,
  onOpenEvent,
  onOpenTask,
  onCreate,
}: {
  day: string;
  events: CalendarEvent[];
  tasks: Task[];
  colorOf: (e: CalendarEvent) => string;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onCreate: () => void;
}) {
  const label = parseLocalDate(day)!.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const empty = events.length === 0 && tasks.length === 0;
  return (
    <section aria-label={`Eventos del ${label}`} className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-900 first-letter:uppercase">{label}</h2>
        <button type="button" className="btn btn-sm" onClick={onCreate}><Plus {...icon} /> Crear evento</button>
      </div>
      {empty ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">Sin eventos este día.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {events.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onOpenEvent(e.id)} className={`ev-c-${colorOf(e)} flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-zinc-50`}>
                <span className="w-[5.5rem] shrink-0 pt-px text-xs tabular-nums text-zinc-600">{eventClock(e)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2"><span className="cal-dot mt-1.5" /><span className="min-w-0 break-words text-sm font-medium text-zinc-900">{e.title}</span></span>
                  {e.location && <span className="mt-0.5 flex items-center gap-1 pl-4 text-xs text-zinc-500"><MapPin size={12} strokeWidth={1.5} aria-hidden /> <span className="truncate">{e.location}</span></span>}
                </span>
                <span className="flex shrink-0 -space-x-1.5 pt-0.5">
                  {e.participants.slice(0, 3).map((p) => <Avatar key={p.id} name={p.name} />)}
                </span>
              </button>
            </li>
          ))}
          {tasks.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onOpenTask(t.id)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-zinc-50">
                <span className="w-[5.5rem] shrink-0 pt-px text-xs text-zinc-500">Tarea</span>
                <span className="flex min-w-0 flex-1 items-start gap-2 text-sm text-zinc-700"><CheckSquare {...icon} className="mt-0.5 shrink-0 text-zinc-400" /><span className={`min-w-0 break-words ${t.status === 'completed' ? 'line-through' : ''}`}>{t.title}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
