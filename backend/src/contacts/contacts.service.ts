import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators';
import { ExternalContact } from '../entities/external-contact.entity';
import { ContactQueryDto, CreateContactDto, UpdateContactDto } from './contacts.dto';

export interface ContactInput {
  id?: string;
  name?: string;
  email?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function presentContact(c: ExternalContact) {
  return { id: c.id, name: c.name, email: c.email, clientId: c.clientId };
}

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(ExternalContact) private contacts: Repository<ExternalContact>,
    private audit: AuditService,
  ) {}

  async list(q: ContactQueryDto) {
    const qb = this.contacts.createQueryBuilder('c').orderBy('lower(c.name)', 'ASC').limit(200);
    const term = q.q?.trim();
    if (term) {
      qb.where('c.name ILIKE :t OR c.email ILIKE :t', { t: `%${term.replace(/[%_\\]/g, '\\$&')}%` });
    }
    return (await qb.getMany()).map(presentContact);
  }

  async create(dto: CreateContactDto, actor: AuthUser) {
    const { contact, created } = await this.upsertByEmail(dto.name, dto.email, actor);
    if (created) await this.audit.log(actor, 'contact.create', 'contact', contact.id, null, presentContact(contact));
    return presentContact(contact);
  }

  async update(id: string, dto: UpdateContactDto, actor: AuthUser) {
    const contact = await this.contacts.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    this.assertNotClient(contact);
    const before = presentContact(contact);
    if (dto.name !== undefined) contact.name = dto.name.trim();
    if (dto.email !== undefined && dto.email.trim().toLowerCase() !== (contact.email ?? '').toLowerCase()) {
      const clash = await this.findByEmail(dto.email);
      if (clash && clash.id !== id) throw new ConflictException('Ya existe un contacto con ese correo');
      contact.email = dto.email.trim();
    } else if (dto.email !== undefined) {
      contact.email = dto.email.trim();
    }
    await this.contacts.save(contact);
    const after = presentContact(contact);
    await this.audit.log(actor, 'contact.update', 'contact', id, before, after);
    return after;
  }

  async remove(id: string, actor: AuthUser) {
    const contact = await this.contacts.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    this.assertNotClient(contact);
    const before = presentContact(contact);
    await this.contacts.delete(id);
    await this.audit.log(actor, 'contact.delete', 'contact', id, before, null);
    return { ok: true };
  }

  /** Los contactos de un cliente se mantienen desde su ficha, no desde el directorio. */
  private assertNotClient(contact: ExternalContact) {
    if (contact.clientId) throw new BadRequestException('Se edita desde la ficha del cliente');
  }

  private findByEmail(email: string) {
    return this.contacts
      .createQueryBuilder('c')
      .where('lower(c.email) = lower(:email)', { email: email.trim() })
      .getOne();
  }

  private async upsertByEmail(name: string, email: string, actor: AuthUser) {
    const existing = await this.findByEmail(email);
    if (existing) return { contact: existing, created: false };
    const contact = await this.contacts.save(
      this.contacts.create({ name: name.trim(), email: email.trim(), createdById: actor.id }),
    );
    return { contact, created: true };
  }

  /**
   * Convierte `[{id}]` / `[{name,email}]` en contactos del directorio.
   * Los nuevos se crean (o se reutilizan por correo) y quedan registrados en el audit log.
   */
  async resolve(inputs: ContactInput[], actor: AuthUser): Promise<ExternalContact[]> {
    const byId = inputs.filter((i) => i.id).map((i) => i.id!);
    const found = byId.length ? await this.contacts.find({ where: { id: In(byId) } }) : [];
    if (found.length !== new Set(byId).size) throw new BadRequestException('Algún contacto externo no existe');
    const result = new Map<string, ExternalContact>(found.map((c) => [c.id, c]));
    for (const i of inputs) {
      if (i.id) continue;
      const name = i.name?.trim();
      const email = i.email?.trim();
      if (!name || !email || !EMAIL_RE.test(email) || email.length > 320)
        throw new BadRequestException('Cada contacto externo necesita un nombre y un correo válido');
      const { contact, created } = await this.upsertByEmail(name, email, actor);
      if (created) await this.audit.log(actor, 'contact.create', 'contact', contact.id, null, presentContact(contact));
      result.set(contact.id, contact);
    }
    return [...result.values()];
  }
}
