'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays } from 'lucide-react';
import { dueState, formatDay } from '@/lib/api';
import { PRIORITIES, type Task } from '@/lib/types';
import { Avatar } from './Avatar';

const DUE_TAG = { overdue: 'Vencida', soon: 'Vence pronto' } as const;

function cardLabel(task: Task): string {
  const prio = PRIORITIES.find((p) => p.id === task.priority)!;
  const due = dueState(task);
  return [
    task.title,
    `Prioridad ${prio.label.toLowerCase()}`,
    due && DUE_TAG[due],
    task.assignees.length > 0 && `Asignada a ${task.assignees.map((a) => a.name).join(', ')}`,
  ].filter(Boolean).join('. ');
}

export function TaskCardView({ task, onClick }: { task: Task; onClick?: () => void }) {
  const prio = PRIORITIES.find((p) => p.id === task.priority)!;
  const due = dueState(task);
  return (
    <div onClick={onClick} className="card-surface card-surface-interactive p-3.5">
      <div className="flex items-start gap-2">
        <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${prio.dot}`} title={`Prioridad ${prio.label.toLowerCase()}`} />
        <span className="sr-only">Prioridad {prio.label.toLowerCase()}.</span>
        <p className={`text-sm leading-snug ${task.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>{task.title}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {task.type && <span className="max-w-full truncate rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-600">{task.type.name}</span>}
          {task.dueDate && (
            <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums ${due === 'overdue' ? 'font-medium text-red-700' : due === 'soon' ? 'font-medium text-amber-700' : 'text-zinc-500'}`}>
              <CalendarDays size={12} strokeWidth={1.5} aria-hidden />
              {formatDay(task.dueDate)}
              {due && <span>· {DUE_TAG[due]}</span>}
            </span>
          )}
        </div>
        <div className="flex shrink-0 -space-x-0.5">
          {task.assignees.slice(0, 3).map((u) => <Avatar key={u.id} name={u.name} />)}
          {task.assignees.length > 3 && <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] tabular-nums text-zinc-600 ring-1 ring-zinc-200">+{task.assignees.length - 3}</span>}
        </div>
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
