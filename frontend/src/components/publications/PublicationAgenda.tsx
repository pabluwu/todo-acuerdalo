'use client';

import { CalendarPlus, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { useRef } from 'react';
import { addDaysStr, localDateStr, parseLocalDate } from '@/lib/calendar';
import { icon } from '@/lib/icons';
import type { PublicationSummary } from '@/lib/types';
import { EmptyState } from '../EmptyState';
import { weekStartOf } from '../calendar/AgendaView';
import { PubRow } from './PubBits';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const dayOf = (p: PublicationSummary) => localDateStr(new Date(p.scheduledAt));

function dayHeading(day: string, today: string): string {
  if (day === today) return 'Hoy';
  if (day === addDaysStr(today, 1)) return 'Mañana';
  if (day === addDaysStr(today, -1)) return 'Ayer';
  return parseLocalDate(day)!.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
}
const shortDay = (day: string) => parseLocalDate(day)!.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

type Block = { kind: 'day'; day: string; items: PublicationSummary[] } | { kind: 'gap'; from: string; to: string };

/**
 * Agenda de publicaciones agrupada por día.
 * Con `strip` (móvil): tira de la semana para saltar de día y días vacíos plegados.
 * Sin `strip` (lista de escritorio): solo los días con publicaciones.
 */
export function PublicationAgenda({
  items,
  loaded,
  strip = false,
  selectedDay,
  days = 14,
  onSelectDay,
  onMore,
  onCreate,
}: {
  items: PublicationSummary[];
  loaded: boolean;
  strip?: boolean;
  selectedDay?: string;
  days?: number;
  onSelectDay?: (day: string) => void;
  onMore?: () => void;
  onCreate: (day?: string) => void;
}) {
  const today = localDateStr(new Date());
  const sorted = [...items].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const byDay = (day: string) => sorted.filter((p) => dayOf(p) === day);

  const blocks: Block[] = [];
  if (strip && selectedDay) {
    for (let i = 0; i < days; i++) {
      const day = addDaysStr(selectedDay, i);
      const list = byDay(day);
      if (list.length || day === selectedDay) blocks.push({ kind: 'day', day, items: list });
      else {
        const last = blocks[blocks.length - 1];
        if (last?.kind === 'gap') last.to = day; else blocks.push({ kind: 'gap', from: day, to: day });
      }
    }
  } else {
    for (const day of [...new Set(sorted.map(dayOf))]) blocks.push({ kind: 'day', day, items: byDay(day) });
  }
  const nothing = loaded && sorted.length === 0;

  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = touch.current;
      touch.current = null;
      if (!s || !selectedDay) return;
      const dx = e.changedTouches[0].clientX - s.x;
      if (Math.abs(dx) > 60 && Math.abs(e.changedTouches[0].clientY - s.y) < 45) onSelectDay?.(addDaysStr(selectedDay, dx < 0 ? 7 : -7));
    },
  };

  const week = selectedDay ? weekStartOf(selectedDay) : null;
  const stripDays = week ? Array.from({ length: 7 }, (_, i) => addDaysStr(week, i)) : [];

  return (
    <div>
      {strip && selectedDay && (
        <div {...swipe} className="card-surface mb-5 p-2">
          <div className="mb-1 flex items-center justify-between px-1">
            <button type="button" className="btn-ghost btn-icon btn-sm" aria-label="Semana anterior" onClick={() => onSelectDay?.(addDaysStr(selectedDay, -7))}><ChevronLeft {...icon} /></button>
            <span className="text-xs font-medium tabular-nums text-zinc-500">{shortDay(stripDays[0])} – {shortDay(stripDays[6])}</span>
            <button type="button" className="btn-ghost btn-icon btn-sm" aria-label="Semana siguiente" onClick={() => onSelectDay?.(addDaysStr(selectedDay, 7))}><ChevronRight {...icon} /></button>
          </div>
          <div role="group" aria-label="Días de la semana" className="grid grid-cols-7 gap-1">
            {stripDays.map((day, i) => {
              const sel = day === selectedDay;
              const isToday = day === today;
              const dots = byDay(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={sel}
                  aria-label={`${parseLocalDate(day)!.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}${dots.length ? `, ${dots.length} ${dots.length === 1 ? 'publicación' : 'publicaciones'}` : ''}`}
                  onClick={() => onSelectDay?.(day)}
                  className={`flex min-h-16 flex-col items-center gap-1 rounded-xl py-2 transition-colors ${sel ? 'bg-accent text-white' : 'hover:bg-zinc-50'}`}
                >
                  <span className={`text-[11px] font-medium ${sel ? 'text-white/80' : isToday ? 'text-accent' : 'text-zinc-500'}`}>{DOW[i]}</span>
                  <span className={`text-base font-semibold tabular-nums leading-none ${sel ? '' : isToday ? 'text-accent' : 'text-zinc-800'}`}>{parseLocalDate(day)!.getDate()}</span>
                  <span aria-hidden className="flex h-1.5 gap-0.5">
                    {dots.slice(0, 3).map((p) => (
                      <span key={p.id} className={`pub-c-${p.status} h-1.5 w-1.5 rounded-full ${sel ? 'bg-white' : 'bg-[var(--ev-dot)]'}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {nothing && !strip ? (
        <EmptyState
          icon={Megaphone}
          title="Aún no hay publicaciones planificadas"
          action={<button type="button" className="btn-accent" onClick={() => onCreate()}><CalendarPlus {...icon} /> Nueva publicación</button>}
        >
          Crea una idea, sube las versiones y el equipo la revisa antes de publicar.
        </EmptyState>
      ) : nothing && strip ? (
        <EmptyState
          icon={Megaphone}
          title={`Nada planificado hasta el ${shortDay(addDaysStr(selectedDay!, days - 1))}`}
          action={<button type="button" className="btn-accent" onClick={() => onCreate(selectedDay)}><CalendarPlus {...icon} /> Nueva publicación</button>}
        >
          Crea una idea para este día y el equipo la revisa antes de publicar.
        </EmptyState>
      ) : (
        <ol aria-busy={!loaded} className="space-y-5">
          {blocks.map((b) => b.kind === 'gap' ? (
            <li key={`gap-${b.from}`} className="flex items-center gap-3 px-1 text-xs text-zinc-500">
              <span className="h-px flex-1 bg-zinc-200" />
              {b.from === b.to ? `${dayHeading(b.from, today)} sin publicaciones` : `${shortDay(b.from)} – ${shortDay(b.to)} sin publicaciones`}
              <span className="h-px flex-1 bg-zinc-200" />
            </li>
          ) : (
            <li key={b.day}>
              <div className={`mb-2 flex items-center justify-between ${strip ? 'sticky top-14 z-10 -mx-4 bg-stone-50/95 px-5 py-1.5 backdrop-blur' : ''}`}>
                <h2 className={`text-sm font-semibold first-letter:uppercase ${b.day === today ? 'text-accent' : 'text-zinc-800'}`}>
                  {dayHeading(b.day, today)}
                  {(b.day === today || b.day === addDaysStr(today, 1) || b.day === addDaysStr(today, -1)) && <span className="ml-1.5 font-normal text-zinc-500">{shortDay(b.day)}</span>}
                </h2>
                <button type="button" className="btn-ghost btn-sm -mr-2 text-accent" onClick={() => onCreate(b.day)} aria-label={`Nueva publicación el ${shortDay(b.day)}`}><CalendarPlus {...icon} /></button>
              </div>
              {b.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-4 text-center text-sm text-zinc-500">{loaded ? 'Nada planificado este día.' : 'Cargando…'}</p>
              ) : (
                <ul className="card-surface divide-y divide-zinc-100 overflow-hidden">
                  {b.items.map((p) => <li key={p.id}><PubRow pub={p} /></li>)}
                </ul>
              )}
            </li>
          ))}
          {strip && onMore && (
            <li className="pt-1 text-center"><button type="button" className="btn" onClick={onMore}>Ver más días</button></li>
          )}
        </ol>
      )}
    </div>
  );
}
