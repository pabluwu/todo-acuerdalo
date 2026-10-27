import { Response } from 'express';
import { Readable } from 'stream';
import { ByteRange } from './range';

const INLINE_TYPES = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|video\/(mp4|quicktime|webm))$/i;

/**
 * Envía un archivo almacenado: imágenes, PDF y video se muestran en el navegador salvo `?download=1`;
 * el resto siempre se descarga. `nosniff` evita que el navegador reinterprete el tipo.
 * Con `range` (ya validado y con el stream abierto sobre ese tramo) responde 206 parcial.
 */
export function sendFile(
  res: Response,
  file: { mimeType: string; originalName: string; size: number },
  stream: Readable,
  download: string | undefined,
  range?: ByteRange | null,
) {
  const inline = download !== '1' && INLINE_TYPES.test(file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(inline ? file.mimeType : 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  );
  res.setHeader('Accept-Ranges', 'bytes');
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
    res.setHeader('Content-Length', String(range.end - range.start + 1));
  } else {
    res.setHeader('Content-Length', String(file.size));
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

/** Rango pedido fuera del archivo: 416 con el tamaño real. */
export function sendRangeNotSatisfiable(res: Response, size: number) {
  res.status(416);
  res.setHeader('Content-Range', `bytes */${size}`);
  res.end();
}
