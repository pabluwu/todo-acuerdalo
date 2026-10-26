'use client';

import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { icon } from '@/lib/icons';
import { Dialog } from './Dialog';
import { Field } from './Field';

/** Nombre de carpeta o archivo: lo mismo que valida el servidor, para avisar antes de pedir confirmación. */
export function nameProblem(raw: string): string {
  const name = raw.trim();
  if (!name) return 'Escribe un nombre.';
  if (/[/\\]/.test(name)) return 'El nombre no puede contener / ni \\.';
  if (name === '.' || name === '..') return 'Ese nombre no es válido.';
  return '';
}

/** Pide un nombre (nueva carpeta, renombrar…); `error` muestra el rechazo del servidor. */
export function NameDialog({
  title, label, initial, submitLabel, error, onSubmit, onClose,
}: {
  title: string;
  label: string;
  initial: string;
  submitLabel: string;
  error: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  const [name, setName] = useState(initial);
  const [problem, setProblem] = useState('');
  return (
    <Dialog labelledBy={headingId} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const p = nameProblem(name);
          setProblem(p);
          if (!p) onSubmit(name.trim());
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id={headingId} className="text-base font-semibold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-ghost btn-icon btn-sm -mr-2"><X {...icon} /></button>
        </div>
        <Field label={label} error={problem}>
          {(p) => <input {...p} autoFocus maxLength={300} className="w-full" value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />}
        </Field>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">Cancelar</button>
          <button className="btn-accent">{submitLabel}</button>
        </div>
      </form>
    </Dialog>
  );
}
