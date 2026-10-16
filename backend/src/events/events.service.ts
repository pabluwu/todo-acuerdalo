import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators';
import { ContactsService, presentContact } from '../contacts/contacts.service';
import { CalendarEvent } from '../entities/event.entity';
import { User } from '../entities/user.entity';
import { detectEventChanges, EventSnapshot, newlyAdded, rangeOverlaps, snapshotEvent } from './event-changes';
import { ConflictQueryDto, CreateEventDto, EventQueryDto, MoveEventDto, UpdateEventDto } from './events.dto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseIds(csv: string | undefined, what: string): string[] {
  if (!csv) return [];
  const ids = csv.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.some((i) => !UUID_RE.test(i))) throw new BadRequestException(`Identificadores de ${what} inválidos`);
  return [...new Set(ids)];
}

function parseRange(startAt: string, endAt: string): { start: Date; end: Date } {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('Fecha inválida');
  if (end.getTime() < start.getTime()) throw new BadRequestException('La hora de fin no puede ser anterior al inicio');
  return { start, end };
}

type Person = { id: string; name: string; email: string; isActive: boolean };
const person = (u: User): Person => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive });

/**
 * Carga útil de los eventos de dominio. Contiene solo usuarios internos:
 * los contactos externos no viajan nunca hacia las notificaciones.
 */
