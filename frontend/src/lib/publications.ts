import { CircleCheck, CircleX, Clock, Film, Image as ImageIcon, Lightbulb, PenLine, type LucideIcon } from 'lucide-react';
import { ApiError } from './api';
import { timeStr } from './calendar';
import type { PublicationFormat, PublicationStatus, PublicationSummary } from './types';

/** Orden del flujo; `cancelada` queda aparte. Las clases `pub-c-*` viven en globals.css. */
export const PUB_STATUSES: { id: PublicationStatus; label: string; icon: LucideIcon; tint: string; fg: string }[] = [
  { id: 'idea', label: 'Idea', icon: Lightbulb, tint: 'bg-stone-100/80', fg: 'text-stone-600' },
  { id: 'edicion', label: 'Edición', icon: PenLine, tint: 'bg-indigo-50/80', fg: 'text-accent' },
  { id: 'por_publicar', label: 'Por publicar', icon: Clock, tint: 'bg-amber-50/80', fg: 'text-amber-700' },
  { id: 'publicada', label: 'Publicada', icon: CircleCheck, tint: 'bg-emerald-50/80', fg: 'text-emerald-600' },
  { id: 'cancelada', label: 'Cancelada', icon: CircleX, tint: 'bg-white/60', fg: 'text-zinc-500' },
];

export const pubStatus = (id: PublicationStatus) => PUB_STATUSES.find((s) => s.id === id) ?? PUB_STATUSES[0];

export const FORMAT_META: Record<PublicationFormat, { label: string; icon: LucideIcon }> = {
  video: { label: 'Video', icon: Film },
  post: { label: 'Post', icon: ImageIcon },
};

export const PLATFORM_LABEL: Record<string, string> = {
  tiktok: 'TikTok',
  reels: 'Reels',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export const platformsText = (platforms: string[]) => platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(' · ');

export const fileUrl = (fileId: string, download = false) => `/api/publications/files/${fileId}${download ? '?download=1' : ''}`;

export const pubTime = (p: Pick<PublicationSummary, 'scheduledAt'>) => timeStr(new Date(p.scheduledAt));

/** "Video · 18:00 · v3 · 4 de 5" */
export function pubMeta(p: PublicationSummary): string {
  const parts = [FORMAT_META[p.format].label, pubTime(p)];
  if (p.latestVersion) parts.push(`v${p.latestVersion}`);
  if (p.latestVersion && p.reviewersCount > 0) parts.push(`${p.approvals} de ${p.reviewersCount}`);
  return parts.join(' · ');
}

/** 72.4 -> "1:12" */
export function formatTimecode(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export const ACTIVITY_VERB: Record<string, string> = {
  created: 'creó',
  version_uploaded: 'subió una versión de',
  approved: 'aprobó',
  changes_requested: 'pidió cambios en',
  commented: 'comentó en',
  status_changed: 'cambió el estado de',
};

/**
 * POST multipart con progreso real (fetch no lo expone). Misma gestión de errores y de 401 que `api()`.
 * `abort()` del `signal` cancela la subida.
 */
export function uploadForm<T>(path: string, form: FormData, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: Record<string, unknown> | undefined;
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : undefined;
      } catch {
        data = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T);
      let message = `Error ${xhr.status}`;
      if (xhr.status === 413) message = 'El archivo es demasiado grande.';
      else if (data) message = Array.isArray(data.message) ? data.message.join('. ') : typeof data.message === 'string' ? data.message : message;
      if (xhr.status === 401 && typeof window !== 'undefined' && !['/login', '/register', '/forgot-password', '/reset-password'].includes(window.location.pathname)) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
      reject(new ApiError(xhr.status, message, data));
    };
    xhr.onerror = () => reject(new ApiError(0, 'No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.'));
    xhr.ontimeout = () => reject(new ApiError(0, 'La subida tardó demasiado. Inténtalo de nuevo.'));
    xhr.onabort = () => reject(new ApiError(0, 'Subida cancelada.'));
    if (signal) {
      if (signal.aborted) return reject(new ApiError(0, 'Subida cancelada.'));
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}
