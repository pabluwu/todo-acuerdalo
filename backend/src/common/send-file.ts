import { Response } from 'express';
import { Readable } from 'stream';

const INLINE_TYPES = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf)$/i;

/**
 * Envía un archivo almacenado: imágenes y PDF se muestran en el navegador salvo `?download=1`;
 * el resto siempre se descarga. `nosniff` evita que el navegador reinterprete el tipo.
 */
export function sendFile(
  res: Response,
  file: { mimeType: string; originalName: string; size: number },
  stream: Readable,
  download: string | undefined,
) {
  const inline = download !== '1' && INLINE_TYPES.test(file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(inline ? file.mimeType : 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  );
  res.setHeader('Content-Length', String(file.size));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
