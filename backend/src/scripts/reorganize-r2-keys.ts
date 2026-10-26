import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Not, Like, Repository } from 'typeorm';
import { typeOrmConfig } from '../database/typeorm.config';
import { EntitiesModule } from '../database/entities.module';
import { Attachment } from '../entities/attachment.entity';
import { ClientFile } from '../entities/client-file.entity';
import { storageKey } from '../storage/storage-key';
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

/**
 * Mueve los archivos guardados con el esquema antiguo (`attachments/<uuid>.ext`) a rutas descriptivas:
 * `tareas/<id-tarea>/…` y `clientes/<id-cliente>/…`. Por cada archivo: copia, actualiza la fila y borra el original.
 * Idempotente: solo toca filas cuyo nombre aún no tiene ruta. Si se interrumpe, basta con volver a correrlo.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  try {
    const storage = app.get(StorageService);
    const attachments = app.get<Repository<Attachment>>(getRepositoryToken(Attachment));
    const clientFiles = app.get<Repository<ClientFile>>(getRepositoryToken(ClientFile));
    let moved = 0, missing = 0, failed = 0;

    const move = async (oldName: string, newName: string, save: (name: string) => Promise<unknown>) => {
      if (!(await storage.exists(oldName))) {
        missing++;
        console.warn(`No existe en el almacenamiento: ${oldName}`);
        return;
      }
      try {
        await storage.copy(oldName, newName);
        await save(newName);
        await storage.delete([oldName]);
        moved++;
      } catch (e) {
        failed++;
        console.error(`No se pudo mover ${oldName}: ${(e as Error).message}`);
      }
    };

    const legacy = { storedName: Not(Like('%/%')) };
    const attRows = await attachments.find({ where: legacy, relations: { comment: true } });
    for (const a of attRows) {
      await move(a.storedName, storageKey(`tareas/${a.comment.taskId}`, a.originalName), (name) => attachments.update(a.id, { storedName: name }));
    }
    const fileRows = await clientFiles.find({ where: legacy });
    for (const f of fileRows) {
      await move(f.storedName, storageKey(`clientes/${f.clientId}`, f.originalName), (name) => clientFiles.update(f.id, { storedName: name }));
    }
    const total = attRows.length + fileRows.length;
    console.log(`OK: ${moved} movidos, ${missing} no encontrados, ${failed} con error (de ${total} con ruta antigua; driver ${storage.driver})`);
    if (failed) process.exitCode = 1;
  } finally {
    await app.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
