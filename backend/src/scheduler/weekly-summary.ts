import { TaskPriority, TaskStatus } from '../entities/task.entity';

export interface WeekBounds {
  prevStart: Date;
  thisStart: Date;
  nextStart: Date;
}

/** Desfase (ms) de la zona respecto a UTC en el instante dado. */
function tzOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(date);
  const v = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Medianoche local (año, mes 0-11, día) de la zona, como instante UTC. Respeta cambios de horario. */
function zonedMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m, d);
  let t = guess - tzOffset(new Date(guess), timeZone);
  t = guess - tzOffset(new Date(t), timeZone);
  return new Date(t);
}

/** Lunes 00:00 de la semana anterior, la actual y la siguiente en la zona indicada. */
export function weekBounds(now: Date, timeZone: string): WeekBounds {
  const local = new Date(now.getTime() + tzOffset(now, timeZone));
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate() - sinceMonday;
  return {
    prevStart: zonedMidnight(y, m, d - 7, timeZone),
    thisStart: zonedMidnight(y, m, d, timeZone),
    nextStart: zonedMidnight(y, m, d + 7, timeZone),
  };
}

export interface SummarySourceTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  assignees: { id: string }[];
}

export interface SummaryTask {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: Date | null;
  startedAt: Date | null;
  startedLastWeek: boolean;
  overdue: boolean;
  dueThisWeek: boolean;
}

export interface UserSummary {
  closed: SummaryTask[];
  inProgress: SummaryTask[];
  pending: SummaryTask[];
  counts: { closed: number; startedLastWeek: number; inProgress: number; pending: number; dueThisWeek: number };
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function byPriorityThenDue(a: SummaryTask, b: SummaryTask) {
  const p = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
  if (p !== 0) return p;
  if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return 0;
}

/** Resumen de un usuario (por asignación); con `userId` null, el de las tareas sin responsable. */
export function buildUserSummary(userId: string | null, tasks: SummarySourceTask[], bounds: WeekBounds, now: Date): UserSummary {
  const mine = tasks.filter((t) => (userId === null ? t.assignees.length === 0 : t.assignees.some((a) => a.id === userId)));
  const inRange = (d: Date | null, from: Date, to: Date) => !!d && d.getTime() >= from.getTime() && d.getTime() < to.getTime();
  const toItem = (t: SummarySourceTask): SummaryTask => {
    const open = t.status !== 'completed';
    const due = t.dueDate ? new Date(t.dueDate) : null;
    return {
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: due,
      startedAt: t.startedAt,
      startedLastWeek: inRange(t.startedAt, bounds.prevStart, bounds.thisStart),
      overdue: open && !!due && due.getTime() < now.getTime(),
      dueThisWeek: open && !!due && due.getTime() >= now.getTime() && due.getTime() < bounds.nextStart.getTime(),
    };
  };
  const closed = mine
    .filter((t) => t.status === 'completed' && inRange(t.completedAt, bounds.prevStart, bounds.thisStart))
    .map(toItem)
    .sort(byPriorityThenDue);
  const inProgress = mine.filter((t) => t.status === 'in_progress').map(toItem).sort(byPriorityThenDue);
  const pending = mine.filter((t) => t.status === 'not_started').map(toItem).sort(byPriorityThenDue);
  return {
    closed,
    inProgress,
    pending,
    counts: {
      closed: closed.length,
      startedLastWeek: inProgress.filter((t) => t.startedLastWeek).length,
      inProgress: inProgress.length,
      pending: pending.length,
      dueThisWeek: [...inProgress, ...pending].filter((t) => t.dueThisWeek).length,
    },
  };
}

export function isSummaryEmpty(s: UserSummary) {
  return s.closed.length + s.inProgress.length + s.pending.length === 0;
}
