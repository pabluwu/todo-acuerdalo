import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators';
import { Note } from '../entities/note.entity';
import { NoteAccessRequest } from '../entities/note-access-request.entity';
import { NotePermission, NoteShare } from '../entities/note-share.entity';
import { User } from '../entities/user.entity';
import { accessFor, canDeleteNote, canEditNote, NoteAccess } from './note-access';
import { CreateNoteDto, ResolveRequestDto, SetSharesDto, UpdateNoteDto } from './notes.dto';

const person = (u: User) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive });
const lite = (u: User | null) => (u ? { id: u.id, name: u.name } : null);

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note) private notes: Repository<Note>,
    @InjectRepository(NoteShare) private shares: Repository<NoteShare>,
    @InjectRepository(NoteAccessRequest) private requests: Repository<NoteAccessRequest>,
    @InjectRepository(User) private users: Repository<User>,
    private audit: AuditService,
    private events: EventEmitter2,
  ) {}

  private shareOf(note: Note, userId: string) {
    return (note.shares ?? []).find((s) => s.userId === userId) ?? null;
  }

  private accessOf(note: Note, actor: AuthUser): NoteAccess {
    return accessFor(note, actor.id, this.shareOf(note, actor.id));
  }

  /** Resumen para listados: nunca incluye más que un extracto del cuerpo. */
  private summary(n: Note, actor: AuthUser) {
    const access = this.accessOf(n, actor);
    return {
      id: n.id,
      title: n.title,
      excerpt: n.body.slice(0, 300),
      visibility: n.visibility,
      owner: lite(n.owner),
      updatedBy: lite(n.updatedBy),
      myAccess: access,
      // solo el dueño ve con quién comparte; el resto, apenas si está compartida
      shared: n.visibility === 'private' && (n.shares ?? []).length > 0,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  }

  /** Solo se llama con acceso confirmado: es la única función que serializa el cuerpo. */
  present(n: Note, access: NoteAccess, actor: AuthUser) {
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      visibility: n.visibility,
      owner: lite(n.owner),
      updatedBy: lite(n.updatedBy),
      myAccess: access,
      canDelete: canDeleteNote(n, actor.id, actor.role),
      shares:
        access === 'owner' && n.visibility === 'private'
          ? [...(n.shares ?? [])]
              .sort((a, b) => a.user.name.localeCompare(b.user.name))
              .map((s) => ({ userId: s.userId, name: s.user.name, email: s.user.email, permission: s.permission }))
          : [],
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  }

  private async load(id: string): Promise<Note> {
    const note = await this.notes.findOne({ where: { id }, relations: { shares: { user: true } } });
    if (!note) throw new NotFoundException('Nota no encontrada');
    return note;
  }

  async list(scope: string | undefined, q: string | undefined, actor: AuthUser) {
    const qb = this.notes
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.owner', 'o')
      .leftJoinAndSelect('n.updatedBy', 'ub')
      .leftJoinAndSelect('n.shares', 's');
    if (scope === 'private') {
      qb.where("n.visibility = 'private'").andWhere(
        '(n.owner_id = :uid OR n.id IN (SELECT ns.note_id FROM note_shares ns WHERE ns.user_id = :uid))',
        { uid: actor.id },
      );
    } else {
      qb.where("n.visibility = 'common'");
    }
    const term = (q ?? '').trim().slice(0, 100);
    if (term) {
      qb.andWhere("(n.title ILIKE :q ESCAPE '\\' OR n.body ILIKE :q ESCAPE '\\')", { q: likePattern(term) });
    }
    qb.orderBy('n.updated_at', 'DESC');
    return (await qb.getMany()).map((n) => this.summary(n, actor));
  }

  async get(id: string, actor: AuthUser) {
    const note = await this.load(id);
    const access = this.accessOf(note, actor);
    if (access === 'none') {
      // solo título y dueño: lo justo para ofrecer "Solicitar acceso"; el cuerpo nunca sale de aquí
      const last = await this.requests.findOne({ where: { noteId: id, userId: actor.id }, order: { createdAt: 'DESC' } });
      throw new ForbiddenException({
        code: 'NO_ACCESS',
        message: 'Esta nota es privada',
        title: note.title,
        owner: lite(note.owner),
        requestStatus: last && last.status !== 'approved' ? last.status : null,
      });
    }
    return this.present(note, access, actor);
  }

  async create(dto: CreateNoteDto, actor: AuthUser) {
    const note = await this.notes.save(
      this.notes.create({
        title: dto.title.trim(),
        body: dto.body ?? '',
        visibility: dto.visibility,
        ownerId: actor.id,
        updatedById: actor.id,
      }),
    );
    await this.audit.log(actor, 'note.create', 'note', note.id, null, { title: note.title, visibility: note.visibility });
    return this.present(await this.load(note.id), 'owner', actor);
  }

  async update(id: string, dto: UpdateNoteDto, actor: AuthUser) {
    const note = await this.load(id);
    const access = this.accessOf(note, actor);
    if (!canEditNote(access)) throw new ForbiddenException('No tienes permiso para editar esta nota');
    const before = { title: note.title, visibility: note.visibility };
    const changed: string[] = [];
    if (dto.title !== undefined && dto.title.trim() !== note.title) {
      note.title = dto.title.trim();
      changed.push('title');
    }
    if (dto.body !== undefined && dto.body !== note.body) {
      note.body = dto.body;
      changed.push('body');
    }
    if (dto.visibility !== undefined && dto.visibility !== note.visibility) {
      if (access !== 'owner') throw new ForbiddenException('Solo el dueño puede cambiar la visibilidad');
      note.visibility = dto.visibility;
      changed.push('visibility');
      if (dto.visibility === 'common') {
        // al hacerse común ya no hay accesos individuales ni solicitudes que atender
        await this.shares.delete({ noteId: id });
        await this.requests.delete({ noteId: id });
        note.shares = [];
      }
    }
    if (changed.length === 0) return this.present(note, access, actor);
    await this.notes.update(id, { title: note.title, body: note.body, visibility: note.visibility, updatedById: actor.id });
    // el cuerpo no se copia al registro de auditoría: las privadas no deben filtrarse por ahí
    await this.audit.log(actor, 'note.update', 'note', id, before, { title: note.title, visibility: note.visibility, changed });
    return this.present(await this.load(id), access, actor);
  }

  async remove(id: string, actor: AuthUser) {
    const note = await this.load(id);
    if (this.accessOf(note, actor) === 'none') throw new ForbiddenException('No tienes acceso a esta nota');
    if (!canDeleteNote(note, actor.id, actor.role)) throw new ForbiddenException('Solo el autor o un administrador puede eliminar esta nota');
    await this.notes.delete(id);
    await this.audit.log(actor, 'note.delete', 'note', id, { title: note.title, visibility: note.visibility }, null);
    return { ok: true };
  }

  async setShares(id: string, dto: SetSharesDto, actor: AuthUser) {
    const note = await this.load(id);
    if (this.accessOf(note, actor) !== 'owner') throw new ForbiddenException('Solo el dueño puede compartir esta nota');
    if (note.visibility !== 'private') throw new BadRequestException('Solo las notas privadas se comparten por persona');

    const wanted = new Map<string, NotePermission>();
    for (const s of dto.shares) if (s.userId !== actor.id) wanted.set(s.userId, s.permission);
    const active = wanted.size ? await this.users.find({ where: { id: In([...wanted.keys()]), isActive: true } }) : [];
    const valid = new Map(active.map((u) => [u.id, u]));

    const existing = new Map((note.shares ?? []).map((s) => [s.userId, s]));
    const removed = [...existing.keys()].filter((uid) => !valid.has(uid));
    if (removed.length) await this.shares.delete({ noteId: id, userId: In(removed) });
    const added: User[] = [];
    for (const [uid, user] of valid) {
      const permission = wanted.get(uid)!;
      if (existing.get(uid)?.permission === permission) continue;
      await this.shares.save(this.shares.create({ noteId: id, userId: uid, permission }));
      if (!existing.has(uid)) added.push(user);
    }
    // quien recibe acceso por esta vía ya no necesita su solicitud pendiente
    if (valid.size) {
      await this.requests.update(
        { noteId: id, userId: In([...valid.keys()]), status: 'pending' },
        { status: 'approved', resolvedAt: new Date() },
      );
    }
    await this.audit.log(
      actor,
      'note.share',
      'note',
      id,
      { shares: [...existing.values()].map((s) => ({ userId: s.userId, permission: s.permission })) },
      { shares: [...valid.keys()].map((uid) => ({ userId: uid, permission: wanted.get(uid) })) },
    );
    for (const user of added) {
      this.events.emit('note.shared', {
        note: { id, title: note.title },
        actor: { id: actor.id, name: actor.name },
        user: person(user),
        permission: wanted.get(user.id),
      });
    }
    return this.present(await this.load(id), 'owner', actor);
  }

  async requestAccess(id: string, actor: AuthUser) {
    const note = await this.load(id);
    if (note.visibility !== 'private') throw new BadRequestException('Esta nota no es privada');
    if (this.accessOf(note, actor) !== 'none') throw new BadRequestException('Ya tienes acceso a esta nota');
    if (!note.owner) throw new BadRequestException('Esta nota ya no tiene dueño');
    const pending = await this.requests.findOne({ where: { noteId: id, userId: actor.id, status: 'pending' } });
    if (pending) return { status: pending.status };
    const req = await this.requests.save(this.requests.create({ noteId: id, userId: actor.id, status: 'pending' }));
    await this.audit.log(actor, 'note.access_request', 'note', id, null, { requestId: req.id });
    if (note.owner.isActive) {
      this.events.emit('note.access_requested', {
        note: { id, title: note.title },
        actor: { id: actor.id, name: actor.name },
        owner: person(note.owner),
      });
    }
    return { status: req.status };
  }

  async listRequests(id: string, actor: AuthUser) {
    const note = await this.load(id);
    if (this.accessOf(note, actor) !== 'owner') throw new ForbiddenException('Solo el dueño ve las solicitudes de acceso');
    const rows = await this.requests.find({ where: { noteId: id, status: 'pending' }, order: { createdAt: 'ASC' } });
    return rows.map((r) => ({ id: r.id, noteId: r.noteId, user: { id: r.user.id, name: r.user.name, email: r.user.email }, createdAt: r.createdAt }));
  }

  async resolveRequest(requestId: string, dto: ResolveRequestDto, actor: AuthUser) {
    const req = await this.requests.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    const note = await this.load(req.noteId);
    if (this.accessOf(note, actor) !== 'owner') throw new ForbiddenException('Solo el dueño puede resolver solicitudes');
    if (req.status !== 'pending') throw new BadRequestException('La solicitud ya fue resuelta');
    const permission: NotePermission = dto.permission ?? 'view';
    req.status = dto.approve ? 'approved' : 'rejected';
    req.resolvedAt = new Date();
    await this.requests.save(req);
    if (dto.approve) {
      await this.shares.save(this.shares.create({ noteId: note.id, userId: req.userId, permission }));
    }
    await this.audit.log(actor, 'note.access_resolve', 'note', note.id, null, {
      requestId, userId: req.userId, approved: dto.approve, ...(dto.approve && { permission }),
    });
    if (dto.approve && req.user.isActive) {
      this.events.emit('note.access_granted', {
        note: { id: note.id, title: note.title },
        actor: { id: actor.id, name: actor.name },
        user: person(req.user),
        permission,
      });
    }
    return { id: req.id, status: req.status };
  }

  async pendingCount(actor: AuthUser) {
    const count = await this.requests
      .createQueryBuilder('r')
      .innerJoin('r.note', 'n')
      .where("r.status = 'pending'")
      .andWhere('n.owner_id = :uid', { uid: actor.id })
      .getCount();
    return { count };
  }
}
