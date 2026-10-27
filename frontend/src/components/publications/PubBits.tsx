import Link from 'next/link';
import { icon } from '@/lib/icons';
import { FORMAT_META, pubMeta, pubStatus } from '@/lib/publications';
import type { PublicationStatus, PublicationSummary } from '@/lib/types';
import { fileUrl } from '@/lib/publications';

/** Estado con icono + texto + tinte. */
export function StatusChip({ status, size = 'md' }: { status: PublicationStatus; size?: 'sm' | 'md' }) {
  const s = pubStatus(status);
  return (
    <span className={`pub-chip pub-c-${status} inline-flex shrink-0 items-center gap-1 rounded-full font-medium ${size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs'}`}>
      <s.icon size={size === 'sm' ? 12 : 14} strokeWidth={1.75} aria-hidden />
      {s.label}
    </span>
  );
}

/** Barra "4 de 5" de aprobaciones. */
export function ApprovalBar({ approvals, total }: { approvals: number; total: number }) {
  if (total <= 0) return null;
  const done = approvals >= total;
  return (
    <span className="flex items-center gap-2 text-xs tabular-nums text-zinc-600">
      <span
        role="progressbar"
        aria-label="Aprobaciones"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={approvals}
        aria-valuetext={`${approvals} de ${total}`}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200"
      >
        <span className={`block h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-accent'}`} style={{ width: `${(approvals / total) * 100}%` }} />
      </span>
      {approvals} de {total}
    </span>
  );
}

/** Fila de publicación para agendas y listas: icono de formato, título, meta y estado. */
export function PubRow({ pub, showDate = false }: { pub: PublicationSummary; showDate?: boolean }) {
  const F = FORMAT_META[pub.format].icon;
  const cancelled = pub.status === 'cancelada';
  const thumb = pub.thumbnailFileId && pub.thumbnailMime?.startsWith('image/') ? fileUrl(pub.thumbnailFileId) : null;
  const date = showDate ? new Date(pub.scheduledAt).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : null;
  return (
    <Link href={`/publicaciones/${pub.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-600">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <F {...icon} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${cancelled ? 'text-zinc-500 line-through' : 'text-zinc-900'}`}>{pub.title}</span>
        <span className="block truncate text-xs tabular-nums text-zinc-600">
          {date && <>{date} · </>}
          {pubMeta(pub)}
        </span>
      </span>
      <StatusChip status={pub.status} size="sm" />
    </Link>
  );
}
