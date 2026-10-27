'use client';

import { ArrowLeft, CalendarDays, Check, CircleCheck, CircleX, FileQuestion, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, formatDate } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { icon } from '@/lib/icons';
import { FORMAT_META, platformsText, pubStatus } from '@/lib/publications';
import { useToast } from '@/lib/toast';
import type { PublicationAction, PublicationComment, PublicationDetail, PublicationStatus, UserLite } from '@/lib/types';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmptyState } from '../EmptyState';
import { PanelSkeleton } from '../Skeletons';
import { StatusChip } from './PubBits';
import { PublicationApproval } from './PublicationApproval';
import { PublicationComments } from './PublicationComments';
import { PublicationDialog } from './PublicationDialog';
import { PublicationVersions } from './PublicationVersions';
import { CompareView, PublicationViewer } from './PublicationViewer';

const STEPS: PublicationStatus[] = ['idea', 'edicion', 'por_publicar', 'publicada'];
const POLL_MS = 15_000;

function Stepper({ status, cancelledFrom }: { status: PublicationStatus; cancelledFrom: PublicationStatus | null }) {
  const cancelled = status === 'cancelada';
  const current = STEPS.indexOf(cancelled ? cancelledFrom ?? 'idea' : status);
  return (
    <ol aria-label="Estado de la publicación" className={`flex flex-wrap items-center gap-x-1 gap-y-2 ${cancelled ? 'opacity-60' : ''}`}>
      {STEPS.map((s, i) => {
        const meta = pubStatus(s);
        const past = i < current || (i === current && s === 'publicada' && !cancelled);
        const now = i === current;
        return (
          <li key={s} aria-current={now && !cancelled ? 'step' : undefined} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className={`mx-1 h-px w-4 sm:w-6 ${i <= current ? 'bg-zinc-400' : 'bg-zinc-200'}`} />}
            <span
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm ${
                now ? `pub-chip pub-c-${s} font-medium` : past ? 'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200' : 'text-zinc-500 ring-1 ring-inset ring-zinc-200/70'
              }`}
            >
              {past && !now ? <Check size={14} strokeWidth={2} aria-hidden className="text-emerald-600" /> : <meta.icon size={14} strokeWidth={1.75} aria-hidden />}
              {meta.label}
              <span className="sr-only">{now ? ' (actual)' : past ? ' (completado)' : ' (pendiente)'}</span>
            </span>
          </li>
        );
      })}
      {cancelled && <li className="ml-2"><StatusChip status="cancelada" /></li>}
    </ol>
  );
}

/** Espacio de revisión de una publicación: visor, versiones, aprobación y comentarios. */
export function PublicationPage({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [pub, setPub] = useState<PublicationDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [viewedId, setViewedId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [slide, setSlide] = useState(0);
  const [videoSec, setVideoSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [captionDraft, setCaptionDraft] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const titleFocus = useRef(false);
  const captionFocus = useRef(false);
  const captionDirty = useRef(false);
  const lastJson = useRef('');
  const pendingSeek = useRef<number | null>(null);
  const busyRef = useRef(false);
  busyRef.current = busy || uploading;

  const apply = useCallback((p: PublicationDetail) => {
    lastJson.current = JSON.stringify(p);
    setPub(p);
  }, []);

  // ---- carga y sondeo cada 15 s mientras la pestaña está visible ----
  useEffect(() => {
    let alive = true;
    const fetchIt = (initial: boolean) => {
      api<PublicationDetail>(`/publications/${id}`)
        .then((p) => {
          if (!alive) return;
          if (!initial && JSON.stringify(p) === lastJson.current) return;
          apply(p);
        })
        .catch((err) => {
          if (!alive || !initial) return;
          if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setNotFound(true);
          else toast((err as Error).message);
        });
    };
    fetchIt(true);
    const poll = () => { if (document.visibilityState === 'visible' && !busyRef.current) fetchIt(false); };
    const t = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', poll); };
  }, [id, apply, toast]);

  useEffect(() => { api<UserLite[]>('/users').then(setUsers).catch(() => undefined); }, []);

  // los borradores siguen al servidor salvo que se esté escribiendo
  useEffect(() => { if (pub && !titleFocus.current) setTitleDraft(pub.title); }, [pub?.title]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pub && !captionFocus.current && !captionDirty.current) setCaptionDraft(pub.caption); }, [pub?.caption]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = pub?.versions[0] ?? null;
  const viewed = pub ? pub.versions.find((v) => v.id === viewedId) ?? latest : null;
  const viewedIdx = pub && viewed ? pub.versions.findIndex((v) => v.id === viewed.id) : -1;
  const older = pub && viewedIdx >= 0 ? pub.versions[viewedIdx + 1] ?? null : null;
  const viewingLatest = !!viewed && viewed.id === latest?.id;

  // al cambiar de versión se reinician la imagen y el segundo, y se ejecuta un salto pendiente
  useEffect(() => {
    setSlide(0);
    setVideoSec(0);
    const t = pendingSeek.current;
    if (t === null) return;
    pendingSeek.current = null;
    const v = videoRef.current;
    if (!v) return;
    const go = () => { v.currentTime = t; };
    if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
  }, [viewed?.id]);

  async function mutate<T extends PublicationDetail | void>(fn: () => Promise<T>, ok?: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (r) apply(r as PublicationDetail);
      if (ok) toast(ok, 'success');
      return true;
    } catch (err) {
      toast((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const act = (action: PublicationAction, ok: string) =>
    mutate(() => api<PublicationDetail>(`/publications/${id}/status`, { method: 'POST', body: { action } }), ok);

  async function saveTitle() {
    titleFocus.current = false;
    const t = titleDraft.trim();
    if (!pub || !t) return setTitleDraft(pub?.title ?? '');
    if (t === pub.title) return setTitleDraft(t);
    await mutate(() => api<PublicationDetail>(`/publications/${id}`, { method: 'PATCH', body: { title: t } }), 'Título actualizado');
  }

  async function saveCaption() {
    captionFocus.current = false;
    if (!pub || !captionDirty.current) return;
    if (captionDraft === pub.caption) { captionDirty.current = false; return; }
    const ok = await mutate(() => api<PublicationDetail>(`/publications/${id}`, { method: 'PATCH', body: { caption: captionDraft } }), 'Descripción guardada');
    if (ok) captionDirty.current = false;
  }

  async function decide(decision: 'aprobada' | 'cambios') {
    if (!latest) return;
    const ok = await mutate(() => api<PublicationDetail>(`/publications/${id}/versions/${latest.id}/approval`, { method: 'POST', body: { decision } }),
      decision === 'aprobada' ? `Aprobaste la v${latest.number}` : 'Pediste cambios. Cuéntales qué ajustar en los comentarios.');
    if (ok && decision === 'cambios') document.getElementById('pub-comments')?.scrollIntoView({ block: 'nearest' });
  }

  const undo = () => latest && mutate(() => api<PublicationDetail>(`/publications/${id}/versions/${latest.id}/approval`, { method: 'DELETE' }));

  async function reorder(fileIds: string[]) {
    if (!pub || !viewed) return;
    const vid = viewed.id;
    apply({
      ...pub,
      versions: pub.versions.map((v) => (v.id === vid ? { ...v, files: v.files.map((f) => ({ ...f, position: fileIds.indexOf(f.id) })) } : v)),
    });
    try {
      apply(await api<PublicationDetail>(`/publications/${id}/versions/${vid}/order`, { method: 'PATCH', body: { fileIds } }));
    } catch (err) {
      toast((err as Error).message);
      api<PublicationDetail>(`/publications/${id}`).then(apply).catch(() => undefined);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/publications/${id}`, { method: 'DELETE' });
      toast('Publicación eliminada', 'success');
      router.push('/publicaciones');
    } catch (err) {
      toast((err as Error).message);
      setBusy(false);
      setConfirm(null);
    }
  }

  function jump(c: PublicationComment) {
    viewerRef.current?.scrollIntoView({ block: 'nearest' });
    if (c.versionId && c.versionId !== viewed?.id) {
      setComparing(false);
      if (c.timecodeSec !== null) pendingSeek.current = c.timecodeSec;
      setViewedId(c.versionId);
      if (c.slideIndex !== null) setTimeout(() => setSlide(c.slideIndex!), 0);
      return;
    }
    if (c.timecodeSec !== null && videoRef.current) videoRef.current.currentTime = c.timecodeSec;
    if (c.slideIndex !== null) setSlide(c.slideIndex);
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState icon={FileQuestion} title="No encontramos esta publicación" tone="neutral" action={<Link href="/publicaciones" className="btn-accent">Ir a las publicaciones</Link>}>
          Puede que se haya eliminado o que el enlace no sea correcto.
        </EmptyState>
      </div>
    );
  }
  if (!pub || !user) return <div className="mx-auto max-w-6xl"><PanelSkeleton /></div>;

  const F = FORMAT_META[pub.format].icon;
  const fileCount = latest?.files.length ?? 0;
  const formatLabel = pub.format === 'post' && fileCount > 1 ? 'Carrusel' : FORMAT_META[pub.format].label;
  const sched = new Date(pub.scheduledAt);
  const editableStatus = pub.status === 'idea' || pub.status === 'edicion';
  const cancelled = pub.status === 'cancelada';
  const chip = 'inline-flex min-h-7 items-center gap-1.5 rounded-full bg-zinc-900/[0.06] px-2.5 py-0.5 text-xs text-zinc-700';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/publicaciones" className="btn-ghost -ml-3"><ArrowLeft {...icon} /> Volver al calendario</Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={() => setEditing(true)}><Pencil {...icon} /> Editar</button>
          {cancelled ? (
            <button type="button" className="btn" disabled={busy} onClick={() => act('restore', 'Publicación reactivada')}><RotateCcw {...icon} /> Reactivar</button>
          ) : (
            <button type="button" className="btn-danger" disabled={busy} onClick={() => setConfirm('cancel')}><CircleX {...icon} /> Cancelar publicación</button>
          )}
          {pub.canDelete && <button type="button" className="btn-ghost btn-icon text-red-700" aria-label="Eliminar publicación" onClick={() => setConfirm('delete')}><Trash2 {...icon} /></button>}
        </div>
      </div>

      <header className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={chip}><F size={14} strokeWidth={1.5} aria-hidden /> {formatLabel} · {platformsText(pub.platforms)}</span>
          <span className={`${chip} tabular-nums`}>
            <CalendarDays size={14} strokeWidth={1.5} aria-hidden />
            <time dateTime={pub.scheduledAt}>{sched.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} · {sched.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
          </span>
        </div>
        <input
          aria-label="Título de la publicación"
          className={`!h-auto w-full min-w-0 !border-transparent !bg-transparent !px-1 !py-1 text-2xl font-semibold tracking-tight hover:!border-zinc-200 focus:!bg-white ${cancelled ? 'text-zinc-500 line-through' : ''}`}
          maxLength={300}
          value={titleDraft}
          onFocus={() => { titleFocus.current = true; }}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setTitleDraft(pub.title); titleFocus.current = false; e.currentTarget.blur(); }
          }}
        />
        <Stepper status={pub.status} cancelledFrom={pub.cancelledFrom} />
      </header>

      {pub.status === 'por_publicar' && latest && (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
          <CircleCheck {...icon} size={20} className="shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Todo el equipo aprobó la v{latest.number}</p>
            <p className="text-sm text-emerald-800">Está lista para publicarse el {sched.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.</p>
          </div>
          <button type="button" className="btn-accent" disabled={busy} onClick={() => act('publish', 'Marcada como publicada')}><Check {...icon} /> Marcar como publicada</button>
        </div>
      )}
      {pub.status === 'publicada' && (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
          <CircleCheck {...icon} size={20} className="shrink-0 text-emerald-600" />
          Publicada{pub.publishedAt ? ` el ${formatDate(pub.publishedAt)}` : ''}.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <section ref={viewerRef} aria-label="Visor de la versión" className="card-surface order-1 p-4 sm:p-5 lg:order-none">
            {!viewed ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-zinc-900">Aún no hay nada que revisar</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600">{pub.brief ? 'Sube la primera versión en «Versiones». El brief queda abajo como referencia.' : 'Sube la primera versión en «Versiones» y el equipo podrá comentarla y aprobarla.'}</p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold tabular-nums text-zinc-900">
                    v{viewed.number}{!viewingLatest && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">anterior</span>}
                  </h2>
                  {!viewingLatest && <button type="button" className="btn btn-sm" onClick={() => { setViewedId(null); setComparing(false); }}>Ver la última (v{latest!.number})</button>}
                </div>
                {comparing && older ? (
                  <CompareView format={pub.format} older={older} newer={viewed} slide={slide} setSlide={setSlide} />
                ) : (
                  <PublicationViewer
                    format={pub.format}
                    version={viewed}
                    comments={pub.comments}
                    slide={slide}
                    setSlide={setSlide}
                    videoRef={videoRef}
                    onTime={setVideoSec}
                    canReorder={pub.format === 'post' && viewingLatest && editableStatus && !busy}
                    onReorder={reorder}
                  />
                )}
              </>
            )}
          </section>

          <div className="order-3 lg:order-none">
            <PublicationVersions
              pub={pub}
              viewedId={viewedId}
              onSelect={(vid) => setViewedId(vid === latest?.id ? null : vid)}
              comparing={comparing}
              onCompare={setComparing}
              onUploaded={(p) => { apply(p); setViewedId(null); setComparing(false); }}
              onUploadingChange={setUploading}
              onReopen={() => act('reopen', 'Edición reabierta')}
              reopening={busy}
            />
          </div>

          <section aria-labelledby="pub-caption" className="card-surface order-4 p-4 sm:p-5 lg:order-none">
            {pub.brief && (
              <div className="mb-4 rounded-lg bg-stone-100 px-3 py-2.5">
                <h2 className="section-label mb-1">Brief</h2>
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">{pub.brief}</p>
              </div>
            )}
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="pub-caption" className="text-sm font-semibold text-zinc-900">Descripción para publicar</h2>
              {captionDraft !== pub.caption && <button type="button" className="btn-accent btn-sm" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={saveCaption}>Guardar</button>}
            </div>
            <textarea
              aria-labelledby="pub-caption"
              rows={5}
              className="w-full resize-y"
              placeholder="Texto y hashtags que acompañarán la publicación"
              value={captionDraft}
              onFocus={() => { captionFocus.current = true; }}
              onChange={(e) => { captionDirty.current = true; setCaptionDraft(e.target.value); }}
              onBlur={saveCaption}
            />
          </section>
        </div>

        <div className="contents lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-5">
          <div className="order-2 lg:order-none">
            <PublicationApproval pub={pub} userId={user.id} viewingLatest={viewingLatest} busy={busy} onDecide={decide} onUndo={undo} />
          </div>
          <div id="pub-comments" className="order-5 lg:order-none">
            <PublicationComments
              publicationId={pub.id}
              comments={pub.comments}
              users={users}
              format={pub.format}
              viewedVersion={viewed ? { id: viewed.id, number: viewed.number } : null}
              currentSec={videoSec}
              slide={slide}
              getTimecode={() => videoRef.current?.currentTime ?? null}
              onJump={jump}
              onUpdate={apply}
            />
          </div>
        </div>
      </div>

      {editing && (
        <PublicationDialog
          publication={pub}
          onClose={() => setEditing(false)}
          onSaved={(p) => { apply(p); setEditing(false); toast('Publicación actualizada', 'success'); }}
        />
      )}
      {confirm === 'cancel' && (
        <ConfirmDialog
          title="¿Cancelar esta publicación?"
          confirmLabel="Cancelar publicación"
          tone="danger"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => { await act('cancel', 'Publicación cancelada'); setConfirm(null); }}
        >
          Dejará de contar en el flujo, pero conserva sus versiones y comentarios. Puedes reactivarla cuando quieras.
        </ConfirmDialog>
      )}
      {confirm === 'delete' && (
        <ConfirmDialog title="¿Eliminar esta publicación?" confirmLabel="Eliminar" tone="danger" busy={busy} onCancel={() => setConfirm(null)} onConfirm={remove}>
          Se borrarán sus versiones, archivos y comentarios. Esta acción no se puede deshacer.
        </ConfirmDialog>
      )}
    </div>
  );
}
