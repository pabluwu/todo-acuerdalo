import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'Sin iniciar',
  in_progress: 'En proceso',
  completed: 'Completada',
};
export const PRIORITY_LABELS: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };

export interface TaskSnapshot {
  title: string;
  description: string;
  status: string;
  priority: string;
  typeId: string;
  typeName: string;
  dueDate: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
}

export interface Change {
  field: 'title' | 'description' | 'status' | 'priority' | 'type' | 'dueDate' | 'assignees' | 'comment' | 'attachment' | 'schedule' | 'location';
  label: string;
  from: string | null;
  to: string | null;
}

export function snapshotTask(t: Task): TaskSnapshot {
  const assignees = [...(t.assignees ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  return {
    title: t.title,
    description: t.description ?? '',
    status: t.status,
    priority: t.priority,
    typeId: t.typeId ?? t.type?.id,
    typeName: t.type?.name ?? '',
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    assigneeIds: assignees.map((a) => a.id),
    assigneeNames: assignees.map((a) => a.name),
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}

/** Detecta qué campos cambiaron entre dos instantáneas de una tarea. */
export function detectChanges(before: TaskSnapshot, after: TaskSnapshot): Change[] {
  const changes: Change[] = [];
  if (before.title !== after.title) changes.push({ field: 'title', label: 'Título', from: before.title, to: after.title });
  if (before.description !== after.description)
    changes.push({ field: 'description', label: 'Descripción', from: before.description || null, to: after.description || null });
  if (before.status !== after.status)
    changes.push({ field: 'status', label: 'Estado', from: STATUS_LABELS[before.status] ?? before.status, to: STATUS_LABELS[after.status] ?? after.status });
  if (before.priority !== after.priority)
    changes.push({ field: 'priority', label: 'Prioridad', from: PRIORITY_LABELS[before.priority] ?? before.priority, to: PRIORITY_LABELS[after.priority] ?? after.priority });
  if (before.typeId !== after.typeId) changes.push({ field: 'type', label: 'Tipo', from: before.typeName, to: after.typeName });
  if (before.dueDate !== after.dueDate)
    changes.push({ field: 'dueDate', label: 'Fecha límite', from: formatDate(before.dueDate), to: formatDate(after.dueDate) });
  const sameAssignees =
    before.assigneeIds.length === after.assigneeIds.length && before.assigneeIds.every((id, i) => id === after.assigneeIds[i]);
  if (!sameAssignees)
    changes.push({
      field: 'assignees',
      label: 'Asignados',
      from: before.assigneeNames.join(', ') || 'Nadie',
      to: after.assigneeNames.join(', ') || 'Nadie',
    });
  return changes;
}

/** Usuarios recién añadidos como asignados. */
export function newlyAssigned(before: TaskSnapshot, afterAssignees: User[]): User[] {
  return afterAssignees.filter((u) => !before.assigneeIds.includes(u.id));
}

/**
 * Destinatarios de un aviso de cambio: asignados + administradores activos,
 * sin duplicados, sin el autor del cambio y sin los usuarios excluidos.
 */
export function computeRecipients(
  assignees: Pick<User, 'id' | 'email' | 'name' | 'isActive'>[],
  admins: Pick<User, 'id' | 'email' | 'name' | 'isActive'>[],
  actorId: string | null,
  excludeIds: string[] = [],
) {
  const map = new Map<string, Pick<User, 'id' | 'email' | 'name' | 'isActive'>>();
  for (const u of [...assignees, ...admins]) {
    if (!u.isActive) continue;
    if (u.id === actorId || excludeIds.includes(u.id)) continue;
    map.set(u.id, u);
  }
  return [...map.values()];
}
