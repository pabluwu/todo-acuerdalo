import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, Relation } from 'typeorm';
import { Note } from './note.entity';
import { User } from './user.entity';

export type NotePermission = 'view' | 'edit';

@Entity('note_shares')
export class NoteShare {
  @PrimaryColumn({ name: 'note_id', type: 'uuid' })
  noteId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => Note, (n) => n.shares, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note!: Relation<Note>;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ type: 'varchar', length: 10 })
  permission!: NotePermission;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
