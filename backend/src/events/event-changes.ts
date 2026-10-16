import { CalendarEvent } from '../entities/event.entity';
import { User } from '../entities/user.entity';
import { Change } from '../tasks/task-changes';

export type Person = Pick<User, 'id' | 'email' | 'name' | 'isActive'>;

export interface EventSnapshot {
  title: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  participantIds: string[];
  participantNames: string[];
}

export function snapshotEvent(e: CalendarEvent): EventSnapshot {
  const participants = [...(e.participants ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  return {
    title: e.title,
    location: e.location ?? '',
    startAt: new Date(e.startAt).toISOString(),
    endAt: new Date(e.endAt).toISOString(),
    allDay: e.allDay,
    participantIds: participants.map((p) => p.id),
    participantNames: participants.map((p) => p.name),
  };
}

export function snapshotFromPayload(p: {
  title: string; location: string; startAt: string; endAt: string; allDay: boolean; participants: Person[];
}): EventSnapshot {
  const participants = [...p.participants].sort((a, b) => a.id.localeCompare(b.id));
  return {
    title: p.title,
    location: p.location ?? '',
    startAt: p.startAt,
    endAt: p.endAt,
    allDay: p.allDay,
    participantIds: participants.map((x) => x.id),
    participantNames: participants.map((x) => x.name),
  };
}

/** ¿Se solapan [aStart, aEnd) y [from, to)? Un evento de duración cero cuenta si cae dentro del rango. */
export function rangeOverlaps(aStart: Date, aEnd: Date, from: Date, to: Date): boolean {
  if (aStart.getTime() >= to.getTime()) return false;
  if (aEnd.getTime() === aStart.getTime()) return aStart.getTime() >= from.getTime();
  return aEnd.getTime() > from.getTime();
}

/**
 * Fecha y hora legibles en una zona horaria. Los eventos de día completo se guardan
 * como medianoche UTC con fin exclusivo, así que se muestran sin hora y en UTC.
 */
export function formatEventWhen(startIso: string, endIso: string, allDay: boolean, timeZone: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (allDay) {
    const day = (d: Date) => d.toLocaleDateString('es-ES', { dateStyle: 'full', timeZone: 'UTC' });
    const lastDay = new Date(Math.max(start.getTime(), end.getTime() - 1));
    const a = day(start);
    const b = day(lastDay);
    return a === b ? `${a} (todo el día)` : `${a} – ${b} (todo el día)`;
  }
  const date = (d: Date) => d.toLocaleDateString('es-ES', { dateStyle: 'full', timeZone });
  const time = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
  if (date(start) === date(end)) return `${date(start)}, ${time(start)} – ${time(end)}`;
  return `${date(start)}, ${time(start)} – ${date(end)}, ${time(end)}`;
}

/** Detecta qué campos que merecen aviso por correo cambiaron (título, horario, lugar, participantes). */
export function detectEventChanges(before: EventSnapshot, after: EventSnapshot, timeZone = 'UTC'): Change[] {
  const changes: Change[] = [];
  if (before.title !== after.title) changes.push({ field: 'title', label: 'Título', from: before.title, to: after.title });
  if (before.startAt !== after.startAt || before.endAt !== after.endAt || before.allDay !== after.allDay)
    changes.push({
      field: 'schedule',
      label: 'Fecha y hora',
      from: formatEventWhen(before.startAt, before.endAt, before.allDay, timeZone),
      to: formatEventWhen(after.startAt, after.endAt, after.allDay, timeZone),
    });
  if (before.location !== after.location)
    changes.push({ field: 'location', label: 'Lugar', from: before.location || 'Sin lugar', to: after.location || 'Sin lugar' });
  const same =
    before.participantIds.length === after.participantIds.length &&
    before.participantIds.every((id, i) => id === after.participantIds[i]);
  if (!same)
    changes.push({
      field: 'assignees',
      label: 'Participantes',
      from: before.participantNames.join(', ') || 'Nadie',
      to: after.participantNames.join(', ') || 'Nadie',
    });
  return changes;
}

/** Participantes recién añadidos. */
export function newlyAdded(before: EventSnapshot, afterParticipants: User[]): User[] {
  return afterParticipants.filter((u) => !before.participantIds.includes(u.id));
}

/**
 * Destinatarios de un aviso: SOLO usuarios internos (participantes y creador),
 * activos, sin duplicados y sin los excluidos. Quien hizo el cambio también
 * recibe el aviso si participa o es el creador.
 * Los contactos externos no entran nunca en esta función.
 */
export function computeEventRecipients(
  participants: Person[],
  creator: Person | null,
  excludeIds: string[] = [],
): Person[] {
  const map = new Map<string, Person>();
  for (const u of [...participants, ...(creator ? [creator] : [])]) {
    if (!u.isActive) continue;
    if (excludeIds.includes(u.id)) continue;
    map.set(u.id, u);
  }
  return [...map.values()];
}
