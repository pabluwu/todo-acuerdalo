'use client';

import { ListChecks, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Task, TaskStatus, TaskType, UserLite } from '@/lib/types';
import { EmptyState } from '../EmptyState';
import { NewTaskDialog } from '../NewTaskDialog';
import { ListSkeleton } from '../Skeletons';
import { TaskListView } from '../TaskListView';
import { TaskPanel } from '../TaskPanel';

/** Tareas internas del cliente, repartidas entre usuarios; también aparecen en el dashboard de los asignados. */
export function ClientTasks({ clientId, clientName }: { clientId: string; clientName: string }) {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    api<Task[]>(`/tasks?clientId=${clientId}`)
      .then(setTasks)
      .catch((e) => { toast((e as Error).message); setTasks([]); });
  }, [clientId, toast]);
  useEffect(load, [load]);
  useEffect(() => {
    api<UserLite[]>('/users').then(setUsers).catch(() => undefined);
    api<TaskType[]>('/task-types').then(setTypes).catch(() => undefined);
  }, []);

  async function cycleStatus(t: Task, to: TaskStatus) {
    const before = tasks;
    setTasks((prev) => prev && [...prev.filter((x) => x.id !== t.id), { ...t, status: to }]);
    try {
      await api(`/tasks/${t.id}/move`, { method: 'PATCH', body: { status: to, position: 1_000_000 } });
    } catch (e) {
      setTasks(before);
      toast((e as Error).message);
    }
  }

  // si la tarea deja de ser de este cliente, sale de la lista
  function onChanged(t: Task) {
    setTasks((prev) => {
      if (!prev) return prev;
      if (t.client?.id !== clientId) return prev.filter((x) => x.id !== t.id);
      return prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t];
    });
  }

  const newButton = <button className="btn-accent" onClick={() => setShowNew(true)}><Plus {...icon} /> Nueva tarea</button>;

  return (
    <div className="space-y-4">
      {tasks === null ? (
        <ListSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="Este cliente no tiene tareas" action={newButton}>
          Crea tareas internas para repartir el trabajo del caso entre el equipo.
        </EmptyState>
      ) : (
        <>
          <div className="flex justify-end">{newButton}</div>
          <TaskListView tasks={tasks} sort="manual" onOpen={setOpenId} onCycle={cycleStatus} />
        </>
      )}
      {openId && (
        <TaskPanel
          taskId={openId}
          users={users}
          types={types}
          onClose={() => setOpenId(null)}
          onChanged={onChanged}
          onDeleted={(id) => { setTasks((p) => p && p.filter((t) => t.id !== id)); setOpenId(null); }}
        />
      )}
      {showNew && (
        <NewTaskDialog
          users={users}
          types={types}
          clientId={clientId}
          clientName={clientName}
          onClose={() => setShowNew(false)}
          onCreated={(t) => { setShowNew(false); onChanged(t); setOpenId(t.id); }}
        />
      )}
    </div>
  );
}
