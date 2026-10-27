import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Una subida de archivos de la pieza; cada aprobación pertenece a una versión. */
@Entity('publication_versions')
export class PublicationVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'publication_id', type: 'uuid' })
  publicationId!: string;

  @Column({ type: 'int' })
  number!: number;

  @Column({ type: 'text', default: '' })
  note!: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedById!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
