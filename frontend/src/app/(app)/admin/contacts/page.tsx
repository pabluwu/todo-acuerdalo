'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { TableSkeleton } from '@/components/Skeletons';
import { api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { ExternalContact } from '@/lib/types';

function ContactsTable() {
  const toast = useToast();
  const [contacts, setContacts] = useState<ExternalContact[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ExternalContact[]>('/contacts').then(setContacts).catch((e) => toast(e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function save(id: string) {
    try {
      await api(`/contacts/${id}`, { method: 'PATCH', body: { name, email } });
      setEditing(null);
      toast('Contacto actualizado', 'success');
      load();
    } catch (e) { toast((e as Error).message); }
  }

  async function remove(id: string) {
    try {
      await api(`/contacts/${id}`, { method: 'DELETE' });
      setConfirm(null);
      toast('Contacto eliminado', 'success');
      load();
    } catch (e) { toast((e as Error).message); }
  }

  const term = q.trim().toLowerCase();
  const list = (contacts ?? []).filter((c) => !term || c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Contactos externos</h1>
        <p className="max-w-2xl text-sm text-zinc-600">Personas ajenas al equipo que se agregan a los eventos del calendario. Son solo para seguimiento: nunca reciben correos. Eliminar un contacto lo quita de todos los eventos.</p>
      </div>
      <input aria-label="Buscar contactos" className="w-full max-w-sm" placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} />
      {!contacts ? <TableSkeleton /> : list.length === 0 ? (
        <p className="text-sm text-zinc-500">{contacts.length === 0 ? 'Aún no hay contactos. Se crean al agregar personas externas a un evento.' : 'Ningún contacto coincide con la búsqueda.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="table-stack" aria-label="Contactos externos">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col" className="text-right"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => editing === c.id ? (
                <tr key={c.id}>
                  <td data-label="Nombre"><input aria-label="Nombre" autoFocus className="w-full md:max-w-xs" value={name} onChange={(e) => setName(e.target.value)} /></td>
                  <td data-label="Correo"><input aria-label="Correo" type="email" className="w-full md:max-w-xs" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save(c.id)} /></td>
                  <td className="md:text-right max-md:!justify-start max-md:pt-2">
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button className="btn-accent btn-sm" onClick={() => save(c.id)}>Guardar</button>
                      <button className="btn btn-sm" onClick={() => setEditing(null)}>Cancelar</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td data-label="Nombre" className="font-medium">{c.name}</td>
                  <td data-label="Correo" className="min-w-0 break-all text-zinc-600">{c.email}</td>
                  <td className="md:text-right max-md:!justify-start max-md:pt-2">
                    {confirm === c.id ? (
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <span className="text-xs text-zinc-600">¿Eliminar de todos los eventos?</span>
                        <button className="btn-danger btn-sm" onClick={() => remove(c.id)}>Sí, eliminar</button>
                        <button className="btn btn-sm" onClick={() => setConfirm(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <button className="btn btn-sm" onClick={() => { setEditing(c.id); setName(c.name); setEmail(c.email); }}><Pencil {...icon} /> Editar</button>
                        <button className="btn btn-sm" onClick={() => setConfirm(c.id)}><Trash2 {...icon} /> Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <AdminGuard><ContactsTable /></AdminGuard>;
}
