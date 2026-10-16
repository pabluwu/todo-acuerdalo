'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { TableSkeleton } from '@/components/Skeletons';
import { api, formatDate } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';
import type { User } from '@/lib/types';

function UsersTable() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api<User[]>('/admin/users').then((u) => { setUsers(u); setLoaded(true); }).catch((e) => toast(e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function patch(id: string, body: Partial<Pick<User, 'isActive' | 'role'>>, done?: string) {
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body });
      if (done) toast(done, 'success');
      load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const pending = users.filter((u) => !u.isActive);
  const active = users.filter((u) => u.isActive);

  const row = (u: User) => (
    <tr key={u.id}>
      <td data-label="Nombre" className="font-medium">{u.name}</td>
      <td data-label="Correo" className="min-w-0 break-all text-zinc-600">{u.email}</td>
      <td data-label="Rol" className="text-zinc-600">{u.role === 'admin' ? 'Administrador' : 'Usuario'}</td>
      <td data-label="Registro" className="whitespace-nowrap tabular-nums text-zinc-500">{formatDate(u.createdAt)}</td>
      <td className="md:text-right max-md:!justify-start max-md:pt-2">
        <div className="flex flex-wrap gap-2 md:justify-end">
          {!u.isActive && <button className="btn-accent btn-sm" onClick={() => patch(u.id, { isActive: true }, `${u.name} ya puede acceder`)}>Aprobar</button>}
          {u.isActive && u.id !== me?.id && <button className="btn btn-sm" onClick={() => patch(u.id, { isActive: false })}>Desactivar</button>}
          {u.isActive && u.role === 'user' && <button className="btn btn-sm" onClick={() => patch(u.id, { role: 'admin' })}>Hacer admin</button>}
          {u.isActive && u.role === 'admin' && u.id !== me?.id && <button className="btn btn-sm" onClick={() => patch(u.id, { role: 'user' })}>Quitar admin</button>}
        </div>
      </td>
    </tr>
  );

  const table = (list: User[], empty: string, label: string) =>
    list.length === 0 ? (
      <p className="text-sm text-zinc-500">{empty}</p>
    ) : (
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="table-stack" aria-label={label}>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Correo</th>
              <th scope="col">Rol</th>
              <th scope="col">Registro</th>
              <th scope="col" className="text-right"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>{list.map(row)}</tbody>
        </table>
      </div>
    );

  return (
    <div className="space-y-10">
      <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
      {!loaded ? <TableSkeleton /> : (
        <>
          <section className="space-y-3">
            <h2 className="section-label">Pendientes de aprobación (<span className="tabular-nums">{pending.length}</span>)</h2>
            {table(pending, 'No hay solicitudes pendientes.', 'Usuarios pendientes')}
          </section>
          <section className="space-y-3">
            <h2 className="section-label">Activos (<span className="tabular-nums">{active.length}</span>)</h2>
            {table(active, 'Sin usuarios activos.', 'Usuarios activos')}
          </section>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <AdminGuard><UsersTable /></AdminGuard>;
}
