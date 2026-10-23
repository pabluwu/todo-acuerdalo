import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Persona externa (cliente, proveedor…): solo para seguimiento, nunca recibe correos. */
@Entity('external_contacts')
export class ExternalContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** Los contactos vinculados a un cliente pueden no tener correo. */
  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null;

  /** Cliente al que está vinculado; se mantiene sincronizado desde la ficha del cliente. */
  @Column({ name: 'client_id', type: 'uuid', nullable: true, unique: true })
  clientId!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
