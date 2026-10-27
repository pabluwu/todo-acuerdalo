export type PubStatus = 'idea' | 'edicion' | 'por_publicar' | 'publicada' | 'cancelada';
export type PubFormat = 'video' | 'post';
export type Decision = 'aprobada' | 'cambios';
export type StatusAction = 'publish' | 'cancel' | 'restore' | 'reopen';

export const STATUSES: PubStatus[] = ['idea', 'edicion', 'por_publicar', 'publicada', 'cancelada'];
export const MAX_POST_FILES = 20;

export const PLATFORMS: Record<PubFormat, string[]> = {
  video: ['tiktok', 'reels'],
  post: ['instagram', 'facebook'],
};
export const DEFAULT_PLATFORMS: Record<PubFormat, string[]> = {
  video: ['tiktok', 'reels'],
  post: ['instagram'],
};

export interface ReviewerState {
  userId: string;
  isActive: boolean;
}

/** Revisores que cuentan para la regla de aprobación: los desactivados no bloquean. */
export function activeReviewerIds(reviewers: ReviewerState[]): string[] {
  return reviewers.filter((r) => r.isActive).map((r) => r.userId);
}

/** Aprobaciones ('aprobada') de revisores activos sobre la última versión, y total de revisores activos. */
export function approvalCounts(
  reviewers: ReviewerState[],
  latestDecisions: { userId: string; decision: Decision }[],
): { approved: number; total: number } {
  const active = new Set(activeReviewerIds(reviewers));
  const approvedBy = new Set(latestDecisions.filter((d) => d.decision === 'aprobada' && active.has(d.userId)).map((d) => d.userId));
  return { approved: approvedBy.size, total: active.size };
}

/** Todos los revisores activos aprobaron la última versión (y hay al menos uno). */
export function allApproved(
  reviewers: ReviewerState[],
  latestDecisions: { userId: string; decision: Decision }[],
): boolean {
  const { approved, total } = approvalCounts(reviewers, latestDecisions);
  return total > 0 && approved === total;
}

/** Estado tras subir una versión: la primera saca la pieza de "idea". */
export function statusAfterUpload(status: PubStatus): PubStatus {
  return status === 'idea' ? 'edicion' : status;
}

/** Solo se suben versiones mientras se trabaja la pieza. */
export function canUploadVersion(status: PubStatus): boolean {
  return status === 'idea' || status === 'edicion';
}

/** Aprobar, pedir cambios o deshacer solo tiene sentido en edición. */
export function canDecide(status: PubStatus): boolean {
  return status === 'edicion';
}

/**
 * Recalcula el estado automático: en edición, si todos los revisores activos aprobaron
 * la última versión, pasa a "por publicar". Nunca retrocede (reabrir es una acción explícita).
 */
export function reconcileStatus(
  status: PubStatus,
  input: { hasVersion: boolean; reviewers: ReviewerState[]; latestDecisions: { userId: string; decision: Decision }[] },
): PubStatus {
  if (status === 'edicion' && input.hasVersion && allApproved(input.reviewers, input.latestDecisions)) return 'por_publicar';
  return status;
}

export type TransitionResult =
  | { ok: true; status: PubStatus; cancelledFrom: PubStatus | null; setPublishedAt: boolean; clearApprovals: boolean }
  | { ok: false; message: string };

/** Acciones manuales de estado: publicar, cancelar, reactivar y reabrir edición. */
export function transition(status: PubStatus, action: StatusAction, cancelledFrom: string | null): TransitionResult {
  const done = (
    next: PubStatus,
    extra: Partial<{ cancelledFrom: PubStatus | null; setPublishedAt: boolean; clearApprovals: boolean }> = {},
  ): TransitionResult => ({ ok: true, status: next, cancelledFrom: null, setPublishedAt: false, clearApprovals: false, ...extra });

  switch (action) {
    case 'publish':
      return status === 'por_publicar' ? done('publicada', { setPublishedAt: true }) : { ok: false, message: 'Solo se puede publicar una pieza en estado «Por publicar»' };
    case 'cancel':
      return status === 'cancelada' ? { ok: false, message: 'La publicación ya está cancelada' } : done('cancelada', { cancelledFrom: status });
    case 'restore': {
      if (status !== 'cancelada') return { ok: false, message: 'Solo se puede reactivar una publicación cancelada' };
      const back = STATUSES.find((s) => s === cancelledFrom && s !== 'cancelada');
      return done(back ?? 'idea');
    }
    case 'reopen':
      return status === 'por_publicar' ? done('edicion', { clearApprovals: true }) : { ok: false, message: 'Solo se puede reabrir la edición de una pieza en estado «Por publicar»' };
  }
}

/** Plataformas válidas para el formato; sin lista usa las por defecto. Devuelve `null` si hay alguna inválida o ninguna. */
export function normalizePlatforms(format: PubFormat, platforms: string[] | undefined | null): string[] | null {
  if (platforms == null) return [...DEFAULT_PLATFORMS[format]];
  const unique = [...new Set(platforms)];
  if (unique.length === 0 || unique.some((p) => !PLATFORMS[format].includes(p))) return null;
  return PLATFORMS[format].filter((p) => unique.includes(p));
}

/** Valida los archivos de una versión según el formato; devuelve el mensaje de error o `null`. */
export function validateVersionFiles(format: PubFormat, files: { mimeType: string }[]): string | null {
  if (format === 'video') {
    if (files.length !== 1) return 'Una versión de video lleva exactamente 1 archivo';
    if (!/^video\//i.test(files[0].mimeType)) return 'El archivo debe ser un video';
    return null;
  }
  if (files.length < 1) return 'Sube al menos una imagen';
  if (files.length > MAX_POST_FILES) return `Una versión admite hasta ${MAX_POST_FILES} imágenes`;
  if (files.some((f) => !/^image\//i.test(f.mimeType))) return 'Todos los archivos deben ser imágenes';
  return null;
}

/** Ordena los ids según `order`; exige que sea exactamente el mismo conjunto. Devuelve `null` si no calza. */
export function reorderIds(current: string[], order: string[]): string[] | null {
  if (order.length !== current.length) return null;
  const set = new Set(current);
  if (new Set(order).size !== order.length || order.some((id) => !set.has(id))) return null;
  return [...order];
}
