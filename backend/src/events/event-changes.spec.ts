import {
  computeEventRecipients, detectEventChanges, EventSnapshot, formatEventWhen, newlyAdded, rangeOverlaps, snapshotEvent,
} from './event-changes';

const u = (id: string, isActive = true) => ({ id, name: `User ${id}`, email: `${id}@t.com`, isActive });

const base: EventSnapshot = {
  title: 'Reunión', location: 'Sala 1', startAt: '2026-10-15T13:00:00.000Z', endAt: '2026-10-15T14:00:00.000Z',
  allDay: false, participantIds: ['a'], participantNames: ['User a'],
};

describe('detectEventChanges', () => {
  it('no detecta nada si no hay diferencias', () => {
    expect(detectEventChanges(base, { ...base })).toEqual([]);
  });

  it('detecta título, horario, lugar y participantes', () => {
    const after: EventSnapshot = {
      ...base, title: 'Otra', location: 'Zoom', startAt: '2026-10-16T13:00:00.000Z', endAt: '2026-10-16T14:00:00.000Z',
      participantIds: ['a', 'b'], participantNames: ['User a', 'User b'],
    };
    expect(detectEventChanges(base, after, 'America/Santiago').map((c) => c.field)).toEqual(['title', 'schedule', 'location', 'assignees']);
  });

  it('formatea el horario en la zona indicada', () => {
    const c = detectEventChanges(base, { ...base, startAt: '2026-10-15T15:00:00.000Z', endAt: '2026-10-15T16:00:00.000Z' }, 'America/Santiago');
    expect(c[0].from).toContain('10:00 – 11:00'); // 13:00Z = 10:00 en Santiago (UTC-3)
    expect(c[0].to).toContain('12:00 – 13:00');
  });

  it('detecta participantes nuevos', () => {
    expect(newlyAdded(base, [u('a'), u('b')] as any).map((x) => x.id)).toEqual(['b']);
  });
});

describe('computeEventRecipients', () => {
  it('une participantes y creador sin duplicados, incluido el autor', () => {
    const r = computeEventRecipients([u('a'), u('b'), u('c')], u('c'));
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('excluye inactivos y excluidos explícitos', () => {
    const r = computeEventRecipients([u('a', false), u('b')], u('c'), ['c']);
    expect(r.map((x) => x.id)).toEqual(['b']);
  });

  it('el creador recibe el aviso aunque sea quien hizo el cambio', () => {
    expect(computeEventRecipients([], u('c')).map((x) => x.id)).toEqual(['c']);
  });
});

describe('rangeOverlaps', () => {
  const d = (s: string) => new Date(s);
  const from = d('2026-10-15T00:00:00Z');
  const to = d('2026-10-16T00:00:00Z');
  it('detecta solapamiento parcial, contenido y envolvente', () => {
    expect(rangeOverlaps(d('2026-10-14T23:00:00Z'), d('2026-10-15T01:00:00Z'), from, to)).toBe(true);
    expect(rangeOverlaps(d('2026-10-15T10:00:00Z'), d('2026-10-15T11:00:00Z'), from, to)).toBe(true);
    expect(rangeOverlaps(d('2026-10-14T00:00:00Z'), d('2026-10-17T00:00:00Z'), from, to)).toBe(true);
  });
  it('los extremos que solo se tocan no se solapan', () => {
    expect(rangeOverlaps(d('2026-10-14T00:00:00Z'), from, from, to)).toBe(false);
    expect(rangeOverlaps(to, d('2026-10-17T00:00:00Z'), from, to)).toBe(false);
  });
  it('un evento de duración cero cuenta si cae dentro', () => {
    expect(rangeOverlaps(from, from, from, to)).toBe(true);
    expect(rangeOverlaps(to, to, from, to)).toBe(false);
  });
});

describe('formatEventWhen', () => {
  it('los eventos de todo el día se muestran por fecha, con fin exclusivo', () => {
    const s = formatEventWhen('2026-10-15T00:00:00.000Z', '2026-10-16T00:00:00.000Z', true, 'America/Santiago');
    expect(s).toContain('15 de octubre');
    expect(s).toContain('todo el día');
    expect(s).not.toContain('16 de octubre');
  });
});

describe('snapshotEvent', () => {
  it('ordena los participantes por id', () => {
    const s = snapshotEvent({ title: 'x', location: '', startAt: new Date(), endAt: new Date(), allDay: false, participants: [u('b'), u('a')] } as any);
    expect(s.participantIds).toEqual(['a', 'b']);
  });
});
