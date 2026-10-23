import { applyStatusDates } from './task-changes';

describe('applyStatusDates', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const earlier = new Date('2026-10-01T12:00:00Z');

  it('al pasar a en progreso marca el inicio y limpia el cierre', () => {
    const t = { startedAt: null as Date | null, completedAt: earlier as Date | null };
    applyStatusDates(t, 'in_progress', now);
    expect(t).toEqual({ startedAt: now, completedAt: null });
  });

  it('al completar marca el cierre y conserva el inicio', () => {
    const t = { startedAt: earlier as Date | null, completedAt: null as Date | null };
    applyStatusDates(t, 'completed', now);
    expect(t).toEqual({ startedAt: earlier, completedAt: now });
  });

  it('completar sin haber iniciado deja el inicio en null', () => {
    const t = { startedAt: null as Date | null, completedAt: null as Date | null };
    applyStatusDates(t, 'completed', now);
    expect(t).toEqual({ startedAt: null, completedAt: now });
  });

  it('volver a sin iniciar limpia ambas marcas', () => {
    const t = { startedAt: earlier as Date | null, completedAt: now as Date | null };
    applyStatusDates(t, 'not_started', now);
    expect(t).toEqual({ startedAt: null, completedAt: null });
  });
});
