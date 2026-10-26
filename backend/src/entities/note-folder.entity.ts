import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { NoteVisibility } from './note.entity';
import { User } from './user.entity';

/** Carpeta de notas: las comunes son del equipo (`ownerId` nulo); las privadas, de su dueño. `parentId` nulo es la raíz. */
@Entity('note_folders')
export class NoteFolder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  visibility!: NoteVisibility;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId!: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => NoteFolder, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent!: Relation<NoteFolder> | null;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: Relation<User> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
