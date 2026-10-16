'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { icon } from '@/lib/icons';
import type { UserLite } from '@/lib/types';
import { Avatar } from './Avatar';

/** Selector múltiple de asignados. Confirma los cambios al cerrar el desplegable. */
export function AssigneePicker({
  id,
  users,
  value,
  onCommit,
  placeholder = 'Sin asignar',
}: {
  id?: string;
  users: UserLite[];
  value: string[];
  onCommit: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => { if (!open) setDraft(value); }, [value, open]);

  function close() {
    setOpen(false);
    const a = [...draftRef.current].sort().join(',');
    const b = [...value].sort().join(',');
    if (a !== b) onCommit(draftRef.current);
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const selected = users.filter((u) => value.includes(u.id));

  // Escape cancela la selección y cierra solo el desplegable, no el diálogo
  function onKeyDown(e: React.KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      setDraft(value);
      setOpen(false);
      btnRef.current?.focus();
    }
  }

  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown}>
      <button id={id} ref={btnRef} type="button" aria-expanded={open} aria-haspopup="true" onClick={() => (open ? close() : setOpen(true))} className="flex min-h-9 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-left text-sm hover:border-zinc-300">
        {selected.length === 0 ? (
          <span className="text-zinc-500">{placeholder}</span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            {selected.map((u) => (
              <span key={u.id} className="flex items-center gap-1.5"><Avatar name={u.name} decorative /><span className="text-zinc-700">{u.name}</span></span>
            ))}
          </span>
        )}
        <ChevronDown {...icon} className="ml-auto shrink-0 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-md">
          {users.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-indigo-600"
                checked={draft.includes(u.id)}
                onChange={(e) => setDraft(e.target.checked ? [...draft, u.id] : draft.filter((x) => x !== u.id))}
              />
              <Avatar name={u.name} decorative />
              <span>{u.name}</span>
            </label>
          ))}
          <div className="border-t border-zinc-100 p-1 pt-2">
            <button type="button" className="btn-accent w-full" onClick={close}>Listo</button>
          </div>
        </div>
      )}
    </div>
  );
}
