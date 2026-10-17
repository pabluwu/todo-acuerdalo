'use client';

import { CalendarPlus, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { addDaysStr, eventOnDay, localDateStr, parseLocalDate } from '@/lib/calendar';
import { icon } from '@/lib/icons';
import type { CalendarEvent, Task } from '@/lib/types';
import { EmptyState } from '../EmptyState';
import { EventRow, TaskRow } from './EventRows';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Lunes de la semana de `day`. */
export function weekStartOf(day: string): string {
  const d = parseLocalDate(day)!;
  return addDaysStr(day, -((d.getDay() + 6) % 7));
}

function dayHeading(day: string, today: string): string {
  if (day === today) return 'Hoy';
  if (day === addDaysStr(today, 1)) return 'Mañana';
  if (day === addDaysStr(today, -1)) return 'Ayer';
  return parseLocalDate(day)!.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
}
const shortDay = (day: string) => parseLocalDate(day)!.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

type Block = { kind: 'day'; day: string; events: CalendarEvent[]; tasks: Task[] } | { kind: 'gap'; from: string; to: string };

/**
 * Agenda móvil: tira de la semana para saltar de día y, debajo, la lista de lo que viene
 * agrupada por día. Los días vacíos consecutivos se pliegan en una sola línea.
 */
export function AgendaView({
  selectedDay,
  days,
  events,
  tasks,
  loaded,
  colorOf,
  onSelectDay,
  onMore,
  onOpenEvent,
  onOpenTask,
  onCreate,
}: {
  selectedDay: string;
  days: number;
  events: CalendarEvent[];
  tasks: Task[];
  loaded: boolean;
  colorOf: (e: CalendarEvent) => string;
  onSelectDay: (day: string) => void;
  onMore: () => void;
  onOpenEvent: (id: string) => void;
  onOpenTask: (id: string) => void;
  onCreate: (day: string) => void;
}) {
  const today = localDateStr(new Date());
  const week = weekStartOf(selectedDay);
  const strip = Array.from({ length: 7 }, (_, i) => addDaysStr(week, i));
  const taskDay = (t: Task) => localDateStr(new Date(t.dueDate!));
  const eventsOn = (day: string) => events.filter((e) => eventOnDay(e, day)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startAt.localeCompare(b.startAt));
  const tasksOn = (day: string) => tasks.filter((t) => taskDay(t) === day);

  const blocks: Block[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDaysStr(selectedDay, i);
    const evs = eventsOn(day);
    const ts = tasksOn(day);
    if (evs.length || ts.length || day === selectedDay) blocks.push({ kind: 'day', day, events: evs, tasks: ts });
    else {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'gap') last.to = day; else blocks.push({ kind: 'gap', from: day, to: day });
    }
  }
  const nothing = loaded && blocks.every((b) => b.kind === 'gap' || (b.events.length === 0 && b.tasks.length === 0));

  // deslizar la tira cambia de semana
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = touch.current;
      touch.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      if (Math.abs(dx) > 60 && Math.abs(e.changedTouches[0].clientY - s.y) < 45) onSelectDay(addDaysStr(selectedDay, dx < 0 ? 7 : -7));
    },
  };

  return (
    <div>
      <div {...swipe} className="card-surface mb-5 p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <button type="button" className="btn-ghost btn-icon btn-sm" aria-label="Semana anterior" onClick={() => onSelectDay(addDaysStr(selectedDay, -7))}><ChevronLeft {...icon} /></button>
          <span className="text-xs font-medium tabular-nums text-zinc-500">{shortDay(strip[0])} – {shortDay(strip[6])}</span>
          <button type="button" className="btn-ghost btn-icon btn-sm" aria-label="Semana siguiente" onClick={() => onSelectDay(addDaysStr(selectedDay, 7))}><ChevronRight {...icon} /></button>
        </div>
        <div role="group" aria-label="Días de la semana" className="grid grid-cols-7 gap-1">
          {strip.map((day, i) => {
            const sel = day === selectedDay;
            const isToday = day === today;
            const dots = [...eventsOn(day).map((e) => colorOf(e)), ...tasksOn(day).map(() => 'task')];
            return (
              <button
                key={day}
                type="button"
                aria-pressed={sel}
                aria-label={`${parseLocalDate(day)!.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}${dots.length ? `, ${dots.length} ${dots.length === 1 ? 'elemento' : 'elementos'}` : ''}`}
                onClick={() => onSelectDay(day)}
                className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-colors ${sel ? 'bg-accent text-white' : 'hover:bg-zinc-50'}`}
              >
                <span className={`text-[11px] font-medium ${sel ? 'text-white/80' : isToday ? 'text-accent' : 'text-zinc-500'}`}>{DOW[i]}</span>
                <span className={`text-base font-semibold tabular-nums leading-none ${sel ? '' : isToday ? 'text-accent' : 'text-zinc-800'}`}>{parseLocalDate(day)!.getDate()}</span>
                <span aria-hidden className="flex h-1.5 gap-0.5">
                  {dots.slice(0, 3).map((c, n) => (
                    <span key={n} className={`h-1.5 w-1.5 rounded-full ${sel ? 'bg-white' : c === 'task' ? 'ring-1 ring-inset ring-zinc-400' : `ev-c-${c} bg-[var(--ev-dot)]`}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {nothing ? (
        <EmptyState
          icon={CalendarRange}
          title={`Nada programado hasta el ${shortDay(addDaysStr(selectedDay, days - 1))}`}
          action={<button type="button" className="btn-accent" onClick={() => onCreate(selectedDay)}><CalendarPlus {...icon} /> Crear evento</button>}
        >
          Crea un evento o activa las tareas con fecha límite en los filtros.
        </EmptyState>
      ) : (
        <ol aria-busy={!loaded} className="space-y-5">
          {blocks.map((b) => b.kind === 'gap' ? (
            <li key={`gap-${b.from}`} className="flex items-center gap-3 px-1 text-xs text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200" />
              {b.from === b.to ? `${dayHeading(b.from, today)} sin eventos` : `${shortDay(b.from)} – ${shortDay(b.to)} sin eventos`}
              <span className="h-px flex-1 bg-zinc-200" />
            </li>
          ) : (
            <li key={b.day}>
              <div className="sticky top-14 z-10 -mx-4 mb-2 flex items-center justify-between bg-stone-50/95 px-5 py-1.5 backdrop-blur">
                <h2 className={`text-sm font-semibold first-letter:uppercase ${b.day === today ? 'text-accent' : 'text-zinc-800'}`}>
                  {dayHeading(b.day, today)}
                  {(b.day === today || b.day === addDaysStr(today, 1) || b.day === addDaysStr(today, -1)) && <span className="ml-1.5 font-normal text-zinc-500">{shortDay(b.day)}</span>}
                </h2>
                <button type="button" className="btn-ghost btn-sm -mr-2 text-accent" onClick={() => onCreate(b.day)} aria-label={`Crear evento el ${shortDay(b.day)}`}><CalendarPlus {...icon} /></button>
              </div>
              {b.events.length === 0 && b.tasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-4 text-center text-sm text-zinc-500">{loaded ? 'Nada programado este día.' : 'Cargando…'}</p>
              ) : (
                <ul className="card-surface divide-y divide-zinc-100 overflow-hidden">
                  {b.events.map((e) => <li key={e.id}><EventRow event={e} color={colorOf(e)} onOpen={onOpenEvent} /></li>)}
                  {b.tasks.map((t) => <li key={t.id}><TaskRow task={t} onOpen={onOpenTask} /></li>)}
                </ul>
              )}
            </li>
          ))}
          <li className="pt-1 text-center">
            <button type="button" className="btn" onClick={onMore}>Ver más días</button>
          </li>
        </ol>
      )}
    </div>
  );
}
