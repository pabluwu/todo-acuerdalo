import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Note } from './note.entity';
import { User } from './user.entity';

/** Archivo adjunto a una nota; los bytes viven en StorageService bajo `storedName`. */
@Entity('note_files')
export class NoteFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'note_id', type: 'uuid' })
  noteId!: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note!: Relation<Note>;

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
