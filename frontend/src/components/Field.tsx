'use client';

import { useId } from 'react';

interface ControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

/** Etiqueta asociada al control, con pista y error en línea. */
export function Field({
  label,
  error,
  hint,
  action,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  /** Acción secundaria alineada a la derecha de la etiqueta */
  action?: React.ReactNode;
  className?: string;
  children: (props: ControlProps) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs text-zinc-600" htmlFor={id}>{label}</label>
        {action}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
