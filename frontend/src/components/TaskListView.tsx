'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { PRIORITY_RANK, STATUSES, type Task, type TaskStatus } from '@/lib/types';
import { AvatarStack, ClientBadge, DueDate, PriorityIcon, TypeBadge, cardLabel } from './TaskCard';

export type ListSort = 'manual' | 'due' | 'priority' | 'recent';

export const SORTS: { id: ListSort; label: string }[] = [
  { id: 'manual', label: 'Por estado' },
  { id: 'due', label: 'Fecha límite' },
  { id: 'priority', label: 'Prioridad' },
  { id: 'recent', label: 'Más recientes' },
];

const NEXT: Record<TaskStatus, TaskStatus> = { not_started: 'in_progress', in_progress: 'completed', completed: 'not_started' };

function sortTasks(tasks: Task[], sort: ListSort): Task[] {
  const list = [...tasks];
  if (sort === 'due') list.sort((a, b) => (a.dueDate ? Date.parse(a.dueDate) : Infinity) - (b.dueDate ? Date.parse(b.dueDate) : Infinity));
  if (sort === 'priority') list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  if (sort === 'recent') list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return list;
}

/** Botón de estado: un toque avanza Sin iniciar → En proceso → Completada. */
function StatusButton({ task, onCycle }: { task: Task; onCycle: (t: Task, to: TaskStatus) => void }) {
  const s = STATUSES.find((x) => x.id === task.status)!;
  const next = STATUSES.find((x) => x.id === NEXT[task.status])!;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onCycle(task, next.id); }}
      aria-label={`${s.label}. Cambiar a ${next.label.toLowerCase()}`}
      title={`Cambiar a ${next.label.toLowerCase()}`}
      className={`-m-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 ${s.fg}`}
    >
      <s.icon size={20} strokeWidth={task.status === 'completed' ? 2 : 1.75} aria-hidden />
    </button>
  );
}

function Row({ task, onOpen, onCycle, showStatus }: { task: Task; onOpen: (id: string) => void; onCycle: (t: Task, to: TaskStatus) => void; showStatus: boolean }) {
  const done = task.status === 'completed';
  const s = STATUSES.find((x) => x.id === task.status)!;
  return (
    <li
      tabIndex={0}
      aria-label={cardLabel(task)}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(task.id); }}
      className="group flex cursor-pointer items-start gap-3 px-3 py-3 transition-colors hover:bg-stone-50 md:grid md:grid-cols-[auto_minmax(0,1fr)_9rem_8.5rem_5rem] md:items-center md:gap-4 md:px-4"
    >
      <StatusButton task={task} onCycle={onCycle} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="-mt-0.5 md:hidden"><PriorityIcon priority={task.priority} boxed /></span>
          <p className={`text-sm leading-snug ${done ? 'text-zinc-500 line-through' : 'font-medium text-zinc-900'}`}>{task.title}</p>
        </div>
        {/* en móvil la meta va debajo del título */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
          {showStatus && <span className={`inline-flex items-center gap-1 text-[11px] ${s.fg}`}>{s.label}</span>}
          {task.type && <TypeBadge name={task.type.name} />}
          {task.client && <ClientBadge name={task.client.name} />}
          <DueDate task={task} />
          <span className="ml-auto"><AvatarStack users={task.assignees} /></span>
        </div>
        {showStatus && <span className={`mt-1 hidden items-center gap-1 text-[11px] md:inline-flex ${s.fg}`}>{s.label}</span>}
      </div>
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <PriorityIcon priority={task.priority} boxed />
        {task.type ? <TypeBadge name={task.type.name} /> : <span className="text-xs text-zinc-400">Sin tipo</span>}
        {task.client && <ClientBadge name={task.client.name} />}
      </div>
      <div className="hidden md:block">{task.dueDate ? <DueDate task={task} /> : <span className="text-xs text-zinc-400">Sin fecha</span>}</div>
      <div className="hidden justify-end md:flex"><AvatarStack users={task.assignees} /></div>
    </li>
  );
}

function Group({ status, tasks, onOpen, onCycle }: { status: (typeof STATUSES)[number]; tasks: Task[]; onOpen: (id: string) => void; onCycle: (t: Task, to: TaskStatus) => void }) {
  // las completadas arrancan plegadas para que la lista muestre lo pendiente
  const [open, setOpen] = useState(status.id !== 'completed');
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby={`grp-${status.id}`} className="card-surface overflow-hidden">
      <h2 id={`grp-${status.id}`}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left md:px-4 ${status.tint}`}
        >
          <status.icon size={16} strokeWidth={2} aria-hidden className={status.fg} />
          <span className="text-sm font-semibold text-zinc-800">{status.label}</span>
          <span className={`rounded-full px-2 text-xs font-medium leading-5 tabular-nums ring-1 ${status.badge}`}>{tasks.length}</span>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={`ml-auto text-zinc-500 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      </h2>
      {open && (
        <ul className="divide-y divide-zinc-100">
          {tasks.map((t) => <Row key={t.id} task={t} onOpen={onOpen} onCycle={onCycle} showStatus={false} />)}
        </ul>
      )}
    </section>
  );
}

/** Listado de tareas: agrupado por estado, o plano cuando se ordena por otro criterio. */
export function TaskListView({
  tasks,
  sort,
  onOpen,
  onCycle,
}: {
  tasks: Task[];
  sort: ListSort;
  onOpen: (id: string) => void;
  onCycle: (t: Task, to: TaskStatus) => void;
}) {
  if (sort === 'manual') {
    return (
      <div className="space-y-4">
        {STATUSES.map((s) => <Group key={s.id} status={s} tasks={tasks.filter((t) => t.status === s.id)} onOpen={onOpen} onCycle={onCycle} />)}
      </div>
    );
  }
  return (
    <ul className="card-surface divide-y divide-zinc-100 overflow-hidden">
      {sortTasks(tasks, sort).map((t) => <Row key={t.id} task={t} onOpen={onOpen} onCycle={onCycle} showStatus />)}
    </ul>
  );
}
