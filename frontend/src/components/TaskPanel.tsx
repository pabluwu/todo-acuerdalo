'use client';

import { Link2, Maximize2, X } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Task, TaskType, UserLite } from '@/lib/types';
import { Dialog } from './Dialog';
import { TaskDetail } from './TaskDetail';

export function TaskPanel({
  taskId,
  users,
  types,
  onClose,
  onChanged,
  onDeleted,
}: {
  taskId: string;
  users: UserLite[];
  types: TaskType[];
  onClose: () => void;
  onChanged: (t: Task) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const headingId = useId();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/tasks/${taskId}`);
      toast('Enlace copiado', 'success');
    } catch {
      toast('No se pudo copiar el enlace');
    }
  }

  return (
    <Dialog variant="sheet" labelledBy={headingId} onClose={onClose}>
      <TaskDetail
        taskId={taskId}
        users={users}
        types={types}
        layout="sheet"
        headingId={headingId}
        onChanged={onChanged}
        onDeleted={onDeleted}
        onLoadError={(message) => { toast(message); onClose(); }}
        headerActions={(
          <>
            <button onClick={copyLink} aria-label="Copiar enlace" title="Copiar enlace" className="btn-ghost btn-icon"><Link2 {...icon} /></button>
            <Link href={`/tasks/${taskId}`} aria-label="Abrir en pantalla completa" title="Pantalla completa" className="btn-ghost btn-icon"><Maximize2 {...icon} /></Link>
            <button onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon"><X {...icon} /></button>
          </>
        )}
      />
    </Dialog>
  );
}
