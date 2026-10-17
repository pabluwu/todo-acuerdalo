'use client';

import { ClipboardList, Plus, SearchX } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, dueState } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import { useMobile } from '@/lib/useMediaQuery';
import type { Task, TaskStatus, TaskType, UserLite } from '@/lib/types';
import { BoardToolbar, FILTER_KEYS, type BoardView, type Filters } from './BoardToolbar';
import { EmptyState } from './EmptyState';
import { KanbanView } from './KanbanView';
import { NewTaskDialog } from './NewTaskDialog';
import { BoardSkeleton, ListSkeleton } from './Skeletons';
import { SORTS, TaskListView, type ListSort } from './TaskListView';
import { TaskPanel } from './TaskPanel';

const VIEW_KEY = 'acuerdalo.boardView';

function readStoredView(): BoardView | null {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : null; } catch { return null; }
}

export function Board() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const mobile = useMobile();

  const rawDue = params.get('due');
  const rawSort = params.get('sort') as ListSort | null;
  const filters: Filters = {
    assigneeId: params.get('assigneeId') ?? '',
    priority: params.get('priority') ?? '',
    typeId: params.get('typeId') ?? '',
    due: rawDue === 'overdue' || rawDue === 'soon' ? rawDue : '',
    status: params.get('status') ?? '',
    sort: rawSort && SORTS.some((s) => s.id === rawSort) ? rawSort : 'manual',
  };
  const taskId = params.get('task');
  const serverKey = `${filters.assigneeId}|${filters.priority}|${filters.typeId}`;

  // la vista elegida vive en la URL; sin parámetro se usa la última guardada. En móvil siempre lista.
  const [storedView, setStoredView] = useState<BoardView | null>(null);
  useEffect(() => setStoredView(readStoredView()), []);
  const rawView = params.get('view');
  const chosenView: BoardView = rawView === 'list' || rawView === 'board' ? rawView : storedView ?? 'board';
  const view: BoardView = mobile ? 'list' : chosenView;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [showNew, setShowNew] = useState(false);

  const loadTasks = useCallback(() => {
    const q = new URLSearchParams();
    if (filters.assigneeId) q.set('assigneeId', filters.assigneeId);
    if (filters.priority) q.set('priority', filters.priority);
    if (filters.typeId) q.set('typeId', filters.typeId);
    api<Task[]>(`/tasks${q.toString() ? `?${q}` : ''}`)
      .then((t) => { setTasks(t); setLoaded(true); })
      .catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey, toast]);

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
    if (value && !(key === 'sort' && value === 'manual')) next.set(key, value); else next.delete(key);
    setUrl(next);
  }
  function clearFilters() {
    const next = new URLSearchParams(window.location.search);
    FILTER_KEYS.forEach((k) => next.delete(k));
    setUrl(next);
  }
  function setView(v: BoardView) {
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* sin almacenamiento: queda solo en la URL */ }
    setStoredView(v);
    const next = new URLSearchParams(window.location.search);
    next.set('view', v);
    if (v === 'board') { next.delete('status'); next.delete('sort'); }
    setUrl(next);
  }
  const openTask = useCallback((id: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (id) next.set('task', id); else next.delete('task');
    const qs = next.toString();
    router.push(qs ? `/?${qs}` : '/', { scroll: false });
  }, [router]);

  const serverMatch = useCallback((t: Task) =>
    (!filters.assigneeId || t.assignees.some((a) => a.id === filters.assigneeId)) &&
    (!filters.priority || t.priority === filters.priority) &&
    (!filters.typeId || t.type?.id === filters.typeId),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [serverKey]);

  // filtros locales: plazo siempre; estado solo en la lista (en el tablero las columnas ya son el estado)
  const statusFilter = view === 'list' ? filters.status : '';
  const visible = useCallback((t: Task) =>
    (!filters.due || dueState(t) === filters.due) && (!statusFilter || t.status === statusFilter),
  [filters.due, statusFilter]);

  const shown = useMemo(() => tasks.filter(visible), [tasks, visible]);
  const summary = useMemo(() => (loaded ? {
    open: tasks.filter((t) => t.status !== 'completed').length,
    overdue: tasks.filter((t) => dueState(t) === 'overdue').length,
  } : null), [tasks, loaded]);

  function onTaskChanged(t: Task) {
    setTasks((prev) => {
      const old = prev.find((x) => x.id === t.id);
      if (!serverMatch(t)) return prev.filter((x) => x.id !== t.id);
      if (!old) return [...prev, t];
      if (old.status !== t.status) return [...prev.filter((x) => x.id !== t.id), t];
      return prev.map((x) => (x.id === t.id ? t : x));
    });
  }

  async function cycleStatus(t: Task, to: TaskStatus) {
    const before = tasks;
    setTasks((prev) => [...prev.filter((x) => x.id !== t.id), { ...t, status: to }]);
    try {
      await api(`/tasks/${t.id}/move`, { method: 'PATCH', body: { status: to, position: 1_000_000 } });
    } catch (e) {
      setTasks(before);
      toast((e as Error).message);
    }
  }

  const filtered = FILTER_KEYS.some((k) => filters[k] && (k !== 'status' || view === 'list'));
  const ready = loaded && mobile !== null;

  return (
    <div className="space-y-6">
      <BoardToolbar
        filters={filters}
        users={users}
        types={types}
        meId={user?.id}
        view={view}
        mobile={mobile === true}
        summary={summary}
        onView={setView}
        onChange={setFilter}
        onClear={clearFilters}
        onNew={() => setShowNew(true)}
      />
      {!ready ? (
        view === 'list' ? <ListSkeleton /> : <BoardSkeleton />
      ) : tasks.length === 0 && !filtered ? (
        <EmptyState
          icon={ClipboardList}
          title="Todavía no hay tareas"
          action={<button className="btn-accent" onClick={() => setShowNew(true)}><Plus {...icon} /> Crear la primera tarea</button>}
        >
          Crea la primera para empezar a organizar el trabajo del equipo.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={SearchX}
          tone="neutral"
          title="Ninguna tarea coincide con estos filtros"
          action={<button className="btn" onClick={clearFilters}>Limpiar filtros</button>}
        >
          Prueba con otra combinación o quita los filtros.
        </EmptyState>
      ) : view === 'list' ? (
        <TaskListView tasks={shown} sort={filters.sort} onOpen={openTask} onCycle={cycleStatus} />
      ) : (
        <KanbanView tasks={tasks} setTasks={setTasks} visible={visible} onOpen={openTask} reload={loadTasks} />
      )}

      {mobile && (
        <button type="button" className="fab" aria-label="Nueva tarea" onClick={() => setShowNew(true)}>
          <Plus size={24} strokeWidth={2} aria-hidden />
        </button>
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
