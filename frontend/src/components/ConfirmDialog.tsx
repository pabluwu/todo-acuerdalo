'use client';

import { useId } from 'react';
import { Dialog } from './Dialog';

/**
 * Confirmación genérica para cualquier acción que cambie datos.
 * `tone="danger"` para lo irreversible (eliminar); `accent` para guardar, crear o subir.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  tone = 'accent',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  /** Texto del botón mientras se ejecuta; por defecto, «Un momento…» */
  busyLabel?: string;
  tone?: 'danger' | 'accent';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const headingId = useId();
  return (
    <Dialog labelledBy={headingId} onClose={() => !busy && onCancel()}>
      <div className="space-y-4">
        <h2 id={headingId} className="text-base font-semibold tracking-tight">{title}</h2>
        {children && <div className="text-sm text-zinc-600">{children}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn" disabled={busy} autoFocus={tone === 'danger'}>Cancelar</button>
          <button
            type="button"
            onClick={onConfirm}
            className={tone === 'danger' ? 'btn-danger' : 'btn-accent'}
            disabled={busy}
            autoFocus={tone === 'accent'}
          >
            {busy ? busyLabel ?? 'Un momento…' : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
