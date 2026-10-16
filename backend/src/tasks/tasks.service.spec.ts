import { computeRecipients, detectChanges, newlyAssigned, snapshotTask, TaskSnapshot } from './task-changes';
import { TasksService } from './tasks.service';

const u = (id: string, isActive = true) => ({ id, name: `User ${id}`, email: `${id}@t.com`, isActive });

const base: TaskSnapshot = {
  title: 'T', description: 'd', status: 'not_started', priority: 'medium', typeId: 't1', typeName: 'Interna',
  dueDate: null, assigneeIds: ['a'], assigneeNames: ['User a'],
};

describe('detectChanges', () => {
  it('no detecta nada si no hay diferencias', () => {
    expect(detectChanges(base, { ...base })).toEqual([]);
  });

  it('detecta cada campo cambiado con etiquetas legibles', () => {
    const after: TaskSnapshot = {
      ...base, title: 'Nuevo', description: 'otra', status: 'in_progress', priority: 'high',
      typeId: 't2', typeName: 'Clientes', dueDate: '2026-01-01T10:00:00.000Z', assigneeIds: ['a', 'b'], assigneeNames: ['User a', 'User b'],
    };
    const fields = detectChanges(base, after).map((c) => c.field);
    expect(fields).toEqual(['title', 'description', 'status', 'priority', 'type', 'dueDate', 'assignees']);
    const status = detectChanges(base, after).find((c) => c.field === 'status')!;
    expect(status.from).toBe('Sin iniciar');
    expect(status.to).toBe('En proceso');
  });

  it('detecta nuevos asignados', () => {
    const added = newlyAssigned(base, [u('a'), u('b')] as any);
    expect(added.map((x) => x.id)).toEqual(['b']);
  });
});

describe('computeRecipients', () => {
  it('une asignados y admins sin duplicados, incluido el autor', () => {
    const r = computeRecipients([u('a'), u('b')], [u('b'), u('admin')]);
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'admin', 'b']);
  });

  it('excluye usuarios inactivos y los excluidos explícitamente', () => {
    const r = computeRecipients([u('a', false), u('b')], [u('admin')], ['admin']);
    expect(r.map((x) => x.id)).toEqual(['b']);
  });

  it('notifica al admin aunque sea quien hizo el cambio', () => {
    expect(computeRecipients([], [u('admin')]).map((x) => x.id)).toEqual(['admin']);
  });
});

describe('TasksService.update', () => {
  function setup() {
    const task: any = {
      id: 't', title: 'T', description: 'd', status: 'not_started', priority: 'medium', typeId: 't1',
      type: { id: 't1', name: 'Interna', isActive: true }, dueDate: new Date('2026-01-01T00:00:00Z'),
      assignees: [u('a')], dueSoonNotifiedAt: new Date(), overdueNotifiedAt: new Date(), createdBy: null,
    };
    const tasks: any = { findOne: jest.fn(async () => task), save: jest.fn(async (x) => x), createQueryBuilder: jest.fn() };
    const users: any = { find: jest.fn(async () => [u('a'), u('b')]) };
    const audit: any = { log: jest.fn() };
    const events: any = { emit: jest.fn() };
    const svc = new TasksService(tasks, users, {} as any, {} as any, audit, events, { get: () => '/tmp' } as any);
    return { svc, task, events, audit };
  }
  const actor: any = { id: 'a', email: 'a@t.com', name: 'User a', role: 'user' };

  it('emite task.changed solo con los campos modificados y reinicia flags al cambiar dueDate', async () => {
    const { svc, events, task, audit } = setup();
    await svc.update('t', { priority: 'high', dueDate: '2026-02-02T00:00:00Z' }, actor);
    expect(task.dueSoonNotifiedAt).toBeNull();
    expect(task.overdueNotifiedAt).toBeNull();
    const call = events.emit.mock.calls.find((c: any[]) => c[0] === 'task.changed');
    expect(call[1].changes.map((c: any) => c.field)).toEqual(['priority', 'dueDate']);
    expect(audit.log).toHaveBeenCalledWith(actor, 'task.update', 'task', 't', expect.anything(), expect.anything());
  });

  it('emite task.assigned solo para los recién asignados', async () => {
    const { svc, events } = setup();
    await svc.update('t', { assigneeIds: ['a', 'b'] }, actor);
    const call = events.emit.mock.calls.find((c: any[]) => c[0] === 'task.assigned');
    expect(call[1].newAssignees.map((x: any) => x.id)).toEqual(['b']);
    const changed = events.emit.mock.calls.find((c: any[]) => c[0] === 'task.changed');
    expect(changed[1].excludeUserIds).toEqual(['b']);
  });

  it('no emite nada si no hay cambios', async () => {
    const { svc, events } = setup();
    await svc.update('t', { title: 'T' }, actor);
    expect(events.emit).not.toHaveBeenCalled();
  });
});

describe('snapshotTask', () => {
  it('ordena los asignados por id', () => {
    const s = snapshotTask({ title: 'x', description: '', status: 'completed', priority: 'low', typeId: 't', type: { id: 't', name: 'N' }, dueDate: null, assignees: [u('b'), u('a')] } as any);
    expect(s.assigneeIds).toEqual(['a', 'b']);
  });
});
