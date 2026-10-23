'use client';

import { BriefcaseBusiness, FileText, NotebookPen, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { api, formatRelative } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { ClientSummary } from '@/lib/types';

export default function ClientsPage() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<ClientSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    setClients(null);
    const t = setTimeout(() => {
      api<ClientSummary[]>(`/clients${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)
        .then((c) => alive && setClients(c))
        .catch((err) => { if (alive) { toast((err as Error).message); setClients([]); } });
    }, query ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [query, toast]);

  const newButton = <Link href="/clients/new" className="btn-accent"><Plus {...icon} /> Nuevo cliente</Link>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        {newButton}
      </div>
      <div className="relative mb-5 min-w-0 sm:max-w-xs">
        <Search {...icon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          aria-label="Buscar clientes"
          placeholder="Buscar por nombre, RUT, materia o demandado…"
          className="w-full pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {clients === null ? (
        <div aria-hidden className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 w-full" />)}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={query ? 'Sin resultados' : 'Aún no hay clientes'}
          action={!query && newButton}
        >
          {query ? 'Prueba con otras palabras o con el RUT.' : 'Registra a un cliente cuando tengas una asesoría: su ficha, sus notas y sus archivos quedan juntos.'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="card-surface card-surface-interactive block p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate text-sm font-semibold">{c.name}</h2>
                  {c.rut && <span className="shrink-0 text-xs tabular-nums text-zinc-500">{c.rut}</span>}
                </div>
                {c.matter && <p className="mt-1 line-clamp-1 text-sm text-zinc-600">{c.matter}</p>}
                {c.defendantName && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">Demandado: {c.defendantName}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span>Editado {formatRelative(c.updatedAt)}{c.updatedBy ? ` por ${c.updatedBy.name}` : ''}</span>
                  <span className="inline-flex items-center gap-1"><NotebookPen size={12} strokeWidth={1.5} aria-hidden /> {c.noteCount} {c.noteCount === 1 ? 'nota' : 'notas'}</span>
                  <span className="inline-flex items-center gap-1"><FileText size={12} strokeWidth={1.5} aria-hidden /> {c.fileCount} {c.fileCount === 1 ? 'archivo' : 'archivos'}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
