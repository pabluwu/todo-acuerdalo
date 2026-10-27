'use client';

import { Check, CircleCheck, Clock, MessageSquareWarning, Undo2 } from 'lucide-react';
import { useId } from 'react';
import { icon } from '@/lib/icons';
import type { PublicationDetail } from '@/lib/types';
import { Avatar } from '../Avatar';

/** Aprobación de la última versión: progreso, estado de cada revisor y mis acciones. */
export function PublicationApproval({
  pub,
  userId,
  viewingLatest,
  busy,
  onDecide,
  onUndo,
}: {
  pub: PublicationDetail;
  userId: string;
  viewingLatest: boolean;
  busy: boolean;
  onDecide: (decision: 'aprobada' | 'cambios') => void;
  onUndo: () => void;
}) {
  const headingId = useId();
  const latest = pub.versions[0];
  const reviewers = pub.reviewers.filter((r) => r.isActive);
  const decisionOf = (id: string) => latest?.approvals.find((a) => a.userId === id)?.decision;
  const approved = reviewers.filter((r) => decisionOf(r.id) === 'aprobada').length;
  const total = reviewers.length;
  const isReviewer = reviewers.some((r) => r.id === userId);
  const mine = decisionOf(userId);
  const canDecide = isReviewer && !!latest && viewingLatest && pub.status === 'edicion';

  let helper = '';
  if (!latest) helper = 'Sube la primera versión para empezar la revisión.';
  else if (pub.status === 'cancelada') helper = 'La publicación está cancelada.';
  else if (pub.status === 'publicada') helper = 'Ya se publicó.';
  else if (pub.status === 'por_publicar') helper = 'Todos aprobaron. Reabre la edición si hay que cambiar algo.';
  else if (!isReviewer) helper = 'No eres revisor de esta publicación, pero puedes comentar.';
  else if (!viewingLatest) helper = 'Estás viendo una versión anterior. Solo se aprueba la última.';
  else if (!mine) helper = 'Cuando todos los revisores aprueben, pasa a «Por publicar». Si pides cambios, sube una versión nueva.';

  return (
    <section aria-labelledby={headingId} className="card-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-semibold text-zinc-900">Aprobación{latest ? ` de la v${latest.number}` : ''}</h2>
        <span className="text-sm tabular-nums text-zinc-600">{approved} de {total}</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={headingId}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={approved}
        aria-valuetext={`${approved} de ${total} revisores aprobaron`}
        className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-200"
      >
        <div className={`h-full rounded-full transition-[width] duration-300 ${total > 0 && approved >= total ? 'bg-emerald-500' : 'bg-accent'}`} style={{ width: total ? `${(approved / total) * 100}%` : 0 }} />
      </div>

      <ul className="mb-4 space-y-2">
        {reviewers.length === 0 && <li className="text-sm text-zinc-500">Esta publicación no tiene revisores. Agrégalos en «Editar».</li>}
        {reviewers.map((r) => {
          const d = latest ? decisionOf(r.id) : undefined;
          return (
            <li key={r.id} className="flex items-center gap-2.5">
              <Avatar name={r.name} decorative />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{r.name}{r.id === userId && <span className="text-zinc-500"> (tú)</span>}</span>
              {d === 'aprobada' ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-emerald-50 px-2 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"><CircleCheck size={12} strokeWidth={1.75} aria-hidden /> Aprobó</span>
              ) : d === 'cambios' ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-rose-50 px-2 text-xs font-medium text-rose-800 ring-1 ring-inset ring-rose-200"><MessageSquareWarning size={12} strokeWidth={1.75} aria-hidden /> Pidió cambios</span>
              ) : (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-zinc-100 px-2 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200"><Clock size={12} strokeWidth={1.75} aria-hidden /> Pendiente</span>
              )}
            </li>
          );
        })}
      </ul>

      {canDecide && !mine && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-accent min-h-10" disabled={busy} onClick={() => onDecide('aprobada')}><Check {...icon} /> Aprobar v{latest.number}</button>
          <button type="button" className="btn min-h-10" disabled={busy} onClick={() => onDecide('cambios')}><MessageSquareWarning {...icon} /> Pedir cambios</button>
        </div>
      )}
      {canDecide && mine && (
        <button type="button" className="btn min-h-10 w-full" disabled={busy} onClick={onUndo}><Undo2 {...icon} /> Deshacer {mine === 'aprobada' ? 'mi aprobación' : 'mi petición de cambios'}</button>
      )}
      {helper && <p className="mt-3 text-xs text-zinc-600">{helper}</p>}
    </section>
  );
}
