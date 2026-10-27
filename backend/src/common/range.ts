export interface ByteRange {
  start: number;
  end: number; // inclusivo
}

/**
 * Interpreta la cabecera `Range` (solo un rango `bytes=`) para un archivo de `size` bytes.
 * Devuelve `null` si no hay rango o no se entiende (se envía el archivo completo, como manda el RFC)
 * y `'unsatisfiable'` si el rango cae fuera del archivo (responder 416).
 */
export function parseRange(header: string | undefined, size: number): ByteRange | 'unsatisfiable' | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (size <= 0) return 'unsatisfiable';
  let start: number;
  let end: number;
  if (m[1] === '') {
    // sufijo: los últimos N bytes
    const n = parseInt(m[2], 10);
    if (n === 0) return 'unsatisfiable';
    start = Math.max(size - n, 0);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
    if (m[2] !== '' && parseInt(m[2], 10) < start) return null;
  }
  if (start >= size) return 'unsatisfiable';
  return { start, end };
}
