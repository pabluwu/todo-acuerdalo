import { mkdirSync, promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// carpeta propia para los temporales de multer: así se pueden barrer los que deja una subida abortada
export const UPLOAD_TMP_DIR = join(tmpdir(), 'acuerdalo-publicaciones');
mkdirSync(UPLOAD_TMP_DIR, { recursive: true });

const STALE_MS = 6 * 60 * 60 * 1000;

/** Borra temporales con más de 6 h: multer no limpia el archivo parcial si el cliente corta la subida. Nunca falla. */
export async function sweepStaleUploads(dir = UPLOAD_TMP_DIR, now = Date.now()) {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  await Promise.all(names.map(async (n) => {
    const path = join(dir, n);
    const st = await fs.stat(path).catch(() => null);
    if (st?.isFile() && now - st.mtimeMs > STALE_MS) await fs.unlink(path).catch(() => undefined);
  }));
}