export function notificationPayload(e: CalendarEvent) {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? '',
    location: e.location ?? '',
    startAt: new Date(e.startAt).toISOString(),
    endAt: new Date(e.endAt).toISOString(),
    allDay: e.allDay,
    participants: (e.participants ?? []).map(person),
    createdBy: e.createdBy ? person(e.createdBy) : null,
  };
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(CalendarEvent) private events: Repository<CalendarEvent>,
    @InjectRepository(User) private users: Repository<User>,
    private contacts: ContactsService,
    private audit: AuditService,
    private emitter: EventEmitter2,
  ) {}

  present(e: CalendarEvent) {
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startAt: new Date(e.startAt).toISOString(),
      endAt: new Date(e.endAt).toISOString(),
      allDay: e.allDay,
      color: e.color,
      reminderMinutes: e.reminderMinutes,
      createdBy: e.createdBy ? { id: e.createdBy.id, name: e.createdBy.name } : null,
      participants: [...(e.participants ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ id: u.id, name: u.name, email: u.email })),
      externalContacts: [...(e.externalContacts ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(presentContact),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  async list(q: EventQueryDto, actor: AuthUser) {
    const { start: from, end: to } = parseRange(q.from, q.to);
    let userIds = parseIds(q.userIds, 'usuarios');
    if (q.mine === 'true') userIds = [actor.id];
    const contactIds = parseIds(q.contactIds, 'contactos');

    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.participants', 'p')
      .leftJoinAndSelect('e.externalContacts', 'c')
      .leftJoinAndSelect('e.createdBy', 'cb')
      // solapamiento con el rango; los eventos de duración cero cuentan si caen dentro
      .where('e.start_at < :to AND (e.end_at > :from OR (e.end_at = e.start_at AND e.start_at >= :from))', { from, to });
    if (userIds.length) {
      qb.andWhere(
        '(e.id IN (SELECT ep.event_id FROM event_participants ep WHERE ep.user_id IN (:...uids)) OR e.created_by IN (:...uids))',
        { uids: userIds },
      );
    }
    if (contactIds.length) {
      qb.andWhere('e.id IN (SELECT ec.event_id FROM event_external_contacts ec WHERE ec.contact_id IN (:...cids))', {
        cids: contactIds,
      });
    }
    qb.orderBy('e.start_at', 'ASC').addOrderBy('e.created_at', 'ASC');
    return (await qb.getMany()).map((e) => this.present(e));
  }

  async get(id: string) {
    return this.present(await this.getOrFail(id));
  }

  async getOrFail(id: string): Promise<CalendarEvent> {
    const event = await this.events.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  /** Solo el creador o un administrador pueden modificar o eliminar un evento. */
  assertCanEdit(event: Pick<CalendarEvent, 'createdById'>, actor: AuthUser) {
    if (event.createdById !== actor.id && actor.role !== 'admin')
      throw new ForbiddenException('Solo el creador o un administrador puede modificar este evento');
  }

  private async loadParticipants(ids: string[]): Promise<User[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const users = await this.users.find({ where: { id: In(unique), isActive: true } });
    if (users.length !== unique.length) throw new BadRequestException('Algún participante no existe o no está activo');
    return users;
  }

  async create(dto: CreateEventDto, actor: AuthUser) {
    const { start, end } = parseRange(dto.startAt, dto.endAt);
    const participants = await this.loadParticipants(dto.participantIds ?? []);
    const externals = await this.contacts.resolve(dto.externalContacts ?? [], actor);
    const created = await this.events.save(
      this.events.create({
        title: dto.title.trim(),
        description: dto.description ?? '',
        location: dto.location?.trim() ?? '',
        startAt: start,
        endAt: end,
        allDay: dto.allDay ?? false,
        color: dto.color ?? 'accent',
        reminderMinutes: dto.reminderMinutes ?? null,
        reminderSentAt: null,
        createdById: actor.id,
        createdBy: { id: actor.id } as User,
        participants,
        externalContacts: externals,
      }),
    );
    const event = await this.getOrFail(created.id);
    const presented = this.present(event);
    await this.audit.log(actor, 'event.create', 'event', event.id, null, presented);
    if (participants.length > 0) {
      this.emitter.emit('event.invited', {
        event: notificationPayload(event),
        actor: { id: actor.id, name: actor.name },
        newParticipants: participants.map(person),
      });
    }
    return presented;
  }

  async update(id: string, dto: UpdateEventDto, actor: AuthUser) {
    const event = await this.getOrFail(id);
    this.assertCanEdit(event, actor);
    return this.apply(event, dto, actor, 'event.update');
  }

  async move(id: string, dto: MoveEventDto, actor: AuthUser) {
    const event = await this.getOrFail(id);
    this.assertCanEdit(event, actor);
    return this.apply(event, { startAt: dto.startAt, endAt: dto.endAt, allDay: dto.allDay }, actor, 'event.move');
  }

  private async apply(event: CalendarEvent, dto: UpdateEventDto, actor: AuthUser, action: 'event.update' | 'event.move') {
    const before: EventSnapshot = snapshotEvent(event);
    const beforePresented = this.present(event);

    const { start, end } = parseRange(dto.startAt ?? event.startAt.toISOString(), dto.endAt ?? event.endAt.toISOString());
    const startChanged = start.getTime() !== new Date(event.startAt).getTime();
    event.startAt = start;
    event.endAt = end;
    if (dto.title !== undefined) event.title = dto.title.trim();
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.location !== undefined) event.location = dto.location.trim();
    if (dto.allDay !== undefined) event.allDay = dto.allDay;
    if (dto.color !== undefined) event.color = dto.color;
    let reminderChanged = false;
    if (dto.reminderMinutes !== undefined && dto.reminderMinutes !== event.reminderMinutes) {
      event.reminderMinutes = dto.reminderMinutes;
      reminderChanged = true;
    }
    // mover el inicio o cambiar el recordatorio lo vuelve a armar
    if (startChanged || reminderChanged) event.reminderSentAt = null;
    if (dto.participantIds !== undefined) event.participants = await this.loadParticipants(dto.participantIds);
    if (dto.externalContacts !== undefined) event.externalContacts = await this.contacts.resolve(dto.externalContacts, actor);

    await this.events.save(event);
    const updated = await this.getOrFail(event.id);
    const changes = detectEventChanges(before, snapshotEvent(updated), 'UTC');
    const added = newlyAdded(before, updated.participants);
    const presented = this.present(updated);
    await this.audit.log(actor, action, 'event', event.id, beforePresented, presented);

    const a = { id: actor.id, name: actor.name };
    if (added.length > 0) {
      this.emitter.emit('event.invited', { event: notificationPayload(updated), actor: a, newParticipants: added.map(person) });
    }
    if (changes.length > 0) {
      this.emitter.emit('event.changed', {
        event: notificationPayload(updated),
        before,
        actor: a,
        excludeUserIds: added.map((u) => u.id),
      });
    }
    return presented;
  }

  async remove(id: string, actor: AuthUser) {
    const event = await this.getOrFail(id);
    this.assertCanEdit(event, actor);
    const before = this.present(event);
    const payload = notificationPayload(event);
    await this.events.delete(id);
    await this.audit.log(actor, 'event.delete', 'event', id, before, null);
    this.emitter.emit('event.cancelled', { event: payload, actor: { id: actor.id, name: actor.name } });
    return { ok: true };
  }

  /** Eventos que se solapan con el horario dado, por usuario (participante). */
  async conflicts(q: ConflictQueryDto) {
    const { start, end } = parseRange(q.startAt, q.endAt);
    const userIds = parseIds(q.userIds, 'usuarios');
    const result: Record<string, { id: string; title: string; startAt: string; endAt: string }[]> = {};
    if (userIds.length === 0) return result;
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.participants', 'p')
      .where('e.start_at < :end AND e.end_at > :start', { start, end })
      .andWhere('e.id IN (SELECT ep.event_id FROM event_participants ep WHERE ep.user_id IN (:...uids))', { uids: userIds });
    if (q.excludeId) qb.andWhere('e.id <> :ex', { ex: q.excludeId });
    for (const e of await qb.getMany()) {
      if (!rangeOverlaps(new Date(e.startAt), new Date(e.endAt), start, end)) continue;
      for (const p of e.participants) {
        if (!userIds.includes(p.id)) continue;
        (result[p.id] ??= []).push({
          id: e.id,
          title: e.title,
          startAt: new Date(e.startAt).toISOString(),
          endAt: new Date(e.endAt).toISOString(),
        });
      }
    }
    return result;
  }
}
