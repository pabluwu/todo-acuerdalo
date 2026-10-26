import { NotePermission } from '../entities/note-share.entity';
import { NoteVisibility } from '../entities/note.entity';
import { Role } from '../entities/user.entity';

export type NoteAccess = 'owner' | 'edit' | 'view' | 'none';

/**
 * Nivel de acceso de un usuario a una nota.
 * - Común: el autor es `owner`; el resto edita.
 * - Privada: el dueño es `owner`; quien tiene un permiso compartido, ese permiso; el resto, nada.
 *   El rol de administrador NO da acceso a notas privadas ajenas.
 */
export function accessFor(
  note: { visibility: NoteVisibility; ownerId: string | null },
  userId: string,
  share?: { permission: NotePermission } | null,
): NoteAccess {
  if (note.ownerId && note.ownerId === userId) return 'owner';
  if (note.visibility === 'common') return 'edit';
  return share ? share.permission : 'none';
}

/** Borrar: en comunes, el autor o un admin; en privadas, solo el dueño (el admin tampoco). */
export function canDeleteNote(
  note: { visibility: NoteVisibility; ownerId: string | null },
  userId: string,
  role: Role,
): boolean {
  if (note.ownerId && note.ownerId === userId) return true;
  return note.visibility === 'common' && role === 'admin';
}

export const canEditNote = (access: NoteAccess) => access === 'owner' || access === 'edit';

type FolderRef = { visibility: NoteVisibility; ownerId: string | null };

/** Carpetas comunes: las administra cualquiera del equipo. Privadas: solo su dueño (ni siquiera un admin). */
export const canManageFolder = (folder: FolderRef, userId: string) =>
  folder.visibility === 'common' || folder.ownerId === userId;

/** Mover una nota de carpeta: en comunes, quien la pueda editar; en privadas, solo el dueño (las carpetas son suyas). */
export const canMoveNote = (note: { visibility: NoteVisibility }, access: NoteAccess) =>
  note.visibility === 'common' ? canEditNote(access) : access === 'owner';

/** Una nota solo cabe en carpetas de su misma pestaña; si es privada, en las de su dueño. */
export const folderFitsNote = (folder: FolderRef, note: { visibility: NoteVisibility; ownerId: string | null }) =>
  folder.visibility === note.visibility && (note.visibility === 'common' || (!!note.ownerId && folder.ownerId === note.ownerId));
