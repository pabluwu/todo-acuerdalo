'use client';

import Link from 'next/link';
import { Avatar } from '../Avatar';
import { ExternalTag } from './ContactPicker';
import type { ExternalContact, UserLite } from '@/lib/types';

/** Filtros de agenda: personas (con su color), contactos externos y capa de tareas. */
export function CalendarFilters({
  users,
  meId,
  colorOf,
  selectedUsers,
  onUsers,
  contacts,
  selectedContacts,
  onContacts,
  showTasks,
  onShowTasks,
}: {
  users: UserLite[];
  meId: string;
  colorOf: (userId: string) => string;
  selectedUsers: string[];
  onUsers: (ids: string[]) => void;
  contacts: ExternalContact[];
  selectedContacts: string[];
  onContacts: (ids: string[]) => void;
  showTasks: boolean;
  onShowTasks: (on: boolean) => void;
}) {
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const onlyMe = selectedUsers.length === 1 && selectedUsers[0] === meId;
  const check = 'h-3.5 w-3.5 shrink-0 accent-indigo-600';

  return (
    <div className="space-y-6">
      <section aria-labelledby="f-people" className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 id="f-people" className="section-label">Personas</h3>
          <div className="flex gap-1">
            <button type="button" aria-pressed={onlyMe} className={`btn btn-sm ${onlyMe ? '!border-accent !text-accent' : ''}`} onClick={() => onUsers([meId])}>Mi agenda</button>
            <button type="button" aria-pressed={selectedUsers.length === 0} className={`btn btn-sm ${selectedUsers.length === 0 ? '!border-accent !text-accent' : ''}`} onClick={() => onUsers([])}>Todos</button>
          </div>
        </div>
        <ul className="-mx-1 space-y-px">
          {users.map((u) => (
            <li key={u.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-zinc-50 max-md:py-2">
                <input type="checkbox" className={check} checked={selectedUsers.includes(u.id)} onChange={() => onUsers(toggle(selectedUsers, u.id))} />
                <Avatar name={u.name} decorative />
                <span className="min-w-0 flex-1 truncate text-zinc-800">{u.name}{u.id === meId && <span className="text-zinc-500"> (tú)</span>}</span>
                <span className={`ev-c-${colorOf(u.id)}`} title="Color en el calendario"><span className="cal-dot" /></span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">
          {selectedUsers.length === 0 ? 'Sin selección se muestran todos los eventos.' : selectedUsers.length > 1 ? 'Cada evento toma el color de la primera persona seleccionada que participa.' : 'Mostrando la agenda de una persona.'}
        </p>
      </section>

      {contacts.length > 0 && (
        <section aria-labelledby="f-contacts" className="space-y-2.5">
          <h3 id="f-contacts" className="section-label">Clientes y personas externas</h3>
          <ul className="-mx-1 max-h-56 space-y-px overflow-y-auto">
            {contacts.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-zinc-50 max-md:py-2">
                  <input type="checkbox" className={check} checked={selectedContacts.includes(c.id)} onChange={() => onContacts(toggle(selectedContacts, c.id))} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-zinc-800">{c.name}</span>
                      {c.clientId && <ExternalTag client />}
                    </span>
                    {c.email && <span className="block truncate text-xs text-zinc-500">{c.email}</span>}
                  </span>
                  {c.clientId && (
                    <Link href={`/clients/${c.clientId}`} className="shrink-0 text-xs text-accent hover:underline" aria-label={`Abrir la ficha de ${c.name}`}>Ficha</Link>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="f-layers" className="space-y-2.5">
        <h3 id="f-layers" className="section-label">Capas</h3>
        <label className="-mx-1 flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-zinc-50 max-md:py-2">
          <input type="checkbox" className={check} checked={showTasks} onChange={(e) => onShowTasks(e.target.checked)} />
          <span className="text-zinc-800">Mostrar tareas con fecha límite</span>
        </label>
      </section>
    </div>
  );
}
