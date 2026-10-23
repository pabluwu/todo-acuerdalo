import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';

/** Nota del cuaderno de un cliente: la ven y editan todos los usuarios. */
@Entity('client_notes')
export class ClientNote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId!: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: Relation<Client>;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  /** Markdown */
  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId!: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author!: Relation<User> | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById!: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy!: Relation<User> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
