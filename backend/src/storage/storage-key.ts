import { randomUUID } from 'crypto';
import { extname } from 'path';

/** Nombre legible para la clave: ASCII en minúsculas, sin tildes, con guiones y acotado. */
export function slugify(name: string, max = 60): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, max)
    .replace(/^-+|-+$/g, '');
}

/**
 * Clave del objeto en el almacenamiento: `<prefijo>/<uuid>-<nombre-legible><ext>`,
 * p. ej. `clientes/<id>/3f2c…-contrato-arriendo.pdf`. El uuid la hace única; el resto solo orienta.
 * Se basa en ids (no en nombres que cambian) para que renombrar en la app no obligue a mover el objeto.
 */
export function storageKey(prefix: string, originalName: string): string {
  const ext = extname(originalName).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
  const slug = slugify(originalName.slice(0, originalName.length - extname(originalName).length));
  return `${prefix}/${randomUUID()}${slug ? `-${slug}` : ''}${ext}`;
}
