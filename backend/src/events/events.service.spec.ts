import { ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { EventsService } from './events.service';

const u = (id: string, isActive = true) => ({ id, name: `User ${id}`, email: `${id}@t.com`, isActive });
const EXTERNAL = { id: 'x1', name: 'Cliente Externo', email: 'cliente.externo@fuera.com' };

const creator: any = { id: 'c', email: 'c@t.com', name: 'Creadora', role: 'user' };
const admin: any = { id: 'adm', email: 'adm@t.com', name: 'Admin', role: 'admin' };
const other: any = { id: 'o', email: 'o@t.com', name: 'Otro', role: 'user' };

function makeEvent(over: any = {}) {
  return {
    id: 'e1', title: 'Reunión', description: '', location: 'Sala', color: 'accent', reminderMinutes: null, reminderSentAt: null,
    startAt: new Date('2026-10-15T13:00:00Z'), endAt: new Date('2026-10-15T14:00:00Z'), allDay: false,
    createdById: 'c', createdBy: u('c'), participants: [u('a')], externalContacts: [EXTERNAL],
    createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

function setup(event: any = makeEvent()) {
  const events: any = {
    findOne: jest.fn(async () => event),
    save: jest.fn(async (x) => ({ ...x, id: x.id ?? 'e1' })),
    create: jest.fn((x) => ({ ...x })),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const users: any = { find: jest.fn(async (opts: any) => [u('a'), u('b')].filter((x) => opts.where.id._value.includes(x.id))) };
  const contacts: any = { resolve: jest.fn(async () => [EXTERNAL]) };
  const audit: any = { log: jest.fn() };
  const emitter: any = { emit: jest.fn() };
  const svc = new EventsService(events, users, contacts, audit, emitter);
  return { svc, events, audit, emitter, event, contacts };
}

describe('EventsService permisos', () => {
  it('un usuario ajeno recibe 403 al editar, mover y eliminar', async () => {
    const { svc, events } = setup();
    await expect(svc.update('e1', { title: 'x' }, other)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.move('e1', { startAt: '2026-10-15T15:00:00Z', endAt: '2026-10-15T16:00:00Z', allDay: false }, other)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.remove('e1', other)).rejects.toBeInstanceOf(ForbiddenException);
    expect(events.save).not.toHaveBeenCalled();
    expect(events.delete).not.toHaveBeenCalled();
  });

  it('el creador y un admin sí pueden', async () => {
    const a = setup();
    await expect(a.svc.update('e1', { title: 'Nuevo' }, creator)).resolves.toBeDefined();
    const b = setup();
    await expect(b.svc.remove('e1', admin)).resolves.toEqual({ ok: true });
  });
});

describe('EventsService auditoría y avisos', () => {
  it('mover registra event.move, reinicia el recordatorio y emite event.changed', async () => {
    const { svc, audit, emitter, event } = setup(makeEvent({ reminderMinutes: 15, reminderSentAt: new Date() }));
    await svc.move('e1', { startAt: '2026-10-15T15:00:00Z', endAt: '2026-10-15T16:00:00Z', allDay: false }, creator);
    expect(event.reminderSentAt).toBeNull();
    expect(audit.log).toHaveBeenCalledWith(creator, 'event.move', 'event', 'e1', expect.anything(), expect.anything());
    expect(emitter.emit.mock.calls.map((c: any[]) => c[0])).toEqual(['event.changed']);
  });

  it('eliminar registra event.delete y emite event.cancelled', async () => {
    const { svc, audit, emitter } = setup();
    await svc.remove('e1', creator);
    expect(audit.log).toHaveBeenCalledWith(creator, 'event.delete', 'event', 'e1', expect.anything(), null);
    expect(emitter.emit.mock.calls[0][0]).toBe('event.cancelled');
  });

  it('rechaza un fin anterior al inicio', async () => {
    const { svc } = setup();
    await expect(svc.update('e1', { startAt: '2026-10-15T15:00:00Z', endAt: '2026-10-15T14:00:00Z' }, creator)).rejects.toThrow(/fin/);
  });

  it('no emite nada si solo cambia la descripción', async () => {
    const { svc, emitter, audit } = setup();
    await svc.update('e1', { description: 'nueva' }, creator);
    expect(emitter.emit).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalled();
  });
});

describe('EventsService.list', () => {
  it('filtra por solapamiento de rango y por participante o creador', async () => {
    const qb: any = {};
    for (const m of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy']) qb[m] = jest.fn(() => qb);
    qb.getMany = jest.fn(async () => []);
    const { svc, events } = setup();
    events.createQueryBuilder.mockReturnValue(qb);
    const id = '11111111-1111-4111-8111-111111111111';
    await svc.list({ from: '2026-10-12T00:00:00Z', to: '2026-10-19T00:00:00Z', userIds: id }, creator);
    expect(qb.where.mock.calls[0][0]).toContain('e.start_at < :to');
    expect(qb.where.mock.calls[0][0]).toContain('e.end_at > :from');
    const filter = qb.andWhere.mock.calls[0];
    expect(filter[0]).toContain('event_participants');
    expect(filter[0]).toContain('e.created_by IN');
    expect(filter[1]).toEqual({ uids: [id] });
  });

  it('mine=true usa al usuario actual', async () => {
    const qb: any = {};
    for (const m of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy']) qb[m] = jest.fn(() => qb);
    qb.getMany = jest.fn(async () => []);
    const { svc, events } = setup();
    events.createQueryBuilder.mockReturnValue(qb);
    await svc.list({ from: '2026-10-12T00:00:00Z', to: '2026-10-19T00:00:00Z', mine: 'true' }, creator);
    expect(qb.andWhere.mock.calls[0][1]).toEqual({ uids: ['c'] });
  });

  it('rechaza identificadores que no son UUID', async () => {
    const { svc } = setup();
    await expect(svc.list({ from: '2026-10-12T00:00:00Z', to: '2026-10-19T00:00:00Z', userIds: "x') OR 1=1 --" }, creator)).rejects.toThrow();
  });
});

describe('Los contactos externos NUNCA reciben correo', () => {
  function mailSetup() {
    const sent: { to: string; subject: string; html: string; cc?: string[] }[] = [];
    const mail: any = { send: jest.fn(async (to: string, subject: string, html: string, _invite?: unknown, cc?: string[]) => { sent.push({ to, subject, html, cc }); return true; }) };
    const notifications = new NotificationsService(mail, { get: (_k: string, d: any) => d } as any, { findOne: jest.fn(async () => ({ copyEmails: [] })) } as any);
    return { sent, notifications };
  }

  /** Reenvía a NotificationsService exactamente lo que EventsService emite. */
  function wire(emitter: any, notifications: NotificationsService) {
    const handlers: Record<string, (p: any) => Promise<void>> = {
      'event.invited': (p) => notifications.onEventInvited(p),
      'event.changed': (p) => notifications.onEventChanged(p),
      'event.cancelled': (p) => notifications.onEventCancelled(p),
      'event.reminder': (p) => notifications.onEventReminder(p),
    };
    const pending: Promise<void>[] = [];
    emitter.emit.mockImplementation((name: string, payload: any) => {
      // la carga útil no puede contener a los externos
      expect(JSON.stringify(payload)).not.toContain(EXTERNAL.email);
      expect(JSON.stringify(payload)).not.toContain('externalContacts');
      pending.push(handlers[name](payload));
    });
    return () => Promise.all(pending);
  }

  it('invitar, cambiar, cancelar y recordar solo escribe a usuarios internos', async () => {
    const { sent, notifications } = mailSetup();
    const ctx = setup(makeEvent({ participants: [u('a'), u('b')], reminderMinutes: 15 }));
    const flush = wire(ctx.emitter, notifications);

    await ctx.svc.create({ title: 'Con cliente', startAt: '2026-10-15T13:00:00Z', endAt: '2026-10-15T14:00:00Z', participantIds: ['a', 'b'], externalContacts: [{ name: EXTERNAL.name, email: EXTERNAL.email }] }, creator);
    await ctx.svc.update('e1', { participantIds: ['a', 'b'], location: 'Zoom' }, creator);
    await ctx.svc.move('e1', { startAt: '2026-10-15T15:00:00Z', endAt: '2026-10-15T16:00:00Z', allDay: false }, creator);
    await ctx.svc.remove('e1', creator);

    // recordatorio desde el planificador
    const qb: any = {};
    for (const m of ['leftJoinAndSelect', 'where', 'andWhere', 'update', 'set']) qb[m] = jest.fn(() => qb);
    qb.getMany = jest.fn(async () => [makeEvent({ participants: [u('a'), u('b')], reminderMinutes: 15 })]);
    qb.execute = jest.fn(async () => ({ affected: 1 }));
    const repo: any = { createQueryBuilder: jest.fn(() => qb) };
    const sched = new SchedulerService({} as any, repo, ctx.emitter, ctx.audit, {} as any, { get: (_k: string, d: any) => d } as any);
    await sched.runEventReminders(new Date('2026-10-15T12:50:00Z'));
    await flush();

    expect(sent.length).toBeGreaterThan(0);
    for (const m of sent) {
      expect(m.to).not.toBe(EXTERNAL.email);
      expect(m.html).not.toContain(EXTERNAL.email);
      expect(m.html).not.toContain(EXTERNAL.name);
    }
    expect(new Set(sent.map((m) => m.to))).toEqual(new Set(['a@t.com', 'b@t.com', 'c@t.com']));
  });

  it('el recordatorio se envía una sola vez (reclamo atómico)', async () => {
    const qb: any = {};
    for (const m of ['leftJoinAndSelect', 'where', 'andWhere', 'update', 'set']) qb[m] = jest.fn(() => qb);
    qb.getMany = jest.fn(async () => [makeEvent({ reminderMinutes: 5 })]);
    qb.execute = jest.fn().mockResolvedValueOnce({ affected: 1 }).mockResolvedValueOnce({ affected: 0 });
    const repo: any = { createQueryBuilder: jest.fn(() => qb) };
    const emitter: any = { emit: jest.fn() };
    const sched = new SchedulerService({} as any, repo, emitter, { log: jest.fn() } as any, {} as any, { get: (_k: string, d: any) => d } as any);
    await sched.runEventReminders(new Date('2026-10-15T12:56:00Z'));
    await sched.runEventReminders(new Date('2026-10-15T12:57:00Z'));
    expect(emitter.emit.mock.calls.filter((c: any[]) => c[0] === 'event.reminder')).toHaveLength(1);
  });
});
