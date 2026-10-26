import type { NoteVisibility } from '@/lib/types';

/** Enlace a una pestaña de notas y, opcionalmente, a una de sus carpetas. */
export function notesHref(scope: NoteVisibility, folderId?: string | null) {
  const params = new URLSearchParams();
  if (scope === 'private') params.set('scope', 'private');
  if (folderId) params.set('folder', folderId);
  const qs = params.toString();
  return qs ? `/notes?${qs}` : '/notes';
}
