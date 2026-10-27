import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('publication_comments')
export class PublicationComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'publication_id', type: 'uuid' })
  publicationId!: string;

  @Column({ name: 'version_id', type: 'uuid', nullable: true })
  versionId!: string | null;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ type: 'text' })
  body!: string;

  /** Segundo del video al que apunta el comentario. */
  @Column({
    name: 'timecode_sec', type: 'numeric', precision: 8, scale: 2, nullable: true,
    transformer: { to: (v: number | null) => v, from: (v: string | null) => (v == null ? null : Number(v)) },
  })
  timecodeSec!: number | null;

  /** Índice (desde 0) de la imagen del carrusel. */
  @Column({ name: 'slide_index', type: 'int', nullable: true })
  slideIndex!: number | null;

  @Column({ name: 'mention_ids', type: 'uuid', array: true, default: '{}' })
  mentionIds!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
