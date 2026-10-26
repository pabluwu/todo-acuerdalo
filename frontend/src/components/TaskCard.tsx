'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BriefcaseBusiness, CalendarDays, Tag } from 'lucide-react';
import { dueState, formatDay } from '@/lib/api';
import { PRIORITIES, type Task } from '@/lib/types';
import { Avatar } from './Avatar';

export const DUE_TAG = { overdue: 'Vencida', soon: 'Vence pronto' } as const;

export function cardLabel(task: Task): string {
  const prio = PRIORITIES.find((p) => p.id === task.priority)!;
  const due = dueState(task);
  return [
    task.title,
    `Prioridad ${prio.label.toLowerCase()}`,
    due && DUE_TAG[due],
    task.assignees.length > 0 && `Asignada a ${task.assignees.map((a) => a.name).join(', ')}`,
  ].filter(Boolean).join('. ');
}

/** Ícono de prioridad en su color; el texto queda para lectores de pantalla. */
export function PriorityIcon({ priority, boxed = false }: { priority: Task['priority']; boxed?: boolean }) {
  const prio = PRIORITIES.find((p) => p.id === priority)!;
  return (
    <span title={`Prioridad ${prio.label.toLowerCase()}`} className={`inline-flex shrink-0 items-center justify-center ${prio.fg} ${boxed ? `h-6 w-6 rounded-md ${prio.soft}` : ''}`}>
      <prio.icon size={14} strokeWidth={2.25} aria-hidden />
      <span className="sr-only">Prioridad {prio.label.toLowerCase()}.</span>
    </span>
  );
}

export function DueDate({ task }: { task: Task }) {
  if (!task.dueDate) return null;
  const due = dueState(task);
  const tone = due === 'overdue' ? 'bg-red-50 font-medium text-red-700' : due === 'soon' ? 'bg-amber-50 font-medium text-amber-800' : 'text-zinc-500';
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1 text-[11px] leading-5 tabular-nums ${tone}`}>
      <CalendarDays size={12} strokeWidth={1.5} aria-hidden />
      {formatDay(task.dueDate)}
      {due && <span>· {DUE_TAG[due]}</span>}
    </span>
  );
}

export function TypeBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded bg-stone-100 px-1.5 text-[11px] leading-5 text-zinc-600">
      <Tag size={11} strokeWidth={1.5} aria-hidden className="shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function ClientBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded bg-stone-100 px-1.5 text-[11px] leading-5 text-zinc-600">
      <BriefcaseBusiness size={11} strokeWidth={1.5} aria-hidden className="shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function AvatarStack({ users, max = 3 }: { users: Task['assignees']; max?: number }) {
  if (users.length === 0) return null;
  return (
    <div className="flex shrink-0 -space-x-1">
      {users.slice(0, max).map((u) => <Avatar key={u.id} name={u.name} />)}
      {users.length > max && <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] tabular-nums text-zinc-600 ring-2 ring-white">+{users.length - max}</span>}
    </div>
  );
}

export function TaskCardView({ task, onClick }: { task: Task; onClick?: () => void }) {
  const done = task.status === 'completed';
  return (
    <div onClick={onClick} className="card-surface card-surface-interactive p-3.5">
      <div className="flex items-start gap-2">
        <span className="-mt-0.5"><PriorityIcon priority={task.priority} boxed /></span>
        <p className={`text-sm leading-snug ${done ? 'text-zinc-500 line-through' : 'font-medium text-zinc-900'}`}>{task.title}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          {task.type && <TypeBadge name={task.type.name} />}
          {task.client && <ClientBadge name={task.client.name} />}
          <DueDate task={task} />
        </div>
        <AvatarStack users={task.assignees} />
      </div>
    </div>
  );
}

export function SortableTaskCard({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    attributes: { roleDescription: 'tarea arrastrable' },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="rounded-lg"
      {...attributes}
      {...listeners}
      aria-label={cardLabel(task)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        // Enter abre la tarea; el arrastre con teclado se inicia con Espacio
        if (e.key === 'Enter' && !isDragging && e.target === e.currentTarget) onOpen(task.id);
      }}
    >
      <TaskCardView task={task} onClick={() => onOpen(task.id)} />
    </div>
  );
}
