'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_COPY_EMAILS = 10;

/** Lista de correos como chips: Enter, coma o salir del campo agrega; × quita. */
export function EmailListInput({
  id,
  value,
  onChange,
  ownEmail,
}: {
  id?: string;
  value: string[];
  onChange: (emails: string[]) => void;
  /** Correo del propio usuario: no tiene sentido copiarlo a sí mismo */
  ownEmail?: string;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const errorId = `${id ?? 'emails'}-error`;

  function add(raw: string) {
    const parts = raw.split(/[,;\s]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const p of parts) {
      if (!EMAIL_RE.test(p)) return setError(`"${p}" no es un correo válido`);
      if (p === ownEmail?.toLowerCase()) return setError('Ese es tu propio correo; ya recibes los mensajes');
      if (!next.includes(p)) next.push(p);
    }
    if (next.length > MAX_COPY_EMAILS) return setError(`Máximo ${MAX_COPY_EMAILS} correos`);
    onChange(next);
    setDraft('');
    setError('');
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-white p-1.5 focus-within:border-accent">
        {value.map((e) => (
          <span key={e} className="chip">
            {e}
            <button type="button" aria-label={`Quitar ${e}`} onClick={() => onChange(value.filter((x) => x !== e))}>
              <X size={12} strokeWidth={1.5} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          inputMode="email"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={value.length === 0 ? 'correo@ejemplo.com' : 'Agregar otro'}
          className="min-w-[10rem] flex-1 !border-0 !p-1 !shadow-none !ring-0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
            else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
        />
      </div>
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
