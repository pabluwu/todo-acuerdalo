'use client';

import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { api, fromLocalInput } from '@/lib/api';
import { PRIORITIES, STATUSES, type Task, type TaskType, type UserLite } from '@/lib/types';
import { icon } from '@/lib/icons';
import { AssigneePicker } from './AssigneePicker';
import { Dialog } from './Dialog';
import { Field } from './Field';

export function NewTaskDialog({
  users,
  types,
  onClose,
  onCreated,
  clientId,
  clientName,
}: {
  users: UserLite[];
  types: TaskType[];
  onClose: () => void;
  onCreated: (t: Task) => void;
  /** Si viene, la tarea queda ligada a este cliente. */
  clientId?: string;
  clientName?: string;
}) {
  const headingId = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('not_started');
  const [due, setDue] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const task = await api<Task>('/tasks', {
        method: 'POST',
        body: { title, description, typeId, priority, status, dueDate: fromLocalInput(due), assigneeIds: assignees, ...(clientId ? { clientId } : {}) },
      });
      onCreated(task);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog labelledBy={headingId} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 id={headingId} className="text-base font-semibold tracking-tight">{clientName ? `Nueva tarea para ${clientName}` : 'Nueva tarea'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
        </div>
        <Field label="Título">
          {(p) => <input {...p} autoFocus required className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Descripción">
          {(p) => <textarea {...p} rows={3} className="w-full resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            {(p) => (
              <select {...p} required className="w-full" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Prioridad">
            {(p) => (
              <select {...p} className="w-full" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Estado">
            {(p) => (
              <select {...p} className="w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Fecha límite">
            {(p) => <input {...p} type="datetime-local" className="w-full" value={due} onChange={(e) => setDue(e.target.value)} />}
          </Field>
        </div>
        <Field label="Asignados">
          {(p) => <AssigneePicker id={p.id} users={users} value={assignees} onCommit={setAssignees} />}
        </Field>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn-accent" disabled={busy || !typeId}>{busy ? 'Creando…' : 'Crear tarea'}</button>
        </div>
      </form>
    </Dialog>
  );
}
