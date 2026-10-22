'use client';

import { ArrowLeft, ExternalLink, FileQuestion, Link2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { TaskType, UserLite } from '@/lib/types';
import { EmptyState } from './EmptyState';
import { TaskDetail } from './TaskDetail';

/** Tarea a pantalla completa en `/tasks/[id]`: el enlace que se comparte y que llega en los correos. */
export function TaskPage({ taskId }: { taskId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api<UserLite[]>('/users').then(setUsers).catch(() => undefined);
    api<TaskType[]>('/task-types').then(setTypes).catch(() => undefined);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/tasks/${taskId}`);
      toast('Enlace copiado', 'success');
    } catch {
      toast('No se pudo copiar el enlace');
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={FileQuestion}
          title="No encontramos esta tarea"
          tone="neutral"
          action={<Link href="/" className="btn-accent">Ir al tablero</Link>}
        >
          Puede que se haya eliminado o que el enlace no sea correcto.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="btn-ghost -ml-3"><ArrowLeft {...icon} /> Volver al tablero</Link>
        <div className="flex items-center gap-1">
          <button onClick={copyLink} className="btn-ghost"><Link2 {...icon} /> Copiar enlace</button>
          <Link href={`/?task=${taskId}`} className="btn-ghost"><ExternalLink {...icon} /> Abrir en el tablero</Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <TaskDetail
          taskId={taskId}
          users={users}
          types={types}
          layout="page"
          onDeleted={() => router.push('/')}
          onLoadError={() => setNotFound(true)}
        />
      </div>
    </div>
  );
}
