'use client';

import { CheckSquare, MapPin } from 'lucide-react';
import { dueState } from '@/lib/api';
import { eventClock } from '@/lib/calendar';
import type { CalendarEvent, Task } from '@/lib/types';
import { Avatar } from '../Avatar';

/** Fila de evento para listas (agenda móvil): hora, color de la agenda, título, lugar y participantes. */
export function EventRow({ event: e, color, onOpen }: { event: CalendarEvent; color: string; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(e.id)} className={`ev-c-${color} flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-stone-50`}>
      <span aria-hidden className="mt-1.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--ev-dot)] ring-4 ring-[var(--ev-bg)]" />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-medium text-zinc-900">{e.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
          <span className="tabular-nums">{eventClock(e)}</span>
          {e.location && <span className="flex min-w-0 items-center gap-1"><MapPin size={12} strokeWidth={1.5} aria-hidden /> <span className="truncate">{e.location}</span></span>}
        </span>
      </span>
      {e.participants.length > 0 && (
        <span className="flex shrink-0 items-center -space-x-1">
          {e.participants.slice(0, 3).map((p) => <Avatar key={p.id} name={p.name} />)}
        </span>
      )}
    </button>
  );
}

export function TaskRow({ task: t, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const overdue = dueState(t) === 'overdue';
  return (
    <button type="button" onClick={() => onOpen(t.id)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-stone-50">
      <CheckSquare size={16} strokeWidth={1.5} aria-hidden className={`mt-0.5 shrink-0 ${overdue ? 'text-red-600' : 'text-zinc-400'}`} />
      <span className="min-w-0 flex-1">
        <span className={`block break-words text-sm ${t.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-800'}`}>{t.title}</span>
        <span className={`mt-0.5 block text-xs ${overdue ? 'font-medium text-red-700' : 'text-zinc-500'}`}>{overdue ? 'Tarea vencida' : 'Fecha límite de tarea'}</span>
      </span>
    </button>
  );
}
