import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Comment } from './comment.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'comment_id', type: 'uuid' })
  commentId!: string;

  @ManyToOne(() => Comment, (c) => c.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment!: Relation<Comment>;

  @Column({ name: 'original_name', type: 'varchar', length: 300 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 150 })
  mimeType!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ name: 'stored_name', type: 'varchar', length: 500 })
  storedName!: string;
}
