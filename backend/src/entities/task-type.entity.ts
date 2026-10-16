import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('task_types')
export class TaskType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  name!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
