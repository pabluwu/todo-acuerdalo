import { buildIcs, escapeText, foldLine, parseAddress } from './ics';

const base = {
  uid: 'e1@todo.acuerdalo.cl',
  title: 'Reunión, con cliente; revisión',
  description: 'Línea 1\nLínea 2',
  location: 'Oficina',
  startAt: '2026-10-20T13:00:00.000Z',
  endAt: '2026-10-20T14:30:00.000Z',
  allDay: false,
  organizer: { name: 'Acuérdalo', email: 'contacto@acuerdalo.cl' },
  attendees: [{ name: 'Elena Ruiz', email: 'elena@acuerdalo.cl' }],
};
const now = new Date('2026-10-16T12:00:00Z');

describe('buildIcs', () => {
  it('genera una invitación REQUEST válida con CRLF', () => {
    const ics = buildIcs(base, 'REQUEST', now);
    expect(ics).toContain('METHOD:REQUEST\r\n');
    expect(ics).toContain('UID:e1@todo.acuerdalo.cl');
    expect(ics).toContain('DTSTART:20261020T130000Z');
    expect(ics).toContain('DTEND:20261020T143000Z');
    expect(ics).toContain('SUMMARY:Reunión\\, con cliente\\; revisión');
    expect(ics).toContain('DESCRIPTION:Línea 1\\nLínea 2');
    expect(ics).toContain('ATTENDEE;CN="Elena Ruiz"');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });

  it('usa fechas sin hora para eventos de día completo', () => {
    const ics = buildIcs({ ...base, allDay: true, startAt: '2026-10-20T00:00:00Z', endAt: '2026-10-21T00:00:00Z' }, 'REQUEST', now);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020');
    expect(ics).toContain('DTEND;VALUE=DATE:20261021');
  });

  it('marca la cancelación', () => {
    const ics = buildIcs(base, 'CANCEL', now);
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('solo lista los asistentes que recibe (nunca externos)', () => {
    const ics = buildIcs(base, 'REQUEST', now);
    expect(ics.match(/ATTENDEE/g)).toHaveLength(1);
  });
});

describe('helpers', () => {
  it('escapa texto', () => expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne'));

  it('pliega líneas largas sin superar 75 octetos', () => {
    const folded = foldLine('DESCRIPTION:' + 'á'.repeat(100));
    for (const l of folded.split('\r\n')) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true);
  });

  it('extrae el remitente', () => {
    expect(parseAddress('"Acuérdalo" <contacto@acuerdalo.cl>', 'x@y')).toEqual({ name: 'Acuérdalo', email: 'contacto@acuerdalo.cl' });
    expect(parseAddress('', 'fallback@acuerdalo.cl')).toEqual({ name: 'Acuérdalo', email: 'fallback@acuerdalo.cl' });
  });
});
