import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/** Ficha de un cliente del estudio. Todos los campos son opcionales salvo el nombre. */
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  rut!: string | null;

  /** Texto libre, sin cifrar (decisión de producto). */
  @Column({ name: 'clave_unica', type: 'varchar', length: 200, nullable: true })
  claveUnica!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  occupation!: string | null;

  @Column({ name: 'marital_status', type: 'varchar', length: 40, nullable: true })
  maritalStatus!: string | null;

  /** Materia, juicio o servicio. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  matter!: string | null;

  @Column({ name: 'defendant_name', type: 'varchar', length: 200, nullable: true })
  defendantName!: string | null;

  @Column({ name: 'defendant_rut', type: 'varchar', length: 12, nullable: true })
  defendantRut!: string | null;

  @Column({ name: 'defendant_address', type: 'varchar', length: 300, nullable: true })
  defendantAddress!: string | null;

  /** Texto libre: «$800.000 aprox.» */
  @Column({ name: 'defendant_income', type: 'varchar', length: 100, nullable: true })
  defendantIncome!: string | null;

  @Column({ name: 'case_history', type: 'text', default: '' })
  caseHistory!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: Relation<User> | null;

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
