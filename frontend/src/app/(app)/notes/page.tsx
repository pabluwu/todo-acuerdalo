'use client';

import { Lock, NotebookPen, Plus, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { NewNoteDialog } from '@/components/notes/NewNoteDialog';
import { formatRelative, api } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import { plainExcerpt, type NoteSummary, type NoteVisibility } from '@/lib/types';

export default function NotesPage() {
  return (
    <Suspense>
      <NotesList />
    </Suspense>
  );
}

function NotesList() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const scope: NoteVisibility = params.get('scope') === 'private' ? 'private' : 'common';
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    setNotes(null);
    const t = setTimeout(() => {
      api<NoteSummary[]>(`/notes?scope=${scope}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}`)
        .then((n) => alive && setNotes(n))
        .catch((err) => { if (alive) { toast((err as Error).message); setNotes([]); } });
    }, query ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [scope, query, toast]);

  const setScope = (s: NoteVisibility) => router.replace(s === 'common' ? '/notes' : `/notes?scope=${s}`);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Notas</h1>
        <button onClick={() => setCreating(true)} className="btn-accent"><Plus {...icon} /> Nueva nota</button>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="seg" role="group" aria-label="Tipo de notas">
          <button type="button" aria-pressed={scope === 'common'} onClick={() => setScope('common')}><Users {...icon} /> Comunes</button>
          <button type="button" aria-pressed={scope === 'private'} onClick={() => setScope('private')}><Lock {...icon} /> Privadas</button>
        </div>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search {...icon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            aria-label="Buscar notas"
            placeholder="Buscar en título y contenido…"
            className="w-full pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {notes === null ? (
        <div aria-hidden className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={query ? 'Sin resultados' : scope === 'common' ? 'Aún no hay notas comunes' : 'Aún no tienes notas privadas'}
          action={!query && <button onClick={() => setCreating(true)} className="btn-accent"><Plus {...icon} /> Nueva nota</button>}
        >
          {query
            ? 'Prueba con otras palabras.'
            : scope === 'common'
              ? 'Las notas comunes las lee y edita todo el equipo, como una wiki.'
              : 'Las privadas solo las ves tú y quienes las compartan contigo.'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <Link href={`/notes/${n.id}`} className="card-surface card-surface-interactive block p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate text-sm font-semibold">{n.title}</h2>
                  {n.visibility === 'private' && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500" title={n.shared || n.myAccess !== 'owner' ? 'Privada, compartida' : 'Privada'}>
                      {n.shared || n.myAccess !== 'owner' ? <Users size={12} strokeWidth={1.5} aria-hidden /> : <Lock size={12} strokeWidth={1.5} aria-hidden />}
                      <span className="sr-only">{n.shared || n.myAccess !== 'owner' ? 'Privada, compartida' : 'Privada'}</span>
                    </span>
                  )}
                </div>
                {n.excerpt.trim() && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{plainExcerpt(n.excerpt)}</p>}
                <p className="mt-2 text-xs text-zinc-500">
                  {n.owner?.name ?? 'Autor eliminado'} · Editada {formatRelative(n.updatedAt)}
                  {n.myAccess === 'view' && ' · Solo lectura'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <NewNoteDialog
          initialVisibility={scope}
          onClose={() => setCreating(false)}
          onCreated={(n) => router.push(`/notes/${n.id}?edit=1`)}
        />
      )}
    </div>
  );
}
