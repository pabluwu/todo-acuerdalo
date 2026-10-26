import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream, mkdirSync, promises as fs } from 'fs';
import { dirname, join } from 'path';
import { Readable } from 'stream';

type Driver = 'local' | 'r2';

// Almacenamiento de archivos: disco local (UPLOAD_DIR) o Cloudflare R2 (API S3)
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly driver: Driver;
  private readonly dir: string;
  private readonly bucket: string;
  private readonly s3?: S3Client;

  constructor(config: ConfigService) {
    this.driver = config.get('STORAGE_DRIVER', 'local') === 'r2' ? 'r2' : 'local';
    this.dir = config.get('UPLOAD_DIR', '/app/uploads');
    this.bucket = config.get('R2_BUCKET', '');
    if (this.driver === 'local') {
      mkdirSync(this.dir, { recursive: true });
      return;
    }
    const accountId = config.get('R2_ACCOUNT_ID', '');
    const accessKeyId = config.get('R2_ACCESS_KEY_ID', '');
    const secretAccessKey = config.get('R2_SECRET_ACCESS_KEY', '');
    const endpoint = config.get('R2_ENDPOINT') || (accountId && `https://${accountId}.r2.cloudflarestorage.com`);
    const missing = Object.entries({ R2_BUCKET: this.bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, 'R2_ACCOUNT_ID o R2_ENDPOINT': endpoint })
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length) throw new Error(`STORAGE_DRIVER=r2 requiere: ${missing.join(', ')}`);
    this.s3 = new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } });
    this.logger.log(`Archivos en Cloudflare R2 (bucket ${this.bucket})`);
  }

  // los nombres antiguos (un uuid suelto) viven bajo `attachments/`; los nuevos ya traen su ruta completa
  private key(name: string) {
    return name.includes('/') ? name : `attachments/${name}`;
  }

  async put(name: string, body: Buffer, contentType: string) {
    if (!this.s3) {
      const path = join(this.dir, name);
      await fs.mkdir(dirname(path), { recursive: true });
      return fs.writeFile(path, body);
    }
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.key(name), Body: body, ContentType: contentType }));
  }

  async exists(name: string): Promise<boolean> {
    if (!this.s3) return fs.access(join(this.dir, name)).then(() => true, () => false);
    return this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(name) })).then(() => true, () => false);
  }

  async getStream(name: string): Promise<Readable> {
    if (!this.s3) {
      const path = join(this.dir, name);
      if (!(await fs.access(path).then(() => true, () => false))) throw new NotFoundException('Archivo no encontrado');
      return createReadStream(path);
    }
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
      return res.Body as Readable;
    } catch (e: any) {
      if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) throw new NotFoundException('Archivo no encontrado');
      throw e;
    }
  }

  async copy(from: string, to: string) {
    if (!this.s3) {
      const path = join(this.dir, to);
      await fs.mkdir(dirname(path), { recursive: true });
      return fs.copyFile(join(this.dir, from), path);
    }
    // se lee y se vuelve a escribir en vez de CopyObject: si R2_ENDPOINT trae el bucket en la ruta,
    // las claves reales llevan ese prefijo y CopySource no las encontraría
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(from) }));
    const body = Buffer.from(await res.Body!.transformToByteArray());
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.key(to), Body: body, ContentType: res.ContentType }));
  }

  // nunca falla: un archivo huérfano no debe romper el borrado de datos
  async delete(names: string[]) {
    if (names.length === 0) return;
    if (!this.s3) {
      await Promise.all(names.map((n) => fs.unlink(join(this.dir, n)).catch(() => undefined)));
      return;
    }
    try {
      await this.s3.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: names.map((n) => ({ Key: this.key(n) })), Quiet: true },
      }));
    } catch (e) {
      this.logger.warn(`No se pudieron borrar ${names.length} archivo(s) de R2: ${(e as Error).message}`);
    }
  }
}
