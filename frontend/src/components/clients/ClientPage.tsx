'use client';

import { ArrowLeft, CalendarDays, FileQuestion, FolderOpen, IdCard, ListChecks, NotebookPen } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Client } from '@/lib/types';
import { EmptyState } from '../EmptyState';
import { PanelSkeleton } from '../Skeletons';
import { ClientFiles } from './ClientFiles';
import { ClientMeetings } from './ClientMeetings';
import { ClientNotes } from './ClientNotes';
import { ClientProfile } from './ClientProfile';
import { ClientTasks } from './ClientTasks';

type Tab = 'ficha' | 'tareas' | 'reuniones' | 'notas' | 'archivos';
const TABS: { id: Tab; label: string; icon: typeof IdCard }[] = [
  { id: 'ficha', label: 'Ficha', icon: IdCard },
  { id: 'tareas', label: 'Tareas', icon: ListChecks },
  { id: 'reuniones', label: 'Reuniones', icon: CalendarDays },
  { id: 'notas', label: 'Notas', icon: NotebookPen },
  { id: 'archivos', label: 'Archivos', icon: FolderOpen },
];

/** Cliente a pantalla completa en `/clients/[id]`, con pestañas sincronizadas con `?tab=`. */
export function ClientPage({ clientId }: { clientId: string }) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'tareas' || raw === 'reuniones' || raw === 'notas' || raw === 'archivos' ? raw : 'ficha';
  const [client, setClient] = useState<Client | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    api<Client>(`/clients/${clientId}`)
      .then((c) => alive && setClient(c))
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setNotFound(true);
        else toast((err as Error).message);
      });
    return () => { alive = false; };
  }, [clientId, toast]);

  const setTab = (t: Tab) => router.replace(t === 'ficha' ? `/clients/${clientId}` : `/clients/${clientId}?tab=${t}`, { scroll: false });

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState icon={FileQuestion} title="No encontramos este cliente" tone="neutral" action={<Link href="/clients" className="btn-accent">Ir a los clientes</Link>}>
          Puede que se haya eliminado o que el enlace no sea correcto.
        </EmptyState>
      </div>
    );
  }
  if (!client) return <div className="mx-auto max-w-4xl"><PanelSkeleton /></div>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/clients" className="btn-ghost -ml-3 mb-3"><ArrowLeft {...icon} /> Volver a los clientes</Link>
      <header className="mb-5">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{client.name}</h1>
        {(client.rut || client.matter) && (
          <p className="mt-1 text-sm text-zinc-600">
            {client.rut && <span className="tabular-nums">{client.rut}</span>}
            {client.rut && client.matter && ' · '}
            {client.matter}
          </p>
        )}
      </header>
      <div className="seg mb-5 w-full sm:w-auto" role="group" aria-label="Secciones del cliente">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}><t.icon {...icon} /> {t.label}</button>
        ))}
      </div>
      {tab === 'ficha' && <ClientProfile client={client} onChange={setClient} />}
      {tab === 'tareas' && <ClientTasks clientId={clientId} clientName={client.name} />}
      {tab === 'reuniones' && <ClientMeetings clientId={clientId} clientName={client.name} />}
      {tab === 'notas' && <ClientNotes clientId={clientId} />}
      {tab === 'archivos' && <ClientFiles clientId={clientId} clientName={client.name} />}
    </div>
  );
}
