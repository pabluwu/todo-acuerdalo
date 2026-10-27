import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Pieza de contenido planificada (video o post) que el equipo revisa antes de publicar. */
@Entity('publications')
export class Publication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 10 })
  format!: 'video' | 'post';

  @Column({ type: 'text', array: true, default: '{}' })
  platforms!: string[];

  @Column({ type: 'varchar', length: 20, default: 'idea' })
  status!: 'idea' | 'edicion' | 'por_publicar' | 'publicada' | 'cancelada';

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ type: 'text', default: '' })
  caption!: string;

  @Column({ type: 'text', default: '' })
  brief!: string;

  @Column({ name: 'cancelled_from', type: 'varchar', length: 20, nullable: true })
  cancelledFrom!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
