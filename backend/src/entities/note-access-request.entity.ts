import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Note } from './note.entity';
import { User } from './user.entity';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('note_access_requests')
export class NoteAccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'note_id', type: 'uuid' })
  noteId!: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note!: Relation<Note>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status!: AccessRequestStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
