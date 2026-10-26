'use client';

import { CalendarDays, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { CalendarEvent, ExternalContact, UserLite } from '@/lib/types';
import { EmptyState } from '../EmptyState';
import { ListSkeleton } from '../Skeletons';
import { EventDetail } from '../calendar/EventDetail';
import { EventDialog } from '../calendar/EventDialog';
import { EventRow } from '../calendar/EventRows';

interface ClientEvents {
  contact: ExternalContact | null;
  events: CalendarEvent[];
}

/** Reuniones del cliente: eventos del calendario que incluyen su contacto vinculado. */
export function ClientMeetings({ clientId, clientName }: { clientId: string; clientName: string }) {
  const toast = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<ClientEvents | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const load = useCallback(() => {
    api<ClientEvents>(`/events/client/${clientId}`)
      .then(setData)
      .catch((e) => { toast((e as Error).message); setData({ contact: null, events: [] }); });
  }, [clientId, toast]);
  useEffect(load, [load]);
  useEffect(() => { api<UserLite[]>('/users').then(setUsers).catch(() => undefined); }, []);

  // las próximas de la más cercana a la más lejana; las pasadas, de la más reciente a la más antigua
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const events = data?.events ?? [];
    return {
      upcoming: events.filter((e) => new Date(e.endAt).getTime() >= now).reverse(),
      past: events.filter((e) => new Date(e.endAt).getTime() < now),
    };
  }, [data]);

  const opened = data?.events.find((e) => e.id === openId) ?? null;
  const canEdit = (e: CalendarEvent) => !!user && (user.role === 'admin' || e.createdBy?.id === user.id);

  async function removeEvent(id: string) {
    try {
      await api(`/events/${id}`, { method: 'DELETE' });
      setOpenId(null);
      toast('Evento eliminado', 'success');
      load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const newButton = <button className="btn-accent" onClick={() => setCreating(true)}><Plus {...icon} /> Nueva reunión</button>;
  const group = (title: string, list: CalendarEvent[]) => list.length > 0 && (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-zinc-700">{title}</h2>
      <div className="card-surface divide-y divide-zinc-100 overflow-hidden">
        {list.map((e) => <EventRow key={e.id} event={e} color={e.color || 'accent'} onOpen={setOpenId} />)}
      </div>
    </section>
  );

  const contactValue = data?.contact ? [{ id: data.contact.id, name: data.contact.name, email: data.contact.email, clientId: data.contact.clientId }] : undefined;

  return (
    <div className="space-y-5">
      {data === null ? (
        <ListSkeleton />
      ) : data.events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Este cliente no tiene reuniones" action={newButton}>
          Agenda una reunión y aparecerá también en el calendario del equipo.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {data.contact ? (
              <Link href={`/calendar?contacts=${data.contact.id}`} className="btn-ghost -ml-3"><CalendarDays {...icon} /> Ver en el calendario</Link>
            ) : <span />}
            {newButton}
          </div>
          {group('Próximas', upcoming)}
          {group('Pasadas', past)}
        </>
      )}
      {openId && !editing && (
        <EventDetail
          event={opened}
          colorKey={opened?.color || 'accent'}
          canEdit={!!opened && canEdit(opened)}
          onClose={() => setOpenId(null)}
          onEdit={() => opened && setEditing(opened)}
          onDelete={() => removeEvent(openId)}
        />
      )}
      {(creating || editing) && (
        <EventDialog
          users={users}
          event={editing}
          initialTitle={`Reunión con ${clientName}`}
          initialExternals={contactValue}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => {
            toast(editing ? 'Evento actualizado' : 'Evento creado', 'success');
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
