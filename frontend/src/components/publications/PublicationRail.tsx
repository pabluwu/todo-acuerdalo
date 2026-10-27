'use client';

import { Activity, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatRelative } from '@/lib/api';
import { icon } from '@/lib/icons';
import { ACTIVITY_VERB, FORMAT_META, pubTime } from '@/lib/publications';
import type { PublicationActivity, PublicationSummary } from '@/lib/types';
import { Avatar } from '../Avatar';
import { ApprovalBar } from './PubBits';

/** Columna lateral: lo que espera mi revisión y la actividad reciente del equipo. */
export function PublicationRail({ tick }: { tick: number }) {
  const [pending, setPending] = useState<PublicationSummary[] | null>(null);
  const [activity, setActivity] = useState<PublicationActivity[] | null>(null);

  useEffect(() => {
    let alive = true;
    api<PublicationSummary[]>('/publications?pendingMine=1').then((r) => alive && setPending(r)).catch(() => alive && setPending([]));
    api<PublicationActivity[]>('/publications/activity?limit=10').then((r) => alive && setActivity(r)).catch(() => alive && setActivity([]));
    return () => { alive = false; };
  }, [tick]);

  return (
    <aside aria-label="Panel lateral de publicaciones" className="hidden space-y-6 md:block">
      <section aria-labelledby="rail-review">
        <h2 id="rail-review" className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800"><UserCheck {...icon} className="text-accent" /> Tu turno de revisar</h2>
        {pending === null ? (
          <div aria-hidden className="space-y-2"><div className="skeleton h-16" /><div className="skeleton h-16" /></div>
        ) : pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-5 text-center text-sm text-zinc-500">No tienes nada pendiente de aprobar.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => {
              const F = FORMAT_META[p.format].icon;
              return (
                <li key={p.id}>
                  <Link href={`/publicaciones/${p.id}`} className="card-surface card-surface-interactive block space-y-1.5 p-3">
                    <span className="block truncate text-sm font-medium text-zinc-900">{p.title}</span>
                    <span className="flex items-center gap-1.5 text-xs tabular-nums text-zinc-600">
                      <F size={12} strokeWidth={1.5} aria-hidden />
                      {FORMAT_META[p.format].label} · {new Date(p.scheduledAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} {pubTime(p)}
                      {p.latestVersion ? ` · v${p.latestVersion}` : ''}
                    </span>
                    <ApprovalBar approvals={p.approvals} total={p.reviewersCount} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="rail-activity">
        <h2 id="rail-activity" className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800"><Activity {...icon} className="text-zinc-500" /> Actividad reciente</h2>
        {activity === null ? (
          <div aria-hidden className="space-y-2"><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
        ) : activity.length === 0 ? (
          <p className="text-sm text-zinc-500">Todavía no hay actividad.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-2.5">
                <Avatar name={a.actor?.name ?? '?'} decorative />
                <p className="min-w-0 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">{a.actor?.name ?? 'Alguien'}</span> {ACTIVITY_VERB[a.action] ?? 'actualizó'}{' '}
                  <Link href={`/publicaciones/${a.publicationId}`} className="font-medium text-accent hover:underline">{a.publicationTitle}</Link>
                  {a.detail && <span className="text-zinc-500"> · {a.detail}</span>}
                  <time dateTime={a.createdAt} className="block text-xs text-zinc-500">{formatRelative(a.createdAt)}</time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
