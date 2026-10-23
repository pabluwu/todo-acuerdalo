import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { typeOrmConfig } from '../database/typeorm.config';
import { EntitiesModule } from '../database/entities.module';
import { Attachment } from '../entities/attachment.entity';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: typeOrmConfig }),
    EntitiesModule,
    StorageModule,
  ],
})
class ScriptModule {}

// Sube a R2 los adjuntos que siguen en UPLOAD_DIR. Idempotente: salta los que ya están.
async function main() {
  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  try {
    const storage = app.get(StorageService);
    if (storage.driver !== 'r2') {
      console.error('Configura STORAGE_DRIVER=r2 y las variables R2_* antes de migrar');
      process.exitCode = 1;
      return;
    }
    const dir = app.get(ConfigService).get('UPLOAD_DIR', '/app/uploads');
    const attachments = app.get<Repository<Attachment>>(getRepositoryToken(Attachment));
    const rows = await attachments.find();
    let uploaded = 0, skipped = 0, missing = 0;
    for (const a of rows) {
      const path = join(dir, a.storedName);
      const body = await fs.readFile(path).catch(() => null);
      if (!body) {
        missing++;
        console.warn(`Falta en disco: ${a.storedName} (${a.originalName})`);
        continue;
      }
      if (await storage.exists(a.storedName)) {
        skipped++;
        continue;
      }
      await storage.put(a.storedName, body, a.mimeType);
      uploaded++;
    }
    console.log(`OK: ${uploaded} subidos, ${skipped} ya estaban en R2, ${missing} no encontrados en ${dir} (de ${rows.length} adjuntos)`);
  } finally {
    await app.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
