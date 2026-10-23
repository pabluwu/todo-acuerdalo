export const FOLDER_NAME_MAX = 150;

/**
 * Valida el nombre de una carpeta (o de un archivo al renombrarlo):
 * recortado, entre 1 y `max` caracteres, sin `/` ni `\`, y distinto de `.` y `..`.
 * Devuelve el nombre limpio o el motivo del rechazo.
 */
export function validateFolderName(raw: unknown, max = FOLDER_NAME_MAX): { name: string; error?: undefined } | { name?: undefined; error: string } {
  if (typeof raw !== 'string') return { error: 'El nombre es obligatorio' };
  const name = raw.trim();
  if (name.length === 0) return { error: 'El nombre es obligatorio' };
  if (name.length > max) return { error: `El nombre no puede superar los ${max} caracteres` };
  if (/[/\\]/.test(name)) return { error: 'El nombre no puede contener / ni \\' };
  if (name === '.' || name === '..') return { error: 'Ese nombre no es válido' };
  return { name };
}
