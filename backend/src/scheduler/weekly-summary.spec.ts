import { buildUserSummary, isSummaryEmpty, SummarySourceTask, weekBounds } from './weekly-summary';

const TZ = 'America/Santiago';

describe('weekBounds', () => {
  it('en horario de verano de Chile (UTC-3) el lunes empieza a las 03:00Z', () => {
    // miércoles 2026-01-14 12:00Z
    const b = weekBounds(new Date('2026-01-14T12:00:00Z'), TZ);
    expect(b.thisStart.toISOString()).toBe('2026-01-12T03:00:00.000Z');
    expect(b.prevStart.toISOString()).toBe('2026-01-05T03:00:00.000Z');
    expect(b.nextStart.toISOString()).toBe('2026-01-19T03:00:00.000Z');
  });

  it('en horario de invierno (UTC-4) el lunes empieza a las 04:00Z', () => {
    // miércoles 2026-07-15 12:00Z
    const b = weekBounds(new Date('2026-07-15T12:00:00Z'), TZ);
    expect(b.thisStart.toISOString()).toBe('2026-07-13T04:00:00.000Z');
    expect(b.nextStart.toISOString()).toBe('2026-07-20T04:00:00.000Z');
  });

  it('el lunes a las 09:00 locales ya pertenece a la semana nueva', () => {
    const b = weekBounds(new Date('2026-10-19T12:00:00Z'), TZ); // lunes 09:00 en Santiago (UTC-3)
    expect(b.thisStart.toISOString()).toBe('2026-10-19T03:00:00.000Z');
  });

  it('el domingo por la noche local sigue en la semana anterior', () => {
    const b = weekBounds(new Date('2026-01-12T02:00:00Z'), TZ); // domingo 23:00 en Santiago
    expect(b.thisStart.toISOString()).toBe('2026-01-05T03:00:00.000Z');
  });

  it('maneja el cambio de horario dentro de la semana (abril, fin del verano)', () => {
    // el DST de Chile termina el sábado 2026-04-04 24:00 local; lunes 6 ya es UTC-4, lunes 30-mar aún UTC-3
    const b = weekBounds(new Date('2026-04-08T12:00:00Z'), TZ);
    expect(b.prevStart.toISOString()).toBe('2026-03-30T03:00:00.000Z');
    expect(b.thisStart.toISOString()).toBe('2026-04-06T04:00:00.000Z');
  });
});

describe('buildUserSummary', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const bounds = weekBounds(now, TZ);
  const d = (s: string) => new Date(s);
  const t = (id: string, over: Partial<SummarySourceTask> = {}): SummarySourceTask => ({
    id, title: id, status: 'not_started', priority: 'medium', dueDate: null, startedAt: null, completedAt: null,
    assignees: [{ id: 'u1' }], ...over,
  });

  it('solo cuenta cerradas la semana pasada', () => {
    const s = buildUserSummary('u1', [
      t('ok', { status: 'completed', completedAt: d('2026-10-14T15:00:00Z') }),
      t('antes', { status: 'completed', completedAt: d('2026-10-10T15:00:00Z') }),
      t('esta', { status: 'completed', completedAt: d('2026-10-19T10:00:00Z') }),
      t('sinfecha', { status: 'completed' }),
    ], bounds, now);
    expect(s.closed.map((x) => x.id)).toEqual(['ok']);
  });

  it('marca las iniciadas la semana pasada', () => {
    const s = buildUserSummary('u1', [
      t('a', { status: 'in_progress', startedAt: d('2026-10-15T15:00:00Z') }),
      t('b', { status: 'in_progress', startedAt: d('2026-09-01T15:00:00Z') }),
    ], bounds, now);
    expect(s.inProgress.find((x) => x.id === 'a')!.startedLastWeek).toBe(true);
    expect(s.inProgress.find((x) => x.id === 'b')!.startedLastWeek).toBe(false);
    expect(s.counts.startedLastWeek).toBe(1);
  });

  it('ordena por prioridad y luego por fecha, sin fecha al final', () => {
    const s = buildUserSummary('u1', [
      t('low', { priority: 'low' }),
      t('med-sin'),
      t('med-tarde', { dueDate: d('2026-11-30T00:00:00Z') }),
      t('med-pronto', { dueDate: d('2026-10-30T00:00:00Z') }),
      t('high', { priority: 'high' }),
    ], bounds, now);
    expect(s.pending.map((x) => x.id)).toEqual(['high', 'med-pronto', 'med-tarde', 'med-sin', 'low']);
  });

  it('marca vencidas y las que vencen esta semana', () => {
    const s = buildUserSummary('u1', [
      t('vencida', { dueDate: d('2026-10-18T00:00:00Z') }),
      t('semana', { dueDate: d('2026-10-23T00:00:00Z') }),
      t('lejos', { dueDate: d('2026-10-30T00:00:00Z') }),
    ], bounds, now);
    const by = (id: string) => s.pending.find((x) => x.id === id)!;
    expect(by('vencida').overdue).toBe(true);
    expect(by('vencida').dueThisWeek).toBe(false);
    expect(by('semana').dueThisWeek).toBe(true);
    expect(by('lejos').dueThisWeek).toBe(false);
    expect(s.counts.dueThisWeek).toBe(1);
  });

  it('filtra por asignación y soporta las tareas sin responsable', () => {
    const tasks = [t('mia'), t('otra', { assignees: [{ id: 'u2' }] }), t('nadie', { assignees: [] })];
    expect(buildUserSummary('u1', tasks, bounds, now).pending.map((x) => x.id)).toEqual(['mia']);
    expect(buildUserSummary(null, tasks, bounds, now).pending.map((x) => x.id)).toEqual(['nadie']);
    expect(isSummaryEmpty(buildUserSummary('u3', tasks, bounds, now))).toBe(true);
  });
});
