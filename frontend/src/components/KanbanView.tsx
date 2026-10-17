'use client';

import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MoveDown } from 'lucide-react';
import { type Dispatch, type SetStateAction, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { STATUSES, type Task, type TaskStatus } from '@/lib/types';
import { SortableTaskCard, TaskCardView } from './TaskCard';

type Status = (typeof STATUSES)[number];

function Column({ status, tasks, onOpen }: { status: Status; tasks: Task[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <section aria-labelledby={`col-${status.id}`} className={`flex min-w-0 flex-col rounded-2xl p-2 transition-colors ${status.tint} ${isOver ? 'ring-2 ring-accent/30' : ''}`}>
      <header className="flex items-center gap-2 px-2 pb-3 pt-1.5">
        <status.icon size={16} strokeWidth={2} aria-hidden className={status.fg} />
        <h2 id={`col-${status.id}`} className="text-sm font-semibold text-zinc-800">{status.label}</h2>
        <span className={`ml-auto rounded-full px-2 text-xs font-medium leading-5 tabular-nums ring-1 ${status.badge}`}>{tasks.length}</span>
      </header>
      <div ref={setNodeRef} className="min-h-[10rem] flex-1 space-y-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <SortableTaskCard key={t.id} task={t} onOpen={onOpen} />)}
        </SortableContext>
        {tasks.length === 0 && (
          <div className={`flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-3 py-8 text-center text-xs transition-colors ${isOver ? 'border-accent/50 text-accent' : 'border-zinc-300/80 text-zinc-500'}`}>
            <MoveDown size={16} strokeWidth={1.5} aria-hidden />
            Arrastra una tarea aquí
          </div>
        )}
      </div>
    </section>
  );
}

const statusLabel = (id: string) => STATUSES.find((s) => s.id === id)?.label ?? 'otra columna';
const announcements: Announcements = {
  onDragStart: ({ active }) => `Tarea ${active.id} recogida.`,
  onDragOver: ({ over }) => (over ? `Sobre ${STATUSES.some((s) => s.id === over.id) ? `la columna ${statusLabel(String(over.id))}` : 'otra tarea'}.` : ''),
  onDragEnd: ({ over }) => (over ? 'Tarea soltada.' : 'Movimiento cancelado.'),
  onDragCancel: () => 'Movimiento cancelado.',
};

/** Tablero kanban con arrastrar y soltar. `visible` aplica los filtros locales sin perder el orden global. */
export function KanbanView({
  tasks,
  setTasks,
  visible,
  onOpen,
  reload,
}: {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  visible: (t: Task) => boolean;
  onOpen: (id: string) => void;
  reload: () => void;
}) {
  const toast = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragStart = useRef<{ status: TaskStatus; index: number } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Espacio inicia el arrastre; Enter queda libre para abrir la tarea
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const columns = useMemo(
    () => Object.fromEntries(STATUSES.map((s) => [s.id, tasks.filter((t) => t.status === s.id && visible(t))])) as Record<TaskStatus, Task[]>,
    [tasks, visible],
  );

  function findContainer(id: string): TaskStatus | undefined {
    if (STATUSES.some((s) => s.id === id)) return id as TaskStatus;
    return tasks.find((t) => t.id === id)?.status;
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setActiveId(id);
    const task = tasks.find((t) => t.id === id);
    if (task) dragStart.current = { status: task.status, index: columns[task.status].findIndex((t) => t.id === id) };
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeC = findContainer(String(active.id));
    const overC = findContainer(String(over.id));
    if (!activeC || !overC || activeC === overC) return;
    setTasks((prev) => {
      const moving = prev.find((t) => t.id === active.id);
      if (!moving) return prev;
      const rest = prev.filter((t) => t.id !== active.id);
      const updated = { ...moving, status: overC };
      const overIsColumn = STATUSES.some((s) => s.id === over.id);
      if (overIsColumn) {
        const lastIdx = rest.map((t) => t.status).lastIndexOf(overC);
        rest.splice(lastIdx + 1, 0, updated);
        return rest;
      }
      const overIdx = rest.findIndex((t) => t.id === over.id);
      const below = active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
      rest.splice(overIdx + (below ? 1 : 0), 0, updated);
      return rest;
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const start = dragStart.current;
    dragStart.current = null;
    setActiveId(null);
    if (!over || !start) return;
    let next = tasks;
    const container = findContainer(id);
    const overC = findContainer(String(over.id));
    if (!container || !overC) return;
    if (container === overC && id !== over.id && !STATUSES.some((s) => s.id === over.id)) {
      const oldIdx = tasks.findIndex((t) => t.id === id);
      const newIdx = tasks.findIndex((t) => t.id === over.id);
      next = arrayMove(tasks, oldIdx, newIdx);
      setTasks(next);
    }
    const col = next.filter((t) => t.status === container && visible(t));
    const idx = col.findIndex((t) => t.id === id);
    if (container === start.status && idx === start.index) return;
    const beforeId = col[idx + 1]?.id;
    try {
      await api(`/tasks/${id}/move`, {
        method: 'PATCH',
        body: { status: container, position: beforeId ? idx : 1_000_000, beforeId },
      });
    } catch (e) {
      toast((e as Error).message);
      reload();
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements, screenReaderInstructions: { draggable: 'Pulsa Intro para abrir la tarea. Pulsa Espacio para recogerla, las flechas para moverla y Espacio de nuevo para soltarla.' } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => { setActiveId(null); reload(); }}
    >
      <div className="grid grid-cols-3 items-start gap-4 lg:gap-5">
        {STATUSES.map((s) => <Column key={s.id} status={s} tasks={columns[s.id]} onOpen={onOpen} />)}
      </div>
      <DragOverlay>{activeTask ? <div className="rotate-1 rounded-lg shadow-lg"><TaskCardView task={activeTask} /></div> : null}</DragOverlay>
    </DndContext>
  );
}
