import { Entity, PrimaryColumn } from 'typeorm';

@Entity('publication_reviewers')
export class PublicationReviewer {
  @PrimaryColumn({ name: 'publication_id', type: 'uuid' })
  publicationId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;
}
