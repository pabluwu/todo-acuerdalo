'use client';

import { Check, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, formatDate, fromLocalInput, toLocalInput } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import { PRIORITIES, STATUSES, type Task, type TaskType, type UserLite } from '@/lib/types';
import { AssigneePicker } from './AssigneePicker';
import { Comments } from './Comments';
import { Field } from './Field';
import { PanelSkeleton } from './Skeletons';

type SaveState = 'idle' | 'saving' | 'saved';

/** Cuerpo de una tarea (campos, comentarios, eliminar), compartido por el panel lateral y la página `/tasks/[id]`. */
export function TaskDetail({
  taskId,
  users,
  types,
  layout,
  headingId,
  headerActions,
  onChanged,
  onDeleted,
  onLoadError,
}: {
  taskId: string;
  users: UserLite[];
  types: TaskType[];
  layout: 'sheet' | 'page';
  headingId?: string;
  headerActions?: React.ReactNode;
  onChanged?: (t: Task) => void;
  onDeleted: (id: string) => void;
  onLoadError: (message: string) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const page = layout === 'page';
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);
  const [description, setDescription] = useState('');
  const [due, setDue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function sync(t: Task) {
    setTask(t);
    setTitle(t.title);
    setDescription(t.description);
    setDue(toLocalInput(t.dueDate));
  }

  useEffect(() => {
    setTask(null);
    api<Task>(`/tasks/${taskId}`)
      .then(sync)
      .catch((e) => onLoadError(e.message));
    return () => clearTimeout(savedTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function save(patch: Record<string, unknown>) {
    clearTimeout(savedTimer.current);
    setSaveState('saving');
    try {
      const updated = await api<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: patch });
      sync(updated);
      onChanged?.(updated);
      setSaveState('saved');
      savedTimer.current = setTimeout(() => setSaveState('idle'), 2500);
    } catch (e) {
      setSaveState('idle');
      toast((e as Error).message);
      if (task) sync(task);
    }
  }

  // La fecha se guarda al salir del campo o con Enter, nunca por pulsación:
  // cada guardado puede enviar un aviso por correo.
  function commitDue(input: HTMLInputElement) {
    if (!task) return;
    const original = toLocalInput(task.dueDate);
    if (input.validity.badInput) { setDue(original); return; }
    if (due !== original) save({ dueDate: fromLocalInput(due) });
  }

  async function remove() {
    try {
      await api(`/tasks/${taskId}`, { method: 'DELETE' });
      onDeleted(taskId);
      toast('Tarea eliminada', 'success');
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const canDelete = task && (user?.role === 'admin' || task.createdBy?.id === user?.id);
  // los tipos inactivos no se ofrecen, salvo el que ya tiene la tarea
  const typeOptions = task?.type && !types.some((t) => t.id === task.type!.id) ? [...types, task.type] : types;

  // en la página el título es el h1 (el textarea lo hace de forma visual)
  useEffect(() => {
    if (page && task) document.title = `${task.title} · Acuérdalo`;
  }, [page, task]);

  const Heading = page ? 'h1' : 'h2';
  const pad = page ? 'px-6 sm:px-10' : 'px-6 sm:px-8';

  return (
    <>
      <Heading id={headingId} className="sr-only">{task ? `Tarea: ${task.title}` : 'Cargando tarea'}</Heading>
      <div className={`flex items-center justify-between gap-3 border-b border-zinc-100 bg-white py-2.5 pr-3 ${page ? 'pl-6 sm:pl-10' : 'sticky top-0 z-10 pl-6 sm:pl-8'}`}>
        <span className="min-w-0 truncate text-xs tabular-nums text-zinc-500">{task ? `Creada ${formatDate(task.createdAt)}${task.createdBy ? ` por ${task.createdBy.name}` : ''}` : ''}</span>
        <div className="flex shrink-0 items-center gap-1">
          <span role="status" className="inline-flex items-center gap-1 text-xs text-zinc-500">
            {saveState === 'saving' && 'Guardando…'}
            {saveState === 'saved' && <><Check size={14} strokeWidth={1.5} aria-hidden className="text-emerald-600" /> Guardado</>}
          </span>
          {headerActions}
        </div>
      </div>
      {!task ? (
        <PanelSkeleton />
      ) : (
        <div className={`space-y-8 py-6 ${pad}`}>
          <div className="space-y-3">
            <textarea
              ref={titleRef}
              aria-label="Título de la tarea"
              rows={1}
              className={`-mx-3 h-auto w-[calc(100%+1.5rem)] resize-none overflow-hidden border-transparent py-1.5 ${page ? 'text-2xl' : 'text-xl'} font-semibold leading-snug tracking-tight text-balance hover:border-zinc-200`}
              value={title}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
              onBlur={() => title.trim() && title !== task.title ? save({ title }) : setTitle(task.title)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            />
            <textarea
              aria-label="Descripción"
              rows={4}
              placeholder="Añade una descripción…"
              className="-mx-3 w-[calc(100%+1.5rem)] resize-none border-transparent text-zinc-700 hover:border-zinc-200"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== task.description && save({ description })}
            />
          </div>

          <div className={`grid grid-cols-2 gap-4 ${page ? 'lg:grid-cols-4' : ''}`}>
            <Field label="Estado">
              {(p) => (
                <select {...p} className="w-full" value={task.status} onChange={(e) => save({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Prioridad">
              {(p) => (
                <select {...p} className="w-full" value={task.priority} onChange={(e) => save({ priority: e.target.value })}>
                  {PRIORITIES.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Tipo">
              {(p) => (
                <select {...p} className="w-full" value={task.type?.id ?? ''} onChange={(e) => save({ typeId: e.target.value })}>
                  {typeOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </Field>
            <Field
              label="Fecha límite"
              className="col-span-2 sm:col-span-1"
              action={(due || task.dueDate) && (
                <button type="button" className="inline-flex items-center gap-0.5 rounded text-xs text-zinc-600 hover:text-zinc-900" onClick={() => { setDue(''); save({ dueDate: null }); }}>
                  <X size={12} strokeWidth={1.5} aria-hidden /> Quitar fecha
                </button>
              )}
            >
              {(p) => (
                <input
                  {...p}
                  type="datetime-local"
                  className="w-full"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  onBlur={(e) => commitDue(e.currentTarget)}
                  onKeyDown={(e) => e.key === 'Enter' && commitDue(e.currentTarget)}
                />
              )}
            </Field>
            <Field label="Asignados" className={`col-span-2 ${page ? 'lg:col-span-4' : ''}`}>
              {(p) => <AssigneePicker id={p.id} users={users} value={task.assignees.map((a) => a.id)} onCommit={(ids) => save({ assigneeIds: ids })} />}
            </Field>
          </div>

          <hr className="border-zinc-100" />
          <Comments taskId={task.id} users={users} />

          {canDelete && (
            <div className="border-t border-zinc-100 pt-6">
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-zinc-700">¿Eliminar esta tarea y sus comentarios?</span>
                  <button className="btn-danger" onClick={remove}><Trash2 {...icon} /> Sí, eliminar</button>
                  <button className="btn" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn-ghost -ml-3 hover:!bg-red-50 hover:!text-red-700" onClick={() => setConfirmDelete(true)}><Trash2 {...icon} /> Eliminar tarea</button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
