'use client';

import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, SearchX } from 'lucide-react';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import { STATUSES, type Task, type TaskStatus, type TaskType, type UserLite } from '@/lib/types';
import { FilterBar, type Filters } from './FilterBar';
import { NewTaskDialog } from './NewTaskDialog';
import { BoardSkeleton } from './Skeletons';
import { SortableTaskCard, TaskCardView } from './TaskCard';
import { TaskPanel } from './TaskPanel';

function Column({ id, label, dot, tasks, onOpen }: { id: TaskStatus; label: string; dot: string; tasks: Task[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section aria-labelledby={`col-${id}`} className="flex max-h-[calc(100dvh-15rem)] min-w-0 shrink-0 basis-[85vw] snap-center flex-col md:max-h-none md:basis-auto">
      <header className="mb-3 flex items-center gap-2 px-1">
        <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
        <h2 id={`col-${id}`} className="text-sm font-medium text-zinc-700">{label}</h2>
        <span className="text-xs tabular-nums text-zinc-500">{tasks.length}</span>
      </header>
      <div ref={setNodeRef} className={`min-h-[12rem] flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-dashed p-2 transition-colors md:overflow-visible ${isOver ? 'border-accent/40 bg-accent-soft/50' : 'border-transparent bg-zinc-100/60'}`}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <SortableTaskCard key={t.id} task={t} onOpen={onOpen} />)}
        </SortableContext>
        {tasks.length === 0 && <p className="px-2 py-6 text-center text-xs text-zinc-500">Sin tareas</p>}
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

export function Board() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const filters: Filters = {
    assigneeId: params.get('assigneeId') ?? '',
    priority: params.get('priority') ?? '',
    typeId: params.get('typeId') ?? '',
  };
  const taskId = params.get('task');
  const filterKey = `${filters.assigneeId}|${filters.priority}|${filters.typeId}`;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const dragStart = useRef<{ status: TaskStatus; index: number } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // el arrastre táctil necesita una pulsación larga para no bloquear el scroll del tablero
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Espacio inicia el arrastre; Enter queda libre para abrir la tarea
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const loadTasks = useCallback(() => {
    const q = new URLSearchParams();
    if (filters.assigneeId) q.set('assigneeId', filters.assigneeId);
    if (filters.priority) q.set('priority', filters.priority);
    if (filters.typeId) q.set('typeId', filters.typeId);
    api<Task[]>(`/tasks${q.toString() ? `?${q}` : ''}`)
      .then((t) => { setTasks(t); setLoaded(true); })
      .catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, toast]);

  useEffect(loadTasks, [loadTasks]);
  useEffect(() => {
    api<UserLite[]>('/users').then(setUsers).catch(() => undefined);
    api<TaskType[]>('/task-types').then(setTypes).catch(() => undefined);
  }, []);

  function setUrl(next: URLSearchParams) {
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  }
  function setFilter(key: keyof Filters, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value); else next.delete(key);
    setUrl(next);
  }
  function clearFilters() {
    const next = new URLSearchParams(window.location.search);
    ['assigneeId', 'priority', 'typeId'].forEach((k) => next.delete(k));
    setUrl(next);
  }
  const openTask = useCallback((id: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (id) next.set('task', id); else next.delete('task');
    const qs = next.toString();
    router.push(qs ? `/?${qs}` : '/', { scroll: false });
  }, [router]);

  const matches = useCallback((t: Task) =>
    (!filters.assigneeId || t.assignees.some((a) => a.id === filters.assigneeId)) &&
    (!filters.priority || t.priority === filters.priority) &&
    (!filters.typeId || t.type?.id === filters.typeId),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filterKey]);

  const columns = useMemo(
    () => Object.fromEntries(STATUSES.map((s) => [s.id, tasks.filter((t) => t.status === s.id)])) as Record<TaskStatus, Task[]>,
    [tasks],
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
    const col = next.filter((t) => t.status === container);
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
      loadTasks();
    }
  }

  function onTaskChanged(t: Task) {
    setTasks((prev) => {
      const old = prev.find((x) => x.id === t.id);
      if (!matches(t)) return prev.filter((x) => x.id !== t.id);
      if (!old) return [...prev, t];
      if (old.status !== t.status) return [...prev.filter((x) => x.id !== t.id), t];
      return prev.map((x) => (x.id === t.id ? t : x));
    });
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-8">
      <FilterBar filters={filters} users={users} types={types} onChange={setFilter} onClear={clearFilters} onNew={() => setShowNew(true)} />
      {!loaded ? (
        <BoardSkeleton />
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center">
          {filtered && <SearchX size={20} strokeWidth={1.5} aria-hidden className="mb-3 text-zinc-400" />}
          <p className="text-sm font-medium text-zinc-900">{filtered ? 'Ninguna tarea coincide con estos filtros' : 'Todavía no hay tareas'}</p>
          <p className="mt-1 max-w-sm text-sm text-zinc-600">
            {filtered ? 'Prueba con otra combinación o quita los filtros.' : 'Crea la primera para empezar a organizar el trabajo del equipo.'}
          </p>
          {filtered ? (
            <button className="btn mt-5" onClick={clearFilters}>Limpiar filtros</button>
          ) : (
            <button className="btn-accent mt-5" onClick={() => setShowNew(true)}><Plus {...icon} /> Crear la primera tarea</button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          accessibility={{ announcements, screenReaderInstructions: { draggable: 'Pulsa Intro para abrir la tarea. Pulsa Espacio para recogerla, las flechas para moverla y Espacio de nuevo para soltarla.' } }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => { setActiveId(null); loadTasks(); }}
        >
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0">
            {STATUSES.map((s) => <Column key={s.id} id={s.id} label={s.label} dot={s.dot} tasks={columns[s.id]} onOpen={openTask} />)}
          </div>
          <DragOverlay>{activeTask ? <div className="rotate-1 shadow-md"><TaskCardView task={activeTask} /></div> : null}</DragOverlay>
        </DndContext>
      )}
      {taskId && (
        <TaskPanel
          taskId={taskId}
          users={users}
          types={types}
          onClose={() => openTask(null)}
          onChanged={onTaskChanged}
          onDeleted={(id) => { setTasks((p) => p.filter((t) => t.id !== id)); openTask(null); }}
        />
      )}
      {showNew && (
        <NewTaskDialog
          users={users}
          types={types}
          onClose={() => setShowNew(false)}
          onCreated={(t) => { setShowNew(false); onTaskChanged(t); openTask(t.id); }}
        />
      )}
    </div>
  );
}
