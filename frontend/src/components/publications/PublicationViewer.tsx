'use client';

import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, Download, GripVertical } from 'lucide-react';
import { type RefObject, useMemo, useState } from 'react';
import { icon } from '@/lib/icons';
import { fileUrl, formatTimecode } from '@/lib/publications';
import type { PublicationComment, PublicationFile, PublicationFormat, PublicationVersion } from '@/lib/types';

const byPosition = (files: PublicationFile[]) => [...files].sort((a, b) => a.position - b.position);

/** Video 9:16 con marcas de los comentarios con timecode sobre una barra propia bajo el marco. */
function VideoPlayer({
  file, comments, videoRef, label, onTime,
}: { file: PublicationFile; comments: PublicationComment[]; videoRef?: RefObject<HTMLVideoElement | null>; label?: string; onTime?: (sec: number) => void }) {
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const marks = comments.filter((c) => c.timecodeSec !== null);
  const seek = (t: number) => {
    const v = videoRef?.current;
    if (v) v.currentTime = t;
  };
  return (
    <div className="mx-auto w-full max-w-[22rem]">
      <div className="aspect-[9/16] max-h-[70dvh] w-full overflow-hidden rounded-xl bg-zinc-900 shadow-sm ring-1 ring-black/5">
        <video
          key={file.id}
          ref={videoRef}
          src={fileUrl(file.id)}
          controls
          playsInline
          preload="metadata"
          aria-label={label ?? file.originalName}
          className="h-full w-full object-contain"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); onTime?.(Math.floor(e.currentTarget.currentTime)); }}
        />
      </div>
      {videoRef && (
        <div className="mt-3" aria-label="Comentarios en la línea de tiempo" role="group">
          <div className="relative h-8">
            <div aria-hidden className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full bg-accent/50" style={{ width: duration ? `${Math.min(100, (time / duration) * 100)}%` : 0 }} />
            </div>
            {duration > 0 && marks.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => seek(c.timecodeSec!)}
                aria-label={`Ir al comentario de ${c.author?.name ?? 'alguien'} en ${formatTimecode(c.timecodeSec!)}`}
                title={`${formatTimecode(c.timecodeSec!)} · ${c.author?.name ?? ''}`}
                className="absolute top-1/2 flex h-8 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: `${Math.min(100, (c.timecodeSec! / duration) * 100)}%` }}
              >
                <span className="h-3 w-3 rounded-full border-2 border-white bg-amber-500 shadow ring-1 ring-amber-700/40" />
              </button>
            ))}
          </div>
          <p className="flex justify-between text-xs tabular-nums text-zinc-500">
            <span>{formatTimecode(time)}</span>
            <span>{marks.length === 0 ? 'Sin comentarios con tiempo' : `${marks.length} ${marks.length === 1 ? 'comentario' : 'comentarios'} en el video`}</span>
            <span>{duration ? formatTimecode(duration) : '–:––'}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function SortableThumb({
  file, index, active, onSelect, sortable, marked,
}: { file: PublicationFile; index: number; active: boolean; onSelect: () => void; sortable: boolean; marked: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: file.id, disabled: !sortable });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`relative shrink-0 ${isDragging ? 'opacity-80' : ''}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Ver imagen ${index + 1}`}
        aria-current={active}
        className={`block h-16 w-16 overflow-hidden rounded-lg border-2 ${active ? 'border-accent' : 'border-transparent hover:border-zinc-300'}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl(file.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
      </button>
      <span className="pointer-events-none absolute left-1 top-1 rounded bg-zinc-900/70 px-1 text-[10px] tabular-nums leading-4 text-white">{index + 1}</span>
      {marked && <span aria-hidden className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500" />}
      {sortable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover imagen ${index + 1}`}
          className="absolute bottom-0.5 right-0.5 flex h-6 w-6 touch-none items-center justify-center rounded bg-white/90 text-zinc-600 shadow-sm hover:text-zinc-900"
        >
          <GripVertical size={14} strokeWidth={1.5} aria-hidden />
        </button>
      )}
    </li>
  );
}

