'use client';

import { Clock, Film, Image as ImageIcon, SendHorizontal, Trash2, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { api, formatDate } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { icon } from '@/lib/icons';
import { formatTimecode } from '@/lib/publications';
import { useToast } from '@/lib/toast';
import type { PublicationComment, PublicationDetail, PublicationFormat, UserLite } from '@/lib/types';
import { Avatar } from '../Avatar';
import { renderBody } from '../Comments';
import { ConfirmDialog } from '../ConfirmDialog';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Comentarios de una publicación, modelados sobre los de tareas: @menciones y borrar los propios.
 * Cada comentario pertenece a la versión que se estaba viendo, y puede marcar un segundo del video
 * o una imagen del carrusel.
 */
export function PublicationComments({
  publicationId,
  comments,
  users,
  format,
  viewedVersion,
  currentSec,
  slide,
  getTimecode,
  onJump,
  onUpdate,
}: {
  publicationId: string;
  comments: PublicationComment[];
  users: UserLite[];
  format: PublicationFormat;
  /** Versión que se está viendo: a ella se atan los comentarios nuevos */
  viewedVersion: { id: string; number: number } | null;
  /** Segundo del video en pantalla (para el botón de marcar) */
  currentSec: number;
  /** Imagen del carrusel en pantalla, desde 0 */
  slide: number;
  getTimecode: () => number | null;
  onJump: (c: PublicationComment) => void;
  onUpdate: (p: PublicationDetail) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const headingId = useId();
  const listId = useId();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const posted = useRef(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [mark, setMark] = useState<{ timecodeSec?: number; slideIndex?: number } | null>(null);
  const [mentions, setMentions] = useState<UserLite[]>([]);
  const [menu, setMenu] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [deleting, setDeleting] = useState<PublicationComment | null>(null);

  const options = menu
    ? users.filter((u) => { const q = norm(menu.query); return norm(u.name).includes(q) || norm(u.email).includes(q); }).slice(0, 6)
    : [];
  const open = menu !== null && options.length > 0;

  function detectMenu(el: HTMLTextAreaElement) {
    const upto = el.value.slice(0, el.selectionStart);
    const m = /(^|\s)@([^\s@]*)$/.exec(upto);
    if (m) {
      const query = m[2];
      setMenu((prev) => { if (!prev || prev.query !== query) setActive(0); return { start: upto.length - query.length - 1, query }; });
    } else setMenu(null);
  }

  function pick(u: UserLite) {
    if (!menu) return;
    const el = areaRef.current;
    const end = menu.start + 1 + menu.query.length;
    const insert = `@${u.name} `;
    const caret = menu.start + insert.length;
    setBody(body.slice(0, menu.start) + insert + body.slice(end));
    setMentions((m) => (m.some((x) => x.id === u.id) ? m : [...m, u]));
    setMenu(null);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(caret, caret); });
  }

  function toggleMark() {
    if (mark) return setMark(null);
    if (format === 'video') {
      const t = getTimecode();
      setMark(t === null ? null : { timecodeSec: Math.round(t * 10) / 10 });
    } else setMark({ slideIndex: slide });
  }

  const canSend = !busy && body.trim() !== '' && !!viewedVersion;

  async function send() {
    if (!canSend || !viewedVersion) return;
    setBusy(true);
    try {
      const updated = await api<PublicationDetail>(`/publications/${publicationId}/comments`, {
        method: 'POST',
        body: {
          body: body.trim(),
          versionId: viewedVersion.id,
          ...(mark?.timecodeSec !== undefined ? { timecodeSec: mark.timecodeSec } : {}),
          ...(mark?.slideIndex !== undefined ? { slideIndex: mark.slideIndex } : {}),
          mentionIds: mentions.filter((u) => body.includes(`@${u.name}`)).map((u) => u.id),
        },
      });
      posted.current = true;
      onUpdate(updated);
      setBody('');
      setMentions([]);
      setMark(null);
      setMenu(null);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'nearest' }));
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: PublicationComment) {
    setBusy(true);
    try {
      onUpdate(await api<PublicationDetail>(`/publications/${publicationId}/comments/${c.id}`, { method: 'DELETE' }));
      setDeleting(null);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const markLabel = mark?.timecodeSec !== undefined ? `Marcado en ${formatTimecode(mark.timecodeSec)}` : mark?.slideIndex !== undefined ? `Imagen ${mark.slideIndex + 1}` : '';

  return (
    <section aria-labelledby={headingId} className="card-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-semibold text-zinc-900">Comentarios</h2>
        {viewedVersion && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs tabular-nums text-zinc-600">Comentas sobre v{viewedVersion.number}</span>}
      </div>

      <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
        {comments.length === 0 && <p className="text-sm text-zinc-500">Aún no hay comentarios. Marca un momento del video o una imagen para ser preciso.</p>}
        {comments.map((c) => {
          const jumpLabel = c.timecodeSec !== null ? formatTimecode(c.timecodeSec) : c.slideIndex !== null ? `Imagen ${c.slideIndex + 1}` : null;
          return (
            <div key={c.id} className="flex gap-3">
              <Avatar name={c.author?.name ?? '?'} size="md" decorative />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">{c.author?.name ?? 'Usuario eliminado'}</span>
                  {c.versionNumber !== null && <span className="rounded bg-zinc-100 px-1.5 text-[11px] font-medium tabular-nums leading-5 text-zinc-600">v{c.versionNumber}</span>}
                  {jumpLabel && (
                    <button type="button" onClick={() => onJump(c)} className="inline-flex h-5 items-center gap-1 rounded-full bg-amber-50 px-2 text-[11px] font-medium tabular-nums text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100" aria-label={`Ir a ${jumpLabel}`}>
                      {c.timecodeSec !== null ? <Clock size={11} strokeWidth={1.75} aria-hidden /> : <ImageIcon size={11} strokeWidth={1.75} aria-hidden />}
                      {jumpLabel}
                    </button>
                  )}
                  <time dateTime={c.createdAt} className="text-xs tabular-nums text-zinc-500">{formatDate(c.createdAt)}</time>
                  {c.author?.id === user?.id && (
                    <button type="button" onClick={() => setDeleting(c)} aria-label="Eliminar comentario" className="btn-ghost btn-icon btn-sm !h-7 !w-7 ml-auto text-zinc-500"><Trash2 size={14} strokeWidth={1.5} aria-hidden /></button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-700">{renderBody(c.body, users)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-5 space-y-2">
        <div className="relative">
          <textarea
            ref={areaRef}
            aria-label="Escribe un comentario"
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open ? `${listId}-${active}` : undefined}
            rows={3}
            className="w-full resize-none"
            placeholder="Escribe un comentario… usa @ para etiquetar"
            value={body}
            onChange={(e) => { setBody(e.target.value); detectMenu(e.target); }}
            onSelect={(e) => detectMenu(e.currentTarget)}
            onBlur={() => setMenu(null)}
            onKeyDown={(e) => {
              if (open) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(options[Math.min(active, options.length - 1)]); return; }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenu(null); return; }
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            }}
          />
          {open && (
            <ul id={listId} role="listbox" aria-label="Usuarios para etiquetar" className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-60 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
              {options.map((u, i) => (
                <li
                  key={u.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); pick(u); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-10 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === active ? 'bg-accent-soft text-accent' : 'text-zinc-700'}`}
                >
                  <Avatar name={u.name} decorative />
                  <span className="font-medium">{u.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {mark ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-full bg-amber-50 pl-2.5 pr-1 text-xs font-medium tabular-nums text-amber-800 ring-1 ring-amber-200">
              {markLabel}
              <button type="button" onClick={() => setMark(null)} aria-label="Quitar la marca" className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-amber-100"><X size={12} strokeWidth={1.75} aria-hidden /></button>
            </span>
          ) : (
            <button type="button" className="btn btn-sm" onClick={toggleMark} disabled={!viewedVersion}>
              {format === 'video' ? <><Film {...icon} /> Marcar {formatTimecode(currentSec)}</> : <><ImageIcon {...icon} /> Marcar imagen {slide + 1}</>}
            </button>
          )}
          <button className="btn-accent" disabled={!canSend}><SendHorizontal {...icon} /> {busy ? 'Enviando…' : 'Comentar'}</button>
        </div>
      </form>

      {deleting && (
        <ConfirmDialog title="¿Eliminar este comentario?" confirmLabel="Eliminar" tone="danger" busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => remove(deleting)}>
          Esta acción no se puede deshacer.
        </ConfirmDialog>
      )}
    </section>
  );
}
