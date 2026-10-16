'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { AdminGuard } from '@/components/AdminGuard';
import { TableSkeleton } from '@/components/Skeletons';
import { api, formatDate, formatRelative } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import { ACTION_LABELS, ENTITY_LABELS, type LogEntry, type Paginated } from '@/lib/types';

const PAGE_SIZE = 25;

function Logs() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<LogEntry> | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<Paginated<LogEntry>>(`/admin/logs?page=${page}&pageSize=${PAGE_SIZE}`).then(setData).catch((e) => toast(e.message));
  }, [page, toast]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Logs de auditoría</h1>
      {!data ? <TableSkeleton rows={6} /> : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="table-stack">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Fecha</th>
                <th scope="col">Usuario</th>
                <th scope="col">Acción</th>
                <th scope="col">Entidad</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => {
                const expanded = open === l.id;
                return (
                  <Fragment key={l.id}>
                    <tr className="cursor-pointer hover:bg-zinc-50" onClick={() => setOpen(expanded ? null : l.id)}>
                      <td data-label="#" className="tabular-nums text-zinc-500">{l.id}</td>
                      <td data-label="Fecha" className="whitespace-nowrap tabular-nums text-zinc-600">
                        <time dateTime={l.createdAt} title={formatDate(l.createdAt)}>{formatRelative(l.createdAt)}</time>
                      </td>
                      <td data-label="Usuario" className="break-all">{l.data.userEmail ?? <span className="text-zinc-500">sistema</span>}</td>
                      <td data-label="Acción">
                        <button type="button" aria-expanded={expanded} aria-controls={`log-${l.id}`} className="inline-flex items-center gap-1 rounded text-left">
                          <ChevronRight {...icon} className={`shrink-0 text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                          {ACTION_LABELS[l.data.action] ?? l.data.action}
                        </button>
                      </td>
                      <td data-label="Entidad" className="text-zinc-600">{ENTITY_LABELS[l.data.entity] ?? l.data.entity}</td>
                    </tr>
                    {expanded && (
                      <tr id={`log-${l.id}`} className="bg-zinc-50">
                        <td colSpan={5}>
                          <p className="mb-2 font-mono text-xs text-zinc-500">{l.data.action}</p>
                          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-700">{JSON.stringify(l.data, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data.items.length === 0 && (
                <tr><td colSpan={5} className="text-zinc-500">Sin registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
        <span className="tabular-nums">{data ? `${data.total} registros` : 'Cargando…'}</span>
        <div className="flex items-center gap-3">
          <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft {...icon} /> Anterior</button>
          <span className="tabular-nums">Página {page} de {pages}</span>
          <button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente <ChevronRight {...icon} /></button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <AdminGuard><Logs /></AdminGuard>;
}
