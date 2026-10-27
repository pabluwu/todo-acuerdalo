import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Archivo de una versión (un video, o una imagen de un carrusel); los bytes viven en StorageService. */
@Entity('publication_version_files')
export class PublicationVersionFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'stored_name', type: 'varchar', length: 500 })
  storedName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 150 })
  mimeType!: string;

  // bigint llega como string desde pg
  @Column({ type: 'bigint', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  size!: number;

  @Column({ type: 'int', default: 0 })
  position!: number;
}
