import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation, UpdateDateColumn,
} from 'typeorm';
import { NoteFile } from './note-file.entity';
import { NoteShare } from './note-share.entity';
import { User } from './user.entity';

export type NoteVisibility = 'common' | 'private';

@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  /** Markdown */
  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ type: 'varchar', length: 10, default: 'common' })
  visibility!: NoteVisibility;

  /** Carpeta donde la ubica su dueño (privadas) o el equipo (comunes); nula en la raíz. */
  @Column({ name: 'folder_id', type: 'uuid', nullable: true })
  folderId!: string | null;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId!: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner!: Relation<User> | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById!: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy!: Relation<User> | null;

  @OneToMany(() => NoteShare, (s) => s.note)
  shares!: Relation<NoteShare>[];

  @OneToMany(() => NoteFile, (f) => f.note)
  files!: Relation<NoteFile>[];

  /** Solo en listados (`loadRelationCountAndMap`) */
  fileCount?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
