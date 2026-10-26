'use client';

import { Check, CircleAlert, LoaderCircle, X } from 'lucide-react';
import { icon } from '@/lib/icons';

export interface Upload {
  key: number;
  name: string;
  status: 'waiting' | 'uploading' | 'done' | 'error';
  error?: string;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const isUploading = (uploads: Upload[]) => uploads.some((u) => u.status === 'waiting' || u.status === 'uploading');

/** Progreso de una subida de varios archivos, uno por fila. */
export function UploadList({ uploads, onDismiss }: { uploads: Upload[]; onDismiss: () => void }) {
  if (uploads.length === 0) return null;
  const uploading = isUploading(uploads);
  return (
    <section aria-label="Subida de archivos" className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="section-label">{uploading ? 'Subiendo archivos…' : 'Subida terminada'}</h2>
        {!uploading && <button type="button" onClick={onDismiss} className="btn-ghost btn-icon btn-sm" aria-label="Cerrar el resumen de subida"><X {...icon} /></button>}
      </div>
      <ul className="space-y-1.5" role="status">
        {uploads.map((u) => (
          <li key={u.key} className="flex items-start gap-2 text-sm">
            {u.status === 'uploading' && <LoaderCircle {...icon} className="mt-0.5 shrink-0 animate-spin text-accent" />}
            {u.status === 'waiting' && <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-zinc-300" aria-hidden />}
            {u.status === 'done' && <Check {...icon} className="mt-0.5 shrink-0 text-emerald-600" />}
            {u.status === 'error' && <CircleAlert {...icon} className="mt-0.5 shrink-0 text-red-600" />}
            <span className="min-w-0">
              <span className="block truncate text-zinc-800">{u.name}</span>
              {u.status === 'error' && <span className="block text-xs text-red-700">{u.error}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
