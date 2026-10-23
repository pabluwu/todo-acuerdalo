'use client';

import { Plus, UserRound, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { isEmail } from '@/lib/calendar';
import { icon } from '@/lib/icons';
import type { ExternalContact } from '@/lib/types';

export interface ContactValue {
  id?: string;
  name: string;
  /** Los clientes pueden no tener correo */
  email: string | null;
  clientId?: string | null;
}

/** «Cliente» si el contacto está vinculado a una ficha de cliente; si no, «Externo». */
export function ExternalTag({ client = false }: { client?: boolean }) {
  return <span className="shrink-0 rounded border border-zinc-200 px-1.5 py-px text-[11px] leading-4 text-zinc-600">{client ? 'Cliente' : 'Externo'}</span>;
}

/** Los contactos del directorio se identifican por `id`; los nuevos (sin id) por su correo. */
const keyOf = (c: { id?: string; email: string | null }) => c.id ?? (c.email ?? '').toLowerCase();

/**
 * Selector de contactos externos del directorio. Si no hay coincidencia permite
 * agregar uno nuevo en línea (nombre + correo válido). Solo seguimiento: nunca se les escribe.
 */
export function ContactPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: ContactValue[];
  onChange: (v: ContactValue[]) => void;
}) {
  const listId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ExternalContact[]>([]);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [formError, setFormError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api<ExternalContact[]>(`/contacts?q=${encodeURIComponent(q.trim())}`).then(setResults).catch(() => setResults([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const takenIds = new Set(value.filter((v) => v.id).map((v) => v.id));
  const takenEmails = new Set(value.filter((v) => v.email).map((v) => v.email!.toLowerCase()));
  const options = results.filter((c) => !takenIds.has(c.id) && !(c.email && takenEmails.has(c.email.toLowerCase()))).slice(0, 30);
  const term = q.trim();
  const exact = results.some((c) => c.email?.toLowerCase() === term.toLowerCase());
  const canAdd = term.length > 0 && !exact && !takenEmails.has(term.toLowerCase());
  const rows = canAdd ? options.length + 1 : options.length;

  function pick(c: ExternalContact) {
    onChange([...value, { id: c.id, name: c.name, email: c.email, clientId: c.clientId }]);
    setQ('');
    setActive(0);
    inputRef.current?.focus();
  }

  function startAdd() {
    const looksEmail = term.includes('@');
    setNewEmail(looksEmail ? term : '');
    setNewName(looksEmail ? '' : term);
    setFormError('');
    setAdding(true);
    setOpen(false);
  }

  function confirmAdd() {
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name) return setFormError('Escribe el nombre de la persona.');
    if (!isEmail(email)) return setFormError('Escribe un correo válido, por ejemplo nombre@empresa.com.');
    if (takenEmails.has(email.toLowerCase())) return setFormError('Esa persona ya está en el evento.');
    onChange([...value, { name, email }]);
    setAdding(false);
    setOpen(false);
    setQ('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Enter nunca envía el formulario del evento desde este selector
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
    if (e.key === 'Escape' && (open || adding)) {
      e.preventDefault();
      setOpen(false);
      setAdding(false);
      return;
    }
    if (!open && (e.key === 'ArrowDown')) { setOpen(true); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < options.length) pick(options[active]);
      else if (canAdd) startAdd();
    }
  }

  return (
    <div ref={ref} className="space-y-2" onKeyDown={onKeyDown}>
      {value.length > 0 && (
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
          {value.map((c) => (
            <li key={keyOf(c)} className="flex items-center gap-2 px-3 py-2 text-sm">
              <UserRound {...icon} className="shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate font-medium text-zinc-800">{c.name}</span>
                  <ExternalTag client={!!c.clientId} />
                </span>
                {c.email && <span className="block truncate text-xs text-zinc-500">{c.email}</span>}
              </span>
              <button type="button" aria-label={`Quitar a ${c.name}`} className="btn-ghost btn-icon btn-sm shrink-0" onClick={() => onChange(value.filter((v) => keyOf(v) !== keyOf(c)))}>
                <X {...icon} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows > 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className="w-full"
          placeholder="Buscar cliente o contacto…"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); setAdding(false); }}
        />
        {open && (
          <ul id={listId} role="listbox" aria-label="Clientes y contactos externos" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-md">
            {options.map((c, i) => (
              <li
                key={c.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 text-sm ${i === active ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{c.name}</span>
                  {c.clientId && <ExternalTag client />}
                </span>
                {c.email && <span className="truncate text-xs text-zinc-500">{c.email}</span>}
              </li>
            ))}
            {canAdd && (
              <li
                id={`${listId}-${options.length}`}
                role="option"
                aria-selected={active === options.length}
                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-accent ${active === options.length ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}
                onMouseEnter={() => setActive(options.length)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={startAdd}
              >
                <Plus {...icon} className="shrink-0" /> <span className="truncate">Agregar «{term}» al directorio</span>
              </li>
            )}
            {options.length === 0 && !canAdd && <li className="px-2 py-2 text-sm text-zinc-500">{term ? 'Ese contacto ya está agregado.' : 'Aún no hay clientes ni contactos en el directorio.'}</li>}
          </ul>
        )}
      </div>

      {adding && (
        <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
          <p className="text-xs text-zinc-600">Nuevo contacto externo. Se guarda en el directorio para reutilizarlo.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`${listId}-n`}>Nombre</label>
              <input id={`${listId}-n`} autoFocus className="w-full" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd(); } }} />
            </div>
            <div>
              <label className="label" htmlFor={`${listId}-e`}>Correo</label>
              <input id={`${listId}-e`} type="email" inputMode="email" aria-invalid={formError.includes('correo') ? true : undefined} className="w-full" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd(); } }} />
            </div>
          </div>
          {formError && <p role="alert" className="text-xs text-red-700">{formError}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-accent btn-sm" onClick={confirmAdd}>Agregar contacto</button>
            <button type="button" className="btn btn-sm" onClick={() => setAdding(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
