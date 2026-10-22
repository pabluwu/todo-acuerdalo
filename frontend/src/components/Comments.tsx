'use client';

import { File as FileIcon, FileText, ImageIcon, Paperclip, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, formatDate, formatSize } from '@/lib/api';
import { icon } from '@/lib/icons';
import { useToast } from '@/lib/toast';
import type { Attachment, Comment, UserLite } from '@/lib/types';
import { Avatar } from './Avatar';

function TypeIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <ImageIcon {...icon} className="shrink-0 text-zinc-400" />;
  if (mime === 'application/pdf' || mime.startsWith('text/')) return <FileText {...icon} className="shrink-0 text-zinc-400" />;
  return <FileIcon {...icon} className="shrink-0 text-zinc-400" />;
}

function Attachments({ items }: { items: Attachment[] }) {
  const images = items.filter((a) => a.mimeType.startsWith('image/'));
  const files = items.filter((a) => !a.mimeType.startsWith('image/'));
  return (
    <div className="mt-2 space-y-2">
      {images.length === 1 && (
        <a href={`/api/attachments/${images[0].id}`} target="_blank" rel="noreferrer" className="block w-fit rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/attachments/${images[0].id}`} alt={images[0].originalName} className="max-h-48 rounded-md border border-zinc-200 object-contain" />
        </a>
      )}
      {images.length > 1 && (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((a) => (
            <li key={a.id}>
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/attachments/${a.id}`} alt={a.originalName} className="aspect-square w-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((a) => (
            <li key={a.id} className="max-w-full">
              <a href={`/api/attachments/${a.id}?download=1`} download={a.originalName} className="inline-flex max-w-full items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50">
                <TypeIcon mime={a.mimeType} />
                <span className="truncate">{a.originalName}</span>
                <span className="shrink-0 tabular-nums text-zinc-500">{formatSize(a.size)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Pinta como chip los @Nombre de usuarios conocidos; el resto del texto queda tal cual. */
function renderBody(body: string, users: UserLite[]) {
  const names = [...new Set(users.map((u) => u.name.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (names.length === 0) return body;
  const re = new RegExp(`(@(?:${names.map(escapeRe).join('|')}))(?![\\p{L}\\p{N}_])`, 'gu');
  return body.split(re).map((part, i) =>
    i % 2 === 1 ? <span key={i} className="rounded bg-accent-soft px-1 font-medium text-accent">{part}</span> : part,
  );
}

export function Comments({ taskId, users }: { taskId: string; users: UserLite[] }) {
  const toast = useToast();
  const headingId = useId();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const posted = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [mentions, setMentions] = useState<UserLite[]>([]);
  // menú de @: posición del '@' en el texto y texto escrito tras él (null = cerrado)
  const [menu, setMenu] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);

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
    const next = body.slice(0, menu.start) + insert + body.slice(end);
    const caret = menu.start + insert.length;
    setBody(next);
    setMentions((m) => (m.some((x) => x.id === u.id) ? m : [...m, u]));
    setMenu(null);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(caret, caret); });
  }

  const load = useCallback(() => {
    api<Comment[]>(`/tasks/${taskId}/comments`).then((c) => { setComments(c); setLoaded(true); }).catch((e) => toast(e.message));
  }, [taskId, toast]);
  useEffect(load, [load]);
  // solo se desplaza al enviar un comentario, no al abrir el panel
  useEffect(() => { if (posted.current) { posted.current = false; endRef.current?.scrollIntoView({ block: 'nearest' }); } }, [comments.length]);

  const canSend = !busy && (body.trim() !== '' || files.length > 0);

  async function send() {
    if (!canSend) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('body', body);
      // solo los etiquetados cuyo @Nombre sigue en el texto
      mentions.filter((u) => body.includes(`@${u.name}`)).forEach((u) => form.append('mentionIds', u.id));
      files.forEach((f) => form.append('files', f));
      const created = await api<Comment>(`/tasks/${taskId}/comments`, { method: 'POST', form });
      posted.current = true;
      setComments((c) => [...c, created]);
      setBody('');
      setMentions([]);
      setMenu(null);
      setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addFiles(list: FileList | File[]) {
    const next = Array.from(list);
    if (next.length) setFiles((f) => [...f, ...next]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="section-label mb-4">Comentarios y revisiones</h3>
      <div className="space-y-5">
        {loaded && comments.length === 0 && <p className="text-sm text-zinc-500">Aún no hay comentarios.</p>}
        {!loaded && <div aria-hidden className="flex gap-3"><div className="skeleton h-8 w-8 rounded-full" /><div className="skeleton h-10 flex-1" /></div>}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.author?.name ?? '?'} size="md" decorative />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{c.author?.name ?? 'Usuario eliminado'}</span>
                <time dateTime={c.createdAt} className="text-xs tabular-nums text-zinc-500">{formatDate(c.createdAt)}</time>
              </div>
              {c.body && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-700">{renderBody(c.body, users)}</p>}
              {c.attachments.length > 0 && <Attachments items={c.attachments} />}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { dragDepth.current++; setDragging(true); } }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
        onDragLeave={() => { if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
        onDrop={onDrop}
        className={`relative mt-6 space-y-2 rounded-lg transition-shadow ${dragging ? 'ring-2 ring-accent/40 ring-offset-4 ring-offset-white' : ''}`}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg border border-dashed border-accent bg-accent-soft/90 text-sm text-accent">
            <Paperclip {...icon} /> Suelta los archivos para adjuntarlos
          </div>
        )}
        <div className="relative">
          <textarea
            ref={areaRef}
            aria-label="Escribe un comentario"
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open ? `${listId}-${active}` : undefined}
            rows={3}
            className="w-full resize-none"
            placeholder="Escribe un comentario…"
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
            <ul id={listId} role="listbox" aria-label="Usuarios para etiquetar" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
              {options.map((u, i) => (
                <li
                  key={u.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); pick(u); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === active ? 'bg-accent-soft text-accent' : 'text-zinc-700'}`}
                >
                  <Avatar name={u.name} decorative />
                  <span className="font-medium">{u.name}</span>
                  <span className="truncate text-xs text-zinc-500">{u.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={i} className="flex max-w-full items-center gap-2 rounded-md border border-zinc-200 bg-white py-1 pl-2 pr-1 text-xs text-zinc-700">
                <TypeIcon mime={f.type} />
                <span className="max-w-[12rem] truncate">{f.name}</span>
                <span className="tabular-nums text-zinc-500">{formatSize(f.size)}</span>
                <button type="button" aria-label={`Quitar ${f.name}`} className="btn-ghost btn-icon btn-sm !h-5 !w-5 text-zinc-500" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                  <X size={12} strokeWidth={1.5} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" multiple className="hidden" tabIndex={-1} onChange={(e) => { addFiles(e.target.files ?? []); e.target.value = ''; }} />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Paperclip {...icon} /> Adjuntar archivos</button>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-zinc-500 sm:inline">Escribe @ para etiquetar a alguien · ⌘/Ctrl + Intro para enviar</span>
            <button className="btn-accent" disabled={!canSend}>{busy ? 'Enviando…' : 'Comentar'}</button>
          </div>
        </div>
      </form>
    </section>
  );
}