function Carousel({
  files, slide, setSlide, comments, canReorder, onReorder,
}: {
  files: PublicationFile[]; slide: number; setSlide: (n: number) => void; comments: PublicationComment[]; canReorder: boolean; onReorder: (ids: string[]) => void;
}) {
  const ordered = useMemo(() => byPosition(files), [files]);
  const n = ordered.length;
  const idx = Math.min(slide, Math.max(0, n - 1));
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const markedSlides = new Set(comments.filter((c) => c.slideIndex !== null).map((c) => c.slideIndex));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ordered.findIndex((f) => f.id === active.id);
    const to = ordered.findIndex((f) => f.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(ordered, from, to);
    // la imagen que se estaba viendo sigue en pantalla
    const cur = ordered[idx]?.id;
    setSlide(Math.max(0, next.findIndex((f) => f.id === cur)));
    onReorder(next.map((f) => f.id));
  }

  if (n === 0) return <p className="rounded-xl bg-zinc-100 px-4 py-10 text-center text-sm text-zinc-500">Esta versión no tiene imágenes.</p>;
  const file = ordered[idx];
  return (
    <div
      className="mx-auto w-full max-w-lg"
      role="group"
      aria-roledescription="carrusel"
      aria-label="Imágenes de la versión"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); setSlide(Math.max(0, idx - 1)); }
        if (e.key === 'ArrowRight') { e.preventDefault(); setSlide(Math.min(n - 1, idx + 1)); }
      }}
    >
      <div className="relative flex aspect-[4/5] max-h-[70dvh] w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={file.id} src={fileUrl(file.id)} alt={`Imagen ${idx + 1} de ${n}: ${file.originalName}`} className="h-full w-full object-contain" />
        {n > 1 && (
          <>
            <button type="button" aria-label="Imagen anterior" disabled={idx === 0} onClick={() => setSlide(idx - 1)} className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow disabled:opacity-0"><ChevronLeft {...icon} /></button>
            <button type="button" aria-label="Imagen siguiente" disabled={idx === n - 1} onClick={() => setSlide(idx + 1)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow disabled:opacity-0"><ChevronRight {...icon} /></button>
          </>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-zinc-900/70 px-2 py-0.5 text-xs tabular-nums text-white" aria-live="polite">{idx + 1} / {n}</span>
      </div>
      {n > 1 && (
        <>
          <div className="mt-3 flex justify-center gap-1" role="group" aria-label="Elegir imagen">
            {ordered.map((f, i) => (
              <button key={f.id} type="button" aria-label={`Ir a la imagen ${i + 1}`} aria-current={i === idx} onClick={() => setSlide(i)} className="flex h-6 w-4 items-center justify-center">
                <span className={`h-2 w-2 rounded-full ${i === idx ? 'bg-accent' : 'bg-zinc-300'}`} />
              </button>
            ))}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ordered.map((f) => f.id)} strategy={horizontalListSortingStrategy} disabled={!canReorder}>
              <ul aria-label="Miniaturas" className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                {ordered.map((f, i) => (
                  <SortableThumb key={f.id} file={f} index={i} active={i === idx} onSelect={() => setSlide(i)} sortable={canReorder} marked={markedSlides.has(i)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {canReorder && <p className="mt-1 text-xs text-zinc-500">Arrastra el asa de cada miniatura para cambiar el orden del carrusel.</p>}
        </>
      )}
      <a href={fileUrl(file.id, true)} download={file.originalName} className="btn-ghost btn-sm mt-2"><Download {...icon} /> Descargar imagen {idx + 1}</a>
    </div>
  );
}

/**
 * Visor de una versión. `videoRef` solo se pasa al visor principal (el que comenta).
 */
export function PublicationViewer({
  format, version, comments, slide, setSlide, videoRef, onTime, canReorder, onReorder,
}: {
  format: PublicationFormat;
  version: PublicationVersion;
  comments: PublicationComment[];
  slide: number;
  setSlide: (n: number) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  onTime: (sec: number) => void;
  canReorder: boolean;
  onReorder: (ids: string[]) => void;
}) {
  const own = comments.filter((c) => c.versionId === version.id);
  if (format === 'video') {
    const file = version.files[0];
    if (!file) return <p className="rounded-xl bg-zinc-100 px-4 py-10 text-center text-sm text-zinc-500">Esta versión no tiene video.</p>;
    return (
      <div>
        <VideoPlayer file={file} comments={own} videoRef={videoRef} onTime={onTime} />
        <div className="mt-2 text-center">
          <a href={fileUrl(file.id, true)} download={file.originalName} className="btn-ghost btn-sm"><Download {...icon} /> Descargar video</a>
        </div>
      </div>
    );
  }
  return <Carousel files={version.files} slide={slide} setSlide={setSlide} comments={own} canReorder={canReorder} onReorder={onReorder} />;
}

/** Comparación lado a lado: la versión anterior y la que se está viendo. */
export function CompareView({
  format, older, newer, slide, setSlide,
}: { format: PublicationFormat; older: PublicationVersion; newer: PublicationVersion; slide: number; setSlide: (n: number) => void }) {
  const panes = [{ v: older, tag: 'anterior' }, { v: newer, tag: 'actual' }];
  const maxSlide = Math.max(byPosition(older.files).length, byPosition(newer.files).length) - 1;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {panes.map(({ v, tag }) => {
          const files = byPosition(v.files);
          const file = format === 'video' ? files[0] : files[Math.min(slide, files.length - 1)];
          return (
            <figure key={v.id} className="min-w-0">
              <figcaption className="mb-1.5 text-center text-xs font-medium tabular-nums text-zinc-700">v{v.number} <span className="font-normal text-zinc-500">({tag})</span></figcaption>
              {file ? (
                format === 'video' ? (
                  <div className="aspect-[9/16] max-h-[60dvh] overflow-hidden rounded-lg bg-zinc-900">
                    <video key={file.id} src={fileUrl(file.id)} controls playsInline preload="metadata" muted aria-label={`Video de la versión ${v.number}`} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="aspect-[4/5] overflow-hidden rounded-lg bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(file.id)} alt={`Imagen ${Math.min(slide, files.length - 1) + 1} de la versión ${v.number}`} className="h-full w-full object-contain" />
                  </div>
                )
              ) : <div className="flex aspect-[4/5] items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-500">Sin imagen {slide + 1}</div>}
            </figure>
          );
        })}
      </div>
      {format === 'post' && maxSlide > 0 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm tabular-nums">
          <button type="button" className="btn btn-icon" aria-label="Imagen anterior" disabled={slide === 0} onClick={() => setSlide(slide - 1)}><ChevronLeft {...icon} /></button>
          Imagen {slide + 1} / {maxSlide + 1}
          <button type="button" className="btn btn-icon" aria-label="Imagen siguiente" disabled={slide >= maxSlide} onClick={() => setSlide(slide + 1)}><ChevronRight {...icon} /></button>
        </div>
      )}
    </div>
  );
}
