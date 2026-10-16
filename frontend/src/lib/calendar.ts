import type { CalendarEvent } from './types';

/**
 * Colores de evento y de persona. Las clases `ev-c-*` viven en globals.css
 * y definen --ev-bg, --ev-bd, --ev-fg y --ev-dot.
 */
export const EVENT_COLORS = [
  { id: 'accent', label: 'Índigo' },
  { id: 'emerald', label: 'Verde' },
  { id: 'amber', label: 'Ámbar' },
  { id: 'rose', label: 'Rosa' },
  { id: 'sky', label: 'Celeste' },
  { id: 'zinc', label: 'Gris' },
] as const;

/** Colores para distinguir agendas cuando hay varias personas seleccionadas. */
export const PERSON_COLORS = ['accent', 'emerald', 'amber', 'rose', 'sky', 'violet', 'orange', 'teal'] as const;

export const REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: 'Sin recordatorio' },
  { value: 5, label: '5 minutos antes' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' },
];

export type CalView = 'month' | 'week' | 'day';

export const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd en hora local */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

/** Los eventos de día completo se guardan como medianoche UTC con fin exclusivo. */
export function utcDayIso(localDay: Date): string {
  return new Date(Date.UTC(localDay.getFullYear(), localDay.getMonth(), localDay.getDate())).toISOString();
}
export const utcDateStr = (iso: string) => iso.slice(0, 10);

export function addDaysStr(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const longDay = (d: Date, tz?: 'UTC') =>
  d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', ...(tz ? { timeZone: tz } : {}) });

/** Texto legible del horario de un evento, en la hora local del navegador. */
export function eventWhen(e: Pick<CalendarEvent, 'startAt' | 'endAt' | 'allDay'>): string {
  const s = new Date(e.startAt);
  const en = new Date(e.endAt);
  if (e.allDay) {
    const last = new Date(Math.max(s.getTime(), en.getTime() - 1));
    const a = longDay(s, 'UTC');
    const b = longDay(last, 'UTC');
    return a === b ? `${a} · todo el día` : `${a} – ${b}`;
  }
  const sameDay = localDateStr(s) === localDateStr(en);
  return sameDay
    ? `${longDay(s)} · ${timeStr(s)} – ${timeStr(en)}`
    : `${longDay(s)} ${timeStr(s)} – ${longDay(en)} ${timeStr(en)}`;
}

/** Hora corta para listas: "10:00 – 11:00" o "Todo el día". */
export function eventClock(e: Pick<CalendarEvent, 'startAt' | 'endAt' | 'allDay'>): string {
  if (e.allDay) return 'Todo el día';
  return `${timeStr(new Date(e.startAt))} – ${timeStr(new Date(e.endAt))}`;
}

/** ¿El evento toca el día local `day` (yyyy-mm-dd)? */
export function eventOnDay(e: Pick<CalendarEvent, 'startAt' | 'endAt' | 'allDay'>, day: string): boolean {
  if (e.allDay) return utcDateStr(e.startAt) <= day && day < utcDateStr(e.endAt);
  const start = parseLocalDate(day)!;
  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  const s = new Date(e.startAt).getTime();
  const en = new Date(e.endAt).getTime();
  return s < next.getTime() && (en > start.getTime() || (s === en && s >= start.getTime()));
}

export function reminderLabel(min: number | null): string {
  return REMINDERS.find((r) => r.value === min)?.label ?? 'Sin recordatorio';
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
