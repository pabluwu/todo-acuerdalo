/**
 * Generador mínimo de invitaciones iCalendar (RFC 5545) para los correos de eventos.
 * Solo se incluyen usuarios internos como ATTENDEE: los contactos externos nunca
 * aparecen, así ningún cliente de calendario les envía nada.
 */

export type IcsMethod = 'REQUEST' | 'CANCEL';

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  url?: string;
  organizer: { name: string; email: string };
  attendees: { name: string; email: string }[];
}

/** Escapa TEXT según RFC 5545 §3.3.11. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Pliega líneas a 75 octetos sin partir caracteres UTF-8 (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch, 'utf8');
    const limit = out.length === 0 ? 75 : 74; // las continuaciones empiezan con un espacio
    if (bytes + len > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += len;
  }
  out.push(current);
  return out.join('\r\n ');
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Quita comillas y caracteres que romperían un parámetro CN. */
function cn(name: string): string {
  return `"${name.replace(/["\r\n]/g, '')}"`;
}

export function buildIcs(e: IcsEvent, method: IcsMethod, now = new Date()): string {
  const start = new Date(e.startAt);
  const end = new Date(e.endAt);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Acuerdalo//Calendario//ES',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    // SEQUENCE creciente para que los clientes apliquen cambios y cancelaciones sobre la misma invitación
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    ...(e.allDay
      ? [`DTSTART;VALUE=DATE:${utcDate(start)}`, `DTEND;VALUE=DATE:${utcDate(end > start ? end : new Date(start.getTime() + 86_400_000))}`]
      : [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`]),
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    `ORGANIZER;CN=${cn(e.organizer.name)}:mailto:${e.organizer.email}`,
    ...e.attendees.map((a) => `ATTENDEE;CN=${cn(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${a.email}`),
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Extrae nombre y correo de un remitente tipo `Nombre <correo@dominio>`. */
export function parseAddress(from: string, fallbackEmail: string): { name: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || 'Acuérdalo', email: m[2].trim() };
  const email = from.includes('@') ? from.trim() : fallbackEmail;
  return { name: 'Acuérdalo', email };
}
