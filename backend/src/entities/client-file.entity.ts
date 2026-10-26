import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { ClientFolder } from './client-folder.entity';
import { Client } from './client.entity';
import { User } from './user.entity';

/** Archivo del repositorio de un cliente; los bytes viven en StorageService bajo `storedName`. */
@Entity('client_files')
export class ClientFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId!: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: Relation<Client>;

  @Column({ name: 'folder_id', type: 'uuid', nullable: true })
  folderId!: string | null;

  @ManyToOne(() => ClientFolder, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folder_id' })
  folder!: Relation<ClientFolder> | null;

  @Column({ name: 'original_name', type: 'varchar', length: 300 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 150 })
  mimeType!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ name: 'stored_name', type: 'varchar', length: 500 })
  storedName!: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedById!: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy!: Relation<User> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
