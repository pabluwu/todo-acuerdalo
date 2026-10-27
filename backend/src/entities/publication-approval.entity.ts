import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('publication_approvals')
export class PublicationApproval {
  @PrimaryColumn({ name: 'version_id', type: 'uuid' })
  versionId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 10 })
  decision!: 'aprobada' | 'cambios';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
